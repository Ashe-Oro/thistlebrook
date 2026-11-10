// npm run soak — fast-forwards DAYS in-game days for each seed in SEEDS and prints event-count stats (drama balance check).
// Counts come from the chronicle (sim.dayStats). "fights" = brawls started (💥), "argues" = argue-kind entries.
import { chromium } from 'playwright'; import { start } from './serve.mjs';
const PORT = +(process.env.PORT || 5226), DAYS = +(process.env.DAYS || 8), SEEDS = (process.env.SEEDS || '7').split(',');
const srv = await start(PORT);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const out = {};
for (const seed of SEEDS) {
  const p = await b.newPage({ viewport: { width: 480, height: 270 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/?nopaper&fresh&nosave&seed=${seed}`); await p.waitForFunction(() => window.terrarium && document.querySelector('.loading.done'), null, { timeout: 180000 });
  const r = await p.evaluate(days => {
    const S = terrarium.sim, t0 = performance.now(); terrarium.fastForward(days * 24 * 60);
    const all = Object.values(S.dayStats).flat(), tot = {}; for (const e of all) tot[e.kind] = (tot[e.kind] || 0) + 1;
    const fights = all.filter(e => e.kind === 'fight' && e.icon === '💥'), perDay = {};
    for (const e of all) { const d = 'D' + (Math.floor(e.t / 1440) + 1); const o = perDay[d] ??= { fight: 0, argue: 0, romance: 0, reconcile: 0, n: 0 }; o.n++; if (e.kind === 'fight' && e.icon === '💥') o.fight++; if (e.kind in o) o[e.kind] += e.kind === 'fight' ? 0 : 1; }
    const big = all.filter(e => ['wedding', 'showdown', 'search', 'meeting', 'contest', 'prank', 'mediate'].includes(e.kind) || /💍|🐶|🎉/.test(e.icon)).map(e => `D${Math.floor(e.t / 1440) + 1} ${String(Math.floor(e.t % 1440 / 60)).padStart(2, '0')}:${String(Math.floor(e.t % 60)).padStart(2, '0')} [${e.kind} ${e.icon}] ${e.text}`);
    return { ms: Math.round(performance.now() - t0), events: all.length, fights: fights.length, argues: tot.argue || 0, gossipPct: Math.round(100 * (tot.gossip || 0) / all.length), byKind: tot, perDay, fightLines: fights.map(e => `D${Math.floor(e.t / 1440) + 1} ${String(Math.floor(e.t % 1440 / 60)).padStart(2, '0')}h ${e.text}`), big };
  }, DAYS);
  out[seed] = { ...r, errors: errs }; await p.close();
}
console.log(JSON.stringify(out, null, 1));
const s = Object.values(out); console.log(`SUMMARY days=${DAYS} seeds=${SEEDS.join(',')} fights=${s.map(x => x.fights).join('/')} argues=${s.map(x => x.argues).join('/')} events=${s.map(x => x.events).join('/')} errors=${s.reduce((n, x) => n + x.errors.length, 0)}`);
await b.close(); srv.close(); process.exit(0);
