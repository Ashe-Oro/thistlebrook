import type { Sim } from './sim';
import type { Villager, Action, Item } from './types';
import { ITEM_ICON, FOOD } from './types';
import type { Fact } from '../agents/memory';
import { clamp } from '../core/util';

const COLORS = ['#e05a47', '#3f7fd6', '#e0b13a', '#8a4fc9', '#2fa37a', '#e57fb0'];
const ALLIANCE_NAMES = ['the Lantern Pact', 'the Copper Circle', 'the Hearth Guild', 'the Oak Accord', 'the Thistle League', 'the Ember Society'];

export function op(a: Villager, b: Villager) { return a.opinion[b.id] ?? 0; }
export function bump(sim: Sim, a: Villager, b: Villager, d: number) {
  const before = a.opinion[b.id] ?? 0, after = clamp(before + d, -100, 100); a.opinion[b.id] = after;
  if (before < 70 && after >= 70 && !a.family.includes(b.id)) { sim.log(`${a.first} now counts ${b.first} as a close friend.`, 5, [a.id, b.id], 'bond', '💞'); if ((b.opinion[a.id] ?? 0) >= 70) sim.achieve(null, `bff-${[a.id, b.id].sort().join('-')}`, 'Best Friends', `${a.first} & ${b.first}`); }
  if (before > -50 && after <= -50) { sim.log(`${a.first} has come to resent ${b.first}.`, 5, [a.id, b.id], 'bond', '😠'); if ((b.opinion[a.id] ?? 0) <= -50) sim.achieve(null, `rivals-${[a.id, b.id].sort().join('-')}`, 'Arch-Rivals', `${a.first} vs ${b.first}`); }
}
function trust(listener: Villager, speaker: Villager) { return clamp((op(listener, speaker) + 60) / 100, .15, 1.2); }
type Line = [Villager, string, string];
function convo(sim: Sim, lines: Line[], gap = 5) { sim.emit('convo', lines.map((l, i) => ({ who: l[0].id, text: l[1], emoji: l[2], at: sim.clock + i * gap }))); return Math.max(10, lines.length * gap + 3); }

export function pickGossip(v: Villager, t: Villager, sim: Sim): Fact | null {
  const warn = (f: Fact) => f.about === t.id && f.valence < 0 && (f as any).fake && op(v, t) > 30 && f.origin !== v.id; // friends warn you about rumours concerning you
  const cands = [...v.mem.known.values()].filter(f => f.kind === 'deed' && (f.about !== t.id || warn(f)) && f.actor !== t.id && !t.mem.known.has(f.id) && sim.clock - f.t < 60 * 48 && (f.valence < 0 || f.imp >= 5 || v.traits.kindness > .7));
  if (!cands.length) return null;
  const mean = v.goal === 'power' || v.traits.kindness < .4;
  cands.sort((a, b) => (b.imp + (mean ? -b.valence : b.valence) * 3) - (a.imp + (mean ? -a.valence : a.valence) * 3));
  return cands[0];
}
export function pendingInvite(v: Villager, t: Villager, sim: Sim): Fact | null {
  for (const p of sim.parties) if (!p.done && sim.clock < p.until && v.mem.known.has(p.id) && !t.mem.known.has(p.id) && (op(t, sim.byId.get(p.host)!) > -40)) return p.fact;
  return null;
}

