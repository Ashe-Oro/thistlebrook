// The decision layer. `Brain` is the plug-in interface; UtilityBrain is the default (deterministic, free).
// Smallville structure: planDay() writes a daily plan from goal + memories, choose() turns the current
// plan block + needs + opportunities into concrete actions, reflect() distils memories into beliefs.
// v1 has no economy: occupations are routines and places to be; what matters is who likes, loves, envies or wrongs whom.
import type { Sim } from './sim';
import type { Villager, Action, PlanBlock } from './types';
import { op, pickGossip, pendingInvite, possess } from './social';
import { fmtTime } from '../core/util';
import { JOB_INFO } from '../data/villagers';

export interface Brain { name: string; planDay(v: Villager, sim: Sim): void; choose(v: Villager, sim: Sim): void; reflect(v: Villager, sim: Sim): void; }
const A = (type: Action['type'], label: string, o: Partial<Action> = {}): Action => ({ type, label, t: 0, ...o } as Action);
const H = (h: number) => h * 60;
const adult = (v: Villager) => v.def.age !== 'teen';
export const canRomance = (a: Villager, b: Villager) => a !== b && adult(a) && adult(b) && !a.family.includes(b.id);

export class UtilityBrain implements Brain {
  name = 'Utility AI';
  planDay(v: Villager, sim: Sim) {
    const day0 = (sim.day - 1) * 1440, T = v.traits, R = sim.rng;
    const wake = 6 + (1 - T.diligence) * .8, bed = 21.5 + T.sociability * 1.5;
    const job = JOB_INFO[v.job]; const P: PlanBlock[] = [];
    const add = (from: number, to: number, act: PlanBlock['act'], note: string, where?: string) => P.push({ from: day0 + H(from), to: day0 + H(to), act, note, where });
    const crush = v.crush ? sim.byId.get(v.crush) : null;
    if (v.job === 'tavernkeeper') { add(0, 9, 'sleep', 'sleep in'); add(9, 10, 'breakfast', 'breakfast'); add(10, 13, 'work', 'brew ale in the cellar', 'tavern'); add(13, 14, 'lunch', 'lunch & gossip', 'plaza'); add(14, 16.5, 'social', 'make the rounds, hear the news'); add(16.5, 24, 'evening', 'pour drinks at the Tipsy Thistle', 'tavern'); add(24, 33, 'sleep', 'sleep'); }
    else {
      add(0, wake, 'sleep', 'sleep'); add(wake, wake + .8, 'breakfast', 'breakfast at home');
      add(wake + .8, 12, 'work', job.note, job.workplace);
      add(12, 13, 'lunch', 'lunch in the plaza', 'plaza');
      add(13, 15 + T.diligence * 1.5, 'work', `more: ${job.note}`, job.workplace);
      add(15 + T.diligence * 1.5, 18, 'stroll', crush && !v.partner ? `find a moment with ${crush.first}` : v.partner ? `walk with ${sim.byId.get(v.partner)!.first}` : 'visit friends & wander');
      add(18, bed, 'evening', T.sociability > .55 ? 'evening at the tavern' : 'quiet evening', T.sociability > .55 ? 'tavern' : 'home');
      add(bed, 24, 'sleep', 'sleep');
    }
    add(24, 30, 'sleep', 'sleep');
    // Hosting: sociable, liked- or power-seeking villagers throw gatherings; invitations then spread by word of mouth.
    const tonight = sim.parties.find(p => p.at > day0 - 1440 + H(12) && p.at < day0 + 1440);
    if (!tonight && sim.hour < 12 && (v.goal === 'liked' || v.goal === 'power' || v.goal === 'love' || T.sociability > .7) && R.chance(.22 + T.sociability * .25) && sim.parties.filter(p => p.at > day0).length === 0) {
      const opts: [string, string][] = [['a campfire singalong', 'campfire'], ['a storytelling night', 'campfire'], ['a barn dance', 'plaza'], ['a round of drinks', 'tavern'], ['a lantern supper', 'campfire']];
      const [title, place] = R.pick(opts); sim.scheduleParty(v, title, place, day0 + H(19.5));
    }
    for (const p of sim.parties) if (!p.done && p.at < day0 + 1440 && p.until > sim.clock && v.mem.known.has(p.id) && (op(v, sim.byId.get(p.host)!) > -25 || p.host === v.id)) {
      P.push({ from: p.at, to: p.until, act: 'event', note: p.host === v.id ? `host ${p.title}` : `go to ${sim.byId.get(p.host)!.first}'s ${p.title}`, eventId: p.id, where: p.place });
    }
    P.sort((a, b) => a.from - b.from); v.plan = P; v.planDay = sim.day;
    v.intent = this.intent(v, sim);
    const host = sim.parties.find(p => p.host === v.id && !p.done);
    v.thought = host ? `Tonight's ${host.title} has to be perfect. I should invite everyone.` : v.intent ?? ({ liked: 'A kind word and a warm smile go a long way.', power: 'This village needs someone to lead it.', family: 'As long as my family is safe and happy.', love: 'Somewhere in this village is the one for me.', respect: 'Do the work, keep your word. People notice.' } as any)[v.goal];
    v.mem.add(sim.clock, `Plan for day ${sim.day}: ${P.filter(b => b.act !== 'sleep').map(b => b.note).slice(0, 4).join('; ')}`, 3, [v.id], 0, 'plan');
  }
  intent(v: Villager, sim: Sim) {
    let worst: Villager | null = null, best: Villager | null = null;
    for (const u of sim.villagers) if (u !== v) { if (!worst || op(v, u) < op(v, worst)) worst = u; if (!best || op(v, u) > op(v, best)) best = u; }
    const k = sim.missing(v); if (k && !(v as any)._missFrom) return `Who took ${k.name.replace(/^(his|her) /, 'my ')}? I will find out.`;
    if (v.crush && !v.partner) { const c = sim.byId.get(v.crush)!; return op(v, c) > 65 ? `Today I tell ${c.first} how I feel. Today. Probably.` : `I keep thinking about ${c.first}...`; }
    if (worst && op(v, worst) < -40) return v.traits.kindness > .6 ? `Maybe I should make peace with ${worst.first}.` : `${worst.first} will answer for what they did.`;
    if (v.goal === 'power' && !v.alliance && best && op(v, best) > 35) return `${best.first} would make a fine ally.`;
    if (v.partner) return `${sim.byId.get(v.partner)!.first} makes every day brighter.`;
    return null;
  }
  block(v: Villager, sim: Sim): PlanBlock | undefined { return v.plan.find(b => sim.clock >= b.from && sim.clock < b.to && b.act === 'event') ?? v.plan.find(b => sim.clock >= b.from && sim.clock < b.to); }

