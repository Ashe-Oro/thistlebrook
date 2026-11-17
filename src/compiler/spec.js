// Town spec format (compiler v3). A spec is plain JSON (see specs/hamlet.json)
// describing WHAT a town contains; the seeded compiler decides WHERE. Count
// ranges are inclusive [min, max] drawn by the seeded RNG. `pick` is a tag
// filter resolved against the catalog.
//
// Spec shape (all keys optional unless noted — DEFAULTS fill the rest):
//   name    string label.
//   seed    default seed when none is passed to compileTown.
//   area    { shape:'circle', radius } | { shape:'rect', w, d }  — town extent,
//           centred on the origin.
//   plaza   { center, radius, ring }. center = catalog id (e.g. 'cv-well') or a
//           tag query { category:'well', ... }; it is placed at the origin.
//           radius = the plaza disk / keep-clear radius. ring describes the
//           paved loop every door path must join (see below).
//   plaza.ring { style:'builder'|'cobble-tiles', width, radius }. A flat paved
//           loop centred on the well at `radius` (centreline), `width` wide.
//           'builder' = a single toon ring mesh (b-plaza-ring); 'cobble-tiles'
//           falls back to the builder ring for now. Every door path ends ON this
//           ring (overlapping ~0.3), and ring connectivity counts as reaching
//           the plaza, so no door path dead-ends at open ground.
//   landmarks { count:[min,max], pick, ring:[r0,r1], placement:'plaza-facing' }.
//           Civic buildings (category:'landmark'). They are placed BEFORE houses
//           and take the best plaza-facing slots (centre of the far arc), door
//           facing the plaza, with a path to the ring. ring = their radius band.
//   houses  { count:[min,max], pick, prefer, ring:[rMin,rMax], arc }.
//           pick/prefer are tag filters; ring = radius band around the plaza;
//           arc = half-angle (radians) of the placement arc on the side AWAY
//           from the camera (fronts then face the viewer).
//   houses.facing { maxCameraAngle, maxPlazaAngle, blend, maxPathBend } (v3,
//           also used by landmarks). Each building's door yaw starts facing the
//           plaza centre and is blended toward the camera by
//           blend * (|slot offset| / arc), i.e. more at the arc ends, then
//           clamped so (horizontal, degrees) the door is <= maxCameraAngle off
//           the direction to the camera and <= maxPlazaAngle off the direction
//           to the plaza centre, and its straight door path still lands on the
//           ring at most maxPathBend degrees off the door direction. Every
//           house/landmark instance records facing:{cameraAngle, plazaAngle}
//           (degrees, horizontal, from the building origin) measured against
//           the town's suggested camera (town.camera.pos) and the origin.
//   trees   { count:[min,max], pick }        scattered, off lots/paths/plaza.
//   bushes  { count:[min,max], pick, maxRadius }  maxRadius (trees too) keeps
//           dressing within that distance of the plaza centre (optional).
//   props   { count:[min,max], pick, near }  near:'house' lets props sit inside
//           a lot by the house (never on footprint/path).
//   paths   { style:'builder', id, width }   one strip per building to the ring.
//   fences  { id, probability, edges }       per fenced house: ONE continuous
//           run around back+left+right+front with a GATE GAP on the front edge
//           centred on the door path. edges is accepted for back-compat but the
//           v2 fence always runs the full perimeter (minus the gate).
//   fences.gate { id, open } (v3). One gate per fenced lot, in the front gap:
//           { id, kind:'gate', pos, rotY, scale:1, lot, edge:'front', width,
//           open }. pos = hinge-line centre: where the door-path centreline
//           crosses the front fence line. rotY = the house yaw (gate local X
//           runs along the front edge, +Z points out of the lot). width = the
//           gap width. open = 0..1 of a 90 deg inward swing (default 0.55,
//           ~50 deg; the compiler lowers it per lot so leaves clear the house).
//           gate:null = no gates AND no fenced lots (a fenced front needs its
//           gate). A gate id missing from the catalog or not category 'gate'
//           is an error (validateSpec with a catalog, and compileTown).
//   density { houses, trees, bushes, props } multipliers (default 1) scaling the
//           count ranges (rounded, clamped to >= 0). If many houses don't fit,
//           the compiler auto-grows area.radius / houses.ring over its town
//           retries before giving up.
//   camera  { mode:'auto' }                  auto = suggest from final layout.
//   retries { placement, town }              placement = per-item rejection
//           retries; town = recompiles with a derived sub-seed on validate fail.
//
// districts { plazaHouses, plazaLandmarks } enables the large street layout.
// houses.count remains the total density-scaled dwelling count; additional
// residential rows extend the connected network as that count grows.
// Non-plaza buildings record district + street, checked against their street.
//
// pick/prefer tag filter fields: { category, style (string the entry's style[]
// must contain), source ('mesh'|'builder') }.

