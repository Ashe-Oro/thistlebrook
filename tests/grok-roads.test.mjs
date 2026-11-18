// OWNER: grok-roads lane. Road layout and walk-network checks for seed 831.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import {walkBetween} from '../src/roads/pedestrian.js';
import {runAudit} from '../tools/audit-roads.mjs';

const open = (r, cats) => r.findings.filter((f) => f.status === 'open' && (!cats || cats.includes(f.category)));

test('seed 831 road audit is clean: no overlaps, duplicates, stubs or dead ends', async () => {
  const r = await runAudit({mutateGraph(graph) {
    const reference = [-174, -139];
    const arms = graph.crossings.filter(([a, b]) => {
      const [x, z] = graph.nodes[a].pos.map((v, i) => (v + graph.nodes[b].pos[i]) / 2);
      return Math.hypot(x - reference[0], z - reference[1]) < 8;
    });
    assert.equal(arms.length, 3, 'each regional leg has a zebra past the short centerline samples');
    for (const [a, b] of arms) {
      const route = walkBetween(graph, graph.nodes[a].pos, graph.nodes[b].pos);
      assert.deepEqual(route.at(-1), {pos: graph.nodes[b].pos, cross: true});
    }
  }});
  assert.deepEqual(open(r).map((f) => `${f.id} ${f.at} ${f.detail}`), []);
  assert(r.walkNodes > 1000 && r.crossings > 40, 'pedestrian network with crossings');
  for (const f of r.findings) assert(f.reason, `justified finding ${f.id} needs a reason`);
});

test('regional roads are one record per chain with one filleted centerline', async () => {
  const {town} = await runAudit();
  const links = town.roads.filter((x) => x.kind === 'world-link');
  assert(links.length >= 10);
  for (const l of links) {
    assert.equal(l.width, 5.6); assert(l.centerline.length >= 2);
    for (let i = 2; i < l.centerline.length; i++) { // no hairpins or reversals inside a chain
      const [a, b, c] = [l.centerline[i - 2], l.centerline[i - 1], l.centerline[i]];
      const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
      assert(u[0] * v[0] + u[1] * v[1] > 0, `reversal in chain ${l.regionalId} at ${b}`);
    }
  }
});

test('audit fails on a duplicate ribbon', async () => {
  const r = await runAudit({mutate: (town) => { const av = town.roads.find((x) => x.kind === 'avenue' && Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]) > 20); town.roads.push({...av, a: [av.a[0] + .4, av.a[1] + .4], b: [av.b[0] - .3, av.b[1] + .4]}); }});
  assert(open(r, ['overlap']).length > 0);
});

test('audit fails on a dead-end stub', async () => {
  const r = await runAudit({mutate: (town) => town.roads.push({a: [-144, -70], b: [-150, -70], width: 3, kind: 'avenue'})});
  assert(open(r, ['stub', 'dead-end']).some((f) => f.rule === TOWN_RULE.roads));
});

test(`${TOWN_RULE.crosswalks} rejects diagonal, disconnected and triangular crossings`, async () => {
  const r = await runAudit({mutateGraph(graph) {
    const [[a, b], [c]] = graph.crossings;
    graph.nodes[a].pos[0] += .8;
    graph.nodes[a].pos[1] += .6;
    for (const edge of graph.edges[b].filter((e) => !e.crossing)) {
      graph.edges[edge.to] = graph.edges[edge.to].filter((e) => e.to !== b);
    }
    graph.edges[b] = graph.edges[b].filter((e) => e.crossing);
    for (const [u, v] of [[a, c], [b, c]]) {
      graph.edges[u].push({to: v, cost: 5, crossing: true});
      graph.edges[v].push({to: u, cost: 5, crossing: true});
      graph.crossings.push([u, v]);
    }
  }});
  for (const category of ['diagonal-crosswalk', 'unconnected-crosswalk', 'triangle-crosswalk']) {
    assert(open(r, [category]).some((f) => f.rule === TOWN_RULE.crosswalks), category);
  }
  assert(open(r, ['sidewalk-dead-end']).some((f) => f.rule === TOWN_RULE.sidewalks));
});

test(`${TOWN_RULE.walking} and ${TOWN_RULE.crosswalks} reject an asphalt shortcut and zebra inside a junction`, async () => {
  const r = await runAudit({mutateGraph(graph) {
    const add = (pos) => {
      graph.nodes.push({pos, kind: 'kerb'});
      graph.edges.push([]);
      return graph.nodes.length - 1;
    };
    const a = add([-66, -18.05]), b = add([-66, -13.95]);
    graph.crossings.push([a, b]);
    graph.edges[a].push({to: b, crossing: true});
    graph.edges[b].push({to: a, crossing: true});
    const [u, v] = graph.crossings[0];
    graph.edges[u].find((e) => e.to === v).crossing = false;
    graph.edges[v].find((e) => e.to === u).crossing = false;
  }});
  assert(open(r, ['walk-on-road']).some((f) => f.rule === TOWN_RULE.walking));
  assert(open(r, ['junction-crosswalk']).some((f) => f.rule === TOWN_RULE.crosswalks));
});

test('town layout audit fails on buried props, orphan structures and cramped home lots', async () => {
  const r = await runAudit({mutate(town) {
    town.props[0].elevation = -.5;
    const bay = town.mapleHollow.bays[0];
    bay.center = town.mapleHollow.lots.find((l) => l.key === bay.lot).houseAt;
    town.catalogScenes.find((s) => s.id === 'stop-harbor').street = null;
    const homes = town.buildings.filter((b) => b.kind === 'home' && b.district === 'willowbank');
    homes[1].box = homes[0].box;
    homes[1].padHeight = 1;
    homes.forEach((b) => { b.id = homes[0].id; });
  }});
  for (const [category, rule] of [
    ['off-surface', TOWN_RULE.surface], ['parked-off-driveway', TOWN_RULE.surface], ['parked-on-lot', TOWN_RULE.surface], ['orphan-structure', TOWN_RULE.access],
    ['home-spacing', TOWN_RULE.homes], ['home-pad', TOWN_RULE.homes], ['home-variety', TOWN_RULE.homes],
  ]) assert(open(r, [category]).some((f) => f.rule === rule), category);
});

test('every machine-checked town rule records Ashe’s wording and a local date', () => {
  const rules = readFileSync(new URL('../docs/TOWN-RULES.md', import.meta.url), 'utf8');
  const headings = [...rules.matchAll(/^## (TOWN-\d+) .+\n\n(\d{4}-\d{2}-\d{2})\n\n> (.+)\n\n[\s\S]+?(?=\n## |$)/gm)];
  assert.deepEqual(headings.map(([, id]) => id), Object.values(TOWN_RULE));
});
