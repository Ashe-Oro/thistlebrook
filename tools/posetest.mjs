import { chromium } from 'playwright'; import { start } from './serve.mjs';
const srv = await start(0); const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 500 } }); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => m.type() === 'error' && console.log('CERR', m.text()));
await p.addInitScript(`window.POSES = ${process.argv[2]}`);
await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.waitForFunction(() => window.result, null, { timeout: 30000 });
console.log(JSON.stringify(await p.evaluate(() => window.result)).slice(0, 1500)); await p.screenshot({ path: process.argv[3] || 'shots/pose.png' }); await b.close(); srv.close();
