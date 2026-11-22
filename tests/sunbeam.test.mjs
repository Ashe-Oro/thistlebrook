import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileAstra, shortestPath, pointInTown } from '../src/compiler/astra.js';
import { compileWorld } from '../src/compiler/world-plan.js';
import { DISTRICT_OFFSETS, moveBox, movePoint } from '../src/compiler/astra-placement.js';
import { pathBox } from '../src/compiler/asset-vignettes.js';
import { isTree } from '../src/compiler/nature-edges.js';
import { overlap } from '../src/catalog/library/index.js';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { SUNBEAM_MALL, SUNBEAM_RESIDENTS } from '../src/astra/sunbeam-layout.js';
import { SUNBEAM_AMBIENT, SUNBEAM_FURNISHINGS, sunbeamDaytime } from '../src/astra/sunbeam-mall-plan.js';
import { buildPedestrianGraph, walkBetween } from '../src/roads/pedestrian.js';

const catalog = resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url))));
const { axisX, north, south, clearWidth, pavedWidth } = SUNBEAM_MALL;
const [northEnd, southEnd] = [[axisX, north], [axisX, south]].map(p => movePoint(p, DISTRICT_OFFSETS.sunbeam));
const worldX = northEnd[0];
const corners = ({ min, max }) => [min, [min[0], max[1]], max, [max[0], min[1]]];
const samePoint = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < .001;
const mallDoors = town => town.buildings.filter(b => b.district === 'sunbeam');
const destinations = town => [
  town.venues.find(v => v.type === 'school'),
  town.buildings.find(b => b.name === 'The Reading Room'),
  town.buildings.find(b => b.district === 'willowbank' && b.kind === 'home'),
];

function modelBox(tree) {
  const bounds = catalog.get(tree.asset ?? tree.id).bounds;
  const yaw = tree.rot ?? 0;
  const scale = tree.scale ?? 1;
  const points = corners({ min: [bounds.min[0], bounds.min[2]], max: [bounds.max[0], bounds.max[2]] })
    .map(([x, z]) => movePoint([(x * Math.cos(yaw) + z * Math.sin(yaw)) * scale,
      (z * Math.cos(yaw) - x * Math.sin(yaw)) * scale], tree.pos));
  return {
    min: [0, 1].map(axis => Math.min(...points.map(p => p[axis]))),
    max: [0, 1].map(axis => Math.max(...points.map(p => p[axis]))),
  };
}

test('Sunbeam Mall has two rows of mixed-use frontages on a wide north–south promenade', () => {
  for (const seed of [0, 42, 831, 9999]) {
    const town = compileAstra(catalog, seed);
    const doors = mallDoors(town);
    const walk = town.roads.find(r => r.a.every((v, i) => v === northEnd[i]) &&
      r.b.every((v, i) => v === southEnd[i]));
    assert(walk, 'the north and south entrances share one straight road');
    assert.equal(walk.kind, 'pedestrian');
    assert(walk.b[1] - walk.a[1] >= 50 && walk.width >= 4.5 && pavedWidth > walk.width);
    assert(doors.filter(b => b.pos[0] < worldX).length >= 7);
    assert(doors.filter(b => b.pos[0] > worldX).length >= 7);
    assert(doors.some(b => b.shopName === 'Nell’s Corner'));
    assert(doors.some(b => b.shopName === 'The Washhouse'));
    assert.equal(new Set(doors.map(b => b.shopName)).size, doors.length);
    for (const b of doors) {
      assert(b.storeys >= 3 && b.storeys <= 5 && b.shop && b.shopName && b.upperUse, b.name);
      assert.equal(b.join[0], worldX);
      assert.equal(b.door[1], b.join[1]);
      assert(Math.abs(b.door[0] - worldX) < Math.abs(b.pos[0] - worldX), b.name + ' faces the promenade');
      assert(corners(b.box).every(p => pointInTown(p, town)), b.name);
      assert(!town.buildings.some(other => other !== b && overlap(b.box, other.box)), b.name);
      for (const destination of destinations(town)) {
        const path = shortestPath(town, b.node, destination.node);
        assert(path.length > 2);
        assert.equal(path.at(-1), destination.node);
      }
    }
    for (const tree of town.trees) assert(!overlap(modelBox(tree), town.sunbeamReservation));
    for (const scene of town.catalogScenes) assert(!overlap(scene.box, town.sunbeamReservation));
  }
});

