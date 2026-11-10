// Villager-initiated multi-person events, Smallville-style: proposals and weddings, feud showdowns
// at festivals, lost-pet search parties, town meetings with real votes, and the weekly calendar
// fixtures (market day, rest day, festival eve). A gathering is plain data — villager ids, numbers,
// strings — ticked from sim.step at the fixed step, deterministic (sim.rng only), and save-friendly
// (save.ts serialises the sim graph generically; callbacks never live in persistent state).
// Wherever possible this rides the existing party/attend machinery instead of duplicating it:
// weddings, meetings, market mornings and the sim-side festival are all Parties underneath, so
// invitations spread by word of mouth and guests gather, sit, chat and dance with the usual code.
import type { Sim } from './sim';
import type { Villager, Gathering } from './types';
import { calendarFor } from './calendar';
import { say, pr } from './lines';
import { clamp, listJoin } from '../core/util';

const H = (h: number) => h * 60;
const key2 = (a: string, b: string) => [a, b].sort().join('~');
const nudge = (a: Villager, b: Villager, d: number) => { a.opinion[b.id] = clamp((a.opinion[b.id] ?? 0) + d, -100, 100); };
const free = (v: Villager) => !v.inside && v.doing !== 'sleeping' && !v.act?.locked;

function push(sim: Sim, g: Omit<Gathering, 'id' | 'done'>): Gathering {
  const full: Gathering = { id: `g${sim.gid++}`, done: false, ...g };
  sim.gatherings.push(full); return full;
}

// ---- the tick (called from sim.step at the fixed step) ------------------------------------------
export function tickGatherings(sim: Sim) {
  if (sim.day !== sim.calDay && sim.hour >= 6) { sim.calDay = sim.day; scheduleDay(sim); }
  maybeLosePet(sim); maybeShowdown(sim);
  for (const g of sim.gatherings) if (!g.done) {
    if (g.kind === 'festival') tickFestivalEve(sim, g);
    else if (g.kind === 'wedding') tickWedding(sim, g);
    else if (g.kind === 'search') tickSearch(sim, g);
    else if (g.kind === 'meeting') tickMeeting(sim, g);
    else if (g.kind === 'showdown') tickShowdown(sim, g);
  }
  if (sim.gatherings.length > 20) sim.gatherings = sim.gatherings.filter(g => !g.done || sim.day - g.day < 2);
}

// ---- weekly fixtures from the calendar -----------------------------------------------------------
function scheduleDay(sim: Sim) {
  const day = sim.day, cal = calendarFor(day), day0 = (day - 1) * 1440, R = sim.rng;
  sim.parties = sim.parties.filter(p => !p.done || sim.clock - p.until < 3 * 1440); // old flyers come off the board
  if (cal.tags.includes('market') && sim.world.places.has('market')) {
    // no economy: market day is a social morning at the stalls, and everyone knows the calendar
    const host = [...sim.villagers].sort((a, b) => b.traits.sociability - a.traits.sociability)[0];
    const p = sim.scheduleParty(host, 'the Moonday market morning', 'market', day0 + H(9.4), 85,
      { announce: `${cal.weekday}: market day. The stalls open mid-morning and half the village means to be there.`, kind: 'market', icon: '🧺', tag: 'market' });
    for (const v of sim.villagers) { sim.learnFact(v, p.fact); p.invited.add(v.id); }
    (p as any).decided = new Map(sim.villagers.map(v => [v.id, R.chance(.5 + v.traits.sociability * .35)])); // market day pulls a real crowd
  }
  if (cal.tags.includes('town-meeting')) {
    const place = ['school', 'tavern', 'plaza'].find(id => sim.world.places.has(id))!;
    const speaker = [...sim.villagers].sort((a, b) => sim.power(b) - sim.power(a))[0];
    const t = pickTopic(sim), at = day0 + H(19);
    const p = sim.scheduleParty(speaker, 'the town meeting', place, at, 90,
      { announce: `A notice went up on the board: town meeting at ${sim.place(place).name} this evening. On the table: ${t.question}.`, kind: 'meeting', icon: '📯', tag: 'meeting' });
    for (const v of sim.villagers) { sim.learnFact(v, p.fact); p.invited.add(v.id); }
    (p as any).decided = new Map(sim.villagers.map(v => [v.id, v.id === speaker.id || R.chance(.45 + v.traits.diligence * .25 + (v.goal === 'power' ? .25 : 0) + v.traits.sociability * .15)]));
    push(sim, { kind: 'meeting', phase: 'planned', at, until: at + 90, place, host: speaker.id, partyId: p.id, actors: [], day, data: { topic: t.id, question: t.question, options: t.options, about: t.about ?? '' } });
  }
  if (cal.tags.includes('festival-eve') && sim.festivalUntil <= sim.clock) {
    push(sim, { kind: 'festival', phase: 'planned', at: day0 + H(18.4), until: day0 + H(22), place: 'plaza', host: '', actors: [], day, data: {} });
    sim.log(`${cal.weekday}: festival eve. By sundown the plaza will be ringing.`, 3, [], 'festival', '🏮');
  }
  if (cal.tags.includes('rest')) sim.log(`${cal.weekday} in Thistlebrook: tools stay on their hooks and the village takes it slow.`, 3, [], 'calendar', '🕊️');
}

