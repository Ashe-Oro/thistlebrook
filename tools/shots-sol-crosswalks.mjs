// OWNER: sol-crosswalks lane. Before/after stills for the road and sidewalk pass.
// Usage: node tools/shots-sol-crosswalks.mjs <origin> <label> [view ...]
// Writes shots/sol-crosswalks/<label>-<view>.png at seed 831, hour 10.4, paused.
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync} from 'node:fs';
const [origin, label, ...only] = process.argv.slice(2);
const dir = new URL('../shots/sol-crosswalks/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
const VIEWS = {
  'ashe-junction': {x: -172.9, z: -138.5, zoom: 12, rotation: 0},
  'fountain-t': {x: -65.7, z: -15.1, zoom: 10, rotation: 0},
  diagonal: {x: -103.6, z: -75.6, zoom: 9, rotation: 0},
};
// A view name may also be inline JSON: name={"x":..,"z":..,"zoom":..}.
for (const arg of only) if (arg.includes('=')) { const [k, v] = arg.split(/=(.*)/s); VIEWS[k] = JSON.parse(v); }
const names = only.length ? only.map((a) => a.split('=')[0]) : Object.keys(VIEWS);
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  page.on('pageerror', (error) => console.error(error));
  page.on('requestfailed', (request) => console.error(request.failure()?.errorText, request.url()));
  await page.goto(origin + '/?capture=1&seed=831&hour=10.4', {waitUntil: 'domcontentloaded'});
  console.log('waiting for town');
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 600000, polling: 250});
  const err = await page.evaluate(() => window.__astraError || null); if (err) throw Error(String(err));
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); __astra.setPaused(true); });
  for (const name of names) {
    console.log('rendering', name);
    // Render and read back in the same task, so no compositor frame is needed.
    const url = await page.evaluate((view) => {
      __astra.setHour(10.4);
      __astra.view(view);
      // The game clamps interactive zoom. Allow a tighter evidence crop.
      __astra.camera.zoom = view.zoom;
      __astra.camera.updateProjectionMatrix();
      __astra.step(0);
      return __astra.renderer.domElement.toDataURL('image/png');
    }, VIEWS[name]);
    writeFileSync(`${dir}${label}-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', `${dir}${label}-${name}.png`);
  }
} finally { await browser.close(); }
