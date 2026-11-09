import * as THREE from 'three';
import { VILLAGERS, type VillagerDef } from '../data/villagers';
import { World, type Place, type Seat } from '../world/world';
import { MemoryStream, type Fact } from '../agents/memory';
import { RNG, clamp, hourOf, dayOf, fmtTime } from '../core/util';
import type { Villager, Action, SimEvent, Alliance, Item, Inv } from './types';
import { ITEMS, ITEM_ICON, FOOD } from './types';
import type { Brain } from './brain';
import { resolveSocial, maybeOverhear } from './social';

export const MIN_PER_SEC = 2; // game minutes per world second (1x: one day = 12 real minutes)
export const BASE_PRICE: Record<Item, number> = { coins: 1, bread: 6, wheat: 3, wood: 3, ore: 4, tools: 20, eggs: 3, apples: 2, trinket: 30 };

export interface Party { id: string; host: string; title: string; place: string; at: number; until: number; invited: Set<string>; attendees: Set<string>; announced: boolean; done: boolean; fact: Fact; }
export interface GiftDrop { x: number; z: number; obj: THREE.Object3D; claimedBy: string | null; t: number; }

const stealthy = (a: Action) => a.type === 'steal';
export class Sim {
  villagers: Villager[] = []; byId = new Map<string, Villager>(); clock = 6 * 60 + 15; rng = new RNG(20261109); events: SimEvent[] = []; eid = 1;
  stock: Record<Item, number> = { coins: 0, bread: 2, wheat: 4, wood: 3, ore: 2, tools: 1, eggs: 2, apples: 3, trinket: 0 };
  alliances: Alliance[] = []; parties: Party[] = []; rain = 0; rainUntil = 0; nextWeather = 60 * 30; festivalUntil = 0; merchantUntil = 0; gifts: GiftDrop[] = [];
  listeners: { [k: string]: ((...a: any[]) => void)[] } = {}; dayStats: Record<number, SimEvent[]> = {}; achievementsGlobal = new Set<string>();
  history: { t: number; wealth: Record<string, number>; pop: Record<string, number> }[] = []; lastDay = 0; dizzy = new Map<string, number>(); brain!: Brain; factN = 1;
  constructor(public world: World) {}
  on(k: string, f: (...a: any[]) => void) { (this.listeners[k] ??= []).push(f); }
  emit(k: string, ...a: any[]) { for (const f of this.listeners[k] ?? []) f(...a); }
  get day() { return dayOf(this.clock); } get hour() { return hourOf(this.clock); }
  place(id: string) { return this.world.places.get(id)!; }

  addVillager(def: VillagerDef, avatar: any) {
    const home = this.place(def.home), inv = Object.fromEntries(ITEMS.map(i => [i, 0])) as Inv;
    inv.coins = 12 + this.rng.int(0, 10); inv.bread = 1;
    const v: Villager = { id: def.id, def, name: def.name, first: def.name.split(' ')[0], job: def.job, goal: def.goal, traits: def.traits, x: home.x, z: home.z + .5, heading: 0, speed: 1.6, path: null, pathI: 0,
      needs: { food: 70 + this.rng.range(0, 20), energy: 85, social: 50 + this.rng.range(0, 30) }, inv, opinion: {}, family: def.family ?? [], alliance: null,
      emotions: { joy: .2, anger: 0, fear: 0, sadness: 0, love: 0, surprise: 0 }, mem: new MemoryStream(), plan: [], planDay: 0, queue: [], act: null, thought: 'A new day in Thistlebrook.', doing: 'waking up',
      inside: null, busyUntil: 0, seat: null, story: [], stats: { stolen: 0, gifts: 0, trades: 0, fights: 0, parties: 0, earned: 0 }, lastSocial: {}, intent: null, avatar, anim: 'idle', replan: true, wanted: 0, achievements: new Set() };
    this.villagers.push(v); this.byId.set(v.id, v); avatar.root.position.set(v.x, 0, v.z);
    return v;
  }
  initRelations() {
    for (const a of this.villagers) for (const b of this.villagers) if (a !== b) {
      const sim = 1 - (Math.abs(a.traits.kindness - b.traits.kindness) + Math.abs(a.traits.honesty - b.traits.honesty) + Math.abs(a.traits.sociability - b.traits.sociability)) / 3;
      a.opinion[b.id] = Math.round((sim - .55) * 40 + this.rng.range(-8, 8) + (a.family.includes(b.id) ? 55 : 0));
    }
    // a little starting history so day one has texture
    const o = (a: string, b: string, v: number) => (this.byId.get(a)!.opinion[b] = v);
    o('tom', 'edgar', -18); o('edgar', 'tom', -10); o('rosa', 'jen', -22); o('jen', 'rosa', -8); o('pip', 'tom', 28); o('mara', 'wren', 42); o('wren', 'mara', 40);
  }

