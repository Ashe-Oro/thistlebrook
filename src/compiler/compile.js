import { compileMedium } from './medium.js';
import { spawnTownsfolk, lifeFailures } from '../life/schedules.js';
import { attachWorldRegistry } from '../life/registry-runtime.js';
// Seeded town compiler (v2). compileTown(spec, catalog, {seed}) -> town, fully
// deterministic for a given spec+seed. The catalog is the RESOLVED Map
// (id -> resolved entry, world units) so this stays pure JS — no three.js, no
// DOM — and runs identically in node and the browser.
//
// v2 adds: a paved plaza RING every door path joins (no dead-ends), civic
// LANDMARKS placed on the best plaza-facing slots before houses, continuous
// per-lot FENCES with a gated front, DENSITY multipliers + area auto-grow, and
// a panel-aware camera.
//
// v3 adds: door FACING (yaw blended from plaza-facing toward the camera at the
// arc ends, capped by houses.facing; recorded per building as
// facing:{cameraAngle, plazaAngle}), door paths that run straight out of the
// door onto the ring (bend <= facing.maxPathBend), a GATE instance in every
// fenced lot's front gap, and a tighter fill-based camera fit.
import { extendDistricts } from './districts.js';
import { makeRng, deriveSeed } from './rng.js';
import { math as Math } from './math.js';
import { applyDefaults, scaleCount, gateSpecError } from './spec.js';
import { validate } from './checks.js';
import {
  TAU, toWorldXZ, rotDir, obbFromRect, rectXZ, obbCorners, obbOverlap,
  obbPointDistance, segPointDistance, strutEnds, norm, pointInArea, dist,
} from './geometry.js';

// Camera lives on the +x/+z side (matches the default stage view); buildings go
// on the arc AWAY from it so their fronts face the viewer.
const VIEWER_DIR = norm([30, 34]);
const AWAY_ANGLE = Math.atan2(-VIEWER_DIR[1], -VIEWER_DIR[0]); // atan2(z, x)

// Instance kinds the camera must keep fully framed (dressing may crop).
export const CORE_KINDS = new Set(['house', 'landmark', 'well', 'ring', 'path', 'fence', 'gate', 'prop']);

// Left fraction of the frame reserved for the on-screen panel (compile page);
// the camera fit keeps the core clear of it.
const PANEL_LEFT_CUT = 0.22;
// Fraction of the available frame (right of the panel) the core should span
// on its binding axis.
const CAMERA_FILL = 0.88;
const CAMERA_ELEV_DEG = 37;
const CAMERA_ELEV_MAX_DEG = 45; // the fit may raise the camera this far to use the frame height
const CAMERA_FOV = 42;
// First guess for the camera's ground position when choosing door yaws (the
// real camera is suggested from the finished layout; compileTown re-runs the
// layout against it when the guess was off).
const CAM_HINT_DIST = 38;
// Yaws aim this far inside maxCameraAngle (the hint camera is a guess).
const CAM_MARGIN = 3 / (180 / Math.PI);

const DEG = 180 / Math.PI;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** Yaw (rotY convention: door +Z -> [sin, cos]) that points along [x, z]. */
const yawOf = (v) => Math.atan2(v[0], v[1]);

/**
 * Horizontal facing angles (degrees) of a building at `pos` with yaw `rotY`:
 * door direction vs the direction to the camera ground point / plaza centre.
 */
export function facingAngles(pos, rotY, camXZ) {
  const yaw = rotY;
  const toCam = yawOf([camXZ[0] - pos[0], camXZ[1] - pos[1]]);
  const toPlaza = yawOf([-pos[0], -pos[1]]);
  return {
    cameraAngle: +(Math.abs(wrapAngle(yaw - toCam)) * DEG).toFixed(2),
    plazaAngle: +(Math.abs(wrapAngle(yaw - toPlaza)) * DEG).toFixed(2),
  };
}

/**
 * Straight door path from a building's path snap toward the plaza ring.
 * Aims along the door direction and ends where that ray meets the circle of
 * radius `R` (just inside the ring centreline); if the ray misses, it bends
 * toward the tangent point. Returns { a, end, bend (radians), dir } or null.
 */
function doorPath(entry, pos, rotY, R) {
  const snap = entry.pathSnaps?.[0];
  if (!snap) return null;
  const a = toWorldXZ([snap.pos[0], snap.pos[2]], { x: pos[0], z: pos[1], rotY });
  const f = rotDir([snap.dir[0], snap.dir[2]], rotY);
  const ls = Math.hypot(a[0], a[1]);
  if (ls <= R + 0.5) return null;
  const b = a[0] * f[0] + a[1] * f[1];
  const disc = b * b - (ls * ls - R * R);
  if (disc >= 0 && -b - Math.sqrt(disc) > 0.5) {
    const t = -b - Math.sqrt(disc);
    return { a, end: [a[0] + f[0] * t, a[1] + f[1] * t], bend: 0, dir: f };
  }
  // Ray misses: aim at the tangent point on f's side.
  const yU = yawOf([-a[0], -a[1]]);
  const yF = yawOf(f);
  const beta = Math.asin(R / ls);
  const yG = yU + Math.sign(wrapAngle(yF - yU) || 1) * beta;
  const g = [Math.sin(yG), Math.cos(yG)];
  const t = Math.sqrt(ls * ls - R * R);
  return { a, end: [a[0] + g[0] * t, a[1] + g[1] * t], bend: Math.abs(wrapAngle(yF - yG)), dir: g };
}

