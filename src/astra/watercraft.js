// OWNER: vehicle-variety lane. Renders the pure water-traffic plan
// (water-traffic-plan.js) in Saltwind Harbor and Coral Coast with owned pack
// boats. Hulls float on the local water surface (waterlineAt) with a gentle bob.
import * as THREE from 'three';
import { WATERCRAFT, DOCKED, RACKED, MOVING, movingPose, rackedVisible, waterlineAt, HARBOR_OFFSET, COAST_OFFSET } from './water-traffic-plan.js';
import { loadPackGeometry, toonModel } from './vehicle-models.js';

export async function hull(model) {
  const m = WATERCRAFT[model], geometry = await loadPackGeometry(m.path), g = new THREE.Group();
  // Draft: a fifth of the hull height sits below the waterline.
  const draft = Math.min(.35, (m.max[1] - m.min[1]) * m.scale * .12);
  g.add(toonModel(geometry, {scale: m.scale, offset: [0, -m.min[1] * m.scale - draft, 0]}));
  return g;
}
/** region: 'harbor' | 'coast'. Coordinates are the region's local frame. */
export async function buildWatercraft(parent, region) {
  const root = new THREE.Group(); root.name = `${region} watercraft`; parent.add(root);
  const offset = region === 'harbor' ? HARBOR_OFFSET : COAST_OFFSET;
  const boats = [];
  const add = async (rec, kind) => { const g = await hull(rec.model); g.name = `boat-${rec.id}`; root.add(g);
    // The two Shell Cove rowboats keep their registered placements (district-models.json).
    if (rec.registered) { const m = WATERCRAFT[rec.model]; g.userData.ownedAsset = m.path.replace('licensed/', '').replace('.glb', ''); g.userData.ownedPath = m.path.replace('licensed/', ''); g.position.set(rec.pos[0], 0, rec.pos[1]); g.rotation.y = rec.yaw; } boats.push({rec, kind, g, phase: rec.id.length * 1.7}); };
  await Promise.all([
    ...DOCKED.filter((b) => b.region === region).map((b) => add(b, 'docked')),
    ...RACKED.filter((b) => b.region === region).map((b) => add(b, 'racked')),
    ...MOVING.filter((b) => b.region === region).map((b) => add(b, 'moving')),
  ]);
  const place = (b, hour, t) => {
    let pos = b.rec.pos, yaw = b.rec.yaw, visible = true, y = 0, afloat = true;
    if (b.kind === 'racked') { visible = rackedVisible(b.rec, hour); y = .06; afloat = false; }
    if (b.kind === 'moving') { const p = movingPose(b.rec, hour); pos = p.pos; yaw = p.yaw; visible = p.visible && p.state !== 'rack'; }
    if (afloat) y = waterlineAt([pos[0] + offset[0], pos[1] + offset[1]]);
    b.g.visible = visible; b.g.position.set(pos[0], afloat ? y + Math.sin(t * .8 + b.phase) * .05 : y, pos[1]);
    const tilt = afloat && !b.rec.registered;
    b.g.rotation.set(tilt ? Math.sin(t * .6 + b.phase) * .02 : 0, yaw, tilt ? Math.sin(t * .7 + b.phase) * .025 : 0);
  };
  boats.forEach((b) => { if (!b.rec.registered) place(b, 10, 0); });
  return {root, boats, update(t, hour) { for (const b of boats) place(b, hour, t); },
    audit(hour) { return boats.filter((b) => b.g.visible).map((b) => ({id: b.rec.id, model: b.rec.model, kind: b.kind, position: [b.g.position.x, b.g.position.z]})); }};
}
