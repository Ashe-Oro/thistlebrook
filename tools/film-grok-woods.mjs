// OWNER: grok-woods lane. Short clip of hikers on the Pinewood switchbacks.
// Usage: npx vite --port 5237 --strictPort, then
//   node tools/film-grok-woods.mjs [origin] [seconds=12] -> shots/grok-woods/hikers-switchbacks.mp4
// Saturday (weekday 5), 13:40, when nine hikers are on the switchbacks.
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const [origin = 'http://127.0.0.1:5237', secs = '12'] = process.argv.slice(2);
const dir = new URL('../shots/grok-woods/', import.meta.url).pathname, frames = dir + '.hiker-frames/';
rmSync(frames, {recursive: true, force: true}); mkdirSync(frames, {recursive: true});
const view = {x: -143, z: 24, zoom: 5, rotation: 0}, fps = 12, total = Math.round(Number(secs) * fps), hour = 13.62;
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 800}});
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(origin + '/?capture=1&seed=831&hour=' + hour, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 900000, polling: 500});
  await page.evaluate(({v, hour}) => { document.querySelector('.loading')?.remove(); __astra.world.woods.forceWeekday(5); __astra.setHour(hour); __astra.view(v); __astra.controls.view(v, true); for (let i = 0; i < 60; i++) __astra.step(0, false); }, {v: view, hour});
  for (let i = 0; i < total; i++) {
    // Two sim-seconds per frame so the walk reads in a short clip (2x speed).
    const url = await page.evaluate((dt) => { __astra.setPaused(false); __astra.step(dt, false); __astra.step(dt, false); __astra.setPaused(true); __astra.step(0); return __astra.renderer.domElement.toDataURL('image/jpeg', .88); }, 1 / fps);
    writeFileSync(frames + String(i).padStart(4, '0') + '.jpg', Buffer.from(url.split(',')[1], 'base64'));
    if (i % 24 === 0) console.log('frame', i, '/', total);
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', frames + '%04d.jpg', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dir + 'hikers-switchbacks.mp4']);
  rmSync(frames, {recursive: true}); console.log('wrote', dir + 'hikers-switchbacks.mp4');
} finally { await browser.close(); }