// Mirrors builders.js gateLeafLength (GATE_POST 0.26, GATE_LEAF_MAX 1.0; two
// leaves when > 2.2 wide) — kept here so the compiler stays three.js-free.
function gateLeafLength(width) {
  const span = width - 0.26 - 0.06;
  return Math.min(1.0, width > 2.2 ? span / 2 - 0.08 : span - 0.08);
}
const GATE_STOCK = 0.065; // leaf stock depth behind the hinge line (rails/brace)
/** Largest `open` whose deepest leaf point stays within `depth` of the hinge line. */
function gateOpenMax(width, depth) {
  const len = gateLeafLength(width);
  let lo = 0, hi = 1;
  if (len * 1 + 0 <= depth) return 1;
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) / 2, a = m * Math.PI / 2;
    if (len * Math.sin(a) + GATE_STOCK * Math.cos(a) <= depth) lo = m; else hi = m;
  }
  return lo;
}

/** Path strip instance fields (+ its OBB) from a door path. */
function pathStrip(dp, width) {
  const dx = dp.end[0] - dp.a[0], dz = dp.end[1] - dp.a[1];
  const length = Math.hypot(dx, dz);
  const mid = [(dp.a[0] + dp.end[0]) / 2, (dp.a[1] + dp.end[1]) / 2];
  const rotY = Math.atan2(dx, dz); // strip length runs along local Z
  const obb = obbFromRect({ min: [-width / 2, -length / 2], max: [width / 2, length / 2] }, { x: mid[0], z: mid[1], rotY });
  return { mid, rotY, length, obb };
}

// --- catalog tag queries ---------------------------------------------------
export function queryCatalog(catalog, pick = {}) {
  let list = [...catalog.values()];
  if (pick.category) list = list.filter((e) => e.tags.category === pick.category);
  if (pick.style) list = list.filter((e) => (e.tags.style || []).includes(pick.style));
  if (pick.source) list = list.filter((e) => e.source === pick.source);
  return list;
}

function pickEntry(rng, list, prefer) {
  if (!list.length) return null;
  if (prefer) {
    const pref = list.filter((e) => (!prefer.source || e.source === prefer.source)
      && (!prefer.style || (e.tags.style || []).includes(prefer.style)));
    // Favour preferred entries ~70% of the time when both exist.
    if (pref.length && (pref.length === list.length || rng.chance(0.7))) return rng.pick(pref);
  }
  return rng.pick(list);
}

function plazaCenterId(spec, catalog) {
  const c = spec.plaza.center;
  if (typeof c === 'string') return catalog.has(c) ? c : queryCatalog(catalog, { category: 'well' })[0]?.id;
  return queryCatalog(catalog, c)[0]?.id;
}

/** Local-rect for an instance's XZ extent: paths/rings are parametric. */
export function rectForInst(inst, catalog) {
  if (inst.kind === 'path') return { min: [-inst.params.width / 2, -inst.params.length / 2], max: [inst.params.width / 2, inst.params.length / 2] };
  if (inst.kind === 'ring') { const o = inst.params.outer; return { min: [-o, -o], max: [o, o] }; }
  const e = catalog.get(inst.id);
  if (inst.kind === 'gate' || e?.builder === 'makeGate') return gateRect(gateParams(inst, e));
  const rect = rectXZ(e.bounds);
  if (inst.pavingWidth) { rect.min[0] *= inst.pavingWidth / 5; rect.max[0] *= inst.pavingWidth / 5; }
  return rect;
}

/** Effective makeGate params for an instance: instance fields > params > catalog. */
export function gateParams(inst, entry) {
  const p = { ...(entry?.params || {}), ...(inst.params || {}) };
  if (inst.width != null) p.width = inst.width;
  if (inst.open != null) p.open = inst.open;
  return { width: p.width ?? 2.9, open: p.open ?? 0.55, height: p.height ?? 1.22 };
}

/**
 * Conservative local XZ rect of makeGate({width, open}) (unscaled; obbFromRect
 * applies instance scale). Mirrors the builder: posts GATE_POST 0.26 with a
 * 0.36 cap at x = +-width/2; leaves of gateLeafLength(width) hinged just inside
 * the posts and swung open*90 deg toward -Z; leaf stock reaches -0.065..+0.045
 * in z before swinging. 0.05 extra slack on every side.
 */
export function gateRect({ width, open }) {
  const cap = (0.26 + 0.1) / 2, slack = 0.05, stock = GATE_STOCK;
  const a = Math.max(0, Math.min(1, open)) * Math.PI / 2;
  const len = gateLeafLength(width);
  const swing = len * Math.sin(a) + stock * Math.cos(a); // deepest leaf point behind the hinge line
  return {
    min: [-width / 2 - cap - slack, -Math.max(cap, swing) - slack],
    max: [width / 2 + cap + slack, Math.max(cap, 0.045 + stock * Math.sin(a)) + slack],
  };
}

