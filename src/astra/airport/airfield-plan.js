// OWNER: airfield-kit lane (docs/specs/OPUS-AIRFIELD.md). Pure plan, no THREE:
// which Airfield-pack model stands where in the airport frame (the same local
// frame as airport/index.js and traffic.js; WORLD_OFFSETS.airport moves it
// into the town). The renderer (index.js) reads this; tests read it too.
//
// Pack conventions (measured from the GLBs, see AIRFIELD_MODELS): 1 unit =
// 1 town unit, Y-up, pivot bottom-centre, front faces +Z. Yaw turns +Z toward
// (sin yaw, cos yaw): 0 faces the car park (+z), PI/2 faces the apron (+x).
// None of the GLBs are committed; they live in public/licensed/airfield.

const PI = Math.PI;
export const AIRFIELD_DIR = 'licensed/airfield/';
export const airfieldPath = (model) => `${AIRFIELD_DIR}${model}.glb`;

/** Authored bounds (min/max, model space) of every pack model the airport uses. */
export const AIRFIELD_MODELS = Object.freeze({
  terminal_fbo: {min: [-3.15, 0, -2.16], max: [3.15, 3.72, 3.59]},
  flight_club_office: {min: [-2.01, 0, -1.75], max: [2.54, 4.27, 2.59]},
  apron_canopy: {min: [-2.55, 0, -1.03], max: [2.55, 2.58, 1.04]},
  control_tower: {min: [-1.72, 0, -1.72], max: [1.71, 10.6, 1.71]},
  gse_shed: {min: [-2.28, 0, -1.88], max: [3.02, 3.67, 1.91]},
  hangar: {min: [-4.02, 0, -3.26], max: [4.02, 5.11, 4.01]},
  t_hangar_block: {min: [-3.58, 0, -2.0], max: [3.57, 2.85, 2.3]},
  fuel_farm: {min: [-2.71, -.02, -1.63], max: [2.72, 3.65, 2.1]},
  fire_rescue_station: {min: [-2.48, 0, -1.88], max: [2.45, 4.63, 1.86]},
  rotating_beacon: {min: [-.46, 0, -.45], max: [.45, 5.57, .45]},
  windsock: {min: [-.28, 0, -.28], max: [.44, 4.36, 1.83]},
  papi_array: {min: [-.77, 0, -.17], max: [.78, .5, .24]},
  apron_floodlight: {min: [-.85, 0, -.35], max: [.85, 6.03, .35]},
  runway_edge_light: {min: [-.11, 0, -.14], max: [.12, .45, .13]},
  taxiway_blue_light: {min: [-.12, 0, -.12], max: [.12, .46, .12]},
  light_aircraft_cessna: {min: [-2.01, 0, -2.07], max: [2.0, 1.7, 1.73]},
  passenger_airstair: {min: [-.49, 0, -1.07], max: [.5, 1.98, 1.37]},
  ground_power_unit: {min: [-.5, 0, -.36], max: [.76, 1.0, .79]},
});

// Buildings: terminal, flight club office and apron canopy cluster on the
// public side (terminal kept at 1.3, see the spec); tower and GSE shed south
// of it; the club hangar and T-hangars on the old hangar footprint; fuel farm
// on a service pad north of the GA row; fire station on the taxi link.
export const STRUCTURES = Object.freeze([
  {id: 'terminal', model: 'terminal_fbo', name: 'Terminal FBO', pos: [77, -61], yaw: 0, scale: 1.3},
  {id: 'club-office', model: 'flight_club_office', name: 'Clover Flying Club office', pos: [85.5, -50], yaw: 0, scale: 1.3},
  {id: 'canopy', model: 'apron_canopy', name: 'Boarding canopy', pos: [83, -60], yaw: PI / 2, scale: 1.4},
  {id: 'tower', model: 'control_tower', name: 'Control tower', pos: [75, -82], yaw: 0, scale: 1.25},
  {id: 'gse-shed', model: 'gse_shed', name: 'Ground equipment shed', pos: [84.5, -87], yaw: PI / 2, scale: 1.3},
  {id: 'hangar', model: 'hangar', name: 'Clover Flying Club hangar', pos: [79.5, -20], yaw: PI / 2, scale: 1.6},
  {id: 't-hangars', model: 't_hangar_block', name: 'T-hangars', pos: [75.5, -4], yaw: PI / 2, scale: 1.4},
  {id: 'fuel-farm', model: 'fuel_farm', name: 'Fuel farm', pos: [89, 6.6], yaw: PI, scale: 1.3},
  {id: 'fire-station', model: 'fire_rescue_station', name: 'Airport fire station', pos: [96, -97], yaw: 0, scale: 1.4},
]);

