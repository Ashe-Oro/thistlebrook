// Headless screenshots of the built pages (run `npm run build` first).
// Serves dist/ with vite preview, renders in system Chrome via SwiftShader.
//   node tools/shots.mjs [name=url-path ...]
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

// `--post` renders before/after pairs for the post chain (seeds 1234 & 7,
// perspective + iso). Otherwise: explicit name=url-path args, or the defaults.
function postPairs() {
  const out = [];
  for (const seed of [1234, 7]) {
    for (const [tag, cam] of [['persp', ''], ['iso', '&cam=iso']]) {
      out.push([`post-${seed}-${tag}-before`, `/compile.html?seed=${seed}&post=0${cam}`]);
      out.push([`post-${seed}-${tag}-after`, `/compile.html?seed=${seed}${cam}`]);
    }
  }
  return out;
}

const rest = process.argv.slice(2);
const shots = rest.includes('--post')
  ? postPairs()
  : rest.length
    ? rest.map((a) => [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)])
    : [['hamlet', '/'], ['kit', '/kit.html'], ['kit-clean', '/kit.html?anchors=&labels=0']];
mkdirSync(new URL('../shots/', import.meta.url), { recursive: true });

const server = await preview({ preview: { port: 0, strictPort: true, host: '127.0.0.1' } });
// Port 0 = a fresh OS-assigned port, so a stale preview server can never answer.
const BASE_URL = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
try {
  for (const [name, path] of shots) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e.stack || e)));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errs.push(r.status() + ' ' + r.url()); });
    await page.goto(BASE_URL + path);
    try {
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
    } catch (e) {
      console.error(`${name}: scene never became ready\n  ` + errs.join('\n  '));
      throw e;
    }
    await page.waitForTimeout(1500);
    const file = new URL(`../shots/${name}.png`, import.meta.url).pathname;
    await page.screenshot({ path: file });
    console.log('shot', file, errs.length ? '\n  console: ' + errs.join('\n  ') : '');
    await page.close();
  }
} finally {
  await browser.close();
  server.httpServer.close();
}
