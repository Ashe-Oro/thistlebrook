// OWNER: grok-woods lane. Stills + render stats for the Pinewood meadow woods and trails.
// Usage: npx vite --port 5237 --strictPort, then
//   node tools/shots-grok-woods.mjs <origin> <label> [view|name={json} ...]
// Writes shots/grok-woods/<label>-<view>.png at seed 831, hour 10.4, paused,
// and prints draw calls / triangles per view (renderer.info after one frame).
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync} from 'node:fs';
const [origin = 'http://127.0.0.1:5237', label = 'after', ...only] = process.argv.slice(2);
const dir = new URL('../shots/grok-woods/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
export const VIEWS = {
  ashe: {x: -125, z: 28, zoom: 1.55, rotation: 0},
  wide: {view: 'village'},
  // Saturday (weekday 5) early afternoon: nine hikers on the switchbacks.
  trail: {x: -144, z: 24, zoom: 4.2, rotation: 0, hour: 13.66, weekday: 5},
  ridge: {x: -145, z: 40, zoom: 2.6, rotation: 0, hour: 12, weekday: 5},
  trailhead: {x: -100, z: -22, zoom: 5, rotation: 0, hour: 10.4},
  'river-trail': {x: -88, z: 28, zoom: 4.5, rotation: 0, hour: 10.4},
  dusk: {x: -138, z: 35, zoom: 2.2, rotation: 0, hour: 19.5, weekday: 5},
};
for (const arg of only) if (arg.includes('=')) { const [k, v] = arg.split(/=(.*)/s); VIEWS[k] = JSON.parse(v); }
const names = only.length ? only.map((a) => a.split('=')[0]) : Object.keys(VIEWS);
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(origin + '/?capture=1&seed=831&hour=10.4', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 900000, polling: 500});
  const err = await page.evaluate(() => window.__astraError || null); if (err) throw Error(String(err));
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); __astra.setPaused(true); });
  for (const name of names) {
    const {url, info} = await page.evaluate(({v}) => {
      __astra.setSkin?.(v.skin || 'cel'); __astra.world.woods?.forceWeekday(v.weekday ?? null); __astra.setHour(v.hour ?? 10.4);
      if (v.view) __astra.view(v.view); else { __astra.view(v); __astra.controls.view(v, true); }
      if (v.simulate) { __astra.setPaused(false); for (let i = 0; i < v.simulate * 10; i++) __astra.step(.1, false); __astra.setPaused(true); __astra.setHour(v.hour ?? 10.4); }
      for (let i = 0; i < 60; i++) __astra.step(0, false);
      const r = __astra.renderer; r.info.autoReset = true; __astra.step(0);
      return {url: r.domElement.toDataURL('image/png'), info: {calls: r.info.render.calls, triangles: r.info.render.triangles}};
    }, {v: VIEWS[name]});
    writeFileSync(`${dir}${label}-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', `${dir}${label}-${name}.png`, JSON.stringify(info));
  }
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5));
} finally { await browser.close(); }
