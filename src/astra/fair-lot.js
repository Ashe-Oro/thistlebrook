// OWNER: grok-fairlot lane. Renders Funfair Parking from fair-lot-plan.js and
// mirrors fair-lot-sim.js. Static ground is batched by colour, cars are one
// instanced mesh per style and part, visitors one per townsfolk part.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {toonMaterial, outlineMaterial} from '../toon.js';
import {place} from '../catalog/loader.js';
import {districtKit} from './downtown-kit.js';
import {createTeslaVehicle} from './tesla/models.js';
import {tagAssembly} from './registry/render-tags.js';
import * as P from './fair-lot-plan.js';
import {createFairLotSim, STYLES} from './fair-lot-sim.js';

const C = {asphalt: '#7c8980', apron: '#7c8980', paint: '#ece6cf', kerb: '#c9c2ad', paving: '#d8c9a8', grass: '#8fae6a', pole: '#4c5a57', glow: '#ffe3a6', trunk: '#8a6a48', leaf: '#6f9f55', leaf2: '#86b263', red: '#b8433c', cream: '#f4dfad', teal: '#466b70'};
const Y = {ground: .046, paint: .062}, ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (const p of pts.reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function flat(points, y, color) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  const m = new THREE.Mesh(g, toonMaterial(color)); m.receiveShadow = true; return m;
}
/** One template per style: paint (instance colour), fixed trim (vertex colour), ink hull. */
function carTemplate(style) {
  const src = new THREE.Group();
  if (style === 'hatch') {
    const box = (x, y, z, w, h, d, c, outline) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(x, y, z), toonMaterial(c)); if (outline) m.userData.ink = true; src.add(m); };
    box(0, .46, 0, 1.18, .42, 2.56, '#ffffff', true); box(0, .86, -.12, 1.02, .4, 1.38, '#ffffff', true);
    box(0, .88, -.12, 1.06, .3, 1.2, '#466568'); box(0, .87, .52, .96, .28, .1, '#466568');
    box(0, .34, 1.29, 1.1, .16, .06, '#3c514e'); box(0, .34, -1.29, 1.1, .16, .06, '#3c514e');
    for (const x of [-.56, .56]) for (const z of [-.82, .82]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .14, 10).rotateZ(Math.PI / 2).translate(x, .22, z), toonMaterial('#2c3436')); src.add(w); }
  } else src.add(createTeslaVehicle(style, {color: '#ffffff', scale: CAR_SCALE[style]}));
  src.updateMatrixWorld(true);
  const paint = [], fixed = [], ink = [];
  src.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld); g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (o.userData.outline) { ink.push(g); return; }
    const c = o.material.color ? o.material.color.clone() : new THREE.Color('#333');
    if (o.userData.ink) ink.push(g.clone());
    if (c.getHexString() === 'ffffff') paint.push(g);
    else { const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); fixed.push(g); }
  });
  return {paint: mergeGeometries(paint), fixed: fixed.length ? mergeGeometries(fixed) : null, ink: ink.length ? mergeGeometries(ink) : null};
}
const vertexToon = () => trimMaterial ??= new THREE.MeshToonMaterial({color: '#ffffff', vertexColors: true, gradientMap: toonMaterial('#ffffff').gradientMap});
function plain(o) {
  let g = o.geometry.clone().applyMatrix4(o.matrixWorld); g = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
/** Every plain toon part of the lot becomes ONE vertex-coloured mesh; glowing
 * lamp heads and the canvas signs stay instanced by geometry and material. */
function bakeStatics(statics, root) {
  statics.updateMatrixWorld(true);
  const plainParts = [], batches = new Map();
  statics.traverse((o) => { if (!o.isMesh) return; if (o.material.isMeshToonMaterial && !o.material.emissive?.getHex()) plainParts.push(o); else { const key = o.geometry.uuid + o.material.uuid; if (!batches.has(key)) batches.set(key, []); batches.get(key).push(o); } });
  const geos = plainParts.map((o) => { const g = plain(o), c = o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; });
  const ground = new THREE.Mesh(mergeGeometries(geos), vertexToon()); ground.name = 'Funfair Parking ground'; ground.castShadow = true; ground.receiveShadow = true; root.add(ground); geos.forEach((g) => g.dispose());
  for (const list of batches.values()) { const m = new THREE.InstancedMesh(list[0].geometry, list[0].material, list.length); list.forEach((o, i) => m.setMatrixAt(i, o.matrixWorld)); m.name = 'Funfair Parking lamps & signs'; m.castShadow = list[0].castShadow; root.add(m); }
}
// Toy Teslas are 2.3-2.5 m long; scale them into the 2.6 m bay car.
const CAR_SCALE = {sedan: 1.08, crossover: 1.06, cybertruck: 1};
let trimMaterial = null;

export async function buildFairLot(scene, town, {hour = 10, seed = town?.seed ?? 831} = {}) {
  const root = new THREE.Group(); root.name = 'Funfair Parking'; scene.add(root);
  const kit = districtKit(root), {box, orb, drum, sign} = kit, statics = kit.root;
  // ---- ground: lot + apron hull onto the road end, walkway to the gate, paint.
  const L = P.ROAD_LENGTH, roadEdge = [];
  for (let s = L - 11; s <= L + .01; s += 1) { const {p, t} = P.roadPose(s); for (const k of [-2.6, 2.6]) roadEdge.push([p[0] + t[1] * k, p[1] - t[0] * k]); }
  statics.add(flat(hull([...roadEdge, [P.LOT.minX + .5, P.LOT.minZ], [P.LOT.minX + .5, 14.5], [P.LANES.W, 14.5]]), Y.ground - .004, C.apron));
  statics.add(flat([[P.LOT.minX, P.LOT.minZ], [P.LOT.maxX, P.LOT.minZ], [P.LOT.maxX, P.LOT.maxZ], [P.LOT.minX, P.LOT.maxZ]], Y.ground, C.asphalt));
  const W = P.WALKWAY; statics.add(flat([[W.min[0], W.min[1]], [W.max[0], W.min[1]], [W.max[0], W.max[1]], [W.min[0], W.max[1]], [222.6, 1.6], [221.2, -.4], [223.2, -1], [225.4, 1.2]], Y.ground + .01, C.paving));
  // Kerbs: lot edge (open at the apron), islands, promenade and seams.
  const kerb = (x0, z0, x1, z1, h = .14, c = C.kerb) => box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, Math.abs(x1 - x0), h, Math.abs(z1 - z0), c);
  kerb(P.LOT.minX, P.LOT.maxZ, P.LOT.maxX, P.LOT.maxZ + .25); kerb(P.LOT.maxX, P.LOT.minZ, P.LOT.maxX + .25, P.LOT.maxZ + .25);
  kerb(P.LOT.minX - .25, 14.5, P.LOT.minX, P.LOT.maxZ + .25); kerb(P.WALKWAY.max[0], P.LOT.minZ - .25, P.LOT.maxX + .25, P.LOT.minZ);
  kerb(P.WALKWAY.min[0] - .5, P.LOT.minZ - .25, P.PROMENADE.min[0], P.LOT.minZ);
  for (const p of P.PLANTERS) { kerb(p.min[0], p.min[1], p.max[0], p.max[1], .16); kerb(p.min[0] + .1, p.min[1] + .1, p.max[0] - .1, p.max[1] - .1, .2, C.grass); }
  for (const [z0, z1] of [[9, 16.2], [20.6, 27.8]]) { kerb(P.PROMENADE.min[0] + .15, z0, P.PROMENADE.max[0] - .15, z1, .15); kerb(P.PROMENADE.min[0] + .25, z0 + .05, P.PROMENADE.max[0] - .25, z1 - .05, .17, C.paving); }
  for (const s of P.SEAMS) { kerb(s.min[0] + 1.83, s.min[1] + .15, P.PROMENADE.min[0] + .15, s.max[1] - .15, .1, C.paving); kerb(P.PROMENADE.max[0] - .15, s.min[1] + .15, s.max[0] - 1.83, s.max[1] - .15, .1, C.paving); }
  kerb(P.SOUTH_STRIP.min[0], P.SOUTH_STRIP.min[1] + .25, P.SOUTH_STRIP.max[0], P.SOUTH_STRIP.max[1], .12, C.grass);
  // Paint: bay dividers, aisle arrows, the A0 lane line and zebra crossings.
  const paint = (x, z, w, d, yaw = 0) => { const m = box(x, Y.paint, z, w, .012, d, C.paint); m.rotation.y = yaw; m.castShadow = false; return m; };
  for (const row of P.ROWS) for (let k = 1; k <= 19; k++) {
    if (k === 10) continue; // mid-promenade
    const x = 227.4 + 1.83 * k;
    paint(x, (row.z0 + row.z1) / 2 + row.nose * .15, .08, row.z1 - row.z0 - .3);
  }
  for (const row of P.ROWS) { const zf = row.nose > 0 ? row.z0 : row.z1; for (const [a, b] of [[227.4 + 1.83, 227.4 + 1.83 * 9], [227.4 + 1.83 * 11, 227.4 + 1.83 * 19]]) paint((a + b) / 2, zf + row.nose * .05, b - a, .07); }
  for (let x = 228.4; x < 264; x += 2.2) paint(x, P.AISLES.A0.min[1] + 2.2, 1.1, .08);
  const arrow = (x, z, dx, dz) => { const yaw = Math.atan2(dx, dz); paint(x, z, .12, 1.4, yaw); for (const s of [-1, 1]) paint(x + dx * .45 + s * dz * .22, z + dz * .45 - s * dx * .22, .1, .65, yaw + s * .65); };
  arrow(236, P.LANES.A0in, 1, 0); arrow(255, P.LANES.A0in, 1, 0); arrow(P.LANES.E, 12, 0, 1); arrow(P.LANES.E, 24, 0, 1);
  arrow(240, P.LANES.A1, -1, 0); arrow(256, P.LANES.A1, -1, 0); arrow(240, P.LANES.A2, -1, 0); arrow(256, P.LANES.A2, -1, 0);
  arrow(P.LANES.W, 26, 0, -1); arrow(P.LANES.W, 13, 0, -1);
  for (const c of P.CROSSWALKS) for (let x = c.min[0] + .3; x < c.max[0] - .1; x += .72) paint(x + .18, (c.min[1] + c.max[1]) / 2, .36, c.max[1] - c.min[1] - .3);
  // Lamps, trees, booth and the sign.
  for (const [x, z] of P.LAMPS) { drum(x, 2.1, z, .07, 4.2, C.pole); box(x, 4.2, z, .5, .1, .26, C.pole); box(x, 4.12, z, .36, .08, .2, C.glow, statics, true); }
  for (const [x, z] of P.LAMPS.filter((_, i) => i % 3 === 0)) kit.pool(x, z, 4.2, '#ffd88a');
  P.TREES.forEach(([x, z], i) => { const s = .85 + (i % 3) * .12; drum(x, .8 * s, z, .12 * s, 1.6 * s, C.trunk); orb(x, 2.1 * s, z, 1.05 * s, i % 2 ? C.leaf : C.leaf2); orb(x + .3 * s, 2.7 * s, z - .2 * s, .7 * s, i % 2 ? C.leaf2 : C.leaf); });
  const [bx, bz] = P.BOOTH.center; box(bx, 1.05, bz, P.BOOTH.size[0], 2.1, P.BOOTH.size[1], C.cream); box(bx, 1.35, bz + .56, 1.0, .55, .03, C.teal); box(bx, 2.22, bz, P.BOOTH.size[0] + .35, .14, P.BOOTH.size[1] + .35, C.red);
  for (let i = 0; i < 4; i++) box(bx - .6 + i * .4, 2.33, bz, .18, .08, P.BOOTH.size[1] + .3, i % 2 ? C.cream : C.red);
  const tickets = sign('TICKETS', bx + .2, 1.95, bz + .58, 1.1, .22, C.red); tickets.rotation.y = 0;
  const {center: [sx, sz], width: sw, yaw} = P.SIGN, ax = [Math.cos(yaw), -Math.sin(yaw)];
  for (const k of [-.42, .42]) drum(sx + ax[0] * sw * k, 1.6, sz + ax[1] * sw * k, .09, 3.2, C.pole);
  const board = sign(P.SIGN.text, sx, 3.45, sz, sw, 1.15, C.red); board.rotation.y = yaw;
  const back = box(sx, 3.45, sz, sw + .2, 1.3, .1, C.teal); back.rotation.y = yaw; board.position.x += Math.sin(yaw) * .07; board.position.z += Math.cos(yaw) * .07;
  const disc = sign('P', sx + ax[0] * (sw / 2 + .55), 3.45, sz + ax[1] * (sw / 2 + .55), .9, .9, '#3f6fa3'); disc.rotation.y = yaw;
  bakeStatics(statics, root);

  // ---- cars
  const CAP = P.BAYS.length + 8, batches = new Map();
  for (const {id} of STYLES) {
    const tpl = carTemplate(id), parts = [];
    for (const [key, geometry, material] of [['paint', tpl.paint, toonMaterial('#ffffff')], ['fixed', tpl.fixed, null], ['ink', tpl.ink, outlineMaterial(.009)]]) {
      if (!geometry) continue;
      const mesh = new THREE.InstancedMesh(geometry, key === 'fixed' ? vertexToon() : material, CAP); mesh.name = `Funfair Parking ${id} ${key}`; mesh.count = 1; mesh.setMatrixAt(0, ZERO); mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = key !== 'ink'; mesh.receiveShadow = key !== 'ink';
      if (key === 'paint') mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
      root.add(mesh); parts.push(mesh);
    }
    batches.set(id, parts);
  }
  // ---- visitors: instanced townsfolk, one batch per role and mesh.
  const roles = ['merchant', 'child'], VCAP = 40, crowd = [];
  for (const role of roles) {
    const template = await place('townsfolk-' + role); template.updateMatrixWorld(true);
    template.traverse((part) => { if (!part.isMesh) return; const mesh = new THREE.InstancedMesh(part.geometry, part.material, VCAP); mesh.count = 1; mesh.setMatrixAt(0, ZERO); mesh.frustumCulled = false; mesh.castShadow = !part.userData.outline; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.name = 'Funfair Parking visitors'; root.add(mesh); crowd.push({role, mesh, local: part.matrixWorld.clone()}); });
  }
  const owner = town?.districts?.find((d) => d.id === 'themepark')?.registryId;
  if (owner) tagAssembly(root, owner);
  const dynamic = [...[...batches.values()].flat(), ...crowd.map((c) => c.mesh)];
  const retag = (mesh) => { if (owner) mesh.userData.registryIds = Array.from({length: mesh.count}, () => owner); };

  const sim = createFairLotSim({hour, seed});
  const tf = new THREE.Object3D(), color = new THREE.Color(), m4 = new THREE.Matrix4();
  let lastT = null;
  function render(t) {
    const counts = new Map(STYLES.map((s) => [s.id, 0]));
    for (const v of sim.vehicles()) {
      const parts = batches.get(v.style), i = counts.get(v.style); if (!parts || i >= CAP) continue; counts.set(v.style, i + 1);
      tf.position.set(v.position[0], .02, v.position[1]); tf.rotation.set(0, Math.atan2(v.direction[0], v.direction[1]), 0); tf.scale.setScalar(1); tf.updateMatrix();
      for (const mesh of parts) { mesh.setMatrixAt(i, tf.matrix); if (mesh.instanceColor) mesh.setColorAt(i, color.set(v.color)); }
    }
    // Never an empty batch: the registry needs one id per instance, so an
    // unused style keeps a single zero-scale instance.
    for (const [id, parts] of batches) for (const mesh of parts) { const n = counts.get(id); if (!n) mesh.setMatrixAt(0, ZERO); mesh.visible = n > 0; mesh.count = Math.max(1, n); mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    const people = sim.people(), per = new Map(roles.map((r) => [r, 0]));
    for (const p of people) {
      const n = Number(p.id.split('-').at(-1)), role = roles[n % roles.length], i = per.get(role); if (i >= VCAP) continue; per.set(role, i + 1);
      const s = role === 'child' ? .62 : .8 + (n % 3) * .05, bob = p.waiting ? 0 : Math.abs(Math.sin(t * 7 + n)) * .05;
      tf.position.set(p.x, .16 + bob, p.z); tf.rotation.set(0, p.heading, p.waiting ? 0 : Math.sin(t * 7 + n) * .035); tf.scale.setScalar(s); tf.updateMatrix();
      for (const c of crowd) if (c.role === role) c.mesh.setMatrixAt(i, m4.multiplyMatrices(tf.matrix, c.local));
    }
    for (const c of crowd) { const n = per.get(c.role); if (!n) c.mesh.setMatrixAt(0, ZERO); c.mesh.visible = n > 0; c.mesh.count = Math.max(1, n); c.mesh.instanceMatrix.needsUpdate = true; }
    dynamic.forEach(retag);
  }
  render(0);
  const bounds = new THREE.Box3(new THREE.Vector3(P.LOT.minX, 0, P.LOT.minZ), new THREE.Vector3(P.LOT.maxX, 4, P.LOT.maxZ));
  return {
    root, sim,
    selectables: [{type: 'venue', data: {id: 'funfair-parking', name: 'Funfair Parking', district: 'themepark', story: `${P.BAYS.length} marked bays beside Pinecrest's Funfair gate. Cars come off the mountain road, follow the arrows round the one-way aisles and park nose-in; visitors walk the centre promenade and cross at the zebras to the gate. Busy from late morning until the lights go out.`}, bounds}],
    update(t, hour, night, people = []) {
      kit.update(night);
      const dt = lastT === null ? 0 : Math.max(0, Math.min(.5, t - lastT)); lastT = t;
      const near = [];
      for (const p of people) { const o = p.object?.position || p; if (o.x > 180 && o.x < 276 && o.z > -12 && o.z < 42) near.push({x: o.x, z: o.z}); }
      if (dt > 0) sim.update(dt, hour, near, t); else sim.update(1e-6, hour, near, t);
      render(t);
    },
    audit() { return {...sim.audit(), drawCalls: 1 + dynamic.length}; },
  };
}
