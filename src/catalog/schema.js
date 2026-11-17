// ---------------------------------------------------------------------------
// Catalog schema — one shape for every placeable piece, whether it is an
// imported mesh (source: 'mesh') or a code builder (source: 'builder').
//
// Conventions
//   * Local frame: origin at the piece's base centre on the ground (y = 0),
//     front / door faces +Z before the placement rotation is applied.
//   * Hand-authored anchors in CATALOG are in SOURCE units (raw GLB metres for
//     meshes, builder units for builders). `resolveEntry` multiplies by
//     `scale` and returns WORLD units — the compiler should only ever read the
//     resolved form.
//   * Bounds are computed, never hand-typed: `npm run catalog:bounds` writes
//     src/catalog/bounds.json from the real geometry (GLBs via glTF-Transform +
//     Draco, builders by constructing them under three.js in node).
//
// CatalogEntry (authoring form)
//   id          string, unique, kebab-case
//   name        human label
//   tags        { category: 'house'|'landmark'|'well'|'fence'|'gate'|'path'|'tree'|'bush'|'prop',
//                 style: string[] }               e.g. ['cozy-village','thatch']
//   source      'mesh' | 'builder'
//   path        (mesh) URL under public/, e.g. 'licensed/cozy-village/x.glb'
//   license     (mesh) 'tja-commercial' — licensed, never commit/publish raw
//   builder     (builder) key in BUILDERS (src/catalog/builders-registry.js)
//   params      (builder) object passed to the builder adapter
//   scale       uniform source->world multiplier (mesh: KIT_SCALE; builder: 1)
//   yOffset     source-unit vertical shift (sinks thick terrain tiles)
//   groundY     source-unit height below which geometry counts as footprint
//   eaveY       source-unit height where the roof starts (houses), or null
//   door        { pos:[x,y,z], facing:[x,0,z] } source units, or null
//   pathSnaps   [{ pos:[x,y,z], dir:[x,0,z] }]  where a path should attach
//               (house: just outside the bottom step; path tile: both ends)
//   fenceSnaps  [{ pos:[x,y,z], dir:[x,0,z] }]  fence connection points
//               (fence: both ends; house: lot corners, from `lotMargin`)
//   lotMargin   (houses) source-unit setback around the footprint for the lot
//
// ResolvedEntry (what loaders/compiler read) — all WORLD units, unrotated:
//   ...entry, tris,
//   bounds     { min:[x,y,z], max:[x,y,z] }   full 3D AABB
//   footprint  { min:[x,z],   max:[x,z] }     ground contact incl. porch/steps
//   roof       { min:[x,y,z], max:[x,y,z] } | null
//   lot        { min:[x,z],   max:[x,z] } | null  footprint + lotMargin
//   door, pathSnaps, fenceSnaps   scaled
// ---------------------------------------------------------------------------

import { math as Math } from '../compiler/math.js';

export const CATEGORIES = ['house', 'landmark', 'well', 'fence', 'gate', 'path', 'tree', 'bush', 'prop'];
export const SOURCES = ['mesh', 'builder'];

/** Throws if an authoring entry is malformed. */
export function validateEntry(e) {
  const err = (m) => { throw new Error(`catalog entry ${e && e.id}: ${m}`); };
  if (!e || typeof e.id !== 'string') err('missing id');
  if (!e.tags || !CATEGORIES.includes(e.tags.category)) err(`bad category ${e.tags && e.tags.category}`);
  if (!SOURCES.includes(e.source)) err(`bad source ${e.source}`);
  if (e.source === 'mesh' && !e.path) err('mesh entry needs path');
  if (e.source === 'builder' && !e.builder) err('builder entry needs builder');
  if (!(e.scale > 0)) err('scale must be > 0');
  if (e.tags.category === 'house' && !e.door) err('houses need a door');
  if (e.door && Math.abs(Math.hypot(e.door.facing[0], e.door.facing[2]) - 1) > 1e-6) err('door.facing must be unit');
  return true;
}

const mul3 = (v, s, dy = 0) => [v[0] * s, (v[1] + dy) * s, v[2] * s];
const snap = (a, s, dy) => ({ pos: mul3(a.pos, s, dy), dir: [...a.dir] });

