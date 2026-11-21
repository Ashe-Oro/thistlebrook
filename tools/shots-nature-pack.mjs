#!/usr/bin/env node
// Contact sheets of every GLB in the owned Nature pack, rendered headless in
// the town's cel look beside a villager (tools/nature-pack-sheet.html).
// Pack GLBs are streamed to the page by request interception from the pack
// folder; nothing is copied into public/ or the repository.
// Usage: npx vite --port 5291 --strictPort, then
//   node tools/shots-nature-pack.mjs [origin] [outDir]
import {chromium} from 'playwright-core';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
const PACK = '/workspace/threejs-assets/nature/bundle/glb';
const [origin = 'http://127.0.0.1:5291', dir = '/workspace/scratch/opus-nature'] = process.argv.slice(2);
mkdirSync(dir, {recursive: true});
const stats = JSON.parse(readFileSync(join(dir, 'pack-stats.json'), 'utf8'));
const note = (s) => `${s.size.join('×')} m · ${(s.tris / 1000).toFixed(1)}k tris`;
const sheets = {
  'nature-pack-sheet-1': Object.entries(stats.individual).slice(0, 40).map(([id, s]) => ({id, url: `/nature-pack/individual/${id}.glb`, note: note(s)})),
  'nature-pack-sheet-2': [
    ...Object.entries(stats.individual).slice(40).map(([id, s]) => ({id, url: `/nature-pack/individual/${id}.glb`, note: note(s)})),
    ...Object.entries(stats.prebuilds).map(([id, s]) => ({id: 'prebuild/' + id, url: `/nature-pack/prebuilds/${id}.glb`, note: note(s)})),
    {id: 'nature.glb (catalog)', url: '/nature-pack/nature.glb', note: note(stats.catalog)},
  ],
};
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 800, height: 600}});
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/nature-pack/**', (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/nature-pack\//, ''));
    if (rel.includes('..')) return route.abort();
    route.fulfill({status: 200, contentType: 'model/gltf-binary', body: readFileSync(join(PACK, rel))});
  });
  await page.goto(origin + '/tools/nature-pack-sheet.html');
  await page.waitForFunction(() => window.__sheetReady, null, {timeout: 300000});
  for (const [name, items] of Object.entries(sheets)) {
    const {url, failed} = await page.evaluate(({items}) => window.renderSheet(items, 7), {items});
    writeFileSync(join(dir, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', join(dir, name + '.png'), items.length, 'models', failed.length ? 'FAILED ' + failed.join('; ') : '');
  }
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5));
} finally { await browser.close(); }
