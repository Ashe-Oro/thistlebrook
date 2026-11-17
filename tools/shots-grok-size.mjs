// Before/after stills for the size pass: same seed, same cameras, same
// simulated time, day and night. Usage:
//   node tools/shots-grok-size.mjs <origin> <label>   (e.g. http://127.0.0.1:5212 before)
// Writes shots/grok-size/<label>-<view>-<day|night>.png and prints load stats
// (bytes and seconds until window.__ready) plus a swiftshader FPS sample.
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync} from 'node:fs';
const [origin, label] = process.argv.slice(2);
const dir = new URL('../shots/grok-size/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
const VIEWS = ['village', 'themepark', 'fair', 'coast', 'starbase', 'quay'];
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const stats = {label, origin};
try {
  // 1) Load measurement on a fresh page with a real animation loop.
  {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable');
    let bytes = 0, requests = 0, failed = 0; const t0 = Date.now();
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; requests++; });
    page.on('response', (r) => { if (r.status() >= 400) failed++; });
    await page.goto(origin + '/', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 240000, polling: 100});
    Object.assign(stats, {readyMB: +(bytes / 1e6).toFixed(2), readyRequests: requests, readySeconds: +((Date.now() - t0) / 1000).toFixed(1), httpErrors: failed, error: await page.evaluate(() => window.__astraError || null)});
    await page.close();
  }
  // 2) Deterministic stills: no rAF loop, fixed steps.
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(origin + '/?capture=1&seed=831&hour=10.4', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 240000, polling: 200});
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); __astra.setPaused(true); });
  // Frame cost on the opening view (swiftshader, so CPU-bound; compare
  // before/after only on the same box) plus renderer counters.
  stats.frame = await page.evaluate(() => {
    __astra.setHour(10.4); __astra.view('village'); for (let i = 0; i < 5; i++) __astra.step(1 / 60);
    const t = performance.now(); for (let i = 0; i < 20; i++) __astra.step(1 / 60);
    const info = __astra.renderer.info;
    return {msPerFrame: +((performance.now() - t) / 20).toFixed(1), calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries};
  });
  if (process.argv.includes('--perf-only')) { console.log(JSON.stringify(stats)); await browser.close(); process.exit(0); }
  for (const [mood, hour] of [['day', 10.4], ['night', 21.5]]) {
    for (const view of VIEWS) {
      await page.evaluate(({view, hour}) => { __astra.setHour(hour); __astra.view(view); for (let i = 0; i < 60; i++) __astra.step(0, false); __astra.step(0); }, {view, hour});
      await page.screenshot({path: `${dir}${label}-${view}-${mood}.png`, timeout: 60000});
    }
  }
} finally { await browser.close(); }
console.log(JSON.stringify(stats));
writeFileSync(new URL(`../shots/grok-size/${label}-stats.json`, import.meta.url), JSON.stringify(stats, null, 2) + '\n');