export function resolveSocial(sim: Sim, v: Villager, t: Villager, a: Action): number {
  const R = sim.rng; v.lastSocial[t.id] = sim.clock; t.lastSocial[v.id] = sim.clock;
  const soc = (x: Villager, n: number) => x.needs.social = Math.min(100, x.needs.social + n);
  const hi = R.pick([`Morning, ${t.first}!`, `Hey ${t.first}!`, `${t.first}! Got a minute?`, `Fine day, ${t.first}.`]);
  switch (a.kind ?? a.type) {
    case 'chat': {
      soc(v, 30); soc(t, 25); const compat = 1 - Math.abs(v.traits.sociability - t.traits.sociability) - Math.abs(v.traits.kindness - t.traits.kindness) * .5;
      const grumpy = (v.needs.food < 30 || v.needs.energy < 25 ? v.traits.temper : 0) + (t.needs.food < 30 || t.needs.energy < 25 ? t.traits.temper : 0); const d = Math.round(compat * 6 + R.range(-3, 3) - grumpy * 8); bump(sim, v, t, d); bump(sim, t, v, d);
      const topics: Line[][] = [
        [[v, hi, '👋'], [t, R.pick(['Busy day!', 'Can\u2019t complain.', 'Did you see the sky this morning?']), '🙂'], [v, R.pick(v.def.catchphrases), '💬'], [t, d > 2 ? 'Ha! Exactly.' : 'Hmm, if you say so.', d > 2 ? '😄' : '😐']],
        [[v, hi, '👋'], [t, R.pick(['The bread smelled amazing today.', 'Prices at the market are wild.', 'My back is killing me.', 'Heard any news?']), '💬'], [v, R.pick(['Tell me about it.', 'Same here!', 'Really?']), '😮'], [t, R.pick(t.def.catchphrases), '😄']],
      ];
      const lines = R.pick(topics);
      // share a bit of gossip if they have any (Smallville: conversations spread information)
      const g = pickGossip(v, t, sim); let extra = 0;
      if (g && R.chance(.35 + v.traits.sociability * .4)) { extra = tellGossip(sim, v, t, g, lines); }
      const inv = pendingInvite(v, t, sim); if (inv) extra += tellInvite(sim, v, t, inv, lines);
      if (d < -3) { lines[lines.length - 1] = [t, R.pick(['Not now, I\u2019m not in the mood.', 'Do you ever stop talking?', 'Ugh. Whatever.']), '😒']; v.emotions.anger += .25; }
      if (!g && !inv && d >= 2 && R.chance(.25)) sim.log(`${v.first} and ${t.first} had a friendly chat${R.chance(.5) ? ' by ' + nearPlace(sim, v) : ''}.`, 1, [v.id, t.id], 'talk', '💬');
      if (d < -3) { sim.log(`${t.first} snapped at ${v.first} — someone got out of bed on the wrong side.`, 3, [t.id, v.id], 'talk', '😒'); v.mem.add(sim.clock, `${t.first} snapped at me`, 4, [t.id], -.5); } else if (d < -1) { sim.log(`${v.first} and ${t.first}'s chat turned awkward.`, 2, [v.id, t.id], 'talk', '😬'); }
      v.mem.add(sim.clock, `Chatted with ${t.first}`, 2, [t.id], d / 10); t.mem.add(sim.clock, `Chatted with ${v.first}`, 2, [v.id], d / 10);
      return convo(sim, lines) + extra;
    }
    case 'gift': {
      const item = a.item as Item, n = Math.min(a.n ?? 1, v.inv[item]); if (n <= 0) return 4;
      sim.give(v, t, item, n); v.stats.gifts++; (v as any)._lastGift = sim.clock; ((v as any)._gave ??= {})[t.id] = sim.clock; soc(v, 20); soc(t, 20);
      const d = 10 + Math.round(n * (item === 'coins' ? .7 : 4)) + (t.needs.food < 30 && FOOD[item] ? 10 : 0); bump(sim, t, v, d); bump(sim, v, t, 3);
      t.emotions.love = Math.min(1, t.emotions.love + .6); t.emotions.joy += .4; sim.icon(t, '❤️'); sim.icon(v, '❤️');
      const why = a.why ?? ''; sim.log(`${v.first} gave ${t.first} ${n} ${item}${why}.`, 4, [v.id, t.id], 'gift', '🎁');
      const f = sim.fact('deed', `${v.first} gave ${t.first} a gift of ${item}`, v.id, v.id, .5, 2, t.id); sim.witness(`${v.first} gave ${t.first} ${item}`, 4, [v.id, t.id], { [t.id]: .8, [v.id]: .4, '*': .2 }, t.x, t.z, f, 10);
      if (v.stats.gifts >= 5) sim.achieve(v, 'generous', 'Generous Soul', `${v.first} has given 5 gifts`);
      return convo(sim, [[v, R.pick([`For you, ${t.first}!`, 'I thought you could use this.', 'A little something!']), ITEM_ICON[item]], [t, R.pick(['Oh! You shouldn\u2019t have!', 'That\u2019s so kind!', 'You\u2019re a treasure.']), '🥰'], [v, 'Anytime.', '😊']]);
    }
    case 'trade': {
      const [give, gn, get, gtn] = a.deal as [Item, number, Item, number];
      if (v.inv[give] < gn || t.inv[get] < gtn) return 4;
      const fair = gn * (sim.price(give, false)) >= gtn * sim.price(get, false) * .8;
      if (!fair && op(t, v) < 30) { bump(sim, t, v, -2); sim.log(`${t.first} turned down ${v.first}'s lowball offer.`, 2, [v.id, t.id], 'trade', '🙅'); return convo(sim, [[v, `${gn} ${give} for ${gtn} ${get}?`, '🤝'], [t, 'Ha! Not a chance.', '🙄']]); }
      sim.give(v, t, give, gn); sim.give(t, v, get, gtn); v.stats.trades++; t.stats.trades++; bump(sim, v, t, 4); bump(sim, t, v, 4); soc(v, 15); soc(t, 15);
      sim.log(`${v.first} traded ${gn} ${give} for ${t.first}'s ${gtn} ${get}.`, 3, [v.id, t.id], 'trade', '🤝'); sim.world.fx.coinBurst(t.x, 1.4, t.z, 3);
      sim.achieve(null, 'first-trade', 'Open for Business', `${v.first} & ${t.first} made the first trade`);
      return convo(sim, [[v, `${gn} ${give} for ${gtn} ${get}?`, '🤝'], [t, R.pick(['Deal!', 'You drive a hard bargain. Deal.', 'Sounds fair.']), '👍'], [v, 'Pleasure doing business.', '🪙']]);
    }
    case 'gossip': {
      const f = a.fact as Fact; const lines: Line[] = [[v, R.pick([`Psst, ${t.first}...`, 'Can you keep a secret?', 'You didn\u2019t hear this from me...']), '🤫']];
      const ex = tellGossip(sim, v, t, f, lines); soc(v, 15); soc(t, 15); bump(sim, t, v, 2); return convo(sim, lines) + ex;
    }
    case 'invite': {
      const f = a.fact as Fact; const lines: Line[] = [[v, hi, '👋']]; const ex = tellInvite(sim, v, t, f, lines); soc(v, 15); soc(t, 15); return convo(sim, lines) + ex;
    }
    case 'ally': {
      const ok = op(t, v) > 22 && (t.goal === 'power' || t.goal === 'family' || op(t, v) > 50 || t.traits.sociability > .6) && !t.alliance;
      ((v as any)._asked ??= {})[t.id] = sim.clock;
      if (!ok || t.alliance) { bump(sim, v, t, -3); sim.log(`${t.first} politely declined ${v.first}'s offer of an alliance.`, 4, [v.id, t.id], 'ally', '🙅'); return convo(sim, [[v, 'We should stick together, you and I.', '🤝'], [t, 'I\u2019d rather stay my own person.', '😐']]); }
      let al = v.alliance ? sim.alliances.find(x => x.id === v.alliance)! : null;
      if (!al) { const i = sim.alliances.length % COLORS.length; al = { id: `al${sim.alliances.length + 1}`, name: ALLIANCE_NAMES[i], color: COLORS[i], members: [v.id], founded: sim.clock }; sim.alliances.push(al); v.alliance = al.id; }
      al.members.push(t.id); t.alliance = al.id; bump(sim, v, t, 10); bump(sim, t, v, 10);
      sim.log(al.members.length === 2 ? `${v.first} and ${t.first} shook hands and founded ${al.name}. Their banners now fly the same colour.` : `${t.first} joined ${v.first}'s ${al.name} (${al.members.length} members).`, 7, [v.id, t.id], 'ally', '🚩');
      const f = sim.fact('news', `${t.first} and ${v.first} are allied in ${al.name}`, v.id, v.id, .1, 6, t.id); sim.witness(`${v.first} and ${t.first} formed an alliance`, 6, [v.id, t.id], { [v.id]: .6, [t.id]: .6 }, v.x, v.z, f, 12);
      sim.achieve(v, 'ally', 'Alliance Formed', `${al.name} is born`); sim.icon(v, '🤝'); sim.icon(t, '🤝');
      return convo(sim, [[v, 'Together we could run this village.', '🤝'], [t, 'I\u2019m in.', '💪'], [v, `To ${al.name}!`, '🚩']]);
    }
    case 'reconcile': {
      const gift: Item | null = v.inv.bread > 0 ? 'bread' : v.inv.apples > 0 ? 'apples' : v.inv.coins >= 4 ? 'coins' : null; if (gift) sim.give(v, t, gift, gift === 'coins' ? 4 : 1);
      const accept = t.traits.kindness * 60 + op(t, v) + (gift ? 25 : 0) + R.range(0, 30) > 25;
      if (!accept) { bump(sim, t, v, 3); sim.log(`${v.first} tried to apologise to ${t.first}, who wasn't ready to forgive.`, 5, [v.id, t.id], 'reconcile', '💔'); t.emotions.anger += .2; return convo(sim, [[v, 'I\u2019m sorry. Truly.', '🙏'], [t, 'Sorry doesn\u2019t cut it.', '😤']]); }
      t.opinion[v.id] = Math.max(op(t, v) + 35, 10); v.opinion[t.id] = Math.max(op(v, t) + 30, 15); t.emotions.anger = 0; v.emotions.anger = 0; t.emotions.joy += .3; sim.icon(v, '🕊️'); sim.icon(t, '🕊️');
      const wronged = [...v.mem.known.values()].some(f => f.actor === t.id && f.valence < 0 && (f.target === v.id || f.about === v.id));
      const guilty = [...t.mem.known.values()].some(f => f.actor === v.id && f.valence < 0);
      sim.log(wronged ? `${v.first} offered ${t.first} an olive branch${gift ? ' and a gift' : ''}. They made up.` : guilty ? `${v.first} apologised to ${t.first}${gift ? ' with a peace offering' : ''}. They made up.` : `${v.first} cleared the air with ${t.first}${gift ? ' over a shared snack' : ''}. They're on good terms again.`, 6, [v.id, t.id], 'reconcile', '🕊️'); sim.achieve(null, `made-up-${v.id}-${t.id}`, 'Water Under the Bridge', `${v.first} and ${t.first} reconciled`);
      const f = sim.fact('deed', `${v.first} and ${t.first} buried the hatchet`, v.id, v.id, .5, 5, t.id); sim.witness(`${v.first} made peace with ${t.first}`, 5, [v.id, t.id], { [v.id]: .6, [t.id]: .6, '*': .2 }, v.x, v.z, f, 10);
      return convo(sim, [[v, 'I\u2019m sorry about before.', '🙏'], [t, '...Alright. Water under the bridge.', '🙂'], [v, 'Friends?', '🤝'], [t, 'Friends.', '😊']]);
    }
    case 'argue': {
      if (a.factId) ((v as any)._confronted ??= new Set()).add(a.factId);
      bump(sim, v, t, -6); bump(sim, t, v, -8); v.emotions.anger = Math.min(1, v.emotions.anger + .4); t.emotions.anger = Math.min(1, t.emotions.anger + .5); sim.icon(v, '💢'); sim.icon(t, '💢');
      const grudge = a.why ?? 'old grudges';
      const lines: Line[] = [[v, R.pick(['We need to talk.', `You\u2019ve got some nerve, ${t.first}.`, 'I know what you did.']), '😠'], [t, R.pick(['Oh, here we go.', 'What now?', 'Leave me alone.']), '🙄'], [v, R.pick(['Everyone knows about it!', 'You\u2019re a menace!', 'Stay away from my family.']), '💢'], [t, R.pick(['Say that again!', 'You want trouble?', 'Liar!']), '😡']];
      const escalate = v.traits.temper + t.traits.temper + v.emotions.anger * .5 + R.range(0, .6) > 1.75 && v.traits.bravery > .35;
      if (escalate) { a.after = () => { sim.startFight(v, t, `An argument between ${v.first} and ${t.first} over ${grudge} boiled over`); }; }
      else sim.log(`${v.first} confronted ${t.first} over ${grudge}. Voices were raised.`, 5, [v.id, t.id], 'argue', '💢');
      const f = sim.fact('deed', `${v.first} and ${t.first} had a shouting match`, v.id, t.id, -.3, 4, t.id); sim.witness(`${v.first} argued with ${t.first}`, 4, [v.id, t.id], { [v.id]: -.5, [t.id]: -.6, '*': -.1 }, v.x, v.z, f, 12);
      return convo(sim, lines, 4);
    }
    case 'rumour': {
      const about = sim.byId.get(a.about)!; const lies = [`${about.first} waters down what they sell`, `${about.first} cheats at cards`, `${about.first} has been skimming coins from the market`, `${about.first} badmouths everyone behind their backs`, `${about.first} is planning to steal ${t.first}'s customers`, `${about.first} kicked a chicken`];
      (v as any)._lastRumour = sim.clock; const f = sim.fact('deed', R.pick(lies), about.id, about.id, -.6, 6); (f as any).fake = true; f.origin = v.id; v.mem.learn(f); ((v as any)._rumoured ??= {})[about.id + t.id] = 1;
      const lines: Line[] = [[v, R.pick([`Between you and me, ${t.first}...`, 'Don\u2019t repeat this, but...', 'I probably shouldn\u2019t say...']), '🤫']];
      const believed = t.traits.honesty < .8 || op(t, v) > 20 || R.chance(.5);
      if (believed) { sim.learnFact(t, f, v); bump(sim, t, about, -Math.round(10 * trust(t, v))); t.mem.add(sim.clock, `${v.first} told me ${f.text}`, 5, [about.id, v.id], -.5, 'heard', f.id); lines.push([v, `${f.text}.`, '🐍'], [t, R.pick(['I had no idea!', 'Hmm. That explains a lot.', 'Really?!']), '😮']); sim.log(`${v.first} whispered to ${t.first} that ${f.text}. (It isn't true.)`, 5, [v.id, t.id, about.id], 'gossip', '🐍'); }
      else { bump(sim, t, v, -8); lines.push([v, `${f.text}.`, '🐍'], [t, 'I don\u2019t believe that for a second.', '🤨']); sim.log(`${v.first} tried to spread a rumour about ${about.first}, but ${t.first} wasn't buying it.`, 5, [v.id, t.id, about.id], 'gossip', '🤨'); }
      sim.achieve(v, 'rumour', 'Silver Tongue', `${v.first} started a rumour`);
      return convo(sim, lines);
    }
    case 'ask_food': {
      const has: Item | null = t.inv.bread > 0 ? 'bread' : t.inv.apples > 0 ? 'apples' : t.inv.eggs > 0 ? 'eggs' : null;
      const yes = has && (t.traits.kindness * 70 + op(t, v) + (t.family.includes(v.id) ? 60 : 0) + R.range(0, 30) > 55);
      if (yes && has) { sim.give(t, v, has, 1); bump(sim, v, t, 15); t.stats.gifts++; sim.icon(v, '❤️'); sim.log(`A hungry ${v.first} asked ${t.first} for food, and ${t.first} shared ${has}.`, 4, [v.id, t.id], 'gift', '🍞'); v.queue.unshift({ type: 'eat', item: has, t: 0, label: 'eating' }); return convo(sim, [[v, 'I haven\u2019t eaten all day...', '🥺'], [t, 'Here, take this.', ITEM_ICON[has]], [v, 'Thank you, truly.', '🥹']]); }
      bump(sim, v, t, -10); v.emotions.sadness += .3; sim.log(`${t.first} refused to share food with a starving ${v.first}.`, 5, [v.id, t.id], 'gift', '🙅');
      v.mem.add(sim.clock, `${t.first} refused to feed me when I was starving`, 7, [t.id], -.8); const f = sim.fact('deed', `${t.first} refused to share food with a starving ${v.first}`, t.id, t.id, -.5, 5, v.id); (f as any).label = `refusing to feed ${v.first}`; v.mem.learn(f);
      return convo(sim, [[v, 'Could you spare a bite?', '🥺'], [t, has ? 'Get your own.' : 'I\u2019ve got nothing, sorry.', has ? '😒' : '😕']]);
    }
    case 'steal': {
      const loot = a.loot as Item, n = Math.min(a.lootN ?? 3, t.inv[loot]); if (n <= 0) return 2;
      sim.give(t, v, loot, n); v.stats.stolen += n; v.wanted = sim.clock + 900; a._noFace = true;
      const seen = R.chance(.35 + t.traits.bravery * .2 - v.traits.bravery * .1);
      const witnesses = sim.villagers.filter(w => w !== v && w !== t && !w.inside && Math.hypot(w.x - v.x, w.z - v.z) < 11 && w.doing !== 'sleeping');
      const f = sim.fact('deed', `${v.first} stole ${loot} from ${t.first}`, v.id, v.id, -.9, 8, t.id); (f as any).label = `stealing from ${t.first}`;
      sim.icon(v, '🫳');
      if (seen || witnesses.length) {
        const who = seen ? t : witnesses[0];
        t.mem.add(sim.clock, `${v.first} stole ${n} ${loot} from me!`, 9, [v.id], -1, 'obs', f.id); t.mem.learn(f); for (const w of witnesses) { w.mem.add(sim.clock, `Saw ${v.first} steal from ${t.first}`, 8, [v.id, t.id], -.8, 'obs', f.id); w.mem.learn(f); bump(sim, w, v, -15); }
        bump(sim, t, v, -35); t.emotions.anger = 1; t.emotions.surprise = 1;
        sim.say(who, seen ? 'Hey! THIEF!' : `${t.first}! ${v.first} just robbed you!`, '😱', 3); sim.say(v, 'Uh oh...', '😬', 2);
        sim.log(`${v.first} pickpocketed ${n} ${loot} from ${t.first} — but ${seen ? t.first + ' noticed' : witnesses[0].first + ' saw it'}! A chase is on!`, 8, [v.id, t.id, ...witnesses.map(w => w.id)], 'theft', '🏃');
        a.after = () => { v.act = null; v.queue = [{ type: 'flee', place: v.def.home, t: 0, label: 'fleeing!', run: true, loot, lootN: n } as any]; v.queue.push({ type: 'enter', place: v.def.home, dur: 30, t: 0, label: 'hiding at home' }); };
        if (t.traits.bravery > .3 && !t.inside) { t.busyUntil = 0; sim.leaveSeat(t); t.act = { type: 'chase', target: v.id, t: -1.2, label: `chasing ${v.first}!` }; t.queue = []; }
        sim.achieve(null, 'first-theft', 'Thief in Thistlebrook', `${v.first} was caught red-handed`);
        return .4;
      } else {
        v.mem.add(sim.clock, `I swiped ${n} ${loot} from ${t.first} and nobody saw`, 6, [t.id], .2); v.mem.learn(f);
        t.mem.add(sim.clock, `Some of my ${loot} went missing`, 5, [], -.4);
        sim.log(`${v.first} quietly pocketed ${n} ${loot} from ${t.first}. Nobody noticed... yet.`, 6, [v.id, t.id], 'theft', '🤫'); sim.say(v, '...', '😏', 2);
        sim.achieve(v, 'sneaky', 'Light Fingers', `${v.first} stole without being seen`);
      }
      return 2;
    }
  }
  return 6;
}
function nearPlace(sim: Sim, v: Villager) { let best = 'the road', bd = 1e9; for (const p of sim.world.places.values()) { const d = Math.hypot(p.cx - v.x, p.cz - v.z); if (d < bd && p.kind !== 'home') { bd = d; best = p.name; } } return best; }

