import { lifeFailures } from '../life/schedules.js';
import { VILLAGERS } from '../catalog/villagers.js';
import { villagerObstructions } from './villagers.js';
// Town validation — pure 2D math over a compiled town (no three.js). Returns
// { ok, checks:[{ name, ok, failures:[{msg,a,b}], warn? }], stats }. `ok` is
// true when every non-warn check passes. Rotated-OBB SAT is used throughout so
// placement is judged on the real rotated footprints, not axis-aligned boxes.
import { EDO_STREETS, EDO_CAMERA_POCKET, edoWaterCrossing, EDO_FRONTAGE_MAX, edoNorenAtDoor, edoGardenRouteSupports, edoRopeAtHall } from './edo.js';
import { occupiedHillBounds, hillLayout, hillClearanceFailures } from './hills.js';
import { applyDefaults } from './spec.js';
import { math as Math } from './math.js';
import { CORE_KINDS, rectForInst } from './compile.js';
import {
  obbFromRect, rectXZ, obbCorners, obbOverlap, obbSeparation, obbPointDistance,
  segPointDistance, strutEnds, toWorldXZ, pointInArea, norm, dist, rotDir, walkingRects,
} from './geometry.js';

const place = (inst) => ({ x: inst.pos[0], z: inst.pos[1], rotY: inst.rotY });

function footprintObb(inst, catalog) {
  const e = catalog.get(inst.id);
  return obbFromRect(e.footprint, place(inst), inst.scale || 1);
}
function boundsObb(inst, catalog) {
  return obbFromRect(rectForInst(inst, catalog), place(inst), inst.scale || 1);
}
/** World [x,z] -> local [x,z] under a placement (inverse of toWorldXZ). */
function localOf([wx, wz], pl) {
  const dx = wx - pl.x, dz = wz - pl.z, c = Math.cos(pl.rotY || 0), s = Math.sin(pl.rotY || 0);
  return [dx * c - dz * s, dx * s + dz * c];
}

