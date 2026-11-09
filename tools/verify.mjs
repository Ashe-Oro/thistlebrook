// npm run verify — headless multi-day soak of the real app (WebGL via SwiftShader) with assertions.
// Writes shots/verify-report.json. Exit code 1 if any assertion fails.
import { chromium } from 'playwright'; import { start } from './serve.mjs'; import fs from 'node:fs';
const DAYS = +(process.env.DAYS || 4), SEED = process.env.SEED || 7;
const srv = await start(5182);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
const t0 = Date.now();
await p.goto(`http://127.0.0.1:5182/?nopaper&seed=${SEED}`); await p.waitForFunction(() => window.terrarium && document.querySelector('.loading.done'), null, { timeout: 180000 });
const loadMs = Date.now() - t0;
const ev = (c, arg) => p.evaluate(c, arg);
// 1) real-time sanity: villagers move on screen at 1x (late morning, heading to lunch)
await ev(() => terrarium.fastForward(11 * 60 + 50 - terrarium.sim.clock));
const a0 = await ev(() => terrarium.summary().villagers.map(v => [v.x, v.z]));
await ev(() => terrarium.setSpeed(4)); await p.waitForTimeout(6000); await ev(() => terrarium.setSpeed(1));
const a1 = await ev(() => terrarium.summary().villagers.map(v => [v.x, v.z]));
const realMoved = a0.filter((q, i) => Math.hypot(q[0] - a1[i][0], q[1] - a1[i][1]) > .3).length;
const fps = await ev(() => terrarium.fps);
// 2) multi-day soak: step the sim an hour at a time, sampling positions / invariants
const soak = await ev(async (DAYS) => {
  const S = terrarium.sim, start = S.villagers.map(v => ({ ...v.opinion })), dist = {}, still = {}, bad = [];
  let prev = S.villagers.map(v => [v.x, v.z]);
  const endClock = S.clock + DAYS * 1440;
  while (S.clock < endClock) {
    terrarium.fastForward(60);
    S.villagers.forEach((v, i) => {
      const d = Math.hypot(v.x - prev[i][0], v.z - prev[i][1]); dist[v.id] = (dist[v.id] || 0) + d;
      const asleep = v.doing === 'sleeping' || S.hour < 6 || S.hour > 22.5;
      still[v.id] = d < .05 && !asleep && !v.inside ? (still[v.id] || 0) + 1 : 0;
      if (still[v.id] > 5) bad.push(`${v.id} stuck at ${v.x.toFixed(1)},${v.z.toFixed(1)} (${v.doing}) day ${S.day} ${S.hour.toFixed(1)}h`);
      if (!isFinite(v.x) || !isFinite(v.z) || Math.abs(v.x) > 70 || Math.abs(v.z) > 50) bad.push(`${v.id} out of bounds ${v.x},${v.z}`);
      for (const [k, n] of Object.entries(v.needs)) if (!isFinite(n)) bad.push(`${v.id} need ${k} is ${n}`);
    });
    prev = S.villagers.map(v => [v.x, v.z]);
    await new Promise(r => setTimeout(r, 0));
  }
  const kinds = {}; for (const list of Object.values(S.dayStats)) for (const e of list) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  let changed = 0, big = 0; S.villagers.forEach((v, i) => { for (const u of S.villagers) if (u !== v) { const d = Math.abs((v.opinion[u.id] ?? 0) - (start[i][u.id] ?? 0)); if (d >= 5) changed++; if (d >= 25) big++; } });
  const feed = S.events.filter(e => e.imp >= 4).slice(-40).map(e => `Day ${Math.floor(e.t / 1440) + 1} ${String(Math.floor(e.t % 1440 / 60)).padStart(2, '0')}:${String(Math.floor(e.t % 60)).padStart(2, '0')}  ${e.text}`);
  return { day: S.day, kinds, changed, big, dist, bad: [...new Set(bad)].slice(0, 20), alliances: S.alliances.map(a => a.name + ': ' + a.members.join(', ')), parties: S.parties.map(p => `${p.title} @${p.place} day ${Math.floor(p.at / 1440) + 1} — ${p.attendees.size} came`), hearts: S.villagers.map(v => `${v.id}${v.partner ? ' 💞 ' + v.partner : v.crush ? ' 💘 ' + v.crush : ''}`), keepsakes: [...S.keepsakes.values()].filter(k => k.holder !== k.owner).map(k => `${k.owner}'s ${k.name} -> ${k.holder}`), memories: Object.fromEntries(S.villagers.map(v => [v.id, v.mem.items.length])), beliefs: Object.fromEntries(S.villagers.map(v => [v.id, v.thought])), feed };
}, DAYS);
// 3) after the soak the renderer still runs
await p.waitForTimeout(3000); const fps2 = await ev(() => terrarium.fps); const perfInfo = await ev(() => ({ pixelRatio: +terrarium.pixelRatio.toFixed(2), cpuMs: +terrarium.cpuMs.toFixed(2), simMs: +terrarium.simMs.toFixed(2), quality: terrarium.quality }));
const checks = [
  ['no console/page/HTTP errors', errs.length === 0, errs.slice(0, 10)],
  ['villagers move in real time (4x, 6 s)', realMoved >= 3, `${realMoved}/8 moved (others are indoors baking, sorting post, brewing)`],
  ['every villager travelled > 150 m', Object.values(soak.dist).every(d => d > 150), Object.fromEntries(Object.entries(soak.dist).map(([k, d]) => [k, Math.round(d)]))],
  ['no stuck / out-of-bounds / NaN needs', soak.bad.length === 0, soak.bad],
  ['>= 10 event kinds', Object.keys(soak.kinds).length >= 10, soak.kinds],
  ['core kinds present (gossip, party, gift, invite, romance)', ['gossip', 'party', 'gift', 'invite', 'romance'].every(k => soak.kinds[k] > 0), ''],
  ['no economy (no trade/market events)', !soak.kinds.trade, ''],
  ['drama present (theft or argue or fight)', (soak.kinds.theft || 0) + (soak.kinds.argue || 0) + (soak.kinds.fight || 0) > 0, ''],
  ['relationships changed (>= 20 pairs moved >= 5)', soak.changed >= 20, `${soak.changed} pairs moved, ${soak.big} by >= 25`],
  ['memory streams growing', Object.values(soak.memories).every(n => n > 20), soak.memories],
  ['renderer alive after soak (real rAF fps > 5)', fps2 > 5, `${fps.toFixed(1)} fps before, ${fps2.toFixed(1)} after: frames actually drawn per second, SwiftShader CPU raster, dynamic resolution ${perfInfo.pixelRatio}x; JS cost ${perfInfo.cpuMs} ms/frame`],
];
const ok = checks.every(c => c[1]);
for (const [name, pass, info] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info === '' ? '' : '  ' + (typeof info === 'string' ? info : JSON.stringify(info))}`);
console.log(`\nload ${loadMs} ms · simulated ${DAYS} days · seed ${SEED}\nalliances: ${soak.alliances.join(' | ') || 'none'}\nparties: ${soak.parties.join(' | ')}\nhearts: ${soak.hearts.join(', ')}\nkeepsakes astray: ${soak.keepsakes.join('; ') || 'none'}\n\nFeed sample:\n${soak.feed.join('\n')}`);
fs.mkdirSync('shots', { recursive: true }); fs.writeFileSync('shots/verify-report.json', JSON.stringify({ ok, seed: SEED, days: DAYS, loadMs, fps, fps2, perf: perfInfo, checks, ...soak, errors: errs }, null, 2));
await b.close(); srv.close(); process.exit(ok ? 0 : 1);
