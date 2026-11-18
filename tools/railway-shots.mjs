// railway-loop review stills (seed 831). Usage:
// node tools/railway-shots.mjs <baseUrl> <prefix> [name ...]   e.g. http://127.0.0.1:5251 after
// Writes shots/railway-loop/<prefix>-<name>.png and prints draw calls per view.
import {chromium} from 'playwright-core';
import {mkdirSync} from 'node:fs';
const [base = 'http://127.0.0.1:5251', prefix = 'after', ...only] = process.argv.slice(2);
const dir = new URL('../shots/railway-loop/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
// [name, x, z, zoom, rotation, hour, advance (sim s from a train event)]
export const VIEWS = [
  ['union', -88, -162, 5.2, 0, 10.4],
  ['station', 50, -56, 5.2, 0, 10.4],
  ['airport', 70, -150, 5.5, 0, 10.4],
  ['crossing', 70, -178, 6, 0, 10.4],
    ['portal', -122, -155, 5.5, 0, 10.4],
  ['wide', 5, -118, 1.0, 0, 10.4],
  ['night', 50, -56, 5, 0, 20.6],
];
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}}), errors = [];
  page.on('pageerror', (e) => errors.push(e.stack)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(base + '/?capture=1&seed=831', {timeout: 300000});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 600000, polling: 500});
  const err = await page.evaluate(() => window.__astraError); if (err) throw Error(err);
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); document.querySelectorAll('.ui,.panel,.card,.hud').forEach((e) => e.style.display = 'none'); __astra.step(0); });
  for (const [name, x, z, zoom, rotation, hour] of VIEWS.filter((v) => !only.length || only.includes(v[0]))) {
    const calls = await page.evaluate(({x, z, zoom, rotation, hour, name}) => {
      __astra.setHour(hour); __astra.controls.view({x, z, zoom, rotation}, true);
      const rw = __astra.world.railway;
      // Hold the train where the still wants it: at the station for station views, near the crossing for the crossing.
      if (rw && name !== 'wide') { const want = {union: 'union', station: 'quay', airport: 'airport', night: 'quay'}[name];
        for (let n = 0; n < 9000; n++) { __astra.step(.25, false); const t = rw.service.train; if (want ? t.phase === 'dwell' && t.station === want : name === 'crossing' ? rw.service.cars.some((c) => Math.hypot(c.pos[0] - 67.5, c.pos[1] + 181.3) < 7) : name === 'portal' ? rw.service.cars.some((c) => Math.hypot(c.pos[0] + 126, c.pos[1] + 156) < 10) : true) break; }
        __astra.controls.view({x, z, zoom, rotation}, true); }
      for (let n = 0; n < 30; n++) __astra.step(0, false); __astra.step(0);
      return __astra.renderer.info.render.calls;
    }, {x, z, zoom, rotation, hour, name});
    await page.screenshot({path: `${dir}${prefix}-${name}.png`, timeout: 120000});
    console.log(prefix, name, 'drawCalls', calls);
  }
  if (errors.length) console.error('errors:', errors.slice(0, 5).join('\n'));
} finally { await browser.close(); }