// --- one deterministic layout attempt --------------------------------------
function buildOnce(spec, catalog, seed, attempt, grow = 1, camXZ = [VIEWER_DIR[0] * CAM_HINT_DIST, VIEWER_DIR[1] * CAM_HINT_DIST]) {
  const rng = makeRng(seed);
  const plazaR = spec.plaza.radius;
  const ringR = spec.plaza.ring.radius;
  const ringW = spec.plaza.ring.width;
  const ringInner = ringR - ringW / 2;
  const ringOuter = ringR + ringW / 2;
  // Grow the extent / outer placement bands when the layout needs more room.
  const area = spec.area.shape === 'rect'
    ? { shape: 'rect', w: spec.area.w * grow, d: spec.area.d * grow }
    : { shape: 'circle', radius: spec.area.radius * grow };
  const instances = [];

  // Plaza: a darker ground disk, the centre piece (well), and the paved ring.
  instances.push({ id: '__plaza', kind: 'plaza', pos: [0, 0], rotY: 0, scale: 1, radius: plazaR });
  const wellId = plazaCenterId(spec, catalog);
  if (wellId) instances.push({ id: wellId, kind: 'well', pos: [0, 0], rotY: 0, scale: 1 });
  const ringId = 'b-plaza-ring';
  if (catalog.has(ringId)) {
    const segments = Math.max(24, Math.round((TAU * ringR) / 0.8));
    instances.push({ id: ringId, kind: 'ring', pos: [0, 0], rotY: 0, scale: 1, params: { inner: ringInner, outer: ringOuter, segments } });
  }

  // --- buildings: landmarks (best plaza-facing slots) then houses ----------
  const landmarkList = queryCatalog(catalog, spec.landmarks.pick);
  const houseList = queryCatalog(catalog, spec.houses.pick);
  const nLand = landmarkList.length ? rng.int(...(spec.districts?.plazaLandmarks || spec.landmarks.count)) : 0;
  const [hLo, hHi] = scaleCount(spec.districts?.plazaHouses || spec.houses.count, spec.density.houses);
  const nHouse = rng.int(hLo, hHi);
  const arc = spec.houses.arc ?? 1.75;
  const total = nLand + nHouse;

  const landRing = [spec.landmarks.ring[0], spec.landmarks.ring[1] * grow];
  const houseRing = [spec.houses.ring[0], spec.houses.ring[1] * grow];

  const buildings = []; // { entry, pos, rotY, index, kind, lot, dp, strip }
  const lots = [];
  const clearR = Math.max(plazaR, ringOuter); // buildings stay >=1 off this
  const pathWidth = spec.paths.width;
  const pathR = ringR - 0.3; // door paths end just inside the ring centreline
  const fc = spec.landmarks.facing || spec.houses.facing;
  const maxCam = fc.maxCameraAngle / DEG, maxPlaza = fc.maxPlazaAngle / DEG, maxBend = (fc.maxPathBend ?? 8) / DEG;
  const step = 0.5 / DEG;

  // Door yaw for a building at `pos` on a slot `off` radians from the arc
  // centre: start facing the plaza centre, blend toward the camera for lots far
  // from the arc centre. HARD window: the turn s (from plaza-facing toward the
  // camera) must satisfy s >= camMin (door <= maxCameraAngle off the camera,
  // aiming CAM_MARGIN inside it because the final camera is only known after
  // layout), s <= maxPlazaAngle, and the straight door path must still meet the
  // ring within maxPathBend. An empty window returns null (slot rejected).
  function chooseYaw(entry, pos, off) {
    const yP = yawOf([-pos[0], -pos[1]]);
    const yC = yawOf([camXZ[0] - pos[0], camXZ[1] - pos[1]]);
    const diff = wrapAngle(yC - yP);
    const sg = Math.sign(diff) || 1, ad = Math.abs(diff);
    const w = (fc.blend ?? 0.8) * Math.min(1, Math.abs(off) / Math.max(1e-6, arc));
    const camMin = Math.max(0, ad - maxCam);
    const hiS = Math.min(maxPlaza, ad);
    if (camMin > hiS) return null;
    let s = Math.min(Math.max(ad * w, camMin + (camMin > 0 ? CAM_MARGIN : 0)), hiS);
    let dp = doorPath(entry, pos, yP + sg * s, pathR);
    while (s > camMin && (!dp || dp.bend > maxBend)) { s = Math.max(camMin, s - step); dp = doorPath(entry, pos, yP + sg * s, pathR); }
    if (!dp || dp.bend > maxBend) return null;
    return { rotY: wrapAngle(yP + sg * s), dp };
  }

  // Facing-feasible arc: on each side of the arc centre, the largest offset
  // (<= arc) where a representative house just inside the band still has a
  // legal yaw. Slots are spread over that span instead of the full arc, so arc
  // ends that can never meet the caps aren't handed out (deterministic: no rng).
  const probe = houseList[0] || landmarkList[0];
  const probeR = houseRing[0] + (houseRing[1] - houseRing[0]) * 0.3;
  const feasibleSide = (sgn) => {
    if (!probe) return arc;
    let ok = 0;
    for (let off = 0; off <= arc + 1e-9; off += 1 / DEG) {
      const th = AWAY_ANGLE + sgn * off;
      if (!chooseYaw(probe, [probeR * Math.cos(th), probeR * Math.sin(th)], sgn * off)) break;
      ok = off;
    }
    return Math.max(ok, Math.min(arc, 0.35));
  };
  const arcLo = feasibleSide(-1), arcHi = feasibleSide(1);
  // Stratified slots across [centre - arcLo, centre + arcHi]; the centre-most
  // slots (facing the viewer / plaza) go to landmarks, the rest to houses.
  const slots = buildingSlots(total, arcLo, arcHi, AWAY_ANGLE);
  const jitter = ((arcLo + arcHi) / 2 / Math.max(1, total)) * 0.9;

  const paths = [];     // path strip instances, in building order
  const pathObbs = [];  // their OBBs (for lot / fence clearance)
  const rejects = { facing: 0, lots: 0, plaza: 0, area: 0, pathLot: 0, lotPath: 0 }; // placement diagnostics

  function placeBuilding(entry, slotAngle, ring) {
    const tries = spec.retries.placement;
    for (let t = 0; t < tries; t++) {
      // Jitter around the slot (slots already span only the facing-feasible
      // arc, so pulling toward the centre would just crowd the neighbours).
      const theta = slotAngle + rng.float(-1, 1) * jitter;
      const r = rng.float(ring[0], ring[1]);
      const pos = [r * Math.cos(theta), r * Math.sin(theta)];
      const yaw = chooseYaw(entry, pos, wrapAngle(theta - AWAY_ANGLE));
      if (!yaw) { rejects.facing++; continue; } // facing window empty here: hard reject
      const { rotY, dp } = yaw;
      const place = { x: pos[0], z: pos[1], rotY };
      const lot = obbFromRect(entry.lot || entry.footprint, place);
      if (lots.some((l) => obbOverlap(lot, l, 1.0))) { rejects.lots++; continue; } // lots apart
      const fp = obbFromRect(entry.footprint, place);
      if (obbPointDistance(fp, [0, 0]) < clearR + 1.0) { rejects.plaza++; continue; } // off plaza/ring
      if (obbCorners(obbFromRect(rectXZ(entry.bounds), place)).some((c) => !pointInArea(area, c, 0.5))) { rejects.area++; continue; }
      // The door path may not cut through another lot, and this lot may not
      // sit on an earlier building's path.
      const strip = pathStrip(dp, pathWidth);
      if (lots.some((l) => obbOverlap(strip.obb, l, 0.2))) { rejects.pathLot++; continue; }
      if (pathObbs.some((o) => obbOverlap(lot, o, 0.2))) { rejects.lotPath++; continue; }
      return { entry, pos, rotY, lot, dp, strip };
    }
    return null;
  }

  function addBuilding(placed, kind) {
    placed.index = buildings.length; placed.kind = kind;
    buildings.push(placed); lots.push(placed.lot);
    const inst = { id: placed.entry.id, kind, pos: placed.pos, rotY: placed.rotY, scale: 1, lot: placed.index };
    placed.inst = inst;
    instances.push(inst);
    // One strip from the door snap to the plaza RING (ends on the centreline).
    const s = placed.strip;
    if (s.length >= 0.5) {
      const p = { id: spec.paths.id, kind: 'path', pos: s.mid, rotY: s.rotY, scale: 1, lot: placed.index, params: { length: s.length, width: pathWidth } };
      paths.push(p); pathObbs.push(s.obb);
    }
  }

  // Landmarks first on the centre slots.
  for (let i = 0; i < nLand; i++) {
    const entry = pickEntry(rng, landmarkList, spec.landmarks.prefer);
    const placed = placeBuilding(entry, slots[i], landRing);
    if (placed) addBuilding(placed, 'landmark');
  }
  // Houses fill the remaining (outer) slots.
  for (let i = nLand; i < total; i++) {
    const entry = pickEntry(rng, houseList, spec.houses.prefer);
    const placed = placeBuilding(entry, slots[i], houseRing);
    if (placed) addBuilding(placed, 'house');
  }
  if (spec.districts) {
    for (const i of [...instances, ...paths]) i.district = 'plaza';
    extendDistricts({ spec, catalog, rng, instances, buildings, lots, paths, area });
  }
  const houses = buildings.filter((b) => b.kind === 'house');
  instances.push(...paths);

  // --- fences: ONE continuous run per fenced house around back/left/right +
  //     a gated front (gap = pathWidth + 0.6 centred on the door path) --------
  const fenceEntry = catalog.get(spec.fences.id);
  // Gate ids were validated in compileTown. Without gates there are no fenced
  // lots: the fence-continuity check needs both front runs covered, and a
  // covered front with no gate would wall the door path in.
  const gateId = spec.fences.gate ? spec.fences.gate.id : null;
  if (fenceEntry && gateId) {
    const fp = fenceEntry.footprint;
    const segLen = Math.max(0.8, (fp.max[0] - fp.min[0])); // one piece's world length (local X span)
    const gate = pathWidth + 0.6;
    for (const h of houses.filter(h => h.inst.district !== 'edo')) {
      if (!rng.chance(spec.fences.probability)) continue;
      const lot = h.entry.lot; if (!lot) continue;
      const place = { x: h.pos[0], z: h.pos[1], rotY: h.rotY };
      // Where the door-path centreline crosses the front fence line (local x;
      // ~0 since the path leaves the door within maxPathBend). The gate gap
      // is centred there.
      const snapL = h.entry.pathSnaps?.[0]?.pos || [0, 0, lot.max[1]];
      const ld = rotDir(h.dp.dir, -h.rotY); // path direction in house-local coords
      const gx = snapL[0] + (ld[1] > 1e-3 ? ld[0] * (lot.max[1] - snapL[2]) / ld[1] : 0);
      // Perimeter runs in LOCAL coords, each listed START -> END. The front is
      // split around the gate and the two front runs START at the gate edge,
      // so a (uniform-scale) piece never intrudes into the gate; the last
      // piece of every run is clamped to the end (overlapping, never gapping).
      const runs = [
        ['back', [lot.min[0], lot.min[1]], [lot.max[0], lot.min[1]]],
        ['left', [lot.min[0], lot.min[1]], [lot.min[0], lot.max[1]]],
        ['right', [lot.max[0], lot.min[1]], [lot.max[0], lot.max[1]]],
        ['front', [gx - gate / 2, lot.max[1]], [lot.min[0], lot.max[1]]],
        ['front', [gx + gate / 2, lot.max[1]], [lot.max[0], lot.max[1]]],
      ];
      const segs = [];
      for (const [edge, la, lb] of runs) {
        const c1 = toWorldXZ(la, place);
        const c2 = toWorldXZ(lb, place);
        const len = dist(c1, c2);
        if (len < 0.6) continue; // sub-run shorter than a gate half: skip
        const ed = norm([c2[0] - c1[0], c2[1] - c1[1]]);
        const rotY = Math.atan2(-ed[1], ed[0]); // local X runs along the edge
        const n = Math.max(1, Math.ceil(len / segLen)); // overlap, never gap
        for (let k = 0; k < n; k++) {
          // Chain from the start; clamp the last piece to end at the run's end.
          const tc = (k === n - 1) ? Math.max(segLen / 2, len - segLen / 2) : segLen * (k + 0.5);
          segs.push({ id: spec.fences.id, kind: 'fence', pos: [c1[0] + ed[0] * tc, c1[1] + ed[1] * tc], rotY, scale: 1, lot: h.index, edge, seg: segLen });
        }
      }
      // A segment on any path (e.g. a neighbour's door path) would leave a
      // hole in the run: leave this lot unfenced instead of gapping it.
      const onPath = segs.some((s) => {
        const o = obbFromRect(fenceEntry.footprint, { x: s.pos[0], z: s.pos[1], rotY: s.rotY });
        return pathObbs.some((po) => obbOverlap(o, po, 0.05));
      });
      if (onPath || !segs.length) continue;
      instances.push(...segs);
      // The gate fills the front gap: hinge-line centre on the fence line at
      // the door-path crossing, local X along the edge (= house yaw).
      {
        const gp = toWorldXZ([gx, lot.max[1]], place);
        // Leaves swing inward: cap `open` so a leaf tip stays >= 0.15 in front
        // of the house footprint (lot front -> footprint front = the setback).
        const setback = lot.max[1] - h.entry.footprint.max[1] - 0.15;
        const openMax = setback <= GATE_STOCK ? 0 : gateOpenMax(gate, setback);
        instances.push({
          id: gateId, kind: 'gate', pos: gp, rotY: h.rotY, scale: 1, lot: h.index, edge: 'front',
          width: +gate.toFixed(3), open: +Math.min(spec.fences.gate.open, openMax).toFixed(3),
        });
      }
    }
  }

  // --- scatter: trees, bushes, then props ----------------------------------
  const scattered = []; // {pos, radius}
  const fpRadius = (entry, scale = 1) => {
    const f = entry.footprint;
    return Math.max(f.max[0] - f.min[0], f.max[1] - f.min[1]) / 2 * scale;
  };
  const boundsRadius = (entry, scale = 1) => {
    const b = entry.bounds;
    let r = 0;
    for (const x of [b.min[0], b.max[0]]) for (const z of [b.min[2], b.max[2]]) r = Math.max(r, Math.hypot(x, z));
    return r * scale;
  };
  const offPaths = (pos, rad) => paths.every((p) => {
    const [A, B] = strutEnds(p);
    return segPointDistance(A, B, pos) > pathWidth / 2 + rad + 0.4;
  });
  const insideLot = (pos, grow2 = 0) => lots.some((l) => obbPointDistance(l, pos) <= grow2);

  function sampleArea() {
    if (area.shape === 'rect') return [rng.float(-area.w / 2, area.w / 2), rng.float(-area.d / 2, area.d / 2)];
    const r = Math.sqrt(rng.next()) * area.radius;
    const a = rng.next() * TAU;
    return [r * Math.cos(a), r * Math.sin(a)];
  }

  // View corridor: the wedge between the camera and the core — keep tall trees
  // out of it so they never hide a façade.
  let vfx = 0, vfz = 0;
  for (const b of buildings) { const f = rotDir([0, 1], b.rotY); vfx += f[0]; vfz += f[1]; }
  const viewDir = (vfx || vfz) ? norm([vfx, vfz]) : VIEWER_DIR;
  const rMax = houseRing[1];
  const inViewCorridor = (pos) => {
    const along = pos[0] * viewDir[0] + pos[1] * viewDir[1];
    const lateral = Math.abs(pos[0] * viewDir[1] - pos[1] * viewDir[0]);
    return along > 0 && lateral < rMax + 2;
  };

  function scatter(cfg, kind, mult, { jitter: jit = false } = {}) {
    const list = queryCatalog(catalog, cfg.pick);
    if (!list.length) return;
    const [lo, hi] = scaleCount(cfg.count, mult);
    const n = rng.int(lo, hi);
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < spec.retries.placement; t++) {
        const entry = rng.pick(list);
        const scale = jit ? rng.float(0.9, 1.15) : 1;
        const pos = sampleArea();
        const rad = fpRadius(entry, scale);
        if (!pointInArea(area, pos, boundsRadius(entry, scale) + 0.3)) continue;
        if (Math.hypot(pos[0], pos[1]) < clearR + rad + 0.5) continue; // off plaza + ring
        if (cfg.maxRadius && Math.hypot(pos[0], pos[1]) > cfg.maxRadius) continue; // keep dressing near the town
        if (insideLot(pos, rad)) continue;
        if (kind === 'tree') {
          if (inViewCorridor(pos)) continue;
          if (Math.hypot(pos[0], pos[1]) < houseRing[0]) continue; // keep the green open
          if (!offPaths(pos, rad + 2.0)) continue;
        }
        if (!offPaths(pos, rad)) continue;
        if (scattered.some((s) => Math.hypot(s.pos[0] - pos[0], s.pos[1] - pos[1]) < s.radius + rad + 0.6)) continue;
        scattered.push({ pos, radius: rad });
        instances.push({ id: entry.id, kind, pos, rotY: rng.float(0, TAU), scale });
        break;
      }
    }
  }

  if (!spec.districts) scatter(spec.trees, 'tree', spec.density.trees, { jitter: true });
  if (!spec.districts) scatter(spec.bushes, 'bush', spec.density.bushes, { jitter: true });

  // Props: near a house (inside/edge of its lot), off footprint and paths.
  if (houses.length && !spec.districts) {
    const list = queryCatalog(catalog, spec.props.pick);
    if (list.length) {
      const [lo, hi] = scaleCount(spec.props.count, spec.density.props);
      const n = rng.int(lo, hi);
      for (let i = 0; i < n; i++) {
        for (let t = 0; t < spec.retries.placement; t++) {
          const entry = rng.pick(list);
          const h = rng.pick(houses);
          const rad = fpRadius(entry);
          const lx = rng.sign() * rng.float(1.6, Math.max(1.7, (h.entry.footprint.max[0]) + 1.2));
          const lz = rng.float(h.entry.footprint.min[1] + 0.3, h.entry.footprint.max[1] - 0.3);
          const pos = toWorldXZ([lx, lz], { x: h.pos[0], z: h.pos[1], rotY: h.rotY });
          const fpO = obbFromRect(h.entry.footprint, { x: h.pos[0], z: h.pos[1], rotY: h.rotY });
          if (!pointInArea(area, pos, rad + 0.3)) continue;
          if (obbPointDistance(fpO, pos) < rad + 0.2) continue;
          if (Math.hypot(pos[0], pos[1]) < clearR + rad) continue;
          if (!offPaths(pos, rad)) continue;
          if (scattered.some((s) => Math.hypot(s.pos[0] - pos[0], s.pos[1] - pos[1]) < s.radius + rad + 0.3)) continue;
          scattered.push({ pos, radius: rad });
          instances.push({ id: entry.id, kind: 'prop', pos, rotY: rng.float(0, TAU), scale: 1, lot: h.index });
          break;
        }
      }
    }
  }

  const camera = computeCamera(instances, buildings.filter(b => !b.inst.street), catalog);
  // Facing is recorded against the camera actually suggested for this layout.
  const camGround = [camera.pos[0], camera.pos[2]];
  for (const b of buildings.filter(b => !b.inst.street)) b.inst.facing = facingAngles(b.pos, b.rotY, camGround);
  return { name: spec.name, seed, attempt, grow: +grow.toFixed(3), area, camera, instances, camHint: camXZ.map((v) => +v.toFixed(2)),
    facingArc: [+(arcLo * DEG).toFixed(1), +(arcHi * DEG).toFixed(1)], buildingsWanted: total, placementRejects: rejects };
}

