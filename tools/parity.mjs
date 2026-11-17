// Compare the actual loader/JSON/spec/compiler module graph through Vite with
// the CLI's fs/plain-Node path. No renderer, port, assets, or API keys needed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { compileTown, buildingSlots } from '../src/compiler/compile.js';
import { validateSpec } from '../src/compiler/spec.js';
import { math } from '../src/compiler/math.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => JSON.parse(readFileSync(new URL(path, new URL('../', import.meta.url)), 'utf8'));
const catalog = resolveAll(read('src/catalog/bounds.json'));
const spec = validateSpec(read('specs/hamlet.json'), catalog);
const json = (value) => JSON.stringify(value);
// The portable routines must still agree with native geometry to much less
// than any placement tolerance, including quadrants and axis boundaries.
for (let i = -1000; i <= 1000; i++) {
  const angle = i * Math.PI / 500;
  for (const name of ['sin', 'cos', 'atan']) {
    assert(Math.abs(math[name](angle) - Math[name](angle)) < 1e-14, `${name} accuracy at ${angle}`);
  }
  assert(Math.abs(math.atan2(i, 37) - Math.atan2(i, 37)) < 1e-14, 'atan2 accuracy');
  assert(Math.abs(math.atan2(i, -37) - Math.atan2(i, -37)) < 1e-14, 'atan2 negative-x accuracy');
  assert(Math.abs(math.asin(i / 1000) - Math.asin(i / 1000)) < 1e-14, 'asin accuracy');
  assert(Math.abs(math.tan(i / 1000) - Math.tan(i / 1000)) < 1e-14, 'tan accuracy');
  assert(Math.abs(math.hypot(i, 37, 9) - Math.hypot(i, 37, 9)) < 1e-12, 'hypot accuracy');
}
const largeSpec = validateSpec(read('specs/large.json'), catalog);
const largeSeeds = [1, 7, 19, 1234];
const largeExpected = new Map(largeSeeds.map(seed => [seed, json(compileTown(largeSpec, catalog, { seed }))]));
const variants = [{ life: true }, { life: true, district: 'edo' }, { district: 'edo' }, { season: 'autumn' }, { district: 'edo', season: 'autumn' }];
const variantExpected = variants.map(flags => json(compileTown(largeSpec, catalog, { seed: 1234, ...flags })));
const inputSnapshot = json([spec, [...catalog]]);
const seeds = [...Array.from({ length: 30 }, (_, i) => i + 1), 1234];
const expected = new Map(seeds.map((seed) => [seed, json(compileTown(spec, catalog, { seed }))]));

// Frozen before adding villagers: both default layouts remain byte-identical.
const preVillagers = read('tools/fixtures/pre-villagers-defaults.sha256.json');
for (const seed of [1, 7, 1234]) for (const [name, towns] of [['hamlet', expected], ['large', largeExpected]]) {
  assert.equal(createHash('sha256').update(towns.get(seed)).digest('hex'), preVillagers[name + seed], `${name} seed ${seed}: pre-villager layout`);
  assert.equal(JSON.parse(towns.get(seed)).instances.filter(i=>i.kind==='villager').length, 0);
}

// Frozen before expanding the catalog: catches default-pool / layout drift.
assert.equal(createHash('sha256').update(expected.get(1234)).digest('hex'), readFileSync(new URL('fixtures/hamlet-1234.sha256', import.meta.url), 'utf8').trim(), 'original hamlet seed 1234 must stay byte-identical');

// Regression: symmetric slots must keep their left-before-right tie order
// when translating the arc centre by a single floating-point rounding step.
const center = Math.atan2(-34, -30);
const arc = 100 * Math.PI / 180;
const slotOrder = (c) => buildingSlots(6, arc, arc, c).map((a) => Math.round((a - c) * 1e9));
assert.deepEqual(slotOrder(center), slotOrder(center * (1 + Number.EPSILON)));
assert(slotOrder(center)[0] < 0, 'symmetric centre slots prefer the lower angle');

