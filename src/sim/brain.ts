// The decision layer. `Brain` is the plug-in interface; UtilityBrain is the default (deterministic, free).
// Smallville structure: planDay() writes a daily plan from goal + memories, choose() turns the current
// plan block + needs + opportunities into concrete actions, reflect() distils memories into beliefs.
import type { Sim } from './sim';
import type { Villager, Action, PlanBlock, Item } from './types';
import { FOOD } from './types';
import { op, pickGossip, pendingInvite } from './social';
import { fmtTime } from '../core/util';
import { JOB_INFO } from '../data/villagers';

export interface Brain { name: string; planDay(v: Villager, sim: Sim): void; choose(v: Villager, sim: Sim): void; reflect(v: Villager, sim: Sim): void; }
const A = (type: Action['type'], label: string, o: Partial<Action> = {}): Action => ({ type, label, t: 0, ...o } as Action);
const H = (h: number) => h * 60;

export class UtilityBrain implements Brain {
  name = 'Utility AI';
  planDay(v: Villager, sim: Sim) {
    const day0 = (sim.day - 1) * 1440, T = v.traits, R = sim.rng;
    const wake = 6 + (1 - T.diligence) * .8, bed = 21.5 + T.sociability * 1.5;
    const job = JOB_INFO[v.job]; const P: PlanBlock[] = [];
    const add = (from: number, to: number, act: PlanBlock['act'], note: string, where?: string) => P.push({ from: day0 + H(from), to: day0 + H(to), act, note, where });
    if (v.job === 'tavernkeeper') { add(0, 9, 'sleep', 'sleep in'); add(9, 10, 'breakfast', 'breakfast'); add(10, 13, 'work', 'brew ale in the cellar', 'tavern'); add(13, 14, 'lunch', 'lunch & gossip'); add(14, 16.5, 'social', 'make the rounds, hear the news'); add(16.5, 24, 'evening', 'pour drinks at the Tipsy Thistle', 'tavern'); add(24, 33, 'sleep', 'sleep'); }
    else {
      add(0, wake, 'sleep', 'sleep'); add(wake, wake + .8, 'breakfast', 'breakfast');
      add(wake + .8, 12, 'work', `${job.verb === 'traded' ? 'run the market stall' : 'work: ' + workNote(v)}`, job.workplace);
      add(12, 13, 'lunch', 'lunch in the plaza', 'plaza');
      add(13, 15.5 + T.diligence * 1.5, 'work', `more work: ${workNote(v)}`, job.workplace);
      add(15.5 + T.diligence * 1.5, 18, 'errands', 'sell goods & run errands', 'market');
      add(18, bed, 'evening', T.sociability > .55 ? 'evening at the tavern' : 'quiet evening', T.sociability > .55 ? 'tavern' : 'home');
      add(bed, 24, 'sleep', 'sleep');
    }
    add(24, 30, 'sleep', 'sleep');
    // Hosting: sociable, liked- or power-seeking villagers throw gatherings; invitations then spread by word of mouth.
    const tonight = sim.parties.find(p => p.at > day0 - 1440 + H(12) && p.at < day0 + 1440);
    if (!tonight && sim.hour < 12 && v.inv.coins >= 10 && (v.goal === 'liked' || v.goal === 'power' || T.sociability > .7) && R.chance(.22 + T.sociability * .25) && sim.parties.filter(p => p.at > day0).length === 0) {
      const opts: [string, string][] = [['a campfire singalong', 'campfire'], ['a storytelling night', 'campfire'], ['a barn dance', 'plaza'], ['a round of drinks', 'tavern'], ['a harvest supper', 'campfire']];
      const [title, place] = R.pick(opts); sim.scheduleParty(v, title, place, day0 + H(19.5));
    }
    for (const p of sim.parties) if (!p.done && p.at < day0 + 1440 && p.until > sim.clock && v.mem.known.has(p.id) && (op(v, sim.byId.get(p.host)!) > -25 || p.host === v.id)) {
      for (const b of P) if (b.act === 'evening' || b.act === 'sleep' && b.from < p.at + 1) { }
      P.push({ from: p.at, to: p.until, act: 'event', note: p.host === v.id ? `host ${p.title}` : `go to ${sim.byId.get(p.host)!.first}'s ${p.title}`, eventId: p.id, where: p.place });
    }
    P.sort((a, b) => a.from - b.from); v.plan = P; v.planDay = sim.day;
    // intent from memory (re-planning reacts to what happened)
    v.intent = this.intent(v, sim);
    const host = sim.parties.find(p => p.host === v.id && !p.done);
    v.thought = host ? `Tonight's ${host.title} has to be perfect. I should invite everyone.` : v.intent ?? (v.goal === 'wealth' ? 'Every coin counts. Work hard, sell high.' : v.goal === 'liked' ? 'A kind word and a warm loaf go a long way.' : v.goal === 'power' ? 'This village needs someone to lead it.' : 'As long as my family is safe and fed.');
    v.mem.add(sim.clock, `Plan for day ${sim.day}: ${P.filter(b => b.act !== 'sleep').map(b => b.note).slice(0, 4).join('; ')}`, 3, [v.id], 0, 'plan');
  }
  intent(v: Villager, sim: Sim) {
    let worst: Villager | null = null, best: Villager | null = null;
    for (const u of sim.villagers) if (u !== v) { if (!worst || op(v, u) < op(v, worst)) worst = u; if (!best || op(v, u) > op(v, best)) best = u; }
    if (worst && op(v, worst) < -40) return v.traits.kindness > .6 ? `Maybe I should make peace with ${worst.first}.` : `${worst.first} will answer for what they did.`;
    if (v.goal === 'power' && !v.alliance && best && op(v, best) > 35) return `${best.first} would make a fine ally.`;
    if (v.needs.food < 35) return 'My stomach is growling...';
    return null;
  }
  block(v: Villager, sim: Sim): PlanBlock | undefined { return v.plan.find(b => sim.clock >= b.from && sim.clock < b.to && b.act === 'event') ?? v.plan.find(b => sim.clock >= b.from && sim.clock < b.to); }

