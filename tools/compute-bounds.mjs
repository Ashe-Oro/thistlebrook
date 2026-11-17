// Computes bounds for every catalog entry from real geometry and writes
// src/catalog/bounds.json (derived numbers only — no licensed geometry).
//   meshes:   glTF-Transform + Draco decoder over the GLB in public/
//   builders: construct the builder under three.js in node, walk its meshes
// All numbers are SOURCE units, before scale / yOffset. Run: npm run catalog:bounds
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';
import { writeFileSync, existsSync } from 'node:fs';
import { CATALOG } from '../src/catalog/catalog.js';
import { BUILDERS } from '../src/catalog/builders-registry.js';
import { validateEntry } from '../src/catalog/schema.js';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

async function meshPoints(e) {
  const file = new URL('../public/' + e.path, import.meta.url).pathname;
  if (!existsSync(file)) return null;
  const doc = await io.read(file);
  const pts = []; let tris = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = new THREE.Matrix4().fromArray(node.getWorldMatrix());
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'); const idx = prim.getIndices();
      tris += (idx ? idx.getCount() : pos.getCount()) / 3;
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) pts.push(new THREE.Vector3(...pos.getElement(i, v)).applyMatrix4(M));
    }
  }
  return { pts, tris };
}

function builderPoints(e) {
  const obj = BUILDERS[e.builder](e.params || {});
  obj.updateMatrixWorld(true);
  const pts = []; let tris = 0;
  obj.traverse((o) => {
    if (!o.isMesh || o.material.isShaderMaterial) return; // skip outline hulls
    const pos = o.geometry.attributes.position;
    tris += (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
    for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
  });
  return { pts, tris };
}

const out = {};
for (const e of CATALOG) {
  validateEntry(e);
  const r = e.source === 'mesh' ? await meshPoints(e) : builderPoints(e);
  if (!r) { console.warn('MISSING', e.id, e.path); continue; }
  const { pts, tris } = r;
  const box = new THREE.Box3().setFromPoints(pts);
  const ground = pts.filter((p) => p.y < box.min.y + (e.groundY ?? 0.6));
  const g = new THREE.Box3().setFromPoints(ground);
  let roof = null;
  if (e.eaveY != null) {
    const rb = new THREE.Box3().setFromPoints(pts.filter((p) => p.y >= e.eaveY));
    roof = { min: rb.min.toArray(), max: rb.max.toArray() };
  }
  const r3 = (a) => a.map((v) => Math.round(v * 1000) / 1000);
  out[e.id] = {
    tris: Math.round(tris),
    min: r3(box.min.toArray()), max: r3(box.max.toArray()),
    base: { min: r3([g.min.x, g.min.z]), max: r3([g.max.x, g.max.z]) },
    roof: roof && { min: r3(roof.min), max: r3(roof.max) },
  };
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(e.scale);
  console.log(e.id.padEnd(20), String(Math.round(tris)).padStart(5), 'tris  world size', size.toArray().map((v) => v.toFixed(2)).join(' x '));
}
writeFileSync(new URL('../src/catalog/bounds.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('wrote src/catalog/bounds.json');
