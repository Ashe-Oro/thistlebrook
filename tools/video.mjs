// npm run video — records a ~70 s highlight reel of a seeded run (seed 7, untouched story) into shots/terrarium.mp4:
// the clean round-8 UI with speech bubbles, day → night, Found! Biscuit, the festival, the season-finale fireworks and
// the wedding vows. Frames come from the real renderer on a virtual clock; the page logs its music state and cues every
// frame, and that trace drives the same Music + Ambience engines offline (tools/music/render.mjs), muxed in as AAC.
import { chromium } from 'playwright'; import { start } from './serve.mjs'; import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const OUT = 'shots'; const TMP = '/tmp/terrarium-video'; fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
const srv = await start(5184);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = 1280, H = 720;
const ctx = await b.newContext({ viewport: { width: W, height: H } });
const p = await ctx.newPage(); const t0 = Date.now(); const errs = [];
// Offline, frame-exact capture: the page runs on a virtual clock (rAF, performance.now, timers) that we advance
// 1/30 s at a time, screenshotting every frame. Slow to record, but perfectly smooth at 30 fps regardless of SwiftShader.
await p.addInitScript(() => {
  let vt = 0, rafs = [], timers = [], tid = 1; const realNow = performance.now.bind(performance);
  window.__virtual = true; try { localStorage.setItem('thistlebrook.hinted', '1'); } catch {} performance.now = () => vt;
  window.requestAnimationFrame = cb => { rafs.push(cb); return rafs.length; }; window.cancelAnimationFrame = () => {};
  window.setTimeout = (f, ms = 0, ...a) => { const id = tid++; timers.push({ id, at: vt + (ms || 0), f, a }); return id; };
  window.clearTimeout = id => { timers = timers.filter(t => t.id !== id); };
  window.setInterval = (f, ms = 0, ...a) => { const id = tid++; const tick = () => { f(...a); const t = timers.find(t => t.id === id); }; const add = at => timers.push({ id, at, f: () => { f(...a); add(vt + Math.max(1, ms)); }, a: [] }); add(vt + Math.max(1, ms)); return id; };
  window.clearInterval = window.clearTimeout;
  window.__step = (ms) => { const end = vt + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers[0]; if (!t || t.at > end) break; timers.shift(); vt = Math.max(vt, t.at); try { t.f(...t.a); } catch (e) { console.error(e); } } vt = end; const c = rafs; rafs = []; for (const f of c) { try { f(vt); } catch (e) { console.error(e); } } };
  window.__pump = () => { window.__step(16); return realNow(); };
});
let frameN = 0, recording = false; const FPS = 24; let cdp; const trace = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:5184/?nopaper&fresh&nosave&capture&dynres=0&seed=' + (process.env.SEED || 7)); for (let k = 0; k < 4000; k++) { const ok = await p.evaluate(() => { for (let i = 0; i < 5; i++) window.__step(16); return !!(window.terrarium && document.querySelector('.loading.done')); }); if (ok) break; }
await p.evaluate(() => { for (let i = 0; i < 60; i++) window.__step(16); window.__musicCues = []; });
const run = async (code, arg) => p.evaluate(async ([c, a]) => { const F = Object.getPrototypeOf(async function () {}).constructor; return await new F('arg', c)(a); }, [code, arg]);
const wait = async ms => { const n = Math.max(1, Math.round(ms / 1000 * FPS)); for (let k = 0; k < n; k++) {
  const st = await p.evaluate(d => { window.__step(d); return { s: terrarium.musicState(), c: (window.__musicCues ?? []).splice(0).map(x => x[1]) }; }, 1000 / FPS);
  if (!recording) continue; trace.push({ t: frameN / FPS, s: st.s, cues: st.c });
  cdp ??= await ctx.newCDPSession(p); const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, optimizeForSpeed: true }); fs.writeFileSync(`${TMP}/f${String(frameN++).padStart(5, '0')}.jpg`, Buffer.from(r.data, 'base64')); } };