  choose(v: Villager, sim: Sim) {
    const b = this.block(v, sim), q = v.queue, home = sim.place(v.def.home), R = sim.rng, n = v.needs;
    const think = (s: string) => (v.thought = s);
    if (!b) { q.push(A('enter', 'sleeping', { place: v.def.home, until: sim.clock + 120, onEnter: (x: Villager) => { x.doing = 'sleeping'; } })); return; }
    // --- urgent needs
    if (n.food < 28 && b.act !== 'sleep') { if (this.feed(v, sim)) return; }
    if (n.energy < 10 && b.act !== 'sleep') { think('I can barely keep my eyes open...'); q.push(A('enter', 'napping at home', { place: v.def.home, dur: 90 })); v.doing = 'napping'; return; }
    if (sim.rain > .6 && b.act !== 'sleep' && b.act !== 'event' && R.chance(.75 - v.traits.diligence * .4)) {
      const tav = sim.place('tavern'), useTav = Math.hypot(tav.x - v.x, tav.z - v.z) < Math.hypot(home.x - v.x, home.z - v.z) + 6;
      think('Ugh, this rain! Better get inside.'); q.push(A('enter', useTav ? 'sheltering in the Tipsy Thistle' : 'sheltering at home', { place: useTav ? 'tavern' : v.def.home, dur: 40, run: true })); return;
    }
    switch (b.act) {
      case 'sleep': {
        if (v.traits.honesty < .35 && v.traits.greed > .55 && sim.hour > 22.5 && R.chance(.05) && sim.clock > v.wanted) { if (this.burgle(v, sim)) return; }
        think(R.pick(['Time for bed.', 'What a day.', 'Zzz...'])); const until = b.to + (b.to % 1440 === 0 ? H(6) + R.range(0, 30) : 0);
        q.push(A('enter', 'sleeping', { place: v.def.home, until: Math.max(until, sim.clock + 30), onEnter: (x: Villager) => { x.doing = 'sleeping'; } })); return;
      }
      case 'breakfast': case 'lunch': {
        if (n.food < 75 && this.feed(v, sim)) return;
        if (b.act === 'lunch' && R.chance(.6)) { const seat = sim.takeSeat(v, 'bench'); if (seat) { q.push(A('sit', 'resting on a bench', { seat, dur: 25, anim2: 'talk' })); return; } }
        if (this.social(v, sim, .2)) return; q.push(A('go', 'strolling', { ...this.near(sim, 'plaza', 4) })); q.push(A('idle', 'people-watching', { dur: 10 })); return;
      }
      case 'work': { if (R.chance(.1 + v.traits.sociability * .1) && this.social(v, sim, n.social < 35 ? 0 : -.3)) return; this.work(v, sim); return; }
      case 'errands': { if (this.errands(v, sim)) return; if (this.social(v, sim, 0)) return; this.work(v, sim); return; }
      case 'social': { if (this.social(v, sim, -.2)) return; q.push(A('go', 'wandering', { ...this.near(sim, 'plaza', 5) })); q.push(A('idle', 'looking around', { dur: 12 })); return; }
      case 'event': { const p = sim.parties.find(x => x.id === b.eventId); if (p && sim.clock >= p.at - 30) { q.push(A('go', `heading to ${p.title}`, { ...this.near(sim, p.place, 3) })); return; } if (this.social(v, sim, -.3)) return; this.work(v, sim); return; }
      case 'evening': {
        if (v.job === 'tavernkeeper') { const t = sim.place('tavern'); q.push(A('work', 'serving drinks', { kind: 'serve', dur: 40, x: t.x + 1.5, z: t.z + 1.2, fx: t.x, fz: t.z + 4 })); if (R.chance(.3)) this.social(v, sim, .3); return; }
        if (this.social(v, sim, -.1)) return;
        if (b.where === 'tavern' || R.chance(.3)) { this.tavern(v, sim); return; }
        if (R.chance(.4)) { const seat = sim.takeSeat(v, R.chance(.5) ? 'campfire' : 'bench'); if (seat) { q.push(A('sit', 'relaxing', { seat, dur: 40 })); return; } }
        q.push(A('enter', 'relaxing at home', { place: v.def.home, dur: 60 })); return;
      }
      case 'home': { q.push(A('enter', 'at home', { place: v.def.home, dur: 60 })); return; }
    }
    q.push(A('idle', 'idle', { dur: 8 }));
  }
  near(sim: Sim, place: string, r: number) { const p = sim.place(place); const a = sim.rng.range(0, 6.28); const [x, z] = sim.world.nav.nearestFree(p.cx + Math.cos(a) * r, p.cz + Math.sin(a) * r + (p.kind === 'campfire' ? 0 : 2)); return { x, z }; }

