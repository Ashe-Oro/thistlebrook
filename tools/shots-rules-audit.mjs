import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import winter from '../src/skins/winter.js';
import { analyzeSnowHistogram } from '../src/astra/skin/winter-look.js';

const before = process.argv.includes('--before');
const folder = new URL('../shots/rules-audit/', import.meta.url);
const origin = process.env.RULES_ORIGIN || 'http://127.0.0.1:5293';
const prefix = before ? 'before' : 'after';

const shots = [
  { name: `${prefix}-autumn-harvest-r0`, skin: 'autumn', view: { x: -48, z: 26.5, zoom: 2.4, rotation: 0 }, hour: 14 },
  { name: `${prefix}-autumn-harvest-r1`, skin: 'autumn', view: { x: -48, z: 26.5, zoom: 2.4, rotation: 1 }, hour: 14 },
  { name: `${prefix}-autumn-mountains-r0`, skin: 'autumn', view: { x: 8, z: -190, zoom: 0.9, rotation: 0 }, hour: 14 },
  { name: `${prefix}-autumn-mountains-r1`, skin: 'autumn', view: { x: 8, z: -190, zoom: 0.9, rotation: 1 }, hour: 14 },
  { name: `${prefix}-winter-downtown`, skin: 'winter', view: { x: -57, z: -6, zoom: 3.1, rotation: 0 }, hour: 11 },
  { name: `${prefix}-winter-neighbourhood`, skin: 'winter', view: { x: -3, z: -9, zoom: 2.4, rotation: 0 }, hour: 11 },
];

await mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.routeWebSocket('**', (ws) => ws.close());
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`${origin}/?capture=1&seed=831&weather=clear&skin=cel&hour=11&view=harvest`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready || window.__astraError, null, { timeout: 240000, polling: 250 });
  assert.equal(await page.evaluate(() => window.__astraError), undefined, errors.join('\n'));

  const winterStats = [];
  for (const shot of shots) {
    const { image, pixels, width, height } = await page.evaluate(({ view, hour, skin, wantPixels }) => {
      const a = window.__astra;
      a.setSkin(skin);
      a.setWeather?.('clear');
      a.view(view);
      a.setHour(hour);
      a.step(0);
      const gl = a.renderer.getContext();
      const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
      let pixels = [];
      if (wantPixels) {
        const buf = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        pixels = Array.from(buf);
      }
      return { image: a.renderer.domElement.toDataURL().split(',')[1], pixels, width, height };
    }, { ...shot, wantPixels: shot.skin === 'winter' && !before });
    await writeFile(new URL(shot.name + '.png', folder), Buffer.from(image, 'base64'));
    if (shot.skin === 'winter' && !before) {
      const stats = analyzeSnowHistogram(Uint8Array.from(pixels), width, height);
      winterStats.push({ file: shot.name + '.png', ...stats });
      console.log(shot.name, stats);
    } else {
      console.log(shot.name, { width, height });
    }
  }
  if (!before) {
    await writeFile(new URL('winter-histogram.json', folder), JSON.stringify(winterStats, null, 2));
    for (const row of winterStats) assert(row.ok, `${row.file}: ${row.reason}`);
  }
  if (errors.length) console.warn('page errors', errors.slice(0, 4));
} finally {
  await browser.close();
}
