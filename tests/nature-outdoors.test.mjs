// OWNER: opus-nature lane. Spec: docs/specs/OPUS-NATURE.md. Rule: TOWN-30.
// Thistlebrook's natural edges use the owned Nature pack: Pinewood species
// stands, granite, glades, wildlife and waymarks; Willow River and Stillwater
// Outflow banks; Stillwater Lake's shore; Merrymead Park's west hedgerow and
// the open meadow's granite. Every placement keeps paths clear and sits on
// its own surface, and the models are registered, instanced and on budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {natureEdgeFindings, footprintRadius, isTree} from '../src/compiler/nature-edges.js';
import {TOWN_RULE, ROAD_RULE} from '../src/compiler/town-rules.js';
import {LOOKOUT, GLADES, TRAIL} from '../src/compiler/woods.js';
import {LAKE} from '../src/astra/outskirts-layout.js';
import {CATALOG} from '../src/catalog/catalog.js';

const BOUNDS = JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url)));
const catalog = resolveAll(BOUNDS);
const SEEDS = [831, 0, 42];
const worlds = new Map(SEEDS.map((s) => [s, compileWorld(catalog, s)]));
const town = worlds.get(831);
const nature = (t) => [...t.landscape.models.filter((m) => m.nature), ...t.water.dressing];
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');

test(`${TOWN_RULE.natureEdges}: every Nature placement keeps paths clear and sits on its surface`, () => {
  for (const [seed, t] of worlds) {
    const findings = natureEdgeFindings(t);
    assert.deepEqual(findings.map((f) => f.detail), [], `seed ${seed}`);
    assert(nature(t).length > 220, `seed ${seed}: only ${nature(t).length} Nature placements`);
    for (const m of nature(t)) assert(['ground', 'ridge', 'bank', 'sand', 'water'].includes(m.surface), `${m.asset} records its surface`);
  }
});

test(`${TOWN_RULE.natureEdges}: injected faults are caught`, () => {
  const t = structuredClone(town), models = t.landscape.models;
  const trail = t.woods.trails[0].points[20], road = t.roads.find((r) => !r.centerline && r.kind === 'trail' && r.owner === 'outskirts');
  const lake = [LAKE.x, LAKE.z];
  const base = {nature: 'woods', rot: 0};
  models.push({...base, asset: 'nat-fern', pos: [trail[0] + .3, trail[2]], scale: 2, y: trail[1] - .05, surface: 'ground'});
  models.push({...base, nature: 'lake', asset: 'nat-cattails', pos: lake, scale: 1.2, y: .028, surface: 'sand'});
  models.push({...base, nature: 'meadow', asset: 'nat-lichen-granite-boulder', pos: [150, 160], scale: 1.2, y: .4, surface: 'ground'});
  models.push({...base, nature: 'river', asset: 'nat-mallard-duck', pos: [150, 170], scale: 1.6, y: -.09, surface: 'water'});
  const mid = [(road.a[0] + road.b[0]) / 2, (road.a[1] + road.b[1]) / 2], side = road.width / 2 + footprintRadius('nat-oak', 1.4) - 1;
  const d = Math.hypot(road.b[0] - road.a[0], road.b[1] - road.a[1]), n = [-(road.b[1] - road.a[1]) / d, (road.b[0] - road.a[0]) / d];
  models.push({...base, nature: 'park', asset: 'nat-oak', pos: [mid[0] + n[0] * side, mid[1] + n[1] * side], scale: 1.4, y: -.06, surface: 'ground'});
  const found = natureEdgeFindings(t);
  const caught = (asset, category) => found.some((f) => f.category === category && f.detail.startsWith(asset));
  assert(caught('nat-fern', 'nature-on-path'), 'fern on a trail');
  assert(caught('nat-cattails', 'nature-off-surface'), 'cattail in the lake');
  assert(caught('nat-lichen-granite-boulder', 'nature-off-surface'), 'floating boulder');
  assert(caught('nat-mallard-duck', 'nature-off-surface'), 'duck on dry land');
  assert(caught('nat-oak', 'nature-on-path'), 'oak crown over a path');
  for (const f of found) assert.equal(ROAD_RULE[f.category], 'TOWN-30');
});

test('Pinewood: species stands, granite by the trails, dressed glades, wildlife and waymarks', () => {
  for (const [seed, t] of worlds) {
    const w = t.landscape.models.filter((m) => m.woods && m.nature === 'woods'), count = (a) => w.filter((m) => m.asset === a).length;
    for (const [a, min] of [['nat-pine', 6], ['nat-birch', 3], ['nat-oak', 4], ['nat-silver-snag', 8], ['nat-fern', 4], ['nat-trail-marker-post', 5], ['nat-park-info-board', 1]]) assert(count(a) >= min, `seed ${seed}: ${count(a)} ${a}`);
    assert(count('nat-lichen-granite-boulder') + count('nat-moss-cushion-rock') >= 25, `seed ${seed}: Nature granite`);
    // Stands are groupings, not confetti: each species sits where it belongs.
    const pond = GLADES.find((g) => g.id === 'pond');
    for (const m of w.filter((m) => m.natureRole === 'lookout-pines')) assert(Math.hypot(m.pos[0] - LOOKOUT.pos[0], m.pos[1] - LOOKOUT.pos[1]) < 24);
    for (const m of w.filter((m) => m.natureRole === 'pond-birches')) assert(Math.hypot(m.pos[0] - pond.center[0], m.pos[1] - pond.center[1]) < pond.r + 12);
    for (const m of w.filter((m) => m.asset === 'nat-silver-snag')) assert.equal(m.surface, 'ridge', 'snags stand on the ridge');
    const wild = w.filter((m) => ['nat-deer', 'nat-fox', 'nat-rabbit', 'nat-mallard-duck', 'nat-grey-heron'].includes(m.asset));
    assert(new Set(wild.map((m) => m.asset)).size >= 4, `seed ${seed}: woods wildlife`);
    // The grok-woods mix still holds: the forest is mixed pines and broadleaf.
    assert(t.landscape.models.filter((m) => m.woods === 'tree').length > 500);
  }
});

