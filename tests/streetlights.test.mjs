// Streetlights (docs/specs/STREETLIGHTS.md): every placed lamp post lights at dusk.
//
// Root cause. Night glow (world.js bulb + ground pool, lighting.js halo) was
// attached only to `town.props` entries with id 'cv-streetlamp' — 6 posts on
// seed 831. The street plan places 112 more kerbside lamps (86 cozy, 23 City,
// 3 Suburban) that traffic.js instanced with no glow at all; these are the dark
// posts in Ashe's Market Square shot. Merrymead Park's 5 posts had no glow,
// Sunbeam's 3 had PointLights but no lantern head, Civic Green's 7, the Works
// yard's 5 and the 8 platform lamps had heads but no pool, and Funfair Parking
// lit a pool under only one lamp in three. The Suburban lamp only glows inside
// Maple Hollow's own shader, so the street-plan copy had no emissive either.
// Not a cause: the legacy ?life=1 path caps PointLights at 10, but every lamp
// there keeps its lens and (lighting-polish.js) its own ground pool; the cap
// stays for FPS. No pool limit or distance culling was involved.
//
// Fix. src/astra/lamp-posts.js lists every post once with its glow owner;
// src/astra/lamp-glow.js gives the unlit ones an instanced head, pool and
// halo (three draws per caller, no PointLights).
//
// Brightness (night = 1), old -> new, all ~+40% (src/astra/lamp-look.js):
//   ground pool opacity .60 -> .84 · lantern halo alpha .27 -> .38
//   Maple Hollow glass emissive 1.6 -> 2.2 · its pools .80 -> 1.12
//   kit lamp pools (midway, coast) .48 -> .67 · quay PointLights 2.5 -> 3.5
//   Sunbeam PointLights 5 -> 7 · ?life=1 lamp light 16 -> 22, pools .80 -> 1.12
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {createTrafficSimulation} from '../src/astra/traffic-simulation.js';
import {planStreets} from '../src/astra/street-plan.js';
import {lampPosts, glowLayout, LAMP_FIXTURES, LAMP_LOOK, WORKS_LAMPS, SUNBEAM_LAMPS, PARK_LAMPS, CIVIC_LAMPS, QUAY_LAMPS} from '../src/astra/lamp-posts.js';
import {buildLampGlow, setLampNight} from '../src/astra/lamp-glow.js';
import {LAMPS as FAIR_LOT_LAMPS} from '../src/astra/fair-lot-plan.js';

const town = compileWorld(resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url)))), 831);
const streetPlan = planStreets(town, createTrafficSimulation(town));
const posts = lampPosts(town, {streetPlan});
const of = (source) => posts.filter((p) => p.source === source);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('every lamp-post source is registered once, in full', () => {
  const expected = {
    props: town.props.filter((p) => p.id === 'cv-streetlamp').length,
    'street-plan': streetPlan.items.filter((i) => i.kind === 'lamp').length,
    works: WORKS_LAMPS.length, sunbeam: SUNBEAM_LAMPS.length, civic: CIVIC_LAMPS.length,
    park: PARK_LAMPS.length, quay: QUAY_LAMPS.length, 'fair-lot': FAIR_LOT_LAMPS.length,
    railway: town.railway.stations.flatMap((s) => s.furniture.filter((f) => f.light)).length,
    'maple-hollow': town.mapleHollow.props.filter((p) => p.model === 'streetlamp').length,
    midway: town.modelPlacements.filter((p) => p.asset === 'fairground/globe_lamppost').length,
  };
  for (const [source, n] of Object.entries(expected)) { assert(n > 0, `${source} has lamps`); assert.equal(of(source).length, n, source); }
  assert.equal(posts.length, Object.values(expected).reduce((a, b) => a + b));
  assert(of('street-plan').length >= 100, 'the kerbside lamps are the bulk of the town');
  assert.equal(new Set(posts.map((p) => p.key)).size, posts.length, 'keys are unique');
  // The park's posts are the registry's fair streetlamps, one for one.
  const fair = town.modelPlacements.filter((p) => p.asset === 'cv-streetlamp' && p.district === 'fair');
  assert.equal(fair.length, of('park').length);
  for (const p of fair) assert.equal(of('park').filter((q) => dist(q.pos, p.pos) < 1e-6).length, 1, `park lamp at ${p.pos}`);
});

test('no orphan or duplicate posts: each post stands alone and has a fixture and a glow owner', () => {
  const owners = new Set(['prop-glow', 'lamp-glow', 'maple-hollow', 'midway', 'quay']);
  for (const p of posts) {
    assert(owners.has(p.glow), `${p.key} glow ${p.glow}`);
    assert(LAMP_FIXTURES[p.model], `${p.key} fixture ${p.model}`);
    assert(p.pos.every(Number.isFinite) && p.head.every(Number.isFinite), p.key);
    assert(p.head[1] - (p.ground ?? 0) > 1.8, `${p.key} head height ${p.head[1]}`);
    assert(dist([p.head[0], p.head[2]], p.pos) <= 1.6 * (p.scale || 1), `${p.key} head stays over its post`);
  }
  for (let i = 0; i < posts.length; i++) for (let j = i + 1; j < posts.length; j++)
    assert(dist(posts[i].pos, posts[j].pos) > .25, `${posts[i].key} and ${posts[j].key} are the same post`);
});

