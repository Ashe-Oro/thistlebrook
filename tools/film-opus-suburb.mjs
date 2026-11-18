// OWNER: opus-suburb lane. Maple Hollow tour: morning bus run, after-school
// yards, a BBQ evening and lights at night. Needs `npx vite --port <n>`.
// Usage: node tools/film-opus-suburb.mjs [origin] [fps=12] -> shots/opus-suburb/tour.mp4
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const [origin = 'http://localhost:5321', fpsArg = '12'] = process.argv.slice(2);
const fps = Number(fpsArg), dir = new URL('../shots/opus-suburb/', import.meta.url).pathname, frames = dir + '.tour-frames/';
rmSync(frames, {recursive: true, force: true}); mkdirSync(frames, {recursive: true});
// Each segment: start hour, seconds of film, game seconds per film second, camera (or 'bus' to follow it).
const SEGMENTS = [
  {title: 'morning bus', hour: 7.05, secs: 13, rate: 22, cam: 'bus', zoom: 3.2},
  {title: 'after school', hour: 16.15, secs: 9, rate: 10, cam: {x: 2, z: -152, zoom: 4.2, rotation: 0}},
  {title: 'bbq evening', hour: 19.75, secs: 8, rate: 8, cam: 'bbq', zoom: 5},
  {title: 'lights at night', hour: 19.9, secs: 10, rate: 60, cam: {x: 10, z: -146, zoom: 2.2, rotation: 0}},
];
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
let n = 0;
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 720}});
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(origin + '/?capture=1&seed=831&hour=6.5', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 900000, polling: 500});
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); document.querySelector('.ui')?.setAttribute('style', 'display:none'); });
  for (const seg of SEGMENTS) {
    // Jump to the hour and let the town settle (people walk there; the bus waits in its depot).
    await page.evaluate((h) => { __astra.setPaused(false); __astra.setHour(h); for (let i = 0; i < 150; i++) __astra.step(.1, false); }, seg.hour - .25);
    const total = Math.round(seg.secs * fps), per = seg.rate / fps;
    for (let f = 0; f < total; f++) {
      const url = await page.evaluate(({seg, per, f, total}) => {
        const steps = Math.max(1, Math.round(per / .1)); for (let i = 0; i < steps; i++) __astra.step(per / steps, false);
        let v = seg.cam;
        if (v === 'bus') { const b = __astra.world.landscape.traffic.vehicles.find((x) => x.kind === 'school-bus'); v = {x: b.position[0], z: b.position[1], zoom: seg.zoom, rotation: 0}; }
        if (v === 'bbq') { const host = __astra.town.registry.places.find((p) => p.id.startsWith('mh-bbq:') && __astra.residents.life.actors.some((a) => a.context.location.place === p.id)) || __astra.town.registry.places.find((p) => p.id.startsWith('mh-bbq:')); v = {x: host.pos[0] + 1, z: host.pos[1] + 1, zoom: seg.zoom, rotation: 0}; }
        __astra.view(v); __astra.controls.view(v, true); __astra.step(0);
        return __astra.renderer.domElement.toDataURL('image/jpeg', .9);
      }, {seg, per, f, total});
      writeFileSync(`${frames}${String(n++).padStart(5, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log('segment', seg.title, 'frames', n);
  }
} finally { await browser.close(); }
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', frames + '%05d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', dir + 'tour.mp4']);
rmSync(frames, {recursive: true, force: true});
console.log('wrote', dir + 'tour.mp4', n, 'frames');
