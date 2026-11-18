import {SWITCHYARD_REST} from '../src/astra/skatepark-layout.js';
import {segDistance} from '../src/roads/pedestrian.js';
import {addScaled, minus, midpoint, crossingRoad, inJunction, spansCurbs} from '../src/roads/crosswalks.js';

const distance = (a, b) => Math.hypot(...minus(a, b));

export function auditPedestrianRules(graph, add) {
  const {edges, nodes, index} = graph;
  const marked = new Set(graph.crossings.map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join(':')));
  const pairs = new Map(graph.crossings.map(([a, b]) => [[Math.min(a, b), Math.max(a, b)].join(':'), [a, b]]));

  edges.forEach((links, u) => {
    const a = nodes[u].pos;
    if (nodes[u].kind === 'kerb' && links.length < 2) {
      add('sidewalk-dead-end', a, 'Sidewalk stops without a continuing sidewalk, crossing or footpath');
    }
    for (const edge of links) {
      const v = edge.to, b = nodes[v].pos;
      if (edge.crossing) pairs.set([Math.min(u, v), Math.max(u, v)].join(':'), [Math.min(u, v), Math.max(u, v)]);
      if (u >= v || edge.crossing) continue;
      const count = Math.max(1, Math.ceil(distance(a, b) / .1));
      for (let i = 0; i <= count; i++) {
        const p = addScaled(a, minus(b, a), i / count);
        if (index.inside(p, .01)) {
          add('walk-on-road', p, 'A sidewalk or footpath edge enters the carriageway');
          break;
        }
      }
    }
  });

  const neighbors = nodes.map(() => new Set());
  for (const [key, [u, v]] of pairs) {
    const a = nodes[u].pos, b = nodes[v].pos, center = midpoint(a, b);
    const road = crossingRoad(index, a, b);
    const connected = [u, v].every((id) => edges[id].some((e) => !e.crossing));
    const forward = edges[u].find((e) => e.to === v && e.crossing);
    const reverse = edges[v].find((e) => e.to === u && e.crossing);
    if (!connected || !marked.has(key) || !forward || !reverse || (road && !spansCurbs(index, road, a, b))) {
      add('unconnected-crosswalk', center, 'Crossing lacks two connected curb landings or a matching routing edge');
    }
    if (!road) add('diagonal-crosswalk', center, 'Crossing is off-axis or angled across the carriageway');
    if (road && inJunction(index, road, a, b)) add('junction-crosswalk', center, 'Crosswalk band overlaps the junction mouth');

    for (const w of neighbors[u]) {
      if (neighbors[v].has(w)) add('triangle-crosswalk', center, 'Three crossing edges form a closed triangle');
    }
    neighbors[u].add(v);
    neighbors[v].add(u);
  }
}