  feed(v: Villager, sim: Sim): boolean {
    const q = v.queue, R = sim.rng;
    const own = (['bread', 'eggs', 'apples'] as Item[]).find(i => v.inv[i] > 0); if (own) { v.thought = 'Time for a bite.'; q.push(A('eat', `eating ${own}`, { item: own })); return true; }
    if (v.inv.coins >= sim.price('bread', true) && sim.stock.bread > 0) { v.thought = 'I\u2019ll grab some bread at the market.'; q.push(A('trade_market', 'buying food', { buy: [['bread', 2]] })); q.push(A('eat', 'eating bread', { item: 'bread' })); return true; }
    const edgar = sim.byId.get('edgar'); if (v.job === 'tavernkeeper' && v.inv.coins >= 3) { v.thought = 'A bowl of my own stew.'; q.push(A('enter', 'eating in the tavern kitchen', { place: 'tavern', dur: 25, onExit: (x: Villager) => { x.inv.coins -= 3; x.needs.food = Math.min(100, x.needs.food + 60); } })); return true; }
    if (edgar && edgar !== v && v.inv.coins >= 5 && sim.hour > 11 && edgar.inside !== 'home-edgar') { v.thought = 'A hot meal at the tavern.'; q.push(A('enter', 'having a meal at the tavern', { place: 'tavern', dur: 30, onExit: (x: Villager) => { if (x.inv.coins >= 5) { sim.give(x, edgar, 'coins', 5); edgar.inv.coins = Math.max(0, edgar.inv.coins - 2); x.needs.food = Math.min(100, x.needs.food + 60); } } })); return true; }
    if (v.inv.coins >= sim.price('eggs', true) && sim.stock.eggs > 0) { q.push(A('trade_market', 'buying eggs', { buy: [['eggs', 2]] })); q.push(A('eat', 'eating eggs', { item: 'eggs' })); return true; }
    const tree = sim.world.apples.filter(t => t.apples > 0 && !t.claimed).sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z))[0];
    const friends = sim.villagers.filter(u => u !== v && !u.inside && (u.inv.bread + u.inv.apples + u.inv.eggs) > 0).sort((a, b) => (op(v, b) + (v.family.includes(b.id) ? 60 : 0)) - (op(v, a) + (v.family.includes(a.id) ? 60 : 0)));
    if (v.needs.food < 18 && v.traits.honesty < .45 && R.chance(.5)) { const mark = friends.filter(u => op(v, u) < 30)[0]; if (mark) { v.thought = `${mark.first} won\u2019t miss a little food...`; q.push(A('steal', `sneaking up on ${mark.first}`, { target: mark.id, loot: mark.inv.bread ? 'bread' : mark.inv.apples ? 'apples' : 'eggs', lootN: 1 })); return true; } }
    if (friends[0] && (op(v, friends[0]) > -10 || v.needs.food < 15)) { v.thought = `Maybe ${friends[0].first} can spare something.`; q.push(A('social', `asking ${friends[0].first} for food`, { kind: 'ask_food', target: friends[0].id })); return true; }
    if (tree) { tree.claimed = v.id; v.thought = 'There are apples in the orchard.'; q.push(A('work', 'picking apples', { kind: 'pick', target: tree, x: tree.x + 1.4, z: tree.z + 1.2, fx: tree.x, fz: tree.z })); q.push(A('eat', 'eating an apple', { item: 'apples' })); return true; }
    return false;
  }

  work(v: Villager, sim: Sim) {
    const q = v.queue, W = sim.world, R = sim.rng, d = (o: { x: number; z: number }) => Math.hypot(o.x - v.x, o.z - v.z);
    const spotNear = (tx: number, tz: number, r: number) => { const a = Math.atan2(v.x - tx, v.z - tz); for (let k = 0; k < 8; k++) { const aa = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .6, x = tx + Math.sin(aa) * r, z = tz + Math.cos(aa) * r; if (W.nav.isFree(x, z)) return { x, z }; } const [x, z] = W.nav.nearestFree(tx + r, tz); return { x, z }; };
    switch (v.job) {
      case 'woodcutter': {
        if (v.inv.wood >= 6) { if (this.sellOrTrade(v, sim, 'wood')) return; }
        const t = W.trees.filter(t => t.available && !t.claimed).sort((a, b) => d(a) - d(b))[0]; if (!t) { v.thought = 'All the trees are cut. They\u2019ll grow back.'; q.push(A('idle', 'resting', { dur: 20, anim: 'sit' })); return; }
        t.claimed = v.id; t.hp = 6; const s = spotNear(t.x, t.z, 1.15); v.thought = R.pick(['That one looks sturdy.', 'Wood for the smithy, wood for the hearths.', 'One more tree before lunch.']);
        q.push(A('work', 'chopping wood', { kind: 'chop', target: t, ...s, fx: t.x, fz: t.z })); return;
      }
      case 'miner': {
        if (v.inv.ore >= 5) { if (this.sellOrTrade(v, sim, 'ore')) return; }
        const r = W.rocks.filter(r => r.available && !r.claimed).sort((a, b) => d(a) - d(b))[0]; if (!r) { q.push(A('idle', 'waiting for the quarry', { dur: 20 })); return; }
        r.claimed = v.id; const s = spotNear(r.x, r.z, 1.4 * r.baseScale); v.thought = R.pick(['There\u2019s good ore in that rock.', 'Swing, swing, swing.', 'Iron today, coin tomorrow.']);
        q.push(A('work', 'mining ore', { kind: 'mine', target: r, ...s, fx: r.x, fz: r.z })); return;
      }
      case 'farmer': {
        const free = W.plots.filter(p => !p.claimed);
        const ripe = free.find(p => p.stage === 'ripe'), dry = free.filter(p => p.stage === 'growing' && p.water < .35).sort((a, b) => d(a) - d(b))[0], empty = free.find(p => p.stage === 'empty');
        if (v.inv.wheat >= 8) { if (this.sellOrTrade(v, sim, 'wheat')) return; }
        const p = ripe ?? dry ?? empty; if (!p) { if (v.inv.wheat >= 3 && this.sellOrTrade(v, sim, 'wheat')) return; v.thought = 'The fields are growing nicely.'; q.push(A('go', 'checking the fields', { ...this.near(sim, 'fields', 3) })); q.push(A('idle', 'admiring the crops', { dur: 15 })); return; }
        p.claimed = v.id; const s = { x: p.x, z: p.z + 2.3 }; const kind = p === ripe ? 'harvest' : p === dry ? 'water' : 'plant';
        v.thought = kind === 'harvest' ? 'Golden and ready!' : kind === 'water' ? 'These seedlings are thirsty.' : 'Time to sow.';
        q.push(A('work', kind === 'harvest' ? 'harvesting wheat' : kind === 'water' ? 'watering crops' : 'sowing seeds', { kind, target: p, ...s, fx: p.x, fz: p.z })); return;
      }
      case 'shepherd': {
        const coop: any = sim.place('feeder');
        if (coop.eggDay !== sim.day && sim.hour < 15) { v.thought = 'The hens will be hungry.'; q.push(A('work', 'feeding the hens', { kind: 'feed', target: coop, x: coop.x, z: coop.z, fx: coop.cx, fz: coop.cz })); return; }
        if (v.inv.eggs + v.inv.apples >= 6) { if (this.sellOrTrade(v, sim, v.inv.eggs >= v.inv.apples ? 'eggs' : 'apples')) return; }
        const t = W.apples.filter(t => t.apples >= 2 && !t.claimed).sort((a, b) => d(a) - d(b))[0];
        if (t) { t.claimed = v.id; v.thought = 'Ripe apples!'; q.push(A('work', 'picking apples', { kind: 'pick', target: t, ...spotNear(t.x, t.z, 1.6), fx: t.x, fz: t.z })); return; }
        q.push(A('go', 'tending the sheep', { ...this.near(sim, 'pasture', 6) })); q.push(A('idle', 'watching the flock', { dur: 20, anim: 'wave' })); return;
      }
      case 'baker': {
        if (v.inv.wheat >= 2) { const batches = Math.min(3, Math.floor(v.inv.wheat / 2)); v.thought = 'Nothing beats the smell of fresh bread.'; q.push(A('enter', 'baking bread', { place: 'bakery', dur: 30 + batches * 15, smoke: true, onExit: (x: Villager) => { x.inv.wheat -= batches * 2; x.inv.bread += batches * 3; sim.log(`${x.first} pulled ${batches * 3} fresh loaves out of the oven.`, 3, [x.id], 'work', '🍞'); sim.world.fx.sparkle(x.x, 1.6, x.z, [1, .85, .5], 8); } })); return; }
        if (v.inv.bread >= 4) { if (this.sellOrTrade(v, sim, 'bread', 2)) return; }
        const ollie = sim.byId.get('ollie'); if (ollie && ollie.inv.wheat >= 2 && !ollie.inside && v.inv.coins >= 6) { v.thought = 'I need flour. Ollie has wheat.'; q.push(A('social', 'buying wheat from Ollie', { kind: 'trade', target: 'ollie', deal: ['coins', Math.min(4, ollie.inv.wheat) * 3, 'wheat', Math.min(4, ollie.inv.wheat)] })); return; }
        if (sim.stock.wheat >= 2 && v.inv.coins >= sim.price('wheat', true) * 2) { q.push(A('trade_market', 'buying wheat', { buy: [['wheat', 4]] })); return; }
        if (v.inv.bread > 0 && this.sellOrTrade(v, sim, 'bread', 1)) return;
        v.thought = 'No flour, no bread. Waiting on the harvest.'; q.push(A('enter', 'tidying the bakery', { place: 'bakery', dur: 30 })); return;
      }
      case 'blacksmith': {
        const sm = sim.place('smithy');
        if (v.inv.ore >= 2 && v.inv.wood >= 1) { v.thought = 'Hot iron waits for no one.'; q.push(A('work', 'forging tools', { kind: 'forge', x: sm.x + 1.2, z: sm.z + 1.6, fx: sm.x + 2.0, fz: sm.z + 1.6 })); return; }
        if (v.inv.tools >= 2) { const buyer = sim.villagers.find(u => u !== v && u.inv.tools === 0 && ['woodcutter', 'miner', 'farmer'].includes(u.job) && u.inv.coins >= 16 && !u.inside); if (buyer) { q.push(A('social', `selling a tool to ${buyer.first}`, { kind: 'trade', target: buyer.id, deal: ['tools', 1, 'coins', 16] })); return; } if (this.sellOrTrade(v, sim, 'tools', 1)) return; }
        const need: Item = v.inv.ore < 2 ? 'ore' : 'wood'; const sup = sim.villagers.find(u => u !== v && u.inv[need] >= 2 && !u.inside);
        if (sup && v.inv.coins >= 8) { v.thought = `I need ${need}. ${sup.first} has some.`; q.push(A('social', `buying ${need} from ${sup.first}`, { kind: 'trade', target: sup.id, deal: ['coins', need === 'ore' ? 8 : 6, need, 2] })); return; }
        if (sim.stock[need] >= 1 && v.inv.coins >= sim.price(need, true)) { q.push(A('trade_market', `buying ${need}`, { buy: [[need, 2]] })); return; }
        v.thought = `Waiting on ${need}...`; q.push(A('work', 'sharpening blades', { kind: 'forge0', x: sm.x + 1.2, z: sm.z + 1.6, fx: sm.x + 2, fz: sm.z + 1.6 })); return;
      }
      case 'merchant': {
        const m = sim.place('market'); v.thought = R.pick(['Buy low, sell high.', 'Every visitor is a customer.', 'The market is my kingdom.']);
        // buy surplus straight from producers, slightly above market (wins them over), resell at the stall later
        const sup = sim.villagers.find(u => u !== v && !u.inside && ((u.inv.wood >= 5 && 'wood') || (u.inv.ore >= 5) || (u.inv.eggs >= 5)) && (v.lastSocial[u.id] ?? -999) < sim.clock - 240);
        if (sup && v.inv.coins >= 12 && R.chance(.4)) { const it: Item = sup.inv.wood >= 5 ? 'wood' : sup.inv.ore >= 5 ? 'ore' : 'eggs'; q.push(A('social', `buying ${it} from ${sup.first}`, { kind: 'trade', target: sup.id, deal: ['coins', Math.round(sim.price(it, false) * 3 * 1.1), it, 3] })); return; }
        if (v.inv.wood + v.inv.ore + v.inv.eggs > 0) { q.push(A('trade_market', 'restocking the stall', { sell: [['wood', 9], ['ore', 9], ['eggs', 9]] })); return; }
        q.push(A('work', 'minding the stall', { kind: 'stall', dur: 45, x: m.cx, z: m.cz - 1.15, fx: m.cx, fz: m.cz + 4 })); return;
      }
      case 'tavernkeeper': { v.thought = 'A good brew takes patience.'; q.push(A('enter', 'brewing ale', { place: 'tavern', dur: 60, smoke: true })); return; }
    }
    q.push(A('idle', 'idle', { dur: 10 }));
  }
  sellOrTrade(v: Villager, sim: Sim, item: Item, keep = 0) {
    const q = v.queue, n = v.inv[item] - keep; if (n <= 0) return false;
    const partner: Record<string, string> = { wood: 'tom', ore: 'tom', wheat: 'mara' }; const pid = partner[item], p = pid ? sim.byId.get(pid) : undefined;
    if (p && p !== v && !p.inside && p.inv.coins >= 6 && p.inv[item] < 3 && op(v, p) > -30 && sim.rng.chance(.6)) { const k = Math.min(n, 4); q.push(A('social', `selling ${item} to ${p.first}`, { kind: 'trade', target: p.id, deal: [item, k, 'coins', Math.round(k * sim.price(item, false) * 1.1)] })); return true; }
    const place = v.job === 'farmer' ? 'farmstand' : 'market'; v.thought = 'Time to turn goods into coin.';
    q.push(A('trade_market', `selling ${item}`, { place, sell: [[item, n]], off: sim.rng.range(-.8, .8) })); return true;
  }
  errands(v: Villager, sim: Sim) {
    const q = v.queue; const sell: [Item, number][] = [];
    for (const i of ['wood', 'ore', 'wheat', 'eggs', 'apples', 'tools', 'bread'] as Item[]) { const keep = i === 'bread' ? (v.job === 'baker' ? 1 : 2) : i === 'tools' ? (v.job === 'blacksmith' ? 0 : 1) : (i === 'wheat' && v.job === 'baker') || ((i === 'ore' || i === 'wood') && v.job === 'blacksmith') ? 99 : 0; if (v.inv[i] > keep) sell.push([i, v.inv[i] - keep]); }
    const buy: [Item, number][] = []; if (v.inv.bread + v.inv.eggs + v.inv.apples < 2 && v.inv.coins > 10) buy.push(['bread', 2]);
    if (['woodcutter', 'miner', 'farmer'].includes(v.job) && v.inv.tools === 0 && v.inv.coins >= sim.price('tools', true) + 4 && sim.stock.tools > 0) buy.push(['tools', 1]);
    if (!sell.length && !buy.length) return false; q.push(A('trade_market', 'at the market', { sell, buy, off: sim.rng.range(-.8, .8) })); return true;
  }
  tavern(v: Villager, sim: Sim) {
    const t = sim.place('tavern'), edgar = sim.byId.get('edgar'); const [x, z] = sim.world.nav.nearestFree(t.x + sim.rng.range(-4, 4), t.z + sim.rng.range(1, 3.5));
    v.thought = sim.rng.pick(['A pint at the Thistle sounds right.', 'Let\u2019s see who\u2019s at the tavern.', 'I could use a drink.']);
    v.queue.push(A('go', 'walking to the tavern', { x, z }));
    v.queue.push(A('idle', 'having a drink at the tavern', { dur: 30, anim: 'drink', face: Math.atan2(t.x - x, t.z + 1 - z), after: () => { if (edgar && edgar !== v && v.inv.coins >= 2 && Math.hypot(edgar.x - t.x, edgar.z - t.z) < 8) { sim.give(v, edgar, 'coins', 2); v.needs.social += 10; v.emotions.joy += .15; } } }));
  }
  burgle(v: Villager, sim: Sim) {
    const marks = sim.villagers.filter(u => u !== v && u.inside === u.def.home && u.doing === 'sleeping' && u.inv.coins >= 15 && u.def.home !== v.def.home && op(v, u) < 25);
    if (!marks.length) return false; const m = marks.sort((a, b) => b.inv.coins - a.inv.coins)[0], h = sim.place(m.def.home);
    v.thought = `${m.first} sleeps like a log. And keeps coins by the bed...`;
    v.queue.push(A('go', 'sneaking through the night', { x: h.x + .8, z: h.z + .4 }));
    v.queue.push(A('idle', 'picking a lock', { dur: 12, anim: 'pickup', face: Math.PI, after: () => {
      const n = Math.min(12, Math.floor(m.inv.coins / 2)); sim.give(m, v, 'coins', n); v.stats.stolen += n; const f = sim.fact('deed', `${v.first} broke into ${m.first}'s house and stole ${n} coins`, v.id, v.id, -1, 9, m.id);
      const owl = sim.villagers.find(w => w !== v && w !== m && !w.inside && Math.hypot(w.x - v.x, w.z - v.z) < 16);
      m.mem.add(sim.clock, `${n} coins vanished from my house overnight`, 7, [], -.6);
      if (owl) { owl.mem.learn(f); owl.mem.add(sim.clock, `Saw ${v.first} sneaking out of ${m.first}'s house at night`, 8, [v.id, m.id], -.9, 'obs', f.id); sim.log(`Under cover of night, ${v.first} crept into ${m.first}'s house and stole ${n} coins. ${owl.first} saw everything.`, 8, [v.id, m.id, owl.id], 'theft', '🌙'); sim.say(owl, 'What was that...?', '👀'); }
      else { v.mem.learn(f); sim.log(`Under cover of night, someone crept into ${m.first}'s house and took ${n} coins.`, 7, [m.id, v.id], 'theft', '🌙'); }
      sim.icon(v, '🫳'); sim.achieve(null, 'burglary', 'Night Burglar', 'Coins vanished in the night');
    } }));
    v.queue.push(A('enter', 'sleeping', { place: v.def.home, until: Math.ceil(sim.clock / 1440) * 1440 + H(6.5), onEnter: (x: Villager) => { x.doing = 'sleeping'; } }));
    return true;
  }

  // Social choice: score every (kind, target) pair against goals, traits, needs and memories.
  social(v: Villager, sim: Sim, bias: number): boolean {
    const T = v.traits, R = sim.rng, cands: [number, Action][] = [];
    for (const u of sim.villagers) {
      if (u === v || u.inside || u.act?.type === 'fight' || u.act?.type === 'flee' || u.doing === 'sleeping') continue;
      const dist = Math.hypot(u.x - v.x, u.z - v.z), near = Math.max(0, 1 - dist / 45), o = op(v, u), since = sim.clock - (v.lastSocial[u.id] ?? -9999), cool = since < 90 ? .15 : since < 200 ? .6 : 1;
      const add = (s: number, a: Action) => cands.push([(s + bias) * cool * (.5 + near) + R.range(0, .15), a]);
      add((100 - v.needs.social) / 100 * (o + 60) / 110 * (.4 + T.sociability), A('social', `chatting with ${u.first}`, { kind: 'chat', target: u.id }));
      const inv = pendingInvite(v, u, sim); if (inv) add(.8 + T.sociability * .4 + (inv.actor === v.id ? .6 : 0), A('social', `inviting ${u.first}`, { kind: 'invite', target: u.id, fact: inv }));
      const g = sim.clock - ((v as any)._lastGossip ?? -9999) > 100 ? pickGossip(v, u, sim) : null; if (g) add((g.imp / 10) * (.3 + T.sociability * .5 + (v.goal === 'power' ? .3 : 0) + (1 - T.kindness) * .3), A('social', `gossiping with ${u.first}`, { kind: 'gossip', target: u.id, fact: g }));
      const giftOk = sim.clock - ((v as any)._lastGift ?? -9999) > 300 && sim.clock - ((v as any)._gave?.[u.id] ?? -9999) > 1440;
      const spare: Item | null = !giftOk ? null : v.inv.bread >= 3 ? 'bread' : v.inv.apples >= 3 ? 'apples' : v.inv.eggs >= 3 ? 'eggs' : v.inv.coins >= 45 && (v.goal === 'liked' || v.goal === 'power') ? 'coins' : null;
      if (spare) { const g2 = (v.goal === 'liked' ? .4 : v.goal === 'family' && v.family.includes(u.id) ? .7 : .1) + T.kindness * .3 + (u.needs.food < 30 && spare !== 'coins' ? .5 : 0) + (v.goal === 'liked' && o < 10 ? .2 : 0) + (v.goal === 'power' && o > 20 && !u.alliance ? .25 : 0); add(g2, A('social', `bringing ${u.first} a gift`, { kind: 'gift', target: u.id, item: spare, n: spare === 'coins' ? 5 : 1, why: u.needs.food < 30 ? ' to stave off hunger' : v.goal === 'liked' && o < 10 ? ' to win them over' : '' })); }
      if ((v.goal === 'power' || v.goal === 'family') && o > (v.goal === 'power' ? 28 : 46) && op(u, v) > (v.goal === 'power' ? 18 : 40) && sim.clock > 600 && !u.alliance && sim.clock - ((v as any)._asked?.[u.id] ?? -9999) > 1440 && (!v.alliance || sim.alliances.find(a => a.id === v.alliance)!.members.length < 4)) add(.75 + T.ambition * .4, A('social', `recruiting ${u.first}`, { kind: 'ally', target: u.id }));
      if (o < -22 && (T.kindness > .55 || v.goal === 'liked' || v.family.includes(u.id)) && since > 300) add(.45 + T.kindness * .4 + (v.goal === 'liked' ? .3 : 0), A('social', `apologising to ${u.first}`, { kind: 'reconcile', target: u.id }));
      if (o < -35 && T.temper > .4 && since > 240) { const done = ((v as any)._confronted ??= new Set()); const why = [...v.mem.known.values()].filter(f => f.actor === u.id && f.valence < 0 && !done.has(f.id)).sort((a, b) => b.imp - a.imp)[0]; if (why || since > 1440) add(.35 + T.temper * .5 + (why ? .2 : 0), A('social', `confronting ${u.first}`, { kind: 'argue', target: u.id, why: why ? ((why as any).label ?? 'what they did') : 'old grudges', factId: why?.id })); }
      if (T.honesty < .4 && (u.act?.type === 'work' || u.act?.type === 'sit' || u.act?.type === 'trade_market' || sim.clock < u.busyUntil || u.anim === 'drink') && u.inv.coins >= 8 && o < 40 && dist < 25 && sim.clock > v.wanted && sim.hour > 7 && sim.hour < 20) add((T.greed - T.honesty) * .8 + (v.goal === 'wealth' ? .25 : 0) + (v.inv.coins < 10 ? .2 : 0), A('steal', `eyeing ${u.first}'s coin purse`, { target: u.id, loot: 'coins', lootN: Math.min(8, Math.floor(u.inv.coins / 3)) }));
      // fabricated rumours: dishonest power/wealth seekers smear their rivals
      if (T.honesty < .45 && (v.goal === 'power' || v.goal === 'wealth') && since > 120 && sim.clock - ((v as any)._lastRumour ?? -9999) > 900) { const rival = this.rival(v, sim); if (rival && rival !== u && op(u, rival) > -30 && !(v as any)._rumoured?.[rival.id + u.id]) add(.35 + (1 - T.honesty) * .5 + (v.goal === 'power' ? .2 : 0), A('social', `whispering to ${u.first}`, { kind: 'rumour', target: u.id, about: rival.id })); }
    }
    if (!cands.length) return false; cands.sort((a, b) => b[0] - a[0]); const [s, act] = cands[0]; if (s < .35) return false;
    const tgt = sim.byId.get(act.target)!; v.thought = thoughtFor(act, v, tgt); v.queue.push(act); return true;
  }

  rival(v: Villager, sim: Sim): Villager | null {
    const others = sim.villagers.filter(u => u !== v && !v.family.includes(u.id) && u.alliance !== v.alliance || (u !== v && !u.alliance && !v.family.includes(u.id)));
    if (!others.length) return null;
    const metric = (u: Villager) => v.goal === 'wealth' ? sim.wealth(u) : sim.power(u) + sim.popularity(u) / 4;
    return others.sort((a, b) => (metric(b) - op(v, b) * .6) - (metric(a) - op(v, a) * .6))[0];
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
    if (v.goal === 'wealth' || v.traits.greed > .6) { const rich = sim.villagers.filter(u => u !== v && sim.wealth(u) > sim.wealth(v) + 25 && !v.family.includes(u.id)).sort((a, b) => sim.wealth(b) - sim.wealth(a))[0]; if (rich) { v.opinion[rich.id] = (v.opinion[rich.id] ?? 0) - 6; v.mem.add(sim.clock, `${rich.first} is getting rich while I scrape by`, 5, [rich.id], -.5, 'feeling'); if (!headline) headline = `Why does ${rich.first} get all the luck?`; } }
    if (v.inv.coins > 60 && !v.mem.belief(v.id)) { v.mem.setBelief({ about: v.id, text: 'Hard work is paying off.', t: sim.clock, valence: .5 }); }
    if (headline) { v.thought = headline; if (top > 8 && /trusted|true friend/.test(headline) && sim.clock - ((sim as any)._lastReflectLog ?? -1e9) > 120) { (sim as any)._lastReflectLog = sim.clock; sim.log(`${v.first} reflected on recent days and decided: "${headline}"`, 4, [v.id], 'reflect', '💭'); } }
    v.replan = sim.hour > 6 && sim.hour < 20; // re-plan the rest of the day in light of the new beliefs
  }
}
function workNote(v: Villager) { return ({ baker: 'bake bread', blacksmith: 'forge tools', merchant: 'trade', farmer: 'tend the fields', woodcutter: 'chop wood', miner: 'mine ore', tavernkeeper: 'brew', shepherd: 'feed hens & pick apples' } as any)[v.job]; }
function thoughtFor(a: Action, v: Villager, u: Villager) {
  switch (a.kind ?? a.type) {
    case 'chat': return `I wonder how ${u.first} is doing.`; case 'invite': return `${u.first} would love tonight's gathering.`; case 'gossip': return `${u.first} needs to hear this...`;
    case 'gift': return `A gift for ${u.first}${a.why ? a.why : ''}.`; case 'ally': return `${u.first} and I could do great things together.`; case 'reconcile': return `I should make things right with ${u.first}.`;
    case 'argue': return `I've had enough of ${u.first}.`; case 'steal': return `${u.first} won't notice a few coins missing...`; case 'trade': return `Let's make a deal with ${u.first}.`;
  }
  return '...';
}
export { fmtTime };