  choose(v: Villager, sim: Sim) {
    const b = this.block(v, sim), q = v.queue, home = sim.place(v.def.home), R = sim.rng, n = v.needs;
    const think = (s: string) => (v.thought = s);
    if (!b) { q.push(A('enter', 'sleeping', { place: v.def.home, until: sim.clock + 120, onEnter: (x: Villager) => { x.doing = 'sleeping'; } })); return; }
    // --- urgent needs
    if (n.food < 28 && b.act !== 'sleep' && b.act !== 'event') { this.meal(v, sim); return; }
    if (n.energy < 10 && b.act !== 'sleep') { think('I can barely keep my eyes open...'); q.push(A('enter', 'napping at home', { place: v.def.home, dur: 90 })); v.doing = 'napping'; return; }
    if (sim.rain > .6 && b.act !== 'sleep' && b.act !== 'event' && R.chance(.75 - v.traits.diligence * .4)) {
      const tav = sim.place('tavern'), useTav = Math.hypot(tav.x - v.x, tav.z - v.z) < Math.hypot(home.x - v.x, home.z - v.z) + 6;
      think('Ugh, this rain! Better get inside.'); q.push(A('enter', useTav ? 'sheltering in the Tipsy Thistle' : 'sheltering at home', { place: useTav ? 'tavern' : v.def.home, dur: 40, run: true })); return;
    }
    switch (b.act) {
      case 'sleep': {
        if (v.traits.honesty < .35 && v.traits.envy > .55 && sim.hour > 22.5 && R.chance(.05) && sim.clock > v.wanted) { if (this.burgle(v, sim)) return; }
        think(R.pick(['Time for bed.', 'What a day.', 'Zzz...'])); const until = b.to + (b.to % 1440 === 0 ? H(6) + R.range(0, 30) : 0);
        q.push(A('enter', 'sleeping', { place: v.def.home, until: Math.max(until, sim.clock + 30), onEnter: (x: Villager) => { x.doing = 'sleeping'; } })); return;
      }
      case 'breakfast': { if (n.food < 85) { q.push(A('enter', 'having breakfast', { place: v.def.home, dur: 20, onExit: (x: Villager) => { x.needs.food = Math.min(100, x.needs.food + 50); } })); return; } if (this.social(v, sim, .1)) return; this.stroll(v, sim); return; }
      case 'lunch': {
        if (!(v as any)._lunch || (v as any)._lunch < sim.day) { (v as any)._lunch = sim.day; n.food = Math.min(100, n.food + 45); sim.icon(v, v.job === 'baker' ? '🍞' : '🥪'); }
        if (R.chance(.45)) { const seat = sim.takeSeat(v, 'bench'); if (seat) { q.push(A('sit', 'lunch on a bench', { seat, dur: 25, anim2: 'talk' })); return; } }
        if (R.chance(.5) && this.social(v, sim, .3)) return;
        // picnic in the plaza: gather near the well where others are
        const pals = sim.villagers.filter(u => u !== v && !u.inside && Math.hypot(u.x + 9, u.z - 5) < 9); const anchor = pals.length ? R.pick(pals) : null;
        const [x, z] = sim.world.nav.nearestFree(anchor ? anchor.x + R.range(-1.6, 1.6) : -9 + R.range(-4, 4), anchor ? anchor.z + R.range(-1.6, 1.6) : 5 + R.range(-3, 4));
        q.push(A('go', 'heading to lunch in the plaza', { x, z })); q.push(A('idle', 'lunch in the plaza', { dur: 18, anim: R.chance(.5) ? 'drink' : 'talk', face: anchor ? Math.atan2(anchor.x - x, anchor.z - z) : undefined })); return;
      }
      case 'work': { if (R.chance(.1 + v.traits.sociability * .1) && this.social(v, sim, n.social < 35 ? 0 : -.3)) return; this.work(v, sim); return; }
      case 'stroll': { if (this.letter(v, sim)) return; if (this.social(v, sim, .15)) return; this.stroll(v, sim); return; }
      case 'social': { if (this.social(v, sim, -.1)) return; this.stroll(v, sim); return; }
      case 'event': { const p = sim.parties.find(x => x.id === b.eventId); if (p && sim.clock >= p.at - 30) { q.push(A('go', `heading to ${p.title}`, { ...this.near(sim, p.place, 3) })); return; } if (this.social(v, sim, -.3)) return; this.work(v, sim); return; }
      case 'evening': {
        if (v.job === 'tavernkeeper') { const t = sim.place('tavern'); q.push(A('work', 'serving drinks', { kind: 'serve', dur: 40, x: t.x + 1.5, z: t.z + 1.2, fx: t.x, fz: t.z + 4 })); if (R.chance(.3)) this.social(v, sim, .3); return; }
        if (n.food < 60 && !(v as any)._supper || (v as any)._supper < sim.day && n.food < 60) { (v as any)._supper = sim.day; this.meal(v, sim); return; }
        if (this.social(v, sim, -.05)) return;
        if (v.partner && R.chance(.4)) { const p = sim.byId.get(v.partner)!; if (!p.inside) { const seat = sim.takeSeat(v, 'campfire'); if (seat) { q.push(A('sit', `stargazing with ${p.first}`, { seat, dur: 40, anim2: 'talk' })); return; } } }
        if (b.where === 'tavern' || R.chance(.3)) { this.tavern(v, sim); return; }
        if (R.chance(.4)) { const seat = sim.takeSeat(v, R.chance(.5) ? 'campfire' : 'bench'); if (seat) { q.push(A('sit', 'relaxing', { seat, dur: 40 })); return; } }
        q.push(A('enter', 'relaxing at home', { place: v.def.home, dur: 60 })); return;
      }
      case 'home': { q.push(A('enter', 'at home', { place: v.def.home, dur: 60 })); return; }
    }
    q.push(A('idle', 'idle', { dur: 8 }));
  }
  near(sim: Sim, place: string, r: number) { const p = sim.place(place); const a = sim.rng.range(0, 6.28); const [x, z] = sim.world.nav.nearestFree(p.cx + Math.cos(a) * r, p.cz + Math.sin(a) * r + (p.kind === 'campfire' ? 0 : 2)); return { x, z }; }
  // Meals are communal and free in v1: supper at the Thistle when it's open and close, otherwise at home.
  meal(v: Villager, sim: Sim) {
    const tav = sim.place('tavern'), home = sim.place(v.def.home), useTav = sim.hour > 11 && sim.hour < 23 && v.job !== 'tavernkeeper' && Math.hypot(tav.x - v.x, tav.z - v.z) < Math.hypot(home.x - v.x, home.z - v.z) + 10;
    v.thought = useTav ? 'A bowl of Edgar\u2019s stew sounds perfect.' : 'Time for a bite at home.';
    v.queue.push(A('enter', useTav ? 'having supper at the Thistle' : 'eating at home', { place: useTav ? 'tavern' : v.def.home, dur: 25, onExit: (x: Villager) => { x.needs.food = Math.min(100, x.needs.food + 55); } }));
  }
  stroll(v: Villager, sim: Sim) {
    const R = sim.rng, spots: [string, string][] = [['well', 'by the well'], ['orchard', 'in the orchard'], ['pond', 'by the pond'], ['campfire', 'at the campfire'], ['plaza', 'in the plaza']].filter(([p]) => sim.world.places.has(p)) as [string, string][];
    const [p, where] = R.pick(spots.length ? spots : [['plaza', 'in the plaza']]); v.thought = R.pick(['What a lovely afternoon.', 'I could use some fresh air.', 'Let\u2019s see who\u2019s about.', ...v.def.catchphrases]);
    v.queue.push(A('go', `wandering ${where}`, { ...this.near(sim, p, 3.5) })); v.queue.push(A('idle', `enjoying the view ${where}`, { dur: 12, anim: R.chance(.3) ? 'wave' : 'idle' }));
  }
  // Shy hearts write instead of speaking. Letters go through the post office... and through Jen's hands.
  letter(v: Villager, sim: Sim) {
    const c = v.crush ? sim.byId.get(v.crush) : null; if (!c || v.partner || v.job === 'postmistress' || sim.clock < v.heartbreak) return false;
    if (v.traits.sociability > .75 && v.traits.bravery > .6) return false; if (sim.clock - ((v as any)._letter ?? -1e9) < 1440 * 2 || !sim.rng.chance(.35)) return false;
    (v as any)._letter = sim.clock; v.thought = `Dear ${c.first}... no. Dearest ${c.first}...`;
    v.queue.push(A('enter', `writing a letter to ${c.first}`, { place: 'store', dur: 20, onExit: () => { sim.letters.push({ from: v.id, to: c.id, love: true }); v.mem.add(sim.clock, `I posted a love letter to ${c.first}. No going back now.`, 7, [c.id], .4, 'plan'); } }));
    return true;
  }

