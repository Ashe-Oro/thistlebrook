#!/usr/bin/env node
// Compress every pack GLB inside dist/ in place, keeping each URL path
// unchanged so the app's loaders need no new routes. Each unique model (by
// content hash) is encoded two ways and the smaller wins:
//   draco   – KHR_draco_mesh_compression (edgebreaker; 14-bit positions,
//             10-bit normals/colours). Decodes back to float positions in the
//             original coordinate frame, so no node transforms change.
//   meshopt – EXT_meshopt_compression with dedup/weld/reorder and quantized
//             colours/normals. Positions stay float for the same reason.
// The pack models are flat-shaded vertex-colour meshes (3 unwelded vertices
// per triangle), which Draco's connectivity coder handles far better, so
// Draco wins for nearly all of them; meshopt is the fallback where it is
// smaller (e.g. tiny or animated files).
// Every result is validated (node names, mesh/animation counts, scene bounds)
// before it replaces the original; failures keep the original bytes.
// Outputs are licensed-derived: they live only in dist/ and the gitignored
// .licensed-cache/, never in git.
import {NodeIO, PropertyType} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {dedup, weld, reorder, quantize, draco, getBounds} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {cpus} from 'node:os';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(root, '.licensed-cache', 'glb-compress-v2');
const VERSION = 2;
// Only identical accessors are merged: meshes and materials keep their
// one-per-node identity because app code recolours and swaps them per mesh.
const DEDUP = {propertyTypes: [PropertyType.ACCESSOR]};

async function makeIO() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
}

function summary(doc) {
  const r = doc.getRoot();
  const scene = r.getDefaultScene() || r.listScenes()[0];
  const b = scene ? getBounds(scene) : {min: [0, 0, 0], max: [0, 0, 0]};
  return {
    nodes: r.listNodes().map((n) => n.getName()).join('|'),
    meshes: r.listMeshes().map((m) => m.getName()).join('|'),
    materials: r.listMaterials().map((m) => m.getName()).join('|'),
    prims: r.listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0),
    anims: r.listAnimations().map((a) => a.getName()).join('|'),
    skins: r.listSkins().length,
    min: b.min, max: b.max,
  };
}

function sameShape(a, b) {
  if (a.nodes !== b.nodes || a.meshes !== b.meshes || a.materials !== b.materials || a.prims !== b.prims || a.anims !== b.anims || a.skins !== b.skins) return 'structure';
  const span = Math.max(...a.max.map((v, i) => v - a.min[i]), 1e-6);
  for (let i = 0; i < 3; i++) {
    if (Math.abs(a.min[i] - b.min[i]) > span * 1e-3 || Math.abs(a.max[i] - b.max[i]) > span * 1e-3) return 'bounds';
  }
  return null;
}

const ATTR_SAFE = /^(COLOR|TEXCOORD)(_\d+)?$/;
const VARIANTS = {
  async draco(doc) {
    await doc.transform(dedup(DEDUP), weld(), draco({method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeColor: 10, quantizeTexcoord: 12, quantizeGeneric: 12}));
  },
  async meshopt(doc) {
    await doc.transform(dedup(DEDUP), weld(), reorder({encoder: MeshoptEncoder, target: 'size'}), quantize({pattern: ATTR_SAFE, quantizeColor: 16}));
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.FILTER});
  },
};

async function compressOne(io, raw) {
  const original = await io.readBinary(new Uint8Array(raw));
  const used = original.getRoot().listExtensionsUsed().map((e) => e.extensionName);
  if (used.some((n) => n === 'KHR_draco_mesh_compression' || n === 'EXT_meshopt_compression')) return {choice: 'kept', reason: 'already compressed', size: raw.length};
  const ref = summary(original);
  const results = {};
  for (const [name, fn] of Object.entries(VARIANTS)) {
    try {
      const doc = await io.readBinary(new Uint8Array(raw));
      await fn(doc);
      const bytes = Buffer.from(await io.writeBinary(doc));
      const back = summary(await io.readBinary(new Uint8Array(bytes)));
      const bad = sameShape(ref, back);
      results[name] = bad ? {error: bad} : {bytes, size: bytes.length};
    } catch (err) {
      results[name] = {error: String(err.message || err).slice(0, 200)};
    }
  }
  let best = null;
  for (const [name, r] of Object.entries(results)) if (r.bytes && (!best || r.size < best.size)) best = {name, ...r};
  const sizes = Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.size ?? r.error]));
  if (!best || best.size >= raw.length) return {choice: 'kept', reason: 'no smaller valid variant', size: raw.length, sizes};
  return {choice: best.name, size: best.size, bytes: best.bytes, sizes};
}

