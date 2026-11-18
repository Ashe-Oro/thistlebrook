// OWNER: grok-roads lane. Automated road audit over all districts (seed 831).
// Usage: node tools/audit-roads.mjs [--root <tree>] [--label after] [--json out.json] [--shots]
// Findings: overlapping/duplicate ribbons, dead ends and stubs, stepped or
// misaligned joins, roads over buildings/venues/water/paths, terrain (hill)
// clipping, disconnected districts or walk network, and parked cars or props
// on a drive lane. Each finding carries coordinates; --shots writes a plan-view
// crop per finding to shots/grok-roads/audit/<label>-<id>.png.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ROAD_RULE} from '../src/compiler/town-rules.js';
import {auditPedestrianRules, auditTownLayout, auditFairLot} from './audit-town-rules.mjs';
import {existsSync} from 'node:fs';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = new URL('..', import.meta.url).pathname;
/** Audit seed 831. Mutation hooks let tests inject faults before checking. */
export async function runAudit({root = here, label = 'after', mutate = null, mutateGraph = null} = {}) {
root = root.replace(/\/$/, '') + '/';
const imp = (p) => import(pathToFileURL(root + p).href), mine = (p) => import(pathToFileURL(here + p).href);
const {resolveAll} = await imp('src/catalog/resolve-all.js');
const {compileWorld} = await imp('src/compiler/world-plan.js');
const {riverZ} = await imp('src/compiler/astra.js');
const sim = await imp('src/astra/traffic-simulation.js');
const {roadSurfaces, surfaceIndex, buildPedestrianGraph, walkBetween, segDistance} = await mine('src/roads/pedestrian.js');
const {insideLandscape} = await imp('src/compiler/landscape.js');
const catalog = resolveAll(JSON.parse(readFileSync(root + 'src/catalog/bounds.json')));
const town = compileWorld(catalog, 831);
if (mutate) mutate(town);
const surfaces = roadSurfaces(town), index = surfaceIndex(surfaces), graph = buildPedestrianGraph(town);
mutateGraph?.(graph);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r1 = (p) => p.map((v) => +v.toFixed(1));
// Regional pieces remember their chain so consecutive samples are "connected".
const chainOf = new Map(); town.roads.forEach((r) => { if (r.centerline) for (let i = 1; i < r.centerline.length; i++) chainOf.set(`${r.centerline[i - 1]}|${r.centerline[i]}`, r); });
surfaces.forEach((s) => { s.chain = chainOf.get(`${s.a}|${s.b}`) || null; });
const findings = [];
const add = (category, at, detail, status = 'open', reason = '') => {
  const near = findings.find((f) => f.category === category && dist(f.at, at) < 10 && f.status === status);
  if (near) { near.count++; return; }
  findings.push({id: `${category}-${findings.length + 1}`, category, at: r1(at), detail, status, reason, count: 1, ...(ROAD_RULE[category] && {rule: ROAD_RULE[category]})});
};
const district = (p) => town.districts.reduce((a, b) => (dist(b.center, p) < dist(a.center, p) ? b : a)).id;
const connectedAt = (A, B) => { const pts = []; for (const p of [A.a, A.b]) if (segDistance(p, B.a, B.b) < .1) pts.push(p); for (const p of [B.a, B.b]) if (segDistance(p, A.a, A.b) < .1) pts.push(p); return pts; };
// 1) Overlapping or duplicate ribbons.
for (const A of surfaces) {
  const L = dist(A.a, A.b), n = Math.max(1, Math.ceil(L / .5));
  for (const B of index.near(A.a, L + 6)) {
    if (B === A || (A.chain && A.chain === B.chain)) continue;
    const joins = connectedAt(A, B);
    for (let k = 0; k <= n; k++) {
      const p = [A.a[0] + (A.b[0] - A.a[0]) * k / n, A.a[1] + (A.b[1] - A.a[1]) * k / n];
      if (segDistance(p, B.a, B.b) > B.hw - .15) continue;
      if (joins.some((j) => dist(j, p) < A.hw + B.hw + .5)) continue;
      // Neighbouring regional chains meet at a shared pin (junction or stop).
      if (A.chain && B.chain && [A.chain.a, A.chain.b].some((e) => [B.chain.a, B.chain.b].some((f) => dist(e, f) < .05) && dist(e, p) < A.hw + B.hw + 2)) continue;
      // Near-coincident joins (authored 1-2 m jogs) are reported as stepped joins.
      if ([A.a, A.b].some((e) => [B.a, B.b].some((f) => dist(e, f) < 2.2)) && [A.a, A.b].some((e) => dist(e, p) < A.hw + B.hw + 2.5)) continue;
      add('overlap', p, `Carriageway ${r1(A.a)}→${r1(A.b)} runs over ${r1(B.a)}→${r1(B.b)} (${district(p)})`); break;
    }
  }
}
// 2) Dead ends and stubs, 3) stepped joins / width steps, from the road graph.
const venuesNear = (p, r) => town.venues.some((v) => v.entry && dist(v.entry, p) < r) || town.buildings.some((b) => b.node !== undefined && town.nodes[b.node] && dist(town.nodes[b.node], p) < 2);
const pathContinues = (p, hw) => town.roads.some((r) => r.kind !== 'avenue' && r.kind !== 'world-link' && !surfaces.some((s) => dist(s.a, r.a) < .01 && dist(s.b, r.b) < .01) && Math.min(dist(r.a, p), dist(r.b, p), segDistance(p, r.a, r.b)) < hw + .6 && dist(r.a, r.b) > .5);
for (const pt of graph.roadPoints) {
  const n = pt.arms.length;
  if (n === 1) {
    const arm = pt.arms[0], leg = graph.legs[arm.leg], legLen = dist(graph.roadPoints[leg.a].p, graph.roadPoints[leg.b].p);
    const end = town.roads.flatMap((r) => r.ends || []).find((e) => dist(e.pos, pt.p) < .1);
    if (end?.terminus && !end.touches) add('dead-end', pt.p, `Regional road ends (${district(pt.p)})`, 'justified', 'Terminus with a turning circle at a destination');
    else if (venuesNear(pt.p, 8)) add('dead-end', pt.p, `Road ends at a destination (${district(pt.p)})`, 'justified', 'Ends at a venue entrance');
    else if (pathContinues(pt.p, leg.hw)) add('dead-end', pt.p, `Carriageway ends where a footpath or narrow lane continues (${district(pt.p)})`, 'justified', 'Road becomes a footpath/footbridge lane');
    else if (dist(pt.p, [-43, -77]) < .5) add('dead-end', pt.p, `Civic Avenue ends at the ballpark fence (leg ${legLen.toFixed(1)} m, ${district(pt.p)})`, 'justified', 'Cul-de-sac serving the civic frontage; the Owls outfield fence is 3 m east');
    else add(legLen < 2 * leg.hw + 1 ? 'stub' : 'dead-end', pt.p, `Road ends with nothing beyond it (leg ${legLen.toFixed(1)} m, ${district(pt.p)})`);
  }
  if (n === 2) { const [a, b] = pt.arms, straight = Math.abs(Math.abs(a.angle - b.angle) - Math.PI) < .2, wa = graph.legs[a.leg].hw, wb = graph.legs[b.leg].hw;
    if (straight && Math.abs(wa - wb) > .15) { const kinds = new Set(town.roads.filter((r) => r.kind !== 'world-link' && [r.a, r.b].some((q) => dist(q, pt.p) < .05) && r.width >= 2.4).map((r) => r.kind));
      if (kinds.size > 1) add('width-step', pt.p, `Width changes ${(wa * 2).toFixed(1)}→${(wb * 2).toFixed(1)} m where ${[...kinds].join(' meets ')} (${district(pt.p)})`, 'justified', 'Street class change (avenue → lane); the join is drawn with round caps');
      else add('width-step', pt.p, `Width changes ${(wa * 2).toFixed(1)}→${(wb * 2).toFixed(1)} m at a straight join (${district(pt.p)})`); } }
}
// A jog is two collinear-ish ends a metre or two apart joined by a short cross piece.
// Authored downtown chicanes that traffic loops, the delivery route and district
// bounds are keyed to are listed as justified (drawn with round junction caps).
const CHICANES = [[[-36, -16], [-36, -15], 'Downtown east chicane: the town and west bus loops are keyed to it'], [[-80, -33], [-78, -33], 'Civic Avenue → Station Road jog: the civic delivery route and downtown district bounds are keyed to x = -78']];
const pieceBetween = (e, f) => surfaces.some((u) => (dist(u.a, e) < .05 && dist(u.b, f) < .05) || (dist(u.a, f) < .05 && dist(u.b, e) < .05));
const collinearPiece = (e, f) => surfaces.some((u) => (dist(u.a, e) < .05 || dist(u.b, e) < .05) && (dist(u.a, f) < .05 || dist(u.b, f) < .05) && surfaces.some((v) => v !== u && [v.a, v.b].some((q) => dist(q, e) < .05 || dist(q, f) < .05) && Math.abs(((u.b[0] - u.a[0]) * (v.b[1] - v.a[1]) - (u.b[1] - u.a[1]) * (v.b[0] - v.a[0]))) < .01 * dist(u.a, u.b) * dist(v.a, v.b)));
for (const s of surfaces) if (s.source === 'town') for (const t of surfaces) if (t !== s && t.source === 'town') for (const e of [s.a, s.b]) for (const f of [t.a, t.b]) { const d = dist(e, f); if (d > .05 && d < 2.2) {
  if (pieceBetween(e, f) && collinearPiece(e, f)) continue; // a short piece on a straight street, not a jog
  const known = CHICANES.find(([p, q]) => (dist(p, e) < .05 && dist(q, f) < .05) || (dist(p, f) < .05 && dist(q, e) < .05));
  add('stepped-join', e, `Road ends ${d.toFixed(1)} m apart at a junction (jog between ${r1(e)} and ${r1(f)}, ${district(e)})`, known ? 'justified' : 'open', known ? known[2] : ''); } }
// 4) Roads over buildings, venues, water and laid-on footpaths.
const insideBox = (p, b, pad = 0) => p[0] > b.min[0] + pad && p[0] < b.max[0] - pad && p[1] > b.min[1] + pad && p[1] < b.max[1] - pad;
for (const s of surfaces) {
  const L = dist(s.a, s.b), n = Math.max(1, Math.ceil(L / .5));
  for (let k = 0; k <= n; k++) {
    const p = [s.a[0] + (s.b[0] - s.a[0]) * k / n, s.a[1] + (s.b[1] - s.a[1]) * k / n];
    for (const b of town.buildings) if (insideBox(p, b.box, .05)) add('crosses-building', p, `Carriageway over ${b.name || b.key}`);
    for (const v of town.venues) if (v.box && insideBox(p, v.box, .05) && !(v.entry && dist(v.entry, p) < s.hw + 1.5) && !(v.access && dist(v.access, p) < s.hw + 1.5)) add('crosses-venue', p, `Carriageway over ${v.name}`);
    if (p[0] > town.riverBounds.minX && p[0] < town.riverBounds.maxX && Math.abs(p[1] - riverZ(p[0])) < 3.4 && !town.bridges.some((x) => Math.abs(x - p[0]) < 1.6)) add('crosses-water', p, 'Carriageway over the river away from a bridge');
    if (town.landscape && !insideLandscape(p)) { const bridge = s.chain?.bridges?.some(([a, b]) => { const c = s.chain.centerline; for (let i = Math.max(1, a); i <= b; i++) if (segDistance(p, c[i - 1], c[i]) < .05) return true; return false; });
      add('crosses-water', p, 'Carriageway off the mainland (sea/inlet)', bridge ? 'justified' : 'open', bridge ? 'Highway 4 inlet bridge: deck, piers and parapets are drawn for this span' : ''); }
    for (const h of town.landscape?.hills || []) if (dist(h.pos, p) < h.radius * .85) add('terrain-clip', p, `Carriageway clips ${h.mountain ? 'a mountain' : 'a hill'} (radius ${h.radius.toFixed(1)})`);
  }
}
for (const r of town.roads) {
  if (r.kind === 'avenue' || r.kind === 'world-link' || surfaces.some((s) => dist(s.a, r.a) < .01 && dist(s.b, r.b) < .01)) continue;
  if (!r.owner && r.kind !== 'pedestrian' && r.width >= 2.4) continue; // a town carriageway (clipped to z <= 4 for traffic)
  const L = dist(r.a, r.b), n = Math.max(1, Math.ceil(L / .25)); let run = 0, best = 0, at = null;
  for (let k = 0; k <= n; k++) { const p = [r.a[0] + (r.b[0] - r.a[0]) * k / n, r.a[1] + (r.b[1] - r.a[1]) * k / n]; if (index.depth(p) > .1) { run += L / n; if (run > best) { best = run; at = p; } } else run = 0; }
  if (best > 3.2) { const axis = [r.a, r.b].map((q) => surfaces.find((s) => segDistance(q, s.a, s.b) < .1)).find(Boolean);
    if (axis && best <= axis.hw * 1.6 + .5) add('path-on-road', at, `${r.kind} connector (${r.owner || r.external || 'town'}) meets the road axis, ${best.toFixed(1)} m under asphalt`, 'justified', 'Graph join at the road axis; walkers are clipped to the kerb and the path is drawn beneath the asphalt');
    else add('path-on-road', at, `${r.kind} path (${r.owner || r.external || 'town'}) runs ${best.toFixed(1)} m on asphalt`); }
}
// 6) Town design rules and disconnected districts / walk network.
auditPedestrianRules(graph, add);
if (existsSync(root + 'src/astra/fair-lot-plan.js')) auditFairLot(await imp('src/astra/fair-lot-plan.js'), add);
{
  const seen = new Set([0]), q = [0]; for (let i = 0; i < q.length; i++) for (const n of town.edges[q[i]] || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
  auditTownLayout(town, catalog, seen, add);
  if (seen.size !== town.nodes.length) add('disconnected', town.nodes.find((_, i) => !seen.has(i)), `${town.nodes.length - seen.size} road-graph nodes unreachable`);
  const comp = new Int32Array(graph.nodes.length).fill(-1); let c = 0; const sizes = [];
  for (let i = 0; i < graph.nodes.length; i++) { if (comp[i] >= 0 || !graph.edges[i].length) continue; const qq = [i]; comp[i] = c; for (let k = 0; k < qq.length; k++) for (const e of graph.edges[qq[k]]) if (comp[e.to] < 0) { comp[e.to] = c; qq.push(e.to); } sizes.push([qq.length, graph.nodes[i].pos]); c++; }
  sizes.sort((a, b) => b[0] - a[0]); for (const [size, pos] of sizes.slice(1)) add('disconnected-sidewalk', pos, `Walk network island of ${size} nodes`);
  const origin = town.venues[0].entry;
  for (const d of town.districts) { const v = town.venues.find((v) => v.district === d.id && v.entry) || {entry: d.center}; const w = walkBetween(graph, origin, v.entry); if (dist(w.at(-1).pos, v.entry) > 12) add('disconnected-sidewalk', d.center, `District ${d.name} not reachable on foot`); }
}
// 7) Parked cars and props on a drive lane.
const bays = sim.PARKING_BAYS ? sim.PARKING_BAYS.map((b) => ({c: b.center, id: b.id})) : [[-73, -16], [-69, -16], [-31, -33]].map(([x, z], i) => ({c: [x, z + .82], id: 'legacy-' + i}));
for (const b of bays) if (index.depth(b.c) > -.5) add('parked-on-lane', b.c, `Parked car ${b.id} sits on the carriageway`);
{ const {footprint, pointInFootprint} = await mine('src/roads/collisions.js');
  const fps = sim.PARKING_BAYS ? sim.PARKING_BAYS.map((b) => ({id: b.id, c: b.center, f: footprint(b)})) : [];
  for (const b of fps) for (let u = 0; u < graph.nodes.length; u++) { const hit = graph.edges[u].some((e) => { if (e.crossing) return false; const A = graph.nodes[u].pos, B = graph.nodes[e.to].pos, n = Math.max(1, Math.ceil(dist(A, B) / .2)); for (let k = 0; k <= n; k++) if (pointInFootprint([A[0] + (B[0] - A[0]) * k / n, A[1] + (B[1] - A[1]) * k / n], b.f, .45)) return true; return false; });
    if (hit) { add('parked-on-path', b.c, `Parked car ${b.id} blocks a sidewalk or footpath`); break; } } }
for (const s of [...sim.TRAFFIC_STOPS, ...sim.WEST_STOPS]) { const hw = Math.max(1.5, ...surfaces.filter((r) => segDistance(s.point, r.a, r.b) < .05).map((r) => r.hw)), post = sim.PARKING_BAYS ? [s.point[0] + s.side[0] * (hw + .22), s.point[1] + s.side[1] * (hw + .22)] : [s.point[0] + s.side[0] * 1.32, s.point[1] + s.side[1] * 1.32]; if (index.depth(post) > 0) add('prop-on-lane', post, `Bus stop post ${s.name} stands on the carriageway`); }
const props = [...town.props.map((p) => ({pos: p.pos, r: .3, name: p.id || p.asset || 'prop'})), ...town.trees.map((p) => ({pos: p.pos, r: .4, name: 'tree'})), ...[...(town.modelPlacements || []), ...(town.districtFurniture || [])].map((p) => ({pos: p.pos, r: Math.min(p.size?.[0] || .6, p.size?.[2] || .6) / 2, name: p.id})), ...(town.landscape?.models || []).filter((m) => m.asset.includes('tree') || m.asset.includes('rock')).map((m) => ({pos: m.pos, r: .5 * m.scale, name: m.asset}))];
for (const p of props) if (p.pos && index.depth(p.pos) > -p.r + .05) add('prop-on-lane', p.pos, `${p.name} on or overhanging the carriageway`);
const summary = Object.fromEntries(Object.keys(ROAD_RULE).map((category) => [category, {open: 0, justified: 0}]));
for (const f of findings) {
  summary[f.category] ??= {open: 0, justified: 0};
  summary[f.category][f.status]++;
}
return {label, root, surfaces: surfaces.length, walkNodes: graph.nodes.length, crossings: graph.crossings.length, summary, findings, town, surfacesList: surfaces, props};
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
// Report.
const result = await runAudit({root: opt('--root', here), label: opt('--label', 'after')});
const {label, root, summary, findings, town, surfacesList: surfaces, props} = result, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const out = {label, root, surfaces: surfaces.length, walkNodes: result.walkNodes, crossings: result.crossings, summary, findings};
if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(out, null, 1));
if (args.includes('--shots')) {
  const {chromium} = await import('playwright-core'); const dir = here + 'shots/grok-roads/audit/'; mkdirSync(dir, {recursive: true});
  const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox']}); const page = await browser.newPage({viewport: {width: 360, height: 360}});
  for (const f of findings) {
    const S = 9, R = 20, [cx, cz] = f.at, X = (x) => ((x - cx + R) * S).toFixed(1), Z = (z) => ((z - cz + R) * S).toFixed(1);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><rect width="100%" height="100%" fill="#dfe8c8"/>`;
    for (const b of [...town.buildings, ...town.venues]) if (b.box) svg += `<rect x="${X(b.box.min[0])}" y="${Z(b.box.min[1])}" width="${(b.box.max[0] - b.box.min[0]) * S}" height="${(b.box.max[1] - b.box.min[1]) * S}" fill="#f2c48d" opacity=".7"/>`;
    for (const s of surfaces) if (dist(s.a, f.at) < 60 || dist(s.b, f.at) < 60) svg += `<line x1="${X(s.a[0])}" y1="${Z(s.a[1])}" x2="${X(s.b[0])}" y2="${Z(s.b[1])}" stroke="#6f7c78" stroke-opacity=".75" stroke-width="${s.hw * 2 * S}"/>`;
    for (const r of town.roads) if (r.kind !== 'avenue' && r.kind !== 'world-link' && (dist(r.a, f.at) < 40 || dist(r.b, f.at) < 40)) svg += `<line x1="${X(r.a[0])}" y1="${Z(r.a[1])}" x2="${X(r.b[0])}" y2="${Z(r.b[1])}" stroke="#c9a46a" stroke-width="${Math.max(2, r.width * S * .5)}"/>`;
    for (const p of props) if (dist(p.pos, f.at) < 25) svg += `<circle cx="${X(p.pos[0])}" cy="${Z(p.pos[1])}" r="${Math.max(2, p.r * S)}" fill="#3f7a4a"/>`;
    svg += `<circle cx="180" cy="180" r="34" fill="none" stroke="${f.status === 'open' ? '#d22' : '#2563eb'}" stroke-width="4"/><text x="6" y="16" font-family="sans-serif" font-size="12">${f.id} (${f.at.join(', ')}) ${f.status}</text></svg>`;
    await page.setContent(svg); f.shot = `shots/grok-roads/audit/${label}-${f.id}.png`; await page.screenshot({path: here + f.shot});
  }
  await browser.close();
  if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(out, null, 1));
}
const open = findings.filter((f) => f.status === 'open');
console.log(JSON.stringify({label, summary, open: open.length, justified: findings.length - open.length}, null, 1));
for (const f of open) console.error([f.rule, f.category, f.at.join(', '), f.detail].filter(Boolean).join(' · '));
if (open.length) process.exitCode = 1;
}
