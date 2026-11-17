// OWNER: grok-river lane. Before/after stills for the river system.
// Usage: node tools/shots-grok-river.mjs <origin> <label> [view|name={json} ...]
// Writes shots/grok-river/<label>-<view>.png at seed 831, hour 10.4, paused.
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync} from 'node:fs';
const [origin, label, ...only] = process.argv.slice(2);
const dir = new URL('../shots/grok-river/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
// "ashe" matches Ashe's screenshot: Town Hall top left, Stillwater Lake bottom
// left, Riverside Sessions stage bottom right. "wide" frames source to mouth.
export const VIEWS = {
  ashe: {x: -4, z: 26, zoom: 1.75, rotation: 0},
  wide: {x: 5, z: 75, zoom: .78, rotation: 0},
};
for (const arg of only) if (arg.includes('=')) { const [k, v] = arg.split(/=(.*)/s); VIEWS[k] = JSON.parse(v); }
const names = only.length ? only.map((a) => a.split('=')[0]) : Object.keys(VIEWS);
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(origin + '/?capture=1&seed=831&hour=10.4', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 300000, polling: 250});
  const err = await page.evaluate(() => window.__astraError || null); if (err) throw Error(String(err));
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); __astra.setPaused(true); });
  for (const name of names) {
    const url = await page.evaluate(({v}) => { __astra.setHour(10.4); __astra.view(v); __astra.controls.view(v, true); for (let i = 0; i < 60; i++) __astra.step(0, false); __astra.step(0); return __astra.renderer.domElement.toDataURL('image/png'); }, {v: VIEWS[name]});
    writeFileSync(`${dir}${label}-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', `${dir}${label}-${name}.png`);
  }
  if (errors.length) console.log('PAGE ERRORS', errors);
} finally { await browser.close(); }
