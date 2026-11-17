// Pure, JSON-serializable place metadata and navigation helpers. No instance mutations.
import { CIVIC_NAMES, placeDefaults } from '../catalog/places.js';
import { TOWNSFOLK } from '../catalog/townsfolk.js';
import { toWorldXZ, rotDir, obbFromRect, obbCorners } from '../compiler/geometry.js';
import { blockers, blocked, distance } from '../life/graph.js';

const xz = p => p.length === 3 ? [p[0], p[2]] : p;
const entryPoints = p => (Array.isArray(p.points) ? p.points : []).filter(point => point?.kind === 'entry');
const validPos = p => Array.isArray(p) && [2, 3].includes(p.length) && p.every(Number.isFinite);

/** Build records for every placed object except NPCs; catalog IDs may repeat. */
export function buildWorldRegistry(town, catalog) {
  const places = [];
  for (const [index, inst] of town.instances.entries()) {
    if (inst.kind === 'villager') continue;
    const entry = catalog.get(inst.id), defaults = placeDefaults(inst, entry);
    const { type, building } = defaults;
    const placement = { x: inst.pos[0], z: inst.pos[1], rotY: inst.rotY || 0 };
    const scale = inst.scale ?? 1;
    const world = p => toWorldXZ(xz(p).map(v => v * scale), placement);
    const facing = dir => rotDir(xz(dir), placement.rotY);
    const point = (kind, pos, dir = [0, 1]) => ({ kind, pos: world(pos), facing: facing(dir) });
    const front = (entry?.footprint?.max[1] ?? inst.radius ?? 0) + .65 / scale;
    const snaps = entry?.pathSnaps || [];
    const entries = building && snaps.length ? snaps : [{ pos: [0, front], dir: [0, 1] }];
    const points = entries.map(s => {
      const p = point('entry', s.pos, s.dir);
      // Catalog snaps can sit exactly at the walker's .30m clearance boundary.
      if (building && snaps.length) p.pos = p.pos.map((v, axis) => v + p.facing[axis] * .10);
      return p;
    });
    if (entry?.door) points.push(point('door', entry.door.pos, entry.door.facing));
    for (const [n, kind] of (defaults.points || []).entries()) {
      points.push(point(kind, [n * .65, kind === 'counter' || kind === 'stall' ? front : 0]));
    }
    // Optional resolved catalog anchors override generated affordances of that kind.
    const anchors = entry?.place?.interactionPoints || [];
    const overridden = new Set(anchors.map(a => a.kind));
    for (let i = points.length - 1; i >= 0; i--) if (overridden.has(points[i].kind)) points.splice(i, 1);
    for (const anchor of anchors) {
      points.push(point(anchor.kind, anchor.pos, anchor.facing));
    }
    const hours = Array.isArray(defaults.hours)
      ? { open: defaults.hours[0], close: defaults.hours[1] } : { ...defaults.hours };
    const suffix = inst.lot != null && building ? `lot:${inst.lot}` : `instance:${index}`;
    places.push({
      id: `place:${inst.kind}:${suffix}`, catalogId: inst.id, instanceIndex: index,
      ...(inst.lot != null ? { lot: inst.lot } : {}),
      ...(inst.district ? { district: inst.district } : {}),
      type, building, name: defaults.name || CIVIC_NAMES[inst.id] || entry?.name || (type === 'plaza' ? 'Village Green' : inst.id),
      owner: null, occupants: [], hours, points, capabilities: [...defaults.capabilities], pos: [...inst.pos],
    });
  }
  // Work defaults apply even without life mode. Actual assigned homes/workplaces
  // take precedence; duplicate civic assets share workers only when unassigned.
  const npcs = new Map(TOWNSFOLK.map(npc => [npc.id, npc]));
  for (const npc of town.instances.filter(i => i.kind === 'villager')) npcs.set(npc.id, { ...npcs.get(npc.id), ...npc });
  for (const npc of npcs.values()) {
    for (const assignment of [npc.home, npc.workplace || (npc.work ? { id: npc.work } : null)]) {
      if (!assignment) continue;
      for (const place of places.filter(p => p.catalogId === assignment.id && (assignment.lot == null || p.lot === assignment.lot))) {
        if (!place.occupants.includes(npc.id)) place.occupants.push(npc.id);
        place.owner ??= npc.id;
      }
    }
  }
  return { version: 1, places };
}

export function getPlace(registry, id) {
  return registry?.places?.find(p => p.id === id) ?? null;
}

export function isOpen(hours, hour) {
  if (!hours || !Number.isFinite(hour)) return false;
  const h = ((hour % 24) + 24) % 24;
  if (hours.open === 0 && hours.close === 24) return true;
  return hours.open < hours.close ? h >= hours.open && h < hours.close : h >= hours.open || h < hours.close;
}

