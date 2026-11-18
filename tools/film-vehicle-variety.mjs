// Short downtown + harbor clip for the vehicle & street variety lane.
// Usage: node tools/film-vehicle-variety.mjs [--port 5252]
import {chromium} from 'playwright-core';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const port = arg('port', '5252');
const dir = new URL('../shots/vehicle-variety/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
const frames = mkdtempSync(join(tmpdir(), 'vehicle-variety-film-'));
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1120, height: 800}}), errors = [];
  page.on('pageerror', (e) => errors.push(e.stack)); await page.addInitScript(() => window.requestAnimationFrame = () => 0);
  await page.goto(`http://localhost:${port}/?capture=1&seed=831`);
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 900000, polling: 1000});
  const err = await page.evaluate(() => window.__astraError); if (err) throw Error(err);
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); __astra.setHour(10.3); for (let i = 0; i < 400; i++) __astra.step(.1, false); });
  let frame = 0;
  // [name, start view, end view, hour, frames]: a slow pan down the high street, then across the harbor to the ferry berth.
  const stops = [['downtown', {x: -64, z: -16, zoom: 6}, {x: -50, z: -10, zoom: 6}, 10.3, 60], ['harbor', {x: 160, z: 62, zoom: 4.2}, {x: 176, z: 66, zoom: 4.2}, 9.2, 60]];
  for (const [name, a, b, hour, count] of stops) {
    await page.evaluate(({a, hour}) => { __astra.setHour(hour); for (let n = 0; n < 200; n++) __astra.step(.1, false); __astra.view(a); for (let n = 0; n < 40; n++) __astra.step(0, false); }, {a, hour});
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1), v = {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, zoom: a.zoom};
      await page.evaluate((v) => { for (let n = 0; n < 2; n++) __astra.step(.1, false); __astra.view(v); __astra.step(0); }, v);
      await page.screenshot({path: join(frames, String(frame++).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 88, timeout: 180000});
    }
    console.log(name, frame);
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '10', '-i', join(frames, '%04d.jpg'), '-frames:v', String(frame), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dir + 'after-downtown-harbor.mp4']);
  writeFileSync(dir + 'film-evidence.json', JSON.stringify({frames: frame, fps: 10, duration: frame / 10, stops: stops.map((s) => s[0]), errors}, null, 2));
  console.log(`Saved ${frame / 10}s clip`, errors.length ? errors.slice(0, 3) : '');
} finally { await browser.close(); rmSync(frames, {recursive: true, force: true}); }
