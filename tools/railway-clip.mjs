// railway-loop arrival clip: the steam set running into Lantern Quay (seed 831).
// Usage: node tools/railway-clip.mjs [baseUrl] [station] -> shots/railway-loop/arrival-<station>.mp4
import {chromium} from 'playwright-core';
import {mkdirSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const [base = 'http://127.0.0.1:5251', station = 'quay'] = process.argv.slice(2);
const dir = new URL('../shots/railway-loop/', import.meta.url).pathname, frames = '/tmp/railway-clip-frames/';
rmSync(frames, {recursive: true, force: true}); mkdirSync(frames, {recursive: true});
const view = {quay: {x: 50, z: -56, zoom: 4.2}, airport: {x: 70, z: -152, zoom: 4.4}, union: {x: -88, z: -162, zoom: 4.4}}[station];
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(base + '/?capture=1&seed=831', {timeout: 300000});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 600000, polling: 500});
  await page.evaluate(({view, station}) => {
    document.querySelector('.loading')?.remove(); document.querySelectorAll('.ui,.panel,.card,.hud').forEach((e) => e.style.display = 'none');
    __astra.setHour(10); const rw = __astra.world.railway;
    // Run until the train is ~20 s out from the station, then frame it.
    for (let n = 0; n < 20000; n++) { __astra.step(.25, false); const t = rw.service.train; if (t.phase === 'run' && t.next === station) { const st = rw.service.rail.stations.find((s) => s.id === station), d = ((st.s - t.s) % rw.service.rail.length + rw.service.rail.length) % rw.service.rail.length; if (d < 75) break; } }
    __astra.controls.view(view, true); __astra.step(0);
  }, {view, station});
  for (let f = 0; f < 120; f++) {
    await page.evaluate(() => { for (let k = 0; k < 2; k++) __astra.step(.125, false); __astra.step(0); });
    await page.screenshot({path: `${frames}${String(f).padStart(4, '0')}.png`, timeout: 120000});
  }
} finally { await browser.close(); }
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', frames + '%04d.png', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '24', dir + `arrival-${station}.mp4`]);
console.log(dir + `arrival-${station}.mp4`);
