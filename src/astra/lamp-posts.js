// OWNER: streetlights lane. Pure lamp-post registry (no THREE, no DOM).
//
// Every placed lamp post in Thistlebrook is listed here once, with the glow
// that lights it after dusk. Modules that place a lamp post read their
// coordinates from this file, so a post cannot be added without an entry.
// tests/streetlights.test.mjs checks the 1:1 correspondence.
import {WORLD_OFFSETS} from '../compiler/world-plan.js';
import {DISTRICT_OFFSETS} from '../compiler/astra-placement.js';
import {LAMPS as FAIR_LOT_LAMPS} from './fair-lot-plan.js';
import {FURNITURE_MODELS} from './street-plan.js';

export {LAMP_LOOK} from './lamp-look.js';

/** Fixture geometry: lantern head in model-local units (x along the arm, y up),
 * pool radius in world units. Arms reach along local +X; yaw turns them. */
export const LAMP_FIXTURES = Object.freeze({
  'cv-streetlamp': {head: [0, 2.55], pool: 2.6},
  // Street-plan furniture (FURNITURE_MODELS): arms over the carriageway.
  'city-lamp': {head: [1.3, 3.85], pool: 3.2},
  'sub-lamp': {head: [.72, 4.3], pool: 3},
  // Maple Hollow uses the same Suburban lamp at its own scale.
  'streetlamp': {head: [.72, 4.3], pool: 3},
  'civic-lamp': {head: [0, 3.4], pool: 2.8},
  'platform_gas_lamp': {head: [0, 2.75], pool: 2.4},
  'fair-lot-lamp': {head: [0, 4.12], pool: 3.4},
  'globe_lamppost': {head: [0, 3.2], pool: 6},
  'quay-lamp': {head: [0, 3.1], pool: 2.6},
});

// Hand-placed posts that live in a module rather than in town.props. The
// coordinates are in each module's own frame (see `frame` below).
export const WORKS_LAMPS = Object.freeze([-108, -97, -82, -72, -52].map((x) => [x, -71.4]));
export const SUNBEAM_LAMPS = Object.freeze([[-76, -51], [-46, -53], [-63, -36]]);
export const PARK_LAMPS = Object.freeze([[-76, -79], [-43, -79], [-76, -57], [-43, -57], [-43, -37]]);
export const CIVIC_LAMPS = Object.freeze([[-99, -75], [-83, -79], [-62, -79], [-44, -75], [-76, -61], [-76, -39], [-97, -39]]);
export const QUAY_LAMPS = Object.freeze([29, 43, 51, 66, 81, 90].map((x) => [x, 44.7]));

const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** Lantern head [x, y, z] for a post at pos with yaw/scale, in the same frame as pos. */
export function lampHead(model, pos, {yaw = 0, scale = 1, y = 0} = {}) {
  const f = LAMP_FIXTURES[model], [ax, ay] = f.head;
  return [r4(pos[0] + Math.cos(yaw) * ax * scale), r4(y + ay * scale), r4(pos[1] - Math.sin(yaw) * ax * scale)];
}

/**
 * Every placed lamp post in the town, in world coordinates.
 * `glow` names the runtime that lights it:
 *  - 'prop-glow'     world.js bulb + pool and the lighting.js halo (town.props)
 *  - 'lamp-glow'     the shared instanced head/pool/halo (lamp-glow.js)
 *  - 'maple-hollow'  Maple Hollow's emissive glass + instanced pools
 *  - 'midway'        the theme park's per-lamp kit pools
 *  - 'quay'          harbour bulbs + PointLights
 * `head: false` means the model already carries its own lit head.
 */
