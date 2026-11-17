import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

mkdirSync(new URL('../shots/', import.meta.url), { recursive: true });
const server = await preview({ preview: { port: 0, strictPort: true, host: '127.0.0.1' } });
const BASE = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});

const shots = [
  ['large-overview-persp', '/?size=large&seed=1234&perf=1'],
  ['large-overview-iso', '/?size=large&seed=1234&cam=iso'],
  ['large-market-persp', '/?size=large&seed=1234&target=42,2,-14&cam=78,28,22'],
  ['large-farm-persp', '/?size=large&seed=1234&target=72,2,-18&cam=108,26,18'],
  ['large-plaza-iso', '/?size=large&seed=1234&cam=iso&target=0,0,0'],
];

const perfs = {};
try {
  for (const [name, path] of shots) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e.stack || e)));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errs.push(r.status() + ' ' + r.url()); });
    const t0 = Date.now();
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    } catch (e) {
      console.error(`${name}: never ready after ${Date.now() - t0}ms\n  ` + errs.join('\n  '));
      await page.screenshot({ path: new URL(`../shots/${name}-failed.png`, import.meta.url).pathname });
      throw e;
    }
    if (path.includes('perf=1')) {
      await page.waitForFunction(() => !!window.__perf, null, { timeout: 30000 }).catch(() => {});
      perfs[name] = await page.evaluate(() => window.__perf || null);
    }
    await page.waitForTimeout(2000);
    const file = new URL(`../shots/${name}.png`, import.meta.url).pathname;
    await page.screenshot({ path: file });
    console.log('shot', file, 'loadMs', Date.now() - t0, 'perf', JSON.stringify(perfs[name] || null), errs.length ? '\n  console: ' + errs.slice(0, 12).join('\n  ') : '');
    await page.close();
  }
} finally {
  await browser.close();
  server.httpServer.close();
}
console.log('PERF', JSON.stringify(perfs, null, 2));
