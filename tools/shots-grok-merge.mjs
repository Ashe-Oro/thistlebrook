// OWNER: grok-merge. Verification stills for the roads + river + coaster + skins merge.
// Usage: npx vite --port 5216 --strictPort, then
//   node tools/shots-grok-merge.mjs [origin=http://localhost:5216] [view ...]
// Writes shots/grok-merge/<view>.png at seed 831, hour 10.4 (coaster at noon), paused.
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync} from 'node:fs';
const [origin = 'http://localhost:5216', ...only] = process.argv.slice(2);
const dir = new URL('../shots/grok-merge/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
export const VIEWS = {
  wide: {view: 'village'},
  fair: {x: -180, z: -120, zoom: 1.6, rotation: 0, simulate: 20},
  harbor: {x: 162, z: 51, zoom: 2.25, rotation: 0, simulate: 20},
  'river-mouth': {x: 12, z: 140, zoom: 3.2, rotation: 0},
  'river-wide': {x: 5, z: 75, zoom: .78, rotation: 0},
  coaster: {x: 212, z: -70, zoom: 2.4, rotation: 0, hour: 12},
  'neon-wide': {view: 'village', skin: 'neon', hour: 21},
};
// A view may be inline JSON: name={"x":..,"z":..,"zoom":..,"hour":..}.
for (const arg of only) if (arg.includes('=')) { const [k, v] = arg.split(/=(.*)/s); VIEWS[k] = JSON.parse(v); }
const names = only.length ? only.map((a) => a.split('=')[0]) : Object.keys(VIEWS);
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(origin + '/?capture=1&seed=831&hour=10.4', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 600000, polling: 500});
  const err = await page.evaluate(() => window.__astraError || null); if (err) throw Error(String(err));
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); __astra.setPaused(true); });
  for (const name of names) {
    const url = await page.evaluate(({v}) => {
      __astra.setSkin(v.skin || 'cel'); __astra.setHour(v.hour ?? 10.4);
      if (v.view) __astra.view(v.view); else { __astra.view(v); __astra.controls.view(v, true); }
      if (v.simulate) { __astra.setPaused(false); for (let i = 0; i < v.simulate * 10; i++) __astra.step(.1, false); __astra.setPaused(true); __astra.setHour(v.hour ?? 10.4); }
      for (let i = 0; i < 60; i++) __astra.step(0, false); __astra.step(0);
      return __astra.renderer.domElement.toDataURL('image/png');
    }, {v: VIEWS[name]});
    writeFileSync(`${dir}${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', `${dir}${name}.png`);
  }
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5));
} finally { await browser.close(); }