export function auditTownLayout(town, catalog, connected, add) {
  // The ground prop renderer uses y=0 for these placements. Catalog scenes
  // share a separate landing pad, including the raised Switchyard deck.
  for (const p of [...town.props, ...town.trees, ...(town.landscape?.models ?? [])]) {
    const asset = p.asset ?? p.id;
    const base = (catalog.get(asset)?.bounds.min[1] ?? 0) * (p.scale ?? 1);
    if (Math.abs(p.elevation ?? 0) > .02 || Math.abs(base) > .1) {
      add('off-surface', p.pos, `${asset} is offset from its ground surface`);
    }
  }
  for (const scene of town.catalogScenes ?? []) {
    const deck = scene.id === 'stop-skatepark' ? SWITCHYARD_REST.elevation : 0;
    if (Math.abs((scene.elevation ?? 0) - deck) > .02) add('off-surface', scene.center, `${scene.id} misses its supporting deck`);
  }

  for (const place of [...town.buildings, ...town.venues]) {
    const entry = place.door ?? place.entry;
    if (!entry || !connected.has(place.node) || distance(entry, town.nodes[place.node]) > .05) {
      add('orphan-structure', entry ?? place.pos, `${place.name ?? place.id} has no connected entrance`);
    }
  }
  for (const scene of town.catalogScenes ?? []) {
    const access = town.roads.some((r) => r.owner === 'catalog:' + scene.id && scene.street && segDistance(scene.street, r.a, r.b) < .05);
    if (!access || !scene.slots.length || scene.slots.some((s) => !connected.has(s.node)
      || distance([s.approach[0], s.approach[2]], town.nodes[s.node]) > .05)) {
      add('orphan-structure', scene.center, `${scene.id} has no connected approach and activity slot`);
    }
  }

  const districts = new Map();
  const homes = town.buildings.filter((b) => b.kind === 'home');
  for (const [i, home] of homes.entries()) {
    const {box, door, join, district} = home;
    if (!districts.has(district)) districts.set(district, []);
    districts.get(district).push(home);
    const crowding = homes.slice(i + 1).find((b) => box.min.every((v, k) => v < b.box.max[k] + .25 && box.max[k] > b.box.min[k] - .25));
    if (crowding || !join || distance(door, join) < 3) {
      add('home-spacing', home.pos, crowding ? `${home.name} crowds ${crowding.name}` : `${home.name} has no front setback`);
    }
    if (Math.abs(home.padHeight ?? home.elevation ?? 0) > .2) add('home-pad', home.pos, `${home.name} sits on a raised lot`);
  }
  for (const list of districts.values()) {
    const designs = new Set(list.map((b) => b.custom ? [b.color, b.height, b.shop].join('/') : b.id));
    if (designs.size < Math.min(3, list.length)) add('home-variety', list[0].pos, `${list[0].district} repeats the same home facades`);
  }
}

// Funfair Parking (grok-fairlot) is a self-contained lot outside the town
// pedestrian graph, so its walk lines and zebras get the same TOWN-01/02/03
// checks here against the lot's own carriageways: the aisles, the apron and
// the mountain road (5.2 m asphalt ribbon).
function convexHull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const inHull = (h, q) => h.every((a, i) => { const b = h[(i + 1) % h.length]; return (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) >= -1e-9; });

export function fairLotCarriageway(P) {
  const L = P.ROAD_LENGTH, edge = [];
  for (let s = L - 11; s <= L + .01; s += 1) { const {p, t} = P.roadPose(s); for (const k of [-2.6, 2.6]) edge.push([p[0] + t[1] * k, p[1] - t[0] * k]); }
  const apron = convexHull([...edge, [P.LOT.minX + .5, P.LOT.minZ], [P.LOT.minX + .5, 14.5], [P.LANES.W, 14.5]]);
  const road = []; for (let s = 0; s <= L; s += .5) road.push(P.roadPose(s).p);
  const onRoad = (q) => road.some((r, i) => i && segDistance(q, road[i - 1], r) < 2.6);
  return (q) => Object.values(P.AISLES).some((a) => P.inRect(q, a)) || inHull(apron, q) || onRoad(q);
}