// fast-forward (quietly: no toasts, bubbles or unread badges pile up) to a game minute
const ffMin = m => run(`const S=terrarium.sim; while (S.clock < ${m}) terrarium.fastForward(Math.min(60, ${m} - S.clock + .01)); terrarium.ui().unread = 0; terrarium.ui().updateUnread();`);
const ffTo = h => ffMin(h * 60);
// a small, cozy lower-third (one line + an optional whisper) and a slow camera glide
await run(`
  const st=document.createElement('style'); st.textContent='.vcap{position:fixed;left:50%;top:64px;transform:translateX(-50%);background:rgba(48,34,20,.62);backdrop-filter:blur(4px);color:#fff4dd;font:600 19px/1.25 Georgia,serif;padding:7px 18px;border-radius:18px;opacity:0;transition:opacity .6s;z-index:999;text-align:center;max-width:80vw;white-space:nowrap}.vcap small{display:block;font:italic 400 13px Georgia,serif;opacity:.85;margin-top:2px}.vcap.on{opacity:1}.vcap.title{top:40%;font-size:40px;padding:14px 34px;border-radius:24px}';
  document.head.appendChild(st); const c=document.createElement('div'); c.className='vcap'; document.body.appendChild(c);
  window.cap=(t,s,title)=>{ c.className='vcap'+(title?' title':''); if(!t) return; c.innerHTML=t+(s?'<small>'+s+'</small>':''); requestAnimationFrame(()=>c.classList.add('on')); };
  window.glide=(x,z,d0,d1,y0,y1,p0,p1,ms)=>{ const T=performance.now(); const f=()=>{ const k=Math.min(1,(performance.now()-T)/ms), e=k*k*(3-2*k); terrarium.look(x,z,d0+(d1-d0)*e,y0+(y1-y0)*e,p0+(p1-p0)*e); if(k<1&&window._g===T) requestAnimationFrame(f); }; window._g=T; f(); };
  window.halt=()=>{ window._g=0; };
  // step minute by minute until a two-way conversation is queued (optionally near a spot); returns the pair
  window.findTalk=(near)=>{ const u=terrarium.ui(), S=terrarium.sim; for (let i=0;i<600;i++) { const c=u.convo.find(c=>c.listener&&c.at>S.clock+1.5); if (c) { const a=S.byId.get(c.who), l=S.byId.get(c.listener); if (a&&l&&!a.inside&&!l.inside&&Math.hypot(a.x-l.x,a.z-l.z)<4&&(!near||Math.hypot(a.x-near[0],a.z-near[1])<16)) return { a:c.who, l:c.listener, x:(a.x+l.x)/2, z:(a.z+l.z)/2 }; } terrarium.fastForward(1); } return null; };
`);
const cap = (t, s = '', title = false) => run('cap(arg[0],arg[1],arg[2])', [t, s, title]);
const beat = async ms => { await wait(ms); await cap(''); await wait(300); };
const talk = async (near, d0, d1, pitch, ms) => { const t = await run('const t=findTalk(arg); return t', near); if (t) await run(`halt(); terrarium.setMode('free'); terrarium.select(null); terrarium.setSpeed(1); glide(${t.x},${t.z},${d0},${d1},.5,.62,${pitch},${pitch - .05},${ms})`); return t; };
const story = [];

