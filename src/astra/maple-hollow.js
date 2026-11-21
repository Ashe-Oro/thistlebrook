// OWNER: opus-suburb lane. Maple Hollow renderer: dresses the streets the
// regional planner laid out (asphalt, kerbs, sidewalks, crossings, cul-de-sac
// bulbs), draws every lot from the compiled plan (one InstancedMesh per pack
// model, each with its ink hull), mirrors the school bus and the family cars
// from the regional traffic simulation, and runs the lights (windows, porch
// lamps, streetlamps) off the shared night factor. No decisions live here:
// people come from life/runtime.js and vehicles from roads/regional-traffic.js.
import * as THREE from 'three';
import { toonMaterial } from '../toon.js';
import { LAMP_LOOK } from './lamp-look.js';
import { tagObject } from './registry/render-tags.js';
import { REGIONAL } from '../roads/regional.js';
import { suburbBatch, suburbNight, suburbLamps, loadSuburbGeometry, ROLE_BASE } from './maple-hollow-assets.js';
import { SIDING, ROOF, ACCENT, PAINT, SCALE, MH, FOOT, BUS, polyDist } from './maple-hollow-plan.js';

const COLORS = {asphalt: '#86918a', verge: '#9db873', kerb: '#cbc3ad', sidewalk: '#ddd5c0', lawn: '#94b46b', lawnStripe: '#9ebd73', driveway: '#cdc4ae', crosswalk: '#efe7cf', stop: '#efe7cf', park: '#a3bf78', lot: '#9bb06e'};
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };
const col = (hex) => new THREE.Color(hex);

