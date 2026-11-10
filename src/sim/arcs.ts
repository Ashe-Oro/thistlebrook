// Story arcs: group raw SimEvents into causal threads so drama reads as a story, not a list.
// A theft becomes "The Missing Geode": theft → discovery → accusation → chase → fight → return.
// Read-only over the sim — instantiated lazily (see `arcs(sim)`) so no edits to sim/main are needed.
import type { Sim } from './sim';
import type { SimEvent } from './types';

export interface Beat { t: number; text: string; eventId: number; beat: string; imp: number; icon: string; }
export interface Arc {
  id: string; key: string; family: 'theft' | 'romance' | 'feud' | 'rumour';
  title: string; status: 'brewing' | 'open' | 'resolved';
  beats: Beat[]; actors: Set<string>; last: number;
}

const MIN = 1440;
// strip a leading possessive ("his", "grandma's") so "his father's medal" → "medal", "her silver locket" → "silver locket"
export function keepsakeNeedle(name: string): string {
  return name.replace(/^(his|her|a|an|the)\s+/i, '').replace(/^[\w']+['’]s\s+/i, '').trim().toLowerCase();
}
// punchy display noun: drop a leading flavour adjective and title-case ("lucky geode" → "Geode", "little black book" → "Black Book")
function keepsakeTitle(needle: string): string {
  const core = needle.replace(/^(lucky|silver|carved|little|old|golden|wooden|his|her)\s+/i, '');
  return core.replace(/(^|[\s-])(\w)/g, (_m, sp, c) => sp + c.toUpperCase()); /* not after an apostrophe: "Sailor’s" */
}
const pairKey = (a: string, b: string) => [a, b].sort().join('~');

interface Hint { family: Arc['family']; key: string; beat: string; title: string; subject?: string; pairable?: boolean; terminal?: boolean; }