// Airside furniture (static pack props).
export const AIRSIDE = Object.freeze([
  {id: 'beacon', model: 'rotating_beacon', pos: [68.5, -76], yaw: 0, scale: 1.3},
  {id: 'papi', model: 'papi_array', pos: [133.5, -4], yaw: 0, scale: 1.6},
  {id: 'airstair', model: 'passenger_airstair', pos: [90, -62.4], yaw: PI, scale: 1.1},
  {id: 'gpu', model: 'ground_power_unit', pos: [91, -67.4], yaw: PI / 2, scale: 1.1},
  {id: 'flood-terminal', model: 'apron_floodlight', pos: [80, -72], yaw: PI / 2, scale: 1.3},
  {id: 'flood-club', model: 'apron_floodlight', pos: [80, -46.5], yaw: PI / 2, scale: 1.3},
  {id: 'flood-hangar', model: 'apron_floodlight', pos: [85.5, -32.5], yaw: PI / 2, scale: 1.3},
]);
export const WINDSOCK = Object.freeze({model: 'windsock', pos: [137, -84], scale: 1.4});

/** Cessnas tied down on the GA row (one is being fuelled). */
export const PARKED_AIRCRAFT = Object.freeze([
  {id: 'G-CLVR', pos: [82.5, -4], yaw: PI / 2},
  {id: 'G-THBK', pos: [95.5, -6], yaw: 0},
]);
export const CESSNA_SCALE = 1.5;

/** Service pad for the fuel farm and the GA row (a surface, not a building). */
export const SERVICE_PAD = Object.freeze({x: 89.5, z: 1.5, w: 19, d: 15});

// Runway 18/36 (x 118.5..129.5) and the taxiway / link edges carry instanced
// pack lights; both sets switch on with the town's practical-light factor.
const range = (a, b, step) => { const out = []; for (let v = a; v <= b + 1e-9; v += step) out.push(+v.toFixed(3)); return out; };
export const RUNWAY = Object.freeze({x: 124, half: 5.5, z0: -108, z1: 10});
export const RUNWAY_EDGE_LIGHTS = Object.freeze([118.2, 129.8].flatMap((x) => range(-105, 7, 8).map((z) => ({pos: [x, z], yaw: x < 124 ? -PI / 2 : PI / 2}))));
export const TAXIWAY_LIGHTS = Object.freeze([
  ...range(-76, -8, 8).map((z) => ({pos: [112.3, z]})),
  ...range(104, 116, 4).map((x) => ({pos: [x, -87.8]})),
  ...range(110, 114, 4).map((x) => ({pos: [x, 5.8]})),
]);

/** Oriented footprint (centre, half extents, yaw) of a placed model. */
export function placedFootprint({model, pos, yaw = 0, scale = 1}) {
  const {min, max} = AIRFIELD_MODELS[model];
  const cx = (min[0] + max[0]) / 2 * scale, cz = (min[2] + max[2]) / 2 * scale;
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return {
    centre: [pos[0] + cx * c + cz * s, pos[1] - cx * s + cz * c],
    half: [(max[0] - min[0]) / 2 * scale, (max[2] - min[2]) / 2 * scale],
    yaw, height: max[1] * scale,
  };
}
/** Axis-aligned bounds [minX, maxX, minZ, maxZ] of a footprint. */
export function footprintBox(f) {
  const s = Math.abs(Math.sin(f.yaw)), c = Math.abs(Math.cos(f.yaw));
  const hx = f.half[0] * c + f.half[1] * s, hz = f.half[0] * s + f.half[1] * c;
  return [f.centre[0] - hx, f.centre[0] + hx, f.centre[1] - hz, f.centre[1] + hz];
}
export const structureFootprints = () => STRUCTURES.map((s) => ({id: s.id, ...placedFootprint(s)}));
export const parkedFootprints = () => PARKED_AIRCRAFT.map((p) => ({id: p.id, ...placedFootprint({model: 'light_aircraft_cessna', pos: p.pos, yaw: p.yaw, scale: CESSNA_SCALE})}));

// ---------------------------------------------------------------- night glow
// Fixtures in the landmark-glow format (night-landmarks.js): one batched draw
// per primitive, switched by setLandmarkNight with the town's night factor.
export const AIRFIELD_COLORS = Object.freeze({edge: '#fff0c4', blue: '#5f9dff', green: '#7dffa8', red: '#ff3a24', flood: '#fff1d2', window: '#ffd58f', white: '#f4f8ff'});
export const BEACON_HEAD = Object.freeze({pos: [68.5, 7.05, -76]});

