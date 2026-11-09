import { chromium } from 'playwright'; import { start } from '/workspace/terrarium/tools/serve.mjs'; import fs from 'node:fs';
const srv = await start(5189);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://127.0.0.1:5189/?nopaper&capture&seed=7'); await p.waitForFunction(() => window.terrarium && document.querySelector('.loading.done'), null, { timeout: 120000 });
await p.evaluate(() => { const S = terrarium.sim; while (S.clock < 10 * 60) terrarium.fastForward(30); });
await p.evaluate(() => { window._pmain = 1; }); await p.waitForTimeout(1500);
const urls = await p.evaluate(() => terrarium.sim.villagers.map(v => { const c = terrarium.ui().app.portrait(v.id); return [v.id, v.inside, c.toDataURL()]; }));
for (const [id, ins, u] of urls) { fs.writeFileSync(`/tmp/pt_${id}.png`, Buffer.from(u.split(',')[1], 'base64')); console.log(id, ins); }
await b.close(); srv.close(); process.exit(0);