  // ---- narration -------------------------------------------------------------------------------
  log(text: string, imp: number, actors: string[], kind = 'misc', icon = '•', x?: number, z?: number) {
    const a0 = this.byId.get(actors[0]); text = text.charAt(0).toUpperCase() + text.slice(1);
    text = text.replace(/\b1 (apples|eggs|tools|coins|logs|trinkets)\b/g, (_m, w: string) => '1 ' + w.slice(0, -1)).replace(/\b1 loaves\b/g, '1 loaf');
    const last = this.events[this.events.length - 1];
    if (last && a0 && text.startsWith(a0.first + ' ') && last.text.startsWith(a0.first + ' ') && last.actors[0] === actors[0] && last.kind === kind && this.clock - last.t < 25 && last.kind !== 'headline' && kind !== 'headline' && last.text.length < 140 && imp >= 3 && last.imp >= 3) {
      last.text = last.text.replace(/\.$/, '') + ', then ' + text.replace(new RegExp('^' + (a0?.first ?? '') + ' '), '');
      last.imp = Math.max(last.imp, imp); last.actors = [...new Set([...last.actors, ...actors])]; this.emit('eventUpdate', last); this.story(actors, text); return last;
    }
    const ev: SimEvent = { id: this.eid++, t: this.clock, text, imp, actors, x: x ?? a0?.x ?? 0, z: z ?? a0?.z ?? 0, kind, icon };
    this.events.push(ev); if (this.events.length > 600) this.events.shift(); (this.dayStats[this.day] ??= []).push(ev);
    this.story(actors, text); this.emit('event', ev); return ev;
  }
  story(actors: string[], text: string) { for (const id of actors) { const v = this.byId.get(id); if (v) { v.story.push({ t: this.clock, text }); if (v.story.length > 80) v.story.shift(); } } }
  say(v: Villager, text: string, emoji = '', dur = 3.2) { this.emit('bubble', v, text, emoji, dur); }
  icon(v: Villager, emoji: string) { this.emit('icon', v, emoji); }
  fact(kind: Fact['kind'], text: string, actor: string, about: string, valence: number, imp: number, target?: string): Fact { return { id: `f${this.factN++}`, kind, text, actor, about, target, valence, imp, t: this.clock, origin: actor }; }
  // Everyone nearby (and the participants) remembers what happened.
  witness(text: string, imp: number, about: string[], valence: Record<string, number>, x: number, z: number, fact?: Fact, radius = 14) {
    for (const w of this.villagers) {
      if (w.inside && !about.includes(w.id)) continue;
      const d = Math.hypot(w.x - x, w.z - z); if (d > radius && !about.includes(w.id)) continue;
      const val = valence[w.id] ?? valence['*'] ?? 0;
      w.mem.add(this.clock, text, imp, about, val, 'obs', fact?.id); if (fact) w.mem.learn(fact);
    }
  }
  achieve(v: Villager | null, key: string, title: string, desc: string) {
    const k = v ? `${v.id}:${key}` : key; if (this.achievementsGlobal.has(k)) return; this.achievementsGlobal.add(k); v?.achievements.add(key);
    this.emit('achievement', { title, desc, who: v?.id });
  }

  // ---- inventory & market -----------------------------------------------------------------------
  price(i: Item, buy: boolean) { const b = BASE_PRICE[i], s = this.stock[i]; return buy ? Math.max(1, Math.round(b * (1 + .15 * Math.max(0, 3 - s)) * (this.festivalUntil > this.clock ? 1.1 : 1))) : Math.max(1, Math.round(b * .75 * (s > 8 ? .7 : 1) * (this.merchantUntil > this.clock ? 1.3 : 1))); }
  give(from: Villager | null, to: Villager | null, item: Item, n: number) { if (from) from.inv[item] -= n; if (to) to.inv[item] += n; if (to && item === 'coins') to.stats.earned += n; }
  carryFor(v: Villager) { const o: [Item, string][] = [['wood', 'wood'], ['ore', 'ore'], ['wheat', 'wheat'], ['bread', 'bread'], ['eggs', 'eggs'], ['apples', 'apples']]; for (const [i, k] of o) if (v.inv[i] >= (i === 'bread' ? 3 : 2)) return k; return v.inv.tools > 1 ? 'tools' : ''; }
  wealth(v: Villager) { return v.inv.coins + ITEMS.filter(i => i !== 'coins').reduce((s, i) => s + v.inv[i] * BASE_PRICE[i] * .6, 0); }
  popularity(v: Villager) { const o = this.villagers.filter(x => x !== v).map(x => x.opinion[v.id] ?? 0); return o.reduce((a, b) => a + b, 0) / Math.max(1, o.length); }
  power(v: Villager) { const al = v.alliance ? this.alliances.find(a => a.id === v.alliance)!.members.length - 1 : 0; const fans = this.villagers.filter(x => x !== v && (x.opinion[v.id] ?? 0) > 35).length; const feared = this.villagers.filter(x => x !== v && (x.opinion[v.id] ?? 0) < -40).length; return Math.round(al * 12 + fans * 8 + feared * 3 + v.inv.coins / 8 + v.stats.fights * 2); }

  // ---- movement -------------------------------------------------------------------------------
  goTo(v: Villager, x: number, z: number) { v.path = this.world.nav.findPath(v.x, v.z, x, z) ?? [[x, z]]; v.pathI = 0; }
  stepMove(v: Villager, dt: number, speed: number) {
    if (!v.path) return true; const p = v.path[v.pathI]; if (!p) { v.path = null; return true; }
    const dx = p[0] - v.x, dz = p[1] - v.z, d = Math.hypot(dx, dz), st = speed * dt;
    if (d <= st) { v.x = p[0]; v.z = p[1]; v.pathI++; if (v.pathI >= v.path.length) { v.path = null; return true; } }
    else { v.x += dx / d * st; v.z += dz / d * st; v.heading = Math.atan2(dx, dz); }
    return false;
  }
  near(v: Villager, x: number, z: number, r = 1) { return Math.hypot(v.x - x, v.z - z) <= r; }

