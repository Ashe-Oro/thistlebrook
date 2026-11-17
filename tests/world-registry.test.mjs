import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { compileTown } from '../src/compiler/compile.js';
import { buildWalkGraph, route, blockers, blocked } from '../src/life/graph.js';
import { buildWorldRegistry, findPlace, getPlace, interactionPoints, nearestEntryNode,
  connectRegistryToGraph, registryFailures, resolvePlace, isOpen } from '../src/world/registry.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)));
const catalog = resolveAll(read('src/catalog/bounds.json'));
const large = read('specs/large.json'), hamlet = read('specs/hamlet.json');
const compiled = new Map();

for (const seed of [1, 7, 1234, 19]) {
  test(`world-registry: large seed ${seed}, explicit registry and life`, () => {
    for (const flags of [{ registry: true }, { life: true }]) {
      const town = compileTown(large, catalog, { seed, ...flags });
      assert.equal(town.ok, true, JSON.stringify(town.report.checks.filter(c => !c.ok)));
      assert.equal(town.registry.places.length, town.instances.filter(i => i.kind !== 'villager').length);
      const { registry } = town, graph = registry.graph;
      assert.deepEqual(registryFailures(registry, graph, town), []);
      assert.equal(new Set(registry.places.map(p => p.id)).size, registry.places.length);
      for (const p of registry.places.filter(p => p.building)) {
        const entry = nearestEntryNode(registry, graph, p.id);
        assert(entry >= 0, p.id);
        assert.equal(route(graph, graph.connected[0], entry).at(-1), entry);
        assert(Array.isArray(p.occupants) && p.hours && p.capabilities.length);
      }
      const originalCount = graph.nodes.length;
      connectRegistryToGraph(registry, graph, town, catalog);
      assert.equal(graph.nodes.length, originalCount, 'connection is idempotent');
      if (flags.life) {
        assert.equal(town.life.graph, registry.graph);
        for (const npc of town.instances.filter(i => i.kind === 'villager')) {
          assert(registry.places.some(p => p.lot === npc.home.lot && p.occupants.includes(npc.id)));
          assert(registry.places.some(p => p.lot === npc.workplace.lot && p.occupants.includes(npc.id)));
        }
        // Check every newly added spur node against the walker's architecture blockers.
        const solids = blockers(town, catalog);
        assert(graph.nodes.filter(n => n.street === 'registry-entry').every(n => !blocked(n.pos, solids, .30)));
        compiled.set(seed, town);
      }
    }
  });
}

test('world-registry: queries, civic names and tool resolution', () => {
  const { registry } = compiled.get(1234);
  const smithy = resolvePlace(registry, { type: 'smithy' });
  assert.equal(smithy.name, "Bram's Workshop");
  assert.equal(resolvePlace(registry, smithy.id).id, smithy.id);
  assert.equal(resolvePlace(registry, "bram's workshop").id, smithy.id);
  assert.equal(resolvePlace(registry, 'smithy').id, smithy.id);
  assert.equal(resolvePlace(registry, 'does not exist'), null);
  assert.equal(getPlace(registry, 'missing'), null);
  assert.deepEqual(interactionPoints(registry, 'missing'), []);
  assert.equal(nearestEntryNode(registry, registry.graph, 'missing'), -1);
  assert(interactionPoints(registry, smithy.id, 'workstation').length);
  assert(interactionPoints(registry, smithy.id, 'door').length);
  assert(findPlace(registry, { ownerId: 'townsfolk-blacksmith' }).some(p => p.id === smithy.id));
  assert(findPlace(registry, { type: 'smithy', capability: 'work', openAt: 8, name: 'Bram' }).length);
  assert.equal(findPlace(registry, { type: 'smithy', openAt: 23 }).length, 0);
  const near = [58, 18], results = findPlace(registry, { capability: 'buy', near });
  const dist = p => Math.hypot(p.pos[0] - near[0], p.pos[1] - near[1]);
  assert(results.every((p, i) => i === 0 || dist(p) >= dist(results[i - 1])));
  assert(results.every(p => p.entryNode === nearestEntryNode(registry, registry.graph, p.id)));
  assert(results.some(p => p.entryNode >= 0));
  for (const [id, name] of Object.entries({ 'cv-bakery': 'The Flour & Fern', 'cv-tavern': 'The Copper Kettle', 'cv-store': 'Willowmere Provisions' })) {
    assert(registry.places.filter(p => p.catalogId === id).every(p => p.name === name));
  }
  assert(isOpen({ open: 20, close: 4 }, 23));
  assert(isOpen({ open: 20, close: 4 }, 2));
  assert(!isOpen({ open: 20, close: 4 }, 4));
  assert(isOpen({ open: 0, close: 24 }, 24));
  assert(isOpen({ open: 7, close: 18 }, 31));
});

test('world-registry: JSON round trip and rebuilding navigation', () => {
  const original = compiled.get(7);
  const town = JSON.parse(JSON.stringify(original));
  assert.deepEqual(registryFailures(town.registry, town.registry.graph, town), []);
  const graph = buildWalkGraph(town, catalog);
  assert.equal(town.registry.graph, graph, 'graph hook reconnects registry after rebuild');
  assert.deepEqual(registryFailures(town.registry, graph, town), []);
  assert(findPlace(town.registry, { type: 'home' }).every(p => p.entryNode >= 0));
});

