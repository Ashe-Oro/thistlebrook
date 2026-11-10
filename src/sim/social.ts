import type { Sim } from './sim';
import type { Villager, Action } from './types';
import { JOB_INFO } from '../data/villagers';
import type { Fact } from '../agents/memory';
import { clamp } from '../core/util';
import { say, smalltalk, pr } from './lines';
import { planWedding, recordProposal, proposalReady } from './gatherings';

const COLORS = ['#e05a47', '#3f7fd6', '#e0b13a', '#8a4fc9', '#2fa37a', '#e57fb0'];
const ALLIANCE_NAMES = ['the Lantern Pact', 'the Copper Circle', 'the Hearth Guild', 'the Oak Accord', 'the Thistle League', 'the Ember Society'];

export function op(a: Villager, b: Villager) { return a.opinion[b.id] ?? 0; }
// --- grievance ledger: wrongs accumulate per pair and fade with time, so confrontations need a real build-up ---
const GRV_HALF = 1600; /* game-minute half-life: yesterday's slight is half forgotten */
export const ARGUE_GRIEVANCE = 25, FIGHT_GRIEVANCE = 55;
export function grievance(sim: Sim, a: Villager, bId: string): number { const g = (a as any)._grv?.[bId]; return g ? g.v * Math.pow(.5, (sim.clock - g.t) / GRV_HALF) : 0; }
export function addGrievance(sim: Sim, a: Villager, bId: string, amt: number) { const G = ((a as any)._grv ??= {}); const nv = Math.min(100, grievance(sim, a, bId) + amt); if (nv <= .5) delete G[bId]; else G[bId] = { v: nv, t: sim.clock }; }
export function bump(sim: Sim, a: Villager, b: Villager, d: number) {
  const before = a.opinion[b.id] ?? 0, after = clamp(before + d, -100, 100); a.opinion[b.id] = after;
  if (d < 0 && !a.family.includes(b.id)) addGrievance(sim, a, b.id, -d * .8); /* every slight feeds the ledger */
  if (before < 70 && after >= 70 && !a.family.includes(b.id)) { const mutual = (b.opinion[a.id] ?? 0) >= 70; const said = ((sim as any)._bff ??= new Set<string>()); const key = [a.id, b.id].sort().join('-');
    // one line per friendship: the second half of a mutual pair upgrades it instead of mirroring it
    if (!said.has(key)) { said.add(key); sim.log(mutual ? `${a.first} and ${b.first} are firm friends now.` : `${a.first} now counts ${b.first} as a close friend.`, 5, [a.id, b.id], 'bond', '💞'); } else if (mutual && !said.has(key + '!')) { said.add(key + '!'); sim.log(`${a.first} and ${b.first} are firm friends now, and it goes both ways.`, 5, [a.id, b.id], 'bond', '💞'); } if ((b.opinion[a.id] ?? 0) >= 70) sim.achieve(null, `bff-${[a.id, b.id].sort().join('-')}`, 'Best Friends', `${a.first} & ${b.first}`); }
  if (before > -50 && after <= -50) { sim.log(`${a.first} has come to resent ${b.first}.`, 5, [a.id, b.id], 'bond', '😠'); if ((b.opinion[a.id] ?? 0) <= -50) sim.achieve(null, `rivals-${[a.id, b.id].sort().join('-')}`, 'Arch-Rivals', `${a.first} vs ${b.first}`); }
}
function trust(listener: Villager, speaker: Villager) { return clamp((op(listener, speaker) + 60) / 100, .15, 1.2); }
type Line = [Villager, string, string];
function convo(sim: Sim, lines: Line[], gap = 5) { sim.emit('convo', lines.map((l, i) => ({ who: l[0].id, text: l[1], emoji: l[2], at: sim.clock + i * gap }))); return Math.max(10, lines.length * gap + 3); }

