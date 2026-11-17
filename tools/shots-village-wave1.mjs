// Post-merge wave-1 stills: dressed street, in-town lineup, one interior.
// Build first. Playwright + Vite preview + Chrome / SwiftShader.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = new URL('../shots/village-wave1/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const evidence = { errors: [], shots: [] };
const checkpoint = () => writeFileSync(dir + 'evidence.json', JSON.stringify(evidence, null, 2));

const server = await preview({ preview: { port: 0, strictPort: true, host: '127.0.0.1' } });
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
let browser;
try {
  browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => { evidence.errors.push(String(e.stack || e)); checkpoint(); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) evidence.errors.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${base}/?size=large&seed=1234&life=1&hour=10&view=overview&prmax=1&shadowMap=512&cam=28,12,1&target=40,1,-14`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.addStyleTag({ content: '#look { display: none !important }' });

  evidence.runtime = await page.evaluate(() => ({
    interiors: __life.interiors?.plan?.map((r) => r.id) ?? [],
    artRows: __villageArt?.rows?.length ?? 0,
    people: __town.instances.filter((i) => i.id.startsWith('townsfolk-')).map((i) => i.id),
  }));
  assert.equal(evidence.runtime.people.length, 12, 'twelve townsfolk');
  assert(evidence.runtime.artRows > 50, `dressing rows ${evidence.runtime.artRows}`);
  assert.deepEqual(evidence.runtime.interiors, ['bakery', 'inn', 'store', 'smithy']);

  async function settle() {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  async function shot(name) {
    await settle();
    await page.screenshot({ path: dir + name + '.png' });
    evidence.shots.push({
      name,
      hour: await page.evaluate(() => __life.hour),
      interior: await page.evaluate(() => __life.interior),
    });
    checkpoint();
    console.log('shot', name);
  }

  await shot('street');

  await page.evaluate(() => {
    __life.setHour(10);
    __life.setTimescale(0);
    const people = [];
    __scene.traverse((o) => { if (o.userData.inst?.id.startsWith('townsfolk-')) people.push(o); });
    people.forEach((o, n) => {
      o.position.x = -4.5 + (n % 6) * 1.8;
      o.position.z = 3.4 + Math.floor(n / 6) * 3.4;
      o.rotation.set(0, 0, 0);
    });
    __stage.controls.minDistance = 1;
    __stage.camera.zoom = 1.3;
    __stage.camera.updateProjectionMatrix();
    __stage.camera.position.set(0, 10, 21);
    __stage.controls.target.set(0, 1, 5.1);
    __stage.controls.update();
  });
  await shot('townsfolk-lineup');

  await page.goto(`${base}/?size=large&seed=1234&life=1&hour=10&timescale=0&interior=bakery&prmax=1&shadowMap=512`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true && window.__life?.interior?.id === 'bakery', null, { timeout: 180000 });
  await page.addStyleTag({ content: '#look { display: none !important }' });
  await settle();
  evidence.interior = await page.evaluate(() => ({ id: __life.interior?.id, name: __life.interior?.name }));
  assert.equal(evidence.interior.id, 'bakery');
  await shot('interior');

  assert.deepEqual(evidence.errors, []);
  checkpoint();
  console.log('wave1 shots ok', evidence.shots.map((s) => s.name).join(','));
} finally {
  checkpoint();
  await browser?.close();
  await new Promise((r) => server.httpServer.close(r));
}