export function auditFairLot(P, add, {carriageway = fairLotCarriageway(P)} = {}) {
  const inZebra = (q) => P.CROSSWALKS.find((c) => P.inRect(q, c));
  const used = new Set();
  const paths = new Map(P.BAYS.map((b) => [b.walk.map((q) => q.join()).join('|'), b.walk]));
  for (const walk of paths.values()) {
    let flagged = false;
    for (let i = 1; i < walk.length && !flagged; i++) {
      const a = walk[i - 1], b = walk[i], n = Math.max(1, Math.ceil(distance(a, b) / .1));
      for (let k = 0; k <= n; k++) {
        const q = addScaled(a, minus(b, a), k / n), z = inZebra(q);
        if (z) { used.add(z.id); continue; }
        if (carriageway(q)) { add('walk-on-road', q, 'Funfair Parking walk line crosses a lot aisle, the apron or the road outside a zebra'); flagged = true; break; }
      }
    }
    if (distance(walk.at(-1), P.GATE) > .05) add('sidewalk-dead-end', walk.at(-1), 'Funfair Parking walk line stops short of the Funfair gate');
  }
  const pedestrian = (q) => !carriageway(q) && [P.PROMENADE, P.WALKWAY, ...P.SEAMS].some((r) => P.inRect(q, r));
  for (const c of P.CROSSWALKS) {
    const center = [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2];
    const aisle = Object.values(P.AISLES).find((a) => P.inRect(c.min, a) && P.inRect(c.max, a));
    if (!aisle) { add('diagonal-crosswalk', center, `Funfair Parking zebra ${c.id} is not on one aisle`); continue; }
    const alongX = aisle.max[0] - aisle.min[0] > aisle.max[1] - aisle.min[1];
    const [k0, k1] = alongX ? [1, 0] : [0, 1];
    // Perpendicular and curb to curb: the band spans the aisle's whole width.
    if (Math.abs(c.min[k0] - aisle.min[k0]) > .01 || Math.abs(c.max[k0] - aisle.max[k0]) > .01) add('unconnected-crosswalk', center, `Funfair Parking zebra ${c.id} stops short of a kerb`);
    const mid = (c.min[k1] + c.max[k1]) / 2, land = (v) => alongX ? [mid, v] : [v, mid];
    if (!pedestrian(land(c.min[k0] - .1)) || !pedestrian(land(c.max[k0] + .1))) add('unconnected-crosswalk', center, `Funfair Parking zebra ${c.id} lacks a footway landing at both kerbs`);
    if (Object.values(P.AISLES).some((a) => a !== aisle && c.min[0] < a.max[0] && c.max[0] > a.min[0] && c.min[1] < a.max[1] && c.max[1] > a.min[1])) add('junction-crosswalk', center, `Funfair Parking zebra ${c.id} sits inside an aisle junction`);
    if (!used.has(c.id)) add('unconnected-crosswalk', center, `No Funfair Parking walk line uses zebra ${c.id}`);
  }
}