export function tellGossip(sim: Sim, v: Villager, t: Villager, f: Fact, lines: Line[]) {
  if (!sim.learnFact(t, f, v)) return 0;
  const about = sim.byId.get(f.about), tr = trust(t, v), hops = ((f as any).hops = ((f as any).hops ?? 1) + 1); void hops;
  if (about === t) { // a friend tips you off about a rumour about you
    const liar = sim.byId.get(f.origin)!; bump(sim, t, liar, -30); bump(sim, t, v, 6); t.emotions.anger = 1; sim.icon(t, '💢');
    t.mem.add(sim.clock, `${v.first} warned me that ${liar.first} has been spreading lies about me`, 8, [liar.id, v.id], -.9, 'heard', f.id);
    lines.push([v, `${liar.first} is telling everyone that ${f.text.replace(t.first + ' ', 'you ').replace(/ (his|her|their) /, ' your ')}...`, '😬'], [t, `${liar.first} said WHAT?!`, '😡']);
    sim.log(`${v.first} warned ${t.first} that ${liar.first} has been spreading rumours about them.`, 6, [v.id, t.id, liar.id], 'gossip', '😡');
    const f2 = sim.fact('deed', `${liar.first} spread lies about ${t.first}`, liar.id, liar.id, -.6, 6, t.id); (f2 as any).label = 'the lies'; t.mem.learn(f2); v.mem.learn(f2);
    return 6;
  }
  if (about && about !== t) bump(sim, t, about, Math.round(f.valence * f.imp * 2.2 * tr));
  if (about && f.target && f.target !== t.id && f.valence < 0) { const victim = sim.byId.get(f.target); if (victim) bump(sim, t, victim, 2); }
  t.mem.add(sim.clock, `${v.first} told me: ${f.text}`, Math.max(2, f.imp - 1), [f.about, v.id], f.valence * tr, 'heard', f.id);
  lines.push([v, `Did you hear? ${f.text}!`, f.valence < 0 ? '🤫' : '✨'], [t, f.valence < 0 ? R2(sim, ['No way!', 'I knew it!', 'Unbelievable.']) : R2(sim, ['How lovely!', 'Good for them.']), f.valence < 0 ? '😱' : '😊']);
  (v as any)._lastGossip = sim.clock; const hopN = (f as any).hops as number;
  sim.log(`${v.first} told ${t.first} that ${lowerFirst(f.text)}.`, hopN <= 3 ? (f.valence < 0 ? 4 : 3) : 1, [v.id, t.id, f.about], 'gossip', '🗣️');
  const reach = sim.villagers.filter(x => x.mem.known.has(f.id)).length;
  if (reach >= 5 && !(f as any).viral) { (f as any).viral = true; sim.log(`Word travels fast: ${reach} villagers now know that ${lowerFirst(f.text)}.`, 6, [f.about], 'gossip', '📣'); sim.achieve(null, `viral-${f.id}`, 'The Grapevine', `A story reached ${reach} villagers`); }
  return 6;
}
export function tellInvite(sim: Sim, v: Villager, t: Villager, f: Fact, lines: Line[]) {
  if (!f.event || !sim.learnFact(t, f, v)) return 0; const host = sim.byId.get(f.event.host)!;
  const like = op(t, host); const keen = like > 20;
  t.mem.add(sim.clock, `${host.first === v.first ? v.first : v.first + ' says ' + host.first} is hosting ${f.event.title} tonight`, 5, [host.id], .3, 'heard', f.id);
  lines.push(host === v ? [v, `Come to my ${f.event.title.replace(/^(a|an|the) /, '')} tonight at ${sim.place(f.event.place).name}!`, '💌'] : [v, `${host.first}'s throwing ${f.event.title} tonight!`, '💌'], [t, keen ? 'I\u2019ll be there!' : like > -25 ? 'Maybe I\u2019ll stop by.' : 'Hmph. We\u2019ll see.', keen ? '🥳' : '🤔']);
  sim.log(host === v ? `${v.first} invited ${t.first} to ${f.event.title}.` : `${v.first} passed ${host.first}'s invitation on to ${t.first}.`, 3, [v.id, t.id, host.id], 'invite', '💌');
  if (host === v) bump(sim, t, v, 3); return 5;
}
function lowerFirst(s: string) { return s; }
function R2(sim: Sim, a: string[]) { return sim.rng.pick(a); }

// Edgar-style eavesdropping: anyone close by and idle can pick up a piece of the gossip
export function maybeOverhear(sim: Sim, a: Villager, b: Villager) {
  for (const w of sim.villagers) { if (w === a || w === b || w.inside || Math.hypot(w.x - a.x, w.z - a.z) > 6) continue;
    const g = pickGossip(a, w, sim); if (!g) continue; if (sim.rng.chance(w.job === 'tavernkeeper' ? .8 : .25)) { if (sim.learnFact(w, g)) { w.mem.add(sim.clock, `Overheard: ${g.text}`, 4, [g.about], g.valence * .7, 'heard', g.id); const ab = sim.byId.get(g.about); if (ab && ab !== w) bump(sim, w, ab, Math.round(g.valence * g.imp)); sim.icon(w, '👂'); } } }
}
