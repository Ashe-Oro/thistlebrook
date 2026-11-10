// Save / resume: the whole sim (villagers' minds, relationships, keepsakes, events, the paper archive) as one JSON graph
// in localStorage. Shared references survive (a fact known by five villagers stays one fact) and villagers are restored
// into the live objects that already own the 3D avatars, so nothing in the scene needs rebuilding.
import type { Sim } from '../sim/sim';
import type { Director } from '../sim/director';

const KEY = 'thistlebrook.save.v1';
// render-side or rebuilt-on-load state never goes into the save
const SKIP = new Set(['world', 'listeners', 'brain', 'avatar', 'def', 'byId', 'obj', 'mesh', 'root', 'gifts']);

function encode(root: any, villagers = new Set<any>()): string {
  const ids = new Map<object, number>(); let n = 0;
  const enc = (x: any): any => {
    if (typeof x === 'function') return undefined;
    if (typeof x === 'number' && !Number.isFinite(x)) return { __n: String(x) };
    if (x === null || typeof x !== 'object') return x;
    if (x.isObject3D || x.isMaterial || x.isBufferGeometry || (typeof HTMLElement !== 'undefined' && x instanceof HTMLElement)) return undefined;
    const seen = ids.get(x); if (seen !== undefined) return (villagers.has(x) || x.avatar && x.def) ? { __v: x.id } : { __r: seen };
    const id = n++; ids.set(x, id);
    if (x instanceof Map) return { __id: id, __m: [...x].map(([k, v]) => [enc(k), enc(v)]) };
    if (x instanceof Set) return { __id: id, __s: [...x].map(enc) };
    if (Array.isArray(x)) return { __id: id, __a: x.map(enc) };
    const o: any = (villagers.has(x) || x.avatar && x.def) ? { __id: id, __v: x.id } : { __id: id };
    for (const k of Object.keys(x)) { if (SKIP.has(k)) continue; const v = enc(x[k]); if (v !== undefined) o[k] = v; }
    return o;
  };
  return JSON.stringify(enc(root));
}

function decode(json: string, villagers = new Map<string, any>()): any {
  const byId = new Map<number, any>();
  const dec = (x: any): any => {
    if (x === null || typeof x !== 'object') return x;
    if (Object.keys(x).some(k => k === '__proto__' || k === 'constructor' || k === 'prototype')) throw new Error('Invalid save field');
    if ('__n' in x) return Number(x.__n);
    if ('__r' in x) { if (!byId.has(x.__r)) throw new Error('Invalid save reference'); return byId.get(x.__r); }
    if ('__v' in x && !('__id' in x)) { if (!villagers.has(x.__v)) throw new Error('Invalid villager reference'); return villagers.get(x.__v); }
    if ('__m' in x) { const m = new Map(); byId.set(x.__id, m); for (const [k, v] of x.__m) m.set(dec(k), dec(v)); return m; }
    if ('__s' in x) { const s = new Set(); byId.set(x.__id, s); for (const v of x.__s) s.add(dec(v)); return s; }
    if ('__a' in x) { const a: any[] = []; byId.set(x.__id, a); for (const v of x.__a) a.push(dec(v)); return a; }
    if ('__v' in x) {
      if (villagers.has(x.__v)) throw new Error('Duplicate villager');
      const v: any = {}; villagers.set(x.__v, v); byId.set(x.__id, v);
      for (const k of Object.keys(x)) if (!k.startsWith('__') && !SKIP.has(k)) Object.defineProperty(v, k, { value: dec(x[k]), writable: true, enumerable: true, configurable: true });
      return v;
    }
    const o: any = {}; byId.set(x.__id, o);
    for (const k of Object.keys(x)) if (k !== '__id') Object.defineProperty(o, k, { value: dec(x[k]), writable: true, enumerable: true, configurable: true });
    return o;
  };
  return dec(JSON.parse(json));
}

export interface SaveInfo { seed: string | null; day: number; clock: number; savedAt: number; }
export function peekSave(): SaveInfo | null { try { const raw = localStorage.getItem(KEY + '.info'); return raw ? JSON.parse(raw) : null; } catch { return null; } }
export function clearSave() { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '.info'); } catch {} }