  // Occupations: where to be and what to look busy with. Nothing is produced or sold in v1.
  work(v: Villager, sim: Sim) {
    const q = v.queue, W = sim.world, R = sim.rng, d = (o: { x: number; z: number }) => Math.hypot(o.x - v.x, o.z - v.z);
    const spotNear = (tx: number, tz: number, r: number) => { const a = Math.atan2(v.x - tx, v.z - tz); for (let k = 0; k < 8; k++) { const aa = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .6, x = tx + Math.sin(aa) * r, z = tz + Math.cos(aa) * r; if (W.nav.isFree(x, z)) return { x, z }; } const [x, z] = W.nav.nearestFree(tx + r, tz); return { x, z }; };
    switch (v.job) {
      case 'woodcutter': {
        const t = W.trees.filter(t => t.state === 'standing' && !t.claimed).sort((a, b) => d(a) - d(b) + R.range(-6, 6))[0]; if (!t) { q.push(A('idle', 'resting', { dur: 20, anim: 'sit' })); return; }
        t.claimed = v.id; const s = spotNear(t.x, t.z, 1.15); v.thought = R.pick(['That one looks sturdy.', 'One day they\u2019ll call me the best axe in the valley.', 'Watch this!']);
        q.push(A('work', 'swinging an axe in the woods', { kind: 'chop', target: t, ...s, fx: t.x, fz: t.z, dur: R.range(35, 60) })); return;
      }
      case 'miner': {
        const r = W.rocks.filter(r => !r.claimed).sort((a, b) => d(a) - d(b) + R.range(-4, 4))[0]; if (!r) { q.push(A('idle', 'sizing up the stone', { dur: 20 })); return; }
        r.claimed = v.id; const s = spotNear(r.x, r.z, 1.4 * r.baseScale); v.thought = R.pick(['Stone doesn\u2019t lie.', 'Swing, swing, swing.', 'Good, honest work.']);
        q.push(A('work', 'carving stone at the quarry', { kind: 'mine', target: r, ...s, fx: r.x, fz: r.z, dur: R.range(40, 60) })); return;
      }
      case 'farmer': {
        const p = W.plots.filter(p => !p.claimed).sort((a, b) => d(a) - d(b) + R.range(-8, 8))[0]; if (!p) { q.push(A('go', 'checking the fields', { ...this.near(sim, 'fields', 3) })); q.push(A('idle', 'admiring the crops', { dur: 15 })); return; }
        p.claimed = v.id; const kind = R.chance(.35) ? 'water' : 'tend'; v.thought = R.pick(['Good soil this year.', 'Rain is coming, I can feel it.', 'Pip should be helping...']);
        q.push(A('work', kind === 'water' ? 'watering the rows' : 'hoeing the rows', { kind, target: p, x: p.x, z: p.z + 2.3, fx: p.x, fz: p.z })); return;
      }
      case 'shepherd': {
        const coop: any = sim.place('feeder');
        if (coop.fedDay !== sim.day && sim.hour < 15) { v.thought = 'The hens will be hungry.'; q.push(A('work', 'feeding the hens', { kind: 'feed', target: coop, x: coop.x, z: coop.z, fx: coop.cx, fz: coop.cz })); return; }
        q.push(A('go', 'minding the flock', { ...this.near(sim, 'pasture', 6) })); q.push(A('idle', 'watching the flock', { dur: 25, anim: R.chance(.5) ? 'wave' : 'idle' })); return;
      }
      case 'baker': { v.thought = 'Nothing beats the smell of fresh bread.'; q.push(A('enter', 'baking bread', { place: 'bakery', dur: 50, smoke: true })); return; }
      case 'blacksmith': { const sm = sim.place('smithy'); v.thought = R.pick(['Iron does not lie.', 'Hot iron waits for no one.', 'Somebody has to keep this village standing.']); q.push(A('work', 'working the forge', { kind: 'forge', x: sm.x + 1.2, z: sm.z + 1.6, fx: sm.x + 2.0, fz: sm.z + 1.6, dur: R.range(40, 60) })); return; }
      case 'postmistress': {
        const L = sim.letters.find(l => !l.read && sim.byId.get(l.to) && !(l as any).taken) ?? sim.letters.find(l => !(l as any).taken);
        if (L) { (L as any).taken = 1; const to = sim.byId.get(L.to)!;
          if (L.love && !L.read && v.traits.honesty < .5 && R.chance(.65)) { L.read = true; const from = sim.byId.get(L.from)!;
            const f = sim.fact('deed', `${from.first} sent ${to.first} a love letter`, from.id, from.id, .1, 7, to.id); (f as any).romance = true; sim.learnFact(v, f); v.mem.add(sim.clock, `I peeked: ${from.first} wrote a love letter to ${to.first}!`, 7, [from.id, to.id], 0, 'obs', f.id);
            q.push(A('enter', 'sorting the post', { place: 'store', dur: 10, onExit: () => { sim.log(`${v.first} held a pink envelope up to the post office lamp. From ${from.first}, to ${to.first}. Her eyes went wide.`, 6, [v.id, from.id, to.id], 'romance', '🕯️'); sim.achieve(v, 'snoop', 'Snoop', `${v.first} read someone else's mail`); } })); }
          v.thought = `A letter for ${to.first}. I wonder what it says...`; q.push(A('social', `delivering a letter to ${to.first}`, { kind: 'deliver', target: to.id, letter: L, carry: 'gift' })); return; }
        if (R.chance(.5)) { const o = sim.place('store'); q.push(A('work', 'sorting the post', { kind: 'sort', x: o.x + .9, z: o.z + .5, fx: o.x + .9, fz: o.z + 3, dur: 25 })); return; }
        const others = sim.villagers.filter(u => u !== v && !u.inside); if (others.length && R.chance(.6)) { const u = R.pick(others); sim.letters.push({ from: 'mayor', to: u.id, love: false } as any); }
        q.push(A('enter', 'sorting the post', { place: 'store', dur: 30 })); return;
      }
      case 'tavernkeeper': { v.thought = 'A good brew takes patience.'; q.push(A('enter', 'brewing ale', { place: 'tavern', dur: 60, smoke: true })); return; }
    }
    q.push(A('idle', 'idle', { dur: 10 }));
  }
  tavern(v: Villager, sim: Sim) {
    const t = sim.place('tavern'); const [x, z] = sim.world.nav.nearestFree(t.x + sim.rng.range(-4, 4), t.z + sim.rng.range(1, 3.5));
    v.thought = sim.rng.pick(['A pint at the Thistle sounds right.', 'Let\u2019s see who\u2019s at the tavern.', 'I could use a drink.']);
    v.queue.push(A('go', 'walking to the tavern', { x, z }));
    v.queue.push(A('idle', 'having a drink at the tavern', { dur: 30, anim: 'drink', face: Math.atan2(t.x - x, t.z + 1 - z), after: () => { v.needs.social += 10; v.emotions.joy += .15; } }));
  }
  burgle(v: Villager, sim: Sim) {
    const marks = sim.villagers.filter(u => u !== v && u.inside === u.def.home && u.doing === 'sleeping' && u.def.home !== v.def.home && op(v, u) < 15 && sim.keepsake(u.id).holder === u.id);
    if (!marks.length) return false; const m = marks.sort((a, b) => op(v, a) - op(v, b))[0], h = sim.place(m.def.home), k = sim.keepsake(m.id), thing = possess(k.name, m.first);
    v.thought = `${m.first} sleeps like a log. And keeps ${k.name} by the bed...`;
    v.queue.push(A('go', 'sneaking through the night', { x: h.x + .8, z: h.z + .4 }));
    v.queue.push(A('idle', 'picking a lock', { dur: 12, anim: 'pickup', face: Math.PI, after: () => {
      if (k.holder !== m.id) return; k.holder = v.id; k.takenAt = sim.clock; v.stats.stolen++; const f = sim.fact('deed', `${v.first} crept into ${m.first}'s house and took ${thing}`, v.id, v.id, -1, 9, m.id); (f as any).label = `taking ${thing}`;
      const owl = sim.villagers.find(w => w !== v && w !== m && !w.inside && Math.hypot(w.x - v.x, w.z - v.z) < 16);
      (m as any)._missFrom = sim.clock + 30;
      if (owl) { owl.mem.learn(f); owl.mem.add(sim.clock, `Saw ${v.first} sneaking out of ${m.first}'s house at night`, 8, [v.id, m.id], -.9, 'obs', f.id); sim.log(`Under cover of night, ${v.first} crept into ${m.first}'s house and took ${thing}. ${owl.first} saw everything.`, 8, [v.id, m.id, owl.id], 'theft', '🌙'); sim.say(owl, 'What was that...?', '👀'); }
      else { v.mem.learn(f); sim.log(`Under cover of night, someone crept into ${m.first}'s house.`, 7, [m.id, v.id], 'theft', '🌙'); }
      sim.icon(v, '🫳'); sim.achieve(null, 'burglary', 'Night Prowler', 'Something vanished in the night');
    } }));
    v.queue.push(A('enter', 'sleeping', { place: v.def.home, until: Math.ceil(sim.clock / 1440) * 1440 + H(6.5), onEnter: (x: Villager) => { x.doing = 'sleeping'; } }));
    return true;
  }