test('world-registry: negative validation for missing metadata, coverage and reachability', () => {
  const original = compiled.get(1);
  const mutations = [
    r => { r.places[0].id = r.places[1].id; },
    r => { delete r.places.find(p => p.building).occupants; },
    r => { delete r.places.find(p => p.building).owner; },
    r => { delete r.places.find(p => p.building).hours; },
    r => { r.places.find(p => p.building).capabilities = []; },
    r => { r.places.find(p => p.building).points = []; },
    r => { r.places.find(p => p.building).points = null; },
    r => { r.places.find(p => p.building).points[0].facing = [0, 0]; },
    r => { r.places.find(p => p.building).points[0].node = -1; },
    r => { r.places.find(p => p.building).points[0].pos = [999, 999]; },
    r => { r.places.splice(r.places.findIndex(p => p.building), 1); },
    r => { r.places.find(p => p.building).building = false; },
    r => { r.graph.edges = r.graph.edges.map(() => []); },
  ];
  for (const mutate of mutations) {
    const registry = JSON.parse(JSON.stringify(original.registry));
    mutate(registry);
    assert(registryFailures(registry, registry.graph, original).length, mutate.toString());
  }
  assert(registryFailures(null, null).length);
  assert(registryFailures(original.registry, null, original).length);
});

test('world-registry: automatic new assets, transformed anchors, repeated homes, sealed entry negative', () => {
  const entry = { id: 'future-house', name: 'New Cottage', tags: { category: 'house', style: [] },
    footprint: { min: [-1, -1], max: [1, 1] }, door: { pos: [0, 0, 1], facing: [0, 0, 1] },
    pathSnaps: [{ pos: [0, 0, 1.5], dir: [0, 0, 1] }],
    place: { interactionPoints: [
      { kind: 'seat', pos: [-.5, 0], facing: [0, 1] },
      { kind: 'seat', pos: [.5, 0], facing: [0, 1] },
    ] } };
  const c = new Map([[entry.id, entry]]);
  const town = { instances: [
    { id: entry.id, kind: 'house', lot: 1, pos: [10, 20], rotY: Math.PI / 2, scale: 2 },
    { id: entry.id, kind: 'house', lot: 2, pos: [30, 20], rotY: 0, scale: 1 },
  ] };
  const registry = buildWorldRegistry(town, c);
  assert.notEqual(registry.places[0].id, registry.places[1].id);
  assert(registry.places.every(p => p.type === 'home' && p.capabilities.includes('sleep')));
  const door = interactionPoints(registry, registry.places[0].id, 'door')[0];
  assert(Math.abs(door.pos[0] - 12) < 1e-9 && Math.abs(door.pos[1] - 20) < 1e-9);
  assert(Math.abs(door.facing[0] - 1) < 1e-9);
  assert.equal(interactionPoints(registry, registry.places[0].id, 'seat').length, 2);
  // Four solid fence strips enclose the first building: no fabricated shortcut.
  const fence = { id: 'fence', footprint: { min: [-5, -.2], max: [5, .2] } };
  c.set('fence', fence);
  for (const [pos, rotY] of [[[10, 15], 0], [[10, 25], 0], [[5, 20], Math.PI / 2], [[15, 20], Math.PI / 2]]) {
    town.instances.push({ id: 'fence', kind: 'fence', pos, rotY, scale: 1 });
  }
  const graph = { nodes: [{ pos: [0, 0] }], edges: [[]], connected: [0] };
  connectRegistryToGraph(registry, graph, town, c);
  assert.equal(nearestEntryNode(registry, graph, registry.places[0].id), -1);
  assert(registryFailures(registry, graph).some(f => f.placeId === registry.places[0].id));
});

test('world-registry: opt-in hamlet, input purity, default JSON unchanged', () => {
  const snapshot = JSON.stringify([...catalog]);
  const specSnapshot = JSON.stringify(hamlet);
  const plain = compileTown(hamlet, catalog, { seed: 7 });
  const registry = compileTown(hamlet, catalog, { seed: 7, registry: true });
  const life = compileTown(hamlet, catalog, { seed: 7, life: true });
  assert.equal(registry.ok, true);
  assert.equal(life.ok, true);
  assert.deepEqual(life, plain, 'life remains a no-op for hamlet, as required by parity');
  assert(!('registry' in plain));
  assert(!plain.report.checks.some(c => c.name === 'world-registry'));
  assert.deepEqual(plain.instances, registry.instances);
  assert.equal(JSON.stringify(compileTown(hamlet, catalog, { seed: 7 })), JSON.stringify(plain));
  assert.equal(JSON.stringify([...catalog]), snapshot);
  assert.equal(JSON.stringify(hamlet), specSnapshot);
});

test('world-registry: compiler reports invalid generated metadata only on opt-in paths', () => {
  const changed = new Map(catalog);
  for (const [id, entry] of changed) {
    if (entry.tags?.category === 'house') changed.set(id, { ...entry, place: { capabilities: [] } });
  }
  for (const flags of [{ registry: true }, { life: true }]) {
    const town = compileTown(large, changed, { seed: 1, ...flags });
    assert.equal(town.ok, false);
    assert.equal(town.report.ok, false);
    const check = town.report.checks.find(c => c.name === 'world-registry');
    assert.equal(check.ok, false);
    assert(check.failures.some(f => f.msg === 'Missing capabilities'));
  }
  const plain = compileTown(large, changed, { seed: 1 });
  assert.equal(plain.ok, true);
  assert(!('registry' in plain));
});

test('world-registry: write compact compile evidence when requested', () => {
  if (!process.env.WORLD_REGISTRY_DUMP) return;
  const town = compiled.get(1234);
  mkdirSync(new URL('../out/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../out/registry-1234.json', import.meta.url), JSON.stringify({ seed: town.seed, ok: town.ok,
    check: town.report.checks.find(c => c.name === 'world-registry'),
    places: town.registry.places.map(p => ({ ...p, entryNode: nearestEntryNode(town.registry, town.registry.graph, p.id) })),
    graph: { nodes: town.registry.graph.nodes.length, connected: town.registry.graph.connected.length },
  }, null, 2) + '\n');
});
