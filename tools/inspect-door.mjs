// Door finder for single-mesh Cozy Village buildings. For each GLB prints the
// bbox and, for each cardinal wall, the ground-band protrusion of a LOCALIZED
// step (a door threshold is narrow, not the full wall). Run:
//   node tools/inspect-door.mjs a.glb b.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const r3 = (n) => Math.round(n * 1000) / 1000;

for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const pts = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = new THREE.Matrix4().fromArray(node.getWorldMatrix());
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) pts.push(new THREE.Vector3(...pos.getElement(i, v)).applyMatrix4(M));
    }
  }
  const box = new THREE.Box3().setFromPoints(pts);
  const size = new THREE.Vector3(); box.getSize(size);
  // Body footprint from the mid-height band (ignores roof/step overhangs).
  const midBand = pts.filter((p) => p.y > box.min.y + size.y * 0.3 && p.y < box.min.y + size.y * 0.6);
  const mb = new THREE.Box3().setFromPoints(midBand);
  // Low band for step detection.
  const low = pts.filter((p) => p.y < box.min.y + 0.3);
  // For each side, measure the max protrusion of the low band past the body
  // wall, counting only points actually past the wall (a localized step).
  const probe = (axis, sign, wall) => {
    const pts2 = low.filter((p) => sign * (p[axis] - wall) > 0.02);
    if (!pts2.length) return { protrude: 0, span: 0, at: 0 };
    const other = axis === 'z' ? 'x' : 'z';
    const os = pts2.map((p) => p[other]);
    const protr = Math.max(...pts2.map((p) => sign * (p[axis] - wall)));
    return { protrude: r3(protr), span: r3(Math.max(...os) - Math.min(...os)), at: r3(sign > 0 ? Math.max(...pts2.map(p=>p[axis])) : Math.min(...pts2.map(p=>p[axis]))) };
  };
  const sides = {
    '+z': probe('z', +1, mb.max.z), '-z': probe('z', -1, mb.min.z),
    '+x': probe('x', +1, mb.max.x), '-x': probe('x', -1, mb.min.x),
  };
  console.log(f.split('/').pop());
  console.log('  bbox min', box.min.toArray().map(r3), 'max', box.max.toArray().map(r3), 'size', size.toArray().map(r3));
  console.log('  body(mid) x', [r3(mb.min.x), r3(mb.max.x)], 'z', [r3(mb.min.z), r3(mb.max.z)]);
  for (const [k, s] of Object.entries(sides)) console.log(`  ${k}: protrude=${s.protrude} span=${s.span} at=${s.at}`);
}
