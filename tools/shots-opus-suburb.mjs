// OWNER: opus-suburb lane. Stills of the Maple Hollow site (before/after).
// Usage: node tools/shots-opus-suburb.mjs <origin> <label> [view ...]
// Writes shots/opus-suburb/<label>-<view>.png at seed 831, hour 10.4, paused.
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync} from 'node:fs';
const [origin, label, ...only] = process.argv.slice(2);
const dir = new URL('../shots/opus-suburb/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
// Views take an optional hour (default 10.4) and simulate seconds.
export const VIEWS = {
  // Maple Hollow site: x -40..60, z -185..-105, north of the West Works /
  // Old Town block, west of the airport road (x 64), south of the hills.
  site: {x: 10, z: -145, zoom: 1.5, rotation: 0, hour: 13, simulate: 20},
  close: {x: 10, z: -140, zoom: 2.6, rotation: 0, hour: 13, simulate: 20},
  rotated: {x: 10, z: -145, zoom: 1.8, rotation: 2, hour: 17.5, simulate: 20},
  dusk: {x: 10, z: -145, zoom: 1.5, rotation: 0, hour: 20.5, simulate: 20},
  // Maple Hollow day / dusk / night set and a street-level close-up.
  day: {x: 8, z: -146, zoom: 2.1, rotation: 0, hour: 16.4, simulate: 30},
  evening: {x: 8, z: -146, zoom: 2.1, rotation: 0, hour: 20.2, simulate: 30},
  night: {x: 8, z: -146, zoom: 2.1, rotation: 0, hour: 22.8, simulate: 30},
  street: {x: 14, z: -136, zoom: 4.6, rotation: 0, hour: 16.6, simulate: 30},
  // One still per skin (src/skins): same camera, late afternoon.
  ...Object.fromEntries(['cel', 'neon', 'autumn', 'winter'].map((skin) => ['skin-' + skin, {x: 10, z: -146, zoom: 2.2, rotation: 0, hour: skin === 'neon' ? 21 : 15.5, simulate: 10, skin}])),
};
// A view name may also be inline JSON: name={"x":..,"z":..,"zoom":..}.
for (const arg of only) if (arg.includes('=')) { const [k, v] = arg.split(/=(.*)/s); VIEWS[k] = JSON.parse(v); }
const names = only.length ? only.map((a) => a.split('=')[0]) : Object.keys(VIEWS);
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(origin + '/?capture=1&seed=831&hour=10.4', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 900000, polling: 500});
  const err = await page.evaluate(() => window.__astraError || null); if (err) throw Error(String(err));
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); __astra.setPaused(true); });
  for (const name of names) {
    // Render and read back in the same task, so no compositor frame is needed.
    const url = await page.evaluate(({v}) => { __astra.setSkin?.(v.skin || 'cel'); __astra.setHour(v.hour ?? 10.4); __astra.view(v); __astra.controls.view(v, true); if (v.simulate) { __astra.setPaused(false); for (let i = 0; i < v.simulate * 10; i++) __astra.step(.1, false); __astra.setPaused(true); } for (let i = 0; i < 60; i++) __astra.step(0, false); __astra.step(0); return __astra.renderer.domElement.toDataURL('image/png'); }, {v: VIEWS[name]});
    writeFileSync(`${dir}${label}-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', `${dir}${label}-${name}.png`);
  }
} finally { await browser.close(); }
