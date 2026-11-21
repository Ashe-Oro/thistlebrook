#!/usr/bin/env node
// OWNER: opus-nature lane. Before/after stills of every outdoor edge the
// Nature pass touches, plus render stats and the GLBs the page loads.
// Usage: npx vite --port 5291 --strictPort (run once per checkout), then
//   node tools/shots-opus-nature.mjs <origin> <label> [outDir] [view ...]
// Writes <outDir>/<label>-<view>.png via renderer.domElement.toDataURL at
// seed 831, paused, zoom <= 5, and <outDir>/<label>-stats.json with draw
// calls / triangles per view and every licensed GLB URL requested.
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync} from 'node:fs';
const [origin = 'http://127.0.0.1:5291', label = 'after', dir = '/workspace/scratch/opus-nature', ...only] = process.argv.slice(2);
mkdirSync(dir, {recursive: true});
const DAY = 10.4, DUSK = 19.4;
const AREAS = {
  'woods-wide': {x: -125, z: 28, zoom: 1.55},
  'woods-pond': {x: -110, z: 68, zoom: 3.6},
  'woods-fern-hollow': {x: -104, z: 12, zoom: 4.2},
  'woods-lookout': {x: -153, z: 31, zoom: 3},
  'woods-trailhead': {x: -102, z: -21, zoom: 4.5},
  'lake': {x: -15, z: 72, zoom: 2.7},
  'birch-hollow': {x: -60, z: 76, zoom: 3.4},
  'river-meadow': {x: -72, z: 40, zoom: 3},
  'river-outflow': {x: 30, z: 118, zoom: 2.4},
  'merrymead-edge': {x: -231, z: -66, zoom: 2.2},
};
export const VIEWS = {wide: {view: 'village', hour: DAY}};
for (const [k, v] of Object.entries(AREAS)) { VIEWS[k] = {...v, rotation: 0, hour: DAY}; VIEWS[k + '-dusk'] = {...v, rotation: 0, hour: DUSK}; }
for (const arg of only) if (arg.includes('=')) { const [k, v] = arg.split(/=(.*)/s); VIEWS[k] = JSON.parse(v); }
const names = only.length ? only.map((a) => a.split('=')[0]) : Object.keys(VIEWS);
for (const n of names) if (!VIEWS[n]) throw Error('unknown view ' + n);
for (const n of names) if ((VIEWS[n].zoom ?? 0) > 5) throw Error('zoom above 5: ' + n);
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const glbs = new Set();
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { const u = new URL(r.url()).pathname; if (u.endsWith('.glb')) glbs.add(u + (r.status() === 200 ? '' : ' ' + r.status())); });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(origin + '/?capture=1&seed=831&hour=10.4', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 900000, polling: 500});
  const err = await page.evaluate(() => window.__astraError || null); if (err) throw Error(String(err));
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); __astra.setPaused(true); });
  const stats = {};
  for (const name of names) {
    const {url, info} = await page.evaluate(({v}) => {
      __astra.setSkin?.('cel'); __astra.world.woods?.forceWeekday(5); __astra.setHour(v.hour);
      if (v.view) __astra.view(v.view); else { __astra.view(v); __astra.controls.view(v, true); }
      for (let i = 0; i < 60; i++) __astra.step(0, false);
      const r = __astra.renderer; r.info.autoReset = true; __astra.step(0);
      return {url: r.domElement.toDataURL('image/png'), info: {calls: r.info.render.calls, triangles: r.info.render.triangles}};
    }, {v: VIEWS[name]});
    writeFileSync(`${dir}/${label}-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    stats[name] = info; console.log('wrote', `${dir}/${label}-${name}.png`, JSON.stringify(info));
  }
  writeFileSync(`${dir}/${label}-stats.json`, JSON.stringify({views: stats, glbs: [...glbs].sort(), errors}, null, 1) + '\n');
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5));
} finally { await browser.close(); }