/** Results are copies with entryNode; near sorts by place position, then ID. */
export function findPlace(registry, query = {}) {
  const name = query.name?.trim().toLowerCase();
  const matches = (registry?.places || []).filter(p =>
    (!query.type || p.type === query.type)
    && (!query.capability || p.capabilities.includes(query.capability))
    && (!query.ownerId || p.owner === query.ownerId)
    && (!name || p.name.toLowerCase().includes(name))
    && (query.openAt == null || isOpen(p.hours, query.openAt)));
  if (query.near) matches.sort((a, b) => distance(a.pos, xz(query.near)) - distance(b.pos, xz(query.near)) || a.id.localeCompare(b.id));
  return matches.map(p => ({ ...p, entryNode: nearestEntryNode(registry, registry.graph, p.id) }));
}

export function interactionPoints(registry, placeId, kind) {
  return (getPlace(registry, placeId)?.points || []).filter(p => !kind || p.kind === kind);
}

/** Resolve a tool target (unique ID, display name, type, or PlaceQuery). */
export function resolvePlace(registry, target, query = {}) {
  if (typeof target !== 'string') return findPlace(registry, { ...target, ...query })[0] ?? null;
  const exact = getPlace(registry, target);
  if (exact) return { ...exact, entryNode: nearestEntryNode(registry, registry.graph, exact.id) };
  return findPlace(registry, { name: target, ...query })[0]
    ?? findPlace(registry, { type: target, ...query })[0] ?? null;
}

export function nearestEntryNode(registry, graph, placeId) {
  const place = getPlace(registry, placeId);
  if (!place) return -1;
  const entries = entryPoints(place).filter(p => validPos(p.pos) && Number.isInteger(p.node) && p.node >= 0
    && (!graph || graph.nodes[p.node] && graph.connected.includes(p.node)
      && distance(graph.nodes[p.node].pos, xz(p.pos)) < .001));
  entries.sort((a, b) => distance(xz(a.pos), place.pos) - distance(xz(b.pos), place.pos));
  return entries[0]?.node ?? -1;
}

// Exact segment/slab intersection against conservatively inflated OBBs avoids
// skipping thin fences between samples. Endpoints need the same .30m clearance.
function clearSegment(a, b, solids) {
  return solids.every(box => {
    let lo = 0, hi = 1;
    for (const [axis, half] of [[box.u, box.hu], [box.v, box.hv]]) {
      const origin = (a[0] - box.c[0]) * axis[0] + (a[1] - box.c[1]) * axis[1];
      const delta = (b[0] - a[0]) * axis[0] + (b[1] - a[1]) * axis[1];
      const extent = half + .30;
      if (Math.abs(delta) < 1e-10) { if (Math.abs(origin) > extent) return true; }
      else {
        const t1 = (-extent - origin) / delta, t2 = (extent - origin) / delta;
        lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
        if (lo > hi) return true;
      }
    }
    return false;
  });
}

function entryApproach(target, base, graph, solids, building) {
  const candidates = base.map(node => ({ node, d: distance(graph.nodes[node].pos, target) }))
    .filter(c => c.d <= (building ? 64 : 12)).sort((a, b) => a.d - b.d || a.node - b.node);
  const direct = p => candidates.find(c => clearSegment(graph.nodes[c.node].pos, p, solids));
  const first = direct(target);
  if (first) return { node: first.node, path: [target] };
  if (!building || !candidates.length) return null;
  // Farm outbuildings can sit behind another facade. A local visibility search
  // around inflated footprint corners gives them a clear approach with bends.
  const corners = solids.filter(b => distance(b.c, target) < 24)
    .flatMap(b => obbCorners({ ...b, hu: b.hu + .4, hv: b.hv + .4 }))
    .filter(p => !blocked(p, solids, .30));
  const queue = [{ pos: target, path: [target] }], seen = new Set();
  for (let k = 0; k < queue.length; k++) {
    const current = queue[k];
    if (k) {
      const candidate = direct(current.pos);
      if (candidate) return { node: candidate.node, path: current.path };
    }
    for (const [i, corner] of corners.entries()) {
      if (!seen.has(i) && clearSegment(current.pos, corner, solids)) {
        seen.add(i); queue.push({ pos: corner, path: [corner, ...current.path] });
      }
    }
  }
  return null;
}

/** Add only collision-free spurs from the existing connected component.
 * Repeated calls, including with a rebuilt graph, are safe. Unreachable entries
 * remain unresolved rather than silently snapping through architecture.
 */
