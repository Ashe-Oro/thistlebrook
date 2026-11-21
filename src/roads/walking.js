// OWNER: grok-roads lane. Turns a destination into sidewalk steps for walkers.
import {pedestrianGraph, walkBetween} from './pedestrian.js';
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearTown = new WeakMap();
function townLocator(town) {
  if (!nearTown.has(town)) {
    const cell = 6, map = new Map();
    town.nodes.forEach((p, i) => { if (!town.edges[i]?.length) return; const k = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`; if (!map.has(k)) map.set(k, []); map.get(k).push(i); });
    nearTown.set(town, (p) => { for (let r = 1; r < 40; r++) { let best = -1, bd = Infinity; for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) for (const i of map.get(`${Math.floor(p[0] / cell) + x},${Math.floor(p[1] / cell) + z}`) || []) { const d = dist(town.nodes[i], p); if (d < bd) { bd = d; best = i; } } if (best >= 0) return best; } return 0; });
  }
  return nearTown.get(town);
}
/** Steps from a position to a town node: [{pos, node, cross?}]. The final step
 * is the node itself unless it lies on a carriageway, in which case walkers stop
 * at the kerb beside it. Intermediate steps carry the nearest town node so the
 * planner can re-route from wherever the walker is. */
export function sidewalkSteps(town, from, endNode) {
  const graph = pedestrianGraph(town), target = town.nodes[endNode], locate = townLocator(town);
  const walk = walkBetween(graph, from, target);
  const steps = walk.map((p) => ({pos: p.pos, node: locate(p.pos), ...(p.cross ? {cross: true} : {})}));
  if (dist(steps.at(-1).pos, target) > .02 && !graph.index.inside(target, -.4)) steps.push({pos: [...target], node: endNode});
  else steps.at(-1).node = endNode;
  if (steps.length && dist(steps[0].pos, from) < .02) steps.shift();
  return steps;
}

/** Final pass over a whole walking route (door exits, sidewalk steps, venue
 * paths). No step may stand on asphalt and no leg may cut across it except a
 * walk-graph crossing: such steps move to the nearest walk node, and such legs
 * are replaced by the sidewalk route (which only crosses at crossings). */
export function keepToSidewalks(town, from, steps) {
  const graph = pedestrianGraph(town), locate = townLocator(town), onRoad = (p) => graph.index.depth(p) > .05;
  const cutsRoad = (a, b) => { const n = Math.ceil(dist(a, b) / .3); for (let k = 1; k < n; k++) if (onRoad([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n])) return true; return false; };
  const out = []; let prev = from;
  for (const step of steps) {
    let s = step;
    if (!s.cross && onRoad(s.pos)) { const n = graph.nearest(s.pos); if (n >= 0) s = {...s, pos: [...graph.nodes[n].pos]}; }
    if (!s.cross && cutsRoad(prev, s.pos)) for (const p of walkBetween(graph, prev, s.pos)) if (dist(p.pos, prev) > .02 && dist(p.pos, s.pos) > .02) out.push({pos: p.pos, node: locate(p.pos), ...(p.cross ? {cross: true} : {})});
    if (out.length && dist(out.at(-1).pos, s.pos) < .02) out[out.length - 1] = {...out.at(-1), ...s, node: s.node ?? out.at(-1).node}; else out.push(s); // the authored step wins (exact slot positions)
    prev = s.pos;
  }
  return out;
}

/** Vehicle-facing position and velocity for residents, including kerb waits. */
export function residentPedestrian(actor, walkPace) {
  const [x, z] = actor.context.location.position;
  const walking = actor.action?.tool === 'walkTo';
  const target = actor.route[0]?.pos;
  const gap = target ? Math.hypot(target[0] - x, target[1] - z) : 0;
  const moving = walking && gap > .01 && !actor.waitingToCross && !actor.waitingForTrain && !actor.waitingForLocalTraffic;
  const pace = walkPace ?? actor.context.personality.pace;
  return {id: actor.context.id, x, z, walking, crossing: !!actor.crossing, waitingForLocalTraffic: !!actor.waitingForLocalTraffic,
    vx: moving ? (target[0] - x) / gap * pace : 0,
    vz: moving ? (target[1] - z) / gap * pace : 0};
}