export function validate(town, catalog, spec) {
  const checks = [];
  const add = (name, failures, warn = false) => checks.push({ name, ok: failures.length === 0, failures, warn });
  const inst = town.instances;
  const area = town.area;
  const plazaR = (inst.find((i) => i.kind === 'plaza')?.radius) ?? spec.plaza.radius;
  const ringR = spec.plaza.ring.radius, ringW = spec.plaza.ring.width;
  const ringInner = ringR - ringW / 2, ringOuter = ringR + ringW / 2;
  const clearR = Math.max(plazaR, ringOuter); // keep-clear radius for buildings

  const buildings = inst.filter((i) => i.kind === 'house' || i.kind === 'landmark');
  const houses = inst.filter((i) => i.kind === 'house');
  const paths = inst.filter((i) => i.kind === 'path');
  const fences = inst.filter((i) => i.kind === 'fence');
  const scatter = inst.filter((i) => ['tree', 'bush', 'prop'].includes(i.kind));
  const solids = inst.filter((i) => ['house', 'landmark', 'prop', 'tree', 'bush', 'well'].includes(i.kind));

  // Keep legacy reports byte-identical when this optional district is absent.
  if (spec.district === 'edo' || inst.some(i => i.id.startsWith('edo-villager-'))) {
    const people=inst.filter(i=>i.id.startsWith('edo-villager-')); 
    const expected=new Set(VILLAGERS.map(v=>v.id));
    const f=[];
    if(spec.district!=='edo') f.push({msg:'Villagers require Edo'});
    if(people.length!==12 || new Set(people.map(i=>i.id)).size!==12
      || people.some(i=>!expected.has(i.id)||i.district!=='edo')
      || inst.some(i=>expected.has(i.id)&&i.kind!=='villager')) f.push({msg:'Expected exactly twelve distinct Edo villagers'});
    for(const i of people) {
      if(villagerObstructions(i,inst,catalog).length)f.push({msg:`${i.id} intersects architecture`,a:i.pos});
      if(!i.motion || i.motion.street!==i.street || !Number.isFinite(i.motion.phase) || !Number.isFinite(i.motion.t0))f.push({msg:`${i.id} has no seeded motion`});
    }
    add('edo-villagers',f);
  }

  if (town.life || inst.some(i=>i.id.startsWith('townsfolk-'))) add('life-townsfolk', lifeFailures(town,catalog));

  // 1. footprint-overlap — no two solid footprints may overlap.
  {
    const f = [];
    const obbs = solids.map((i) => footprintObb(i, catalog));
    for (let a = 0; a < solids.length; a++) for (let b = a + 1; b < solids.length; b++) {
      if (obbOverlap(obbs[a], obbs[b]) && !edoWaterCrossing(solids[a], solids[b]) && !edoNorenAtDoor(solids[a],solids[b],catalog.get(solids[b].id)) && !edoNorenAtDoor(solids[b],solids[a],catalog.get(solids[a].id)) && !edoRopeAtHall(solids[a],solids[b],catalog.get(solids[b].id)) && !edoRopeAtHall(solids[b],solids[a],catalog.get(solids[a].id))) f.push({ msg: `${solids[a].id} overlaps ${solids[b].id}`, a: solids[a].pos, b: solids[b].pos });
    }
    add('footprint-overlap', f);
  }

  // 2. roof-overlap — building roof boxes (XZ) may not intersect.
  {
    const f = [];
    const rhs = buildings.map((h) => { const e = catalog.get(h.id); return e.roof ? obbFromRect(rectXZ(e.roof), place(h), h.scale || 1) : null; });
    for (let a = 0; a < buildings.length; a++) for (let b = a + 1; b < buildings.length; b++) {
      if (rhs[a] && rhs[b] && obbOverlap(rhs[a], rhs[b])) f.push({ msg: `roof ${buildings[a].id} overlaps ${buildings[b].id}`, a: buildings[a].pos, b: buildings[b].pos });
    }
    add('roof-overlap', f);
  }

  // 3. setback — lots apart (gap >= 0) and footprints >= 1 off the ring/plaza.
  {
    const f = [];
    const lots = buildings.map((h) => obbFromRect(catalog.get(h.id).lot || catalog.get(h.id).footprint, place(h), h.scale || 1));
    for (let a = 0; a < buildings.length; a++) for (let b = a + 1; b < buildings.length; b++) {
      if (obbSeparation(lots[a], lots[b]) < -0.01) f.push({ msg: `lots overlap ${buildings[a].id}/${buildings[b].id}`, a: buildings[a].pos, b: buildings[b].pos });
    }
    for (const h of buildings) {
      const d = obbPointDistance(footprintObb(h, catalog), [0, 0]) - clearR;
      if (d < 1 - 0.01) f.push({ msg: `${h.id} only ${d.toFixed(2)} from plaza/ring`, a: h.pos });
    }
    add('setback', f);
  }

  // 4. trees-off-paths — trees/bushes clear of every path centreline.
  {
    const f = [];
    for (const s of scatter.filter((i) => i.kind !== 'prop')) {
      const e = catalog.get(s.id);
      const rad = Math.max(e.footprint.max[0] - e.footprint.min[0], e.footprint.max[1] - e.footprint.min[1]) / 2 * (s.scale || 1);
      for (const p of paths) {
        const [A, B] = strutEnds(p);
        if (segPointDistance(A, B, s.pos) < p.params.width / 2 + rad - 0.01) { f.push({ msg: `${s.id} on path`, a: s.pos }); break; }
      }
    }
    add('trees-off-paths', f);
  }

  // 5. trees-outside-lots — trees/bushes never inside a building lot.
  {
    const f = [];
    const lots = buildings.map((h) => obbFromRect(catalog.get(h.id).lot || catalog.get(h.id).footprint, place(h), h.scale || 1));
    for (const s of scatter.filter((i) => i.kind !== 'prop')) {
      if (lots.some((l) => obbPointDistance(l, s.pos) <= 0)) f.push({ msg: `${s.id} inside a lot`, a: s.pos });
    }
    add('trees-outside-lots', f);
  }

  // 6. door-reachable — each building's path snap meets a path end, and that
  //    path's other end lands in the plaza RING band (ring connectivity then
  //    links every door to the plaza).
  {
    const f = [];
    const connected = new Set();
    if (spec.districts) {
      for (const p of paths) {
        const [a, b] = strutEnds(p);
        if (segPointDistance(a, b, [0, 0]) <= ringOuter + 0.4 && Math.max(dist(a, [0, 0]), dist(b, [0, 0])) >= ringInner - 0.4) connected.add(p);
      }
      let changed = true;
      while (changed) {
        changed = false;
        for (const p of paths) if (!connected.has(p) && [...connected].some(q => obbOverlap(boundsObb(p, catalog), boundsObb(q, catalog), 0.01))) { connected.add(p); changed = true; }
      }
    }
    for (const h of buildings) {
      const e = catalog.get(h.id);
      if (!e.door) continue;
      const snap = e.pathSnaps?.[0];
      if (!snap) { f.push({ msg: `${h.id} has no path snap`, a: h.pos }); continue; }
      const sp = toWorldXZ([snap.pos[0], snap.pos[2]], place(h));
      let reached = false;
      for (const p of paths.filter((p) => p.lot === h.lot)) {
        const [A, B] = strutEnds(p);
        const dA = dist(A, sp), dB = dist(B, sp);
        const plazaEnd = dA < dB ? B : A;
        const nearHouse = Math.min(dA, dB);
        const rEnd = Math.hypot(plazaEnd[0], plazaEnd[1]);
        if (nearHouse <= 0.6 && (spec.districts ? connected.has(p) : rEnd >= ringInner - 0.4 && rEnd <= ringOuter + 0.4)) { reached = true; break; }
      }
      if (!reached) f.push({ msg: `${h.id} door path does not reach the plaza ring`, a: h.pos });
    }
    if (spec.districts) for (const p of paths.filter(p => p.streetId)) {
      if (!connected.has(p)) f.push({ msg: `${p.streetId} is disconnected from the plaza`, a: p.pos });
    }
    add('door-reachable', f);
  }

  // 7. within-area — every instance's rotated bounds corners inside the area.
  {
    const f = [];
    for (const i of inst) {
      if (i.kind === 'plaza') { if (i.radius > (area.shape === 'rect' ? Math.min(area.w, area.d) / 2 : area.radius)) f.push({ msg: 'plaza exceeds area', a: [0, 0] }); continue; }
      if (!catalog.get(i.id)) continue;
      if (obbCorners(boundsObb(i, catalog)).some((c) => !pointInArea(area, c, 0))) f.push({ msg: `${i.id} pokes outside the area`, a: i.pos });
    }
    add('within-area', f);
  }

  // 8. fences-not-on-paths — fence segments clear of every path.
  {
    const f = [];
    for (const s of fences) {
      const o = footprintObb(s, catalog);
      if (paths.some((p) => obbOverlap(o, obbFromRect(rectForInst(p, catalog), place(p))))) f.push({ msg: `fence on a path`, a: s.pos });
    }
    add('fences-not-on-paths', f);
  }

  // 9/10. fence continuity + gate alignment. A fenced lot's perimeter (minus
  //       the front gate) must have no gap > 0.5, and the front gate must sit
  //       on the door path.
  {
    const contFails = [];
    const gateFails = [];
    const pathWidth = spec.paths.width;
    const gate = pathWidth + 0.6;
    const byLot = new Map();
    for (const s of fences) { if (!byLot.has(s.lot)) byLot.set(s.lot, []); byLot.get(s.lot).push(s); }
    for (const [lotIdx, segs] of byLot) {
      const h = houses.find((x) => x.lot === lotIdx);
      if (!h) continue;
      const e = catalog.get(h.id);
      const lot = e.lot || e.footprint;
      const pl = place(h);
      const seg0 = segs[0].seg || 3.0;
      // Perimeter runs (local coords). Front split around the centred gate.
      const runs = [
        ['back', [lot.min[0], lot.min[1]], [lot.max[0], lot.min[1]]],
        ['left', [lot.min[0], lot.min[1]], [lot.min[0], lot.max[1]]],
        ['right', [lot.max[0], lot.min[1]], [lot.max[0], lot.max[1]]],
        ['front', [lot.min[0], lot.max[1]], [-gate / 2, lot.max[1]]],
        ['front', [gate / 2, lot.max[1]], [lot.max[0], lot.max[1]]],
      ];
      for (const [edge, la, lb] of runs) {
        const c1 = toWorldXZ(la, pl), c2 = toWorldXZ(lb, pl);
        const L = dist(c1, c2);
        if (L < 0.6) continue; // sub-run intentionally omitted
        const dir = norm([c2[0] - c1[0], c2[1] - c1[1]]);
        // Covered intervals from segments whose centre lies near this run.
        const iv = [];
        for (const s of segs) {
          const t = (s.pos[0] - c1[0]) * dir[0] + (s.pos[1] - c1[1]) * dir[1];
          const nd = Math.abs((s.pos[0] - c1[0]) * dir[1] - (s.pos[1] - c1[1]) * dir[0]);
          if (nd > 0.6 || t < -seg0 || t > L + seg0) continue; // not on this run
          iv.push([t - seg0 / 2, t + seg0 / 2]);
        }
        const gap = maxGap(iv, L, 0.5); // ignore 0.5 tolerance at the run ends
        if (gap > 0.5) contFails.push({ msg: `${h.id} fence gap ${gap.toFixed(2)} on ${edge}`, a: h.pos });
      }
      // Gate: no front fence may cover the door-path crossing (local x ~ 0).
      const frontSegs = segs.filter((s) => Math.abs(localOf(s.pos, pl)[1] - lot.max[1]) < 0.6);
      const blocks = frontSegs.some((s) => {
        const lx = localOf(s.pos, pl)[0];
        return Math.abs(lx) - seg0 / 2 < pathWidth / 2 - 0.05; // seg overlaps the gate corridor
      });
      if (blocks) gateFails.push({ msg: `${h.id} fence blocks its front gate`, a: h.pos });
    }
    add('fence-continuity', contFails);
    add('fence-gate-aligned', gateFails);
  }

  // gate-at-door — verify explicit gates and the actual opening on the fence line.
  {
    const f = [];
    const gates = inst.filter((i) => i.kind === 'gate');
    const fenced = buildings.filter((h) => h.lot != null && fences.some((s) => s.lot === h.lot && s.edge === 'front'));
    for (const g of gates) {
      if (!fenced.some((h) => h.lot === g.lot)) f.push({ msg: `orphan gate instance ${inst.indexOf(g)} lot ${g.lot}`, a: g.pos });
    }
    for (const h of fenced) {
      const label = `instance ${inst.indexOf(h)} ${h.id} lot ${h.lot}`;
      const gs = gates.filter((g) => g.lot === h.lot);
      if (gs.length !== 1 || gs[0]?.edge !== 'front') {
        f.push({ msg: `${label} needs exactly one front gate (found ${gs.length})`, a: h.pos });
        continue;
      }
      const g = gs[0], pl = place(h);
      const e = catalog.get(h.id), lot = e.lot || e.footprint;
      const frontZ = lot.max[1] * (h.scale || 1);
      const [gx, gz] = localOf(g.pos, pl);
      if (!(Math.abs(gz - frontZ) <= 0.35)) f.push({ msg: `${label} gate off front fence line`, a: g.pos });
      const lotPaths = paths.filter((p) => p.lot === h.lot);
      const p = lotPaths[0];
      if (lotPaths.length !== 1) f.push({ msg: `${label} needs one door path (found ${lotPaths.length})`, a: g.pos });
      if (p) {
        const d = rotDir([0, 1], p.rotY);
        const lateral = Math.abs((g.pos[0] - p.pos[0]) * d[1] - (g.pos[1] - p.pos[1]) * d[0]);
        if (!(lateral <= 0.25)) f.push({ msg: `${label} gate ${lateral.toFixed(2)} off door path centreline`, a: g.pos });
        const width = (p.params?.width ?? p.width ?? spec.paths.width) * (p.scale || 1);
        if (!(g.width * (g.scale || 1) >= width)) f.push({ msg: `${label} gate narrower than door path (${g.width} < ${width})`, a: g.pos });
      }
      // A zero-depth OBB tests the opening interval on the exact front line.
      // Use fence footprints, including rotation and scale; touching endpoints
      // are allowed, but any positive intersection closes part of the gap.
      if (Number.isFinite(g.width) && g.width > 0) {
        const half = g.width * (g.scale || 1) / 2;
        const opening = obbFromRect({ min: [gx - half, frontZ], max: [gx + half, frontZ] }, pl);
        if (fences.some((s) => obbOverlap(opening, footprintObb(s, catalog), -1e-6))) {
          f.push({ msg: `${label} gate opening overlaps a fence segment`, a: g.pos });
        }
      } else f.push({ msg: `${label} gate has invalid width`, a: g.pos });
    }
    add('gate-at-door', f);
  }

  // house-facing — derive direction independently of the recorded diagnostics.
  {
    const f = [];
    const limits = applyDefaults(spec).houses.facing;
    const angle = (a, b) => Math.atan2(Math.abs(a[0] * b[1] - a[1] * b[0]), a[0] * b[0] + a[1] * b[1]) * 180 / Math.PI;
    for (const h of buildings.filter(h => (!spec.districts || !h.street) && catalog.get(h.id).door)) {
      const e = catalog.get(h.id);
      const localDir = e.door?.facing ?? e.pathSnaps?.[0]?.dir;
      const label = `instance ${inst.indexOf(h)} ${h.id}`;
      if (!localDir || !town.camera?.pos || !Number.isFinite(h.rotY)) {
        f.push({ msg: `${label} cannot compute facing: missing door direction, rotation or camera (cameraAngle=NaN plazaAngle=NaN)`, a: h.pos });
        continue;
      }
      const dir = rotDir([localDir[0], localDir[2]], h.rotY);
      const cameraAngle = angle(dir, [town.camera.pos[0] - h.pos[0], town.camera.pos[2] - h.pos[1]]);
      const plazaAngle = angle(dir, [-h.pos[0], -h.pos[1]]);
      const angles = `cameraAngle=${cameraAngle.toFixed(2)} plazaAngle=${plazaAngle.toFixed(2)}`;
      if (!(cameraAngle <= limits.maxCameraAngle && plazaAngle <= limits.maxPlazaAngle)) {
        f.push({ msg: `${label} ${angles} exceeds limits ${limits.maxCameraAngle}/${limits.maxPlazaAngle}`, a: h.pos });
      }
      if (h.facing && ['cameraAngle', 'plazaAngle'].some((key) => !Number.isFinite(h.facing[key]) || Math.abs(h.facing[key] - ({ cameraAngle, plazaAngle })[key]) > 2)) {
        f.push({ msg: `${label} facing data drift: ${angles}, recorded ${h.facing.cameraAngle}/${h.facing.plazaAngle}`, a: h.pos });
      }
    }
    add('house-facing', f);
  }

  if (spec.districts) {
    const facing = [], blocked = [], network = [];
    for (const h of buildings.filter(h => h.street)) {
      const street = paths.find(p => p.streetId === h.street);
      const e = catalog.get(h.id), lp = paths.find(p => p.lot === h.lot);
      if (!street || !e.door || !lp) { facing.push({ msg: `${h.id} has no assigned street / door path`, a: h.pos }); continue; }
      const [a, b] = strutEnds(lp), snap = toWorldXZ([e.pathSnaps[0].pos[0], e.pathSnaps[0].pos[2]], place(h));
      const end = dist(a, snap) < dist(b, snap) ? b : a;
      const [u, v] = strutEnds(street);
      const dir = rotDir([e.door.facing[0], e.door.facing[2]], h.rotY), delta = [end[0] - snap[0], end[1] - snap[1]];
      const angle = Math.atan2(Math.abs(dir[0] * delta[1] - dir[1] * delta[0]), dir[0] * delta[0] + dir[1] * delta[1]) * 180 / Math.PI;
      if (angle > 20 || segPointDistance(u, v, end) > 0.3) facing.push({ msg: `${h.id} door faces ${angle.toFixed(1)} degrees off assigned street`, a: h.pos });
    }
    for (const p of paths) for (const h of buildings) {
      if (p.lot === h.lot) continue;
      const e = catalog.get(h.id), lot = obbFromRect(e.lot || e.footprint, place(h));
      if (obbOverlap(boundsObb(p, catalog), lot)) blocked.push({ msg: `${p.streetId || 'door path'} crosses ${h.id} lot`, a: p.pos, b: h.pos });
    }
    for (const district of ['residential', 'market', 'farm']) if (!paths.some(p => p.streetId && p.district === district)) network.push({ msg: `missing ${district} street`, a: [0, 0] });
    add('street-facing', facing);
    add('paths-clear-lots', blocked);
    add('district-streets', network);
    const corridor = [], animals = [], facades = [];
    for (const i of scatter.filter(i => i.district)) {
      if (buildings.some(h => edoRopeAtHall(i,h,catalog.get(h.id)))) continue;
      if (paths.some(p => !edoGardenRouteSupports(i,p) && walkingRects(catalog.get(i.id)).some(r => obbOverlap(obbFromRect(r, place(i), i.scale || 1), boundsObb(p, catalog))))) {
        corridor.push({ msg: `${i.id} obstructs a path corridor`, a: i.pos });
      }
      const e = catalog.get(i.id);
      if (e.tags.style.includes('livestock') &&
        (i.district !== 'farm' || i.pos[0] < 64 || i.pos[0] > 93 || i.pos[1] < -44 || i.pos[1] > 33)) {
        animals.push({ msg: `${i.id} outside farmyard / pasture`, a: i.pos });
      }
      if (e.tags.style.includes('wildlife') &&
        (i.district !== 'woodland' || i.pos[0] < -92 || i.pos[0] > -76 || i.pos[1] < -52 || i.pos[1] > 16)) {
        animals.push({ msg: `${i.id} outside woodland edge`, a: i.pos });
      }
      if (i.facadeLot != null) {
        const h = buildings.find(h => h.lot === i.facadeLot);
        const p = h && localOf(i.pos, place(h));
        const front = h && catalog.get(h.id).bounds.max[2];
        if (edoNorenAtDoor(i, h || {}, h && catalog.get(h.id))) continue;
        if (!h || Math.abs(p[0]) > 3.2 || p[1] < front || p[1] > front + 1.1) {
          facades.push({ msg: `${i.id} detached from its facade`, a: i.pos });
        }
      }
    }
    add('props-off-paths', corridor);
    add('animal-zones', animals);
    add('facade-placement', facades);
    const landmarks = inst.filter(i => i.kind === 'landmark' && i.district !== 'edo').length;
    add('landmark-count-in-range', landmarks >= spec.landmarks.count[0] && landmarks <= spec.landmarks.count[1] ? [] : [{ msg: `landmark count ${landmarks} outside range`, a: [0, 0] }]);
  }

  // 11. house-count-in-range (density-scaled range).
  {
    const [lo, hi] = scaledRange(spec.houses.count, spec.density.houses);
    const coreHouses = houses.filter(i => i.district !== 'edo');
    const f = (coreHouses.length >= lo && coreHouses.length <= hi) ? [] : [{ msg: `house count ${coreHouses.length} outside [${lo},${hi}]`, a: [0, 0] }];
    add('house-count-in-range', f);
  }


  if (spec.districts && spec.district === 'edo') {
    const network = [], features = [], pocket = [], surfaces = [];
    const occupied = occupiedHillBounds(town,catalog);
    const extent = area.shape === 'circle' ? area.radius : Math.hypot(area.w,area.d)/2;
    add('edo-hill-clearance', hillClearanceFailures(hillLayout(Math.max(70,extent+15)/70,occupied),occupied,10,0)
      .map(f => ({ msg:`hill ${f.index+1} fails ten-metre ground-circle clearance`, a:f.box.c })));
    const edoRoads = paths.filter(p => p.district === 'edo' && p.streetId);
    for (const [name, a, b, width] of EDO_STREETS) {
      const p = edoRoads.find(p => p.streetId === name);
      if (!p || dist(strutEnds(p)[0], a) > 0.05 || dist(strutEnds(p)[1], b) > 0.05 || Math.abs(p.params.width - width) > 0.01)
        network.push({ msg: `missing / altered Edo road ${name}`, a });
    }
    const connected = new Set(paths.filter(p => p.streetId === 'west-lane' || p.streetId === 'orchard-street'));
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of paths) if (!connected.has(p) && [...connected].some(q => obbOverlap(boundsObb(p, catalog), boundsObb(q, catalog), 0.01))) { connected.add(p); changed = true; }
    }
    for (const p of edoRoads) if (!connected.has(p)) network.push({ msg: `${p.streetId} detached from village`, a: p.pos });
    for (const p of paths.filter(p => p.streetId === 'west-extension' || p.streetId?.startsWith('north-street-'))) network.push({ msg: 'Cozy expansion intrudes into Edo', a: p.pos });
    const required = ['great-torii', 'shinto-shrine', 'worship-hall', 'multi-tier-pagoda', 'chozuya-pavilion', 'shoro-bell-tower', 'teahouse', 'koi-pond-tile', 'arched-bridge', 'ema-rack', 'ishigaki-wall', 'takegaki-fence'];
    for (const id of required) if (!inst.some(i => i.id === `edo-${id}` && i.district === 'edo')) features.push({ msg: `missing edo-${id}`, a: [12, -107] });
    const homes = buildings.filter(i => i.district === 'edo' && i.kind === 'house').length;
    const civic = buildings.filter(i => i.district === 'edo' && i.kind === 'landmark').length;
    if (homes !== 7 || civic !== 12) features.push({ msg: `Edo needs 7 houses and 12 landmarks, found ${homes}/${civic}`, a: [0, -100] });
    for (const id of ['edo-andon-lantern-post', 'edo-stone-lantern']) if (inst.filter(i => i.id === id).length < 6) features.push({ msg: `too few ${id}`, a: [0, -100] });
    const torii = inst.find(i => i.id === 'edo-great-torii');
    const approach = edoRoads.find(p => p.streetId === 'edo-shrine-approach');
    if (torii && approach) {
      const [a,b] = strutEnds(approach);
      const sides = walkingRects(catalog.get(torii.id)).map(r => obbFromRect(r, place(torii), torii.scale || 1));
      if (segPointDistance(a,b,torii.pos) > 0.1 || Math.abs(Math.cos(torii.rotY - approach.rotY)) < 0.99 || sides.some(o => obbOverlap(o, boundsObb(approach,catalog)))) features.push({ msg: 'great torii must straddle shrine approach with clear posts', a: torii.pos });
    }
    for (const i of inst.filter(i => i.district === 'edo' && ['cv-streetlamp', 'cv-festival-bunting', 'cv-string-lights'].includes(i.id))) features.push({ msg: 'Cozy street furniture in Edo', a: i.pos });
    for (const i of inst.filter(i => i.district === 'edo' && i.id === 'edo-paper-lantern')) features.push({ msg: 'unsupported paper lantern; use a visible full fixture', a: i.pos });
    const reserve = obbFromRect(EDO_CAMERA_POCKET, { x: 0, z: 0, rotY: 0 });
    for (const i of inst.filter(i => i.kind === 'tree' || i.kind === 'bush')) if (obbOverlap(boundsObb(i, catalog), reserve)) pocket.push({ msg: `${i.id} canopy in teahouse camera pocket`, a: i.pos });
    for (const i of inst.filter(i => i.kind === 'paving')) {
      const e = catalog.get(i.id), p = edoRoads.find(p => p.streetId === i.street);
      if (!e?.tags.style.includes('street-paving') || e.bounds.max[1] > 0.2 || !p || segPointDistance(...strutEnds(p), i.pos) > 0.1) surfaces.push({ msg: 'invalid low street paving', a: i.pos });
      for (const h of buildings) if (obbOverlap(boundsObb(i,catalog), obbFromRect(catalog.get(h.id).lot, place(h)))) surfaces.push({ msg: 'paving crosses a building lot', a: i.pos });
      if (i.street === 'edo-tea-court' && i.pavingWidth !== 2) surfaces.push({ msg:'tea-court paving must be one two-metre row', a:i.pos });
      if (i.id !== 'edo-road-stone-straight' && ![[-50,-100],[-29,-100],[12,-100],[12,-128]].some(p => dist(p,i.pos) < 0.01)) surfaces.push({ msg:'junction tile away from a real junction', a:i.pos });
    }
    for (const p of edoRoads.filter(p => ['edo-approach', 'edo-lantern-lane', 'edo-shrine-approach'].includes(p.streetId))) {
      const [a,b] = strutEnds(p), length = dist(a,b);
      const tiles = inst.filter(i => i.kind === 'paving');
      for (let d = 0; d <= length; d += 2) {
        const point = [a[0]+(b[0]-a[0])*d/length, a[1]+(b[1]-a[1])*d/length];
        if (!tiles.some(i => obbPointDistance(boundsObb(i,catalog), point) < 0.01)) surfaces.push({ msg: 'street lacks continuous paving', a: point });
      }
    }
    const bridges = inst.filter(i => i.id === 'edo-arched-bridge');
    const water = inst.filter(i => i.id === 'edo-garden-stream-tile');
    add('edo-bridge-over-water', bridges.length && bridges.every(b => water.some(w => edoWaterCrossing(b,w) && obbOverlap(footprintObb(b,catalog), footprintObb(w,catalog))))
      ? [] : [{ msg: 'bridge must cross water with abutments on opposite banks', a: bridges[0]?.pos || [-73,-83] }]);
    const frontage = [], lane = edoRoads.find(p => p.streetId === 'edo-lantern-lane');
    for (const h of buildings.filter(h => h.district === 'edo' && h.street === 'edo-lantern-lane')) {
      const door = catalog.get(h.id).door;
      const front = toWorldXZ([door.pos[0], door.pos[2]], place(h));
      const setback = lane ? segPointDistance(...strutEnds(lane), front) - lane.params.width / 2 : Infinity;
      if (setback < 0 || setback > EDO_FRONTAGE_MAX) frontage.push({ msg: `${h.id} facade ${setback.toFixed(2)}m from lane edge; maximum ${EDO_FRONTAGE_MAX}m`, a: h.pos });
    }
    const curtains = inst.filter(i => i.id === 'edo-noren-curtain');
    add('edo-noren-at-door', curtains.length ? curtains.filter(i => !buildings.some(h => edoNorenAtDoor(i,h,catalog.get(h.id))))
      .map(i => ({ msg:'noren must hang within 0.3m of its Edo door anchor', a:i.pos }))
      : [{ msg:'missing door curtains', a:[0,-100] }]);
    const pass2 = [];
    const hall = buildings.find(i => i.id === 'edo-worship-hall');
    const rope = inst.find(i => i.id === 'edo-shimenawa-rope');
    if (!hall || hall.pos[0] !== 12 || hall.rotY !== 0 || !rope || !edoRopeAtHall(rope,hall,catalog.get(hall.id))) pass2.push({msg:'hall and attached rope must frame the shrine axis',a:[12,-140]});
    const dogs = inst.filter(i => i.id === 'edo-komainu-pair');
    if (dogs.length !== 1 || dogs[0].pos[0] !== 12 || dogs[0].rotY !== 0) pass2.push({msg:'one authored guardian pair must straddle the axis',a:[12,-134.5]});
    if (!buildings.some(h => h.id === 'edo-nagaya-rowhouse' && h.pos[0] > -29 && h.pos[0] < -15 && h.pos[1] > -100)) pass2.push({msg:'missing south frontage nagaya',a:[-22,-93.7]});
    add('edo-placement-pass2',pass2);
    add('edo-shopfront-setback', frontage);
    add('edo-connected-streets', network);
    add('edo-required-features', features);
    add('edo-camera-pocket', pocket);
    add('edo-street-paving', surfaces);
  }

  // 12. framing (warn).
  {
    const f = framingFailures(town, catalog);
    add('framing', f, true);
  }

  const ok = checks.every((c) => c.warn || c.ok);
  const stats = {
    houses: houses.length, landmarks: inst.filter((i) => i.kind === 'landmark').length,
    paths: paths.length, fences: fences.length,
    trees: inst.filter((i) => i.kind === 'tree').length,
    bushes: inst.filter((i) => i.kind === 'bush').length,
    props: inst.filter((i) => i.kind === 'prop').length,
    instances: inst.length,
  };
  if (spec.districts) stats.animals = scatter.filter(i => catalog.get(i.id).tags.style.includes('animal')).length;
  return { ok, checks, stats };
}