test('the real sidewalk graph takes residents along the mall and from every frontage into town', () => {
  const town = compileWorld(catalog, 831);
  const graph = buildPedestrianGraph(town);
  const promenade = walkBetween(graph, northEnd, southEnd);
  assert(promenade.length > 2);
  assert.deepEqual(promenade[0].pos, northEnd);
  assert.deepEqual(promenade.at(-1).pos, southEnd);
  assert(promenade.every(step => step.pos[0] === worldX && !step.cross));
  for (const home of mallDoors(town)) {
    for (const target of destinations(town)) {
      const end = town.nodes[target.node];
      const route = walkBetween(graph, home.door, end);
      assert(route.length > 2, home.name + ' to ' + target.name);
      assert(samePoint(route[0].pos, home.door));
      assert(samePoint(route.at(-1).pos, end));
      assert(route.some(step => samePoint(step.pos, home.join)));
    }
  }
  for (const scene of town.catalogScenes) assert(!overlap(scene.box, town.sunbeamReservation));
  for (const tree of town.landscape.models.filter(p => isTree(p.asset))) {
    assert(!overlap(modelBox(tree), town.sunbeamReservation));
  }
});

test('mall furnishings and seated activity leave the middle and each doorstep clear', () => {
  const town = compileAstra(catalog);
  const walk = { min: [worldX - clearWidth / 2, north], max: [worldX + clearWidth / 2, south] };
  const doors = town.roads.filter(r => r.owner?.startsWith('sunbeam-')).map(r => pathBox(r.a, r.b, r.width / 2));
  const paved = { min: [worldX - pavedWidth / 2, north], max: [worldX + pavedWidth / 2, south] };
  const worldBox = box => moveBox(box, DISTRICT_OFFSETS.sunbeam);
  const furnitureBox = ({ pos, size }) => worldBox({
    min: pos.map((v, i) => v - size[i] / 2),
    max: pos.map((v, i) => v + size[i] / 2),
  });
  const fixtures = SUNBEAM_FURNISHINGS.map(furnitureBox);
  const chess = SUNBEAM_FURNISHINGS.flatMap((f, i) => f.kind === 'chess' ? [i] : []);
  assert(chess.length >= 2);
  assert(sunbeamDaytime(10.4));
  for (const table of chess) {
    const people = SUNBEAM_AMBIENT.filter(p => p.table === table && p.activity === 'chess' && p.seated);
    assert.equal(people.length, 2);
    assert.equal(new Set(people.map(p => p.seat)).size, 2);
    assert(people.every(p => catalog.has('townsfolk-' + p.role)));
  }
  for (const kind of ['cafe', 'kiosk', 'performer', 'tree-planter', 'lamp', 'bench']) {
    assert(SUNBEAM_FURNISHINGS.some(f => f.kind === kind), kind);
  }
  for (const activity of ['window-shopping', 'stroll', 'performer']) {
    assert(SUNBEAM_AMBIENT.some(p => p.activity === activity), activity);
  }
  const stationary = SUNBEAM_AMBIENT.filter(p => p.activity !== 'stroll')
    .map(({ pos }) => worldBox(pathBox(pos, pos, .35)));
  for (const box of fixtures.concat(stationary)) {
    assert(corners(box).every(p => p.every((v, i) => v >= paved.min[i] && v <= paved.max[i])));
    assert(!overlap(box, walk), JSON.stringify(box));
    assert(!doors.some(door => overlap(box, door)), JSON.stringify(box));
  }
  fixtures.forEach((box, i) => assert(!fixtures.slice(i + 1).some(other => overlap(box, other)), JSON.stringify(box)));
});

test('all eight named neighbours keep their unique home and owned character role', () => {
  const town = compileAstra(catalog);
  assert.equal(new Set(SUNBEAM_RESIDENTS.map(p => p.name)).size, 8);
  assert.equal(new Set(SUNBEAM_RESIDENTS.map(p => p.home)).size, 8);
  for (const p of SUNBEAM_RESIDENTS) {
    assert(town.buildings.find(b => b.key === 'sunbeam-' + p.home));
    assert(catalog.has('townsfolk-' + p.model));
  }
});