for (const perturb of [false, true]) {
  let perturbApplied = false;
  // Vite 5 opens an HMR socket even with hmr:false. Give it an unlistened
  // HTTP server so middleware/SSR tests also work in restricted environments.
  const hmrServer = createHttpServer();
  const server = await createServer({
    root,
    server: { middlewareMode: true, hmr: { server: hmrServer }, watch: null },
    appType: 'custom',
    plugins: perturb ? [{
      name: 'parity-engine-rounding',
      enforce: 'pre',
      transform(code, id) {
        if (id === `${root}src/compiler/math.js`) {
          perturbApplied = true;
          // Simulate a native libm result differing by ~one ulp. Before the
          // fix this reproduced BOTH reported Chrome stats exactly (7/1234).
          return `const Math = Object.create(globalThis.Math);
            for (const name of ['sin', 'cos', 'tan', 'asin', 'atan', 'atan2', 'hypot']) {
              Math[name] = (...args) => globalThis.Math[name](...args) * (1 + Number.EPSILON);
            }
            ${code}`;
        }
      },
    }] : [],
  });
  try {
    const { RESOLVED } = await server.ssrLoadModule('/src/catalog/loader.js');
    const { default: hamlet } = await server.ssrLoadModule('/specs/hamlet.json');
    const viteSpec = await server.ssrLoadModule('/src/compiler/spec.js');
    const viteCompiler = await server.ssrLoadModule('/src/compiler/compile.js');
    if (perturb) assert(perturbApplied, 'engine rounding simulation must be applied');
    const browserSpec = viteSpec.validateSpec(hamlet, RESOLVED);
    assert.equal(json([...RESOLVED]), json([...catalog]), 'resolved catalog parity');
    assert.equal(json(browserSpec), json(spec), 'validated spec parity');
    const snapshot = json([hamlet, browserSpec, [...RESOLVED]]);
    // Repeat in reverse order with the same objects to catch mutation/caches.
    for (const seed of [...seeds, ...seeds.toReversed()]) {
      const actual = json(viteCompiler.compileTown(browserSpec, RESOLVED, { seed }));
      assert.equal(actual, expected.get(seed), `seed ${seed}: full town JSON (${perturb ? 'perturbed math' : 'Vite SSR'})`);
      assert.equal(json(compileTown(spec, catalog, { seed })), expected.get(seed), `seed ${seed}: Node repeat`);
    }
    const { default: large } = await server.ssrLoadModule('/specs/large.json');
    const browserLarge = viteSpec.validateSpec(large, RESOLVED);
    const largeSnapshot = json(browserLarge);
    for (const seed of [...largeSeeds, ...largeSeeds.toReversed()]) {
      assert.equal(json(viteCompiler.compileTown(browserLarge, RESOLVED, { seed })), largeExpected.get(seed), `large seed ${seed}: full JSON parity`);
      assert.equal(json(compileTown(largeSpec, catalog, { seed })), largeExpected.get(seed), `large seed ${seed}: Node repeat`);
    }
    for (const [index, flags] of variants.entries()) {
      const town = viteCompiler.compileTown(browserLarge, RESOLVED, { seed: 1234, ...flags });
      assert(town.ok, `variant ${json(flags)} passes hard checks`);
      assert.equal(json(town), variantExpected[index], `variant ${json(flags)} full JSON parity`);
      assert.equal(json(compileTown(largeSpec, catalog, { seed: 1234, ...flags })), variantExpected[index], 'variant Node repeat');
      assert.equal(json(viteCompiler.compileTown(browserSpec, RESOLVED, { seed: 1234, ...flags })), expected.get(1234), 'flags leave hamlet unchanged');
    }
    assert.equal(json(browserLarge), largeSnapshot, 'large spec must not mutate');
    console.log(`large parity: ${largeSeeds.length} seeds, full JSON identical (forward + reverse)`);
    assert.equal(json([hamlet, browserSpec, [...RESOLVED]]), snapshot, 'Vite inputs must not mutate');
    console.log(`parity ${perturb ? 'Vite SSR + one-ulp math perturbation' : 'Vite SSR'}: ${seeds.length} seeds, full JSON identical (forward + reverse)`);
  } finally {
    await server.close();
  }
}
assert.equal(json([spec, [...catalog]]), inputSnapshot, 'Node inputs must not mutate');
