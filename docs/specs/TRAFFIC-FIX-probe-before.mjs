import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const tree = process.argv[2] || '/workspace/cel-town-wt/traffic-fix/';
const imp = (p) => import(pathToFileURL(tree + p).href);
const {resolveAll} = await imp('src/catalog/resolve-all.js');
const {compileWorld} = await imp('src/compiler/world-plan.js');
const sim = await imp('src/astra/traffic-simulation.js');
const {createRegionalTraffic} = await imp('src/roads/regional-traffic.js');
const {footprint, footprintsOverlap} = await imp('src/roads/collisions.js');
const {pedestrianGraph} = await imp('src/roads/pedestrian.js');
const railPlan = await imp('src/astra/railway-plan.js'); const rail = await imp('src/compiler/railway.js');
const civ = await imp('src/astra/civic-quarter-life.js');
const town = compileWorld(resolveAll(JSON.parse(readFileSync(tree + 'src/catalog/bounds.json'))), 831);
const traffic = sim.createTrafficSimulation(town), regional = createRegionalTraffic(town);
const graph = pedestrianGraph(town);
const railway = railPlan.createRailwayService(town, graph);
regional.setStopLines(() => town.railway.crossings.map((c, i) => ({point: c.pos, stop: rail.RAIL.half + 2.2, closed: railway.crossings[i].closed})));
// civic scripted vehicles at their authored size (4.3 x 2)
const civic = (t, hour) => { const s = civ.civicLifeState(t, hour); const e = civ.sampleRoute(civ.FIRE_ROUTE, s.fireProgress); const dc = t % 95; const d = civ.sampleRoute(civ.DELIVERY_ROUTE, dc < 18 ? 0 : dc < 54 ? (dc - 18) / 36 : 1 - (dc - 54) / 41);
  const out = [{id: 'civic-engine', kind: 'fire', position: [e.x, e.z], direction: [Math.sin(e.heading), Math.cos(e.heading)], length: 4.3, width: 2, speed: 1}];
  if (s.deliveryActive) out.push({id: 'civic-delivery', kind: 'delivery', position: [d.x, d.z], direction: [Math.sin(d.heading), Math.cos(d.heading)], length: 4.3, width: 2, speed: 1}); return out; };
const dt = .2, hours = +(process.argv[3] || 6); let t = 0, hour = 7;
const still = new Map(), stalls = new Map(), overlaps = new Map();
for (let n = 0; n < hours * 90 / dt; n++) {
  t += dt; hour = (hour + dt / 90) % 24;
  railway.update(hour, dt);
  const civicNow = civic(t, hour);
  traffic.update(dt, civicNow.map((c) => ({x: c.position[0], z: c.position[1]})));
  regional.update(dt, hour, [], traffic.vehicles);
  const vs = [...traffic.vehicles.map((v) => ({...v, sys: 'town'})), ...regional.vehicles.filter((v) => !v.parked).map((v) => ({...v, sys: 'regional'})), ...civicNow.map((v) => ({...v, sys: 'civic'}))];
  for (const v of vs) { if (v.sys === 'civic') continue; const key = v.sys + ':' + v.id; const s = still.get(key) || {t: 0, pos: v.position};
    if (Math.hypot(v.position[0] - s.pos[0], v.position[1] - s.pos[1]) < .05 && !['At stop', 'Unloading', 'Boarding at the stop', 'Dropping off', 'Waiting at level crossing'].includes(v.status)) s.t += dt; else { s.t = 0; s.pos = [...v.position]; }
    still.set(key, s); if (s.t > 30 && !stalls.has(key)) stalls.set(key, {hour: +hour.toFixed(2), at: v.position.map((x) => +x.toFixed(1)), status: v.status, kind: v.kind, line: v.line?.id, forward: v.forward, s: v.s && +v.s.toFixed(1), end: v.line && [v.line.start, +v.line.end.toFixed(1)]}); }
  const fps = vs.map(footprint);
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) if (Math.hypot(fps[i].c[0] - fps[j].c[0], fps[i].c[1] - fps[j].c[1]) < 8 && footprintsOverlap(fps[i], fps[j])) { const k = vs[i].sys + ':' + vs[i].id + '|' + vs[j].sys + ':' + vs[j].id; if (!overlaps.has(k)) overlaps.set(k, {hour: +hour.toFixed(2), at: fps[i].c.map((x) => +x.toFixed(1)), a: vs[i].kind, b: vs[j].kind, sa: vs[i].status, sb: vs[j].status}); }
}
console.log(JSON.stringify({stalls: Object.fromEntries(stalls), overlaps: Object.fromEntries(overlaps), counts: {stalls: stalls.size, overlapPairs: overlaps.size}}, null, 1));