export function airfieldFixtures() {
  const list = [], counts = {}, C = AIRFIELD_COLORS;
  const add = (kind, role, prim, data) => { counts[kind] = (counts[kind] || 0) + 1; list.push({site: 'airfield', kind, role, prim, key: `airfield:${kind}:${counts[kind]}`, ...data}); };
  for (const {pos: [x, z]} of RUNWAY_EDGE_LIGHTS) {
    const end = z <= -100 || z >= 4;
    add('runway-edge', end ? 'threshold' : 'edge', 'halo', {pos: [x, .62, z], size: 1.5, color: end ? C.green : C.edge, intensity: 1.1});
  }
  for (const {pos: [x, z]} of TAXIWAY_LIGHTS) add('taxiway-edge', 'edge', 'halo', {pos: [x, .62, z], size: 1.15, color: C.blue, intensity: 1.2});
  // PAPI: two white over two red, as seen on a correct glide path.
  for (let i = 0; i < 4; i++) add('papi', i < 2 ? 'white' : 'red', 'halo', {pos: [133.5 - 0.9 + i * .6, .55, -3.6], size: .9, color: i < 2 ? C.white : C.red, intensity: 1.2});
  // Tower cab glow, a red obstruction light on the mast, cab windows.
  const tower = STRUCTURES.find((s) => s.id === 'tower');
  add('tower', 'cab', 'wash', {pos: [tower.pos[0], 10.1, tower.pos[1]], radius: 2.35, height: 1.9, color: C.window, intensity: .7});
  add('tower', 'obstruction', 'beacon', {pos: [tower.pos[0], 13.6, tower.pos[1]], radius: .16, halo: 1.6});
  // Rotating airport beacon: green / white beams swept by a follow object.
  add('beacon', 'green', 'beam', {pos: [0, 0, 0], dir: [1, -.04, 0], radius: .7, length: 26, color: C.green, intensity: .55, follow: 'beaconHead'});
  add('beacon', 'white', 'beam', {pos: [0, 0, 0], dir: [-1, -.04, 0], radius: .7, length: 26, color: C.white, intensity: .55, follow: 'beaconHead'});
  add('beacon', 'lamp', 'halo', {pos: BEACON_HEAD.pos, size: 2.2, color: C.green, intensity: .9});
  // Apron floodlights: lamp halo, a downward cone and a pool on the apron.
  for (const f of AIRSIDE.filter((a) => a.model === 'apron_floodlight')) {
    const [x, z] = f.pos, head = [x + .25, 7.6, z];
    add('apron-flood', f.id, 'halo', {pos: head, size: 1.6, color: C.flood, intensity: 1});
    add('apron-flood', f.id, 'cone', {pos: head, aim: [x + 7, 0, z], spread: .42, length: 9.5, color: C.flood, intensity: .38});
    add('apron-flood', f.id, 'card', {pos: [x + 6.5, .2, z], size: [11, 11], color: C.flood, intensity: .3});
  }
  // Warm windows: terminal front and side, the club office porch, hangar door.
  add('windows', 'terminal-front', 'card', {pos: [77, 1.7, -56.2], normal: [0, 0, 1], size: [7.4, 2.6], color: C.window, intensity: .5});
  add('windows', 'terminal-side', 'card', {pos: [81.2, 1.7, -61.6], normal: [1, 0, 0], size: [6.2, 2.4], color: C.window, intensity: .38});
  add('windows', 'club-porch', 'card', {pos: [84.6, 1.8, -46.4], normal: [0, 0, 1], size: [3, 2.4], color: C.window, intensity: .4});
  add('windows', 'hangar-door', 'card', {pos: [86, 2.6, -20], normal: [1, 0, 0], size: [8.5, 4.6], color: C.window, intensity: .3});
  add('windows', 'canopy', 'card', {pos: [83, .2, -60], size: [3.6, 7], color: C.window, intensity: .35});
  add('windows', 'fire-bay', 'card', {pos: [96, 2.2, -94.3], normal: [0, 0, 1], size: [5.6, 3.6], color: C.window, intensity: .3});
  return list;
}
export const AIRFIELD_REQUIRED_KINDS = Object.freeze({'runway-edge': 28, 'taxiway-edge': 10, papi: 4, tower: 2, beacon: 3, 'apron-flood': 9, windows: 4});
