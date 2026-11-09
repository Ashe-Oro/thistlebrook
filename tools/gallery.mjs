// npm run gallery — stages and captures the review screenshots into shots/final/ (seeded run, real renderer).
import { chromium } from 'playwright'; import { start } from './serve.mjs'; import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const OUT = 'shots/final'; fs.mkdirSync(OUT, { recursive: true });
const srv = await start(5183);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = []; const watch = p => { p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); };
const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); watch(p);
await p.goto('http://127.0.0.1:5183/?nopaper&fresh&nosave&capture&dynres=0&seed=' + (process.env.SEED || 7)); await p.waitForFunction(() => window.terrarium && document.querySelector('.loading.done'), null, { timeout: 180000 });
const run = async (code, arg) => { const r = await p.evaluate(async ([c, a]) => { const F = Object.getPrototypeOf(async function () {}).constructor; return await new F('arg', c)(a); }, [code, arg]); if (r !== undefined) console.log(JSON.stringify(r)); return r; };
const wait = ms => p.waitForTimeout(ms);
const shot = async (name, opts = {}) => { await p.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log('shot', name); };
const ffTo = h => run(`const S=terrarium.sim; while (S.clock < ${h * 60}) terrarium.fastForward(Math.min(60, ${h * 60} - S.clock + .01));`);
const ui = on => run(`document.querySelector('.ui').style.display='${on ? '' : 'none'}'`);

