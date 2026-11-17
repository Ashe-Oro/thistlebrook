// Node CLI for the town compiler. Pure JS path (no three.js): bounds.json is
// read with fs and resolved via the same resolve-all.js the browser uses.
//   npm run compile -- --seed 7 [--spec specs/hamlet.json] [--out out/]
//   npm run compile -- --sweep 50     (seeds 1..50: pass rate + top failures)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { compileTown } from '../src/compiler/compile.js';
import { validateSpec } from '../src/compiler/spec.js';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? true) : def;
}
const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

const bounds = read('src/catalog/bounds.json');
const catalog = resolveAll(bounds);
// WORKTREE-HOOK medium: explicit size only; legacy CLI default preserved
const specPath = arg('spec', arg('size', '') === 'medium' ? 'specs/medium.json' : arg('size', '') === 'large' ? 'specs/large.json' : 'specs/hamlet.json');
const spec = validateSpec(read(specPath), catalog);
// --town-retries N overrides spec.retries.town (0 = show first-attempt failures).
if (arg('town-retries', null) != null) spec.retries.town = Number(arg('town-retries'));
const outDir = arg('out', 'out/');

function failing(report) {
  return report.checks.filter((c) => !c.warn && !c.ok).map((c) => c.name);
}
function summarize(town) {
  const r = town.report;
  return `seed ${String(town.seed).padStart(6)} attempt ${town.attempt} ${town.ok ? 'OK ' : 'FAIL'} `
    + `· ${r.stats.houses}h ${r.stats.paths}p ${r.stats.fences}f ${r.stats.trees}t ${r.stats.bushes}b ${r.stats.props}pr`
    + (town.ok ? '' : ` · fails: ${failing(r).join(',')}`);
}

const sweep = arg('sweep', null);
const stats = arg('stats', null); // --stats N: facing / camera / gate stats over seeds 1..N
mkdirSync(new URL(outDir, root), { recursive: true });

if (stats) {
  const N = Number(stats);
  let wc = 0, wp = 0, gates = 0, fenced = 0, dsum = 0, gateOff = 0, openMin = Infinity, openMax = 0, openSum = 0;
  for (let seed = 1; seed <= N; seed++) {
    const town = compileTown(spec, catalog, { seed, district: arg('district'), season: arg('season'), life: !!arg('life', arg('village', false)) });
    for (const b of town.instances) {
      if (!b.facing) continue;
      wc = Math.max(wc, b.facing.cameraAngle); wp = Math.max(wp, b.facing.plazaAngle);
    }
    const g = town.instances.filter((i) => i.kind === 'gate');
    gates += g.length;
    // Gate hinge-line centre vs its lot's door-path centreline (perpendicular distance).
    for (const gi of g) {
      openMin = Math.min(openMin, gi.open); openMax = Math.max(openMax, gi.open); openSum += gi.open;
      const p =town.instances.find((i) => i.kind === 'path' && i.lot === gi.lot);
      if (!p) { gateOff = Infinity; continue; }
      const d = [Math.sin(p.rotY), Math.cos(p.rotY)];
      gateOff = Math.max(gateOff, Math.abs((gi.pos[0] - p.pos[0]) * d[1] - (gi.pos[1] - p.pos[1]) * d[0]));
    }
    fenced += new Set(town.instances.filter((i) => i.kind === 'fence').map((i) => i.lot)).size;
    dsum += town.camera.distance;
    if (N <= 10) {
      const c = town.camera;
      console.log(`seed ${seed} ${town.ok ? 'OK' : 'FAIL'} att ${town.attempt} cam D ${c.distance.toFixed(1)} el ${c.elevation} fill ${c.fillX}/${c.fillY} pos ${c.pos.map((v) => v.toFixed(1))} `
        + `arc ${town.facingArc} want ${town.buildingsWanted} got ${town.instances.filter((i) => i.facing).length} rej ${JSON.stringify(town.placementRejects)} `
        + `facing ${town.instances.filter((i) => i.facing).map((i) => `${i.facing.cameraAngle.toFixed(0)}/${i.facing.plazaAngle.toFixed(0)}`).join(' ')} gates ${g.length}`);
    }
  }
  console.log(`stats ${N} seeds · worst cameraAngle ${wc.toFixed(1)} · worst plazaAngle ${wp.toFixed(1)} · gates ${gates} / fenced lots ${fenced} (max gate offset from path centreline ${gateOff.toFixed(3)}; open min/mean/max ${gates ? `${openMin}/${(openSum / gates).toFixed(3)}/${openMax}` : '-'}) · mean cam distance ${(dsum / N).toFixed(1)}`);
} else if (sweep) {
  const N = Number(sweep);
  let firstPass = 0, retriedPass = 0;
  const failCounts = {};
  const rows = [];
  for (let seed = 1; seed <= N; seed++) {
    const town = compileTown(spec, catalog, { seed, district: arg('district'), season: arg('season'), life: !!arg('life', arg('village', false)) });
    if (town.attempt === 0 && town.ok) firstPass++;
    if (town.ok) retriedPass++;
    else for (const name of failing(town.report)) failCounts[name] = (failCounts[name] || 0) + 1;
    rows.push({ seed, ok: town.ok, attempt: town.attempt, fails: town.ok ? [] : failing(town.report), stats: town.report.stats });
  }
  const topFails = Object.entries(failCounts).sort((a, b) => b[1] - a[1]);
  const result = {
    spec: specPath, seeds: N,
    firstAttemptPass: firstPass, firstAttemptRate: +(firstPass / N).toFixed(3),
    afterRetryPass: retriedPass, afterRetryRate: +(retriedPass / N).toFixed(3),
    topFailingChecks: topFails.map(([name, count]) => ({ name, count })),
    rows,
  };
  writeFileSync(new URL(`${outDir}sweep.json`, root), JSON.stringify(result, null, 1) + '\n');
  console.log(`sweep ${N} seeds · first-attempt ${firstPass}/${N} (${(100 * firstPass / N).toFixed(0)}%) · after-retry ${retriedPass}/${N} (${(100 * retriedPass / N).toFixed(0)}%)`);
  console.log('top failing checks:', topFails.length ? topFails.map(([n, c]) => `${n}×${c}`).join(' ') : 'none');
  console.log(`wrote ${outDir}sweep.json`);
} else {
  const seed = Number(arg('seed', spec.seed ?? 1));
  const town = compileTown(spec, catalog, { seed, district: arg('district'), season: arg('season'), life: !!arg('life', arg('village', false)) });
  const file = `${outDir}town-${seed}.json`;
  writeFileSync(new URL(file, root), JSON.stringify({ ...town }, null, 1) + '\n');
  console.log(summarize(town));
  console.log(`wrote ${file}`);
}
