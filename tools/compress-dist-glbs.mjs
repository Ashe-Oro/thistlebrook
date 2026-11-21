#!/usr/bin/env node
// Compress model GLBs in place. Keep named nodes and exact material identity
// for animated parts and application recolouring. Validate scene bounds and
// topology metadata after the round trip, then select the smallest encoding.
// Only the build output and the ignored licensed cache contain model bytes.
import {NodeIO, PropertyType} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {dedup, dequantize, weld, reorder, quantize, draco, getBounds} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, rmSync} from 'node:fs';
import {cpus} from 'node:os';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {encodeTextures} from './model-textures.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const cacheDir = join(root, 'public/licensed/fast-load/compression-v3');
const VERSION = 3;
// Identical accessors and textures are merged. Meshes and materials keep their
// one-per-node identity because app code recolours and swaps them per mesh.
const DEDUP = {propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE]};

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
  async draco(doc, precise) {
    doc.getRoot().listExtensionsUsed().find(ext => ext.extensionName === 'EXT_meshopt_compression')?.dispose();
    await doc.transform(dequantize(), dedup(DEDUP), weld(), draco({method: 'edgebreaker', quantizePosition: precise ? 14 : 13,
      quantizeNormal: precise ? 10 : 9, quantizeColor: precise ? 10 : 8, quantizeTexcoord: 12, quantizeGeneric: 12}));
  },
  async meshopt(doc) {
    await doc.transform(dedup(DEDUP), weld(), reorder({encoder: MeshoptEncoder, target: 'size'}), quantize({pattern: ATTR_SAFE, quantizeColor: 16}));
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.FILTER});
  },
};

async function compressOne(io, raw, file) {
  const original = await io.readBinary(new Uint8Array(raw));
  const used = original.getRoot().listExtensionsUsed().map((e) => e.extensionName);
  const compressed = used.some(n => ['KHR_draco_mesh_compression','EXT_meshopt_compression'].includes(n));
  const precise = /(?:fairground|airfield|characters)[/\\]/.test(file);
  // Vehicle rendering uses vertex colour or material base colour exclusively.
  const untextured = file.endsWith('realistic_ambulance_01.glb');
  const ref = summary(original);
  const results = {};
  for (const [name, fn] of Object.entries(VARIANTS)) {
    if ((compressed || untextured) && name === 'meshopt') continue;
    try {
      const doc = await io.readBinary(new Uint8Array(raw));
      if (untextured) for (const texture of doc.getRoot().listTextures()) texture.dispose();
      else encodeTextures(doc,join(cacheDir,'textures'),{smallModels:file.includes('/hy3d/')});
      await fn(doc,precise);
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
    const res = await compressOne(io, raw, file);
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
  const files = walk(dir).map(file => ({file, hash: createHash('sha256')
    .update(/(?:fairground|airfield|characters)[/\\]/.test(file) ? 'precise:' : 'default:')
    .update(file.endsWith('realistic_ambulance_01.glb') ? 'untextured:' : '')
    .update(file.includes('/hy3d/') ? 'basis-v2:' : '')
    .update(process.env.TOKTX || '')
    .update(readFileSync(file)).digest('hex')}));
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
      child.once('error',fail);
      child.once('exit', code => {
        rmSync(list,{force:true});
        if (code === 0) ok();
        else fail(new Error(`worker ${i} exited ${code}`));
      });
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
