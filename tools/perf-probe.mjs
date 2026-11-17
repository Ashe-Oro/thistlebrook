// One-off: read window.__perf from a built page (?perf=1). Not wired into npm.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
const path = process.argv[2] || '/compile.html?seed=1234&perf=1';
const server = await preview({ preview: { port: 0, strictPort: true, host: '127.0.0.1' } });
// Port 0 = a fresh OS-assigned port, so a stale preview server can never answer.
const BASE_URL = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e.stack || e)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(BASE_URL + path);
await page.waitForFunction(() => window.__perf !== undefined, null, { timeout: 40000 });
console.log('PERF', JSON.stringify(await page.evaluate(() => window.__perf)));
await browser.close();
server.httpServer.close();
