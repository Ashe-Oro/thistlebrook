// school-day review stills (seed 831, a weekday: the first simulated day is a Friday).
// Usage: node tools/school-day-shots.mjs <baseUrl> <prefix> [name ...]
//   node tools/school-day-shots.mjs http://127.0.0.1:5292 before campus door
//   node tools/school-day-shots.mjs http://127.0.0.1:5291 after
// Writes shots/school-day/<prefix>-<name>.png and prints the school state per view.
import {chromium} from 'playwright-core';
import {mkdirSync} from 'node:fs';
const [base = 'http://127.0.0.1:5291', prefix = 'after', ...only] = process.argv.slice(2);
const dir = new URL('../shots/school-day/', import.meta.url).pathname; mkdirSync(dir, {recursive: true});
// [name, x, z, zoom, hour, classroom?]
export const VIEWS = [
  ['campus', 6, -58, 2.6, 8.25],
  ['door', 4, -57, 5.2, 8.25],
  ['arrival', 7, -57, 5.4, 8.1],
  ['class', 0, 0, 1, 9.1, true],
  ['recess', -25, -43, 5.2, 10.5],
  ['dismissal', -4, -56, 3.4, 14.95],
  ['dismissal-room', 0, 0, 1, 15.6, true],
];
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}}), errors = [];
  page.on('pageerror', (e) => errors.push(e.stack)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(base + '/?capture=1&seed=831', {timeout: 300000});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 600000, polling: 500});
  const err = await page.evaluate(() => window.__astraError); if (err) throw Error(err);
  await page.evaluate(() => { document.querySelector('.loading')?.remove(); document.querySelectorAll('.view-tabs,.intro,.card,.moment,.bottom,.top-right,.masthead,.seed-label,.map-note').forEach((e) => e.style.display = 'none'); __astra.step(0); });
  for (const [name, x, z, zoom, hour, room] of VIEWS.filter((v) => !only.length || only.includes(v[0]))) {
    const info = await page.evaluate(async ({x, z, zoom, hour, room}) => {
      __astra.school?.leave?.();
      __astra.setHour(hour);
      // Let walkers, mixers and crossfades settle at this hour.
      for (let n = 0; n < 24; n++) __astra.step(.05, false);
      if (room && __astra.school) { await __astra.school.enter(__astra.hour, (4 + __astra.residents.life.day) % 7); for (let n = 0; n < 24; n++) __astra.step(.05, false); }
      else __astra.controls.view({x, z, zoom, rotation: 0}, true);
      __astra.step(0);
      const s = room ? __astra.school.state() : __astra.world.districts.civic.school.state;
      return {hour: +__astra.hour.toFixed(2), day: __astra.residents.life.day, calls: __astra.renderer.info.render.calls, session: s?.session?.id, occupancy: s?.occupancy, teacher: s?.teacher?.activity};
    }, {x, z, zoom, hour, room});
    await page.screenshot({path: `${dir}${prefix}-${name}.png`, timeout: 120000});
    console.log(prefix, name, JSON.stringify(info));
  }
  if (errors.length) console.error(errors.slice(0, 5).join('\n'));
} finally { await browser.close(); }