  // Social choice: score every (kind, target) pair against goals, traits, needs, feelings and memories.
  social(v: Villager, sim: Sim, bias: number): boolean {
    const T = v.traits, R = sim.rng, cands: [number, Action][] = [], mine = sim.keepsake(v.id), lost = mine.holder !== v.id && !(v as any)._missFrom;
    for (const u of sim.villagers) {
      if (u === v || u.inside || u.act?.type === 'fight' || u.act?.type === 'flee' || u.doing === 'sleeping') continue;
      const dist = Math.hypot(u.x - v.x, u.z - v.z), near = Math.max(0, 1 - dist / 45), o = op(v, u), since = sim.clock - (v.lastSocial[u.id] ?? -9999), cool = since < 90 ? .15 : since < 200 ? .6 : 1;
      const add = (s: number, a: Action) => cands.push([(s + bias) * cool * (.5 + near) + R.range(0, .15), a]);
      add((100 - v.needs.social) / 100 * (o + 60) / 110 * (.4 + T.sociability) + (v.partner === u.id ? .35 : 0), A('social', v.partner === u.id ? `spending time with ${u.first}` : `chatting with ${u.first}`, { kind: 'chat', target: u.id }));
      const inv = pendingInvite(v, u, sim); if (inv) add(.8 + T.sociability * .4 + (inv.actor === v.id ? .6 : 0), A('social', `inviting ${u.first}`, { kind: 'invite', target: u.id, fact: inv }));
      const g = sim.clock - ((v as any)._lastGossip ?? -9999) > 100 ? pickGossip(v, u, sim) : null; if (g) add((g.imp / 10) * (.3 + T.sociability * .5 + (v.goal === 'power' ? .3 : 0) + (1 - T.kindness) * .3 + ((g as any).romance ? .25 : 0)), A('social', `gossiping with ${u.first}`, { kind: 'gossip', target: u.id, fact: g }));
      const giftOk = sim.clock - ((v as any)._lastGift ?? -9999) > 360 && sim.clock - ((v as any)._gave?.[u.id] ?? -9999) > 1440;
      if (giftOk) { const g2 = (v.goal === 'liked' ? .35 : v.goal === 'family' && v.family.includes(u.id) ? .6 : .05) + T.kindness * .3 + (v.crush === u.id ? .45 : 0) + (u.emotions.sadness > .5 ? .3 : 0) + (v.goal === 'liked' && o < 10 ? .2 : 0) + (v.goal === 'power' && o > 20 && !u.alliance ? .2 : 0); add(g2, A('social', `bringing ${u.first} a gift`, { kind: 'gift', target: u.id, why: u.emotions.sadness > .5 ? ' to cheer them up' : v.goal === 'liked' && o < 10 ? ' to win them over' : '', carry: v.job === 'baker' ? 'bread' : 'gift' })); }
      if ((v.goal === 'power' || v.goal === 'family') && o > (v.goal === 'power' ? 28 : 46) && op(u, v) > (v.goal === 'power' ? 18 : 40) && sim.clock > 600 && !u.alliance && sim.clock - ((v as any)._asked?.[u.id] ?? -9999) > 1440 && (!v.alliance || sim.alliances.find(a => a.id === v.alliance)!.members.length < 4)) add(.75 + T.ambition * .4, A('social', `recruiting ${u.first}`, { kind: 'ally', target: u.id }));
      const holdsTheirs = sim.keepsake(u.id).holder === v.id && sim.clock - (sim.keepsake(u.id).takenAt ?? 0) > 600;
      if ((o < -22 && (T.kindness > .55 || v.goal === 'liked' || v.family.includes(u.id)) && since > 300) || (holdsTheirs && T.kindness > .45 && R.chance(.3))) add(.45 + T.kindness * .4 + (v.goal === 'liked' ? .3 : 0) + (holdsTheirs ? .3 : 0), A('social', `apologising to ${u.first}`, { kind: 'reconcile', target: u.id }));
      if (o < -35 && T.temper > .4 && since > 240) { const done = ((v as any)._confronted ??= new Set()); const why = [...v.mem.known.values()].filter(f => f.actor === u.id && f.valence < 0 && !done.has(f.id)).sort((a, b) => b.imp - a.imp)[0]; if (why || since > 1440) add(.35 + T.temper * .5 + (why ? .2 : 0) + (v.goal === 'respect' ? .2 : 0), A('social', `confronting ${u.first}`, { kind: 'argue', target: u.id, why: why ? ((why as any).label ?? 'what they did') : 'old grudges', factId: why?.id })); }
      // a missing keepsake: confront whoever you *believe* took it (memory may name them, or it's just a hunch)
      if (lost && sim.clock - ((v as any)._accused?.[u.id] ?? -1e9) > 1440 && !v.family.includes(u.id)) { const known = [...v.mem.known.values()].some(f => f.actor === u.id && f.target === v.id && /took|pinched/.test(f.text)); const suspect = known || sim.villagers.filter(x => x !== v && !v.family.includes(x.id)).sort((a, b) => op(v, a) - op(v, b))[0] === u; if (suspect) add(.55 + T.temper * .3 + T.bravery * .2 + (known ? .4 : 0), A('social', `confronting ${u.first} about the missing ${mine.name.replace(/^(his|her) /, '')}`, { kind: 'accuse', target: u.id })); }
      // romance
      if (v.crush === u.id && canRomance(v, u) && sim.clock > v.heartbreak) {
        if (!v.partner && since > 180 && (!u.partner || T.honesty < .4)) add(.35 + (v.goal === 'love' ? .3 : 0) + T.sociability * .25, A('social', `flirting with ${u.first}`, { kind: 'flirt', target: u.id }));
        if (!v.partner && !u.partner && o > 65 && sim.clock - ((v as any)._confessed?.[u.id] ?? -1e9) > 2880 && sim.hour > 16) add(.55 + T.bravery * .45 + (v.goal === 'love' ? .3 : 0) + (u.act?.type === 'attend' || u.act?.type === 'sit' ? .25 : 0), A('social', `working up the nerve to talk to ${u.first}`, { kind: 'confess', target: u.id }));
      }
      if (T.honesty < .4 && (u.act?.type === 'work' || u.act?.type === 'sit' || sim.clock < u.busyUntil || u.anim === 'drink') && o < 20 && dist < 25 && sim.clock > v.wanted && sim.hour > 7 && sim.hour < 20) {
        const k = [...sim.keepsakes.values()].find(k => k.holder === u.id); if (k) add((T.envy - T.honesty) * .7 + (o < -20 ? .25 : 0) + (k.owner !== u.id ? .1 : 0), A('steal', `eyeing ${possess(k.name, u.first)}`, { target: u.id, loot: k.id }));
      }
      // fabricated rumours: dishonest schemers smear their rivals (for influence, or for love)
      if (T.honesty < .45 && (v.goal === 'power' || v.goal === 'love') && since > 120 && sim.clock - ((v as any)._lastRumour ?? -9999) > 900) { const rival = this.rival(v, sim); if (rival && rival !== u && op(u, rival) > -30 && !(v as any)._rumoured?.[rival.id + u.id]) add(.35 + (1 - T.honesty) * .5 + (v.goal === 'power' ? .2 : 0) + (v.crush === u.id ? .3 : 0), A('social', `whispering to ${u.first}`, { kind: 'rumour', target: u.id, about: rival.id })); }
    }
    if (!cands.length) return false; cands.sort((a, b) => b[0] - a[0]); const [s, act] = cands[0]; if (s < .35) return false;
    const tgt = sim.byId.get(act.target)!; v.thought = thoughtFor(act, v, tgt); v.queue.push(act); return true;
  }