export class ArcTracker {
  arcs: Arc[] = [];
  byKey = new Map<string, Arc>();
  byEvent = new Map<number, { arc: Arc; beat: Beat }>();
  seen = new Set<number>();
  n = 1;
  constructor(public sim: Sim) {
    for (const e of sim.events) this.ingest(e);           // backfill anything already logged
    sim.on('event', (e: SimEvent) => this.ingest(e));
    sim.on('eventUpdate', (e: SimEvent) => this.ingest(e, true));
  }
  private keepsakeIn(text: string): { needle: string; title: string } | null {
    for (const k of this.sim.keepsakes.values()) {
      const needle = keepsakeNeedle(k.name);
      if (needle && text.toLowerCase().includes(needle)) return { needle, title: keepsakeTitle(needle) };
    }
    return null;
  }
  private classify(e: SimEvent): Hint | null {
    const t = e.text, k = e.kind, A = e.actors;
    const pair = A.length >= 2 ? pairKey(A[0], A[1]) : null;
    // ---- THEFT ---------------------------------------------------------------
    if (k === 'theft') {
      const ks = this.keepsakeIn(t);
      const title = ks ? `The Missing ${ks.title}` : pair ? `${this.fn(A[0])} & the Theft` : 'A Theft in Thistlebrook';
      const key = ks ? `theft:${ks.needle}` : pair ? `theft:${pair}` : `theft:${e.id}`;
      let beat = 'Theft', terminal = false;
      if (/can't find|gone missing|turning the village upside down/i.test(t)) beat = 'Discovery';
      else if (/chase is on/i.test(t)) beat = 'Theft & chase';
      else if (/crept into|cover of night/i.test(t)) beat = 'Night theft';
      else if (/got away/i.test(t)) beat = 'Got away';
      else if (/accused/i.test(t)) beat = 'Accusation';
      else if (/confronted .* about the missing/i.test(t)) beat = 'Confrontation';
      else if (/handed (it )?back|snatched back|came clean|took it back/i.test(t)) { beat = 'Returned'; terminal = true; }
      else if (/pocketed|snatched/i.test(t)) beat = 'Theft';
      return { family: 'theft', key, beat, title, pairable: true, terminal };
    }
    // ---- ROMANCE -------------------------------------------------------------
    if (k === 'romance') {
      let beat = 'Romance', terminal = false;
      let a = A[0], b = A[1];
      if (/said yes|new sweethearts|are sweethearts/i.test(t)) { beat = 'Sweethearts'; terminal = true; }
      else if (/let (them|him|her) down|walked home alone|turned down/i.test(t)) { beat = 'Heartbreak'; terminal = true; }
      else if (/called it off/i.test(t)) { beat = 'Breakup'; terminal = true; }
      else if (/jealous/i.test(t)) { beat = 'Jealousy'; if (A.length >= 3) { a = A[1]; b = A[2]; } }
      else if (/pink envelope|love letter|lavender/i.test(t)) beat = 'Love letter';
      else if (/fallen for|falling for|can't stop thinking/i.test(t)) beat = 'Crush';
      else if (/flirting|sweet line|did not land/i.test(t)) beat = 'Flirting';
      else if (/confessed/i.test(t)) beat = 'Confession';
      if (!a || !b) return null;
      return { family: 'romance', key: `romance:${pairKey(a, b)}`, beat, title: `${this.fn(a)} & ${this.fn(b)}`, pairable: true, terminal };
    }
    // ---- FEUD (argue / fight / reconcile / mediate / contest / resentment) ----
    if (k === 'mediate') { // actors are [mediator, a, b]: the feud is between the second and third
      const a = A[1], b = A[2]; if (!a || !b) return null;
      return { family: 'feud', key: `feud:${pairKey(a, b)}`, beat: 'Defused', title: `Feud: ${this.fn(a)} vs ${this.fn(b)}`, pairable: true };
    }
    if (k === 'argue' || k === 'fight' || k === 'reconcile' || k === 'contest' || (k === 'bond' && /resent|😠/.test(t + e.icon))) {
      if (!pair) return null;
      let beat = 'Argument', terminal = false;
      if (k === 'fight') beat = /dust settled|came out on top/i.test(t) ? 'Aftermath' : 'Fight';
      else if (k === 'reconcile') { if (/wasn't ready to forgive/i.test(t)) beat = 'Rebuffed'; else { beat = 'Reconciled'; terminal = true; } }
      else if (k === 'contest') beat = 'Contest';
      else if (k === 'bond') beat = 'Bad blood';
      else beat = 'Argument';
      return { family: 'feud', key: `feud:${pair}`, beat, title: `Feud: ${this.fn(A[0])} vs ${this.fn(A[1])}`, pairable: true, terminal };
    }
    // ---- RUMOUR (gossip) -----------------------------------------------------
    if (k === 'gossip') {
      let subject: string | undefined, beat = 'Whispers', terminal = false;
      if (/warned .* spreading rumours|spreading rumours about/i.test(t)) { beat = 'Exposed'; terminal = true; subject = A[1]; }
      else if (/word travels fast|whole village is whispering|all over thistlebrook/i.test(t)) { beat = 'Everyone knows'; subject = A[0]; }
      else if (/wasn't buying it|tried to spread/i.test(t)) { beat = 'Doubted'; subject = A[2]; }
      else if (/\(it isn't true\.\)/i.test(t)) { beat = 'A lie takes root'; subject = A[2]; }
      else if (/told .* that/i.test(t)) { beat = 'Spreads'; subject = A[2]; }
      subject = subject ?? A[A.length - 1];
      if (!subject) return null;
      return { family: 'rumour', key: `rumour:${subject}`, beat, title: `The Rumour about ${this.fn(subject)}`, subject, terminal };
    }
    return null;
  }
  private fn(id: string) { return this.sim.byId.get(id)?.first ?? 'Someone'; }
  // find an unresolved pair arc (fights/returns slot into the theft/feud they belong to, not a new thread)
  private findPairArc(a: string, b: string, families: Arc['family'][]): Arc | null {
    let best: Arc | null = null;
    for (const arc of this.arcs) {
      if (!families.includes(arc.family) || arc.status === 'resolved') continue;
      if (!arc.actors.has(a) || !arc.actors.has(b)) continue;
      if (this.sim.clock - arc.last > 2 * MIN) continue;
      if (!best || arc.last > best.last || (families.indexOf(arc.family) < families.indexOf(best.family))) best = arc;
    }
    return best;
  }
  ingest(e: SimEvent, update = false) {
    if (update) { const ex = this.byEvent.get(e.id); if (ex) { const b = ex.beat; if (b.eventId === e.id) { b.text = e.text; b.imp = Math.max(b.imp, e.imp); ex.arc.last = Math.max(ex.arc.last, e.t); this.recompute(ex.arc); } return; } }
    if (this.seen.has(e.id)) return;
    if (e.imp < 3) return;                 // small talk stays out of arcs
    const h = this.classify(e); if (!h) return;
    this.seen.add(e.id);
    let arc = this.byKey.get(h.key) ?? null;
    // climactic beats (a fight, a return) join the thread they resolve, even keyed differently
    if (!arc && h.pairable && e.actors.length >= 2 && (h.family === 'feud' || h.family === 'theft')) {
      const absorb = (h.beat === 'Fight' || h.beat === 'Aftermath' || h.beat === 'Reconciled' || h.beat === 'Rebuffed');
      if (absorb) { const found = this.findPairArc(e.actors[0], e.actors[1], ['theft', 'feud', 'romance']); if (found) arc = found; }
    }
    if (!arc) { arc = { id: `arc${this.n++}`, key: h.key, family: h.family, title: h.title, status: 'brewing', beats: [], actors: new Set(), last: e.t }; this.arcs.push(arc); this.byKey.set(h.key, arc); if (this.arcs.length > 80) { const dead = this.arcs.shift()!; if (this.byKey.get(dead.key) === dead) this.byKey.delete(dead.key); for (const [id, entry] of this.byEvent) if (entry.arc === dead) this.byEvent.delete(id); } }
    for (const a of e.actors) arc.actors.add(a);
    // Collapse same-day repeats only, preserving yesterday's beat for the dawn paper.
    const lastB = arc.beats[arc.beats.length - 1];
    if (lastB && lastB.beat === h.beat && Math.floor(lastB.t / MIN) === Math.floor(e.t / MIN)) { lastB.text = e.text; lastB.imp = Math.max(lastB.imp, e.imp); lastB.t = e.t; lastB.eventId = e.id; this.byEvent.set(e.id, { arc, beat: lastB }); }
    else { const beat = { t: e.t, text: e.text, eventId: e.id, beat: h.beat, imp: e.imp, icon: e.icon }; arc.beats.push(beat); if (arc.beats.length > 14) { const dead = arc.beats.shift()!; for (const [id, entry] of this.byEvent) if (entry.beat === dead) this.byEvent.delete(id); } this.byEvent.set(e.id, { arc, beat }); }
    arc.last = Math.max(arc.last, e.t);
    this.recompute(arc);
  }
  private recompute(arc: Arc) {
    const last = arc.beats[arc.beats.length - 1];
    const terminal = last && /Returned|Sweethearts|Heartbreak|Breakup|Reconciled|Exposed/.test(last.beat);
    let done = !!terminal;
    // a keepsake theft only resolves once the keepsake is truly back with its owner (whatever the last line said)
    if (arc.family === 'theft' && arc.key.startsWith('theft:')) { const needle = arc.key.slice(6); for (const k of this.sim.keepsakes.values()) if (keepsakeNeedle(k.name) === needle) { done = k.holder === k.owner; break; } }
    arc.status = done ? 'resolved' : arc.beats.length >= 2 ? 'open' : 'brewing';
  }
  heat(arc: Arc, now = this.sim.clock): number {
    // reward distinct, developing beats; a repeated gossip re-tell adds little (keeps the firehose from burying real drama)
    let h = 0; const seen = new Map<string, number>();
    for (const b of arc.beats) { const n = seen.get(b.beat) ?? 0; seen.set(b.beat, n + 1); h += b.imp * Math.exp(-(now - b.t) / (2 * MIN)) * (n === 0 ? 1 : 0.25); }
    if (arc.family === 'rumour') h *= 0.7;        // whispers are noisy; let theft/romance/feud lead
    h += seen.size * 1.2;                          // variety of beats = a story with shape
    if (arc.status === 'open') h += 3;
    return h;
  }
  arcForEvent(id: number): { arc: Arc; beatNo: number } | null {
    const e = this.byEvent.get(id); if (!e) return null; const idx = e.arc.beats.indexOf(e.beat); return idx < 0 ? null : { arc: e.arc, beatNo: idx + 1 };
  }
  // top story threads by heat; by default only ones with real shape (>= 2 beats)
  top(n = 4, minBeats = 2, now = this.sim.clock): Arc[] {
    for (const a of this.arcs) if (a.family === 'theft' && a.beats.length) this.recompute(a);
    return this.arcs.filter(a => a.beats.length >= minBeats).map(a => ({ a, h: this.heat(a, now) })).sort((x, y) => y.h - x.h).slice(0, n).map(x => x.a);
  }
}

const trackers = new WeakMap<Sim, ArcTracker>();
// shared per-sim singleton — ui.ts and director.ts both call this; only one subscription is ever created
export function arcs(sim: Sim): ArcTracker {
  let t = trackers.get(sim); if (!t) { t = new ArcTracker(sim); trackers.set(sim, t); } return t;
}