test('every street-plan lamp (kind === "lamp") has exactly one glow entry', () => {
  const lamps = streetPlan.items.filter((i) => i.kind === 'lamp'), glow = of('street-plan');
  for (const it of lamps) {
    const hits = glow.filter((p) => dist(p.pos, it.pos) < 1e-9);
    assert.equal(hits.length, 1, `${it.model} at ${it.pos}`);
    assert.equal(hits[0].glow, 'lamp-glow');
    assert(hits[0].heads, 'kerbside lamps get a lit head (no model emissive outside Maple Hollow)');
  }
  for (const p of glow) assert(lamps.some((it) => dist(p.pos, it.pos) < 1e-9), `orphan glow ${p.key}`);
});

test('the shared glow is 1:1 with its posts: one head, pool and halo each', () => {
  for (const source of [...new Set(posts.filter((p) => p.glow === 'lamp-glow').map((p) => p.source))]) {
    const list = of(source), glow = buildLampGlow(list, {name: source});
    assert.equal(glow.pools.count, list.length, `${source} pools`);
    assert.equal(glow.halos.count, list.length, `${source} halos`);
    assert.deepEqual(glow.pools.userData.lampKeys, list.map((p) => p.key));
    assert.deepEqual(glow.halos.userData.lampKeys, list.map((p) => p.key));
    const withHeads = list.filter((p) => p.heads);
    assert.equal(glow.heads?.count ?? 0, withHeads.length, `${source} heads`);
    for (const [i, l] of glowLayout(list).entries()) {
      assert(dist([l.pool.center[0], l.pool.center[2]], list[i].pos) < 1.5, `${list[i].key} pool under its post`);
      assert(l.pool.radius >= 2, `${list[i].key} pool radius`);
    }
  }
  // Frame offsets move the layout without changing the 1:1 mapping.
  const works = of('works'), local = glowLayout(works, {offset: [0, -70]});
  works.forEach((p, i) => assert(Math.abs(local[i].halo[2] - (p.head[2] + 70)) < 1e-9));
});

test('legacy prop glow: one registered "light and glow" effect per town.props lamp', () => {
  const effects = town.procedural.filter((p) => /^Streetlamp \d+ light and glow$/.test(p.name));
  assert.equal(effects.length, of('props').length);
  for (const p of of('props')) assert.equal(effects.filter((e) => dist(e.pos, p.pos) < 1e-9).length, 1, p.key);
});

test('night drives the shared glow; brightness rises ~30–50% everywhere', () => {
  const glow = buildLampGlow(of('park'));
  setLampNight(0); assert.equal(glow.pools.material.opacity, 0); assert.equal(glow.heads.material.visible, false);
  setLampNight(1); assert.equal(glow.pools.material.opacity, LAMP_LOOK.pool); assert.equal(glow.heads.material.visible, true);
  assert.equal(glow.halos.material.uniforms.night.value, 1);
  for (const key of Object.keys(LAMP_LOOK).filter((k) => k.endsWith('Before'))) {
    const now = LAMP_LOOK[key.slice(0, -6)], ratio = now / LAMP_LOOK[key];
    assert(ratio >= 1.3 && ratio <= 1.5, `${key.slice(0, -6)} ×${ratio.toFixed(2)}`);
  }
  assert(LAMP_LOOK.pool <= .9 && LAMP_LOOK.halo <= .45, 'pools and halos stay translucent (no blown highlights)');
});

test('every module that places a lamp post reads its spot from the registry and builds its glow', () => {
  const wiring = {
    'astra/traffic.js': ["source==='street-plan'"],
    'astra/work-district.js': ['WORKS_LAMPS', "source==='works'"],
    'astra/sunbeam.js': ['SUNBEAM_LAMPS', "source==='sunbeam'"],
    'astra/civic-quarter.js': ['CIVIC_LAMPS', "source==='civic'"],
    'astra/fairground.js': ['PARK_LAMPS', "source==='park'"],
    'astra/railway.js': ["p.source === 'railway'"],
    'astra/fair-lot.js': ["p.source === 'fair-lot'"],
    'astra/harbor.js': ['QUAY_LAMPS'],
  };
  for (const [file, needles] of Object.entries(wiring)) for (const n of needles) assert(src(file).includes(n), `${file} uses ${n}`);
  assert(!/LAMPS\.filter\(\(_, i\) => i % 3/.test(src('astra/fair-lot.js')), 'fair-lot lights every lamp');
  // Hand-written cv-streetlamp placements only where the registry knows them.
  const allowed = /^(compiler\/(astra|districts|checks)\.js|astra\/(street-plan|lighting|world|weather|registry\/placements|sunbeam|work-district|fairground)\.js|life\/daynight\.js)$/;
  for (const file of ['astra/world.js', 'astra/sunbeam.js', 'astra/work-district.js', 'astra/fairground.js', 'astra/civic-quarter.js', 'astra/harbor.js', 'astra/coast.js', 'astra/themepark-midway.js'])
    if (src(file).includes("'cv-streetlamp'")) assert(allowed.test(file), `${file} places a cozy lamp outside the registry`);
  // Midway and coast decals are flagged as lamp pools; ?life=1 keeps a lens and pool per lamp.
  assert(src('astra/themepark-midway.js').includes("kit.pool(x,z,6,'rgba(255,214,140,.95)',true)"), 'midway lamp pools');
  assert(src('astra/coast.js').includes("kit.pool(109,z-4,3,'#ffe5a3',true)"), 'coast lamp pools');
  assert(/base\.lamps\.map\(/.test(src('life/lighting-polish.js')), 'one ?life=1 pool per lamp');
  assert(/if\(lamps\.length<10\)scene\.add\(light\);[\s\S]*lamps\.push\(\{light,lens\}\)/.test(src('life/daynight.js')), 'every ?life=1 lamp keeps its lens past the light cap');
});
