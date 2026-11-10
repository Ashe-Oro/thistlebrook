// node tools/music_demo.mjs — ~60 s capture of a day → dusk → night transition with the adaptive score, at shots/music_demo.mp4.
// Frames come from the real renderer on a virtual clock. The page logs its music state and cues every frame,
// and that trace drives the same Music + Ambience engines offline, so picture and score line up exactly.
import { chromium } from 'playwright'; import { start } from './serve.mjs'; import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const TMP = '/tmp/terrarium-musicdemo'; fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
const srv = await start(5186), FPS = 24, SECS = +(process.env.SECS || 60);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); const errs = [];
await p.addInitScript(() => {
  let vt = 0, rafs = [], timers = [], tid = 1; const realNow = performance.now.bind(performance);
  window.__virtual = true; performance.now = () => vt;
  window.requestAnimationFrame = cb => { rafs.push(cb); return rafs.length; }; window.cancelAnimationFrame = () => {};
  window.setTimeout = (f, ms = 0, ...a) => { const id = tid++; timers.push({ id, at: vt + (ms || 0), f, a }); return id; };
  window.clearTimeout = id => { timers = timers.filter(t => t.id !== id); };
  window.setInterval = (f, ms = 0, ...a) => { const id = tid++; const tick = () => { f(...a); const t = timers.find(t => t.id === id); }; const add = at => timers.push({ id, at, f: () => { f(...a); add(vt + Math.max(1, ms)); }, a: [] }); add(vt + Math.max(1, ms)); return id; };
  window.clearInterval = window.clearTimeout;
  window.__step = (ms) => { const end = vt + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers[0]; if (!t || t.at > end) break; timers.shift(); vt = Math.max(vt, t.at); try { t.f(...t.a); } catch (e) { console.error(e); } } vt = end; const c = rafs; rafs = []; for (const f of c) { try { f(vt); } catch (e) { console.error(e); } } };
  window.__pump = () => { window.__step(16); return realNow(); };
});

p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:5186/?nopaper&fresh&nosave&capture&dynres=0&seed=' + (process.env.SEED || 7));
for (let k = 0; k < 4000; k++) { const ok = await p.evaluate(() => { for (let i = 0; i < 5; i++) window.__step(16); return !!(window.terrarium && document.querySelector('.loading.done')); }); if (ok) break; }
await p.evaluate(() => { const S = terrarium.sim, m = 17.8 * 60; while (S.clock < m) terrarium.fastForward(Math.min(60, m - S.clock + .01)); terrarium.setMode('director'); terrarium.setSpeed(1.6); window.__musicCues = []; for (let i = 0; i < 48; i++) window.__step(1000 / 24); });
await p.evaluate(() => { const st = document.createElement('style'); st.textContent = '.mcap{position:fixed;left:24px;bottom:96px;z-index:999;background:rgba(34,24,14,.8);color:#fff3dc;font:600 17px Georgia,serif;padding:8px 14px;border-radius:10px}'; document.head.appendChild(st); const c = document.createElement('div'); c.className = 'mcap'; document.body.appendChild(c); window.__mcap = c; });
const cdp = await ctx.newCDPSession(p), trace = []; let lastCue = 0;
for (let f = 0; f < SECS * FPS; f++) {
  const st = await p.evaluate(d => { window.__step(d); const s = terrarium.musicState(), c = window.__musicCues.splice(0).map(x => x[1]); const th = s.festival ? 'festival' : s.night > .6 ? 'night' : s.night > .25 ? 'dusk' : s.plaza > .5 ? 'village' : 'day field'; window.__mcap.textContent = `♪ ${th} · ${String(Math.floor(terrarium.sim.hour)).padStart(2, '0')}:${String(Math.floor(terrarium.sim.hour % 1 * 60)).padStart(2, '0')}`; return { s, c }; }, 1000 / FPS);
  trace.push({ t: f / FPS, s: st.s, cues: st.c }); if (st.c.length) lastCue = f;
  const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, optimizeForSpeed: true }); fs.writeFileSync(`${TMP}/f${String(f).padStart(5, '0')}.jpg`, Buffer.from(r.data, 'base64'));
  if (f % 240 === 0) console.log('frame', f, JSON.stringify(st.s));
}
void lastCue; await b.close(); srv.close();
fs.writeFileSync(`${TMP}/trace.json`, JSON.stringify(trace));
execFileSync('node', ['tools/music/render.mjs'], { env: { ...process.env, TRACE: `${TMP}/trace.json`, OUT: 'music_demo', SECS: String(SECS + 3) }, stdio: 'inherit' });
fs.mkdirSync('shots', { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${TMP}/f%05d.jpg`, '-i', '/tmp/music-prev/music_demo.mp3', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-af', `afade=t=out:st=${SECS - 2.5}:d=2.5`, '-shortest', '-movflags', '+faststart', 'shots/music_demo.mp4']);
console.log('music demo shots/music_demo.mp4', SECS, 's, errors:', errs.length ? errs : 'none');
