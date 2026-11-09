// Save / resume: the whole sim (villagers' minds, relationships, keepsakes, events, the paper archive) as one JSON graph
// in localStorage. Shared references survive (a fact known by five villagers stays one fact) and villagers are restored
// into the live objects that already own the 3D avatars, so nothing in the scene needs rebuilding.
import type { Sim } from '../sim/sim';
import type { Director } from '../sim/director';

const KEY = 'thistlebrook.save.v1';
// render-side or rebuilt-on-load state never goes into the save
const SKIP = new Set(['world', 'listeners', 'brain', 'avatar', 'def', 'byId', 'obj', 'mesh', 'root', 'gifts']);

function encode(root: any): string {
  const ids = new Map<object, number>(); let n = 0;
  const enc = (x: any): any => {
    if (typeof x === 'function') return undefined;
    if (typeof x === 'number' && !Number.isFinite(x)) return { __n: String(x) };
    if (x === null || typeof x !== 'object') return x;
    if (x.isObject3D || x.isMaterial || x.isBufferGeometry || (typeof HTMLElement !== 'undefined' && x instanceof HTMLElement)) return undefined;
    const seen = ids.get(x); if (seen !== undefined) return x.avatar && x.def ? { __v: x.id } : { __r: seen };
    const id = n++; ids.set(x, id);
    if (x instanceof Map) return { __id: id, __m: [...x].map(([k, v]) => [enc(k), enc(v)]) };
    if (x instanceof Set) return { __id: id, __s: [...x].map(enc) };
    if (Array.isArray(x)) return { __id: id, __a: x.map(enc) };
    const o: any = x.avatar && x.def ? { __id: id, __v: x.id } : { __id: id };
    for (const k of Object.keys(x)) { if (SKIP.has(k)) continue; const v = enc(x[k]); if (v !== undefined) o[k] = v; }
    return o;
  };
  return JSON.stringify(enc(root));
}

function decode(json: string, sim: Sim): any {
  const byId = new Map<number, any>();
  const dec = (x: any): any => {
    if (x === null || typeof x !== 'object') return x;
    if ('__n' in x) return Number(x.__n);
    if ('__r' in x) return byId.get(x.__r);
    if ('__v' in x && !('__id' in x)) return sim.byId.get(x.__v);
    if ('__m' in x) { const m = new Map(); byId.set(x.__id, m); for (const [k, v] of x.__m) m.set(dec(k), dec(v)); return m; }
    if ('__s' in x) { const s = new Set(); byId.set(x.__id, s); for (const v of x.__s) s.add(dec(v)); return s; }
    if ('__a' in x) { const a: any[] = []; byId.set(x.__id, a); for (const v of x.__a) a.push(dec(v)); return a; }
    if ('__v' in x) { // a villager: pour the saved fields into the live villager that owns the avatar
      const v: any = sim.byId.get(x.__v); if (!v) return null; byId.set(x.__id, v);
      for (const k of Object.keys(x)) { if (k.startsWith('__')) continue; const val = dec(x[k]); if (k === 'mem') Object.assign(v.mem, val); else v[k] = val; }
      return v;
    }
    const o: any = {}; byId.set(x.__id, o);
    for (const k of Object.keys(x)) if (k !== '__id') o[k] = dec(x[k]);
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
  for (let tries = 0; tries < 3; tries++) {
    try {
      const json = encode(payload); localStorage.setItem(KEY, json);
      localStorage.setItem(KEY + '.info', JSON.stringify({ seed, day: sim.day, clock: sim.clock, savedAt: Date.now() } as SaveInfo));
      return true;
    } catch { // over quota: thin the oldest memories and day logs, then try again
      for (const v of sim.villagers) { v.mem.items.splice(0, Math.floor(v.mem.items.length / 2)); v.story.splice(0, Math.floor(v.story.length / 2)); }
      const days = Object.keys(sim.dayStats).map(Number).sort((a, b) => a - b); for (const d of days.slice(0, -3)) sim.dayStats[d] = sim.dayStats[d].filter(e => e.imp >= 6);
    }
  }
  return false;
}

export function loadGame(sim: Sim, director: Director): boolean {
  let raw: string | null = null; try { raw = localStorage.getItem(KEY); } catch {} if (!raw) return false;
  try {
    const data = decode(raw, sim); if (!data || data.v !== 1) return false;
    const s: any = sim; const saved = data.sim;
    for (const k of Object.keys(saved)) { if (k === 'villagers' || k === 'rngS' || SKIP.has(k)) continue; s[k] = saved[k]; }
    sim.rng.s = saved.rngS >>> 0 || 1;
    sim.gifts = []; sim.visitorUntil = 0; sim.festivalUntil = 0; // set pieces (gift boxes, Nell's wagon, bunting) are not restored
    for (const v of sim.villagers) { // in-flight actions pointed at scene objects; let everyone re-plan from where they stand
      v.act = null; v.queue = []; v.path = null; v.pathI = 0; v.seat = null; v.replan = true; v.busyUntil = 0;
      if (!(v.achievements instanceof Set)) v.achievements = new Set(v.achievements as any);
      v.avatar.root.position.set(v.x, 0, v.z);
    }
    director.papers = data.papers ?? []; director.recentImportant = (data.recent ?? []).filter(Boolean);
    return true;
  } catch (e) { console.warn('save: could not restore', e); return false; }
}