// Rotate an [x,z] (ignoring/keeping y) about Y by `a`, matching toWorld / the
// three.js rotation.y applied to a piece's content (see loader.instantiate).
function rotXZ([x, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, -x * s + z * c];
}
const rot3 = ([x, y, z], a) => { const [rx, rz] = rotXZ([x, z], a); return [rx, y, rz]; };
/** Axis-aligned XZ rect -> AABB of its corners rotated by yaw `a`. */
function rotRectXZ(rect, a) {
  if (!a) return { min: [...rect.min], max: [...rect.max] };
  let mnx = Infinity, mnz = Infinity, mxx = -Infinity, mxz = -Infinity;
  for (const x of [rect.min[0], rect.max[0]]) for (const z of [rect.min[1], rect.max[1]]) {
    const [rx, rz] = rotXZ([x, z], a);
    mnx = Math.min(mnx, rx); mxx = Math.max(mxx, rx); mnz = Math.min(mnz, rz); mxz = Math.max(mxz, rz);
  }
  return { min: [mnx, mnz], max: [mxx, mxz] };
}
/** 3D AABB -> AABB of corners rotated about Y by yaw `a` (y unchanged). */
function rotBox3(b, a) {
  if (!a) return { min: [...b.min], max: [...b.max] };
  let mnx = Infinity, mnz = Infinity, mxx = -Infinity, mxz = -Infinity;
  for (const x of [b.min[0], b.max[0]]) for (const z of [b.min[2], b.max[2]]) {
    const [rx, rz] = rotXZ([x, z], a);
    mnx = Math.min(mnx, rx); mxx = Math.max(mxx, rx); mnz = Math.min(mnz, rz); mxz = Math.max(mxz, rz);
  }
  return { min: [mnx, b.min[1], mnz], max: [mxx, b.max[1], mxz] };
}

/**
 * Merge an authoring entry with its computed bounds (source units, from
 * bounds.json) into world units.
 */
export function resolveEntry(e, raw) {
  validateEntry(e);
  if (!raw) throw new Error(`catalog entry ${e.id}: no computed bounds — run npm run catalog:bounds`);
  const s = e.scale;
  const dy = e.yOffset || 0;
  // yawOffset rotates the whole piece (content + anchors) so its door faces +Z
  // when the raw geometry does not. bounds.json is raw/unoffset, so apply it
  // here (and loader.instantiate applies the same yaw to the mesh). All current
  // pieces use 0 (their doors are already on +Z), so this is a no-op for them.
  const yaw = e.yawOffset || 0;
  const bounds = rotBox3({ min: mul3(raw.min, s, dy), max: mul3(raw.max, s, dy) }, yaw);
  const footprint = rotRectXZ({
    min: [raw.base.min[0] * s, raw.base.min[1] * s],
    max: [raw.base.max[0] * s, raw.base.max[1] * s],
  }, yaw);
  const roof = raw.roof ? rotBox3({ min: mul3(raw.roof.min, s, dy), max: mul3(raw.roof.max, s, dy) }, yaw) : null;
  let lot = null;
  const fenceSnaps = (e.fenceSnaps || []).map((a) => ({ pos: rot3(mul3(a.pos, s, dy), yaw), dir: rot3([...a.dir], yaw) }));
  if (e.lotMargin != null) {
    const m = e.lotMargin * s;
    lot = { min: [footprint.min[0] - m, footprint.min[1] - m], max: [footprint.max[0] + m, footprint.max[1] + m] };
    // Lot corners double as fence snap points (fence runs along lot edges).
    for (const [x, z] of [[lot.min[0], lot.min[1]], [lot.max[0], lot.min[1]], [lot.max[0], lot.max[1]], [lot.min[0], lot.max[1]]]) {
      fenceSnaps.push({ pos: [x, 0, z], dir: [Math.sign(x), 0, Math.sign(z)] });
    }
  }
  return {
    ...e,
    tris: raw.tris,
    ...(e.walkOpening ? { walkOpening: e.walkOpening * s } : {}),
    bounds,
    footprint,
    roof,
    lot,
    door: e.door ? { pos: rot3(mul3(e.door.pos, s, dy), yaw), facing: rot3([...e.door.facing], yaw) } : null,
    pathSnaps: (e.pathSnaps || []).map((a) => ({ pos: rot3(mul3(a.pos, s, dy), yaw), dir: rot3([...a.dir], yaw) })),
    fenceSnaps,
  };
}

/** Transform a resolved local anchor point by a placement {x, z, rotY}. */
export function toWorld(p, place) {
  const c = Math.cos(place.rotY || 0), sn = Math.sin(place.rotY || 0);
  return [place.x + p[0] * c + p[2] * sn, p[1], place.z - p[0] * sn + p[2] * c];
}
