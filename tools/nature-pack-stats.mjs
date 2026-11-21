#!/usr/bin/env node
// Measures every GLB in the owned Nature pack (77 individual assets, the 5
// prebuilds and the combined catalog): triangles, bounds, raw bytes and the
// Draco size that tools/compress-dist-glbs.mjs ships. Derived numbers only;
// no geometry leaves the pack. Run compress-dist-glbs.mjs on a copy of
// glb/individual first so its content-hash cache has the Draco sizes.
//   node tools/nature-pack-stats.mjs [out.json]
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export const PACK = '/workspace/threejs-assets/nature/bundle/glb';
const cache = new URL('../.licensed-cache/glb-compress-v2/', import.meta.url).pathname;
const out = process.argv[2] || '/workspace/scratch/opus-nature/pack-stats.json';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder': await draco3d.createDecoderModule()});

async function measure(file) {
  const raw = readFileSync(file), doc = await io.readBinary(new Uint8Array(raw));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let tris = 0, meshes = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue; meshes++;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), idx = prim.getIndices();
      tris += (idx ? idx.getCount() : pos.getCount()) / 3;
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        const w = [0, 1, 2].map((k) => m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k]);
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], w[k]); max[k] = Math.max(max[k], w[k]); }
      }
    }
  }
  const hash = createHash('sha1').update(raw).digest('hex'), meta = join(cache, hash + '.json');
  const draco = existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')).size : null;
  const r = (n) => +n.toFixed(2);
  return {tris, meshes, size: [r(max[0] - min[0]), r(max[1] - min[1]), r(max[2] - min[2])], min: min.map(r), max: max.map(r), raw: raw.length, draco,
    compressed: doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === 'KHR_draco_mesh_compression')};
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const stats = {individual: {}, prebuilds: {}, catalog: null};
  for (const f of readdirSync(join(PACK, 'individual')).sort()) stats.individual[f.replace('.glb', '')] = await measure(join(PACK, 'individual', f));
  for (const f of readdirSync(join(PACK, 'prebuilds')).sort()) stats.prebuilds[f.replace('.glb', '')] = await measure(join(PACK, 'prebuilds', f));
  stats.catalog = await measure(join(PACK, 'nature.glb'));
  writeFileSync(out, JSON.stringify(stats, null, 1) + '\n');
  const n = Object.keys(stats.individual).length + Object.keys(stats.prebuilds).length + 1;
  console.log(`${n} GLBs measured -> ${out}`);
}
