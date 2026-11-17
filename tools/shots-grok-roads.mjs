// OWNER: grok-roads lane. Before/after stills for the road and sidewalk pass.
// Usage: node tools/shots-grok-roads.mjs <origin> <label> [view ...]
// Writes shots/grok-roads/<label>-<view>.png at seed 831, hour 10.4, paused.
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync} from 'node:fs';
const [origin, label, ...only] = process.argv.slice(2);
const dir = new URL('../shots/grok-roads/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
// "ashe" matches the camera in Ashe's screenshot (fair left, Roadster lot top
// right, town bottom); "network" frames every west-side regional road.
export const VIEWS = {
  ashe: {x: -180, z: -120, zoom: 1.6, rotation: 0},
  network: {x: -150, z: -100, zoom: 1.05, rotation: 0},
  fountain: {x: -57, z: -6, zoom: 5.2, rotation: 0, simulate: 40},
  harbor: {x: 140, z: 31, zoom: 4.6, rotation: 0, simulate: 40},
};
// A view name may also be inline JSON: name={"x":..,"z":..,"zoom":..}.
for (const arg of only) if (arg.includes('=')) { const [k, v] = arg.split(/=(.*)/s); VIEWS[k] = JSON.parse(v); }
const names = only.length ? only.map((a) => a.split('=')[0]) : Object.keys(VIEWS);
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(origin + '/?capture=1&seed=831&hour=10.4', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 300000, polling: 250});
  const err = await page.evaluate(() => window.__astraError || null); if (err) throw Error(String(err));
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); __astra.setPaused(true); });
  for (const name of names) {
    // Render and read back in the same task, so no compositor frame is needed.
    const url = await page.evaluate(({v}) => { __astra.setHour(10.4); __astra.view(v); __astra.controls.view(v, true); if (v.simulate) { __astra.setPaused(false); for (let i = 0; i < v.simulate * 10; i++) __astra.step(.1, false); __astra.setPaused(true); } for (let i = 0; i < 60; i++) __astra.step(0, false); __astra.step(0); return __astra.renderer.domElement.toDataURL('image/png'); }, {v: VIEWS[name]});
    writeFileSync(`${dir}${label}-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', `${dir}${label}-${name}.png`);
  }
} finally { await browser.close(); }
