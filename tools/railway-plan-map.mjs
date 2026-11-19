// Draw the railway reroute plan: a top-down map of every obstacle class, the
// old line (faint), the proposed centre line and corridor, crossings, tunnels,
// bridges, stations with their walks, a cost/clearance table, and zoomed
// insets for each crossing, tunnel, bridge, station and bug screenshot.
// Usage: node tools/railway-plan-map.mjs [plan.json] [out.png] [--validation report.json]
import {readFileSync, writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {loadWorld, worldLayers} from './railway-plan/layers.mjs';
import {MAINLAND} from '../src/compiler/landscape.js';
import {terrainSurface} from '../src/compiler/terrain.js';
import {Grid, GRID} from './railway-plan/grid.mjs';
import {sampleTrack, offset} from './railway-plan/tunnel.mjs';
import {terrainGrid} from './railway-plan/build.mjs';

const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const pos = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const planFile = pos[0] ?? new URL('./railway-plan/route.json', import.meta.url).pathname;
const out = pos[1] ?? new URL('./railway-plan.png', import.meta.url).pathname;
const validation = opt('--validation') ? JSON.parse(readFileSync(opt('--validation'), 'utf8')) : null;
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const {town, catalog} = loadWorld(plan.meta.seed);
const L = worldLayers(town, catalog);
const rendered = JSON.parse(readFileSync(new URL('./railway-plan/rendered-footprint.json', import.meta.url)));
const grid = new Grid(GRID);
const heights = terrainGrid(grid, terrainSurface(town));
const relief = [];
const contour = (height) => height > .05 ? Math.min(4, Math.floor(height / 5) + 1) : 0;
for (let j = 0; j < grid.h; j++) for (let i = 0; i < grid.w;) {
  const level = contour(heights[j * grid.w + i]);
  let end = i + 1;
  while (end < grid.w && contour(heights[j * grid.w + end]) === level) end++;
  if (level) relief.push([j, i, end - i, level]);
  i = end;
}

// Bug screenshot locations (Ashe, 18 Nov): where each camera looked on the old line.
const oldStation = (id) => town.railway?.stations.find((s) => s.id === id)?.centre;
const lantern = town.venues.find((v) => /lantern/i.test(v.name ?? '') && /room/i.test(v.name ?? '')) ?? town.registry.places.find((p) => /lantern.?s room/i.test(p.name ?? ''));
const BUGS = [
  {id: 'rail-into-mountain-no-tunnel', at: oldStation('quay') ?? [96, -43], note: 'old Lantern Quay platform runs into Pinecrest peak 1 with no portal'},
  {id: 'skatepark-crossing-mountain', at: [72.4, -91], note: 'old crossing-1: slab on the skatepark approach, track into the range'},
  {id: 'trees-through-rail', at: plan.meta.bugTrees ?? [-20, 128], note: 'old Stillwater viaduct through outskirts pines'},
  {id: 'floating-station-over-water', at: oldStation('coast') ?? [303, 83], note: 'old Coral Coast Beach platform offshore'},
  {id: 'airport-crossing', at: [67.5, -181.3], note: 'old crossing-0 on the airport landside street and parking'},
  {id: 'track-over-road-station', at: oldStation('pinecrest') ?? [184, 23], note: 'old Pinecrest Park platform over the harbor road'},
  {id: 'track-through-parking-lot', at: [240, 18], note: 'old viaduct over Funfair Parking'},
  {id: 'lantern-room-patio-on-road', at: lantern?.pos ?? lantern?.entryPoints?.[0]?.position ?? [50, -10], note: "patio sets on the road near Lantern's Room (Stage B, TOWN-24)"},
];

const track = sampleTrack(plan.centreline.map(([x, z, y]) => ({p: [x, z], y})), plan.summary.length);
const {corridorHalf, tightInside = corridorHalf} = plan.meta.footprint;
const tightEdges = track.flatMap((q, i) => {
  const next = track[(i + 1) % track.length], side = q.tightSide;
  return side && next.tightSide === side ? [[offset(q, side * corridorHalf), offset(next, side * corridorHalf),
    offset(next, side * tightInside), offset(q, side * tightInside)]] : [];
});
const data = {
  plan, tightEdges, bugs: BUGS, mainland: MAINLAND, grid: GRID, relief, validation,
  layers: Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.filter((s) => s.type !== 'outside' && s.type !== 'band')])),
  rendered: {grid: rendered.grid, solid: rendered.solid.map(([j, i, l, o, t]) => [j, i, l, t]), surface: rendered.surface.map(([j, i, l, o, t]) => [j, i, l, t]), ids: rendered.ids.map(([id]) => /^built:road-|^woods:trail|^built:bridge|^built:water-bridge/.test(id) ? 1 : 0), owner: rendered.solid.map((r) => r[3]), ownerS: rendered.surface.map((r) => r[3])},
};