// Rank offsets before adding the absolute angle. Symmetric slots have the
// same priority; explicitly prefer the lower-angle slot on ties. Subtracting
// AWAY_ANGLE from absolute angles made ulp noise reverse their order in Chrome.
export function buildingSlots(total, arcLo, arcHi, center) {
  return Array.from({ length: total }, (_, index) => {
    const offset = -arcLo + ((index + 0.5) / total) * (arcLo + arcHi);
    return { angle: center + offset, rank: Math.round(Math.abs(offset) * 1e12), index };
  }).sort((a, b) => a.rank - b.rank || a.index - b.index).map((s) => s.angle);
}

const worstCameraAngle = (town) => town.instances.reduce((m, i) => Math.max(m, i.facing ? i.facing.cameraAngle : 0), 0);

// --- camera suggestion from the final layout -------------------------------
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
function computeCamera(instances, buildings, catalog) {
  // Mean outward direction the doors look (= where the camera should stand).
  let fx = 0, fz = 0;
  for (const b of buildings) { const f = rotDir([0, 1], b.rotY); fx += f[0]; fz += f[1]; }
  const dir = (fx || fz) ? norm([fx, fz]) : VIEWER_DIR;

  // Core sample points (ground + top) over every CORE instance.
  const vfov = CAMERA_FOV * Math.PI / 180;
  let el = CAMERA_ELEV_DEG * Math.PI / 180; // searched up to CAMERA_ELEV_MAX_DEG below
  const targetY = 2.5;
  const core = [];
  for (const inst of instances) {
    if (!CORE_KINDS.has(inst.kind) || (inst.id !== '__plaza' && !catalog.get(inst.id))) continue;
    const rect = rectForInst(inst, catalog);
    const e = catalog.get(inst.id);
    const yTop = (inst.kind === 'ring') ? 0.1 : ((e?.bounds.max[1] || 0) * (inst.scale || 1));
    for (const c of obbCorners(obbFromRect(rect, { x: inst.pos[0], z: inst.pos[1], rotY: inst.rotY }, inst.scale || 1))) {
      core.push([c[0], 0, c[1]], [c[0], yTop, c[1]]);
    }
  }
  // Target = centroid of the core XZ bounds.
  const center = [0, 0];
  if (core.length) {
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const p of core) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[2]); d = Math.max(d, p[2]); }
    center[0] = (a + b) / 2; center[1] = (c + d) / 2;
  }

  // Fit against an EFFECTIVE viewport: the left PANEL_LEFT_CUT of the frame is
  // reserved for the panel, so require the core to sit in screen x in
  // [PANEL_LEFT_CUT, 1] (normalised nx in [leftLim, 1]).
  const tanV = Math.tan(vfov / 2), tanH = tanV * 16 / 9;
  const leftLim = -(1 - 2 * PANEL_LEFT_CUT);
  // Project the core from a camera at slant distance D looking at `tgt`.
  // Returns normalised screen extents (nx, ny in [-1, 1] = frame edge).
  const extents = (D, tgt) => {
    const eye = [tgt[0] + dir[0] * D * Math.cos(el), targetY + D * Math.sin(el), tgt[1] + dir[1] * D * Math.cos(el)];
    const fwd = norm3([tgt[0] - eye[0], targetY - eye[1], tgt[1] - eye[2]]);
    const right = norm3([-fwd[2], 0, fwd[0]]);
    const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = false;
    for (const p of core) {
      const v = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
      const zc = v[0] * fwd[0] + v[1] * fwd[1] + v[2] * fwd[2];
      if (zc <= 0) { behind = true; break; }
      const nx = (v[0] * right[0] + v[1] * right[1] + v[2] * right[2]) / zc / tanH;
      const ny = (v[0] * up[0] + v[1] * up[1] + v[2] * up[2]) / zc / tanV;
      x0 = Math.min(x0, nx); x1 = Math.max(x1, nx); y0 = Math.min(y0, ny); y1 = Math.max(y1, ny);
    }
    return { behind, x0, x1, y0, y1, right };
  };
  // For each D, slide the target so the core is centred in the effective
  // viewport (x in [leftLim, 1], y in [-1, 1]), then bisect for the smallest
  // D at which the core spans <= CAMERA_FILL of that viewport on both axes
  // (the binding axis then fills ~CAMERA_FILL, a small margin either side).
  const wantX = (leftLim + 1) / 2;
  const groundFwd = [-dir[0], -dir[1]];
  const fitAt = (D) => {
    let tgt = [...center];
    let ex = extents(D, tgt);
    for (let k = 0; k < 6 && !ex.behind; k++) {
      const sx = ((ex.x0 + ex.x1) / 2 - wantX) * tanH * D;
      const sy = ((ex.y0 + ex.y1) / 2) * tanV * D / Math.sin(el);
      tgt = [tgt[0] + ex.right[0] * sx + groundFwd[0] * sy, tgt[1] + ex.right[2] * sx + groundFwd[1] * sy];
      ex = extents(D, tgt);
    }
    const fx = ex.behind ? Infinity : (ex.x1 - ex.x0) / (1 - leftLim);
    const fy = ex.behind ? Infinity : (ex.y1 - ex.y0) / 2;
    const inside = !ex.behind && ex.x0 >= leftLim && ex.x1 <= 1 && ex.y0 >= -1 && ex.y1 <= 1;
    return { tgt, fx, fy, ok: inside && Math.max(fx, fy) <= CAMERA_FILL };
  };
  const solve = () => {
    let lo = 8, hi = 220, best = fitAt(hi);
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      const r = fitAt(mid);
      if (r.ok) { hi = mid; best = r; } else lo = mid;
    }
    return { D: hi, ...best };
  };
  // A wide arc makes the fit width-limited, leaving empty ground below the
  // town. Raising the elevation (up to CAMERA_ELEV_MAX_DEG) spreads the core
  // vertically: pick the lowest elevation whose minor-axis fill is within
  // 0.01 of the best (the binding axis is CAMERA_FILL at every elevation).
  const cands = [];
  for (let deg = CAMERA_ELEV_DEG; deg <= CAMERA_ELEV_MAX_DEG + 1e-9; deg += 1) {
    el = deg * Math.PI / 180;
    cands.push({ deg, el, ...solve() });
  }
  const bestMinor = Math.max(...cands.map((c) => Math.min(c.fx, c.fy)));
  const pick = cands.find((c) => Math.min(c.fx, c.fy) >= bestMinor - 0.01);
  el = pick.el;
  const D = +pick.D.toFixed(2);
  const tgt = pick.tgt;
  center[0] = tgt[0]; center[1] = tgt[1];
  const horiz = D * Math.cos(el), vert = D * Math.sin(el);
  // A rough radius for callers that want it.
  let radius = 1;
  for (const p of core) radius = Math.max(radius, Math.hypot(p[0] - center[0], p[2] - center[1]));
  return {
    pos: [center[0] + dir[0] * horiz, targetY + vert, center[1] + dir[1] * horiz],
    target: [center[0], targetY, center[1]],
    dir, distance: D, fov: CAMERA_FOV, elevation: pick.deg, radius, center, leftCut: PANEL_LEFT_CUT, fill: CAMERA_FILL,
    fillX: +pick.fx.toFixed(3), fillY: +pick.fy.toFixed(3),
  };
}

