#!/usr/bin/env node
// Airfield kit probe + gold stills (docs/specs/OPUS-AIRFIELD.md).
// Starts its own Vite dev server on a free port, opens the airport view at
// seed 831 and reports, for one rendered frame at 10.4 h:
//   frame      draw calls / triangles of the whole airport-view frame
//   airport    draw calls / triangles with only the airport root visible
//   download   bytes fetched from /licensed/airfield/ (pack models)
// With --shots it also writes the gold stills into --out (default
// /workspace/scratch/opus-airfield): <prefix>-wide, and for `after` the
// apron close-up and the 21.5 h night still.
//   node tools/airfield-probe.mjs --prefix before --shots wide
//   node tools/airfield-probe.mjs --prefix after --shots wide,apron,night
import {createServer as netServer} from 'node:net';
import {mkdirSync, writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const out = arg('out', '/workspace/scratch/opus-airfield'), prefix = arg('prefix', 'after');
const shots = (arg('shots', '') || '').split(',').filter(Boolean);
const freePort = () => new Promise((ok) => { const s = netServer().listen(0, '127.0.0.1', () => { const {port} = s.address(); s.close(() => ok(port)); }); });
const port = await freePort();
const server = await createServer({server: {port, strictPort: true, host: '127.0.0.1', hmr: false}, logLevel: 'error'});
await server.listen();
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
// Local airport frame → world (WORLD_OFFSETS.airport).
const W = (x, z, zoom) => ({x, z: z - 140, zoom});
const VIEWS = {wide: 'airport', apron: W(91, -50, 3.1), night: 'airport'};
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}}), errors = [], fetched = new Map();
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', async (r) => {
    const url = new URL(r.url());
    if (!url.pathname.includes('/licensed/airfield/')) return;
    try { fetched.set(url.pathname, (await r.body()).length); } catch { /* aborted */ }
  });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`http://127.0.0.1:${port}/?view=airport&seed=831&capture=1`);
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 240000, polling: 250});
  const failure = await page.evaluate(() => window.__astraError);
  if (failure) throw new Error(String(failure));
  await page.evaluate(() => document.querySelector('.loading')?.remove());
  const frame = (view, hour, t) => page.evaluate(({view, hour, t}) => {
    const a = window.__astra;
    a.view(view); a.setHour(hour);
    for (let i = 0; i < 100; i++) a.step(0, false);
    a.world.expansions.airport.update(t, hour > 19 || hour < 6 ? 1 : 0);
    a.renderer.info.autoReset = false;
    a.renderer.info.reset(); a.renderer.render(a.scene, a.camera);
    const full = {calls: a.renderer.info.render.calls, triangles: a.renderer.info.render.triangles};
    // Airport-only pass: hide every other top-level child for one render.
    const root = a.world.expansions.airport.root, hidden = [];
    for (const c of a.scene.children) if (c !== root && c.visible && !c.isLight) { c.visible = false; hidden.push(c); }
    a.renderer.info.reset(); a.renderer.render(a.scene, a.camera);
    const airport = {calls: a.renderer.info.render.calls, triangles: a.renderer.info.render.triangles};
    hidden.forEach((c) => { c.visible = true; });
    a.renderer.info.autoReset = true;
    a.renderer.render(a.scene, a.camera);
    return {full, airport};
  }, {view, hour, t});
  const day = await frame('airport', 10.4, 0);
  const report = {prefix, at: new Date().toISOString(), seed: 831, hour: 10.4, frame: day.full, airport: day.airport,
    download: {files: Object.fromEntries([...fetched].sort()), bytes: [...fetched.values()].reduce((s, b) => s + b, 0)}};
  report.download.MB = +(report.download.bytes / 1e6).toFixed(3);
  mkdirSync(out, {recursive: true});
  writeFileSync(`${out}/${prefix}-probe.json`, JSON.stringify(report, null, 2));
  for (const name of shots) {
    const hour = name === 'night' ? 21.5 : 10.4;
    const stats = await frame(VIEWS[name], hour, name === 'apron' ? 4 : 0);
    if (name === 'night') report.night = stats;
    await page.screenshot({path: `${out}/${prefix}-${name}.png`, timeout: 480000});
    console.error('shot', `${out}/${prefix}-${name}.png`);
  }
  report.errors = errors;
  writeFileSync(`${out}/${prefix}-probe.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await server.close();
}
