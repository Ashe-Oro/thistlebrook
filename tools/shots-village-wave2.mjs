// Post-merge wave-2 stills: living village + world registry still works with art/interiors.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = new URL('../shots/village-wave2/', import.meta.url).pathname;
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
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => { evidence.errors.push(String(e.stack || e)); checkpoint(); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) evidence.errors.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${base}/?size=large&seed=1234&life=1&hour=10&view=overview&prmax=1&shadowMap=512&cam=28,12,1&target=40,1,-14`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.addStyleTag({ content: '#look { display: none !important }' });

  evidence.registry = await page.evaluate(() => {
    const reg = window.__town.registry;
    const byType = (type) => (reg?.places || []).filter((p) => p.type === type);
    const byName = (name) => (reg?.places || []).find((p) => p.name === name);
    const civics = ['bakery', 'tavern', 'store', 'smithy', 'plaza'].map((type) => {
      const hit = byType(type)[0];
      const entry = hit?.points?.find((pt) => pt.kind === 'entry' || pt.kind === 'door');
      return hit && { id: hit.id, type: hit.type, name: hit.name, entryNode: entry?.node ?? hit.entryNode ?? -1, capabilities: hit.capabilities };
    });
    const bakery = byName('The Flour & Fern') || byType('bakery')[0];
    return {
      placeCount: reg?.places?.length ?? 0,
      hasGraph: !!reg?.graph,
      bakery: bakery && { id: bakery.id, name: bakery.name, entryNode: bakery.points?.find((pt) => pt.node >= 0)?.node ?? bakery.entryNode ?? -1 },
      civics,
    };
  });
  assert(evidence.registry.placeCount > 20, `places ${evidence.registry.placeCount}`);
  assert.equal(evidence.registry.bakery?.name, 'The Flour & Fern');
  assert(evidence.registry.bakery.entryNode >= 0, 'bakery entry node');
  const names = evidence.registry.civics.filter(Boolean).map((c) => c.name);
  for (const want of ['The Flour & Fern', 'The Copper Kettle', 'Willowmere Provisions', "Bram's Workshop"]) {
    assert(names.includes(want), `missing civic name ${want}: ${names}`);
  }

  async function settle() {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  async function shot(name) {
    await settle();
    await page.screenshot({ path: dir + name + '.png' });
    evidence.shots.push({ name, hour: await page.evaluate(() => __life.hour), interior: await page.evaluate(() => __life.interior) });
    checkpoint();
    console.log('shot', name);
  }

  await shot('street');

  // Overview with registry civic names pinned on their world positions.
  await page.evaluate(() => {
    __stage.camera.position.set(8, 28, 42);
    __stage.controls.target.set(8, 0, 0);
    __stage.controls.update();
  });
  await settle();
  await page.evaluate(() => {
    const cam = __stage.camera, types = ['bakery', 'tavern', 'store', 'smithy', 'plaza', 'well'];
    document.getElementById('registry-labels')?.remove();
    const root = document.createElement('div');
    root.id = 'registry-labels';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;font:600 13px/1.2 system-ui';
    for (const type of types) {
      const place = (__town.registry?.places || []).find((p) => p.type === type);
      if (!place) continue;
      const v = new __THREE.Vector3(place.pos[0], 2.2, place.pos[1]).project(cam);
      const el = document.createElement('div');
      el.textContent = place.name;
      el.style.cssText = `position:absolute;left:${(v.x * 0.5 + 0.5) * 100}%;top:${(-v.y * 0.5 + 0.5) * 100}%;transform:translate(-50%,-120%);background:#182c35ee;color:#fff0cd;border:1px solid #e4d4a566;border-radius:8px;padding:4px 8px;white-space:nowrap;`;
      root.append(el);
    }
    document.body.append(root);
  });
  await shot('places');
  await page.evaluate(() => document.getElementById('registry-labels')?.remove());

  await page.goto(`${base}/?size=large&seed=1234&life=1&hour=10&timescale=0&interior=bakery&prmax=1&shadowMap=512`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true && window.__life?.interior?.id === 'bakery', null, { timeout: 180000 });
  await page.addStyleTag({ content: '#look { display: none !important }' });
  await shot('interior');

  assert.deepEqual(evidence.errors, []);
  checkpoint();
  console.log('wave2 shots ok', evidence.shots.map((s) => s.name).join(','));
} finally {
  checkpoint();
  await browser?.close();
  await new Promise((r) => server.httpServer.close(r));
}
