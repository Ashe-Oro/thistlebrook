// Stage A railway reroute, seed 831. Run: timeout 300s node tools/railway-plan.mjs
// Option: --out path.json
import {writeFileSync} from 'node:fs';
import survey from './railway-plan/route.json' with {type: 'json'};
import {buildWorld} from './railway-plan/build.mjs';
import {stopsFor, walkGraph, searchStation} from './railway-plan/stations.mjs';
import {legRules} from './railway-plan/costmap.mjs';
import {connectStations} from './railway-plan/route.mjs';
import {northernAlignment} from './railway-plan/northern-alignment.mjs';
import {describePlan} from './railway-plan/describe.mjs';

const args = process.argv.slice(2);
if (args.length && (args[0] !== '--out' || args.length !== 2)) {
  throw Error('Usage: timeout 300s node tools/railway-plan.mjs [--out path.json]');
}
const out = args[1] ?? new URL('./railway-plan/route.json', import.meta.url).pathname;

// The selected station sites and surveyed legs are checked against the
// compiled world on every run. The return passes south of hill-15.
const sites = [
  {id: 'roadster', c: [-190, -203], heading: 23, side: -1, dir: -1},
  {id: 'maple', c: [-20, -198.853], heading: 0, side: 1, dir: 1},
];

console.log('Railway reroute planner, seed 831');
const W = buildWorld();
const stops = stopsFor(W.town);
const walk = walkGraph(W.town);
const rules = legRules(W.grid, W.cm, null);
const stations = sites.map((site) => {
  const stop = stops.find((s) => s.id === site.id);
  const [candidate] = searchStation(W, stop, walk, rules, {site});
  if (!candidate) throw Error(`No valid platform at the selected ${stop.name} site`);
  console.log(`  ${stop.name}: ${candidate.length} m platform, ${candidate.walk.toFixed(1)} m walk`);
  return {...candidate, id: stop.id, stop, dir: site.dir};
});
const loop = connectStations(W, stations, console.log, northernAlignment);
const plan = describePlan(W, {stops: stations.map((s) => s.stop), stations, loop, walk});
plan.omittedStops = survey.omittedStops;
plan.tradeoffs = [
  {kind: 'coverage', text: 'Northern loop serves Roadster and Maple Hollow. Eleven stops are deferred, including Coral Coast Beach.'},
  {kind: 'radius', text: 'The eastern turnback retains 11 m curves and a 4.5 m reverse-curve tangent. Curves below 15 m have 2.5 m of inside clearance.'},
];

writeFileSync(out, JSON.stringify(plan, null, 1) + '\n');
console.log(`Wrote ${out}`);
console.log(`${plan.summary.length} m | ${plan.tunnels.length} tunnels | ${plan.crossings.length} crossings | ${plan.stations.length} stations`);
