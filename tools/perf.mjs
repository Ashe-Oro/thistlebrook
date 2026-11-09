// node tools/perf.mjs [w] [h] — headless fps probe: steady-state fps, sim ms, draw calls, triangles at a few camera spots.
import { chromium } from 'playwright'; import { start } from './serve.mjs';
const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 720), Q = process.env.Q || '';
const srv = await start(5191);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(process.env.MOBILE ? { viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: W, height: H } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:5191/?nopaper&seed=7${Q}`); await p.waitForFunction(() => window.terrarium && document.querySelector('.loading.done'), null, { timeout: 120000 });
await p.evaluate(() => terrarium.fastForward(10 * 60 - terrarium.sim.clock));
const spots = { overview: 'terrarium.look(-6,-2,62,.55,.85)', plaza: 'terrarium.look(-9,4,22,.45,.5)', director: "terrarium.setMode('director')" };
const out = {};
for (const [k, js] of Object.entries(spots)) {
  await p.evaluate(js); await p.waitForTimeout(+(process.env.SETTLE || 6000));
  out[k] = await p.evaluate(async () => { const t0 = performance.now(); let n = 0; await new Promise(r => { const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); const i = terrarium.renderer.info; return { fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), simMs: +terrarium.simMs.toFixed(2), cpuMs: +terrarium.cpuMs.toFixed(2), calls: i.render.calls, tris: i.render.triangles, px: +terrarium.renderer.getPixelRatio().toFixed(2), gameFps: +terrarium.fps.toFixed(1) }; });
}
console.log(JSON.stringify({ W, H, Q, ...out, errs }));
await b.close(); srv.close(); process.exit(0);
