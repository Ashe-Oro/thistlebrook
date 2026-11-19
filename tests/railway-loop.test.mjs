import test from 'node:test';
import assert from 'node:assert/strict';
import survey from '../tools/railway-plan/route.json' with {type: 'json'};
import {loadWorld} from '../tools/railway-plan/layers.mjs';
import {auditRailwayLayout} from '../tools/audit-railway-layout.mjs';
import {railPose, dist, planRailway} from '../src/compiler/railway.js';
import {CONSIST, railwayReview, SECONDS_PER_HOUR, timetable, trainAt, trainCars, crossingState, railClear} from '../src/astra/railway-plan.js';
import {pedestrianGraph} from '../src/roads/pedestrian.js';
import * as THREE from 'three';
import {landscapeHills} from '../src/compiler/terrain.js';
import {excavateHill, tunnelCuts} from '../src/astra/railway-tunnels.js';

const {town, catalog} = loadWorld(), rail = town.railway;
const graph = pedestrianGraph(town);
const faults = (mutate) => {
  const world = structuredClone(town), issues = [];
  mutate(world);
  auditRailwayLayout(world, catalog, graph, (issue) => issues.push(issue));
  return new Set(issues);
};

test('the runtime uses the surveyed elevations and the full closed northern loop', () => {
  assert.equal(rail.length, 590.5);
  assert.deepEqual(rail.samples.map(({p, y}) => [...p, y]), survey.centreline);
  assert.deepEqual(rail.stations.map(({id}) => id), ['roadster', 'maple']);
  assert.deepEqual(rail.crossings, []);
  assert.deepEqual(rail.bridges, []);
  assert.equal(rail.tunnels.length, 3);
  assert.deepEqual(railPose(rail, 0).p, railPose(rail, rail.length).p);
  assert.equal(rail.service.mode, 'continuous-loop');
  for (const st of rail.stations) {
    const [dx, dz] = st.entry.map((component, i) => component - st.trackCentre[i]);
    assert(dx * st.out[0] + dz * st.out[1] > st.near, st.id + ' platform faces its access link');
  }
  const secondCompilation = planRailway();
  assert.notEqual(secondCompilation.tunnels[0].portals, rail.tunnels[0].portals);
  const review = railwayReview(town, graph);
  assert.equal(review.trailing, 7);
  assert(review.stops.every((stop) => stop.linked && stop.sign && stop.distance <= 60));
});

test('the consist runs through midnight and dwells only at its two platforms', () => {
  const tt = timetable(rail);
  assert.equal(tt.lap * tt.laps, 24 * SECONDS_PER_HOUR);
  assert(tt.legs.every((l) => l.v > 0 && l.v <= 9));
  const midnight = trainAt(rail, tt, 0);
  assert.equal(midnight.s, rail.stations[0].s);
  const justBefore = trainAt(rail, tt, 24 - 1e-5);
  assert(Math.abs(midnight.s - justBefore.s) < .001);
  let nightRuns = 0;
  for (let second = 0; second < 2160; second++) {
    const state = trainAt(rail, tt, second / 90);
    const cars = trainCars(rail, state.s);
    assert.equal(cars.length, CONSIST.length);
    if (state.phase === 'dwell') {
      assert.equal(state.s, rail.stations.find((st) => st.id === state.station).s);
      assert.equal(state.speed, 0);
    } else {
      assert.equal(state.phase, 'run');
      if (second < 5 * 90) nightRuns++;
    }
    cars.slice(1).forEach((car, i) => assert(dist(car.pos, cars[i].pos) > 3));
  }
  assert(nightRuns > 150);
});

test('gate protects a registered crossing until the entire train clears', () => {
  const crossing = {s: 112, reach: 5, pos: [0, 0], railDir: [1, 0]};
  const testRail = {...rail, crossings: [crossing]};
  const closed = crossingState(testRail, crossing, {s: 92});
  assert.equal(closed.lower, 1);
  assert.equal(railClear(testRail, [closed], [0, 4], [0, 0]), false);
  assert.equal(railClear(testRail, [closed], [0, 0], [0, 4]), true);
  assert.equal(crossingState(testRail, crossing, {s: 154}).closed, false);
});

test('TOWN-19 · all six mouths are physically open in the rendered hills', () => {
  const cuts = tunnelCuts(rail), hills = [];
  for (const h of landscapeHills(town)) if (rail.tunnels.some((t) => t.mountains.includes(h.id))) {
    for (const part of h.parts) {
      const geometry = part.geometry.clone().scale(...part.scale).translate(...part.position);
      hills.push(new THREE.Mesh(excavateHill(geometry, cuts), new THREE.MeshBasicMaterial({side: THREE.DoubleSide})));
    }
  }
  for (const t of rail.tunnels) for (const [i, p] of t.portals.entries()) {
    const eye = new THREE.Vector3(p.pos[0] + p.outward[0] * .35, p.y + 1.4, p.pos[1] + p.outward[1] * .35);
    const inward = new THREE.Vector3(-p.outward[0], 0, -p.outward[1]).normalize();
    const ray = new THREE.Raycaster(eye, inward, 0, 1.3);
    assert.equal(ray.intersectObjects(hills).length, 0, `${t.id} mouth ${i}`);
  }
});

test('TOWN-19 and TOWN-21–24 · audit rejects the railway and patio regressions', () => {
  assert.deepEqual([...faults(() => {})], []);
  const cases = [
    ['rail-portal', (t) => t.railway.tunnels[0].portals.pop()],
    ['rail-terrain', (t) => { t.landscape.hills.find((h) => h.registryId === 'landscape:hill-11').height = 2; }],
    ['rail-water', (t) => { t.railway.samples[60].p = [320, 100]; }],
    ['rail-on-parcel', (t) => { t.railway.samples[60].p = [241, 23]; }],
    ['rail-tree', (t) => t.trees.push({id: 'cv-tree-pine', pos: t.railway.samples[53].p, scale: 1})],
    ['station-water', (t) => { t.railway.stations[0].platformWithRamps = [[312, 81], [312, 113], [315, 113], [315, 81]]; }],
    ['rail-crossing', (t) => {
      const c = {id: 'diagonal-slab', pos: [46, -7], railDir: [Math.cos(Math.PI * 35 / 180), Math.sin(Math.PI * 35 / 180)],
        roadDir: [1, 0], angle: 35, gated: true, road: 'town', gates: [[44, -10], [48, -4]],
        deck: {from: 55, to: 65, y: .4, flush: false, continuousRails: false}};
      t.railway.crossings.push(c);
    }],
    ['placed-overlap', (t) => { t.courtyards[0].min = [46, -8]; t.courtyards[0].max = [48, -5]; }],
  ];
  for (const [category, mutate] of cases) assert(faults(mutate).has(category), category);
});