export const DEFAULTS = {
  name: 'Hamlet',
  seed: 1,
  area: { shape: 'circle', radius: 34 },
  plaza: { center: 'cv-well', radius: 6, ring: { style: 'builder', width: 1.8, radius: 6 } },
  landmarks: { count: [1, 2], pick: { category: 'landmark', style: 'v3-kit' }, ring: [13, 19], placement: 'plaza-facing' },
  houses: { count: [4, 6], pick: { category: 'house', style: 'v3-kit' }, prefer: { source: 'mesh' }, ring: [13, 22], arc: 1.75,
    facing: { maxCameraAngle: 45, maxPlazaAngle: 50, blend: 0.8, maxPathBend: 18 } },
  trees: { count: [10, 16], pick: { category: 'tree', style: 'v3-kit' } },
  bushes: { count: [6, 12], pick: { category: 'bush', style: 'v3-kit' }, maxRadius: 28 },
  props: { count: [2, 5], pick: { category: 'prop', style: 'v3-kit' }, near: 'house' },
  paths: { style: 'builder', id: 'b-path-6', width: 2.3 },
  fences: { id: 'cv-picket-fence', probability: 0.6, edges: ['back', 'left', 'right', 'front'], gate: { id: 'b-gate', open: 0.55 } },
  density: { houses: 1, trees: 1, bushes: 1, props: 1 },
  camera: { mode: 'auto' },
  retries: { placement: 40, town: 12 },
};

const isRange = (v) => Array.isArray(v) && v.length === 2 && v[0] <= v[1];

/** Merge a (possibly partial) spec over DEFAULTS. Shallow-per-section. */
export function applyDefaults(spec = {}) {
  const out = { ...DEFAULTS, ...spec };
  for (const k of ['area', 'plaza', 'landmarks', 'houses', 'trees', 'bushes', 'props', 'paths', 'fences', 'density', 'camera', 'retries']) {
    out[k] = { ...DEFAULTS[k], ...(spec[k] || {}) };
  }
  // plaza.ring is nested one level deeper; deep-merge it too.
  out.plaza.ring = { ...DEFAULTS.plaza.ring, ...((spec.plaza && spec.plaza.ring) || {}) };
  // v3 nested sections.
  out.houses.facing = { ...DEFAULTS.houses.facing, ...((spec.houses && spec.houses.facing) || {}) };
  out.fences.gate = (spec.fences && spec.fences.gate === null) ? null
    : { ...DEFAULTS.fences.gate, ...((spec.fences && spec.fences.gate) || {}) };
  return out;
}

/** Apply a density multiplier to an inclusive [min,max] count range. */
export function scaleCount([lo, hi], mult = 1) {
  const m = mult == null ? 1 : mult;
  const slo = Math.max(0, Math.round(lo * m));
  const shi = Math.max(slo, Math.round(hi * m));
  return [slo, shi];
}

/**
 * Gate-config problem for a defaulted spec against a resolved catalog Map, or
 * null if fine. gate:null is allowed (no gates, and then no fenced lots: a
 * front edge without its gate would break the gate/fence invariants).
 */
export function gateSpecError(spec, catalog) {
  const g = spec.fences.gate;
  if (g == null) return null;
  if (typeof g.id !== 'string' || !g.id) return 'fences.gate.id must be a catalog id (or set fences.gate to null)';
  if (!catalog) return null;
  const e = catalog.get(g.id);
  if (!e) return `fences.gate.id '${g.id}' is not in the catalog`;
  if (e.tags?.category !== 'gate') return `fences.gate.id '${g.id}' is category '${e.tags?.category}', not 'gate'`;
  return null;
}

/** Throw on a malformed spec. Returns the defaulted spec on success. Pass the
 *  resolved catalog to also validate catalog references (fences.gate.id). */
export function validateSpec(rawSpec, catalog) {
  const spec = applyDefaults(rawSpec);
  const err = (m) => { throw new Error(`spec: ${m}`); };
  const a = spec.area;
  if (a.shape === 'circle') { if (!(a.radius > 0)) err('circle area needs radius > 0'); }
  else if (a.shape === 'rect') { if (!(a.w > 0 && a.d > 0)) err('rect area needs w,d > 0'); }
  else err(`unknown area.shape ${a.shape}`);
  if (!(spec.plaza.radius > 0)) err('plaza.radius must be > 0');
  if (!(spec.plaza.ring.radius > 0 && spec.plaza.ring.width > 0)) err('plaza.ring needs radius,width > 0');
  for (const k of ['houses', 'trees', 'bushes', 'props', 'landmarks']) {
    if (!isRange(spec[k].count)) err(`${k}.count must be an inclusive [min,max]`);
  }
  if (!isRange(spec.houses.ring) || spec.houses.ring[0] <= 0) err('houses.ring must be [rMin,rMax], rMin > 0');
  if (!isRange(spec.landmarks.ring) || spec.landmarks.ring[0] <= 0) err('landmarks.ring must be [r0,r1], r0 > 0');
  for (const k of ['houses', 'trees', 'bushes', 'props']) {
    if (!(spec.density[k] >= 0)) err(`density.${k} must be >= 0`);
  }
  if (!(spec.paths.width > 0)) err('paths.width must be > 0');
  const fc = spec.houses.facing;
  if (!(fc.maxCameraAngle > 0 && fc.maxCameraAngle <= 180)) err('houses.facing.maxCameraAngle must be in (0,180]');
  if (!(fc.maxPlazaAngle >= 0 && fc.maxPlazaAngle <= 180)) err('houses.facing.maxPlazaAngle must be in [0,180]');
  if (spec.fences.gate && !(spec.fences.gate.open >= 0 && spec.fences.gate.open <= 1)) err('fences.gate.open must be in [0,1]');
  if (spec.districts) {
    for (const key of ['plazaHouses', 'plazaLandmarks']) {
      const range = spec.districts[key];
      if (!isRange(range) || range.some(n => !Number.isInteger(n) || n < 0)) err(`districts.${key} needs a nonnegative integer range`);
    }
  }
  const ge = gateSpecError(spec, catalog);
  if (ge) err(ge);
  return spec;
}