  // ---- seats -------------------------------------------------------------------------------
  takeSeat(v: Villager, place: string): Seat | null { const s = this.world.seatsFor(place).filter(s => !s.taken).sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z))[0]; if (s) { s.taken = v.id; v.seat = s; } return s ?? null; }
  leaveSeat(v: Villager) { if (v.seat) { v.seat.taken = null; v.seat = null; } }

  // ---- main step --------------------------------------------------------------------------------
  step(dt: number) {
    const gdt = dt * MIN_PER_SEC; this.clock += gdt;
    const d = this.day; if (d !== this.lastDay && this.hour >= 6) { if (this.lastDay) { this.emit('dawn', this.lastDay); this.dawnMarket(); } this.lastDay = d; for (const v of this.villagers) v.replan = true; this.snapshot(); }
    this.weather(gdt); this.world.simTick(gdt, this.clock);
    for (const p of this.parties) this.partyTick(p);
    for (const g of this.gifts) g.t += gdt;
    for (const v of this.villagers) this.tickVillager(v, dt, gdt);
    this.separate(dt);
    if (Math.floor(this.clock / 60) !== Math.floor((this.clock - gdt) / 60)) this.snapshot();
  }
  // overnight: surplus is carted off to other towns, and a little food arrives (keeps prices moving)
  dawnMarket() { for (const i of ITEMS) if (this.stock[i] > 6) this.stock[i] = 6 + Math.floor((this.stock[i] - 6) * .3); this.stock.bread += 1; this.stock.eggs += 2; this.stock.wheat += 2; }
  // light local avoidance so people standing around don't merge into each other
  separate(dt: number) {
    const vs = this.villagers, R = .62;
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
      const a = vs[i], b = vs[j]; if (a.inside || b.inside || a.seat || b.seat) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d >= R) continue;
      const push = Math.min((R - d) * .5, dt * 1.5), nx = d > 1e-3 ? dx / d : 1, nz = d > 1e-3 ? dz / d : 0;
      const am = a.path ? .3 : 1, bm = b.path ? .3 : 1;
      if (this.world.nav.isFree(a.x - nx * push * am, a.z - nz * push * am)) { a.x -= nx * push * am; a.z -= nz * push * am; }
      if (this.world.nav.isFree(b.x + nx * push * bm, b.z + nz * push * bm)) { b.x += nx * push * bm; b.z += nz * push * bm; }
    }
  }
  snapshot() { this.history.push({ t: this.clock, wealth: Object.fromEntries(this.villagers.map(v => [v.id, Math.round(this.wealth(v))])), pop: Object.fromEntries(this.villagers.map(v => [v.id, Math.round(this.popularity(v))])) }); if (this.history.length > 24 * 14) this.history.shift(); }
  weather(gdt: number) {
    if (this.clock > this.nextWeather) { this.nextWeather = this.clock + this.rng.range(8, 20) * 60; if (this.rain < .5 && this.rng.chance(.3)) this.startRain(this.rng.range(90, 200)); }
    const target = this.clock < this.rainUntil ? 1 : 0; this.rain += (target - this.rain) * Math.min(1, gdt / 30);
    if (this.rain > .5) for (const p of this.world.plots) if (p.stage === 'growing') p.water = Math.min(1, p.water + gdt / 120);
  }
  startRain(mins: number, byViewer = false) { this.rainUntil = this.clock + mins; this.log(byViewer ? 'A summoned storm rolled over Thistlebrook. Everyone ran for cover.' : 'Rain clouds rolled in over Thistlebrook.', byViewer ? 6 : 3, [], 'weather', '🌧️', -9, 0); for (const v of this.villagers) { v.replan = true; if (!v.inside) { v.emotions.sadness += .2; } } }

  tickVillager(v: Villager, dt: number, gdt: number) {
    const n = v.needs, asleep = v.inside && v.doing === 'sleeping';
    n.food = clamp(n.food - gdt * (asleep ? .025 : .055), 0, 100); n.energy = clamp(n.energy + gdt * (asleep ? .16 : v.anim === 'sit' ? .02 : -.06), 0, 100); n.social = clamp(n.social - gdt * (asleep ? .005 : .04), 0, 100);
    for (const k of Object.keys(v.emotions) as (keyof Villager['emotions'])[]) v.emotions[k] = clamp(v.emotions[k] - gdt * .004 * (k === 'anger' ? (1.3 - v.traits.temper) : k === 'surprise' ? 5 : k === 'love' ? 2 : k === 'joy' ? 1.5 : 1), 0, 1);
    if (this.rain > .5 && !v.inside) v.emotions.sadness = Math.min(.5, v.emotions.sadness + gdt * .001);
    if (n.food < 15) v.emotions.sadness = Math.max(v.emotions.sadness, .4);
    // reflection (Smallville): when enough has happened, or at bedtime
    if (v.mem.impSinceReflect > 38 || (asleep && this.clock - v.mem.lastReflect > 600 && v.mem.impSinceReflect > 10)) this.brain.reflect(v, this);
    if (v.replan && !v.act?.locked) { this.brain.planDay(v, this); v.replan = false; }
    if (this.clock < v.busyUntil) { v.anim = v.anim === 'walk' || v.anim === 'run' ? 'talk' : v.anim; return; }
    if (!v.act) { v.act = v.queue.shift() ?? null; if (!v.act) { this.brain.choose(v, this); v.act = v.queue.shift() ?? null; } if (v.act) { v.act.t = 0; v.doing = v.act.label; } }
    if (v.act) { const done = this.run(v, v.act, dt, gdt); if (done) { v.act = null; } }
  }

  // ---- action executor ------------------------------------------------------------------------
  run(v: Villager, a: Action, dt: number, gdt: number): boolean {
    a.t += gdt; const sp = (a.run ? 3.7 : v.speed * (v.needs.energy < 15 ? .7 : 1));
    const walk = (x: number, z: number, r = .25) => { if (!a._p) { this.goTo(v, x, z); a._p = 1; } if (this.near(v, x, z, r) || this.stepMove(v, dt, sp)) { v.path = null; return true; } v.anim = a.run ? 'run' : 'walk'; return false; };
    switch (a.type) {
      case 'go': { if (a.t > 240) return true; if (walk(a.x, a.z, a.r ?? .3)) { v.anim = 'idle'; return true; } return false; }
      case 'idle': { v.anim = a.anim ?? 'idle'; if (a.face !== undefined) v.heading = a.face; if (a.t >= a.dur) { a.after?.(this); return true; } return false; }
      case 'eat': { v.anim = 'pickup'; if (!a._e) { a._e = 1; const it = a.item as Item; if (v.inv[it] > 0) { v.inv[it]--; v.needs.food = clamp(v.needs.food + (FOOD[it] ?? 10), 0, 100); v.emotions.joy += .1; this.say(v, this.rng.pick(['Mmm!', 'Delicious.', 'Just what I needed.']), ITEM_ICON[it], 2); } } return a.t >= 12; }
      case 'enter': {
        const p = this.place(a.place);
        if (!a._in) { if (!walk(p.x, p.z, .4)) return false; a._in = 1; a.t0 = this.clock; v.inside = p.id; p.inside.add(v.id); v.avatar.targetAlpha = 0; v.anim = 'idle'; v.heading = Math.PI; a.onEnter?.(v, this); }
        const until = a.until ?? (a.t0 + a.dur);
        if (a.smoke) p.smokeUntil = Math.max(p.smokeUntil, this.clock + 5);
        if (this.clock >= until || a.interrupt) { v.inside = null; p.inside.delete(v.id); v.avatar.targetAlpha = 1; v.z = p.z + .4; a.onExit?.(v, this); return true; }
        return false;
      }
      case 'sit': {
        if (!a._s) { const s = a.seat as Seat; if (!walk(s.x + Math.sin(s.rot) * .55, s.z + Math.cos(s.rot) * .55, .3)) return false; a._s = 1; v.x = s.x; v.z = s.z; v.heading = s.rot; }
        v.anim = a.anim2 && Math.sin(a.t * .2) > .3 ? a.anim2 : 'sit'; if (a.t >= a.dur || a.interrupt) { this.leaveSeat(v); const s = a.seat as Seat; v.x = s.x + Math.sin(s.rot) * .6; v.z = s.z + Math.cos(s.rot) * .6; v.anim = 'idle'; return true; } return false;
      }
      case 'work': return this.work(v, a, dt, walk);
      case 'trade_market': return this.marketTrade(v, a, walk);
      case 'social': case 'steal': return this.socialAct(v, a, dt, gdt, walk);
      case 'flee': { const p = this.place(a.place); v.anim = 'run'; if (!a._p) { this.goTo(v, p.x, p.z); a._p = 1; } if (this.stepMove(v, dt, 3.9) || a.t > 120) { return true; } return false; }
      case 'chase': {
        const t = this.byId.get(a.target)!; if (a.t < 0) { v.anim = 'idle'; v.heading = Math.atan2(t.x - v.x, t.z - v.z); return false; } if (!a._p || a.t - (a._rp ?? 0) > 3) { this.goTo(v, t.x, t.z); a._p = 1; a._rp = a.t; } v.anim = 'run'; this.stepMove(v, dt, 3.6 + v.traits.bravery * .4);
        if (Math.hypot(t.x - v.x, t.z - v.z) < 1.3) { this.caught(v, t); return true; }
        if (a.t > 50 || t.inside) { this.say(v, 'Coward! I know it was you!', '💢'); v.emotions.anger = 1; this.log(`${t.first} got away from ${v.first}.`, 5, [t.id, v.id], 'theft', '💨'); return true; }
        return false;
      }
      case 'fight': { v.anim = 'fight'; if (a.t >= a.dur) return true; if (Math.random() < dt * 6) this.world.fx.dust(v.x + (Math.random() - .5), v.z + (Math.random() - .5), 3, 1.1); return false; }
      case 'attend': return this.attend(v, a, dt, walk);
      case 'claim': {
        const g = this.gifts.find(x => x === a.gift); if (!g || g.claimedBy) { if (g?.claimedBy && g.claimedBy !== v.id) { v.emotions.sadness += .2; v.emotions.anger += .2; this.say(v, 'Aww, too slow!', '😤', 2); } return true; }
        a.run = true; if (!walk(g.x, g.z, .9)) return false;
        g.claimedBy = v.id; g.obj.visible = false; v.inv.coins += 15; v.inv.trinket += 1; v.emotions.joy = 1; v.emotions.surprise = .8; this.world.fx.coinBurst(g.x, .5, g.z, 10); this.world.fx.sparkle(g.x, .5, g.z, [1, .8, .4], 20);
        this.say(v, 'A gift from the heavens!', '🎁', 3); v.anim = 'cheer'; this.log(`${v.first} found a mysterious gift: 15 coins and a sparkling trinket!`, 6, [v.id], 'god', '🎁', g.x, g.z);
        this.witness(`${v.first} grabbed the mysterious gift`, 4, [v.id], { [v.id]: .5, '*': -.1 }, g.x, g.z, undefined, 20);
        v.queue.unshift({ type: 'idle', anim: 'cheer', dur: 8, t: 0, label: 'celebrating' }); return true;
      }
    }
    return true;
  }

  work(v: Villager, a: Action, dt: number, walk: (x: number, z: number, r?: number) => boolean) {
    const gdtW = dt * MIN_PER_SEC;
    const W = this.world, fx = W.fx, av = v.avatar;
    if (!a._at) { if (!walk(a.x, a.z, .35)) return false; a._at = 1; v.heading = Math.atan2(a.fx - v.x, a.fz - v.z); av.onHit = null; }
    v.heading = Math.atan2(a.fx - v.x, a.fz - v.z);
    // strikes are driven by game time (not by animation frames) so work output is identical at any speed or headless
    const strike = (every: number) => { a._h = (a._h ?? 0) + gdtW; if (a._h >= every) { a._h -= every; av.onHit?.(); av.phase = Math.floor(av.phase / 1.35) * 1.35 + 1.2; } };
    switch (a.kind) {
      case 'chop': {
        const tr = a.target; v.anim = 'chop'; av.setTool('axe');
        av.onHit = () => { if (tr.state !== 'standing') return; tr.shake = 1; fx.chips(tr.x + (v.x - tr.x) * .4, 1.0, tr.z + (v.z - tr.z) * .4, [.85, .65, .4], 7); tr.hp -= v.inv.tools > 0 ? 1.5 : 1; this.emit('sound', 'chop', tr.x, tr.z);
          if (tr.hp <= 0) { tr.state = 'falling'; tr.t = 0; tr.fallDir = Math.atan2(tr.x - v.x, tr.z - v.z); this.say(v, 'Timber!', '🪓', 2.5); this.emit('sound', 'fall', tr.x, tr.z); a.fellAt = a.t; } };
        if (tr.state === 'standing') strike(2.7);
        if (tr.state === 'falling' && a.t - (a.fellAt ?? a.t) > 6) { tr.state = 'stump'; tr.obj.visible = false; tr.stump.visible = true; tr.regrowAt = this.clock + 1440; }
        if (tr.state === 'stump') { av.onHit = null; v.inv.wood += 3; this.wear(v, 'axe'); tr.claimed = null; av.setTool(''); this.log(`${v.first} felled a tree in the west woods and hauled off 3 logs.`, 3, [v.id], 'work', '🪓'); this.achieve(v, 'timber', 'Timber!', `${v.first} felled their first tree`); v.emotions.joy += .2; return true; }
        return a.t > 150;
      }
      case 'mine': {
        const r = a.target; v.anim = 'mine'; av.setTool('pickaxe');
        av.onHit = () => { if (r.state !== 'solid') return; r.shake = 1; fx.sparks(r.x + (v.x - r.x) * .35, .7, r.z + (v.z - r.z) * .35, 8); fx.chips(r.x, .6, r.z, [.55, .55, .58], 4); r.hp -= v.inv.tools > 0 ? 1.4 : 1; a.hits = (a.hits ?? 0) + 1; this.emit('sound', 'mine', r.x, r.z);
          r.obj.scale.setScalar(r.baseScale * (.45 + .55 * Math.max(0, r.hp) / r.maxHp)); if (a.hits % 3 === 0) v.inv.ore += 1;
          if (r.hp <= 0) { r.state = 'gone'; r.obj.visible = false; r.regrowAt = this.clock + 1800; fx.dust(r.x, r.z, 18); } };
        if (r.state === 'solid') strike(2.7);
        if (r.state !== 'solid' || a.t > 120) { av.onHit = null; r.claimed = null; this.wear(v, 'pickaxe'); av.setTool(''); this.log(`${v.first} chipped ore out of the quarry rock (${v.inv.ore} ore in the sack).`, 2, [v.id], 'work', '⛏️'); return true; }
        return false;
      }
      case 'plant': { v.anim = 'hoe'; av.setTool('hoe'); av.onHit = () => fx.chips(a.fx, .5, a.fz, [.45, .32, .2], 4); strike(3.1); if (a.t > 50) { a.target.stage = 'growing'; a.target.growth = 0; a.target.claimed = null; av.setTool(''); av.onHit = null; this.log(`${v.first} sowed a field with wheat.`, 2, [v.id], 'work', '🌱'); return true; } return false; }
      case 'water': { v.anim = 'water'; av.setTool('can'); if (Math.random() < dt * 10) fx.water(v.x + Math.sin(v.heading) * .8, .9, v.z + Math.cos(v.heading) * .8, Math.sin(v.heading), Math.cos(v.heading)); if (a.t > 30) { a.target.water = 1; a.target.claimed = null; av.setTool(''); return true; } return false; }
      case 'harvest': { v.anim = 'pickup'; if (a.t > 45) { const p = a.target; p.stage = 'empty'; p.growth = 0; p.claimed = null; v.inv.wheat += 5; fx.chips(p.x, .8, p.z, [.95, .8, .35], 14); this.log(`${v.first} harvested a field of golden wheat.`, 3, [v.id], 'work', '🌾'); this.achieve(v, 'harvest', 'Bumper Harvest', `${v.first} brought in the first harvest`); v.emotions.joy += .3; return true; } return false; }
      case 'feed': { v.anim = 'feed'; av.setTool('basket'); if (!a._f) { a._f = 1; W.feedAnimals(); } if (Math.random() < dt * 3) fx.grain(v.x + Math.sin(v.heading) * .5, 1.1, v.z + Math.cos(v.heading) * .5, Math.sin(v.heading), Math.cos(v.heading)); if (a.t > 40) { v.inv.eggs += 4; av.setTool(''); this.log(`${v.first} fed the hens and collected 4 eggs.`, 2, [v.id], 'work', '🐔'); a.target.eggDay = this.day; return true; } return false; }
      case 'pick': { const t = a.target; v.anim = 'pickup'; if (a.t > 20) { const n = Math.min(t.apples, 3); t.apples -= n; t.t = 0; v.inv.apples += n; t.claimed = null; return true; } return false; }
      case 'forge0': { // odd jobs while short of iron: sharpen a neighbour's blade for a few coins (keeps the smith solvent)
        v.anim = 'hammer'; av.setTool('hammer'); av.onHit = () => { fx.sparks(a.fx, .75, a.fz, 6); this.emit('sound', 'anvil', a.fx, a.fz); }; strike(2.5);
        if (a.t > 40) { av.onHit = null; av.setTool(''); const cust = this.villagers.filter(u => u !== v && u.inv.coins >= 8 && ['woodcutter', 'miner', 'farmer', 'baker', 'shepherd'].includes(u.job)).sort((x, y) => y.inv.coins - x.inv.coins)[0];
          if (cust) { const fee = 5; cust.inv.coins -= fee; v.inv.coins += fee; v.stats.earned += fee; const what = ({ woodcutter: 'axe', miner: 'pickaxe', farmer: 'hoe', baker: 'bread knife', shepherd: 'shears' } as any)[cust.job]; this.log(`${v.first} sharpened ${cust.first}'s ${what} for ${fee} coins.`, 2, [v.id, cust.id], 'work', '⚒️'); }
          return true; } return false; }
      case 'forge': { v.anim = 'hammer'; av.setTool('hammer'); av.onHit = () => { fx.sparks(a.fx, .75, a.fz, 12); this.emit('sound', 'anvil', a.fx, a.fz); }; strike(2); this.place('smithy').smokeUntil = this.clock + 5;
        if (a.t > 60) { av.onHit = null; av.setTool(''); v.inv.ore -= 2; v.inv.wood -= 1; v.inv.tools += 1; this.log(`${v.first} forged a new tool at the anvil.`, 3, [v.id], 'work', '⚒️'); return true; } return false; }
      case 'serve': { v.anim = a.t % 30 < 15 ? 'talk' : 'wave'; return a.t > a.dur; }
      case 'stall': { v.anim = Math.sin(a.t * .3) > .5 ? 'wave' : 'idle'; if (Math.random() < dt * .4) this.say(v, this.rng.pick(['Fresh goods!', 'Best prices in town!', 'Bargains! Bargains!', 'Come, come!']), '📣', 2.5); return a.t > a.dur; }
    }
    return true;
  }

  marketTrade(v: Villager, a: Action, walk: (x: number, z: number, r?: number) => boolean) {
    const p = this.place(a.place ?? 'market'); if (!a._at) { if (!walk(p.x + (a.off ?? 0), p.z + .3, .5)) return false; a._at = 1; v.heading = Math.PI; }
    v.anim = 'give';
    if (a.t > 18 && !a._done) {
      a._done = 1; let earned = 0, bought: string[] = [], sold: string[] = [];
      for (const [it, n] of (a.sell ?? []) as [Item, number][]) { const k = Math.min(n, v.inv[it]); if (k <= 0) continue; const pr = Math.round(this.price(it, false) * (v.job === 'merchant' ? 1.3 : 1)) * k; v.inv[it] -= k; this.stock[it] += k; v.inv.coins += pr; v.stats.earned += pr; earned += pr; sold.push(`${k} ${it}`); }
      for (const [it, n] of (a.buy ?? []) as [Item, number][]) { for (let i = 0; i < n; i++) { const pr = this.price(it, true); if (v.inv.coins < pr || this.stock[it] <= 0) break; v.inv.coins -= pr; this.stock[it]--; v.inv[it]++; bought.push(it); } }
      if (earned) { this.world.fx.coinBurst(v.x, 1.4, v.z, Math.min(12, 3 + Math.round(earned / 4))); this.say(v, `+${earned} coins!`, '🪙', 2.5); this.emit('sound', 'coins', v.x, v.z); }
      const jen = this.byId.get('jen'); if (jen && jen !== v && (earned || bought.length) && Math.hypot(jen.x - p.x, jen.z - p.z) < 7) { const c = Math.max(1, Math.round((earned + bought.length * 5) * .12)); jen.inv.coins += c; jen.stats.earned += c; }
      if (sold.length || bought.length) this.log(`${v.first} ${sold.length ? 'sold ' + sold.join(', ') + ' at ' + p.name : ''}${sold.length && bought.length ? ' and ' : ''}${bought.length ? 'bought ' + this.countList(bought) : ''}.`.replace(/^(\w+) bought/, '$1 bought'), earned > 20 ? 3 : 2, [v.id], 'trade', '🪙');
      if (v.inv.coins >= 100) this.achieve(v, 'tycoon', 'Tycoon', `${v.first} has 100 coins`);
    }
    return a.t > 26;
  }
  wear(v: Villager, what: string) { if (v.inv.tools > 0 && this.rng.chance(.12)) { v.inv.tools--; this.say(v, `My ${what} snapped!`, '💥', 2.5); v.emotions.surprise = .8; v.emotions.sadness += .2; this.log(`${v.first}'s ${what} snapped in half. Time to visit the smithy.`, 3, [v.id], 'work', '💥'); } }
  countList(items: string[]) { const c: Record<string, number> = {}; for (const i of items) c[i] = (c[i] ?? 0) + 1; return Object.entries(c).map(([k, n]) => `${n} ${k}`).join(', '); }

  socialAct(v: Villager, a: Action, dt: number, gdt: number, walk: (x: number, z: number, r?: number) => boolean) {
    const t = this.byId.get(a.target); if (!t) return true;
    if (!a._met) {
      if (t.inside || a.t > (stealthy(a) ? 120 : 90)) { if (a.kind === 'invite' || a.kind === 'gift') v.lastSocial[t.id] = this.clock - 60; return true; }
      const stealth = a.type === 'steal', dT = Math.hypot(t.x - v.x, t.z - v.z);
      if (!a._p || a.t - (a._rp ?? 0) > 2.5) { const ang = stealth ? t.heading + Math.PI : Math.atan2(v.x - t.x, v.z - t.z); this.goTo(v, t.x + Math.sin(ang) * 1.3, t.z + Math.cos(ang) * 1.3); a._p = 1; a._rp = a.t; }
      v.anim = 'walk'; this.stepMove(v, dt, stealth ? (dT < 4 ? 1.4 : 2.2) : v.speed * 1.1);
      if (Math.hypot(t.x - v.x, t.z - v.z) < 1.9) {
        if ((!stealth && this.clock < t.busyUntil) || t.act?.type === 'fight' || t.act?.type === 'flee' || t.act?.type === 'chase') { if (a.t > 60) return true; v.anim = 'idle'; return false; }
        a._met = 1; a.t1 = a.t; v.path = null; this.leaveSeat(v);
        const dur = resolveSocial(this, v, t, a);
        v.heading = Math.atan2(t.x - v.x, t.z - v.z); if (!a._noFace) t.heading = Math.atan2(v.x - t.x, v.z - t.z); t.avatar.targetHeading = t.heading;
        if (a.type !== 'steal') { t.busyUntil = this.clock + dur; t.anim = 'talk'; } a.dur = dur;
        maybeOverhear(this, v, t);
      }
      return false;
    }
    if (a.type !== 'steal') v.anim = a.anim ?? 'talk';
    if (a.t - a.t1 >= a.dur) { a.after?.(this); return true; }
    return false;
  }
  caught(v: Villager, thief: Villager) {
    this.leaveSeat(thief);
    const fight = v.traits.bravery + v.traits.temper * .5 > .9 || thief.traits.temper > .6;
    if (fight) this.startFight(v, thief, `${v.first} caught ${thief.first} and they tumbled into a scuffle`);
    else { const item = (thief.act?.loot ?? 'coins') as Item, n = Math.min(thief.inv[item], thief.act?.lootN ?? 3); if (n > 0) this.give(thief, v, item, n); this.say(thief, 'Okay, okay! Take it back!', '😰'); thief.emotions.fear = .9; this.say(v, 'Thief!', '💢'); this.log(`${v.first} caught ${thief.first} and took back what was stolen.`, 7, [v.id, thief.id], 'theft', '🫳'); thief.act = null; thief.queue = []; }
    v.opinion[thief.id] = Math.max(-100, (v.opinion[thief.id] ?? 0) - 25);
  }
  startFight(a: Villager, b: Villager, why: string) {
    for (const x of [a, b]) { x.act = { type: 'fight', dur: 14, t: 0, label: 'scuffling', target: x === a ? b.id : a.id, locked: true }; x.queue = []; x.path = null; x.emotions.anger = 1; this.leaveSeat(x); }
    a.heading = Math.atan2(b.x - a.x, b.z - a.z); b.heading = Math.atan2(a.x - b.x, a.z - b.z); a.avatar.targetHeading = a.heading; b.avatar.targetHeading = b.heading;
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2; this.world.fx.dust(mx, mz, 30, 1.6); this.emit('sound', 'scuffle', mx, mz);
    this.say(a, this.rng.pick(['That\u2019s it!', 'You asked for it!', 'Come here!']), '💢'); this.say(b, this.rng.pick(['Get off me!', 'Hey!', 'Oof!']), '💥');
    const sa = a.traits.bravery + a.def.height * .3 + this.rng.range(0, .6), sb = b.traits.bravery + b.def.height * .3 + this.rng.range(0, .6), [w, l] = sa >= sb ? [a, b] : [b, a];
    const ev = this.log(`${why}. A cloud of dust later, ${w.first} came out on top.`, 8, [a.id, b.id], 'fight', '💥', mx, mz);
    a.stats.fights++; b.stats.fights++; this.achieve(null, 'first-fight', 'Village Brawl', `${a.first} vs ${b.first}`);
    this.dizzy.set(l.id, this.clock + 60); l.emotions.sadness = .7; l.emotions.anger = .8; w.emotions.joy = .4;
    l.queue.push({ type: 'idle', anim: 'sad', dur: 20, t: 0, label: 'nursing bruised pride' });
    const f = this.fact('deed', `${a.first} and ${b.first} came to blows (${w.first} won)`, a.id, b.id, -.6, 7, b.id); (f as any).label = 'the brawl';
    this.witness(`${a.first} and ${b.first} got into a fight`, 7, [a.id, b.id], { [a.id]: -.8, [b.id]: -.8, '*': -.3 }, mx, mz, f, 16);
    a.opinion[b.id] = Math.max(-100, (a.opinion[b.id] ?? 0) - 20); b.opinion[a.id] = Math.max(-100, (b.opinion[a.id] ?? 0) - 20);
    a.lastSocial[b.id] = b.lastSocial[a.id] = this.clock + 600; // steer clear of each other for a while
    for (const al of this.alliances) { if (al.members.includes(l.id)) for (const m of al.members) { const mv = this.byId.get(m)!; if (mv !== l) mv.opinion[w.id] = (mv.opinion[w.id] ?? 0) - 15; } }
    return ev;
  }

  // ---- parties (emergent group events) -------------------------------------------------------------------
  partyTick(p: Party) {
    if (p.done) return;
    if (!p.announced && this.clock >= p.at - 10) { p.announced = true; }
    if (this.clock >= p.at && this.clock < p.until) {
      for (const id of p.invited) { const v = this.byId.get(id)!; if (p.attendees.has(id) || v.act?.type === 'attend' || v.act?.locked) continue;
        if (!(p as any).decided) (p as any).decided = new Map<string, boolean>(); const dec = (p as any).decided as Map<string, boolean>;
        if (!dec.has(id)) dec.set(id, id === p.host || this.festivalUntil > this.clock || this.rng.chance(.35 + v.traits.sociability * .45 + (v.opinion[p.host] ?? 0) / 120 - (v.needs.energy < 25 ? .3 : 0)));
        if (dec.get(id)) { if (v.act && v.act.type !== 'enter') { this.leaveSeat(v); } if (v.act?.type === 'enter' && v.doing === 'sleeping') continue; v.act = null; v.queue = [{ type: 'attend', party: p.id, t: 0, label: `at ${p.title}` }]; } }
    }
    if (this.clock >= p.until) {
      p.done = true; const host = this.byId.get(p.host)!; const n = p.attendees.size;
      for (const id of p.attendees) { const v = this.byId.get(id)!; if (v !== host) { v.opinion[host.id] = Math.min(100, (v.opinion[host.id] ?? 0) + 6); } v.needs.social = 100; v.stats.parties++; if (v.act?.type === 'attend') v.act = null; this.leaveSeat(v); }
      if (n >= 2) { this.log(`${p.title} wound down — ${n} villagers came${n >= 5 ? '. The whole village is talking about it' : ''}.`, n >= 5 ? 7 : 5, [host.id, ...p.attendees], 'party', '🎉', this.place(p.place).x, this.place(p.place).z); if (n >= 5) this.achieve(host, 'party', 'Life of the Party', `${host.first}'s gathering drew ${n} guests`); }
      else this.log(`Hardly anyone showed up to ${p.title}. ${host.first} looked crestfallen.`, 5, [host.id], 'party', '😞');
      if (n < 2) { host.emotions.sadness = .8; host.mem.add(this.clock, `Nobody came to my ${p.title}`, 7, [host.id], -.8); }
    }
  }
  attend(v: Villager, a: Action, dt: number, walk: (x: number, z: number, r?: number) => boolean) {
    const p = this.parties.find(x => x.id === a.party); if (!p || p.done) { this.leaveSeat(v); return true; }
    const pl = this.place(p.place);
    if (!a._at) {
      if (!a.seat && !a.spot) { a.seat = p.place === 'campfire' ? this.takeSeat(v, 'campfire') : (p.place === 'plaza' ? this.takeSeat(v, 'bench') : null); if (!a.seat) { const ang = this.rng.range(0, 6.28), r = p.place === 'campfire' ? 3.4 : 2.2 + this.rng.range(0, 1.5); a.spot = [pl.cx + Math.sin(ang) * r, pl.cz + 2.5 + Math.cos(ang) * r]; if (p.place === 'tavern') a.spot = [pl.x + this.rng.range(-3.5, 3.5), pl.z + this.rng.range(.5, 3)]; a.spot = this.world.nav.nearestFree(a.spot[0], a.spot[1]); } }
      const [x, z] = a.seat ? [a.seat.x + Math.sin(a.seat.rot) * .55, a.seat.z + Math.cos(a.seat.rot) * .55] : a.spot;
      if (!walk(x, z, .35)) return false; a._at = 1; p.attendees.add(v.id); if (a.seat) { v.x = a.seat.x; v.z = a.seat.z; v.heading = a.seat.rot; }
      if (v.id !== p.host) { const host = this.byId.get(p.host)!; this.say(v, this.rng.pick([`Thanks for having me, ${host.first}!`, 'What a night!', 'Save me a seat!', 'I brought my appetite.']), this.rng.pick(['🎉', '🍻', '😄'])); }
      else this.say(v, this.rng.pick(['Welcome, welcome!', 'Everyone grab a seat!', 'Let the fun begin!']), '🎉');
    }
    const host = this.byId.get(p.host)!;
    if (!a.seat) { v.heading = Math.atan2(pl.cx - v.x, (p.place === 'campfire' ? pl.cz : pl.cz + 4) - v.z); }
    const k = Math.floor(a.t / 12) % 4; v.anim = a.seat ? (k === 2 ? 'talk' : 'sit') : (this.festivalUntil > this.clock || p.title.includes('dance') ? (k % 2 ? 'dance' : 'cheer') : (k === 1 ? 'talk' : k === 3 ? 'drink' : 'idle'));
    if (a.seat) { v.x = a.seat.x; v.z = a.seat.z; v.heading = a.seat.rot; }
    v.needs.social = Math.min(100, v.needs.social + dt * 2); v.emotions.joy = Math.min(1, v.emotions.joy + dt * .02);
    if (Math.random() < dt * .05) { const others = [...p.attendees].filter(x => x !== v.id); if (others.length) { const o = this.byId.get(this.rng.pick(others))!; v.opinion[o.id] = Math.min(100, (v.opinion[o.id] ?? 0) + 1); this.say(v, this.rng.pick(['Ha! Good one.', `Cheers, ${o.first}!`, 'Remember last spring?', 'More cider!', 'La la laaa~', ...v.def.catchphrases]), this.rng.pick(['😄', '🍻', '🎶', '😂'])); } }
    if (v.id === host.id && !a._fed && a.t > 30) { a._fed = 1; const food = Math.min(host.inv.bread + host.inv.apples, 4); host.inv.coins = Math.max(0, host.inv.coins - 6); for (const id of p.attendees) this.byId.get(id)!.needs.food = Math.min(100, this.byId.get(id)!.needs.food + 25); this.say(host, food ? 'Food for everyone!' : 'Drinks are on me!', '🍲'); }
    return false;
  }
  scheduleParty(host: Villager, title: string, place: string, at: number, dur = 150) {
    const f = this.fact('invite', `${host.first} is hosting ${title} at ${this.place(place).name} at ${fmtTime(at)}`, host.id, host.id, .3, 5);
    f.event = { host: host.id, place, at, title };
    const p: Party = { id: f.id, host: host.id, title, place, at, until: at + dur, invited: new Set([host.id]), attendees: new Set(), announced: false, done: false, fact: f };
    this.parties.push(p); host.mem.learn(f); host.mem.add(this.clock, `I decided to host ${title} at ${this.place(place).name} tonight`, 6, [host.id], .5, 'plan', f.id);
    this.log(`${host.first} is planning ${title} at ${this.place(place).name} tonight and has started spreading the word.`, 5, [host.id], 'party', '💌');
    return p;
  }
  learnFact(v: Villager, f: Fact, from?: Villager) {
    const isNew = v.mem.learn(f); if (!isNew) return false;
    if (f.kind === 'invite' && f.event) { const p = this.parties.find(x => x.id === f.id); if (p && !p.done) { p.invited.add(v.id); v.replan = false; } }
    return true;
  }
}
