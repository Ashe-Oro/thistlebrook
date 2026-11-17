// Debug gizmos for resolved catalog anchors. Add the returned group as a child
// of a placed pivot so it inherits the placement transform.
import * as THREE from 'three';

const COLORS = { footprint: 0x00c8ff, lot: 0x3ddc84, bounds: 0xffffff, roof: 0xff8a00, door: 0xff2d55, path: 0xffd400, fence: 0xd04dff };
const lineMat = (c) => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true });
const dotMat = (c) => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true });

function rect(min, max, y, color) {
  const p = [[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]].map(([x, z]) => new THREE.Vector3(x, y, z));
  const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(p), lineMat(color));
  l.renderOrder = 999;
  return l;
}
function box3(b, color) {
  const h = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)), color);
  h.material.depthTest = false; h.material.transparent = true; h.renderOrder = 998;
  return h;
}
function dot(pos, color, r = 0.22) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), dotMat(color));
  m.position.set(...pos); m.renderOrder = 1000;
  return m;
}
function arrow(pos, dir, len, color) {
  const a = new THREE.ArrowHelper(new THREE.Vector3(...dir).normalize(), new THREE.Vector3(...pos), len, color, 0.5, 0.35);
  a.traverse((o) => { if (o.material) { o.material.depthTest = false; o.material.transparent = true; } o.renderOrder = 1001; });
  return a;
}

/** layers: { footprint, lot, bounds, roof, door, snaps } booleans. */
export function anchorGizmo(e) {
  const g = new THREE.Group();
  g.name = 'anchors';
  const add = (layer, o) => { o.userData.layer = layer; g.add(o); };
  add('footprint', rect(e.footprint.min, e.footprint.max, 0.06, COLORS.footprint));
  if (e.lot) add('lot', rect(e.lot.min, e.lot.max, 0.05, COLORS.lot));
  add('bounds', box3(e.bounds, COLORS.bounds));
  if (e.roof) add('roof', box3(e.roof, COLORS.roof));
  if (e.door) { add('door', dot(e.door.pos, COLORS.door, 0.18)); add('door', arrow(e.door.pos, e.door.facing, 2.2, COLORS.door)); }
  for (const s of e.pathSnaps) { add('snaps', dot(s.pos, COLORS.path)); add('snaps', arrow(s.pos, s.dir, 0.9, COLORS.path)); }
  for (const s of e.fenceSnaps) add('snaps', dot(s.pos, COLORS.fence, 0.18));
  return g;
}

export function setLayers(root, layers) {
  root.traverse((o) => { if (o.name === 'anchors') for (const c of o.children) c.visible = !!layers[c.userData.layer]; });
}
export const GIZMO_COLORS = COLORS;
