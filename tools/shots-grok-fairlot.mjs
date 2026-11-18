// OWNER: grok-fairlot lane. Stills of the Funfair parking lot.
// Usage: node tools/shots-grok-fairlot.mjs <origin> <label> [view ...]
// Writes shots/grok-fairlot/<label>-<view>.png at seed 831, hour 10.4, paused.
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync} from 'node:fs';
const [origin, label, ...only] = process.argv.slice(2);
const dir = new URL('../shots/grok-fairlot/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
// Views take an optional hour (default 10.4) and simulate seconds.
export const VIEWS = {
  // "ashe" matches Ashe's dusk screenshot (road stub left, Funfair gate top,
  // coast blocks bottom-left); "day" is the same camera at 10:24; "wide"
  // frames the lot between the mountain road, the fence and the coast.
  ashe: {x: 222, z: 16, zoom: 3, rotation: 0, hour: 18.6, simulate: 30},
  day: {x: 222, z: 16, zoom: 3, rotation: 0, hour: 13, simulate: 30},
  wide: {x: 214, z: 12, zoom: 1.6, rotation: 0, hour: 13, simulate: 30},
  close: {x: 241, z: 13, zoom: 5.2, rotation: 0, hour: 15.5, simulate: 30},
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
    const url = await page.evaluate(({v}) => { __astra.setHour(v.hour ?? 10.4); __astra.view(v); __astra.controls.view(v, true); if (v.simulate) { __astra.setPaused(false); for (let i = 0; i < v.simulate * 10; i++) __astra.step(.1, false); __astra.setPaused(true); } for (let i = 0; i < 60; i++) __astra.step(0, false); __astra.step(0); return __astra.renderer.domElement.toDataURL('image/png'); }, {v: VIEWS[name]});
    writeFileSync(`${dir}${label}-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    // Draw-call cost of the lot in this frame: render once with it hidden.
    const calls = await page.evaluate(() => { const lot = __astra.world.expansions.fairlot?.root; const on = (__astra.step(0), __astra.renderer.info.render.calls); if (!lot) return {on}; lot.visible = false; __astra.step(0); const off = __astra.renderer.info.render.calls; lot.visible = true; __astra.step(0); return {on, off, lot: on - off, audit: __astra.world.expansions.fairlot.audit()}; });
    console.log(name, JSON.stringify(calls));
    console.log('wrote', `${dir}${label}-${name}.png`);
  }
} finally { await browser.close(); }