async function worker(listFile) {
  const io = await makeIO();
  const jobs = JSON.parse(readFileSync(listFile, 'utf8'));
  for (const {file, hash} of jobs) {
    const raw = readFileSync(file);
    const res = await compressOne(io, raw);
    if (res.bytes) writeFileSync(join(cacheDir, `${hash}.glb`), res.bytes);
    const {bytes, ...meta} = res;
    writeFileSync(join(cacheDir, `${hash}.json`), JSON.stringify({version: VERSION, rawSize: raw.length, ...meta}));
    process.stdout.write(`${meta.choice.padEnd(7)} ${(raw.length / 1e6).toFixed(2)} -> ${(meta.size / 1e6).toFixed(2)} MB ${relative(root, file)}\n`);
  }
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, {withFileTypes: true})) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (e.name.endsWith('.glb')) acc.push(p);
  }
  return acc;
}

/** Compress all GLBs under `dir` in place. Returns per-file stats. */
export async function compressDir(dir, {jobs = Math.max(1, Math.min(6, cpus().length - 2))} = {}) {
  mkdirSync(cacheDir, {recursive: true});
  const files = walk(dir).map((file) => ({file, hash: createHash('sha1').update(readFileSync(file)).digest('hex')}));
  const todo = new Map();
  for (const f of files) if (!existsSync(join(cacheDir, `${f.hash}.json`)) && !todo.has(f.hash)) todo.set(f.hash, f);
  const pending = [...todo.values()].sort((a, b) => statSync(b.file).size - statSync(a.file).size);
  if (pending.length) {
    console.log(`Compressing ${pending.length} unique GLBs (${files.length} files) with ${jobs} workers…`);
    const buckets = Array.from({length: jobs}, () => []);
    pending.forEach((p, i) => buckets[i % jobs].push(p));
    await Promise.all(buckets.filter((b) => b.length).map((bucket, i) => new Promise((ok, fail) => {
      const list = join(cacheDir, `.jobs-${process.pid}-${i}.json`);
      writeFileSync(list, JSON.stringify(bucket));
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker', list], {stdio: ['ignore', 'inherit', 'inherit'], cwd: root});
      child.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`worker ${i} exited ${code}`))));
    })));
  }
  const stats = {files: files.length, before: 0, after: 0, byChoice: {}};
  for (const {file, hash} of files) {
    const meta = JSON.parse(readFileSync(join(cacheDir, `${hash}.json`), 'utf8'));
    stats.before += meta.rawSize;
    const c = (stats.byChoice[meta.choice] ??= {files: 0, before: 0, after: 0});
    c.files++; c.before += meta.rawSize; c.after += meta.size;
    stats.after += meta.size;
    if (meta.choice !== 'kept') writeFileSync(file, readFileSync(join(cacheDir, `${hash}.glb`)));
  }
  return stats;
}

const argv = process.argv.slice(2);
if (argv[0] === '--worker') {
  await worker(argv[1]);
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(argv[0] || join(root, 'dist'));
  const s = await compressDir(dir);
  console.log(`GLBs: ${(s.before / 1e6).toFixed(1)} MB -> ${(s.after / 1e6).toFixed(1)} MB across ${s.files} files`);
  for (const [k, v] of Object.entries(s.byChoice)) console.log(`  ${k}: ${v.files} files ${(v.before / 1e6).toFixed(1)} -> ${(v.after / 1e6).toFixed(1)} MB`);
}