test('riverbanks, lake shore, Merrymead edge and meadow granite', () => {
  for (const [seed, t] of worlds) {
    const by = (zone, asset) => nature(t).filter((m) => m.nature === zone && (!asset || m.asset === asset)).length;
    assert(by('river', 'nat-cattails') >= 15 && by('river', 'nat-willow') >= 3, `seed ${seed}: river cattails and willows`);
    assert(by('river', 'nat-river-stones') + by('river', 'nat-shore-rock-shelf') >= 6, `seed ${seed}: river stones`);
    assert(by('lake', 'nat-cattails') >= 15 && by('lake', 'nat-lily-pad-patch') >= 3, `seed ${seed}: lake reeds and lilies`);
    for (const zone of ['river', 'lake']) assert(nature(t).some((m) => m.nature === zone && ['nat-grey-heron', 'nat-mallard-duck'].includes(m.asset)), `seed ${seed}: ${zone} waterfowl`);
    assert(by('park') >= 8 && nature(t).some((m) => m.nature === 'park' && isTree(m.asset)), `seed ${seed}: Merrymead hedgerow`);
    assert(by('meadow') >= 20 && !t.landscape.models.some((m) => !m.woods && m.asset === 'cv-rock-boulder'), `seed ${seed}: meadow boulders are Nature granite`);
    // Both reaches are dressed, not just one.
    for (const reach of ['west', 'outflow']) {
      const pts = t.water.reaches.find((r) => r.id === reach).points;
      assert(nature(t).some((m) => m.nature === 'river' && pts.some((p) => Math.hypot(p[0] - m.pos[0], p[1] - m.pos[1]) < p[3] + 6)), `seed ${seed}: ${reach} banks`);
    }
  }
  // Stillwater's pine stand replaced kit pines in place.
  const pines = town.outskirts.trees.filter((t) => t.id === 'nat-pine');
  assert(pines.length >= 4 && pines.every((t) => t.pos[0] < -50));
  // The box reeds and blob rocks they replace are gone from the renderers.
  assert(!/Reeds on the new banks/.test(src('astra/water.js')), 'water.js box reeds');
  assert(!/LAKE\.rx\+1\.4\)\*Math\.cos\(a\)/.test(src('astra/outskirts.js')), 'outskirts.js lake-ring reeds and rocks');
});

test('Nature models are registered pack entries, instanced and on budget', () => {
  const used = new Set(SEEDS.flatMap((s) => nature(worlds.get(s)).map((m) => m.asset)));
  for (const s of SEEDS) for (const t of worlds.get(s).outskirts.trees) if (t.id.startsWith('nat-')) used.add(t.id);
  const tris = (t) => nature(t).reduce((n, m) => n + BOUNDS[m.asset].tris, 0) + t.outskirts.trees.filter((x) => x.id === 'nat-pine').length * BOUNDS['nat-pine'].tris;
  for (const id of used) {
    const e = CATALOG.find((c) => c.id === id);
    assert(e && e.path === `licensed/nature/${id.slice(4).replaceAll('-', '_')}.glb`, `${id} is a Nature pack entry`);
    assert(BOUNDS[id]?.tris > 0, `${id} has measured bounds`);
    const file = new URL('../public/' + e.path, import.meta.url);
    if (existsSync(new URL('../public/licensed/nature/', import.meta.url))) assert(existsSync(file), `${e.path} is copied into public/licensed/nature`);
  }
  // New entries stay out of every legacy scatter pool.
  for (const e of CATALOG.filter((c) => c.tags.style.includes('nature-edge'))) assert(!e.tags.style.some((s) => ['sparse', 'feature-tree', 'v3-kit', 'yard-dressing', 'street-dressing'].includes(s)), e.id);
  // Thin blades keep a fine ink line so they read green.
  for (const id of ['nat-cattails', 'nat-fern', 'nat-tall-grass']) assert(catalog.get(id).outline < .035, id);
  assert(used.size <= 26, `${used.size} Nature models in use`);
  for (const [seed, t] of worlds) assert(tris(t) < 2.8e6, `seed ${seed}: ${(tris(t) / 1e6).toFixed(2)} M source triangles of Nature dressing`);
  // One instanced batch per asset part (landscape.js), and every placement has a registry record.
  assert(/new THREE\.InstancedMesh\(part\.geometry,part\.material,members\.length\)/.test(src('astra/landscape.js')));
  const ids = new Set(town.registry.places.map((p) => p.id));
  for (const m of nature(town)) assert(m.registryId && ids.has(m.registryId), `${m.asset} registry record`);
});

test(`${TOWN_RULE.natureEdges} is recorded in TOWN-RULES.md`, () => {
  assert.equal(TOWN_RULE.natureEdges, 'TOWN-30');
  const rules = readFileSync(new URL('../docs/TOWN-RULES.md', import.meta.url), 'utf8');
  const heading = [...rules.matchAll(/^## (TOWN-\d+) .+\n\n(\d{4}-\d{2}-\d{2})\n\n> (.+)\n\n[\s\S]+?(?=\n## |$)/gm)].find(([, id]) => id === 'TOWN-30');
  assert(heading && heading[2] === '2026-11-20' && heading[0].includes('tests/nature-outdoors.test.mjs'));
  assert(/natureEdgeFindings/.test(readFileSync(new URL('../tools/audit-town-rules.mjs', import.meta.url), 'utf8')), 'the road audit runs the check');
});