function scaledRange([lo, hi], mult = 1) {
  const m = mult == null ? 1 : mult;
  const slo = Math.max(0, Math.round(lo * m));
  return [slo, Math.max(slo, Math.round(hi * m))];
}

/** Largest uncovered gap inside [tol, L-tol] given covered intervals. */
function maxGap(intervals, L, tol = 0) {
  if (L <= 0) return 0;
  const iv = intervals.map(([a, b]) => [Math.max(0, a), Math.min(L, b)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let cursor = tol, worst = 0;
  for (const [a, b] of iv) {
    if (a > cursor) worst = Math.max(worst, a - cursor);
    cursor = Math.max(cursor, b);
  }
  if (L - tol > cursor) worst = Math.max(worst, L - tol - cursor);
  return worst;
}

// Pure-math frustum check honouring the panel-reserved left region.
function framingFailures(town, catalog) {
  const cam = town.camera;
  if (!cam) return [];
  const eye = cam.pos, tgt = cam.target;
  const fwd = norm3([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
  const right = norm3(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const halfV = (cam.fov || 42) * Math.PI / 360;
  const halfH = Math.atan(Math.tan(halfV) * 16 / 9);
  const tanH = Math.tan(halfH), tanV = Math.tan(halfV);
  const leftLim = -(1 - 2 * (cam.leftCut ?? 0)) - 0.02;
  const f = [];
  for (const i of town.instances) {
    if (!CORE_KINDS.has(i.kind) || (i.id !== '__plaza' && !catalog.get(i.id))) continue;
    const e = catalog.get(i.id);
    const rect = rectForInst(i, catalog);
    const yTop = (i.kind === 'ring') ? 0.1 : (e?.bounds?.max?.[1] ?? 0);
    for (const c of obbCorners(obbFromRect(rect, { x: i.pos[0], z: i.pos[1], rotY: i.rotY }, i.scale || 1))) {
      for (const y of [0, yTop]) {
        const v = [c[0] - eye[0], y - eye[1], c[1] - eye[2]];
        const zc = dot3(v, fwd); if (zc <= 0) { f.push({ msg: `${i.id} behind camera`, a: i.pos }); break; }
        const nx = dot3(v, right) / zc / tanH, ny = dot3(v, up) / zc / tanV;
        if (nx < leftLim || nx > 1.02 || Math.abs(ny) > 1.02) { f.push({ msg: `${i.id} outside frame`, a: i.pos }); break; }
      }
    }
  }
  return f;
}

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