export function pickGossip(v: Villager, t: Villager, sim: Sim): Fact | null {
  const warn = (f: Fact) => f.about === t.id && f.valence < 0 && (f as any).fake && op(v, t) > 30 && f.origin !== v.id; // friends warn you about rumours concerning you
  const cands = [...v.mem.known.values()].filter(f => f.kind === 'deed' && f.about !== v.id && f.actor !== v.id && (f.about !== t.id || warn(f)) && f.actor !== t.id && !t.mem.known.has(f.id) && sim.clock - f.t < 60 * 48 && (f.valence < 0 || f.imp >= 5 || v.traits.kindness > .7));
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
  const hi = say(sim, v, 'greeting', { t: t.first });
  switch (a.kind ?? a.type) {
    case 'chat': {
      soc(v, 30); soc(t, 25); const compat = 1 - Math.abs(v.traits.sociability - t.traits.sociability) - Math.abs(v.traits.kindness - t.traits.kindness) * .5;
      const grumpy = (v.needs.food < 30 || v.needs.energy < 25 ? v.traits.temper : 0) + (t.needs.food < 30 || t.needs.energy < 25 ? t.traits.temper : 0); const d = Math.round(compat * 6 + R.range(-3, 3) - grumpy * 8); bump(sim, v, t, d); bump(sim, t, v, d);
      const topics: Line[][] = [
        [[v, hi, '👋'], [t, smalltalk(sim, t), '🙂'], [v, R.pick(v.def.catchphrases), '💬'], [t, d > 2 ? say(sim, t, 'agree') : say(sim, t, 'disagree'), d > 2 ? '😄' : '😐']],
        [[v, hi, '👋'], [t, smalltalk(sim, t), '💬'], [v, say(sim, v, 'chatReact'), '😮'], [t, R.pick(t.def.catchphrases), '😄']],
      ];
      const lines = R.pick(topics);
      // share a bit of gossip if they have any (Smallville: conversations spread information)
      const g = pickGossip(v, t, sim); let extra = 0;
      if (g && R.chance(.35 + v.traits.sociability * .4)) { extra = tellGossip(sim, v, t, g, lines); }
      const inv = pendingInvite(v, t, sim); if (inv) extra += tellInvite(sim, v, t, inv, lines);
      if (d < -3) { lines[lines.length - 1] = [t, say(sim, t, 'snap'), '😒']; v.emotions.anger += .25; }
      if (!g && !inv && d >= 2 && R.chance(.25)) sim.log(`${v.first} and ${t.first} had a friendly chat${R.chance(.5) ? ' by ' + nearPlace(sim, v) : ''}.`, 1, [v.id, t.id], 'talk', '💬');
      if (d < -3) { sim.log(`${t.first} snapped at ${v.first} — someone got out of bed on the wrong side.`, 3, [t.id, v.id], 'talk', '😒'); v.mem.add(sim.clock, `${t.first} snapped at me`, 4, [t.id], -.5); } else if (d < -1) { sim.log(`${v.first} and ${t.first}'s chat turned awkward.`, 2, [v.id, t.id], 'talk', '😬'); }
      v.mem.add(sim.clock, `Chatted with ${t.first}`, 2, [t.id], d / 10); t.mem.add(sim.clock, `Chatted with ${v.first}`, 2, [v.id], d / 10);
      return convo(sim, lines) + extra;
    }
    case 'gift': {
      const [icon, what] = JOB_INFO[v.job].gift; const romantic = v.crush === t.id && !v.family.includes(t.id);
      v.stats.gifts++; (v as any)._lastGift = sim.clock; ((v as any)._gave ??= {})[t.id] = sim.clock; soc(v, 20); soc(t, 20);
      const d = 12 + (t.needs.social < 30 ? 6 : 0) + (romantic && t.crush === v.id ? 10 : 0); bump(sim, t, v, d); bump(sim, v, t, 3);
      t.emotions.love = Math.min(1, t.emotions.love + (romantic ? .8 : .5)); t.emotions.joy += .4; sim.icon(t, romantic ? '💗' : '❤️'); sim.icon(v, romantic ? '💗' : '❤️');
      const why = a.why ?? ''; sim.log(romantic ? `${v.first} shyly gave ${t.first} ${what}${R.chance(.5) ? ', blushing to the ears' : ''}.` : `${v.first} gave ${t.first} ${what}${why}.`, romantic ? 5 : 4, [v.id, t.id], romantic ? 'romance' : 'gift', icon);
      const f = sim.fact('deed', romantic ? `${v.first} gave ${t.first} ${what} and blushed` : `${v.first} gave ${t.first} ${what}`, v.id, v.id, romantic ? .2 : .5, romantic ? 6 : 2, t.id); if (romantic) (f as any).romance = true;
      sim.witness(`${v.first} gave ${t.first} ${what}`, 4, [v.id, t.id], { [t.id]: .8, [v.id]: .4, '*': .2 }, t.x, t.z, f, 10);
      if (v.stats.gifts >= 5) sim.achieve(v, 'generous', 'Generous Soul', `${v.first} has given 5 gifts`);
      return convo(sim, [[v, say(sim, v, romantic ? 'giftGiveRomantic' : 'giftGiveNormal', { t: t.first }), icon], [t, say(sim, t, romantic ? 'giftReceiveRomantic' : 'giftReceiveNormal', { v: v.first }), romantic ? '😳' : '🥰'], [v, romantic ? '...' : 'Anytime.', '😊']]);
    }
    case 'flirt': {
      (v as any)._flirted = sim.clock; (v as any)._flirtWith = t.id; soc(v, 20); soc(t, 15); const recept = op(t, v) + (t.crush === v.id ? 30 : 0) + t.traits.sociability * 20 - (t.partner && t.partner !== v.id ? 60 : 0) + R.range(-15, 15);
      const lines: Line[] = [[v, say(sim, v, 'flirt', { t: t.first }), '💗']];
      if (recept > 30) { bump(sim, t, v, 7); bump(sim, v, t, 4); t.emotions.love = Math.min(1, t.emotions.love + .5); v.emotions.love = Math.min(1, v.emotions.love + .6); sim.icon(v, '💗'); sim.icon(t, '😊'); lines.push([t, say(sim, t, 'flirtWarm'), '😊']); if (op(t, v) > 55 && !t.crush && !t.partner && !t.family.includes(v.id) && t.def.age !== 'teen') t.crush = v.id; }
      else { bump(sim, v, t, -2); v.emotions.sadness += .2; lines.push([t, say(sim, t, 'flirtAwkward'), '😅']); }
      const f = sim.fact('deed', `${v.first} has been sweet-talking ${t.first}`, v.id, v.id, .1, 5, t.id); (f as any).romance = true; v.mem.learn(f); sim.witness(`${v.first} flirted with ${t.first}`, 4, [v.id, t.id], { [v.id]: .4, [t.id]: recept > 30 ? .5 : -.1 }, v.x, v.z, f, 9);
      if (recept > 30 && R.chance(.45)) sim.log(`${v.first} was flirting with ${t.first} ${R.pick(['by the well', 'in plain sight', 'again', 'and fooling nobody'])}.`, 3, [v.id, t.id], 'romance', '💗');
      else if (recept <= 30 && R.chance(.5)) sim.log(`${v.first} tried a sweet line on ${t.first}. It did not land.`, 3, [v.id, t.id], 'romance', '😅');
      return convo(sim, lines);
    }
    case 'confess': {
      ((v as any)._confessed ??= {})[t.id] = sim.clock; const yes = !t.partner && (t.crush === v.id || op(t, v) > 62) && !t.family.includes(v.id) && R.range(0, 1) < .55 + op(t, v) / 200;
      if (yes) {
        if (v.partner) { const ex = sim.byId.get(v.partner); if (ex) sim.breakUp(v, ex); }
        sim.couple(v, t); bump(sim, v, t, 15); bump(sim, t, v, 15); v.emotions.love = t.emotions.love = 1; v.emotions.joy = t.emotions.joy = 1; sim.icon(v, '💞'); sim.icon(t, '💞'); sim.world.fx.sparkle(t.x, 1.8, t.z, [1, .5, .7], 26);
        sim.log(`${v.first} confessed ${pr(v).pos} feelings to ${t.first}, and ${t.first} said yes! Thistlebrook has new sweethearts.`, 9, [v.id, t.id], 'romance', '💞'); sim.achieve(null, `couple-${[v.id, t.id].sort().join('-')}`, 'Sweethearts', `${v.first} & ${t.first}`);
        const f = sim.fact('news', `${v.first} and ${t.first} are sweethearts now`, v.id, v.id, .4, 8, t.id); (f as any).romance = true; sim.witness(`${v.first} and ${t.first} became sweethearts`, 8, [v.id, t.id], { [v.id]: 1, [t.id]: 1, '*': .2 }, v.x, v.z, f, 14);
        return convo(sim, [[v, say(sim, v, 'confess', { t: t.first }), '💗'], [t, say(sim, t, 'confessYes'), '🥹'], [v, 'Really?!', '😳'], [t, 'Really.', '💞']], 5);
      }
      v.crush = null; v.heartbreak = sim.clock + 1440; v.emotions.sadness = 1; v.emotions.love = 0; bump(sim, v, t, -8); sim.icon(v, '💔');
      v.mem.add(sim.clock, `I told ${t.first} how I feel. ${t.first} said no.`, 9, [t.id], -.6, 'feeling');
      sim.log(`${v.first} poured ${pr(v).pos} heart out to ${t.first}, who let ${pr(v).obj} down gently. ${v.first} walked home alone.`, 8, [v.id, t.id], 'romance', '💔'); sim.achieve(v, 'heartbreak', 'Heartbreak', `${v.first} was turned down`);
      const f = sim.fact('deed', `${v.first} confessed to ${t.first} and got turned down`, v.id, v.id, -.2, 7, t.id); t.mem.learn(f);
      a.after = () => { v.queue.unshift({ type: 'enter', place: v.def.home, dur: 60, t: 0, label: 'moping at home' }); };
      return convo(sim, [[v, say(sim, v, 'confess', { t: t.first }), '💗'], [t, say(sim, t, 'confessNo'), '😟'], [v, say(sim, v, 'confessHeartbroken', { t: t.first }), '💔']], 5);
    }
    case 'propose': { // a long-standing sweetheart pops the question (gatherings.ts gates how often)
      if (!proposalReady(sim, v, t)) return convo(sim, [[v, smalltalk(sim, v), '💞']], 3); // the other one already asked this very moment
      recordProposal(sim, v, t); soc(v, 25); soc(t, 25);
      const yes = op(t, v) >= 60 && !(op(t, v) < 78 && R.chance(.1 + t.traits.ambition * .08)); // rarely, cold feet
      const lines: Line[] = [[v, say(sim, v, 'propose', { t: t.first }), '💍']];
      if (yes) {
        v.emotions.love = t.emotions.love = 1; v.emotions.joy = t.emotions.joy = 1; sim.icon(v, '💍'); sim.icon(t, '💞');
        sim.world.fx.sparkle(t.x, 1.8, t.z, [1, .75, .5], 30);
        bump(sim, v, t, 10); bump(sim, t, v, 12);
        lines.push([t, say(sim, t, 'proposeYes'), '🥹'], [v, 'You and me. Always.', '💞']);
        sim.log(`${v.first} dropped to one knee and asked ${t.first} to marry ${pr(v).obj} — and ${t.first} said YES! Thistlebrook has a wedding coming.`, 8, [v.id, t.id], 'romance', '💍');
        const f = sim.fact('news', `${v.first} proposed to ${t.first} — a wedding is coming`, v.id, v.id, .5, 8, t.id); (f as any).romance = true;
        sim.witness(`${v.first} proposed to ${t.first}`, 8, [v.id, t.id], { [v.id]: 1, [t.id]: 1, '*': .3 }, v.x, v.z, f, 16);
        v.mem.add(sim.clock, `I asked ${t.first} to marry me. ${pr(t).Sub} said yes!`, 9, [t.id], 1, 'feeling');
        t.mem.add(sim.clock, `${v.first} proposed. I said yes.`, 9, [v.id], 1, 'feeling');
        sim.achieve(null, `proposal-${[v.id, t.id].sort().join('-')}`, 'The Proposal', `${v.first} asked, ${t.first} said yes`);
        planWedding(sim, v, t);
      } else {
        lines.push([t, say(sim, t, 'proposeNo'), '😟'], [v, say(sim, v, 'confessHeartbroken', { t: t.first }), '💔']);
        v.emotions.sadness = 1; t.emotions.sadness = .5; bump(sim, v, t, -6); bump(sim, t, v, -3); sim.icon(v, '💔');
        sim.log(`${v.first} went down on one knee for ${t.first}… who wasn't ready. They walked home in silence, a careful arm's length apart.`, 8, [v.id, t.id], 'romance', '💔');
        const f = sim.fact('deed', `${v.first} proposed to ${t.first} and was told "not yet"`, v.id, v.id, -.2, 7, t.id); (f as any).romance = true; t.mem.learn(f);
        v.mem.add(sim.clock, `I asked ${t.first} to marry me. ${pr(t).Sub} said not yet.`, 9, [t.id], -.6, 'feeling');
        a.after = () => { v.queue.unshift({ type: 'enter', place: v.def.home, dur: 50, t: 0, label: 'staring at the ceiling' }); };
      }
      return convo(sim, lines, 5);
    }
    case 'deliver': { // Jen hands over a letter; she may already know what's in it
      const L = a.letter; sim.letters = sim.letters.filter(x => x !== L); const from = sim.byId.get(L.from);
      soc(v, 10); soc(t, 10); bump(sim, t, v, 2);
      if (!from) { t.mem.add(sim.clock, `Got a letter from ${R.pick(['a cousin in the city', 'the county clerk', 'an old friend'])}`, 2, [], .2, 'heard'); return convo(sim, [[v, R.pick([`Post for ${t.first}!`, 'A letter for you!']), '✉️'], [t, 'Thanks, Jen.', '🙂']]); }
      if (L.love) { t.emotions.love = Math.min(1, t.emotions.love + .6); bump(sim, t, from, 10); t.mem.add(sim.clock, `${from.first} sent me a love letter`, 8, [from.id], .6, 'heard'); if (op(t, from) > 50 && !t.crush && !t.partner && !t.family.includes(from.id)) t.crush = from.id; sim.icon(t, '💌'); }
      else t.mem.add(sim.clock, `Got a letter from ${from.first}`, 3, [from.id], .3, 'heard');
      if (L.love) sim.log(`${v.first} delivered a pink envelope to ${t.first}. It smelled of lavender and was signed "${from.first}".`, 6, [v.id, t.id, from.id], 'romance', '💌');
      return convo(sim, [[v, R.pick([`Post for ${t.first}!`, 'Special delivery!', 'A letter for you!']), '✉️'], [t, L.love ? 'Oh! Who could this be from...' : 'Thanks, Jen.', L.love ? '😳' : '🙂']]);
    }
    case 'accuse': { // a victim confronts whoever they *suspect* took their keepsake (they may be wrong)
      const k = sim.keepsakes.get(v.id)!; const guilty = k.holder === t.id; ((v as any)._accused ??= {})[t.id] = sim.clock; const thing = k.name.replace(/^(his|her) /, 'my '), theirs = k.name;
      v.emotions.anger = Math.min(1, v.emotions.anger + .4); sim.icon(v, '💢');
      if (guilty && t.traits.kindness + R.range(0, .5) > .75) { k.holder = v.id; bump(sim, v, t, -10); t.emotions.sadness += .4; sim.log(`${v.first} confronted ${t.first} about the missing ${k.name.replace(/^(his|her) /, '')}. ${t.first} went red and handed it back.`, 7, [v.id, t.id], 'theft', k.icon); const f = sim.fact('deed', `${t.first} had ${v.first}'s ${k.name.replace(/^(his|her) /, '')} all along`, t.id, t.id, -.7, 7, v.id); (f as any).label = 'the theft'; sim.witness(`${t.first} returned what they took from ${v.first}`, 6, [v.id, t.id], { [v.id]: -.6, '*': -.3 }, v.x, v.z, f, 10); return convo(sim, [[v, say(sim, v, 'accuseDemand', { thing, t: t.first }), '😠'], [t, '...', '😳'], [t, say(sim, t, 'accuseGuiltyConfess'), '😞']]); }
      if (guilty) { bump(sim, v, t, -12); bump(sim, t, v, -6); sim.log(`${v.first} accused ${t.first} of taking ${theirs}. ${t.first} denied everything with a perfectly straight face.`, 6, [v.id, t.id], 'theft', '🤥'); return convo(sim, [[v, say(sim, v, 'accuseDemand', { thing, t: t.first }), '😠'], [t, say(sim, t, 'accuseGuiltyDeny', { t: t.first }), '😇'], [v, say(sim, v, 'accuseGuiltyReply'), '🤨']]); }
      bump(sim, t, v, -22); bump(sim, v, t, -4); t.emotions.anger = Math.min(1, t.emotions.anger + .6); sim.icon(t, '😤');
      t.mem.add(sim.clock, `${v.first} accused me of stealing. I did nothing!`, 8, [v.id], -.8, 'feeling');
      const f = sim.fact('deed', `${v.first} falsely accused ${t.first} of theft`, v.id, v.id, -.4, 6, t.id); (f as any).label = 'the false accusation'; t.mem.learn(f); sim.witness(`${v.first} accused ${t.first} of stealing`, 5, [v.id, t.id], { [t.id]: -.8, '*': -.1 }, v.x, v.z, f, 10);
      sim.log(`${v.first} accused ${t.first} of taking ${theirs}, but ${t.first} had nothing to do with it. ${t.first} is furious.`, 7, [v.id, t.id], 'theft', '😤');
      return convo(sim, [[v, say(sim, v, 'accuseDemand', { thing, t: t.first }), '😠'], [t, say(sim, t, 'accuseInnocent'), '😡'], [v, say(sim, v, 'accuseInnocentReply'), '😟']]);
    }
    case 'gossip': {
      const f = a.fact as Fact; const lines: Line[] = [[v, say(sim, v, 'gossipOpener', { t: t.first }), '🤫']];
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
      const pk = sim.pairKey(v.id, t.id); ((v as any)._apol ??= {})[t.id] = sim.clock;
      const gift = v.traits.kindness > .5 || R.chance(.4); const back = sim.keepsakes.get(t.id); const returning = back && back.holder === v.id; if (returning) back!.holder = t.id;
      const freshSpat = sim.clock - Math.max(sim.arguedAt[pk] ?? -1e9, sim.foughtAt[pk] ?? -1e9) < 4320; /* an apology soon after a row usually lands */
      const accept = t.traits.kindness * 60 + op(t, v) + (gift ? 25 : 0) + (freshSpat ? 15 : 0) + R.range(0, 30) > 25;
      if (!accept) { bump(sim, t, v, 3); sim.log(`${v.first} tried to apologise to ${t.first}, who wasn't ready to forgive.`, 5, [v.id, t.id], 'reconcile', '💔'); t.emotions.anger += .2; return convo(sim, [[v, say(sim, v, 'apology', { t: t.first }), '🙏'], [t, say(sim, t, 'reconcileRefuse'), '😤']]); }
      t.opinion[v.id] = Math.max(op(t, v) + 35, 10); v.opinion[t.id] = Math.max(op(v, t) + 30, 15); t.emotions.anger = 0; v.emotions.anger = 0; t.emotions.joy += .3; sim.icon(v, '🕊️'); sim.icon(t, '🕊️'); v.stats.makeups++;
      addGrievance(sim, v, t.id, -100); addGrievance(sim, t, v.id, -100); sim.coolOff[pk] = 0; /* slate wiped both ways */
      const wronged = [...v.mem.known.values()].some(f => f.actor === t.id && f.valence < 0 && (f.target === v.id || f.about === v.id));
      const guilty = [...t.mem.known.values()].some(f => f.actor === v.id && f.valence < 0);
      if (returning) sim.log(`${v.first} came clean to ${t.first} and handed back ${back!.name.replace(/^(his|her) /, '')}. ${t.first} forgave ${pr(v).obj}.`, 7, [v.id, t.id], 'reconcile', back!.icon);
      else sim.log(wronged ? `${v.first} offered ${t.first} an olive branch${gift ? ' and a gift' : ''}. They made up.` : guilty ? `${v.first} apologised to ${t.first}${gift ? ' with a peace offering' : ''}. They made up.` : `${v.first} cleared the air with ${t.first}${gift ? ' over a shared snack' : ''}. They're on good terms again.`, 6, [v.id, t.id], 'reconcile', '🕊️'); sim.achieve(null, `made-up-${v.id}-${t.id}`, 'Water Under the Bridge', `${v.first} and ${t.first} reconciled`);
      const f = sim.fact('deed', `${v.first} and ${t.first} buried the hatchet`, v.id, v.id, .5, 5, t.id); sim.witness(`${v.first} made peace with ${t.first}`, 5, [v.id, t.id], { [v.id]: .6, [t.id]: .6, '*': .2 }, v.x, v.z, f, 10);
      return convo(sim, [[v, say(sim, v, 'apology', { t: t.first }), '🙏'], [t, say(sim, t, 'reconcileAccept'), '🙂'], [v, 'Friends?', '🤝'], [t, 'Friends.', '😊']]);
    }
    case 'argue': {
      const pk = sim.pairKey(v.id, t.id);
      if (sim.calmAt(v.x, v.z) || sim.calmAt(t.x, t.z) || sim.clock < (sim.coolOff[pk] ?? 0)) { /* never a scene at a wedding; cooling-off holds */
        sim.icon(v, '😒'); if (R.chance(.35)) sim.log(`${v.first} shot ${t.first} a look that said "later". Not here.`, 2, [v.id, t.id], 'talk', '😒');
        return convo(sim, [[v, '...', '😒']], 3);
      }
      if (a.factId) ((v as any)._confronted ??= new Set()).add(a.factId);
      if (a.snipe) (v as any)._sniped = sim.clock;
      if (a.jealous) { sim.icon(v, '😤'); sim.log(`${v.first} is green with jealousy and let ${t.first} know it.`, 6, [v.id, t.id], 'romance', '😤'); }
      const prior = sim.arguedAt[pk] ?? -1e9;
      bump(sim, v, t, -6); bump(sim, t, v, -8); v.emotions.anger = Math.min(1, v.emotions.anger + .4); t.emotions.anger = Math.min(1, t.emotions.anger + .5); sim.icon(v, '💢'); sim.icon(t, '💢');
      const grudge = a.why ?? 'old grudges';
      const lines: Line[] = [[v, say(sim, v, 'argueOpener', { t: t.first }), '😠'], [t, say(sim, t, 'argueRetort'), '🙄'], [v, say(sim, v, 'fightTaunt'), '💢'], [t, say(sim, t, 'fightTaunt'), '😡']];
      sim.arguedAt[pk] = sim.clock; sim.argueLull = sim.clock + 150;
      // a kind bystander with no dog in the race may step in and talk them down before it gets ugly
      const peace = sim.villagers.filter(w => w !== v && w !== t && !w.inside && w.doing !== 'sleeping' && Math.hypot(w.x - v.x, w.z - v.z) < 9 && (w.traits.kindness > .55 || (w.traits.sociability > .6 && w.traits.kindness > .4)) && op(w, v) > -5 && op(w, t) > -5).sort((x, y) => y.traits.kindness - x.traits.kindness)[0];
      if (peace && R.chance(.4 + peace.traits.kindness * .35)) {
        lines.length = 2; lines.push([peace, say(sim, peace, 'mediate'), '🕊️'], [v, say(sim, v, 'mediateStandDown', { m: peace.first }), '😤'], [t, say(sim, t, 'mediateStandDown', { m: peace.first }), '😮‍💨']);
        v.emotions.anger = Math.max(0, v.emotions.anger - .35); t.emotions.anger = Math.max(0, t.emotions.anger - .35);
        addGrievance(sim, v, t.id, -12); addGrievance(sim, t, v.id, -12);
        bump(sim, v, peace, 5); bump(sim, t, peace, 5); peace.stats.makeups++; sim.icon(peace, '🕊️');
        sim.coolOff[pk] = sim.clock + 240 + R.range(0, 60);
        sim.log(`Voices rose between ${v.first} and ${t.first} over ${grudge}, but ${peace.first} stepped in and talked them both down.`, 5, [peace.id, v.id, t.id], 'mediate', '🕊️');
        const f = sim.fact('deed', `${peace.first} kept the peace between ${v.first} and ${t.first}`, peace.id, peace.id, .5, 5); sim.witness(`${peace.first} defused a row between ${v.first} and ${t.first}`, 5, [peace.id, v.id, t.id], { [peace.id]: .6, '*': .2 }, v.x, v.z, f, 12);
        return convo(sim, lines, 4);
      }
      // fists only after the full ladder: a fresh prior argument, a deep repeated grudge, hot tempers, no lull, no shame
      const shamed = (x: Villager) => sim.clock < ((x as any)._shame ?? 0);
      const escalate = prior > 0 && sim.clock - prior < 2880 && grievance(sim, v, t.id) > FIGHT_GRIEVANCE && v.traits.temper > .6 && v.traits.temper + t.traits.temper > 1.15 && v.traits.bravery > .35 && !shamed(v) && !shamed(t) && sim.canFight(v, t) && R.chance(.5);
      if (escalate) { a.after = () => { sim.startFight(v, t, `An argument between ${v.first} and ${t.first} over ${grudge} boiled over`); }; }
      else { sim.coolOff[pk] = sim.clock + 300 + R.range(0, 150); sim.log(`${v.first} confronted ${t.first} over ${grudge}. Voices were raised.`, 5, [v.id, t.id], 'argue', '💢'); }
      const f = sim.fact('deed', `${v.first} and ${t.first} had a shouting match`, v.id, t.id, -.3, 4, t.id); sim.witness(`${v.first} argued with ${t.first}`, 4, [v.id, t.id], { [v.id]: -.5, [t.id]: -.6, '*': -.1 }, v.x, v.z, f, 12);
      return convo(sim, lines, 4);
    }
    case 'contest': { // friendly rivalry: the needle between two villagers settled with a game, not a row
      (v as any)._lastContest = sim.clock; (t as any)._lastContest = sim.clock; soc(v, 25); soc(t, 25);
      const picks: [string, string, (x: Villager) => number][] = [
        ['who could skip a stone the furthest', '🪨', x => x.traits.bravery + (1 - x.traits.temper) * .3],
        ['a race to the well and back', '🏃', x => x.traits.diligence + x.needs.energy / 150],
        ['a pie-off, judged by whoever wandered past', '🥧', x => x.traits.diligence * .6 + x.traits.kindness * .4],
        ['an arm-wrestle on the nearest barrel', '💪', x => x.traits.bravery + x.def.height * .4],
      ];
      const [what, icon, sc] = R.pick(picks); const [w, l] = sc(v) + R.range(0, .5) >= sc(t) + R.range(0, .5) ? [v, t] : [t, v];
      bump(sim, v, t, 6); bump(sim, t, v, 6); addGrievance(sim, v, t.id, -18); addGrievance(sim, t, v.id, -18);
      w.emotions.joy = Math.min(1, w.emotions.joy + .5); l.emotions.joy = Math.min(1, l.emotions.joy + .25); sim.icon(w, '🏅');
      const sore = l.traits.temper > .7 && R.chance(.4); if (sore) bump(sim, l, w, -3);
      sim.log(`${v.first} challenged ${t.first} to ${what} — ${w.first} won${sore ? `, and ${l.first} demanded a rematch on the spot` : ', and the pair of them were grinning by the end'}.`, 5, [v.id, t.id], 'contest', icon);
      const f = sim.fact('deed', `${w.first} beat ${l.first} at ${what}`, w.id, w.id, .3, 5, l.id); sim.witness(`${w.first} and ${l.first} settled their needle with ${what}`, 5, [v.id, t.id], { [w.id]: .4, [l.id]: .2, '*': .2 }, v.x, v.z, f, 12);
      return convo(sim, [[v, say(sim, v, 'contestChallenge', { t: t.first }), icon], [t, say(sim, t, 'contestAccept'), '😄'], [w, say(sim, w, 'contestWin'), '🏅'], [l, say(sim, l, sore ? 'contestSore' : 'contestLose'), sore ? '😤' : '😅']]);
    }
    case 'prank': { // harmless mischief: swapped hats and frogs in buckets, never black eyes
      if (sim.calmAt(t.x, t.z)) return convo(sim, [[v, '...', '😏']], 3); /* no pranks at weddings or meetings */
      (v as any)._lastPrank = sim.clock; soc(v, 15); soc(t, 10);
      const pranks: [string, string][] = [
        [`swapped ${t.first}'s hat for a flowerpot`, '🪴'], [`hid a very smug frog in ${t.first}'s bucket`, '🐸'],
        [`chalked a grinning sun on ${t.first}'s door`, '🖍️'], [`tied ${t.first}'s laundry line into neat little bows`, '🎀'],
        [`balanced a row of acorns along ${t.first}'s windowsill`, '🌰'],
      ];
      const [did, icon] = R.pick(pranks);
      const laughs = t.traits.temper < .55 || op(t, v) > 25 || R.chance(.25);
      if (laughs) { bump(sim, t, v, 4); bump(sim, v, t, 3); t.emotions.joy = Math.min(1, t.emotions.joy + .4); v.emotions.joy = Math.min(1, v.emotions.joy + .4); sim.icon(t, '😂'); }
      else { bump(sim, t, v, -4); t.emotions.anger = Math.min(1, t.emotions.anger + .2); sim.icon(t, '😒'); }
      sim.log(`${v.first} ${did}. ${t.first} ${laughs ? `laughed till ${pr(t).sub} had to sit down` : 'was not amused'}.`, 4, [v.id, t.id], 'prank', icon);
      const f = sim.fact('deed', `${v.first} ${did}`, v.id, v.id, laughs ? .3 : -.2, 4, t.id); sim.witness(`${v.first} pranked ${t.first}`, 4, [v.id, t.id], { [v.id]: laughs ? .3 : -.2, [t.id]: laughs ? .2 : -.3 }, v.x, v.z, f, 10);
      return convo(sim, [[v, say(sim, v, 'prankSpring', { t: t.first }), icon], [t, say(sim, t, laughs ? 'prankLaugh' : 'prankGrumble'), laughs ? '😂' : '😒']]);
    }
    case 'rumour': {
      const about = sim.byId.get(a.about)!; const lies = [`${about.first} talks to the scarecrow when nobody's looking`, `${about.first} re-gifts every present`, `${about.first} cried at the hen's birthday`, `${about.first} cheated at the harvest-pie contest`, `${about.first} sleeps in ${pr(about).pos} boots`, `${about.first} has been reading the mayor's mail`, `${about.first} blamed the goat for ${pr(about).pos} own mess`, `${about.first} cheats at cards`, `${about.first} badmouths everyone behind their backs`, `${about.first} kicked a chicken`, `${about.first} reads other people's letters`, `${about.first} laughed at ${t.first} behind their back`, `${about.first} faked being sick to skip the barn raising`, `${about.first} snores loud enough to wake the hens`, `${about.first} has a secret sweetheart in the next village`];
      (v as any)._lastRumour = sim.clock; v.stats.rumours++; const used = ((sim as any)._liesUsed ??= new Set<string>()); const fresh = lies.filter(l => !used.has(l)); const lie = R.pick(fresh.length ? fresh : lies) as string; used.add(lie); const f = sim.fact('deed', lie, about.id, about.id, -.6, 6); (f as any).fake = true; f.origin = v.id; v.mem.learn(f); ((v as any)._rumoured ??= {})[about.id + t.id] = 1;
      const lines: Line[] = [[v, say(sim, v, 'rumourOpener', { t: t.first }), '🤫']]; v.mem.add(sim.clock, `I told ${t.first} that ${lie}. Not a word of it is true.`, 6, [about.id, t.id], -.1, 'obs');
      const believed = t.traits.honesty < .8 || op(t, v) > 20 || R.chance(.5);
      if (believed) { sim.learnFact(t, f, v); bump(sim, t, about, -Math.round(10 * trust(t, v))); t.mem.add(sim.clock, `${v.first} told me ${f.text}`, 5, [about.id, v.id], -.5, 'heard', f.id); lines.push([v, `${f.text}.`, '🐍'], [t, say(sim, t, 'rumourBelieved'), '😮']); sim.log(`${v.first} whispered to ${t.first} that ${f.text}. (It isn't true.)`, 5, [v.id, t.id, about.id], 'gossip', '🐍'); }
      else { bump(sim, t, v, -8); lines.push([v, `${f.text}.`, '🐍'], [t, say(sim, t, 'rumourDisbelieved'), '🤨']); sim.log(`${v.first} tried to spread a rumour about ${about.first}, but ${t.first} wasn't buying it.`, 5, [v.id, t.id, about.id], 'gossip', '🤨'); }
      sim.achieve(v, 'rumour', 'Silver Tongue', `${v.first} started a rumour`);
      return convo(sim, lines);
    }
    case 'steal': { // pinching a cherished keepsake: no value, all drama
      const k = sim.keepsakes.get(a.loot); if (!k || k.holder !== t.id) return 2;
      k.holder = v.id; k.takenAt = sim.clock; v.stats.stolen++; v.wanted = sim.clock + 900; a._noFace = true;
      const seen = R.chance(.3 + t.traits.bravery * .2 - v.traits.bravery * .1);
      const witnesses = sim.villagers.filter(w => w !== v && w !== t && !w.inside && Math.hypot(w.x - v.x, w.z - v.z) < 11 && w.doing !== 'sleeping');
      const owner = sim.byId.get(k.owner)!, thing = owner === t ? possess(k.name, t.first) : k.name.startsWith('his ') || k.name.startsWith('her ') ? possess(k.name, owner.first) + ` (which ${t.first} had pinched)` : `${t.first}'s ${k.name.replace(/^(a|an|the) /, '')}`;
      const f = sim.fact('deed', `${v.first} pinched ${thing}`, v.id, v.id, -.9, 8, t.id); (f as any).label = `taking ${thing}`;
      sim.icon(v, '🫳');
      if (seen || witnesses.length) {
        const who = seen ? t : witnesses[0];
        t.mem.add(sim.clock, `${v.first} snatched ${k.name.replace(/^(his|her) /, 'my ')}!`, 9, [v.id], -1, 'obs', f.id); t.mem.learn(f); for (const w of witnesses) { w.mem.add(sim.clock, `Saw ${v.first} pinch ${thing}`, 8, [v.id, t.id], -.8, 'obs', f.id); w.mem.learn(f); bump(sim, w, v, -15); }
        bump(sim, t, v, -35); t.emotions.anger = 1; t.emotions.surprise = 1;
        sim.say(who, seen ? say(sim, who, 'theftShoutSelf') : say(sim, who, 'theftShoutOther', { t: t.first, v: v.first, what: k.name.replace(/^(his|her) /, '') }), '😱', 3); sim.say(v, say(sim, v, 'theftOops'), '😬', 2);
        sim.log(`${v.first} snatched ${thing}, but ${seen ? t.first + ' noticed' : witnesses[0].first + ' saw it'}! A chase is on!`, 8, [v.id, t.id, ...witnesses.map(w => w.id)], 'theft', '🏃');
        a.after = () => { v.act = null; v.queue = [{ type: 'flee', place: v.def.home, t: 0, label: 'fleeing!', run: true, loot: k.id } as any]; v.queue.push({ type: 'enter', place: v.def.home, dur: 30, t: 0, label: 'hiding at home' }); };
        if (t.traits.bravery > .3 && !t.inside) { t.busyUntil = 0; sim.leaveSeat(t); t.act = { type: 'chase', target: v.id, t: -1.2, label: `chasing ${v.first}!`, loot: k.id }; t.queue = []; }
        sim.achieve(null, 'first-theft', 'Sticky Fingers', `${v.first} was caught red-handed`);
        return .4;
      }
      v.mem.add(sim.clock, `I pinched ${thing} and nobody saw`, 6, [t.id], .2); v.mem.learn(f);
      sim.log(`${v.first} quietly pocketed ${thing}. Nobody noticed... yet.`, 6, [v.id, t.id], 'theft', '🤫'); sim.say(v, '...', '😏', 2);
      (t as any)._missFrom = sim.clock + R.range(20, 90); // they'll notice it's gone a little later
      sim.achieve(v, 'sneaky', 'Light Fingers', `${v.first} took something without being seen`);
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
    sim.log(`${v.first} warned ${t.first} that ${liar.first} has been spreading rumours about ${pr(t).obj}.`, 6, [v.id, t.id, liar.id], 'gossip', '😡');
    const f2 = sim.fact('deed', `${liar.first} spread lies about ${t.first}`, liar.id, liar.id, -.6, 6, t.id); (f2 as any).label = 'the lies'; t.mem.learn(f2); v.mem.learn(f2);
    return 6;
  }
  if (about && about !== t) bump(sim, t, about, Math.round(f.valence * f.imp * 2.2 * tr));
  if (about && f.target && f.target !== t.id && f.valence < 0) { const victim = sim.byId.get(f.target); if (victim) bump(sim, t, victim, 2); }
  t.mem.add(sim.clock, `${v.first} told me: ${f.text}`, Math.max(2, f.imp - 1), [f.about, v.id], f.valence * tr, 'heard', f.id);
  lines.push([v, `Did you hear? ${f.text}!`, f.valence < 0 ? '🤫' : '✨'], [t, f.valence < 0 ? say(sim, t, 'gossipReactNeg') : say(sim, t, 'gossipReactPos'), f.valence < 0 ? '😱' : '😊']);
  v.mem.add(sim.clock, `I told ${t.first}: ${f.text}`, 2, [f.about, t.id], 0, 'obs');
  (v as any)._lastGossip = sim.clock; const hopN = (f as any).hops as number;
  sim.log(`${v.first} told ${t.first} that ${lowerFirst(f.text)}.${(f as any).fake ? " (It isn't true.)" : ''}`, hopN <= 2 ? (f.valence < 0 ? 4 : 3) : 1, [v.id, t.id, f.about], 'gossip', '🗣️');
  const reach = sim.villagers.filter(x => x.mem.known.has(f.id)).length;
  if (reach >= 5 && !(f as any).viral) { (f as any).viral = true;
    // one grapevine line per stretch of the day: a second story going viral within two hours folds into the same entry
    const V = ((sim as any)._viral ??= { ev: null as any, facts: [] as string[] }), last = V.ev;
    if (last && sim.clock - last.t < 120 && V.facts.length < 4 && sim.events.includes(last)) {
      V.facts.push(lowerFirst(f.text) + ((f as any).fake ? " (It isn't true.)" : '')); const n = V.facts.length;
      last.text = `The grapevine is buzzing: ${n} stories are doing the rounds — ${V.facts.slice(0, -1).join('; ')}; and now, ${V.facts[n - 1]}.`;
      last.actors = [...new Set([...last.actors, f.about])]; last.imp = Math.max(last.imp, 6); sim.emit('eventUpdate', last);
    } else {
      V.facts = [lowerFirst(f.text) + ((f as any).fake ? " (It isn't true.)" : '')];
      V.ev = sim.log(sim.rng.pick([`Word travels fast: ${reach} villagers now know that ${lowerFirst(f.text)}.`, `The whole village is whispering: ${lowerFirst(f.text)}.`, `It's all over Thistlebrook by now: ${lowerFirst(f.text)}.`]) + ((f as any).fake ? " (It isn't true.)" : '') as string, 6, [f.about], 'gossip', '📣');
    } sim.achieve(null, `viral-${f.id}`, 'The Grapevine', `A story reached ${reach} villagers`); }
  return 6;
}
export function tellInvite(sim: Sim, v: Villager, t: Villager, f: Fact, lines: Line[]) {
  if (!f.event || !sim.learnFact(t, f, v)) return 0; const host = sim.byId.get(f.event.host)!;
  const like = op(t, host); const keen = like > 20;
  t.mem.add(sim.clock, `${host.first === v.first ? v.first : v.first + ' says ' + host.first} is hosting ${f.event.title} tonight`, 5, [host.id], .3, 'heard', f.id);
  lines.push(host === v ? [v, `Come to my ${f.event.title.replace(/^(a|an|the) /, '')} tonight at ${sim.place(f.event.place).name}!`, '💌'] : [v, `${host.first}'s throwing ${f.event.title} tonight!`, '💌'], [t, keen ? say(sim, t, 'inviteAccept') : like > -25 ? say(sim, t, 'inviteMaybe') : say(sim, t, 'inviteRefuse'), keen ? '🥳' : '🤔']);
  sim.log(host === v ? `${v.first} invited ${t.first} to ${f.event.title}.` : `${v.first} passed ${host.first}'s invitation on to ${t.first}.`, host === v ? 3 : 1, [v.id, t.id, host.id], 'invite', '💌');
  if (host === v) bump(sim, t, v, 3); return 5;
}
function lowerFirst(s: string) { return s; }

// Edgar-style eavesdropping: anyone close by and idle can pick up a piece of the gossip
export function maybeOverhear(sim: Sim, a: Villager, b: Villager) {
  for (const w of sim.villagers) { if (w === a || w === b || w.inside || Math.hypot(w.x - a.x, w.z - a.z) > 6) continue;
    const g = pickGossip(a, w, sim); if (!g) continue; if (sim.rng.chance(w.job === 'tavernkeeper' ? .8 : .25)) { if (sim.learnFact(w, g)) { w.mem.add(sim.clock, `Overheard: ${g.text}`, 4, [g.about], g.valence * .7, 'heard', g.id); const ab = sim.byId.get(g.about); if (ab && ab !== w) bump(sim, w, ab, Math.round(g.valence * g.imp)); sim.icon(w, '👂'); } } }
}
export function possess(name: string, first: string) { return name.replace(/^(his|her|their) /, `${first}'s `).replace(/^(?!.*'s )(.*)$/, `${first}'s $1`).replace(/'s (a|an|the) /, '\'s '); }