// --- town-level retry loop -------------------------------------------------
// The facing caps are HARD. checks.js (owned separately) may grow its own
// facing check; until it does, the compiler appends 'facing-caps' so a town
// whose recorded facing breaks houses.facing is retried, not accepted.
function addFacingCheck(town, spec) {
  if (town.report.checks.some((c) => /facing/.test(c.name))) return;
  const { maxCameraAngle, maxPlazaAngle } = spec.houses.facing;
  const failures = [];
  for (const i of town.instances) {
    if (!i.facing) continue;
    if (i.facing.cameraAngle > maxCameraAngle || i.facing.plazaAngle > maxPlazaAngle) {
      failures.push({ msg: `${i.id} faces ${i.facing.cameraAngle} deg off camera / ${i.facing.plazaAngle} off plaza`, a: i.pos });
    }
  }
  town.report.checks.push({ name: 'facing-caps', ok: failures.length === 0, failures, warn: false });
  town.report.ok = town.report.ok && failures.length === 0;
}

const failScore = (report) => report.checks.reduce((n, c) => n + (c.warn ? 0 : (c.failures?.length || 0)), 0);

export function compileTown(rawSpec, catalog, { seed, district, season, life = false } = {}) {
  if (rawSpec?.medium === true) return compileMedium(rawSpec, catalog, arguments[2] || {}); // WORKTREE-HOOK medium
  const spec = applyDefaults(rawSpec);
  const finish = town => {
    if (life && spec.districts) {
      spawnTownsfolk(town, catalog);
      const failures = lifeFailures(town, catalog);
      town.report.checks.push({name:"life-townsfolk",ok:!failures.length,failures,warn:false});
      town.report.stats.instances = town.instances.length;
      town.ok = town.report.ok = town.report.ok && !failures.length;
    }
    if ((life && spec.districts) || arguments[2]?.registry === true) attachWorldRegistry(town, catalog); // WORKTREE-HOOK registry
    return town;
  };
  // Variants are deliberately unavailable to the hamlet. Clone modified
  // sections: compilation must never mutate a caller's spec or catalog.
  if (spec.districts) {
    spec.district = district ?? spec.district;
    spec.season = season ?? spec.season;
    if (spec.district === 'edo') {
      spec.area = { ...spec.area, radius: Math.max(150, spec.area.radius || 0) };
    }
  }
  const gateErr = gateSpecError(spec, catalog);
  if (gateErr) throw new Error(`spec: ${gateErr}`);
  const baseSeed = (seed ?? spec.seed ?? 1) >>> 0;
  const townRetries = spec.retries.town;
  let best = null;
  let grow = 1;
  for (let attempt = 0; attempt <= townRetries; attempt++) {
    const subSeed = attempt === 0 ? baseSeed : deriveSeed(baseSeed, attempt);
    // Door yaws are chosen against a camera guess; the real camera comes from
    // the finished layout. If the recorded camera angles overshoot the cap,
    // redo the layout (same sub-seed) against that camera, keeping the best.
    const cap = spec.houses.facing.maxCameraAngle;
    let town = buildOnce(spec, catalog, subSeed, attempt, grow);
    for (let k = 0; k < 3 && worstCameraAngle(town) > cap; k++) {
      const again = buildOnce(spec, catalog, subSeed, attempt, grow, [town.camera.pos[0], town.camera.pos[2]]);
      if (worstCameraAngle(again) <= worstCameraAngle(town)) town = again;
      else break;
    }
    town.seed = baseSeed;       // the requested seed (subSeed is the attempt's)
    town.subSeed = subSeed;
    town.report = validate(town, catalog, spec);
    addFacingCheck(town, spec);
    town.ok = town.report.ok;
    if (town.ok) return finish(town);
    if (!best || failScore(town.report) < failScore(best.report)) best = town;
    // Auto-grow the extent when buildings can't all fit (house-count fail).
    const hc = town.report.checks.find((c) => c.name === 'house-count-in-range');
    if (hc && !hc.ok) grow = Math.min(1.7, grow * 1.12);
  }
  best.ok = false;
  return finish(best);
}