// ---- one vertex-coloured ground mesh for every flat surface ----
function groundBuilder() {
  const pos = [], colr = [], idx = [];
  const quad = (pts, y, hex) => { const c = col(hex), n = pos.length / 3; for (const [x, z] of pts) { pos.push(x, y, z); colr.push(c.r, c.g, c.b); } idx.push(n, n + 2, n + 1, n, n + 3, n + 2); };
  const rect = (center, yaw, w, d, y, hex) => { const cx = Math.cos(yaw), sx = Math.sin(yaw), pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [center[0] + x * cx + z * sx, center[1] - x * sx + z * cx]); quad(pts, y, hex); };
  const disc = (c, r, y, hex, inner = 0, seg = 36) => { const cc = col(hex), n0 = pos.length / 3; for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pos.push(c[0] + Math.cos(a) * r, y, c[1] + Math.sin(a) * r, c[0] + Math.cos(a) * inner, y, c[1] + Math.sin(a) * inner); colr.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b); } for (let i = 0; i < seg; i++) { const a = n0 + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } };
  // A ribbon offset from a centerline: [from, to] lateral range, split where `keep` fails.
  const ribbon = (points, from, to, y, hex, keep = () => true) => {
    const c = col(hex); let run = [];
    const flush = () => { for (let i = 1; i < run.length; i++) { const [a0, a1] = run[i - 1], [b0, b1] = run[i], n = pos.length / 3; pos.push(...a0, ...a1, ...b1, ...b0); for (let k = 0; k < 4; k++) colr.push(c.r, c.g, c.b); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); } run = []; };
    points.forEach((p, i) => {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      const mid = [p[0] + nx * (from + to) / 2, p[1] + nz * (from + to) / 2];
      if (!keep(mid)) { flush(); return; }
      run.push([[p[0] + nx * from, y, p[1] + nz * from], [p[0] + nx * to, y, p[1] + nz * to]]);
    });
    flush();
  };
  return {rect, disc, ribbon, quad, mesh() {
    // Every face points up: flip any triangle the ribbons wound clockwise. (Forcing the
    // normals alone isn't enough: DoubleSide lights back faces with the normal reversed.)
    for (let t = 0; t < idx.length; t += 3) { const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map((k) => k * 3); const cy = (pos[c + 2] - pos[a + 2]) * (pos[b] - pos[a]) - (pos[c] - pos[a]) * (pos[b + 2] - pos[a + 2]); if (cy > 0) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx); g.computeVertexNormals();
    // Normals straight up for flat toon shading.
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({vertexColors: true, color: 0xffffff, side: THREE.DoubleSide})); m.receiveShadow = true; m.name = 'Maple Hollow • streets, sidewalks and lawns'; return m;
  }};
}
// Densify a polyline so ribbons follow fillets and junction trims stay tidy.
function dense(points, step = .8) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) { const a = points[i - 1], b = points[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  return out;
}

const ROAD = 4.6;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
function matrix(pos, yaw, scale, y = 0) { const sc = Array.isArray(scale) ? scale : [scale, scale, scale]; return new THREE.Matrix4().compose(v3.set(pos[0], y, pos[1]), q.setFromAxisAngle(up, yaw), s3.set(...sc)); }

export async function buildMapleHollow(scene, town, {traffic = null} = {}) {
  const mh = town.mapleHollow, root = new THREE.Group(); root.name = 'Maple Hollow'; scene.add(root);
  if (!mh) return {root, selectables: [], update() {}, audit: () => null, moment: () => null};
  const district = town.districts.find((d) => d.id === MH).registryId || MH;
  const roads = town.roads.filter((r) => r.mapleHollow && r.centerline);
  const G = groundBuilder(), Y = {lot: .005, lawn: .012, park: .01, asphalt: .06, driveway: .072, sidewalk: .085, kerb: .1, cross: .068};
  // Streets: asphalt, kerb lines and sidewalks; sidewalks stop where another street's carriageway begins.
  const others = (r) => roads.filter((o) => o !== r).map((o) => o.centerline);
  const keepClear = (r, margin) => { const list = [...others(r), ...town.roads.filter((o) => o.kind === 'world-link' && !o.mapleHollow && o.centerline).map((o) => o.centerline)]; return (p) => list.every((c) => polyDist(p, c) > REGIONAL.width / 2 + margin); };
  for (const r of roads) {
    const c = dense(r.centerline), keep = keepClear(r, .35);
    // Residential carriageway drawn 4.6 m wide (the lanes need 4.2), then a grass strip, the kerb and the sidewalk the walk graph uses (3.35 m out).
    G.ribbon(c, -ROAD / 2, ROAD / 2, Y.asphalt, COLORS.asphalt);
    G.ribbon(c, -REGIONAL.width / 2, REGIONAL.width / 2, Y.asphalt - .006, COLORS.verge);
    for (const side of [-1, 1]) {
      G.ribbon(c, side * 2.8, side * 2.98, Y.kerb, COLORS.kerb, keep);
      G.ribbon(c, side * 2.98, side * 4.05, Y.sidewalk, COLORS.sidewalk, keep);
    }
    // Cul-de-sac bulbs at true ends; a plain apron where a street meets another road.
    for (const end of r.ends) {
      if (end.terminus && !end.touches) { G.disc(end.pos, REGIONAL.turnRadius + .28, Y.asphalt - .006, COLORS.verge); G.disc(end.pos, REGIONAL.turnRadius - .3, Y.asphalt + .002, COLORS.asphalt); G.disc(end.pos, REGIONAL.turnRadius + .28, Y.kerb, COLORS.kerb, REGIONAL.turnRadius + .1, 40); G.disc(end.pos, REGIONAL.turnRadius + 1.35, Y.sidewalk, COLORS.sidewalk, REGIONAL.turnRadius + .28, 40); }
      else G.disc(end.pos, ROAD / 2 + .6, Y.asphalt + .001, COLORS.asphalt, 0, 28);
    }
  }
  // Where Maple Hollow Drive meets the airport road and the West Works lane, extend the asphalt mouth.
  // Painted crossings: white bars across the carriageway.
  for (const cw of mh.crosswalks) {
    const d = cw.dir, n = [-d[1], d[0]];
    for (let k = -4; k <= 4; k++) G.rect([cw.point[0] + n[0] * k * .6, cw.point[1] + n[1] * k * .6], Math.atan2(d[0], d[1]), .34, 1.6, Y.cross + .004, COLORS.crosswalk);
  }
  // Lots: lawn, driveway, the park and the bus lay-by.
  for (const s of mh.surfaces) {
    if (s.kind === 'lawn') { G.rect(s.center, s.yaw, s.size[0], s.size[1], Y.lawn, COLORS.lawn); if (s.stripe) for (let k = -2; k <= 2; k += 2) G.rect([s.center[0] + Math.cos(s.yaw) * k * s.size[0] / 6, s.center[1] - Math.sin(s.yaw) * k * s.size[0] / 6], s.yaw, s.size[0] / 6, s.size[1] - .4, Y.lawn + .003, COLORS.lawnStripe); }
    if (s.kind === 'driveway') G.rect(s.center, s.yaw, s.size[0], s.size[1], Y.driveway, COLORS.driveway);
    if (s.kind === 'park') G.rect(s.center, s.yaw, s.size[0], s.size[1], Y.park, COLORS.park);
  }
  // Front walks: concrete from each door to the sidewalk, and the bus-stop pads.
  for (const lot of mh.lots) if (lot.walk) { const a = lot.door, b = lot.walk, len = Math.hypot(b[0] - a[0], b[1] - a[1]); G.rect([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], Math.atan2(b[0] - a[0], b[1] - a[1]), 1.0, len, Y.driveway + .003, COLORS.sidewalk); }
  for (const [id, p] of Object.entries(mh.stopPoints || {})) G.disc(p, 1.3, Y.sidewalk, COLORS.sidewalk); void 0;
  // The bus lay-by is paved over the turning circle's sidewalk ring, like a driveway apron (critic round 3).
  G.disc(BUS.depot, 2.4, Y.kerb + .004, COLORS.asphalt); G.rect([(BUS.depot[0] + 20) / 2 + 1, (BUS.depot[1] - 117) / 2 + .6], Math.atan2(BUS.depot[0] - 20, BUS.depot[1] + 117), 3, 5.8, Y.kerb + .002, COLORS.asphalt);
  const ground = G.mesh(); root.add(tagObject(ground, district));

  // ---- pack models ----
  const loads = [], batches = {}, palette = new Map();
  const lotOf = new Map(mh.lots.map((l) => [l.key, l]));
  const idFor = (p) => { const lot = lotOf.get(p.lot); return lot && !lot.vacant ? lot.key : district; };
  const colorFor = (model, lot, role) => {
    const base = ROLE_BASE[model]?.[role]; if (!base) return undefined;
    const car = /family|suv/.test(model), key = car ? 'paint' : role;
    const choice = lot?.palette ? {siding: SIDING, roof: ROOF, accent: ACCENT, paint: PAINT}[key][lot.palette[key]] : 'keep';
    return new THREE.Color(choice && choice !== 'keep' ? choice : base);
  };
  const byModel = new Map();
  const push = (model, item) => { if (!byModel.has(model)) byModel.set(model, []); byModel.get(model).push(item); };
  for (const lot of mh.lots) if (!lot.vacant) {
    push(lot.house, {matrix: matrix(lot.houseAt, lot.houseYaw, SCALE.house), id: lot.key, lot, lit: 0});
  }
  for (const p of mh.props) {
    const lot = lotOf.get(p.lot), y = p.model === 'vacant_lot_tile' ? -.1 : 0, scale = p.model === 'vacant_lot_tile' ? [p.scale, .3, p.scale] : p.scale;
    push(p.model, {matrix: matrix(p.pos, p.yaw, scale, y), id: idFor(p), lot, prop: p, lit: p.model === 'streetlamp' ? 1 : 0});
  }
  for (const [model, items] of byModel) {
    const castShadow = items.some((it) => it.prop?.castShadow) || /house|garage|porch|deck|tree|family|suv/.test(model);
    loads.push(suburbBatch(model, items.map((it) => ({...it,
      mhSiding: colorFor(model, it.lot, 'siding'), mhRoof: colorFor(model, it.lot, 'roof'), mhAccent: colorFor(model, it.lot, 'accent'), mhLit: it.lit,
    })), {scale: items[0].prop?.scale && !Array.isArray(items[0].prop.scale) ? items[0].prop.scale : model.includes('house') ? SCALE.house : SCALE.prop, castShadow, attributes: true}).then((b) => { batches[model] = {...b, items}; root.add(b.mesh, b.hull); }));
  }
  await Promise.all(loads);
  const regional = () => traffic;
  // ---- lights: streetlamp pools and porch glows (one instanced decal) ----
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const gc = glowCanvas.getContext('2d'), gr = gc.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,140,.85)'); gr.addColorStop(.45, 'rgba(255,210,120,.32)'); gr.addColorStop(1, 'rgba(255,210,120,0)'); gc.fillStyle = gr; gc.fillRect(0, 0, 64, 64);
  const lamps = mh.props.filter((p) => p.model === 'streetlamp'), porches = mh.lots.filter((l) => !l.vacant);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false, opacity: 0}), lamps.length + porches.length);
  pools.name = 'Maple Hollow • lamp pools'; pools.renderOrder = 1; pools.frustumCulled = false;
  lamps.forEach((p, i) => { const off = [Math.cos(p.yaw - Math.PI / 2) * .55, -Math.sin(p.yaw - Math.PI / 2) * .55]; pools.setMatrixAt(i, matrix([p.pos[0] + off[0], p.pos[1] + off[1]], 0, [9, 1, 9], .11)); });
  porches.forEach((l, i) => pools.setMatrixAt(lamps.length + i, matrix(l.door, 0, [3.4, 1, 3.4], .11)));
  pools.userData.registryIds = [...lamps.map(() => district), ...porches.map((l) => l.key)];
  root.add(pools);
  // Puffs from grills during a BBQ; sprinkler arcs sway (instanced, one draw each).
  const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.18, 0), new THREE.MeshBasicMaterial({color: '#eceee2', transparent: true, opacity: .45, depthWrite: false}), 18);
  puffs.name = 'Maple Hollow • grill smoke'; puffs.frustumCulled = false; root.add(puffs);
  puffs.userData.registryIds = Array(puffs.instanceMatrix.count).fill(district);
  puffs.count = 0;
  for (const o of [ground]) o.userData.registryId = district;
  // Selectable homes: bounds plus a stand-in object whose hull geometry the skins can find.
  const selectables = [];
  for (const lot of mh.lots) {
    if (lot.vacant) continue;
    const building = town.buildings.find((b) => b.key === lot.key), f = FOOT[lot.house], s = SCALE.house, h = (lot.house === 'two_story_house' ? 8 : lot.house === 'split_level_house' ? 7 : 6) * s;
    const box = new THREE.Box3(new THREE.Vector3(lot.box.min[0], 0, lot.box.min[1]), new THREE.Vector3(lot.box.max[0], h, lot.box.max[1]));
    const stand = new THREE.Object3D(); const hullRef = new THREE.Object3D(); hullRef.userData.outline = true; hullRef.geometry = batches[lot.house].hull.geometry; stand.add(hullRef);
    selectables.push({type: 'building', data: building, bounds: box, object: stand});
    void f;
  }
  // ---- per-frame ----
  const lightsOff = new Map(porches.map((l) => [l.key, 23.2 + hash('off:' + l.key) * 2.4])); // 23:12 .. 01:36
  const windowsOn = new Map(porches.map((l) => [l.key, 18.3 + hash('on:' + l.key) * 1.1]));
  let lastLit = '', lastSwing = 0;
  const stats = {bus: null, cars: 0, litHomes: 0, bbq: false, kidsPlaying: 0};
  function update(t, hour, night, people = []) {
    suburbNight.value = night; suburbLamps.value = Math.max(0, Math.min(1, (night - .15) / .5));
    // Windows: each home switches on at dusk and off late (its own hour); porch lamps follow.
    const lit = porches.map((l) => { const on = windowsOn.get(l.key), off = lightsOff.get(l.key), h = hour < 12 ? hour + 24 : hour; return night > .2 && h >= on && h < off + (off < 24 ? 0 : 0) ? 1 : 0; });
    const key = lit.join('');
    if (key !== lastLit) {
      lastLit = key; stats.litHomes = lit.reduce((a, b) => a + b, 0);
      for (const [model, b] of Object.entries(batches)) {
        const attr = b.mesh.geometry.attributes.mhLit; if (!attr) continue;
        b.items.forEach((it, i) => { const lot = it.lot && porches.indexOf(it.lot); attr.array[i] = model === 'streetlamp' ? 1 : lot >= 0 ? lit[lot] : 0; });
        attr.needsUpdate = true;
      }
    }
    const lampK = suburbLamps.value; pools.material.opacity = lampK * LAMP_LOOK.suburbPool;
    pools.visible = pools.material.opacity > 0;
    for (let i = 0; i < porches.length; i++) pools.setMatrixAt(lamps.length + i, matrix(porches[i].door, 0, lit[i] ? [4.6, 1, 4.6] : [.001, 1, .001], .11));
    pools.instanceMatrix.needsUpdate = true;
    const vehicles = regional()?.vehicles.filter(v => v.mapleHollow) ?? [];
    const bus = vehicles.find(v => v.kind === 'school-bus');
    if (bus) stats.bus = {status:bus.status, position:bus.position.map(x=>+x.toFixed(1)), doorOpen:bus.doorOpen, run:bus.run};
    stats.cars = vehicles.length - Number(Boolean(bus));
    // BBQ smoke while someone tends a grill.
    let n = 0;
    for (const person of people) {
      const a = person.actor; if (!a) continue;
      const p = a.context.location.place;
      if (!p || !p.startsWith('mh-bbq:') || a.context.location.slot !== 'grill' || !a.action) continue;
      const g = a.context.location.position;
      for (let k = 0; k < 6 && n < 18; k++, n++) { const ph = (t * .35 + k / 6) % 1; puffs.setMatrixAt(n, matrix([g[0] + Math.sin(t + k) * .2 - ph * .5, g[1] + ph * .4], 0, .4 + ph * 1.4, 1.5 + ph * 2.4)); }
      stats.bbq = true;
    }
    puffs.count = n; puffs.instanceMatrix.needsUpdate = true; if (!n) stats.bbq = false;
    // Sprinklers sway in the afternoon.
    const spray = batches.sprinkler_spray;
    if (spray && t - lastSwing > .05) {
      lastSwing = t; const on = hour > 14.5 && hour < 19;
      spray.items.forEach((it, i) => { const p = it.prop; spray.set(i, matrix(p.pos, p.yaw + (on ? Math.sin(t * 1.3 + i) * .7 : 0), on ? p.scale : .001)); }); spray.commit();
    }
    stats.kidsPlaying = people.filter((p) => p.object.visible && p.actor?.context.kid && String(p.actor.context.location.place).startsWith('mh-yard:')).length;
  }
  return {root, selectables, update, batches, pools,
    audit: () => ({lots: mh.lots.length, homes: porches.length, models: Object.keys(batches).length, instances: Object.values(batches).reduce((s, b) => s + b.items.length, 0), ...stats})};
}
