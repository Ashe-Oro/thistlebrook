// node tools/seq.mjs steps.mjs  — steps module exports default array of [jsCode, screenshotPathOrNull, waitMs]
import { chromium } from 'playwright'; import { start } from './serve.mjs'; import path from 'node:path';
const steps = (await import(path.resolve(process.argv[2]))).default; const W = +(process.argv[3] || 1600), H = +(process.argv[4] || 900);
const srv = await start(5181);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
await p.goto('http://localhost:5181/?nopaper&capture&dynres=0&seed=' + (process.env.SEED || 7)); await p.waitForFunction(() => window.terrarium && document.querySelector('.loading.done'), null, { timeout: 120000 });
await p.waitForTimeout(800);
for (const [code, shot, wait] of steps) {
  if (code) { const r = await p.evaluate(async c => { const F = Object.getPrototypeOf(async function () {}).constructor; return await new F(c)(); }, code).catch(e => 'EVAL ERR ' + e.message); if (r !== undefined) console.log(typeof r === 'string' ? r : JSON.stringify(r)); }
  if (wait) await p.waitForTimeout(wait);
  if (shot) { await p.screenshot({ path: shot }); console.log('shot', shot); }
}
console.log('errors:', errs.slice(0, 20).join('\n')); await b.close(); srv.close(); process.exit(0);