export function saveGame(sim: Sim, director: Director, seed: string | null): boolean {
  const s: any = sim;
  const evs = sim.events; const keepEv = evs.length > 400 ? evs.slice(-400) : evs; // the chronicle beyond 400 lines lives on only in dayStats
  const payload = { v: 1, seed, sim: { ...s, events: keepEv, rngS: sim.rng.s }, papers: director.papers.slice(-14), recent: director.recentImportant };
  delete payload.sim.rng;
  let snapshot: any;
  try { snapshot = decode(encode(payload)); } catch { return false; }
  for (let tries = 0; tries < 3; tries++) {
    try {
      const json = encode(snapshot, new Set(snapshot.sim.villagers)); localStorage.setItem(KEY, json);
      localStorage.setItem(KEY + '.info', JSON.stringify({ seed, day: sim.day, clock: sim.clock, savedAt: Date.now() } as SaveInfo));
      return true;
    } catch (e) { // Only quota failures can benefit from a smaller, detached snapshot.
      if (!e || typeof e !== 'object' || !('name' in e) || !['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(String(e.name))) return false;
      for (const v of snapshot.sim.villagers) { v.mem.items.splice(0, Math.floor(v.mem.items.length / 2)); v.story.splice(0, Math.floor(v.story.length / 2)); }
      const days = Object.keys(snapshot.sim.dayStats).map(Number).sort((a, b) => a - b); for (const d of days.slice(0, -3)) snapshot.sim.dayStats[d] = snapshot.sim.dayStats[d].filter((e: any) => e.imp >= 6);
    }
  }
  return false;
}

export function loadGame(sim: Sim, director: Director): boolean {
  let raw: string | null = null; try { raw = localStorage.getItem(KEY); } catch {} if (!raw) return false;
  try {
    const records = new Map<string, any>();
    const data = decode(raw, records);
    if (!data || data.v !== 1 || !data.sim || !Array.isArray(data.sim.villagers)) return false;
    const saved = data.sim;
    if (!Number.isFinite(saved.rngS) || !Number.isFinite(saved.clock)) return false;
    const replacements = new Map<any, any>();
    for (const [id, record] of records) {
      const live = sim.byId.get(id);
      if (!live || record.id !== id || !record.mem || typeof record.mem !== 'object' ||
          !Array.isArray(record.mem.items) || !Array.isArray(record.story) ||
          !Number.isFinite(record.x) || !Number.isFinite(record.z)) return false;
      replacements.set(record, live); replacements.set(record.mem, live.mem);
      record.achievements = record.achievements instanceof Set ? record.achievements : new Set(record.achievements);
      if (record.inside) {
        const door = sim.world.places.get(record.inside); if (!door) return false;
        record.x = door.x; record.z = door.z + .4;
        record.inside = null; record.doing = 'waking up'; record.anim = 'idle';
      }
      record.act = null; record.queue = []; record.path = null; record.pathI = 0;
      record.seat = null; record.replan = true; record.busyUntil = 0;
    }
    if (saved.villagers.length !== sim.villagers.length || new Set(saved.villagers).size !== saved.villagers.length ||
        saved.villagers.some((v: any) => !replacements.has(v))) return false;
    const papers = data.papers ?? [];
    if (!Array.isArray(papers) || !Array.isArray(data.recent ?? [])) return false;
    const recent = (data.recent ?? []).filter(Boolean);
    // Resolve graph references before touching the live objects, including Map keys and Set members.
    const seen = new Set<any>();
    const resolve = (value: any): any => {
      if (replacements.has(value)) return replacements.get(value);
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value);
      if (value instanceof Map) { const entries = [...value]; value.clear(); for (const [k, v] of entries) value.set(resolve(k), resolve(v)); }
      else if (value instanceof Set) { const entries = [...value]; value.clear(); for (const v of entries) value.add(resolve(v)); }
      else for (const k of Object.keys(value)) value[k] = resolve(value[k]);
      return value;
    };
    for (const record of records.values()) {
      for (const k of Object.keys(record.mem)) record.mem[k] = resolve(record.mem[k]);
      for (const k of Object.keys(record)) if (k !== 'mem') record[k] = resolve(record[k]);
    }
    resolve(saved); resolve(papers); resolve(recent);
    // Everything that can reject the save has completed; commit to the existing avatar owners.
    const s: any = sim;
    for (const k of Object.keys(saved)) { if (k === 'villagers' || k === 'rngS' || SKIP.has(k)) continue; s[k] = saved[k]; }
    for (const [id, record] of records) {
      const live = sim.byId.get(id)!;
      Object.assign(live.mem, record.mem);
      for (const k of Object.keys(record)) if (k !== 'mem') (live as any)[k] = record[k];
      live.avatar.root.position.set(live.x, 0, live.z);
      live.avatar.targetAlpha = 1;
    }
    sim.rng.s = saved.rngS >>> 0 || 1;
    sim.gifts = []; sim.visitorUntil = 0; sim.festivalUntil = 0;
    for (const place of sim.world.places.values()) place.inside.clear();
    director.papers = papers; director.recentImportant = recent;
    return true;
  } catch (e) { console.warn('save: could not restore', e); return false; }
}