  rival(v: Villager, sim: Sim): Villager | null {
    if (v.goal === 'love' && v.crush) { const c = sim.byId.get(v.crush)!; const r = sim.villagers.filter(u => u !== v && u !== c && canRomance(u, c)).sort((a, b) => op(c, b) - op(c, a))[0]; if (r && op(c, r) > 20) return r; }
    const others = sim.villagers.filter(u => u !== v && !v.family.includes(u.id) && (u.alliance !== v.alliance || !u.alliance));
    if (!others.length) return null;
    return others.sort((a, b) => (sim.power(b) + sim.popularity(b) / 4 - op(v, b) * .6) - (sim.power(a) + sim.popularity(a) / 4 - op(v, a) * .6))[0];
  }
  // Reflection: distil recent memories into beliefs about people (and nudge opinions), Smallville-style.
  reflect(v: Villager, sim: Sim) {
    const since = v.mem.lastReflect; v.mem.lastReflect = sim.clock; v.mem.impSinceReflect = 0;
    let headline: string | null = null, top = 0;
    for (const u of sim.villagers) { if (u === v) continue;
      const mems = v.mem.items.filter(m => m.t >= since && m.about.includes(u.id) && m.valence && m.kind !== 'reflection'); if (!mems.length) continue;
      const w = mems.reduce((s, m) => s + m.imp, 0), f = mems.reduce((s, m) => s + m.valence * m.imp, 0) / w; if (w < 6 || Math.abs(f) < .2) continue;
      const text = f < -.6 ? `${u.first} can't be trusted.` : f < -.2 ? `I'm wary of ${u.first}.` : f > .6 ? `${u.first} is a true friend.` : `${u.first} is good company.`;
      const prev = v.mem.belief(u.id); v.mem.setBelief({ about: u.id, text, t: sim.clock, valence: f }); v.opinion[u.id] = Math.max(-100, Math.min(100, (v.opinion[u.id] ?? 0) + Math.round(f * 8)));
      v.mem.add(sim.clock, `Reflection: ${text}`, 6, [u.id], f, 'reflection'); if (Math.abs(f) * w > top && prev?.text !== text) { top = Math.abs(f) * w; headline = text; }
    }
    // envy: the adored and the influential grate on envious hearts
    if (v.traits.envy > .6) { const star = sim.villagers.filter(u => u !== v && !v.family.includes(u.id) && u.id !== v.crush && sim.popularity(u) > sim.popularity(v) + 15).sort((a, b) => sim.popularity(b) - sim.popularity(a))[0]; if (star) { v.opinion[star.id] = (v.opinion[star.id] ?? 0) - 5; v.mem.add(sim.clock, `Everyone fawns over ${star.first}. What's so special about them?`, 5, [star.id], -.5, 'feeling'); if (!headline) headline = `Why does everyone adore ${star.first}?`; } }
    // the heart: a crush forms quietly (the viewer gets to know before the village does)
    if (!v.crush && !v.partner && sim.clock > v.heartbreak) { const c = sim.villagers.filter(u => canRomance(v, u) && op(v, u) > (v.goal === 'love' ? 38 : 52) && !(u.partner && u.partner !== v.id && v.traits.honesty > .4)).sort((a, b) => op(v, b) - op(v, a))[0];
      if (c && sim.rng.chance(v.goal === 'love' ? .8 : .45)) { v.crush = c.id; v.mem.add(sim.clock, `I think I'm falling for ${c.first}.`, 7, [c.id], .8, 'feeling'); headline = `I can't stop thinking about ${c.first}.`; top = 99; sim.log(`${v.first} has quietly fallen for ${c.first}. Nobody knows... yet.`, 5, [v.id, c.id], 'romance', '💘'); } }
    if (v.partner) { const p = sim.byId.get(v.partner)!; if (op(v, p) < 0) { sim.breakUp(v, p); v.emotions.sadness = .8; p.emotions.sadness = 1; sim.log(`${v.first} and ${p.first} called it off. ${p.first} didn't see it coming.`, 8, [v.id, p.id], 'romance', '💔'); const f = sim.fact('news', `${v.first} and ${p.first} broke up`, v.id, v.id, -.2, 8, p.id); sim.witness(`${v.first} broke up with ${p.first}`, 8, [v.id, p.id], { [v.id]: -.3, [p.id]: -.9 }, v.x, v.z, f, 10); headline = `It's over with ${p.first}.`; top = 99; } }
    if (v.crush && !v.partner) { const c = sim.byId.get(v.crush)!; if (op(v, c) < 25 || (c.partner && c.partner !== v.id && v.traits.honesty > .4 && sim.rng.chance(.5))) { v.crush = null; v.mem.add(sim.clock, `I'm over ${c.first}. Mostly.`, 5, [c.id], -.2, 'feeling'); } }
    if (headline) { v.thought = headline; if (top > 8 && top < 99 && /trusted|true friend/.test(headline) && sim.clock - ((sim as any)._lastReflectLog ?? -1e9) > 120) { (sim as any)._lastReflectLog = sim.clock; sim.log(`${v.first} reflected on recent days and decided: "${headline}"`, 4, [v.id], 'reflect', '💭'); } }
    v.replan = sim.hour > 6 && sim.hour < 20; // re-plan the rest of the day in light of the new beliefs
  }
}
function thoughtFor(a: Action, v: Villager, u: Villager) {
  switch (a.kind ?? a.type) {
    case 'chat': return v.partner === u.id ? `I missed ${u.first}.` : `I wonder how ${u.first} is doing.`; case 'invite': return `${u.first} would love tonight's gathering.`; case 'gossip': return `${u.first} needs to hear this...`;
    case 'gift': return v.crush === u.id ? `Will ${u.first} like it? What if ${u.first} doesn't like it?` : `A little something for ${u.first}${a.why ? a.why : ''}.`; case 'ally': return `${u.first} and I could do great things together.`; case 'reconcile': return `I should make things right with ${u.first}.`;
    case 'argue': return `I've had enough of ${u.first}.`; case 'steal': return `${u.first} won't miss it. Probably.`; case 'flirt': return `Be cool. Be cool. Hi, ${u.first}!`;
    case 'confess': return `It's now or never. ${u.first}, I...`; case 'accuse': return `I know ${u.first} has it.`; case 'rumour': return `If ${u.first} only knew what I know...`; case 'deliver': return `Special delivery for ${u.first}.`;
  }
  return '...';
}
export { fmtTime };