// TOWN-10 · rails are not walkways (plus the rail sides of TOWN-04/05/06).
// `R` is src/compiler/railway.js of the audited tree.
export function auditRailway(town, graph, index, R, add, {walkBetween, origin} = {}) {
  const rail = town.railway; if (!rail) return;
  const {RAIL, RAIL_RESERVED, polygonContains, crossingAt, nearRail} = R;
  const visible = rail.samples.filter((q) => !q.tunnel);
  const surface = visible.filter((q) => !(q.bridge && q.clearance >= 3 && q.y - q.ground >= 2.97));
  // Loop closure and continuity: no stubs, no orphan pieces of the old works line.
  rail.samples.forEach((q, i) => { const n = rail.samples[(i + 1) % rail.samples.length]; if (distance(q.p, n.p) > RAIL.sample * 1.6) add('rail-stub', q.p, `Track breaks for ${distance(q.p, n.p).toFixed(1)} m: the loop is not closed`); });
  if (town.workRail) for (const x of [town.workRail.minX, town.workRail.maxX]) if (!nearRail(rail, [x, town.workRail.z])) add('rail-stub', [x, town.workRail.z], 'The West Works track ends off the loop (orphan stub)');
  // Rails stay off land other lanes own (tunnel included).
  for (const q of rail.samples) { const r = RAIL_RESERVED.find((a) => !(a.overpass && q.clearance >= 3 || a.offshore && q.offshore && q.bridge) && [[0, 0], [RAIL.half, 0], [-RAIL.half, 0], [0, RAIL.half], [0, -RAIL.half]].some(([dx, dz]) => polygonContains(a.area, [q.p[0] + dx, q.p[1] + dz]))); if (r) add('rail-reserved', q.p, `Track enters ${r.id}`); }
  // Track on the ground: never floating, never in the river (TOWN-04).
  for (const q of visible) {
    if (!q.bridge && Math.abs(q.y - q.ground) > .03 || q.bridge && q.y < q.ground) add('rail-off-surface', q.p, `Track differs ${(q.y - q.ground).toFixed(2)} m from its support`);
    if (q.wet && (!q.bridge || q.y < .1)) add('rail-off-surface', q.p, 'Track runs through water without a bridge');
  }
  // Rails own their corridor: no carriageway except at gated perpendicular crossings,
  // no building, venue or hill in the ballast band.
  for (const q of surface) {
    const c = crossingAt(rail, q.p);
    if (!c && index.depth(q.p) > -RAIL.half) add('rail-on-road', q.p, 'Track runs along or across a carriageway outside a level crossing');
  }
  for (const c of rail.crossings) if (!c.gated || Math.abs(90 - c.angle) > (RAIL.crossingAngleTolerance ?? 15)) add('rail-crossing', c.pos, `Level crossing ${c.gated ? 'meets the road at ' + c.angle + '°' : 'has no barriers'}`);
  const permitted = new Set(['work-station', 'work-depot', ...rail.stations.map((s) => s.venue)]);
  for (const place of [...town.buildings, ...town.venues]) {
    if (!place.box || permitted.has(place.id)) continue;
    const b = place.box, hit = surface.find((q) => q.p[0] > b.min[0] - RAIL.half && q.p[0] < b.max[0] + RAIL.half && q.p[1] > b.min[1] - RAIL.half && q.p[1] < b.max[1] + RAIL.half);
    if (hit) add('rail-on-parcel', hit.p, `Track crosses ${place.name ?? place.id}`);
  }
  for (const h of town.landscape?.hills ?? []) { const hit = visible.find((q) => distance(q.p, h.pos) < h.radius + RAIL.half); if (hit) add('rail-blocked', hit.p, 'A hill sits on the track'); }
  for (const m of [...(town.catalogScenes ?? []).flatMap((c) => c.members), ...town.props]) { if (m.pos && nearRail(rail, m.pos, .3)) add('rail-blocked', m.pos, `${m.asset ?? m.id ?? 'prop'} stands on the track`); }
  for (const t of [...town.trees, ...(town.landscape?.models ?? [])]) { const hit = nearRail(rail, t.pos, .2); if (hit) add('rail-blocked', t.pos, `${t.asset ?? 'tree'} stands on the track`); }
  // TOWN-10: no sidewalk or footpath edge runs on the rails outside a crossing.
  graph.edges.forEach((links, u) => {
    for (const e of links) {
      if (u >= e.to) continue;
      const a = graph.nodes[u].pos, b = graph.nodes[e.to].pos, n = Math.max(1, Math.ceil(distance(a, b) / .25));
      for (let k = 0; k <= n; k++) {
        const p = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n];
        if (nearRail(rail, p, .25) && !crossingAt(rail, p)) { add('walk-on-rail', p, 'A sidewalk or footpath edge runs on the railway'); break; }
      }
    }
  });
  // TOWN-05: every station is a destination with a platform sign, lights and a walk link.
  for (const st of rail.stations) {
    const signs = st.furniture?.filter((f) => f.asset === 'station_nameboard').length ?? 0, lamps = st.furniture?.filter((f) => f.light).length ?? 0;
    if (!signs || lamps < 2) add('station-orphan', st.centre, `${st.name} lacks a sign or platform lights`);
    const v = town.venues.find((x) => x.id === st.venue), entry = v?.entry;
    if (!entry) { add('station-orphan', st.centre, `${st.name} is not a destination`); continue; }
    if (walkBetween && origin) { const t = graph.nearest(entry), w = walkBetween(graph, origin, entry); if (t < 0 || distance(graph.nodes[t].pos, entry) > .75 || !('cross' in w.at(-1))) add('station-orphan', entry, `${st.name} has no sidewalk link`); }
  }
}
