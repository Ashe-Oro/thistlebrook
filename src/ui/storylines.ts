// Storylines: a read-only "TV guide" over the live sim — which dramas are running right now,
// who's in them, how hot they burn, and what just happened. Pure derivation (no sim mutation,
// no sim.rng use): the panel, the pinned camera and headless checks (terrarium.storylines())
// all read the same list. Recomputed at most ~1/s through a small per-sim cache; a story that
// resolves lingers ~12 s of real time as "Resolved: …" before its card drops off.
import type { Sim } from '../sim/sim';
import type { SimEvent, Villager } from '../sim/types';
import { arcs, keepsakeNeedle } from '../sim/arcs';
import { grievance, FIGHT_GRIEVANCE } from '../sim/social';
import { calendarFor } from '../sim/calendar';
import { fmtTime, dayOf, listJoin } from '../core/util';

export interface Storyline {
  id: string;
  kind: 'wedding' | 'search' | 'meeting' | 'showdown' | 'romance' | 'crush' | 'couple' | 'theft' | 'feud' | 'rumour' | 'alliance';
  emoji: string; title: string; teaser: string;
  status: string; statusCls: 'brewing' | 'open' | 'resolved';
  actors: string[]; heat: number; resolved: boolean; resolvedText?: string;
  last?: { text: string; t: number }; arcId?: string;
}

const LINGER = 12000; /* real ms a resolved card stays visible */
const pk2 = (a: string, b: string) => [a, b].sort().join('~');
const c01 = (x: number) => Math.max(0, Math.min(1, x));
const rnow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function lastEv(sim: Sim, pred: (e: SimEvent) => boolean): { text: string; t: number } | undefined {
  for (let i = sim.events.length - 1, lo = Math.max(0, sim.events.length - 400); i >= lo; i--) { const e = sim.events[i]; if (pred(e)) return { text: e.text, t: e.t }; }
  return undefined;
}
// "in 40 min" / "today 3:00 PM" / "Moonday 3:00 PM"
function whenStr(sim: Sim, at: number) {
  const d = at - sim.clock;
  if (d <= 0) return 'right now';
  if (d < 95) return `in ${Math.max(1, Math.round(d))} min`;
  return `${dayOf(at) === sim.day ? 'today' : calendarFor(dayOf(at)).weekday} ${fmtTime(at)}`;
}

interface Cache { at: number; list: Storyline[]; full: Storyline[]; ended: Map<string, { story: Storyline; at: number }>; seen: Map<string, number> }
const caches = new WeakMap<Sim, Cache>();

// The current storyline list (capped at 6 for display). Cached ~1 s of real time.
export function storylines(sim: Sim): Storyline[] {
  let c = caches.get(sim); if (!c) { c = { at: -1e9, list: [], full: [], ended: new Map(), seen: new Map() }; caches.set(sim, c); }
  const now = rnow();
  if (now - c.at >= 1000) {
    c.at = now; const next = compute(sim, c.seen, now), ids = new Set(next.map(s => s.id));
    /* State-only threads (a secret crush, or a gathering removed by cleanup) can end without a terminal arc beat. */
    for (const s of c.full) if (!s.resolved && !ids.has(s.id) && !c.ended.has(s.id)) c.ended.set(s.id, { at: now, story: { ...s, resolved: true, status: 'resolved', statusCls: 'resolved', teaser: 'This chapter has closed. A new story may be beginning.', resolvedText: 'This chapter has closed.' } });
    for (const [id, end] of c.ended) { if (ids.has(id) || now - end.at >= LINGER) c.ended.delete(id); else next.push(end.story); }
    c.full = next; c.list = next.slice(0, 6);
  }
  return c.list;
}
// Uncapped lookup, for pin tracking: a pinned story that slips out of the top 6 is still alive.
export function findStory(sim: Sim, id: string): Storyline | undefined {
  storylines(sim); return caches.get(sim)!.full.find(s => s.id === id);
}