// the sim-side festival: state changes are synchronous and deterministic; the render side (bunting,
// lights) follows through god.tickFestival, which watches festivalUntil/festivalShown each frame
function tickFestivalEve(sim: Sim, g: Gathering) {
  if (sim.clock < g.at) return; g.done = true;
  if (sim.festivalUntil > sim.clock) return; // a viewer-summoned festival already has the plaza
  if (sim.rainUntil > sim.clock) { sim.rainUntil = sim.clock; sim.log('The clouds parted just in time for the festival.', 3, [], 'weather', '🌤️', -9, 5); }
  const host = [...sim.villagers].sort((a, b) => sim.popularity(b) - sim.popularity(a))[0];
  const title = sim.festivalTheme ?? 'the Thistlebrook Festival';
  sim.festivalShown = false; sim.festivalUntil = sim.clock + 200;
  const p = sim.scheduleParty(host, title, 'plaza', sim.clock + 2, 180, { announce: false, tag: 'festival' });
  for (const v of sim.villagers) { sim.learnFact(v, p.fact); p.invited.add(v.id); if (v.doing !== 'sleeping') sim.icon(v, '🎪'); }
  sim.log(`Festival eve! Bunting went up over the plaza and ${host.first} was chosen to lead the dancing${sim.festivalTheme ? ` — this season it's ${title}` : ''}.`, 7, [host.id], 'festival', '🎪', -9, 5);
}

// ---- proposal & wedding ---------------------------------------------------------------------------
// The proposal itself is a social action (brain.social scores it, social.ts resolves it); these are
// the gates and the follow-through once somebody says yes.
export function proposalReady(sim: Sim, v: Villager, u: Villager): boolean {
  if (v.partner !== u.id) return false;
  const k = key2(v.id, u.id);
  if (sim.vows[k] !== undefined) return false;
  if (sim.clock - (sim.proposedAt[k] ?? -1e9) < 4320) return false;        // a refused proposal needs days to heal
  if (sim.clock - (sim.coupledAt[k] ?? 0) < 2 * 1440) return false;        // sweethearts for at least two days first
  if ((v.opinion[u.id] ?? 0) < 68 || (u.opinion[v.id] ?? 0) < 60) return false;
  if (sim.gatherings.some(g => g.kind === 'wedding' && !g.done)) return false; // one wedding on the calendar at a time
  const h = sim.hour; return h > 9 && h < 20.5;
}
export function recordProposal(sim: Sim, a: Villager, b: Villager) { sim.proposedAt[key2(a.id, b.id)] = sim.clock; }

export function planWedding(sim: Sim, a: Villager, b: Villager) {
  const venue = ['chapel', 'garden', 'plaza'].find(id => sim.world.places.has(id))!;
  const day = sim.day + (sim.rng.chance(.5) ? 1 : 2), at = (day - 1) * 1440 + H(15);
  const p = sim.scheduleParty(a, `${a.first} & ${b.first}'s wedding`, venue, at, 130,
    { announce: `${a.first} and ${b.first} set the date: a wedding at ${sim.place(venue).name} on ${calendarFor(day).weekday} afternoon. Invitations are flying from lip to lip.`, kind: 'wedding', icon: '💌', tag: 'wedding' });
  p.wedding = [a.id, b.id];
  (p as any).decided = new Map([[a.id, true], [b.id, true]]); // the couple would never skip their own wedding
  sim.learnFact(b, p.fact);
  for (const id of [...a.family, ...b.family]) { const f = sim.byId.get(id); if (f) sim.learnFact(f, p.fact); }
  push(sim, { kind: 'wedding', phase: 'planned', at, until: at + 130, place: venue, host: a.id, partyId: p.id, actors: [a.id, b.id], day, data: {} });
}

function tickWedding(sim: Sim, g: Gathering) {
  const a = sim.byId.get(g.actors[0])!, b = sim.byId.get(g.actors[1])!;
  const p = sim.parties.find(x => x.id === g.partyId);
  if (!p || p.done) { g.done = true; return; }
  if (a.partner !== b.id) { // a breakup before the big day calls the whole thing off
    g.done = true; p.done = true;
    sim.log(`The wedding is off — ${a.first} and ${b.first} parted ways before the day came.`, 7, [a.id, b.id], 'wedding', '🥀');
    return;
  }
  if (g.phase === 'planned' && sim.day === g.day && sim.clock >= g.at - 300) {
    g.phase = 'morning';
    // the couple spend the morning making sure word reaches everyone they're on speaking terms with —
    // being left off the list is itself a slight (rivals below -10 hear nothing)
    for (const v of sim.villagers) if (v !== a && v !== b && ((v.opinion[a.id] ?? 0) > -10 || (v.opinion[b.id] ?? 0) > -10)) sim.learnFact(v, p.fact);
    sim.log(`Wedding day in Thistlebrook! ${a.first} and ${b.first} marry at ${sim.place(g.place).name} this afternoon.`, 5, [a.id, b.id], 'wedding', '💒');
    return;
  }
  if ((g.phase === 'planned' || g.phase === 'morning') && sim.clock >= g.at + 30) { // guests from the far districts need the walk
    g.phase = 'vows'; g.data.cheerAt = sim.clock + 11;
    const pl = sim.place(g.place), fx = pl.cx, fz = pl.cz + 2.5; // same front-of-venue convention attend() uses for guest spots
    p.focus = [fx, fz]; p.quietUntil = sim.clock + 10; // the crowd falls silent and faces the couple
    const [ax, az] = sim.world.nav.nearestFree(fx - .55, fz), [bx, bz] = sim.world.nav.nearestFree(fx + .55, fz);
    for (const [v, x, z] of [[a, ax, az], [b, bx, bz]] as [Villager, number, number][]) {
      sim.clearPlan(v); sim.leaveSeat(v);
      if (v.inside) { sim.place(v.inside).inside.delete(v.id); v.inside = null; v.avatar.targetAlpha = 1; }
      v.x = x; v.z = z;
      v.act = { type: 'idle', anim: 'talk', dur: 11, t: 0, label: 'exchanging vows', locked: true };
      v.emotions.love = 1; v.emotions.joy = 1;
    }
    a.heading = Math.atan2(b.x - a.x, b.z - a.z); b.heading = Math.atan2(a.x - b.x, a.z - b.z);
    a.avatar.targetHeading = a.heading; b.avatar.targetHeading = b.heading;
    (a.act as any).face = a.heading; (b.act as any).face = b.heading;
    const officiant = [...p.attendees].map(id => sim.byId.get(id)!).filter(v => v !== a && v !== b).sort((x, y) => y.traits.kindness - x.traits.kindness)[0];
    sim.emit('convo', [
      ...(officiant ? [{ who: officiant.id, text: 'Dearly beloved, we are gathered…', emoji: '📖', at: sim.clock + 1 }] : []),
      { who: a.id, text: say(sim, a, 'vows', { t: b.first }), emoji: '💍', at: sim.clock + 5 },
      { who: b.id, text: say(sim, b, 'vowsReply', { t: a.first }), emoji: '💍', at: sim.clock + 9 },
    ]);
    sim.vows[key2(a.id, b.id)] = sim.clock; nudge(a, b, 15); nudge(b, a, 15);
    sim.world.fx.sparkle(fx, 1.8, fz, [1, .7, .75], 30);
    const guests = [...p.attendees].filter(id => id !== a.id && id !== b.id);
    sim.log(`${a.first} and ${b.first} were married at ${pl.name} before ${guests.length >= 3 ? `a crowd of ${guests.length}` : 'a quiet handful'} — vows, happy tears, and petals in the wind.`, 9, [a.id, b.id, ...guests.slice(0, 5)], 'wedding', '💒', fx, fz);
    const f = sim.fact('news', `${a.first} and ${b.first} are married`, a.id, a.id, .6, 8, b.id); (f as any).romance = true;
    sim.witness(`${a.first} and ${b.first} were married`, 8, [a.id, b.id], { [a.id]: 1, [b.id]: 1, '*': .4 }, fx, fz, f, 20);
    for (const id of guests) { const u = sim.byId.get(id)!; nudge(u, a, 5); nudge(u, b, 5); u.emotions.joy = Math.min(1, u.emotions.joy + .4); }
    sim.achieve(null, `wed-${key2(a.id, b.id)}`, 'Wedding Bells', `${a.first} & ${b.first} tied the knot`);
    // old flames sulk, or worse (a drama hook the arcs and the paper will pick up)
    for (const j of sim.villagers.filter(u => u !== a && u !== b && (u.crush === a.id || u.crush === b.id)).slice(0, 2)) {
      const beloved = j.crush === a.id ? a : b, rival = beloved === a ? b : a;
      j.emotions.sadness = 1; j.emotions.anger = Math.min(1, j.emotions.anger + .5); nudge(j, rival, -12);
      j.mem.add(sim.clock, `${beloved.first} married ${rival.first}. It should have been me.`, 8, [a.id, b.id], -.8, 'feeling');
      if (j.traits.temper > .6 && p.attendees.has(j.id) && sim.rng.chance(.3)) {
        sim.icon(j, '💢'); sim.say(j, 'This is a mistake and you know it!', '💢', 3);
        sim.log(`${j.first} burst out in the middle of the vows that it should have been ${pr(j).obj}! Gasps all round.`, 7, [j.id, beloved.id, rival.id], 'wedding', '💢');
        nudge(beloved, j, -10); nudge(rival, j, -15);
      } else { sim.icon(j, '😔'); if (p.attendees.has(j.id)) sim.log(`${j.first} slipped away before the dancing, eyes down.`, 4, [j.id, beloved.id], 'wedding', '😔'); }
      j.crush = null; j.heartbreak = sim.clock + 1440;
    }
    return;
  }
  if (g.phase === 'vows' && sim.clock >= g.data.cheerAt) {
    g.phase = 'party'; g.done = true;
    p.quietUntil = 0; p.cheerUntil = sim.clock + 7; p.dance = true;
    sim.log(`Cheers rang over ${sim.place(g.place).name} and the wedding party began — dancing till the lanterns burn low.`, 5, [a.id, b.id], 'wedding', '🎉');
  }
}

// ---- feud showdown at the festival ----------------------------------------------------------------
const CONTESTS: [string, string, string][] = [['an arm-wrestle', '💪', 'fight'], ['a pie-eating contest', '🥧', 'drink'], ['a dance-off', '🕺', 'dance']];
function maybeShowdown(sim: Sim) {
  if (sim.festivalUntil <= sim.clock) return;
  if ((sim.gatherDay['showdown'] ?? -99) + 3 > sim.day) return;
  if (sim.gatherings.some(g => g.kind === 'showdown' && !g.done)) return;
  // wait until the crowd has actually gathered round the plaza
  const p = sim.parties.find(x => !x.done && x.place === 'plaza' && sim.clock >= x.at + 16 && sim.clock < x.until - 45 && x.attendees.size >= 4);
  if (!p) return;
  let best: [Villager, Villager] | null = null, bs = 0;
  for (const a of sim.villagers) for (const b of sim.villagers) {
    if (a.id >= b.id) continue;
    const oa = a.opinion[b.id] ?? 0, ob = b.opinion[a.id] ?? 0;
    if (oa > -25 || ob > -25 || !free(a) || !free(b)) continue;
    const s = -(oa + ob) + (a.stats.fights + b.stats.fights) * 3;
    if (s > bs) { bs = s; best = [a, b]; }
  }
  if (!best) return;
  sim.gatherDay['showdown'] = sim.day;
  const [a, b] = best, [what, icon, anim] = sim.rng.pick(CONTESTS);
  const pl = sim.place('plaza'), [cx, cz] = sim.world.nav.nearestFree(pl.cx, pl.cz + 2);
  for (const v of [a, b]) { sim.clearPlan(v); sim.leaveSeat(v); }
  [a.x, a.z] = sim.world.nav.nearestFree(cx - .6, cz); [b.x, b.z] = sim.world.nav.nearestFree(cx + .6, cz);
  a.heading = Math.atan2(b.x - a.x, b.z - a.z); b.heading = Math.atan2(a.x - b.x, a.z - b.z);
  a.avatar.targetHeading = a.heading; b.avatar.targetHeading = b.heading;
  a.act = { type: 'idle', anim, dur: 13, t: 0, label: `facing ${b.first} in ${what}`, locked: true, face: a.heading };
  b.act = { type: 'idle', anim, dur: 13, t: 0, label: `facing ${a.first} in ${what}`, locked: true, face: b.heading };
  p.focus = [cx, cz]; // the dancers turn to watch
  sim.say(a, say(sim, a, 'contestTaunt'), '💢', 3); sim.say(b, say(sim, b, 'contestTaunt'), '😤', 3);
  sim.log(`The bad blood between ${a.first} and ${b.first} came to a head at the festival: ${what}, right in front of the whole village!`, 7, [a.id, b.id], 'showdown', icon, cx, cz);
  push(sim, { kind: 'showdown', phase: 'contest', at: sim.clock, until: sim.clock + 13, place: 'plaza', host: a.id, partyId: p.id, actors: [a.id, b.id], day: sim.day, data: { what, icon } });
}

function tickShowdown(sim: Sim, g: Gathering) {
  const a = sim.byId.get(g.actors[0])!, b = sim.byId.get(g.actors[1])!, what: string = g.data.what;
  if (sim.clock < g.until) {
    if (!g.data.mid && sim.clock > g.at + 6) { // the crowd eggs them on halfway through
      g.data.mid = 1;
      const party = sim.parties.find(x => x.id === g.partyId && !x.done);
      for (const id of party ? [...party.attendees].filter(x => x !== a.id && x !== b.id).slice(0, 2) : []) {
        const u = sim.byId.get(id)!; sim.say(u, say(sim, u, 'contestCheer'), '📣', 2.6);
      }
    }
    return;
  }
  g.done = true;
  const R = sim.rng;
  const sc = (v: Villager) => (what.includes('arm') ? v.traits.bravery + v.def.height * .4 : what.includes('pie') ? v.traits.diligence * .5 + (100 - v.needs.food) / 150 : v.traits.sociability + v.emotions.joy * .3) + R.range(0, .5);
  const [w, l] = sc(a) >= sc(b) ? [a, b] : [b, a];
  const party = sim.parties.find(x => x.id === g.partyId && !x.done);
  const crowd = party ? [...party.attendees].filter(id => id !== a.id && id !== b.id) : [];
  const settle = R.chance(.35 + l.traits.kindness * .35 - l.traits.temper * .25);
  sim.log(`${w.first} won ${what}! The crowd roared${settle ? `, and ${l.first} offered a hand — the feud is settled, fair and square` : `; ${l.first} stormed off through the dancers`}.`, 8, [w.id, l.id, ...crowd.slice(0, 4)], 'showdown', '🏆', w.x, w.z);
  for (const id of crowd) { const u = sim.byId.get(id)!; nudge(u, w, 5); nudge(u, l, settle ? 2 : -2); }
  w.emotions.joy = 1; sim.icon(w, '🏆');
  w.queue.push({ type: 'idle', anim: 'cheer', dur: 8, t: 0, label: 'soaking up the cheers' });
  if (settle) { nudge(w, l, 20); nudge(l, w, 24); l.emotions.anger = 0; sim.icon(l, '🤝'); w.stats.makeups++; l.stats.makeups++; }
  else { nudge(l, w, -8); l.emotions.anger = 1; l.emotions.sadness = .6; l.queue.push({ type: 'idle', anim: 'sad', dur: 15, t: 0, label: 'licking wounds' }); }
  const f = sim.fact('deed', `${w.first} beat ${l.first} in ${what} at the festival`, w.id, w.id, settle ? .4 : -.2, 7, l.id); (f as any).label = 'the showdown';
  sim.witness(`${w.first} beat ${l.first} in ${what}`, 7, [w.id, l.id], { [w.id]: .7, [l.id]: settle ? .2 : -.6, '*': .2 }, w.x, w.z, f, 18);
  if (party) { party.cheerUntil = sim.clock + 6; party.focus = undefined; } // the ring closes back up
  sim.achieve(null, 'showdown', 'Settled at the Festival', `${w.first} bested ${l.first} in ${what}`);
}

// ---- lost-pet search party ------------------------------------------------------------------------
const SEARCH_SPOTS = ['forest', 'orchard', 'dock', 'pasture', 'campfire', 'pond', 'quarry'];
function maybeLosePet(sim: Sim) {
  if (sim.pet.state !== 'home') return;
  if (sim.hour < 8.6 || sim.hour > 9.4 || sim.gatherDay['petroll'] === sim.day) return;
  sim.gatherDay['petroll'] = sim.day;
  if ((sim.gatherDay['search'] ?? -99) + 3 > sim.day || !sim.rng.chance(.35)) return;
  const spots = SEARCH_SPOTS.filter(id => sim.world.places.has(id)); if (spots.length < 3) return;
  const hide = sim.rng.pick(spots), pl = sim.place(hide);
  const [px, pz] = sim.world.nav.nearestFree(pl.cx + sim.rng.range(-1.2, 1.2), pl.cz + sim.rng.range(-1.2, 1.2));
  sim.pet = { ...sim.pet, state: 'missing', since: sim.clock, x: px, z: pz, spot: hide };
  sim.gatherDay['search'] = sim.day;
  const owner = sim.byId.get('pip') ?? sim.villagers[0]; // Pip feeds him, so Pip counts as his boy
  push(sim, { kind: 'search', phase: 'missing', at: sim.clock, until: sim.clock + 300, place: hide, host: owner.id, actors: [], day: sim.day, data: { assign: {}, visited: [] } });
}

function tickSearch(sim: Sim, g: Gathering) {
  const pet = sim.pet, owner = sim.byId.get(g.host)!;
  if (g.phase === 'missing') {
    if (sim.clock < g.at + 35) return;                       // nobody notices for a while
    if (!free(owner) && sim.clock < g.until - 90) return;    // wait for the owner to surface
    g.phase = 'searching';
    if (free(owner)) sim.clearPlan(owner);
    owner.emotions.fear = .5; owner.emotions.sadness = .6; sim.icon(owner, '❗');
    sim.say(owner, say(sim, owner, 'searchAlarm', { pet: pet.name }), '😟', 3.2);
    const friends = sim.villagers.filter(u => u !== owner && free(u) && ((u.opinion[owner.id] ?? 0) > 5 || u.traits.kindness > .6))
      .sort((x, y) => (y.opinion[owner.id] ?? 0) - (x.opinion[owner.id] ?? 0)).slice(0, 4);
    const team = [owner, ...friends];
    const spots = SEARCH_SPOTS.filter(id => sim.world.places.has(id));
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(sim.rng.next() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    const assign: Record<string, string[]> = {};
    team.forEach(v => assign[v.id] = []);
    spots.forEach((s, i) => assign[team[i % team.length].id].push(s)); // every spot is covered, including the right one
    g.data.assign = assign; g.actors = team.map(v => v.id);
    for (const v of friends) { v.thought = say(sim, v, 'searchJoin', { pet: pet.name }); sim.say(v, v.thought, '🔍', 2.6); }
    owner.thought = `${pet.name}, where are you?`;
    sim.log(`${pet.name} the village dog is missing! ${owner.first} raised the alarm${friends.length ? `, and ${listJoin(friends.map(f => f.first))} joined the search` : ''}.`, 6, g.actors, 'search', '🐾', owner.x, owner.z);
    return;
  }
  if (g.phase !== 'searching') return;
  if (sim.clock > g.until) { // the dog saunters home on his own as the light fades
    g.done = true; releaseTeam(sim, g);
    sim.pet = { ...pet, state: 'home', x: -9, z: 8, spot: null };
    sim.log(`No luck after hours of searching, and then ${pet.name} trotted home on his own, tail high, entirely unrepentant.`, 5, [g.host], 'search', '🐾');
    return;
  }
  const assign: Record<string, string[]> = g.data.assign, visited: string[] = g.data.visited;
  for (const id of g.actors) {
    const v = sim.byId.get(id)!;
    if (Math.hypot(v.x - pet.x, v.z - pet.z) < 4.5) { found(sim, g, v); return; }
    const act = v.act as any;
    if (act?.type === 'idle' && act._spot && act.t > 3 && !visited.includes(act._spot)) visited.push(act._spot);
    if (v.act || v.queue.length || !free(v)) continue;
    const spot = (assign[id] ?? []).find(s => !visited.includes(s));
    if (!spot) continue; // their beat is covered; the brain takes them back to ordinary life
    const pl = sim.place(spot), [x, z] = sim.world.nav.nearestFree(pl.cx + sim.rng.range(-1.5, 1.5), pl.cz + sim.rng.range(-1.5, 1.5));
    v.queue.push({ type: 'go', x, z, t: 0, label: `searching ${pl.name} for ${pet.name}` });
    v.queue.push({ type: 'idle', dur: 6, t: 0, anim: 'point', label: `calling for ${pet.name}`, _spot: spot });
  }
}

function found(sim: Sim, g: Gathering, finder: Villager) {
  g.done = true;
  const owner = sim.byId.get(g.host)!, name = sim.pet.name;
  const where = sim.pet.spot ? sim.place(sim.pet.spot).name : 'the edge of the village';
  sim.pet = { ...sim.pet, state: 'home', x: -9, z: 8, spot: null };
  releaseTeam(sim, g);
  finder.emotions.joy = 1; finder.needs.social = 100; sim.icon(finder, '🐕');
  sim.say(finder, say(sim, finder, 'searchFound', { pet: name }), '🐕', 3);
  sim.log(`${finder.first} found ${name} hiding out near ${where} — muddy, delighted and entirely unrepentant.${finder === owner ? '' : ` ${owner.first} could have hugged ${pr(finder).obj}.`}`, 7, [finder.id, g.host], 'search', '🐕', finder.x, finder.z);
  if (finder !== owner) { nudge(owner, finder, 12); owner.mem.add(sim.clock, `${finder.first} found ${name} when he went missing. I won't forget it.`, 7, [finder.id], .8, 'feeling'); }
  for (const id of g.actors) { const u = sim.byId.get(id)!; if (u !== finder) nudge(u, finder, 4); }
  const f = sim.fact('news', `${finder.first} found ${name} the village dog safe and sound`, finder.id, finder.id, .6, 6);
  sim.witness(`${finder.first} found the village dog`, 6, g.actors, { [finder.id]: .8, '*': .3 }, finder.x, finder.z, f, 25);
  finder.queue.unshift({ type: 'idle', anim: 'cheer', dur: 8, t: 0, label: `bringing ${name} home` });
  sim.achieve(finder, 'dogfinder', 'Good Dog, Better Friend', `${finder.first} found ${name}`);
}
function releaseTeam(sim: Sim, g: Gathering) {
  for (const id of g.actors) {
    const v = sim.byId.get(id)!;
    if ((v.act as any)?._spot || /searching .* for /.test(v.act?.label ?? '')) { v.act = null; v.queue = []; }
    v.replan = true;
  }
}

// ---- town meeting ---------------------------------------------------------------------------------
interface Topic { id: string; question: string; options: string[]; about?: string }
function pickTopic(sim: Sim): Topic {
  const themes = ['the Harvest Lantern Festival', 'the Riverlights Festival', 'the Pie & Fiddle Festival', 'the Midsummer Garland Festival'].filter(t => t !== sim.festivalTheme);
  const thief = sim.villagers.filter(v => v.stats.stolen > 0 && sim.villagers.reduce((s, u) => s + (u !== v ? (u.opinion[v.id] ?? 0) : 0), 0) < 0)
    .sort((a, b) => b.stats.stolen - a.stats.stolen)[0];
  const topics: Topic[] = [
    { id: 'theme', question: 'what theme the next festival should take', options: themes },
    { id: 'bench', question: 'where the new bench should go', options: ['by the well', 'on the school green', 'under the orchard boughs'] },
  ];
  if (thief) topics.push({ id: 'pardon', question: `whether to forgive ${thief.first} for the stealing`, options: [`forgive ${thief.first}`, `let ${thief.first} earn it back first`], about: thief.id });
  return topics[(calendarFor(sim.day).week - 1) % topics.length];
}
// how much villager v likes an option: trait affinities, neighbourhood loyalty, feelings about the accused
function voteScore(sim: Sim, v: Villager, topic: string, opt: string, i: number, about: string) {
  const T = v.traits;
  if (topic === 'theme') return /Harvest/.test(opt) ? T.diligence : /Riverlights/.test(opt) ? 1 - T.temper : /Pie/.test(opt) ? T.sociability : T.kindness;
  if (topic === 'bench') {
    const d = sim.world.places.get(v.def.home)?.district;
    return /well/.test(opt) ? (d === 'old-town' ? 1 : .35) : /school/.test(opt) ? (d === 'riverside' ? 1 : .35) : (d === 'farmstead' || d === 'quarry' ? 1 : .35);
  }
  if (topic === 'pardon') { const o = (v.opinion[about] ?? 0) / 100; return i === 0 ? .4 + T.kindness * .5 + o + (v.id === about ? 1 : 0) : .45 + (1 - T.kindness) * .35 - o; }
  return .5;
}

function tickMeeting(sim: Sim, g: Gathering) {
  const p = sim.parties.find(x => x.id === g.partyId);
  if (!p || p.done) { g.done = true; return; }
  const speaker = sim.byId.get(g.host)!;
  if (g.phase === 'planned' && sim.clock >= g.at + 25) {
    if (p.attendees.size < 3) {
      if (sim.clock < g.at + 55) return; // crossing the village takes a while; give stragglers time
      g.done = true; p.until = Math.min(p.until, sim.clock + 10);
      sim.log(`Hardly anyone turned up to the town meeting; ${speaker.first} adjourned it with a sigh.`, 4, [speaker.id], 'meeting', '🏛️');
      return;
    }
    g.phase = 'pitch'; g.data.voteAt = sim.clock + 12;
    const pl = sim.place(g.place);
    p.focus = [pl.cx, pl.cz + (pl.enterable ? 2.5 : 1.2)]; p.quietUntil = g.data.voteAt + 10;
    if (p.attendees.has(speaker.id) && !speaker.act?.locked) { // the speaker steps up front to pitch
      sim.clearPlan(speaker); sim.leaveSeat(speaker);
      [speaker.x, speaker.z] = sim.world.nav.nearestFree(p.focus[0], p.focus[1]);
      speaker.heading = Math.atan2(pl.cx - speaker.x, pl.cz + 4 - speaker.z) + Math.PI;
      speaker.act = { type: 'idle', anim: 'talk', dur: 24, t: 0, label: 'addressing the meeting', locked: true, face: speaker.heading };
    }
    sim.say(speaker, say(sim, speaker, 'meetingPitch'), '🏛️', 3.5);
    sim.log(`${speaker.first} called the town meeting to order: ${g.data.question}. Everyone had opinions.`, 5, [speaker.id, ...[...p.attendees].filter(id => id !== speaker.id).slice(0, 5)], 'meeting', '🏛️');
    return;
  }
  if (g.phase === 'pitch' && sim.clock >= g.data.voteAt) {
    g.phase = 'done'; g.done = true;
    const voters = [...p.attendees].map(id => sim.byId.get(id)!), opts: string[] = g.data.options, R = sim.rng;
    const votes: Record<string, string> = {}, lead: Record<string, string> = {};
    // the influential vote first; their bloc tends to follow, and the speaker sways the friendly
    for (const v of [...voters].sort((a, b) => sim.power(b) - sim.power(a))) {
      let best = -1, bi = 0;
      for (let i = 0; i < opts.length; i++) {
        let s = voteScore(sim, v, g.data.topic, opts[i], i, g.data.about) + R.range(0, .3);
        if (v !== speaker && votes[speaker.id] === opts[i]) s += clamp(v.opinion[speaker.id] ?? 0, -40, 60) / 150;
        if (v.alliance && lead[v.alliance] === opts[i]) s += .45;
        if (s > best) { best = s; bi = i; }
      }
      votes[v.id] = opts[bi];
      if (v.alliance && lead[v.alliance] === undefined) lead[v.alliance] = opts[bi];
    }
    const tally = opts.map(o => [o, Object.values(votes).filter(x => x === o).length] as const).sort((x, y) => y[1] - x[1]);
    const [choice, n] = tally[0];
    sim.decrees.push({ day: sim.day, topic: g.data.topic, question: g.data.question, choice, votes });
    const bloc = sim.alliances.find(al => al.members.filter(m => votes[m] !== undefined).length >= 2 && al.members.every(m => votes[m] === undefined || votes[m] === choice));
    sim.log(`The town meeting voted on ${g.data.question}: "${choice}" carried, ${n} votes to ${tally[1]?.[1] ?? 0}.${bloc ? ` ${bloc.name.charAt(0).toUpperCase() + bloc.name.slice(1)} voted as one.` : ''}`, 6, [g.host, ...Object.keys(votes).filter(id => id !== g.host).slice(0, 5)], 'meeting', '🗳️');
    p.cheerUntil = sim.clock + 5; p.quietUntil = 0;
    const f = sim.fact('news', `the village voted: ${choice} (${g.data.question})`, g.host, g.host, .2, 6);
    for (const v of voters) {
      v.mem.add(sim.clock, `The meeting decided: ${choice}`, 4, [g.host], votes[v.id] === choice ? .3 : -.2, 'obs', f.id);
      v.mem.learn(f); nudge(v, speaker, votes[v.id] === choice ? 2 : -2);
    }
    if (g.data.topic === 'theme') sim.festivalTheme = choice; // the next festival-eve (and god festival) uses it
    if (g.data.topic === 'pardon' && /^forgive/i.test(choice)) {
      const th = sim.byId.get(g.data.about);
      if (th) {
        th.wanted = 0; for (const u of sim.villagers) if (u !== th) nudge(u, th, 8);
        th.emotions.joy = 1; sim.say(th, 'I… thank you. All of you.', '🥹', 3);
        sim.log(`${th.first} was publicly forgiven; ${pr(th).sub} looked close to tears.`, 5, [th.id], 'meeting', '🕊️');
      }
    }
    if (speaker.act?.label === 'addressing the meeting') speaker.act = null; // back into the crowd
  }
}
