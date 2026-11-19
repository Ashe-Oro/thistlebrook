// Night stills of Market Square and Civic Green for the streetlights fix.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = new URL('../shots/streetlights/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const server = await preview({ preview: { port: 0, strictPort: true, host: '127.0.0.1' } });
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts.google/.test(m.text())) errors.push(m.text()); });
  await page.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  const url = `${server.resolvedUrls.local[0]}?capture=1&hour=20.5&view=market`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__ready || window.__astraError, null, { timeout: 180000, polling: 200 });
  assert.equal(await page.evaluate(() => window.__astraError), undefined, errors.join('\n'));
  await page.evaluate(() => {
    document.querySelector('.loading')?.remove();
    document.querySelectorAll('.masthead, .view-tabs, .clock, .card, .tooltip, #look, .glass, .light-controls, nav, header').forEach((el) => { el.style.display = 'none'; });
  });
  const shot = async (name, view, hour) => {
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
      return { view: a.controls?.state?.() || a.audit().camera, hour: a.hour, night: a.lighting.state.night, period: a.lighting.state.period, drawCalls: a.audit().drawCalls };
    });
    console.log(name, JSON.stringify(audit));
  };
  await shot('market-square-night', 'market', 20.5);
  await page.evaluate(() => {
    const a = window.__astra;
    a.setPaused(true);
    a.controls.view({ x: 1, z: 3, zoom: 4.1, rotation: 0 }, true);
    a.setHour(20.5);
    for (let i = 0; i < 80; i++) a.step(0, false);
    a.step(0);
  });
  await page.screenshot({ path: dir + 'market-square-night-close.png', animations: 'disabled', timeout: 60000 });
  console.log('market-square-night-close');
  await shot('civic-green-night', 'civic', 20.5);
  assert.deepEqual(errors, [], errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