// 1 · title over a dawn glide
await ffTo(7.1); await run('terrarium.setSpeed(2); terrarium.select(null); glide(-6,-2,78,52,.2,.8,.95,.7,6000)');
recording = true;
await cap('Thistlebrook', 'a cozy village of 16 villagers, each with a story', true); await beat(4500);
// 2 · late morning in the plaza: speech bubbles over heads
await ffTo(11.9); story.push(['plaza', await talk([-8, 3], 24, 18, .62, 8000)]);
await cap('Everyone has a life, a plan and an opinion', 'and a word for their neighbours'); await beat(7500);
// 3 · close-up on a two-way exchange
story.push(['closeup', await talk(null, 10, 7.5, .45, 7000)]);
await wait(6500);
// 4 · tap a villager: their thoughts
await run(`terrarium.select('${story[1][1]?.a ?? 'jen'}')`); await cap('Tap anyone to peek at their thoughts'); await beat(3800); await run('terrarium.select(null)');
// 5 · day → night: golden hour over the plaza, then lanterns and a party
await ffTo(18.2); await run("halt(); terrarium.setSpeed(4); terrarium.setMode('free'); glide(-9,4,34,26,.4,.65,.5,.42,6000)"); await cap('Golden hour…'); await beat(5000);
await ffTo(20.6); await run(`halt(); terrarium.setSpeed(1); const S=terrarium.sim, p=S.parties.find(p=>!p.done&&p.at<=S.clock+30)||S.parties[S.parties.length-1]; const pl=S.place(p?p.place:'campfire'); glide(pl.cx, pl.cz+.5, 18, 11, .2, .7, .55, .4, 6500);`);
await cap('…and lanterns by night', 'parties happen when enough friends show up'); await beat(6000);
// 6 · Day 6: Biscuit the dog goes missing — and is found
// seed 7's untouched story: Pip finds Biscuit at 7895 (day 6), the festival opens at 8304, the finale fireworks ~9979.
// Stop a couple of game minutes early and let the director catch each beat live (beats never fire mid-fast-forward).
const at = (k, d) => +(process.env[k] || d);
await ffMin(at('FOUND', 7895) - 3); await run("halt(); terrarium.select(null); terrarium.setSpeed(1); terrarium.setMode('director');"); await wait(8500);
story.push(['found', await run("return [terrarium.sim.events.filter(e=>e.kind==='search').slice(-1)[0]?.text, terrarium.beatOn]")]);
// 7 · the festival
await ffMin(at('FEST', 8304) - 2); await run("halt(); terrarium.setSpeed(1); terrarium.setMode('director');"); await wait(7000);
await run("halt(); terrarium.setMode('free'); glide(-9,5,24,16,.3,.6,.55,.42,6000)"); await cap('Festival night'); await beat(5500);
story.push(['festival', await run('return [terrarium.sim.festivalUntil > terrarium.sim.clock, terrarium.sim.clock]')]);
// 8 · the season finale: awards, a dance and fireworks
await ffMin(at('FIRE', 9975)); await run("halt(); terrarium.setSpeed(1); terrarium.setMode('director');"); await wait(1500); await cap('The season finale'); await beat(7000);
story.push(['fireworks', await run('return [terrarium.sim.fireworksUntil > terrarium.sim.clock, terrarium.sim.clock]')]);
// 9 · a wedding: the vows, framed down the aisle
const wed = await run(`const S=terrarium.sim; let g=null; for (let i=0;i<24*12 && !g;i++) { g=S.gatherings.find(g=>g.kind==='wedding'&&!g.done&&g.at>S.clock); if (!g) terrarium.fastForward(60); } if (!g) return null; while (g.phase!=='vows' && S.clock < g.at + 29.5) terrarium.fastForward(Math.max(.05, Math.min(30, g.at + 29.5 - S.clock))); terrarium.setSpeed(1); terrarium.setMode('director'); return [g.phase,g.at,S.clock];`);
story.push(['wedding', wed]);
await wait(9000);
// 10 · goodnight
await run("halt(); terrarium.setMode('free'); terrarium.setSpeed(2); glide(-6,-2,40,70,.4,.9,.6,.85,4500)"); await cap('Thistlebrook', 'good night, little village', true); await wait(4000);
recording = false;
await ctx.close(); await b.close(); srv.close?.();
console.log('story', JSON.stringify(story));
const SECS = frameN / FPS; fs.writeFileSync(`${TMP}/trace.json`, JSON.stringify(trace));
execFileSync('node', ['tools/music/render.mjs'], { env: { ...process.env, TRACE: `${TMP}/trace.json`, OUT: 'terrarium_score', SECS: String(Math.ceil(SECS) + 2) }, stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${TMP}/f%05d.jpg`, '-i', '/tmp/music-prev/terrarium_score.mp3', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', process.env.CRF || '21', '-preset', 'slow', '-c:a', 'aac', '-b:a', '160k', '-af', `afade=t=in:d=1.2,afade=t=out:st=${(SECS - 3).toFixed(2)}:d=3`, '-shortest', '-movflags', '+faststart', `${OUT}/terrarium.mp4`]);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${OUT}/terrarium.mp4`]).toString().trim();
console.log('video', `${OUT}/terrarium.mp4`, dur + 's', frameN, 'frames', 'errors:', errs.length, errs.slice(0, 3));
process.exit(0);
