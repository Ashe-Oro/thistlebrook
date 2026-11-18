// OWNER: opus-suburb lane. One probe for the Maple Hollow checklist.
// Usage: node tools/probe-maple-hollow.mjs [--origin http://localhost:5321] [--audit] [--sim] [--json out.json]
//  - always: compiles seed 831 and checks lots (house, driveway, lawn, mailbox, bins),
//    reachability, regions, bus route and residents (works on the pre-suburb tree: 0 lots)
//  - --origin: draw calls / triangles / people / traffic at the site views (headless Chrome)
//  - --audit: npm run audit:roads open count; --sim: full-day sim-collisions counts
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const root = new URL('..', import.meta.url).pathname;
const report = {when: new Date().toISOString(), targets: {lots: '20-30', addedDrawCalls: '<=150', addedFirstLoadMB: '<=3', auditOpen: 0, sim: 'all zero'}};

// 1) Compiled plan.
{
  const {resolveAll} = await import(pathToFileURL(root + 'src/catalog/resolve-all.js').href);
  const {compileWorld} = await import(pathToFileURL(root + 'src/compiler/world-plan.js').href);
  const town = compileWorld(resolveAll(JSON.parse(readFileSync(root + 'src/catalog/bounds.json'))), 831);
  const mh = town.mapleHollow;
  if (!mh) report.plan = {lots: 0, note: 'no Maple Hollow in this tree'};
  else {
    const need = ['house', 'driveway', 'lawn', 'mailbox', 'bins'];
    const lots = mh.lots.map((l) => ({key: l.key, house: l.house, missing: need.filter((k) => !l.parts?.[k])}));
    report.plan = {
      lots: lots.length, complete: lots.filter((l) => !l.missing.length).length, incomplete: lots.filter((l) => l.missing.length),
      vacant: mh.lots.filter((l) => l.vacant || l.forSale).map((l) => l.key), houseTypes: [...new Set(mh.lots.map((l) => l.house))].length,
      props: mh.props.length, streets: town.roads.filter((r) => r.mapleHollow).length, bays: mh.bays.length, busStops: mh.bus?.stops.length || 0,
      residents: mh.residents.length, crosswalks: mh.crosswalks.length,
    };
  }
}
// 2) Browser numbers.
const origin = opt('--origin');
if (origin) {
  const {chromium} = await import('playwright-core');
  const views = {
    site: {x: 10, z: -145, zoom: 1.5, rotation: 0, hour: 13},
    close: {x: 10, z: -140, zoom: 2.6, rotation: 0, hour: 13},
    dusk: {x: 10, z: -145, zoom: 1.5, rotation: 0, hour: 20.5},
    village: 'village',
  };
  const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    const t0 = Date.now();
    await page.goto(origin + '/?capture=1&seed=831&hour=10.4', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 900000, polling: 250});
    const err = await page.evaluate(() => window.__astraError || null); if (err) throw Error(err);
    report.loadSeconds = (Date.now() - t0) / 1000;
    report.views = {};
    for (const [name, v] of Object.entries(views)) {
      report.views[name] = await page.evaluate((v) => {
        __astra.setPaused(true);
        if (typeof v === 'string') __astra.view(v); else { __astra.setHour(v.hour); __astra.view(v); __astra.controls.view(v, true); }
        __astra.setPaused(false); for (let i = 0; i < 100; i++) __astra.step(.1, false); __astra.setPaused(true);
        for (let i = 0; i < 30; i++) __astra.step(0, false);
        __astra.step(0); const a = __astra.audit();
        return {drawCalls: a.drawCalls, triangles: a.triangles, people: a.people, trafficVehicles: a.traffic?.vehicles?.length, regionalVehicles: a.landscape?.vehicles?.length, registryErrors: a.renderRegistryErrors?.length, mapleHollow: a.mapleHollow || null};
      }, v);
    }
  } finally { await browser.close(); }
}
// 3) Road audit and day sim.
if (args.includes('--audit')) {
  const out = spawnSync('node', [root + 'tools/audit-roads.mjs'], {encoding: 'utf8', maxBuffer: 1 << 28});
  const m = out.stdout.match(/"open":\s*(\d+)[\s\S]*?"justified":\s*(\d+)\s*}\s*$/);
  report.audit = m ? {open: +m[1], justified: +m[2]} : {raw: out.stdout.slice(-400) + out.stderr.slice(-400)};
}
if (args.includes('--sim')) {
  const {simulateDay} = await import(pathToFileURL(root + 'tools/sim-collisions.mjs').href);
  const r = await simulateDay({hours: 24});
  report.sim = {counts: r.counts, firsts: Object.fromEntries(Object.entries(r.firsts).map(([k, v]) => [k, v.slice(0, 3)])), vehicles: r.vehicles, residents: r.residents, transit: r.transit || null};
}
console.log(JSON.stringify(report, null, 2));
const json = opt('--json'); if (json) writeFileSync(json, JSON.stringify(report, null, 2));
