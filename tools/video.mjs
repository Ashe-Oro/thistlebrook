// npm run video — records a ~50 s "director's cut" of a seeded run into shots/terrarium.mp4 (real renderer, staged beats).
import { chromium } from 'playwright'; import { start } from './serve.mjs'; import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const OUT = 'shots'; const TMP = '/tmp/terrarium-video'; fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
const srv = await start(5184);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = 1280, H = 720;
const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: TMP, size: { width: W, height: H } } });
const p = await ctx.newPage(); const t0 = Date.now(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:5184/?nopaper&capture&seed=' + (process.env.SEED || 7)); await p.waitForFunction(() => window.terrarium && document.querySelector('.loading.done'), null, { timeout: 180000 });
const run = async (code, arg) => p.evaluate(async ([c, a]) => { const F = Object.getPrototypeOf(async function () {}).constructor; return await new F('arg', c)(a); }, [code, arg]);
const wait = ms => p.waitForTimeout(ms);
const ffTo = h => run(`const S=terrarium.sim; while (S.clock < ${h * 60}) terrarium.fastForward(Math.min(60, ${h * 60} - S.clock + .01));`);
// cinematic helpers living in the page: caption lower-third and a slow camera glide
await run(`
  const st=document.createElement('style'); st.textContent='.cine{position:fixed;left:50%;bottom:54px;transform:translateX(-50%);background:rgba(34,24,14,.82);color:#fff3dc;font:600 26px/1.25 Georgia,serif;padding:12px 26px;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.35);opacity:0;transition:opacity .5s;z-index:999;text-align:center;max-width:80vw}.cine small{display:block;font:500 16px system-ui;opacity:.8;margin-top:4px}.cine.on{opacity:1}.cine.title{bottom:auto;top:38%;font-size:46px;padding:20px 40px}';
  document.head.appendChild(st); const c=document.createElement('div'); c.className='cine'; document.body.appendChild(c);
  window.cap=(t,s,title)=>{ c.className='cine'+(title?' title':''); if(!t) return; c.innerHTML=t+(s?'<small>'+s+'</small>':''); requestAnimationFrame(()=>c.classList.add('on')); };
  window.glide=(x,z,d0,d1,y0,y1,p0,p1,ms)=>{ const T=performance.now(); const f=()=>{ const k=Math.min(1,(performance.now()-T)/ms), e=k*k*(3-2*k); terrarium.look(x,z,d0+(d1-d0)*e,y0+(y1-y0)*e,p0+(p1-p0)*e); if(k<1&&window._g===T) requestAnimationFrame(f); }; window._g=T; f(); };
  window.halt=()=>{ window._g=0; };
`);
const cap = (t, s = '', title = false) => run('cap(arg[0],arg[1],arg[2])', [t, s, title]);
const beat = async (ms) => { await wait(ms); await cap(''); await wait(350); };
const stage = (id, act, extra = '') => run(`const S=terrarium.sim, v=S.byId.get(arg[0]); S.leaveSeat(v); v.inside=null; v.avatar.targetAlpha=1; v.busyUntil=0; v.queue=[]; v.act=Object.assign({t:0,label:'…'},arg[1]); ${extra}`, [id, act]);
const marks = [];

// 1 · title over a dawn glide
await ffTo(7.1); await run('terrarium.setSpeed(2); terrarium.select(null); glide(-6,-2,78,52,.2,.8,.95,.7,6500)');
marks.push((Date.now() - t0) / 1000);
await cap('Thistlebrook', 'a digital terrarium · eight villagers, one small town', true); await beat(4800);
// 2 · morning routines (follow-cam)
await ffTo(9.8); await run(`const S=terrarium.sim, v=S.villagers.find(v=>v.job==='woodcutter'); if(v&&v.anim!=='chop'){v.act=null;v.queue=[];S.brain.work(v,S);} halt(); terrarium.setSpeed(1); terrarium.select(v.id); terrarium.setMode('follow');`);
await cap('Everyone has a day plan, needs, traits and a goal', 'and replans when life gets in the way'); await beat(5200);
// 3 · lunch in the plaza: gossip
await ffTo(12.25); await run("terrarium.select(null); terrarium.setMode('free'); terrarium.setSpeed(2); glide(-9,4,26,17,.2,.6,.6,.45,6000)");
await cap('Lunch is where the gossip happens', 'facts spread memory to memory, and rumours bend them'); await beat(5600);
// 4 · a theft and a chase
await run(`const S=terrarium.sim, thief=S.villagers.slice().sort((a,b)=>(b.traits.envy-b.traits.honesty)-(a.traits.envy-a.traits.honesty))[0]; const k=[...S.keepsakes.values()].find(k=>k.holder===k.owner&&k.owner!==thief.id&&!S.byId.get(k.owner).inside); const mark=S.byId.get(k.owner); window._thief=thief.id; window._mark=mark.id; mark.traits.bravery=Math.max(mark.traits.bravery,.6); return [thief.id,mark.id,k.id]`).then(async ([thief, mark, loot]) => {
  await stage(mark, { type: 'idle', dur: 40, anim: 'idle', label: 'minding my own business' }, 'v.x=-8.5; v.z=3.2; v.heading=Math.PI/2;');
  await stage(thief, { type: 'steal', target: mark, loot, label: 'eyeing it…' }, 'v.x=-11.5; v.z=4.5;');
  await run(`terrarium.setSpeed(1); halt(); terrarium.select('${thief}'); terrarium.setMode('follow');`);
});
await cap('Pinch a keepsake… and hope nobody sees', 'witnesses, chases, scuffles — and long grudges'); await beat(6500);
// 5 · the villager card
await run(`terrarium.setMode('free'); terrarium.select(window._mark);`);
await cap('Click anyone to read their mind', 'portrait, mood, plan, current thought, who they love and loathe'); await beat(5000);
// 6 · evening: a confession by the pond
await ffTo(18.4); await run(`const S=terrarium.sim, pair=[]; for (const v of S.villagers) for (const u of S.villagers) if (v!==u && !v.partner && !u.partner && !v.family.includes(u.id) && v.def.age!=='teen' && u.def.age!=='teen' && !pair.length && v.crush===u.id) pair.push(v.id,u.id); if(!pair.length){ const a=S.byId.get('ollie'), b=S.byId.get('jen'); pair.push(a.id,b.id); } window._pair=pair; return pair`).then(async ([a, bb]) => {
  await run(`const S=terrarium.sim, a=S.byId.get('${a}'), b=S.byId.get('${bb}'); if(a.partner){const x=S.byId.get(a.partner); S.breakUp(a,x);} if(b.partner){const x=S.byId.get(b.partner); S.breakUp(b,x);} a.crush=b.id; b.crush=a.id; a.opinion[b.id]=85; b.opinion[a.id]=82; for (const v of S.villagers) if (v!==a&&v!==b&&Math.hypot(v.x+3,v.z-12)<5) v.x+=6;`);
  await stage(bb, { type: 'idle', dur: 40, anim: 'idle', label: 'watching the sunset' }, 'v.x=-3; v.z=12; v.heading=0;');
  await stage(a, { type: 'social', kind: 'confess', target: bb, label: 'working up the nerve' }, 'v.x=-3.4; v.z=16.5;');
  await run("terrarium.setSpeed(1); terrarium.select(null); terrarium.setMode('free'); glide(-3.2,13.5,9,6.5,.9,.6,.3,.22,7000)");
});
await cap('Crushes, confessions, heartbreak', 'romance grows out of opinions, memories and nerve'); await beat(7000);
// 7 · god powers: rain + traveller
await run("terrarium.god('rain'); terrarium.god('traveller'); terrarium.setSpeed(3); glide(-15,2,34,24,1.2,1.0,.5,.4,6000)");
await cap('Play god', 'make it rain · drop a gift · throw a festival · summon the storyteller'); await beat(5500);
// 8 · night party
await ffTo(20.7); await run(`terrarium.setSpeed(1); const S=terrarium.sim, p=S.parties.find(p=>!p.done&&p.at<=S.clock+30)||S.parties[S.parties.length-1]; const pl=S.place(p?p.place:'campfire'); glide(pl.cx, pl.cz+.5, 18, 11, .2, .7, .55, .4, 6000); return p&&p.title`);
await cap('Invitations spread by word of mouth', 'and parties happen when enough people actually show up'); await beat(5600);
// 9 · morning paper + relationship web
await ffTo(24 + 6.4); await run("halt(); terrarium.ui().view('paper')"); await cap('Every dawn: the Thistlebrook Gazette', 'headlines, leaderboards, sweethearts'); await beat(4200);
await run("terrarium.ui().closeModal(); terrarium.ui().view('web')"); await cap('…and the web of who likes whom', 'all of it emergent, all of it remembered'); await beat(4500);
await run("terrarium.ui().closeModal(); glide(-6,-2,40,70,.4,.9,.6,.85,4000)"); await cap('Thistlebrook', 'v1 · built with three.js', true); await wait(3600);
const end = (Date.now() - t0) / 1000;
const vpath = await p.video().path(); await ctx.close(); await b.close(); srv.close?.();
const start0 = marks[0] - .2, dur = end - start0;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start0), '-i', vpath, '-t', String(dur), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', `${OUT}/terrarium.mp4`]);
console.log('video', `${OUT}/terrarium.mp4`, dur.toFixed(1) + 's', 'errors:', errs.length, errs.slice(0, 3));
process.exit(0);
