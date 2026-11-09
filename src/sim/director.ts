// The storyteller: picks what the camera should look at, writes the dawn newspaper, ranks the village.
import type { Sim } from './sim';
import type { SimEvent, Villager } from './types';
import { fmtTime, RNG } from '../core/util';
import { arcs } from './arcs';
import type { Arc } from './arcs';
// presentation randomness lives apart from sim.rng, so watching (camera, paper) never changes what villagers do
const ED = new RNG(4242);

export interface Paper { day: number; headline: string; lead?: string; stories: { icon: string; text: string }[]; weather: string; quote: { who: string; text: string } | null; leaders: { popular: string; power: string; mischief: string }; couples: string; whispers?: string; }
export class Director {
  focus: { id: string | null; until: number; reason: string } = { id: null, until: 0, reason: '' }; papers: Paper[] = []; recentImportant: SimEvent[] = [];
  constructor(public sim: Sim) {
    sim.on('event', (e: SimEvent) => { if (e.imp >= 5) this.recentImportant.push(e); if (this.recentImportant.length > 30) this.recentImportant.shift(); });
    sim.on('dawn', (day: number) => this.papers.push(this.paper(day)));
  }
  ranked(kind: 'popularity' | 'power' | 'mischief') { const s = this.sim; return [...s.villagers].map(v => ({ v, score: kind === 'mischief' ? s.mischief(v) : kind === 'power' ? s.power(v) : Math.round(s.popularity(v)) })).sort((a, b) => b.score - a.score); }
  paper(day: number): Paper {
    const s = this.sim, evs = (s.dayStats[day] ?? []).filter(e => e.kind !== 'headline').sort((a, b) => b.imp - a.imp);
    const top = evs[0]; const headline = top ? headlineOf(top, s) : 'A Quiet Day in Thistlebrook';
    const at = arcs(s); const headArc = top ? at.arcForEvent(top.id)?.arc : null;
    // lead paragraph: trace the headline back through its arc's earlier beats ("It started when…")
    const lead = headArc ? leadOf(headArc, top!, new Set(s.villagers.map(v => v.first))) : undefined;
    // secondary stories: distinct arcs (not more of the headline), each summarised by its latest beat
    const stories: { icon: string; text: string }[] = []; const usedArc = new Set<string>(); if (headArc) usedArc.add(headArc.id);
    for (const arc of at.top(6, 2)) { if (usedArc.has(arc.id)) continue; const b = arc.beats[arc.beats.length - 1]; stories.push({ icon: b.icon, text: b.text }); usedArc.add(arc.id); if (stories.length >= 3) break; }
    // top up with any remaining strong standalone events not already covered by an arc
    for (const e of evs.slice(1)) { if (stories.length >= 4) break; const a = at.arcForEvent(e.id)?.arc; if (a && usedArc.has(a.id)) continue; if (a) usedArc.add(a.id); stories.push({ icon: e.icon, text: e.text }); }
    const quoter = [...s.villagers].sort((a, b) => b.mem.impSinceReflect - a.mem.impSinceReflect)[0];
    const r = (k: any) => this.ranked(k)[0].v.first;
    return { day, headline, lead, stories, weather: s.rain > .4 ? 'Showers expected' : ED.pick(['Sunny spells', 'Clear skies', 'A light breeze', 'Mild and bright']), quote: quoter ? { who: quoter.name, text: quoter.thought } : null, leaders: { popular: r('popularity'), power: r('power'), mischief: r('mischief') }, couples: s.couples.map(([a, b]) => `${s.byId.get(a)!.first} & ${s.byId.get(b)!.first}`).join(', '), whispers: this.whispers() };
  }
  // A cheeky "Lonely hearts" / "Village whispers" sidebar line about the current romantic weather.
  whispers(): string {
    const s = this.sim;
    const cands: string[] = [];
    for (const v of s.villagers) {
      if (v.crush && !v.partner) { const c = s.byId.get(v.crush); if (c) cands.push(`A little bird says ${v.first} is sweet on ${c.first}…`); }
      if (v.heartbreak > s.clock && !v.partner) cands.push(`${v.first} has been seen sighing by the well of late.`);
    }
    for (const [a, b] of s.couples) { const af = s.byId.get(a), bf = s.byId.get(b); if (af && bf) cands.push(`${af.first} and ${bf.first} were spotted strolling, hand in hand.`); }
    if (!cands.length) cands.push('All hearts quiet in Thistlebrook… for now.', 'Who will be first to lose their heart this season?', 'The well wishes are running low on romance.');
    return ED.pick(cands);
  }
  // Pick the most interesting villager to watch right now.
  pick(now: number, current: string | null): { id: string; reason: string } | null {
    const s = this.sim;
    const hot = this.recentImportant.filter(e => now - e.t < 40 && e.actors.length).sort((a, b) => b.imp - a.imp)[0];
    if (hot && (this.focus.reason !== hot.text)) { const id = hot.actors.find(a => !s.byId.get(a)?.inside) ?? hot.actors[0]; this.focus = { id, until: now + 50, reason: hot.text }; return { id, reason: hot.text }; }
    if (now < this.focus.until && this.focus.id) return { id: this.focus.id, reason: this.focus.reason };
    const score = (v: Villager) => (v.inside ? -5 : 0) + (v.act?.type === 'social' || v.act?.type === 'steal' ? 3 : 0) + (v.act?.type === 'chase' || v.act?.type === 'fight' ? 6 : 0) + (v.act?.type === 'work' ? 1.5 : 0) + (v.act?.type === 'attend' ? 2 : 0) + (v.id === current ? -1.2 : 0) + ED.range(0, 1.5);
    const sc = new Map(s.villagers.map(v => [v, score(v)])); const best = [...s.villagers].sort((a, b) => sc.get(b)! - sc.get(a)!)[0]; this.focus = { id: best.id, until: now + 35, reason: best.doing }; return { id: best.id, reason: best.doing };
  }
}
// Weave the headline's back-story from the arc's earlier beats: "It started when… Before long…"
function leadOf(arc: Arc, top: SimEvent, names: Set<string>): string | undefined {
  const prior = arc.beats.filter(b => b.eventId !== top.id && b.t <= top.t);
  if (!prior.length) return undefined;
  const strip = (s: string) => s.replace(/\s*\(It isn't true\.\)\s*/i, ' ').replace(/\.$/, '').trim();
  // lowercase a clause's first word mid-sentence, but never a villager's name
  const lc = (s: string) => names.has(s.split(/[\s,:]/)[0]) ? s : s.charAt(0).toLowerCase() + s.slice(1);
  const mid = prior.length > 2 ? prior[Math.floor(prior.length / 2)] : null;
  let out = `${ED.pick(['It started when', 'It began when', 'The trouble started when'])} ${lc(strip(prior[0].text))}.`;
  if (mid) out += ` Before long, ${lc(strip(mid.text))}.`;
  out += ` ${ED.pick(['And so, today', 'Which brings us to today', 'By this morning'])}: ${strip(top.text)}.`;
  return out;
}
function headlineOf(e: SimEvent, s: Sim) {
  const k = e.kind, a = s.byId.get(e.actors[0])?.first ?? 'Someone', b = s.byId.get(e.actors[1])?.first ?? '';
  const pick = (arr: string[]) => ED.pick(arr);
  // punchy small-town tabloid headlines — several per event kind, chosen deterministically via sim.rng
  const H: Record<string, string[]> = {
    fight: [`FISTICUFFS! ${a} and ${b} Brawl in Broad Daylight`, `PUNCH-UP IN THE PLAZA: ${a} vs ${b}`, `${a} and ${b} Come to Blows!`, `BLACK EYES ALL ROUND as ${a} Clashes With ${b}`],
    theft: [`THIEF STRIKES THISTLEBROOK — ${a} Implicated`, `LIGHT FINGERS! ${a} Under Suspicion`, `SOMETHING’S GONE MISSING — All Eyes on ${a}`, `WHO’S THE SNEAK? ${a} in the Frame`],
    ally: [`NEW POWER BLOC: ${a} & ${b} Join Forces`, `${a} and ${b} Shake on It`, `ALLIANCE! ${a} and ${b} Throw In Together`, `BANNERS RAISED as ${a} & ${b} Unite`],
    party: [`${a}'s Gathering the Talk of the Town`, `ALL INVITED! ${a} Throws a Do`, `${a}’s Bash Sets Tongues Wagging`, `CIDER FLOWS at ${a}’s Gathering`],
    reconcile: [`PEACE AT LAST: ${a} and ${b} Make Up`, `HATCHET BURIED: ${a} and ${b} Friends Again`, `${a} and ${b} Kiss and Make Up`, `ALL FORGIVEN between ${a} and ${b}`],
    gossip: [`TONGUES WAG: Rumours Sweep the Village`, `DID YOU HEAR? The Grapevine Is Buzzing`, `WHISPERS AT THE WELL`, `SCANDAL! Or So They Say`],
    god: [`MYSTERY GIFT FALLS FROM THE SKY`, `A SIGN FROM ABOVE?`, `THE HEAVENS MEDDLE in Village Affairs`, `STRANGE DOINGS: Fortune Smiles From On High`],
    bond: [`${a} and ${b}: Village's Newest Item?`, `COSY! ${a} and ${b} Thick as Thieves`, `${a} and ${b} Inseparable of Late`],
    argue: [`TEMPERS FLARE Between ${a} and ${b}`, `WORDS EXCHANGED: ${a} and ${b} at Odds`, `${a} and ${b} Have Words in the Square`, `FEATHERS RUFFLED as ${a} Rounds on ${b}`],
    weather: [`STORM LASHES THISTLEBROOK`, `RAIN STOPS PLAY`, `MUD, MUD, GLORIOUS MUD`, `SKIES OPEN OVER THE VILLAGE`],
    traveller: ['A STRANGER’S TALES SET TONGUES WAGGING', 'MYSTERIOUS VISITOR ROLLS INTO TOWN', 'TALL TALES FROM A PASSING STRANGER'],
    festival: ['FESTIVAL FEVER GRIPS THE PLAZA', 'LET THE FESTIVITIES BEGIN!', 'THE WHOLE VILLAGE TURNS OUT TO CELEBRATE'],
    romance: /said yes/.test(e.text) ? [`LOVE IS IN THE AIR: ${a} & ${b} Are Sweethearts`, `${a} AND ${b} STEP OUT TOGETHER`, `WEDDING BELLS? ${a} and ${b} Are Smitten`]
      : /called it off/.test(e.text) ? [`HEARTBREAK: ${a} and ${b} Call It Quits`, `IT’S OVER: ${a} and ${b} Part Ways`, `${a} and ${b} GO THEIR SEPARATE WAYS`]
      : /let them down|turned down/.test(e.text) ? [`HEARTBREAK HOTEL: ${a}’s Confession Rebuffed`, `TURNED DOWN! ${a} Nurses a Bruised Heart`, `${a}’S BIG MOMENT Falls Flat`]
      : /jealous/.test(e.text) ? [`GREEN-EYED MONSTER: ${a} Seethes`, `${a} TURNS GREEN WITH ENVY`, `TROUBLE IN PARADISE for ${a}?`]
      : /letter/.test(e.text) ? [`SEALED WITH A KISS: A Love Letter for ${a}`, `${a} GETS POST OF THE PINK VARIETY`, `A SECRET ADMIRER Writes to ${a}`]
      : [`WHISPERS OF ROMANCE Around ${a}`, `IS ${a} IN LOVE? The Village Wonders`, `${a} HAS A SPRING IN THEIR STEP`],
  };
  const arr = H[k]; return arr ? pick(arr) : e.text.replace(/\.$/, '');
}
export { fmtTime };
