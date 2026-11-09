// Smallville-style memory: an append-only stream of observations with importance, retrieval by
// recency x importance x relevance, periodic reflections that become beliefs (and move opinions),
// and "facts" that can be passed on in conversation (gossip, invitations).
export interface Memory { id: number; t: number; text: string; imp: number; about: string[]; valence: number; kind: 'obs' | 'heard' | 'reflection' | 'plan' | 'feeling'; fact?: string; }
export interface Fact { id: string; kind: 'deed' | 'invite' | 'news'; text: string; about: string; actor: string; target?: string; valence: number; imp: number; t: number; origin: string;
  event?: { host: string; place: string; at: number; title: string }; }
export interface Belief { about: string; text: string; t: number; valence: number; }
let MID = 1;
export class MemoryStream {
  items: Memory[] = []; beliefs: Belief[] = []; known = new Map<string, Fact>(); impSinceReflect = 0; lastReflect = 0;
  add(t: number, text: string, imp: number, about: string[] = [], valence = 0, kind: Memory['kind'] = 'obs', fact?: string) {
    const m = { id: MID++, t, text, imp, about, valence, kind, fact }; this.items.push(m); this.impSinceReflect += imp;
    if (this.items.length > 400) this.items.splice(0, this.items.length - 400); return m;
  }
  learn(f: Fact) { if (this.known.has(f.id)) return false; this.known.set(f.id, f); return true; }
  // Smallville retrieval score: recency (exp decay per game hour) + importance + relevance (subject overlap)
  retrieve(now: number, about: string[] = [], k = 6) {
    return this.items.map(m => ({ m, s: Math.pow(0.97, (now - m.t) / 60) + m.imp / 10 + (about.length ? m.about.filter(a => about.includes(a)).length * .8 : 0) }))
      .sort((a, b) => b.s - a.s).slice(0, k).map(x => x.m);
  }
  feelingsAbout(id: string, since = 0) { let v = 0, n = 0; for (const m of this.items) if (m.t >= since && m.about.includes(id) && m.valence) { v += m.valence * m.imp; n += m.imp; } return n ? v / n : 0; }
  belief(about: string) { return this.beliefs.find(b => b.about === about); }
  setBelief(b: Belief) { const i = this.beliefs.findIndex(x => x.about === b.about); if (i >= 0) this.beliefs[i] = b; else this.beliefs.push(b); }
}
