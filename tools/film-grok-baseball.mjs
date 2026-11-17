// grok-merge: short clip of the kids' ballgame. Needs `npx vite --port 5216 --strictPort`.
// Usage: node tools/film-grok-baseball.mjs [origin] [seconds=12] -> shots/grok-merge/baseball-after.mp4
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const [origin = 'http://localhost:5216', secs = '12'] = process.argv.slice(2);
const dir = new URL('../shots/grok-merge/', import.meta.url).pathname, frames = dir + '.baseball-frames/';
rmSync(frames, {recursive: true, force: true}); mkdirSync(frames, {recursive: true});
const view = {x: -21, z: -83.5, zoom: 5, rotation: 0}, fps = 12, total = Math.round(Number(secs) * fps);
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 800}});
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(origin + '/?capture=1&seed=831&hour=16.5', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 600000, polling: 500});
  await page.evaluate((v) => { document.querySelector('.loading')?.remove(); __astra.setHour(16.5); __astra.view(v); __astra.controls.view(v, true); for (let i = 0; i < 60; i++) __astra.step(0, false); }, view);
  for (let i = 0; i < total; i++) {
    const url = await page.evaluate((dt) => { __astra.setPaused(false); __astra.step(dt, false); __astra.setPaused(true); __astra.step(0); return __astra.renderer.domElement.toDataURL('image/jpeg', .88); }, 1 / fps);
    writeFileSync(frames + String(i).padStart(4, '0') + '.jpg', Buffer.from(url.split(',')[1], 'base64'));
    if (i % 24 === 0) console.log('frame', i, '/', total);
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', frames + '%04d.jpg', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dir + 'baseball-after.mp4']);
  rmSync(frames, {recursive: true}); console.log('wrote', dir + 'baseball-after.mp4');
} finally { await browser.close(); }