export function connectRegistryToGraph(registry, graph, town, catalog) {
  const solids = blockers(town, catalog);
  for (const p of registry.places.filter(p => p.building)) {
    const inst = town.instances[p.instanceIndex], entry = catalog.get(p.catalogId);
    if (inst && entry?.footprint && !['house', 'landmark', 'well'].includes(inst.kind)) {
      solids.push(obbFromRect(entry.footprint, { x: inst.pos[0], z: inst.pos[1], rotY: inst.rotY || 0 }, inst.scale ?? 1));
    }
  }
  // Always anchor to original roads/stall spurs, so retries cannot grow chains
  // through previously generated registry spurs or change unresolved props.
  const base = graph.connected.filter(n => graph.nodes[n].street !== 'registry-entry');
  const connected = new Set(graph.connected);
  for (const place of registry.places) for (const point of entryPoints(place)) {
    if (Number.isInteger(point.node) && connected.has(point.node)
      && graph.nodes[point.node] && distance(graph.nodes[point.node].pos, xz(point.pos)) < .001) continue;
    delete point.node;
    const target = xz(point.pos);
    if (blocked(target, solids, .30)) continue;
    const approach = entryApproach(target, base, graph, solids, place.building);
    if (!approach) continue;
    let previous = approach.node;
    for (const destination of approach.path) {
      const from = graph.nodes[previous].pos;
      const length = distance(from, destination);
      if (length <= .00001) continue;
      const count = Math.max(1, Math.ceil(length / .55));
      for (let n = 1; n <= count; n++) {
        const pos = from.map((v, axis) => v + (destination[axis] - v) * n / count);
        const node = graph.nodes.length;
        graph.nodes.push({ pos, street: 'registry-entry', placeId: place.id });
        graph.edges.push([previous]); graph.edges[previous].push(node);
        graph.connected.push(node); connected.add(node); previous = node;
      }
    }
    point.node = previous;
  }

  registry.graph = graph;
  return graph;
}

/** Dedicated opt-in check. Empty occupants explicitly mean vacant/unassigned. */
export function registryFailures(registry, graph, town, catalog) {
  const failures = [], ids = new Set();
  const fail = (place, msg) => failures.push({ msg, placeId: place?.id ?? null });
  if (!Array.isArray(registry?.places)) return [{ msg: 'Missing world registry' }];
  const reachable = new Set();
  const root = graph?.connected?.[0];
  if (graph?.nodes?.[root]) {
    const queue = [root]; reachable.add(root);
    for (let k = 0; k < queue.length; k++) for (const n of graph.edges?.[queue[k]] || []) {
      if (graph.nodes[n] && !reachable.has(n)) { reachable.add(n); queue.push(n); }
    }
  }
  for (const p of registry.places) {
    if (!p.id || ids.has(p.id)) fail(p, 'Missing or duplicate place id');
    ids.add(p.id);
    if (!p.type || !p.name || !validPos(p.pos)) fail(p, 'Invalid place identity or position');
    if (!Array.isArray(p.occupants) || p.occupants.some(id => typeof id !== 'string')
      || !(p.owner === null || typeof p.owner === 'string') || p.owner && !p.occupants?.includes(p.owner)) fail(p, 'Missing or invalid occupants/owner');
    if (!p.hours || !Number.isFinite(p.hours.open) || !Number.isFinite(p.hours.close)
      || p.hours.open < 0 || p.hours.open >= 24 || p.hours.close < 0 || p.hours.close > 24 || p.hours.open === p.hours.close) fail(p, 'Missing or invalid opening hours');
    if (!Array.isArray(p.capabilities) || !p.capabilities.length || p.capabilities.some(c => typeof c !== 'string' || !c)) fail(p, 'Missing capabilities');
    if (!Array.isArray(p.points) || p.points.some(point => !point?.kind || !validPos(point.pos) || !validPos(point.facing)
      || Math.abs(Math.hypot(...xz(point.facing)) - 1) > .001)) fail(p, 'Invalid interaction points');
    if (p.building && (!graph || !Array.isArray(p.points)
      || !entryPoints(p).some(point => validPos(point.pos) && reachable.has(point.node) && graph.connected.includes(point.node)
        && graph.nodes[point.node] && distance(graph.nodes[point.node].pos, xz(point.pos)) < .001))) fail(p, 'Building has no reachable entry node');
  }
  // Coverage prevents deleting a record (or toggling its building flag) to evade checks.
  if (town) for (const [index, inst] of town.instances.entries()) {
    if (inst.kind === 'villager') continue;
    const records = registry.places.filter(p => p.instanceIndex === index);
    if (records.length !== 1) fail(null, `Expected one place for instance ${index}`);
    if (placeDefaults(inst, catalog?.get(inst.id)).building && !records[0]?.building) fail(records[0], 'Building classification missing');
  }
  return failures;
}
