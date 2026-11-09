// Quick headless poke: node tools/shot.mjs out.png "<js to eval after load>" [w h]
import { chromium } from 'playwright'; import { start } from './serve.mjs';
const [out = 'shots/dev.png', code = '', w = 1600, h = 900] = process.argv.slice(2);
const srv = await start(5180);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } }); const errs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); p.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message));
await p.goto('http://localhost:5180/?nopaper&capture'); await p.waitForFunction(() => window.terrarium && document.querySelector('.loading.done'), null, { timeout: 120000 }).catch(e => errs.push('load timeout'));
await p.waitForTimeout(1500);
if (code) { const r = await p.evaluate(async c => { const AsyncF = Object.getPrototypeOf(async function () {}).constructor; return await new AsyncF(c)(); }, code).catch(e => 'EVAL ERR ' + e.message); if (r !== undefined) console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 1)); }
await p.screenshot({ path: out }); console.log('errors:', errs.slice(0, 15).join('\n')); await b.close(); srv.close(); process.exit(0);