function page(D) {
  const P = D.plan, W = 2900, H0 = 1960, M = {x0: -262, z0: -292, x1: 402, z1: 402};
  const COL = {sea: '#6fa3c4', land: '#cfd9b0', beach: '#ead9a6', terrain: '#9b8461', terrainHi: '#7a6446', water: '#2f7fb8', stream: '#57b4e6', road: '#5b6168', path: '#c9a66b', lot: '#8a63c8', building: '#c0473a',
    parcel: '#e8a868', prop: '#7d1f1f', tree: '#2e6b33', scatter: '#8aa36b', reserved: '#e0119d', soft: '#3d7a3a', rStructure: '#a0306f', rPaving: '#b9a3e3', old: 'rgba(0,0,0,.33)', line: '#111', corridor: 'rgba(255,214,0,.35)',
    crossing: '#e0161b', tunnel: '#6b4a1f', bridge: '#1f6fd1', station: '#ffd400', walk: '#0b8f3a', cleared: '#ff7b00'};
  const cv = document.createElement('canvas'); cv.width = W; document.body.style.margin = 0; document.body.appendChild(cv);
  // Layout: main map (left), legend + tables (right), insets grid (below).
  const hillNames = (t) => (t.mountains ?? [t.mountain]).map((m) => m.replace('landscape:', '')).join(' / ');
  const insetList = [
    ...P.crossings.map((c) => ({kind: 'crossing', title: `${c.id}: ${c.name ?? c.road} · ${c.deviation.toFixed(1)}° off square · clear ${c.clearanceToLotOrBuilding} m`, at: c.at, span: 46})),
    ...P.tunnels.map((t) => ({kind: 'tunnel', title: `${t.id} · ${hillNames(t)}`,
      sub: `${t.boreLength} m bore · ${t.minCover} m minimum crown cover · ${t.hoods.join(' + ')} m of hoods`,
      at: [(t.portals[0].pos[0] + t.portals[1].pos[0]) / 2, (t.portals[0].pos[1] + t.portals[1].pos[1]) / 2],
      span: Math.max(60, t.length + 30)})),
    ...P.bridges.map((b) => ({kind: 'bridge', title: `${b.id}: ${b.span} m over ${b.crosses}`, at: [(b.piers[0][0] + b.piers[1][0]) / 2, (b.piers[0][1] + b.piers[1][1]) / 2], span: 40})),
    ...P.stations.map((s) => ({kind: 'station', title: `${s.name}: walk ${s.walk} m${s.walkOver ? ' (OVER 60)' : ''}, platform ${s.length} m`, at: s.centre, span: 110})),
    ...D.bugs.map((b) => ({kind: 'bug', title: `bug · ${b.id}`, sub: b.note, at: b.at, span: 90})),
  ];
  const IW = 470, IH = 470, cols = Math.floor(W / (IW + 10)), rows = Math.ceil(insetList.length / cols);
  const insetTop = H0 + 94;
  cv.height = insetTop + rows * (IH + 46) + 20;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  // Rendered-footprint masks as images (structure, paving), 0.5 m cells.
  const RG = D.rendered.grid, RW = Math.round((RG.maxX - RG.minX) / RG.res), RH = Math.round((RG.maxZ - RG.minZ) / RG.res);
  const mask = (rows, owners, color) => { const c = document.createElement('canvas'); c.width = RW; c.height = RH; const x = c.getContext('2d'), img = x.createImageData(RW, RH); const [r, gg, b] = color.match(/\w\w/g).map((h) => parseInt(h, 16));
    rows.forEach(([j, i, l, t], k) => { if (D.rendered.ids[owners[k]]) return; if (t < 30 && color === COL.rStructure) return; for (let m = 0; m < l; m++) { const o = (j * RW + i + m) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 200; } }); x.putImageData(img, 0, 0); return c; };
  const imgPave = mask(D.rendered.surface, D.rendered.ownerS, COL.rPaving), imgSolid = mask(D.rendered.solid, D.rendered.owner, COL.rStructure);
  const relief = document.createElement('canvas');
  relief.width = RW; relief.height = RH;
  const reliefContext = relief.getContext('2d');
  const elevationColors = ['#bba785', '#a38b65', '#8d7755', COL.terrainHi];
  for (const [j, i, count, level] of D.relief) {
    reliefContext.fillStyle = elevationColors[level - 1];
    reliefContext.fillRect(i, j, count, 1);
  }

  function draw(view, ox, oy, w, h, detail) {
    const s = Math.min(w / (view.x1 - view.x0), h / (view.z1 - view.z0)), X = (x) => ox + (x - view.x0) * s, Z = (z) => oy + (z - view.z0) * s;
    g.save(); g.beginPath(); g.rect(ox, oy, w, h); g.clip();
    g.fillStyle = COL.sea; g.fillRect(ox, oy, w, h);
    const poly = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.closePath(); };
    const line = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); };
    poly(D.mainland); g.fillStyle = COL.beach; g.fill(); g.save(); poly(D.mainland); g.clip(); g.lineWidth = 18 * s; g.strokeStyle = COL.beach; g.stroke(); g.restore();
    // inner land (beach band stays at the edge)
    g.save(); poly(D.mainland); g.clip(); g.fillStyle = COL.land; g.beginPath(); g.rect(ox, oy, w, h); g.fill(); poly(D.mainland); g.lineWidth = 18 * s; g.strokeStyle = COL.beach; g.stroke(); g.restore();
    const shape = (sh, fill, stroke, lw) => {
      if (sh.type === 'box') { g.beginPath(); g.rect(X(sh.min[0]), Z(sh.min[1]), (sh.max[0] - sh.min[0]) * s, (sh.max[1] - sh.min[1]) * s); }
      else if (sh.type === 'circle') { g.beginPath(); g.arc(X(sh.c[0]), Z(sh.c[1]), Math.max(.8, sh.r * s), 0, Math.PI * 2); }
      else if (sh.type === 'ellipse') { g.beginPath(); g.ellipse(X(sh.c[0]), Z(sh.c[1]), sh.rx * s, sh.rz * s, sh.rot ?? 0, 0, Math.PI * 2); }
      else if (sh.type === 'obb') { const cs = Math.cos(sh.yaw), sn = Math.sin(sh.yaw), pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [sh.c[0] + a * sh.hx * cs + b * sh.hz * sn, sh.c[1] - a * sh.hx * sn + b * sh.hz * cs]); poly(pts); }
      else if (sh.type === 'poly') poly(sh.pts);
      else if (sh.type === 'seg' || sh.type === 'line') { line(sh.type === 'seg' ? [sh.a, sh.b] : sh.pts); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(1, sh.hw * 2 * s); g.strokeStyle = fill; g.stroke(); return; }
      if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw ?? 1; g.strokeStyle = stroke; g.stroke(); }
    };
    // Reserved / soft (Pinewood) land.
    g.globalAlpha = .18; for (const sh of D.layers.soft) shape(sh, COL.soft); g.globalAlpha = 1;
    // Terrain silhouette and height bands from the same sampled surface as the planner.
    g.imageSmoothingEnabled = false;
    g.drawImage(relief, X(D.grid.minX), Z(D.grid.minZ), RW * D.grid.res * s, RH * D.grid.res * s);
    for (const sh of D.layers.parcel) shape(sh, COL.parcel);
    g.imageSmoothingEnabled = false;
    const rs = RG.res * s; g.globalAlpha = .9; g.drawImage(imgPave, X(RG.minX), Z(RG.minZ), RW * rs, RH * rs); g.globalAlpha = 1;
    for (const sh of D.layers.lot) shape(sh, COL.lot);
    for (const sh of D.layers.road) shape(sh, COL.road);
    for (const sh of D.layers.path) shape(sh, COL.path);
    for (const sh of D.layers.water) shape(sh, COL.water, null);
    for (const sh of D.layers.stream) shape(sh, COL.stream);
    for (const sh of D.layers.building) shape(sh, COL.building);
    g.drawImage(imgSolid, X(RG.minX), Z(RG.minZ), RW * rs, RH * rs);
    for (const sh of D.layers.prop) shape(sh, COL.prop);
    for (const sh of D.layers.reserved) shape(sh, null, COL.reserved, 2);
    for (const sh of D.layers.tree) shape(sh, COL.tree);
    // Old line, faint.
    g.setLineDash([6, 4]); line(P.oldLine); g.closePath(); g.lineWidth = Math.max(1.5, 2.4 * s); g.strokeStyle = COL.old; g.stroke(); g.setLineDash([]);
    // Proposed corridor and centre line, coloured by segment type.
    const C = P.centreline, n = C.length, step = P.summary.length / n;
    line(C.map((q) => [q[0], q[1]])); g.closePath(); g.lineWidth = Math.max(3, P.meta.footprint.corridorHalf * 2 * s); g.strokeStyle = COL.corridor; g.stroke();
    g.fillStyle = COL.corridor;
    for (const edge of D.tightEdges) { poly(edge); g.fill(); }
    for (const segment of P.segments) {
      const {type: t} = segment;
      const first = Math.round(segment.from / step), last = Math.round(segment.to / step) + (segment.to < segment.from ? n : 0);
      const points = [];
      for (let i = first; i <= last; i++) points.push(C[i % n]);
      line(points);
      g.lineWidth = Math.max(detail ? 3 : 2, (t === 'tunnel' ? 1.6 : 2.4) * s);
      g.strokeStyle = t === 'tunnel' ? '#fff3cf' : t === 'bridge' ? COL.bridge : t === 'crossing' ? COL.crossing : COL.line;
      g.setLineDash(t === 'tunnel' ? [Math.max(4, 3 * s), Math.max(3, 2 * s)] : []); g.stroke();
    }
    g.setLineDash([]);
    for (const t of P.treesCleared) { const x = X(t.pos[0]), z = Z(t.pos[1]), r = Math.max(2, .8 * s); g.beginPath(); g.moveTo(x - r, z - r); g.lineTo(x + r, z + r); g.moveTo(x + r, z - r); g.lineTo(x - r, z + r); g.strokeStyle = COL.cleared; g.lineWidth = Math.max(1, s * .3); g.stroke(); }
    for (const c of P.crossings) {
      g.beginPath(); g.arc(X(c.at[0]), Z(c.at[1]), detail ? 7 * s : 7, 0, Math.PI * 2); g.strokeStyle = COL.crossing; g.lineWidth = detail ? 3 : 2.5; g.stroke();
      for (const p of c.gates) { g.fillStyle = '#fff'; g.strokeStyle = COL.crossing; g.lineWidth = 2; const r = Math.max(3, .6 * s); g.fillRect(X(p[0]) - r, Z(p[1]) - r, 2 * r, 2 * r); g.strokeRect(X(p[0]) - r, Z(p[1]) - r, 2 * r, 2 * r); }
      if (!detail) { g.fillStyle = COL.crossing; g.font = 'bold 13px sans-serif'; g.fillText(c.id.replace('crossing-', 'X'), X(c.at[0]) + 8, Z(c.at[1]) - 6); }
    }
    for (const t of P.tunnels) for (const p of t.portals) {
      const x = X(p.pos[0]), z = Z(p.pos[1]), r = Math.max(5, 1.6 * s); g.save(); g.translate(x, z); g.rotate(Math.atan2(p.outward[1], p.outward[0]));
      g.fillStyle = '#d9cdb4'; g.strokeStyle = '#3b2d1a'; g.lineWidth = 2; g.fillRect(-r * .5, -r * 1.6, r, r * 3.2); g.strokeRect(-r * .5, -r * 1.6, r, r * 3.2); g.restore();
      if (!detail && p.end === 'a') { g.fillStyle = COL.tunnel; g.font = 'bold 13px sans-serif'; g.fillText(t.id.replace('tunnel-', 'T'), x + 8, z + 14); }
    }
    for (const b of P.bridges) for (const p of b.piers) { g.fillStyle = COL.bridge; const r = Math.max(3, .7 * s); g.fillRect(X(p[0]) - r, Z(p[1]) - r, 2 * r, 2 * r); }
    for (const st of P.stations) {
      g.setLineDash([5, 4]); line(st.walkPath); g.strokeStyle = COL.walk; g.lineWidth = detail ? 3 : 2; g.stroke(); g.setLineDash([]);
      poly(st.platformWithRamps); g.fillStyle = COL.station; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.2; g.stroke();
      g.beginPath(); g.arc(X(st.origin[0]), Z(st.origin[1]), detail ? 6 : 4, 0, Math.PI * 2); g.fillStyle = COL.walk; g.fill();
      g.font = (detail ? 'bold 16px' : 'bold 13px') + ' sans-serif'; g.fillStyle = '#000'; g.strokeStyle = '#fff'; g.lineWidth = 3;
      const px = X(st.centre[0]), pz = Z(st.centre[1]), label = st.short;
      if (px > ox && px < ox + w && pz > oy && pz < oy + h) {
        const lx = Math.max(ox + 6, Math.min(px + 10, ox + w - 6 - g.measureText(label).width));
        const lz = Math.max(oy + 19, pz - 8);
        g.strokeText(label, lx, lz); g.fillText(label, lx, lz);
      }
    }
    for (const p of P.proposals ?? []) { line(p.path); g.strokeStyle = '#0b8f3a'; g.lineWidth = 3; g.setLineDash([2, 3]); g.stroke(); g.setLineDash([]); }
    if (!detail) for (const b of D.bugs) { g.beginPath(); g.arc(X(b.at[0]), Z(b.at[1]), 9, 0, Math.PI * 2); g.strokeStyle = '#000'; g.lineWidth = 2; g.setLineDash([3, 2]); g.stroke(); g.setLineDash([]); }
    g.restore();
    // scale bar
    const bar = detail ? 10 : 50; g.fillStyle = '#000'; g.fillRect(ox + 12, oy + h - 16, bar * s, 4); g.font = '12px sans-serif'; g.fillText(bar + ' m', ox + 16 + bar * s, oy + h - 11);
    return {X, Z, s};
  }
  // Main map.
  const mainW = 1880, mainH = H0;
  const T = draw(M, 10, 10, mainW, mainH, false);
  g.font = '12px sans-serif'; g.fillStyle = '#000';
  for (let x = Math.ceil(M.x0 / 50) * 50; x <= M.x1; x += 50) g.fillText(x, T.X(x) - 8, 24);
  for (let z = Math.ceil(M.z0 / 50) * 50; z <= M.z1; z += 50) g.fillText(z, 14, T.Z(z) + 4);
  // Legend and tables.
  let y = 30; const x0 = mainW + 40;
  g.fillStyle = '#000'; g.font = 'bold 26px sans-serif'; g.fillText('Thistlebrook northern railway loop · Stage A', x0, y); y += 30;
  g.font = '15px sans-serif';
  const S = P.summary;
  for (const t of [`${S.length} m (old ${S.oldLength.toFixed(2)} m) · ${S.stations} stations · ${S.crossings} level crossings · ${S.tunnels} tunnels (${S.tunnelLength} m)`,
    `Minimum radius ${S.minRadius.toFixed(1)} m · maximum grade ${Number.parseFloat(S.maxGrade).toFixed(2)}% · total cost ${S.totalCost}`,
    `${P.omittedStops.length} stops deferred, including Coral Coast Beach`,
    'Continuous service · stations only']) { g.fillText(t, x0, y); y += 21; }
  y += 8;
  const legend = [['sea', COL.sea], ['land / beach sand', COL.beach], ['river / lake / pond', COL.water], ['narrow river / stream', COL.stream], ['mountain / hill (terrain)', COL.terrainHi], ['carriageway', COL.road], ['footpath / trail', COL.path],
    ['parking lot / apron / bays', COL.lot], ['building', COL.building], ['plaza / sports field / parcel', COL.parcel], ['prop / outdoor furniture', COL.prop], ['rendered structure (harvest)', COL.rStructure], ['rendered paving (harvest)', COL.rPaving],
    ['tree crown', COL.tree], ['reserved land (festival, arena)', COL.reserved], ['Pinewood woods (soft)', 'rgba(61,122,58,.35)'], ['old line', 'rgba(0,0,0,.4)'], ['new centre line', COL.line], ['corridor (2 m / 2.5 m inside tight curves)', COL.corridor],
    ['level crossing / gates', COL.crossing], ['tunnel (dashed) / portal', '#fff3cf'], ['platform', COL.station], ['walk to landmark', COL.walk]];
  legend.forEach(([label, c], i) => { const cx = x0 + (i % 2) * 480, cy = y + Math.floor(i / 2) * 22; g.fillStyle = c; g.fillRect(cx, cy - 12, 26, 14); g.strokeStyle = '#333'; g.strokeRect(cx, cy - 12, 26, 14); g.fillStyle = '#000'; g.fillText(label, cx + 34, cy); });
  y += Math.ceil(legend.length / 2) * 22 + 16;
  const table = (title, head, rowsT, widths) => {
    g.font = 'bold 17px sans-serif'; g.fillStyle = '#000'; g.fillText(title, x0, y); y += 20; g.font = 'bold 13px sans-serif';
    let cx = x0; head.forEach((h, i) => { g.fillText(h, cx, y); cx += widths[i]; }); y += 4; g.fillRect(x0, y, widths.reduce((a, b) => a + b, 0), 1); y += 15; g.font = '13px sans-serif';
    for (const r of rowsT) { cx = x0; r.forEach((v, i) => { g.fillStyle = String(v).includes('OVER') || String(v).includes('!') ? '#c00' : '#000'; g.fillText(String(v), cx, y); cx += widths[i]; }); y += 17; }
    y += 10;
  };
  if (P.crossings.length) table('Level crossings', ['id', 'road', '° off square', 'clear to lot/bldg', 'gates off road', 'cost'], P.crossings.map((c) => [c.id.replace('crossing-', 'X'), (c.name ?? c.road).slice(0, 34), c.deviation.toFixed(1), c.clearanceToLotOrBuilding + ' m', c.gateRoadClear.map((v) => v.toFixed(1)).join(' / ') + ' m', P.meta.rules.cost.road]), [50, 330, 100, 140, 150, 60]);
  table('Tunnels', ['id', 'mountain', 'bore', 'crown / wall / flank min.', 'faces', 'bermed hoods', 'cost'],
    P.tunnels.map((t) => [t.id.replace('tunnel-', 'T'), hillNames(t), t.boreLength + ' m',
      `${t.minCover} / ${t.minWallCover} / ${t.minFlankCover ?? '—'} m`, t.portals.map((p) => p.faceHeight ?? '—').join(' / ') + ' m',
      t.hoods.join(' + ') + ' m', P.meta.rules.cost.portal + ' + ' + (P.meta.rules.cost.bore * t.boreLength).toFixed(0)]),
    [45, 145, 80, 180, 125, 125, 80]);
  table('Stations', ['station', 'walk', 'platform', 'access', 'notes'], P.stations.map((s) => [s.name.slice(0, 30), s.walk + ' m' + (s.walkOver ? ' OVER 60!' : ''), s.length + ' m' + (s.shortened ? ` (was ${s.lengthBefore})` : ''), s.access.length + ' m path', (s.access.proposed ? 'needs new east gate! ' : '') + (s.access.newCrosswalks ? s.access.newCrosswalks + ' new zebra ' : '') + (s.wasExisting ? 'was on works line' : '')]), [250, 130, 140, 110, 300]);
  if (D.validation) {
    table('Validator', ['Violations', 'Track over water', 'Trees cleared'], [[D.validation.violationCount, D.validation.measured.overWater + ' m', S.treesCleared]], [130, 150, 140]);
  }
  const xs = P.centreline.map((p) => p[0]), zs = P.centreline.map((p) => p[1]), pad = 30;
  const x0Route = Math.min(...xs) - pad, x1Route = Math.max(...xs) + pad;
  const z0Route = Math.min(...zs) - pad, z1Route = Math.max(...zs) + pad;
  const focusW = 950, focusH = Math.ceil(focusW * (z1Route - z0Route) / (x1Route - x0Route));
  g.fillStyle = '#111'; g.font = 'bold 17px sans-serif'; g.fillText('Proposed loop', x0, y + 16);
  draw({x0: x0Route, z0: z0Route, x1: x1Route, z1: z1Route}, x0, y + 26, focusW, Math.min(focusH, H0 - y - 26), true);
  // Insets.
  insetList.forEach((it, k) => {
    const cx = 10 + (k % cols) * (IW + 10), cy = insetTop + Math.floor(k / cols) * (IH + 46), half = it.span / 2;
    g.fillStyle = '#000'; g.font = 'bold 14px sans-serif'; g.fillText(it.title, cx, cy - 22, IW); if (it.sub) { g.font = '12px sans-serif'; g.fillText(it.sub, cx, cy - 7, IW); }
    draw({x0: it.at[0] - half, z0: it.at[1] - half, x1: it.at[0] + half, z1: it.at[1] + half}, cx, cy, IW, IH, true);
    g.strokeStyle = it.kind === 'bug' ? '#000' : it.kind === 'crossing' ? COL.crossing : it.kind === 'tunnel' ? COL.tunnel : it.kind === 'bridge' ? COL.bridge : '#b59a00'; g.lineWidth = 3; g.strokeRect(cx, cy, IW, IH);
  });
  g.fillStyle = '#000'; g.font = 'bold 20px sans-serif'; g.fillText('Tunnel, station and reported issue locations', 10, H0 + 38);
  return {w: cv.width, h: cv.height, url: cv.toDataURL('image/png')};
}

const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox']});
try {
  const p = await browser.newPage({viewport: {width: 1200, height: 900}});
  const res = await p.evaluate(page, data);
  writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log(out, res.w + '×' + res.h);
} finally { await browser.close(); }