// Day 1 morning — overview + plaza
await ffTo(9.5); await run('terrarium.setSpeed(1); terrarium.look(-6,-2,62,.55,.85)'); await wait(3500); await shot('01_overview_day');
await ffTo(12.3); await run('terrarium.look(-9,4,20,.45,.5)'); await wait(5000); await shot('02_plaza_lunch');
// Work close-ups: whoever is mid-swing (occupations are routines in v1, nothing is produced)
await ffTo(9.7);
for (const [anim, name] of [['chop', '03_work_chop'], ['mine', '04_work_mine'], ['hammer', '05_work_forge']]) {
  for (let i = 0; i < 12; i++) { if (i === 4) await run(`const S=terrarium.sim, job={chop:'woodcutter',mine:'miner',hammer:'blacksmith'}['${anim}'], v=S.villagers.find(v=>v.job===job); if (v && !v.inside) { v.act=null; v.queue=[]; S.brain.work(v,S); }`); const id = await run(`const v = terrarium.sim.villagers.find(v => v.anim === '${anim}'); return v ? v.id : null`); if (id) { await ui(false); await run(`const v=terrarium.sim.byId.get('${id}'), a=v.act||{}; const fx=a.fx??v.x+1, fz=a.fz??v.z; const dx=fx-v.x, dz=fz-v.z, L=Math.hypot(dx,dz)||1, px=-dz/L, pz=dx/L; terrarium.setMode('free'); terrarium.select(null); terrarium.controls.target.set(v.x+dx*.35, 1.0, v.z+dz*.35); terrarium.camera.position.set(v.x+px*3.6+dx/L*1.6, 1.9, v.z+pz*3.6+dz/L*1.6); terrarium.controls.update();`); await wait(1200); await shot(name); await ui(true); break; } await run('terrarium.fastForward(20)'); await wait(200); }
}
// Expressions: line six villagers up in the plaza and force faces
const EX = [['mara', 'happy'], ['tom', 'angry'], ['jen', 'smirk'], ['ollie', 'sad'], ['wren', 'love'], ['pip', 'surprised']];
await ui(false);
for (const [id, e] of EX) {
  await run(`const S=terrarium.sim, v=S.byId.get(arg[0]); S.leaveSeat(v); v.inside=null; v.avatar.targetAlpha=1; v.queue=[]; v.act={type:'idle',dur:1e9,t:0,label:'posing',anim:'idle'}; v.x=-6; v.z=-3.4; v.heading=0; v.avatar.heading=0; terrarium.forceExpr(arg[0], arg[1]); for (const u of S.villagers) if (u!==v && Math.hypot(u.x+6,u.z+3.4)<4) { u.x+=5; } terrarium.closeUp(arg[0], 1.9, 0.35);`, [id, e]);
  await wait(900); await shot(`x_${id}`, { clip: { x: 560, y: 120, width: 480, height: 560 } });
  await run(`const v=terrarium.sim.byId.get(arg); v.act=null; v.x=-12;`, id);
}
await run('terrarium.clearExpr()'); await ui(true);
execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw, ImageFont
ims=[Image.open('${OUT}/x_'+n+'.png') for n in ${JSON.stringify(EX.map(e => e[0]))}]; labels=${JSON.stringify(EX.map(e => e[1]))}
w,h=ims[0].size; s=.62; W,H=int(w*s),int(h*s); out=Image.new('RGB',(W*3,H*2+0),'#f3ead8'); d=ImageDraw.Draw(out)
try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
except: f=None
for i,im in enumerate(ims):
  x,y=(i%3)*W,(i//3)*H; out.paste(im.resize((W,H)),(x,y)); d.rectangle([x+8,y+H-40,x+8+14*len(labels[i])+20,y+H-8],fill='#3b2a1a'); d.text((x+18,y+H-36),labels[i],fill='#ffe9c4',font=f)
out.save('${OUT}/06_expressions.png')`]);
for (const [id] of EX) fs.unlinkSync(`${OUT}/x_${id}.png`); console.log('shot 06_expressions');
// Night party (seed 7 schedules one for day 1 19:30)
await ffTo(20.7); await run("terrarium.setSpeed(1)"); await wait(1500); await run('terrarium.setSpeed(1); const S=terrarium.sim, p=S.parties.find(p=>!p.done&&p.at<=S.clock+30)||S.parties[S.parties.length-1]; const pl=S.place(p?p.place:"campfire"); terrarium.look(pl.cx, pl.cz+(pl.kind==="campfire"?.5:3), 13, .5, .5); return p&&[p.title,p.place,[...p.attendees]]'); await wait(3500); await shot('07_party_night');
await run('terrarium.look(-6,-2,62,.55,.85)'); await wait(1500); await shot('08_night_overview');
// Dawn paper
await ffTo(24 + 6.1); await run("terrarium.setSpeed(1); terrarium.setMode('director'); return terrarium.montage(1)"); await wait(2200); await shot('27_dawn_montage'); await run('terrarium.endMontage()');
await ffTo(24 + 6.3); await run('terrarium.ui().view("paper")'); await wait(900); await shot('09_gazette'); await run('terrarium.ui().closeModal()');
// Day 3: relationships have history now
await ffTo(48 + 13); await run('terrarium.setSpeed(1)');
const pick = await run('const S=terrarium.sim; const v=S.villagers.find(v=>v.partner)||S.villagers.find(v=>v.crush)||S.villagers[2]; return v.id'); await run(`terrarium.select('${pick}')`); await wait(2500); await shot('10_card_relationships');
await p.click('.card .tabs [data-t="mem"]'); await wait(500); await shot('11_card_mind');
await p.click('.card .tabs [data-t="plan"]'); await wait(500); await shot('12_card_plan');
await run('terrarium.select(null)');
await p.click('[data-f="drama"]'); await wait(400); await shot('13_feed_drama', { clip: await p.locator('.feedwrap').boundingBox() }); await p.click('[data-f="all"]');
for (const [k, n] of [['web', '14_relationship_web'], ['recap', '15_recap'], ['villagers', '16_villagers']]) { await run(`terrarium.ui().view('${k}')`); await wait(1200); await shot(n); await run('terrarium.ui().closeModal()'); }
// God powers
await run('terrarium.god("festival")'); await run('terrarium.setSpeed(4)'); await wait(3500); await run('terrarium.setSpeed(1); terrarium.look(-9,5,22,.5,.55)'); await wait(3000); await shot('17_festival');
await ffTo(48 + 16.5); await run("terrarium.setSpeed(1); terrarium.setMode('director'); terrarium.god('traveller')"); await wait(1200); await run('terrarium.ui().quiet = true; terrarium.fastForward(14); terrarium.ui().quiet = false; terrarium.beat()'); await wait(3500); await shot('18_storyteller_beat'); await run("terrarium.setMode('free')");
// Golden hour over the plaza
await ffTo(48 + 18.1); await run('terrarium.look(-9,4,30,.5,.42)'); await wait(2500); await shot('23_golden_hour');
await ffTo(72 + 10); await run('terrarium.god("rain"); terrarium.fastForward(45)'); await wait(3500); await run('terrarium.look(-9,0,30,.6,.6)'); await wait(2500); await shot('19_rain'); await run('terrarium.strike()'); await wait(120); await shot('19b_lightning');
await run("const S=terrarium.sim; S.rain=0; S.rainUntil=S.clock; terrarium.setSpeed(1); terrarium.setMode('director'); terrarium.look(-9,4,30,.5,.5); terrarium.setMode('director'); terrarium.rainbow()"); await wait(4500); await shot('26_rainbow'); await wait(4000);
// Scuffle: two villagers who dislike each other, staged next to each other
await ffTo(72 + 14); await run(`const S=terrarium.sim; let best=null; for (const a of S.villagers) for (const c of S.villagers) if (a!==c && !a.inside && !c.inside && (!best || (a.opinion[c.id]??0) < (best[0].opinion[best[1].id]??0))) best=[a,c]; const [a,c]=best; c.x=a.x+1.2; c.z=a.z; terrarium.look(a.x,a.z,14,.6,.5); terrarium.setMode('director'); S.startFight(a,c,a.first+' finally had it out with '+c.first); if(!terrarium.beatOn) terrarium.beat(); return [a.id,c.id]`);
await wait(2600); await shot('20_brawl_beat'); await wait(9000); await run("terrarium.setMode('free'); const S=terrarium.sim; const e=[...S.events].reverse().find(e=>e.kind==='fight'); terrarium.look(e.x,e.z,11,.6,.45)"); await wait(1500); await shot('21_brawl_after');
await p.close(); // free the renderer before the next page
// Establishing crane shot (plays on first load for real visitors)
{ const q = await b.newPage({ viewport: { width: 1600, height: 900 } }); watch(q); await q.goto('http://127.0.0.1:5183/?nopaper&fresh&nosave&capture&dynres=0&intro&seed=7'); await q.waitForFunction(() => window.terrarium && document.querySelector('.loading.done'), null, { timeout: 180000 }); await q.waitForTimeout(5000); await q.screenshot({ path: `${OUT}/00_intro.png`, timeout: 120000 }); console.log('shot 00_intro'); await q.close(); }
// Mobile layout
const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); watch(m);
await m.goto('http://127.0.0.1:5183/?nopaper&fresh&nosave&seed=7'); await m.waitForFunction(() => window.terrarium && document.querySelector('.loading.done'), null, { timeout: 180000 });
await m.evaluate(() => { terrarium.fastForward(4 * 60); terrarium.select('mara'); }); await m.waitForTimeout(8000); await m.screenshot({ path: `${OUT}/22_mobile.png` }); console.log('shot 22_mobile');
console.log('errors:', errs.join('\n') || 'none'); await b.close(); srv.close(); process.exit(errs.length ? 1 : 0);
