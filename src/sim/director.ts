// The storyteller: picks what the camera should look at, writes the dawn newspaper, ranks the village.
import type { Sim } from './sim';
import type { SimEvent, Villager } from './types';
import { fmtTime } from '../core/util';

export interface Paper { day: number; headline: string; stories: { icon: string; text: string }[]; weather: string; quote: { who: string; text: string } | null; leaders: { wealth: string; popular: string; power: string }; }
export class Director {
  focus: { id: string | null; until: number; reason: string } = { id: null, until: 0, reason: '' }; papers: Paper[] = []; recentImportant: SimEvent[] = [];
  constructor(public sim: Sim) {
    sim.on('event', (e: SimEvent) => { if (e.imp >= 5) this.recentImportant.push(e); if (this.recentImportant.length > 30) this.recentImportant.shift(); });
    sim.on('dawn', (day: number) => this.papers.push(this.paper(day)));
  }
  ranked(kind: 'wealth' | 'popularity' | 'power') { const s = this.sim; return [...s.villagers].map(v => ({ v, score: kind === 'wealth' ? Math.round(s.wealth(v)) : kind === 'power' ? s.power(v) : Math.round(s.popularity(v)) })).sort((a, b) => b.score - a.score); }
  paper(day: number): Paper {
    const s = this.sim, evs = (s.dayStats[day] ?? []).filter(e => e.kind !== 'headline').sort((a, b) => b.imp - a.imp);
    const top = evs[0]; const headline = top ? headlineOf(top, s) : 'A Quiet Day in Thistlebrook';
    const stories = evs.slice(1, 5).map(e => ({ icon: e.icon, text: e.text }));
    const quoter = [...s.villagers].sort((a, b) => b.mem.impSinceReflect - a.mem.impSinceReflect)[0];
    const r = (k: any) => this.ranked(k)[0].v.first;
    return { day, headline, stories, weather: s.rain > .4 ? 'Showers expected' : s.rng.pick(['Sunny spells', 'Clear skies', 'A light breeze', 'Mild and bright']), quote: quoter ? { who: quoter.name, text: quoter.thought } : null, leaders: { wealth: r('wealth'), popular: r('popularity'), power: r('power') } };
  }
  // Pick the most interesting villager to watch right now.
  pick(now: number, current: string | null): { id: string; reason: string } | null {
    const s = this.sim;
    const hot = this.recentImportant.filter(e => now - e.t < 40 && e.actors.length).sort((a, b) => b.imp - a.imp)[0];
    if (hot && (this.focus.reason !== hot.text)) { const id = hot.actors.find(a => !s.byId.get(a)?.inside) ?? hot.actors[0]; this.focus = { id, until: now + 50, reason: hot.text }; return { id, reason: hot.text }; }
    if (now < this.focus.until && this.focus.id) return { id: this.focus.id, reason: this.focus.reason };
    const score = (v: Villager) => (v.inside ? -5 : 0) + (v.act?.type === 'social' || v.act?.type === 'steal' ? 3 : 0) + (v.act?.type === 'chase' || v.act?.type === 'fight' ? 6 : 0) + (v.act?.type === 'work' ? 1.5 : 0) + (v.act?.type === 'attend' ? 2 : 0) + (v.id === current ? -1.2 : 0) + s.rng.range(0, 1.5);
    const best = [...s.villagers].sort((a, b) => score(b) - score(a))[0]; this.focus = { id: best.id, until: now + 35, reason: best.doing }; return { id: best.id, reason: best.doing };
  }
}
function headlineOf(e: SimEvent, s: Sim) {
  const k = e.kind, a = s.byId.get(e.actors[0])?.first ?? 'Someone', b = s.byId.get(e.actors[1])?.first ?? '';
  const H: Record<string, string> = { fight: `FISTICUFFS! ${a} and ${b} Brawl in Broad Daylight`, theft: `THIEF STRIKES THISTLEBROOK — ${a} Implicated`, ally: `NEW POWER BLOC: ${a} & ${b} Join Forces`, party: `${a}'s Gathering the Talk of the Town`, reconcile: `PEACE AT LAST: ${a} and ${b} Make Up`, gossip: `TONGUES WAG: Rumours Sweep the Village`, god: `MYSTERY GIFT FALLS FROM THE SKY`, bond: `${a} and ${b}: Village's Newest Item?`, argue: `TEMPERS FLARE Between ${a} and ${b}`, weather: 'STORM LASHES THISTLEBROOK', merchant: 'TRAVELLING MERCHANT ROLLS INTO TOWN', festival: 'FESTIVAL FEVER GRIPS THE PLAZA' };
  return H[k] ?? e.text.replace(/\.$/, '');
}
export { fmtTime };