export function lampPosts(town, {streetPlan = null} = {}) {
  const out = [], frame = (o) => (p) => [p[0] + o[0], p[1] + o[1]];
  const add = (post) => out.push({...post, key: `${post.source}:${out.filter((q) => q.source === post.source).length}`});
  town.props.forEach((p, i) => {
    if (p.id !== 'cv-streetlamp') return;
    add({source: 'props', model: 'cv-streetlamp', pos: p.pos, scale: p.scale, yaw: 0, head: lampHead('cv-streetlamp', p.pos, {scale: p.scale}), glow: 'prop-glow', ref: p.registryId, prop: i});
  });
  for (const it of streetPlan?.items || []) if (it.kind === 'lamp') {
    const fixture = it.model === 'cozy-lamp' ? 'cv-streetlamp' : it.model, scale = FURNITURE_MODELS[it.model].scale;
    add({source: 'street-plan', model: fixture, furniture: it.model, pos: it.pos, yaw: it.yaw, scale, head: lampHead(fixture, it.pos, {yaw: it.yaw, scale}), glow: 'lamp-glow', heads: true, street: it.street});
  }
  const fixed = (source, list, toWorld, model, opts = {}) => list.forEach((p) => {
    const pos = toWorld(p);
    add({source, model, pos, yaw: 0, scale: opts.scale ?? 1, head: lampHead(model, pos, {scale: opts.scale ?? 1, y: opts.y ?? 0}), glow: opts.glow ?? 'lamp-glow', heads: opts.heads ?? true, ...(opts.ground != null && {ground: opts.ground})});
  });
  if (town.districts.some((d) => d.id === 'works')) fixed('works', WORKS_LAMPS, frame(DISTRICT_OFFSETS.works), 'cv-streetlamp', {heads: false});
  if (town.districts.some((d) => d.id === 'sunbeam')) fixed('sunbeam', SUNBEAM_LAMPS, frame(DISTRICT_OFFSETS.sunbeam), 'cv-streetlamp', {scale: .9});
  if (town.districts.some((d) => d.id === 'civic-green')) fixed('civic', CIVIC_LAMPS, (p) => p, 'civic-lamp', {heads: false});
  if (town.fair) fixed('park', PARK_LAMPS, frame(WORLD_OFFSETS.fair), 'cv-streetlamp');
  if (town.harbor) fixed('quay', QUAY_LAMPS, frame(WORLD_OFFSETS.harbor), 'quay-lamp', {glow: 'quay', heads: false});
  // Funfair Parking is always built (expansions.js); its lot surface sits ~.1 up.
  fixed('fair-lot', FAIR_LOT_LAMPS, (p) => p, 'fair-lot-lamp', {heads: false, ground: .1});
  for (const st of town.railway?.stations || []) for (const f of st.furniture.filter((f) => f.light))
    add({source: 'railway', model: 'platform_gas_lamp', pos: f.pos, yaw: 0, scale: 1, head: lampHead('platform_gas_lamp', f.pos, {y: st.y + .66}), ground: st.y + .66, glow: 'lamp-glow', heads: false, station: st.name});
  for (const p of town.mapleHollow?.props || []) if (p.model === 'streetlamp')
    add({source: 'maple-hollow', model: 'streetlamp', pos: p.pos, yaw: p.yaw, scale: p.scale, head: lampHead('streetlamp', p.pos, {yaw: p.yaw, scale: p.scale}), glow: 'maple-hollow'});
  for (const p of town.modelPlacements || []) if (p.asset === 'fairground/globe_lamppost')
    add({source: 'midway', model: 'globe_lamppost', pos: p.pos, yaw: p.rot || 0, scale: p.scale || 1, head: lampHead('globe_lamppost', p.pos, {scale: p.scale || 1}), glow: 'midway'});
  return out;
}

/** Instance layout for the shared glow: one head, pool and halo per post (pure). */
export function glowLayout(posts, {offset = [0, 0]} = {}) {
  return posts.map((p) => {
    const f = LAMP_FIXTURES[p.model], ground = p.ground ?? 0;
    const head = [p.head[0] - offset[0], p.head[1], p.head[2] - offset[1]];
    return {key: p.key, head: p.heads ? head : null, halo: head, pool: {center: [head[0], ground + .19, head[2]], radius: f.pool * Math.max(.85, p.scale || 1)}};
  });
}
