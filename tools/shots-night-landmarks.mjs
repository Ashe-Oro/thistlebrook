// Night stills of Starbase Texas and the Roadster proving ground (TOWN-28).
// Needs a build (`npx vite build`) and the licensed packs under public/licensed.
// NL_SHOTS_DIR overrides the output folder (default shots/night-landmarks/).
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = process.env.NL_SHOTS_DIR || new URL('../shots/night-landmarks/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const only = process.argv.slice(2);
const server = await preview({ preview: { port: 0, strictPort: true, host: '127.0.0.1' } });
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const SHOTS = [
  ['starbase-night', 'starbase', 21], ['starbase-dusk', 'starbase', 19.3],
  ['starbase-launch-night', 'launch', 21], ['starbase-day', 'starbase', 10.4],
  ['roadster-night', 'roadster', 21], ['roadster-ramp-night', {x: -216, z: -178, zoom: 5}, 21], ['roadster-dusk', 'roadster', 19.3], ['roadster-day', 'roadster', 10.4],
].filter(([name]) => !only.length || only.some((o) => name.includes(o)));
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts.google/.test(m.text())) errors.push(m.text()); });
  await page.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  const url = `${server.resolvedUrls.local[0]}?capture=1&hour=21&view=starbase`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__ready || window.__astraError, null, { timeout: 240000, polling: 200 });
  assert.equal(await page.evaluate(() => window.__astraError), undefined, errors.join('\n'));
  await page.evaluate(() => {
    document.querySelector('.loading')?.remove();
    document.querySelectorAll('.masthead, .view-tabs, .clock, .card, .tooltip, #look, .glass, .light-controls, nav, header').forEach((el) => { el.style.display = 'none'; });
  });
  for (const [name, view, hour] of SHOTS) {
    await page.evaluate(({ view, hour }) => {
      const a = window.__astra;
      a.setPaused(true);
      a.view(view);
      a.setHour(hour);
      for (let i = 0; i < 160; i++) a.step(0, false);
      a.step(0);
    }, { view, hour });
    await page.screenshot({ path: `${dir}${name}.png`, animations: 'disabled', timeout: 60000 });
    const audit = await page.evaluate(() => {
      const a = window.__astra;
      return { hour: a.hour, night: a.lighting.state.night, period: a.lighting.state.period, drawCalls: a.audit().drawCalls };
    });
    console.log(name, JSON.stringify(audit));
  }
  assert.deepEqual(errors, [], errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
