// Leg-by-leg loop planning: each station is a fixed straight (platform and
// ramps); hybrid A* joins the end of one station to the start of the next,
// keeping clear of every other part of the loop.
import {samplePieces} from './dubins.mjs';
import {hybridAStar, smooth} from './astar.mjs';
import {legRules, distanceHeuristic, RULES} from './costmap.mjs';
import {PLATFORM} from './stations.mjs';

/** Station straight as a pose pair for a given travel direction (dir = +1 along d, -1 against). */
export function stationPoses(st, dir) {
  const d = dir > 0 ? st.d : [-st.d[0], -st.d[1]], th = Math.atan2(d[1], d[0]);
  const h = st.length / 2 + PLATFORM.ramp + PLATFORM.approach;
  return {start: {x: st.c[0] - d[0] * h, z: st.c[1] - d[1] * h, th}, end: {x: st.c[0] + d[0] * h, z: st.c[1] + d[1] * h, th}, d, h};
}
export function straightSamples(a, b) {
  const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(L / .5)), out = [];
  for (let i = 1; i <= n; i++) out.push({x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n, th: a.th, k: 0});
  return out;
}

/** Stamp samples into a 'used' mask (other parts of the loop keep `separation` away). */
export function stamp(grid, used, samples, r = RULES.separation) {
  const k = Math.ceil(r / grid.res);
  for (const q of samples) {
    const i0 = grid.ix(q.x), j0 = grid.iz(q.z);
    for (let dj = -k; dj <= k; dj++) for (let di = -k; di <= k; di++) {
      if ((di * di + dj * dj) * grid.res * grid.res > r * r) continue;
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= grid.w || j >= grid.h) continue;
      used[j * grid.w + i] = 1;
    }
  }
}

export function clearDisc(grid, used, p, r) {
  const k = Math.ceil(r / grid.res), i0 = grid.ix(p.x), j0 = grid.iz(p.z);
  for (let dj = -k; dj <= k; dj++) for (let di = -k; di <= k; di++) { if ((di * di + dj * dj) * grid.res * grid.res > r * r) continue; const i = i0 + di, j = j0 + dj; if (i >= 0 && j >= 0 && i < grid.w && j < grid.h) used[j * grid.w + i] = 0; }
}

export function planLeg(W, from, to, used, {maxExpand = 3e6, weight = 1.3, log = () => {}, R = RULES.Rmin, Rt = RULES.RminTight} = {}) {
  const {grid, cm} = W, rules = legRules(grid, cm, used);
  const heuristic = distanceHeuristic(grid, cm, used, to);
  if (!Number.isFinite(heuristic(from.x, from.z))) return {failed: true, reason: 'unreachable (no free corridor between the stations)'};
  const t0 = Date.now();
  const res = hybridAStar({start: from, goal: to, R, Rt, rules, heuristic, maxExpand, weight, bounds: grid});
  if (!res || res.failed) return {failed: true, reason: 'search exhausted', expanded: res?.expanded};
  const samples = smooth(res.samples, {R, rules});
  const tightest = Math.min(...samples.filter((q) => Math.abs(q.k) > 1e-9).map((q) => 1 / Math.abs(q.k)));
  const check = rules.walk(samples.slice(1), rules.initial(), true);
  log(`    leg: ${res.expanded} expansions, ${((Date.now() - t0) / 1000).toFixed(1)} s, cost ${res.cost.toFixed(0)} -> ${check?.cost.toFixed(0)}`);
  return {samples: check ? samples : res.samples, cost: check?.cost ?? res.cost, expanded: res.expanded, R: Number.isFinite(tightest) ? Math.round(Math.min(tightest, R)) : R};
}


// Surveyed alignments use horizontal straights and signed-radius arcs in metres.
function surveyedLeg(W, from, to, used, alignment) {
  const samples = [{...from, k: 0}];
  for (const [radius, length] of alignment) {
    if (radius && Math.abs(radius) < RULES.RminTight) throw Error('Surveyed railway alignment is below the minimum curve radius');
    const kind = radius === 0 ? 'S' : radius > 0 ? 'L' : 'R';
    samples.push(...samplePieces(samples.at(-1), [[kind, length]], Math.abs(radius), .5));
  }
  const end = samples.at(-1);
  if (Math.hypot(end.x - to.x, end.z - to.z) > .001 || Math.abs(Math.sin((end.th - to.th) / 2)) > 1e-5) {
    throw Error('Surveyed railway alignment does not meet the next platform');
  }
  const rules = legRules(W.grid, W.cm, used);
  const checked = rules.walk(samples.slice(1), rules.initial(), true);
  if (!checked) throw Error('Surveyed railway alignment intersects a banned corridor');
  const R = Math.min(RULES.Rmin, ...alignment.filter(([radius]) => radius).map(([radius]) => Math.abs(radius)));
  return {samples, R, cost: checked.cost};
}

/** Join the station approaches in order, reserving the track already placed. */
export function connectStations(W, stations, log = console.log, alignments = []) {
  const {grid} = W;
  const poses = stations.map((station) => stationPoses(station, station.dir));
  const stationSamples = poses.map(({start, end}) => [start, ...straightSamples(start, end)]);
  const legs = [];
  for (const [i, from] of poses.entries()) {
    const j = (i + 1) % poses.length;
    const to = poses[j], used = new Uint8Array(grid.n);
    for (const samples of stationSamples) stamp(grid, used, samples);
    for (const leg of legs) stamp(grid, used, leg.samples);
    for (const p of [from.end, to.start]) clearDisc(grid, used, p, RULES.separation + 1);
    const closing = j === 0;
    log(`  ${stations[i].id} → ${stations[j].id}`);
    const leg = alignments[i] ? surveyedLeg(W, from.end, to.start, used, alignments[i]) : planLeg(W, from.end, to.start, used, {
      maxExpand: closing ? 65_000 : 18_000, weight: closing ? 1.8 : 1.9, log,
    });
    if (leg.failed) throw Error(`Could not connect ${stations[i].id} to ${stations[j].id}: ${leg.reason}`);
    legs.push(leg);
  }
  return {poses, legs};
}