function compute(sim: Sim, seen: Map<string, number>, now: number): Storyline[] {
  const at = arcs(sim), cand: Storyline[] = [];
  const name = (id: string) => sim.byId.get(id)?.first ?? 'someone';
  const covered = new Set<string>(); // romance pair keys already carried by a wedding / romance arc

  // ---- live gatherings: weddings, searches, meetings, showdowns --------------------------------
  for (const g of sim.gatherings) {
    if (g.kind === 'wedding') {
      const [aId, bId] = g.actors; if (!aId || !bId) continue;
      const A = name(aId), B = name(bId), pk = pk2(aId, bId); covered.add(pk);
      const off = sim.byId.get(aId)?.partner !== bId && g.done; /* done without vows = called off */
      const married = sim.vows[pk] !== undefined && sim.vows[pk] >= g.at - 1440;
      const s: Storyline = {
        id: `wed:${g.id}`, kind: 'wedding', emoji: '💒', title: `Wedding bells: ${A} & ${B}`,
        teaser: g.phase === 'vows' ? 'Under the arch right now — petals at the ready.'
          : g.phase === 'morning' ? `The big day is here! Vows at ${sim.place(g.place).name} this afternoon.`
          : `They marry ${whenStr(sim, g.at)}. Will the day go off without a hitch?`,
        status: g.phase === 'vows' ? 'vows!' : dayOf(g.at) === sim.day ? 'today!' : 'countdown', statusCls: 'open',
        actors: [aId, bId], heat: c01(.55 + (1 - (g.at - sim.clock) / 2880) * .45), resolved: g.done,
        last: lastEv(sim, e => e.kind === 'wedding' && e.actors.includes(aId)),
      };
      if (g.done) { s.statusCls = 'resolved'; s.status = 'resolved'; s.resolvedText = married && !off ? `${A} and ${B} are married!` : `The wedding is off — ${A} and ${B} parted ways.`; s.teaser = s.resolvedText; }
      cand.push(s);
    }
    if (g.kind === 'search') {
      const pet = sim.pet, team = g.actors.length ? g.actors : [g.host];
      const s: Storyline = {
        id: `search:${g.id}`, kind: 'search', emoji: '🐾', title: `${pet.name} is missing!`,
        teaser: g.phase === 'missing' ? `${pet.name} has slipped off again. Nobody has noticed… yet.`
          : `${listJoin(team.slice(0, 3).map(name))}${team.length > 3 ? ' and more' : ''} are combing the village. Who finds him first?`,
        status: g.phase === 'missing' ? 'uh-oh' : 'search party', statusCls: g.phase === 'missing' ? 'brewing' : 'open',
        actors: team.slice(0, 5), heat: g.phase === 'missing' ? .6 : .85, resolved: g.done,
        last: lastEv(sim, e => e.kind === 'search'),
      };
      if (g.done) { s.statusCls = 'resolved'; s.status = 'resolved'; s.resolvedText = s.last?.text ?? `${pet.name} is home safe.`; s.teaser = s.resolvedText; }
      cand.push(s);
    }
    if (g.kind === 'meeting') {
      const q: string = g.data.question ?? 'village business';
      const s: Storyline = {
        id: `meet:${g.id}`, kind: 'meeting', emoji: '🏛️', title: sim.clock < g.at ? 'Town meeting tonight' : 'The town meeting',
        teaser: `On the table: ${q}. What will the village decide?`,
        status: sim.clock < g.at ? whenStr(sim, g.at) : 'in session', statusCls: sim.clock < g.at ? 'brewing' : 'open',
        actors: [g.host], heat: c01(.4 + (1 - (g.at - sim.clock) / 780) * .5), resolved: g.done,
        last: lastEv(sim, e => e.kind === 'meeting'),
      };
      if (g.done) { const d = sim.decrees.find(x => x.day === g.day && x.topic === g.data.topic); s.statusCls = 'resolved'; s.status = 'resolved'; s.resolvedText = d ? `The village decided: "${d.choice}".` : s.last?.text ?? 'The meeting adjourned.'; s.teaser = s.resolvedText; }
      cand.push(s);
    }
    if (g.kind === 'showdown') {
      const [aId, bId] = g.actors; if (!aId || !bId) continue;
      const s: Storyline = {
        id: `show:${g.id}`, kind: 'showdown', emoji: '🏆', title: `Showdown: ${name(aId)} vs ${name(bId)}`,
        teaser: `${g.data.what ?? 'A contest'} in front of the whole festival — winner takes the bragging rights.`,
        status: 'live!', statusCls: 'open', actors: [aId, bId], heat: .95, resolved: g.done,
        last: lastEv(sim, e => e.kind === 'showdown'),
      };
      if (g.done) { s.statusCls = 'resolved'; s.status = 'resolved'; s.resolvedText = s.last?.text ?? 'The showdown is settled.'; s.teaser = s.resolvedText; }
      cand.push(s);
    }
  }

  // ---- story arcs: thefts, feuds, romances, rumours ---------------------------------------------
  for (const arc of at.arcs) {
    if (!arc.beats.length) continue;
    const lastB = arc.beats[arc.beats.length - 1];
    const last = { text: lastB.text, t: lastB.t };
    const ids = [...arc.actors].filter(id => sim.byId.has(id));
    if (arc.family === 'theft') {
      let k = null as null | { icon: string; name: string; owner: string; holder: string };
      if (arc.key.startsWith('theft:')) { const needle = arc.key.slice(6); for (const kk of sim.keepsakes.values()) if (keepsakeNeedle(kk.name) === needle) { k = kk; break; } }
      const resolved = arc.status === 'resolved' || (!!k && k.holder === k.owner);
      if (!resolved && sim.clock - arc.last > 3 * 1440) continue; /* a mystery gone cold */
      const thing = k ? k.name.replace(/^(his|her) /, '') : 'what was taken';
      const owner = k ? sim.byId.get(k.owner) : undefined, holder = k ? sim.byId.get(k.holder) : undefined;
      const noticed = arc.beats.some(b => ['Discovery', 'Accusation', 'Confrontation', 'Theft & chase'].includes(b.beat));
      const teaser = resolved ? last.text
        : owner && holder && holder.id !== owner.id ? `${holder.first} has it. ${owner.first} ${noticed ? 'wants it back' : "hasn't even noticed"} — you saw everything.`
        : `Someone in Thistlebrook has light fingers. Will ${thing} come home?`;
      cand.push({ id: `arc:${arc.id}`, kind: 'theft', emoji: '🕵️', title: arc.title, teaser,
        status: resolved ? 'resolved' : noticed ? 'unsolved' : 'unnoticed', statusCls: resolved ? 'resolved' : 'open',
        actors: [...new Set([k?.owner, k?.holder, ...ids].filter((x): x is string => !!x && sim.byId.has(x)))].slice(0, 4),
        heat: c01(at.heat(arc) / 14 + .25), resolved, resolvedText: resolved ? last.text : undefined, last, arcId: arc.id });
      continue;
    }
    if (arc.family === 'feud') {
      const resolved = arc.status === 'resolved';
      if (!resolved && sim.clock - arc.last > 2160) continue;
      const [aId, bId] = arc.key.startsWith('feud:') ? arc.key.slice(5).split('~') : ids;
      const a = sim.byId.get(aId), b = sim.byId.get(bId); if (!a || !b) continue;
      const gmax = Math.max(grievance(sim, a, b.id), grievance(sim, b, a.id));
      const friendly = (a.opinion[b.id] ?? 0) >= 0 && (b.opinion[a.id] ?? 0) >= 0;
      const heat = c01(.25 + (gmax / (FIGHT_GRIEVANCE * 1.4)) * .75);
      cand.push({ id: `arc:${arc.id}`, kind: 'feud', emoji: friendly ? '🏅' : '⚡', title: `${a.first} vs ${b.first}`,
        teaser: resolved ? last.text : friendly ? 'A friendly rivalry — for now.' : gmax > FIGHT_GRIEVANCE ? 'Will it come to blows?' : gmax > FIGHT_GRIEVANCE * .5 ? 'The grudge runs deep, and it keeps growing.' : 'No love lost between these two.',
        status: resolved ? 'resolved' : gmax > FIGHT_GRIEVANCE ? 'boiling' : arc.status, statusCls: resolved ? 'resolved' : arc.status,
        actors: [a.id, b.id], heat, resolved, resolvedText: resolved ? last.text : undefined, last, arcId: arc.id });
      continue;
    }
    if (arc.family === 'romance') {
      const resolved = arc.status === 'resolved';
      if (!resolved && sim.clock - arc.last > 2160) continue;
      const [aId, bId] = arc.key.startsWith('romance:') ? arc.key.slice(8).split('~') : ids;
      const a = sim.byId.get(aId), b = sim.byId.get(bId); if (!a || !b) continue;
      covered.add(pk2(aId, bId));
      if (!resolved && sim.gatherings.some(g => g.kind === 'wedding' && !g.done && g.actors.includes(aId) && g.actors.includes(bId))) continue; /* the wedding card carries it */
      const couple = a.partner === b.id;
      const teaser = resolved ? last.text
        : couple ? (sim.vows[pk2(aId, bId)] !== undefined ? 'Married, and still turning heads.' : `Sweethearts! Is a proposal in the air?`)
        : a.crush === b.id && b.crush === a.id ? 'They are both smitten. Who says it first?'
        : a.crush === b.id ? `Will ${a.first} confess to ${b.first}?`
        : b.crush === a.id ? `Will ${b.first} confess to ${a.first}?`
        : `Something is brewing between ${a.first} and ${b.first}…`;
      cand.push({ id: `arc:${arc.id}`, kind: 'romance', emoji: couple ? '💞' : '💘', title: `${a.first} & ${b.first}`, teaser,
        status: resolved ? 'resolved' : couple ? 'sweethearts' : arc.status, statusCls: resolved ? 'resolved' : arc.status,
        actors: [a.id, b.id], heat: c01(.3 + at.heat(arc) / 16), resolved, resolvedText: resolved ? last.text : undefined, last, arcId: arc.id });
      continue;
    }
    if (arc.family === 'rumour') {
      const resolved = arc.status === 'resolved';
      if (arc.beats.length < 2 || (!resolved && sim.clock - arc.last > 1440)) continue;
      const subjId = arc.key.slice(7), subj = sim.byId.get(subjId); if (!subj) continue;
      cand.push({ id: `arc:${arc.id}`, kind: 'rumour', emoji: '🐍', title: arc.title,
        teaser: resolved ? last.text : `Half the village has heard it. Will ${subj.first} find out who started it?`,
        status: resolved ? 'resolved' : 'spreading', statusCls: resolved ? 'resolved' : 'open',
        actors: [subjId, ...ids.filter(x => x !== subjId)].slice(0, 4), heat: c01(at.heat(arc) / 15), resolved, resolvedText: resolved ? last.text : undefined, last, arcId: arc.id });
    }
  }

  // ---- quiet romances the arcs haven't picked up yet --------------------------------------------
  for (const [aId, bId] of sim.couples) {
    const pk = pk2(aId, bId);
    if (covered.has(pk) || sim.vows[pk] !== undefined) continue;
    covered.add(pk);
    const a = sim.byId.get(aId), b = sim.byId.get(bId); if (!a || !b) continue;
    const longCoupled = sim.clock - (sim.coupledAt[pk] ?? 0) > 2 * 1440;
    cand.push({ id: `couple:${pk}`, kind: 'couple', emoji: '💞', title: `${a.first} & ${b.first}`,
      teaser: longCoupled ? `Sweethearts for days now. Will ${a.first} pop the question?` : "Thistlebrook's newest sweethearts. Where is it heading?",
      status: 'sweethearts', statusCls: 'open', actors: [aId, bId], heat: longCoupled ? .5 : .4, resolved: false,
      last: lastEv(sim, e => e.kind === 'romance' && e.actors.includes(aId) && e.actors.includes(bId)) });
  }
  for (const v of sim.villagers) {
    if (!v.crush || v.partner) continue;
    const c = sim.byId.get(v.crush); if (!c || covered.has(pk2(v.id, c.id))) continue;
    covered.add(pk2(v.id, c.id));
    const taken = !!c.partner;
    cand.push({ id: `crush:${v.id}`, kind: 'crush', emoji: '💘', title: `${v.first} & ${c.first}?`,
      teaser: taken ? `${c.first} is spoken for… will ${v.first}'s heart move on?` : `Will ${v.first} work up the nerve to tell ${c.first}? Only you know.`,
      status: 'secret crush', statusCls: 'brewing', actors: [v.id, c.id],
      heat: c01(.25 + ((c.opinion[v.id] ?? 0) + 40) / 250) * (taken ? .7 : 1), resolved: false,
      last: lastEv(sim, e => e.kind === 'romance' && e.actors.includes(v.id) && e.actors.includes(c.id)) });
  }

  // ---- fresh alliances --------------------------------------------------------------------------
  for (const al of sim.alliances) {
    if (sim.clock - al.founded > 1440) continue;
    const members = al.members.filter(id => sim.byId.has(id));
    cand.push({ id: `ally:${al.id}`, kind: 'alliance', emoji: '🚩', title: `${al.name} rises`,
      teaser: `${listJoin(members.slice(0, 3).map(name))} fly the same colours now. Who joins next — and who's left out?`,
      status: 'new banner', statusCls: 'brewing', actors: members.slice(0, 4), heat: .35, resolved: false,
      last: lastEv(sim, e => e.kind === 'ally' && e.actors.some(x => members.includes(x))) });
  }

  // ---- admit & rank: active stories register; resolved ones linger briefly, then drop -----------
  const admitted = cand.filter(s => {
    if (!s.resolved) { seen.set(s.id, 0); return true; }
    const t0 = seen.get(s.id);
    if (t0 === undefined) return false;             /* resolved before we ever showed it (e.g. on resume) */
    if (t0 === 0) { seen.set(s.id, now); return true; }
    if (now - t0 < LINGER) return true;
    seen.delete(s.id); return false;
  });
  const live = new Set(cand.map(s => s.id));
  for (const k of [...seen.keys()]) if (!live.has(k)) seen.delete(k);
  admitted.sort((x, y) => (y.resolved ? 1.5 + y.heat : y.heat) - (x.resolved ? 1.5 + x.heat : x.heat));
  return admitted;
}

// Pick which of a storyline's cast the pinned camera should follow right now: whoever is mid-action,
// with a little stickiness so the shot doesn't ping-pong. Presentation-only; deterministic reads.
export function storySubject(sim: Sim, s: Storyline, current: string | null): string | null {
  const cast = s.actors.map(id => sim.byId.get(id)).filter((v): v is Villager => !!v && !v.inside);
  if (!cast.length) return null;
  const score = (v: Villager) => (v.act?.type === 'chase' || v.act?.type === 'fight' ? 6 : v.act?.type === 'social' || v.act?.type === 'steal' ? 3 : v.act?.type === 'attend' ? 2 : 0) + (v.id === current ? 1.5 : 0);
  let best = cast[0];
  for (const v of cast) if (score(v) > score(best)) best = v;
  return best.id;
}
