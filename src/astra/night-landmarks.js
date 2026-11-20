// OWNER: night-landmarks lane (docs/specs/NIGHT-LANDMARKS.md, TOWN-28).
// Pure fixture registry for the two night showpieces: Starbase Texas and the
// Roadster proving ground. Every fixture is plain data (no THREE objects):
// site, kind, role, one render primitive and its local position. The glow
// module (landmark-glow.js) turns the lists into a handful of batched draws.
//
// Frames. Starbase fixtures are local to the `Starbase Texas` root (the same
// frame as starbase.js's box/cylinder calls). Arena fixtures are local to the
// `Roadster proving ground` root (DEMO origin). Fixtures with `follow` are local
// to a moving object (a rocket, the strongback, the performing Roadster body)
// and are re-placed from that object every update.
//
// These are not lamp posts: nothing here is registered with lamp-posts.js.
//
// Primitives:
//   cone   additive light cone, apex `pos` aimed at `aim` (floods, uplights, headlight beams)
//   beam   additive sky beam from `pos` along `dir` for `length`
//   card   additive radial glow on a plane (ground pools, sign backlights), facing `normal`
//   halo   additive camera-facing glow sprite
//   wash   additive rim-lit open cylinder (tank bodies, rocket hulls)
//   bulb   solid emissive sphere          lens  solid emissive box facing `facing`
//   strip  solid emissive bar `a`→`b`     ring  solid emissive hoop (horizontal)
//   beacon red aviation bulb + halo that blink
//   mast   toon steel stadium mast (structure only; its lamps are lens/halo/cone fixtures)
import {DEMO, RAMP, LINEUP, ROW_AXIS, LINEUP_JUMP, HOVER_PAD, rampContact} from './tesla/demo-motion.js';
import {LANDMARK_COLORS} from './landmark-look.js';

export {LANDMARK_LOOK, LANDMARK_COLORS, emitterLevel, beaconFlash, beaconLevel} from './landmark-look.js';

const SB = LANDMARK_COLORS.starbase, AR = LANDMARK_COLORS.arena;
const TAU = Math.PI * 2;
const inBox = ([x, z], [x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };

/** Mechazilla, pads and vehicles, in Starbase-root coordinates (starbase.js). */
export const STARBASE_SITE = Object.freeze({
  tower: {x: 11, z: -24, top: 37.55, platform: 37.1, columns: 2},
  olp: {x: 20, z: -24, radius: 10.5, y: .5},
  lc2: {x: 48, z: 12, radius: 10, y: .6},
  tanks: Array.from({length: 6}, (_, i) => [28 + (i % 3) * 5, -11 + Math.floor(i / 3) * 7]),
  poles: [[39, 7], [57, 7], [57, 20]],
  lz: [[-8, 43], [27, 55]],
  // Rocket tops above each root origin (rocket(): body h, plus 3 m nose on ship/upper).
  rockets: {
    ship: {top: 12, radius: 1.45, body: 9, rest: 21.4},
    booster: {top: 18, radius: 1.45, body: 18, rest: 3},
    f9: {top: 13, radius: .7, body: 13, rest: 2},
    upper: {top: 8, radius: .7, body: 5, rest: 15},
    side0: {top: 13, radius: .7, body: 13, rest: 2},
    side1: {top: 13, radius: .7, body: 13, rest: 2},
  },
  garden: [{kind: 'ship', x: -24, z: -15}, {kind: 'booster', x: -9, z: -17}, {kind: 'ship', x: 0, z: -34}],
  strongbackTop: 18,
});

function registry(site) {
  const list = [], counts = {};
  const add = (kind, role, prim, data) => {
    counts[kind] = (counts[kind] || 0) + 1;
    const f = {site, kind, role, prim, key: `${site}:${kind}:${counts[kind]}`, ...data};
    list.push(f); return f;
  };
  return {list, add};
}

export function starbaseFixtures() {
  const {list, add} = registry('starbase'), S = STARBASE_SITE, {x: tx, z: tz} = S.tower;
  const olp = [S.olp.x, S.olp.z], lc2 = [S.lc2.x, S.lc2.z];

  // Launch-tower floods: banks on the top platform and the mid (y 18) and low
  // (y 10) decks, aimed at the stacked ship, the booster and the pad.
  const flood = (role, pos, aim, spread = .3, intensity = 1) => {
    const facing = norm(aim.map((v, i) => v - pos[i]));
    add('tower-flood', role, 'lens', {pos, size: [.9, .55, .14], facing, color: SB.flood, intensity: 1.7});
    add('tower-flood', role, 'halo', {pos: pos.map((v, i) => v + facing[i] * .3), size: 3.2, color: SB.flood, intensity: .85});
    add('tower-flood', role, 'cone', {pos, aim, spread, length: Math.hypot(...aim.map((v, i) => v - pos[i])) * 1.12, color: SB.flood, intensity});
  };
  const top = S.tower.platform - .6, ex = tx + 2.95;
  flood('top-platform', [ex, top, tz - 1.6], [olp[0], 29, olp[1] - .6], .2);
  flood('top-platform', [ex, top, tz], [olp[0], 22, olp[1]], .24);
  flood('top-platform', [ex, top, tz + 1.6], [olp[0] + 1, 2, olp[1] + .6], .3, .8);
  flood('top-platform', [tx + 1.4, top, tz - 2.95], [olp[0] + 4, .6, olp[1] - 9], .34, .7);
  flood('top-platform', [tx + 1.4, top, tz + 2.95], [olp[0] + 5, .6, olp[1] + 8], .34, .7);
  flood('mid-deck', [ex - .4, 18.3, tz - 1.2], [olp[0], 30, olp[1]], .22);
  flood('mid-deck', [ex - .4, 18.3, tz + 1.2], [olp[0], 8, olp[1]], .26);
  flood('low-deck', [ex - .4, 10.3, tz], [olp[0], 1, olp[1]], .3, .8);

  // Uplights at the four lattice column bases: the tower reads as a lit object.
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
    const base = [tx + dx * 2.75, .35, tz + dz * 2.75];
    add('tower-uplight', 'column', 'cone', {pos: base, aim: [tx + dx * 2.1, 37, tz + dz * 2.1], spread: .045, length: 36, color: SB.steel, intensity: 1.1});
    add('tower-uplight', 'column', 'bulb', {pos: base, radius: .26, color: SB.steel, intensity: 1.6});
  }
  add('tower-uplight', 'base-pool', 'card', {pos: [tx, .34, tz], size: [12, 12], color: SB.steel, intensity: .55});

  // Sky beams: four slender searchlight columns from the OLP-1 pad corners,
  // fanned a little off vertical so they read in the isometric view.
  const beamDirs = [[.2, 1, .07], [.13, 1, -.15], [-.12, 1, -.17], [-.21, 1, .09]];
  [45, 135, 225, 315].forEach((deg, i) => {
    const a = deg * Math.PI / 180, pos = [olp[0] + Math.sin(a) * 9.8, .9, olp[1] + Math.cos(a) * 9.8];
    add('sky-beam', 'searchlight', 'beam', {pos, dir: norm(beamDirs[i]), length: 150, radius: 4.2, color: SB.steel, intensity: 1});
    add('sky-beam', 'searchlight', 'bulb', {pos: [pos[0], 1.05, pos[2]], radius: .42, color: SB.flood, intensity: 2});
    add('sky-beam', 'searchlight', 'halo', {pos: [pos[0], 1.3, pos[2]], size: 5, color: SB.steel, intensity: 1});
    add('sky-beam', 'housing', 'searchlight', {pos: [pos[0], .5, pos[2]], radius: .55, height: .8});
  });

  // Tank farm: two ice hoops per vertical tank, a rim-lit body wash, apron pools,
  // and a faint frost line along the transfer pipes.
  for (const [x, z] of S.tanks) {
    for (const y of [1.9, 4.5]) add('tank-glow', 'hoop', 'ring', {pos: [x, y, z], radius: 1.86, tube: .075, color: SB.ice, intensity: 1.5});
    add('tank-glow', 'cap-ring', 'ring', {pos: [x, 6.42, z], radius: 1.42, tube: .06, color: SB.frost, intensity: 1.2});
    add('tank-glow', 'body', 'wash', {pos: [x, .1, z], radius: 1.88, height: 6.2, color: SB.ice, intensity: .8});
    add('tank-glow', 'pool', 'card', {pos: [x, .42, z], size: [7.5, 7.5], color: SB.ice, intensity: .42});
  }
  for (let i = 0; i < 3; i++) add('tank-glow', 'horizontal', 'card', {pos: [30 + i * 4, .42, -19], size: [5, 9], color: SB.ice, intensity: .3});
  add('tank-glow', 'apron', 'card', {pos: [35, .41, -7], size: [24, 17], color: SB.frost, intensity: .2});
  for (const [a, b] of [[[25, .6, -23], [25, .6, 1]], [[44, .6, -23], [44, .6, 1]], [[20, .6, -23], [44, .6, -23]]])
    add('tank-glow', 'pipe-frost', 'strip', {a, b, width: .3, color: SB.ice, intensity: .22});

  // Red aviation beacons: Mechazilla cap and top-platform corners, mid tower,
  // the strongback top, the three 20.5 m poles, and every tall rocket.
  const beacon = (role, pos, radius = .3, extra = {}) => add('beacon', role, 'beacon', {pos, radius, halo: radius * 9, ...extra});
  beacon('tower-cap', [tx, S.tower.top + .35, tz], .42);
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) beacon('tower-cap', [tx + dx * 2.75, S.tower.platform + .22, tz + dz * 2.75], .28);
  beacon('mid-tower', [tx + 2.4, 18.45, tz - 2.4]); beacon('mid-tower', [tx - 2.4, 18.45, tz + 2.4]);
  beacon('strongback', [0, S.strongbackTop + .3, 0], .32, {follow: 'strongback'});
  for (const [x, z] of S.poles) beacon('pole', [x, 21.2, z], .34);
  for (const [name, r] of Object.entries(S.rockets)) beacon('rocket', [0, r.top + .15, 0], .26, {follow: name});
  for (const g of S.garden) beacon('garden-rocket', [g.x, .3 + S.rockets[g.kind].top + .15, g.z], .26);

  // Lit hulls: ground uplight cones on the OLP-1 stack and the Falcon on LC-2,
  // plus a rim wash that rides each vehicle (fades as it climbs off the pad).
  for (const [x, z] of [[24.6, -21.4], [24.6, -26.6], [17.4, -19.6]]) {
    add('rocket-uplight', 'olp-1', 'cone', {pos: [x, .6, z], aim: [olp[0], 30, olp[1]], spread: .07, length: 33, color: SB.flood, intensity: .85});
    add('rocket-uplight', 'olp-1', 'bulb', {pos: [x, .62, z], radius: .3, color: SB.flood, intensity: 1.8});
  }
  for (const [x, z] of [[51.6, 14.8], [44.4, 14.8], [51.8, 9.6]]) {
    add('rocket-uplight', 'lc-2', 'cone', {pos: [x, .7, z], aim: [lc2[0], 19, lc2[1]], spread: .06, length: 21, color: SB.flood, intensity: .8});
    add('rocket-uplight', 'lc-2', 'bulb', {pos: [x, .72, z], radius: .26, color: SB.flood, intensity: 1.8});
  }
  for (const g of S.garden) {
    const r = S.rockets[g.kind];
    add('rocket-uplight', 'garden', 'cone', {pos: [g.x + 2.6, .35, g.z + 1.6], aim: [g.x, r.body * .85, g.z], spread: .1, length: r.body, color: SB.flood, intensity: .6});
    add('rocket-uplight', 'garden', 'wash', {pos: [g.x, .3, g.z], radius: r.radius * 1.08, height: r.body, color: SB.steel, intensity: .7});
  }
  for (const [name, r] of Object.entries(S.rockets))
    add('rocket-uplight', 'hull', 'wash', {pos: [0, 0, 0], radius: r.radius * 1.08, height: r.body, color: SB.steel, intensity: .85, follow: name, fade: {restY: r.rest, span: 14}});

  // Pads: big ground pools, the pale OLP-1 ring goes emissive, LC-2 gets a ring
  // too, and the flame-trench walls pick up a hard white line.
  add('pad-glow', 'olp-1', 'card', {pos: [olp[0], .52, olp[1]], size: [30, 30], color: SB.flood, intensity: .6});
  add('pad-glow', 'olp-1', 'ring', {pos: [olp[0], .53, olp[1]], radius: 9.7, tube: .18, color: SB.flood, intensity: 1.8});
  add('pad-glow', 'olp-1', 'ring', {pos: [olp[0], 2.62, olp[1]], radius: 2.05, tube: .1, color: SB.steel, intensity: 1.4});
  add('pad-glow', 'lc-2', 'card', {pos: [lc2[0], .62, lc2[1]], size: [25, 25], color: SB.flood, intensity: .5});
  add('pad-glow', 'lc-2', 'ring', {pos: [lc2[0], .63, lc2[1]], radius: 9.3, tube: .15, color: SB.flood, intensity: 1.6});
  for (const x of [16.5, 23.5]) add('pad-glow', 'trench-edge', 'strip', {a: [x, 1.84, -43.8], b: [x, 1.84, -24.8], width: .16, color: SB.warm, intensity: 1.6});
  add('pad-glow', 'trench', 'card', {pos: [olp[0], .78, -34], size: [6, 20], color: SB.warm, intensity: .45});

  // LZ-1 and LZ-2: the twelve gold orbs on each ring light up, plus the inner ring.
  for (const [x, z] of S.lz) {
    for (let n = 0; n < 12; n++) {
      const a = n * Math.PI / 6, pos = [x + Math.sin(a) * 11.3, .45, z + Math.cos(a) * 11.3];
      add('lz-light', 'orb', 'bulb', {pos, radius: .22, color: SB.gold, intensity: 1.6});
      add('lz-light', 'orb', 'halo', {pos: [pos[0], .7, pos[2]], size: 1.7, color: SB.gold, intensity: .8});
    }
    add('lz-light', 'target-ring', 'ring', {pos: [x, .41, z], radius: 7.7, tube: .15, color: SB.gold, intensity: 1.2});
    add('lz-light', 'pool', 'card', {pos: [x, .37, z], size: [26, 26], color: SB.gold, intensity: .28});
  }

  // Apron necklace: in-ground lights outlining OLP-1 and LC-2.
  const necklace = (role, [cx, cz], r, n, keepOut) => {
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      if (keepOut.some((b) => inBox([x, z], b))) continue;
      add('perimeter', role, 'bulb', {pos: [x, .42, z], radius: .2, color: SB.flood, intensity: 1.7});
      add('perimeter', role, 'halo', {pos: [x, .65, z], size: 1.5, color: SB.steel, intensity: .7});
      add('perimeter', role, 'card', {pos: [x, .36, z], size: [4.2, 4.2], color: SB.steel, intensity: .4});
    }
  };
  necklace('olp-1', olp, 12.4, 20, PERIMETER_KEEP_OUT.olp);
  necklace('lc-2', lc2, 11.6, 16, PERIMETER_KEEP_OUT.lc2);

  // Modest backlight on the STARBASE / TEXAS garden sign.
  add('sign-backlight', 'garden-sign', 'card', {pos: [-42, 3.4, 31.8], normal: [0, 0, 1], size: [27, 7], color: SB.sign, intensity: .42});
  add('sign-backlight', 'garden-sign', 'card', {pos: [-42, .37, 34.6], size: [23, 5], color: SB.sign, intensity: .3});
  return list;
}

/** Footprints the apron lights stay off (roads, trench, tower, tanks, pipes, poles, labels). */
export const PERIMETER_KEEP_OUT = Object.freeze({
  olp: [[15.6, 24.4, -46, -24], [17.4, 22.6, -24, 2], [7.6, 14.4, -27.4, -20.6], [27.6, 40.4, -23, -15], [25.6, 30.4, -13.4, -8.6], [24.3, 25.7, -23.6, 1.6], [19.5, 44.5, -23.7, -22.3]],
  lc2: [[45.4, 50.6, -1, 12], [-99, 99, -3.4, 3.4], [38, 40, 6, 8], [56, 58, 6, 8], [56, 58, 19, 21], [38.6, 57.4, 21.6, 24.4], [43.3, 44.7, -23.6, 1.6]],
});

// --------------------------------------------------------------- Roadster arena

/** Lamp spots on each Tesla body, unscaled car-local: [half spread, y, z]
 * (measured from the tagged lamp meshes in models.js / lineup-models.js). */
export const CAR_LAMPS = Object.freeze({
  cybercab: {head: [.3, .325, 1.0], tail: [.28, .44, -.98]},
  cybertruck: {head: [.38, .555, 1.405], tail: [.38, .61, -1.405]},
  semi: {head: [.48, .64, 1.6], tail: [.3, .47, -1.765]},
  crossover: {head: [.33, .47, 1.07], tail: [.3, .54, -1.125]},
  sedan: {head: [.33, .35, 1.05], tail: [.32, .5, -1.095]},
  roadster: {head: [.25, .41, 1.165], tail: [.3, .42, -1.168]},
});

/** Grandstand-local point -> arena-local (arena.js standTransform:
 * T(18,0,-11.5) · Ry(-90°) · S(.6,1,.85) · T(-8.5,0,15.3)). */
export function standPoint(x, y, z) { return [18 - .85 * (z + 15.3), y, -11.5 + .6 * (x - 8.5)]; }

/** Stadium masts on the lot verge (outside the kerbs): four corners plus a ramp pair. */
export const ARENA_MASTS = Object.freeze([
  {role: 'corner-nw', x: -22.3, z: -20.4, height: 14, aim: [-12.5, DEMO.ground, -8.5], spread: .3},
  {role: 'corner-sw', x: -22.3, z: 20.4, height: 13, aim: [-6.5, DEMO.ground, 13], spread: .3},
  {role: 'corner-se', x: 22.3, z: 20.4, height: 13, aim: [9.5, DEMO.ground, 5.5], spread: .3},
  {role: 'corner-ne', x: 22.3, z: -20.4, height: 14, aim: [2, DEMO.ground, -.5], spread: .27},
  {role: 'ramp-north', x: -22.3, z: -12, height: 11.5, aim: [-13, 7, -10.5], spread: .26},
  {role: 'ramp-south', x: -22.3, z: -1.5, height: 9.5, aim: [-13, 1.8, -5], spread: .26},
].map(Object.freeze));

/** Orientation of a mast's lamp bank: yaw toward the aim, pitched down at it. */
export function mastFrame(m) {
  const yaw = Math.atan2(m.aim[0] - m.x, m.aim[2] - m.z);
  const centre = [m.x + Math.sin(yaw) * .35, m.height + .95, m.z + Math.cos(yaw) * .35];
  const pitch = Math.atan2(centre[1] - m.aim[1], Math.hypot(m.aim[0] - centre[0], m.aim[2] - centre[2]));
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  return {yaw, pitch, centre, forward: [sy * cp, -sp, cy * cp], right: [cy, 0, -sy], up: [sy * sp, cp, cy * sp]};
}
export const MAST_BANK = Object.freeze({columns: [-1.05, -.35, .35, 1.05], rows: [-.3, .3], housing: [.62, .5, .32]});

export function arenaFixtures() {
  const {list, add} = registry('arena'), g = DEMO.ground;
  const along = (p, v, k) => p.map((c, i) => c + v[i] * k);

  // Stadium masts: toon steel structure + a bank of eight lenses, a halo per
  // lens and per bank, one wide downward cone and a pool where it lands.
  for (const m of ARENA_MASTS) {
    const f = mastFrame(m);
    add('mast', m.role, 'mast', {pos: [m.x, 0, m.z], height: m.height, aim: m.aim, yaw: f.yaw, pitch: f.pitch});
    for (const u of MAST_BANK.columns) for (const v of MAST_BANK.rows) {
      const c = along(along(along(f.centre, f.right, u), f.up, v), f.forward, .18);
      add('mast-lamp', m.role, 'lens', {pos: c, size: [.52, .4, .05], facing: f.forward, color: AR.flood, intensity: 1.8});
      add('mast-lamp', m.role, 'halo', {pos: along(c, f.forward, .25), size: 1.5, color: AR.flood, intensity: .55});
    }
    add('mast-lamp', m.role, 'halo', {pos: along(f.centre, f.forward, .6), size: 6, color: AR.flood, intensity: .75});
    const apex = along(f.centre, f.forward, .25), length = Math.hypot(...m.aim.map((v, i) => v - apex[i]));
    add('mast-cone', m.role, 'cone', {pos: apex, aim: m.aim, spread: m.spread, length: length * 1.06, color: AR.flood, intensity: 1.7});
    add('mast-cone', m.role, 'card', {pos: [m.aim[0], g + .03, m.aim[2]], size: [length * m.spread * 2.3, length * m.spread * 2.3], color: AR.flood, intensity: .65});
  }

  // Grandstand: halo behind both ROADSTER PROVING GROUND boards, LED edges on
  // the board, lit amber seat rails, downlights from the board and a stand pool.
  const sp = (x, y, z) => standPoint(x, y, z);
  add('sign-glow', 'front', 'card', {pos: sp(8.5, 4.55, -19.5), normal: [-1, 0, 0], size: [17.5, 7], color: AR.sign, intensity: 1.5});
  add('sign-glow', 'back', 'card', {pos: sp(8.5, 4.55, -18.5), normal: [1, 0, 0], size: [17.5, 7], color: AR.sign, intensity: 1.5});
  for (const [y, z] of [[5.48, -18.84], [3.52, -18.84], [5.48, -19.16], [3.52, -19.16]])
    add('sign-glow', z > -19 ? 'front-edge' : 'back-edge', 'strip', {a: sp(-1.9, y, z), b: sp(18.9, y, z), width: .07, color: AR.cream, intensity: 1.7});
  for (const [y, z] of [[1.18, -13.66], [2.03, -16.06]])
    add('grandstand', 'seat-rail', 'strip', {a: sp(-2.4, y, z), b: sp(19.4, y, z), width: .07, color: AR.amber, intensity: 1.7});
  add('grandstand', 'front-rail', 'strip', {a: sp(-3, .95, -11.8), b: sp(20, .95, -11.8), width: .05, color: AR.cream, intensity: .9});
  for (const x of [.5, 6, 11, 16.5]) {
    const pos = sp(x, 3.42, -18.72);
    add('grandstand', 'downlight', 'cone', {pos, aim: sp(x, 1.3, -14.2), spread: .42, length: 5.2, color: AR.flood, intensity: .7});
    add('grandstand', 'downlight', 'bulb', {pos, radius: .13, color: AR.flood, intensity: 2});
  }
  add('grandstand', 'stand-pool', 'card', {pos: sp(8.5, 2.14, -15.1), size: [7, 14.6], color: AR.flood, intensity: .5});

  // Track LEDs: both suction-ramp edges, the lot kerbs, the amber row axis,
  // takeoff / touchdown marks and the hover ring.
  const N = 36;
  for (const x of [-14.66, -11.34]) for (let i = 0; i < N; i++) {
    const at = (a) => { const p = rampContact(a); return [x, p.y + .07 * Math.cos(a), p.z + .07 * Math.sin(a)]; };
    add('track-led', 'ramp-edge', 'strip', {a: at(RAMP.end * i / N), b: at(RAMP.end * (i + 1) / N), width: .075, color: AR.cream, intensity: 1.8});
  }
  for (const side of [-1, 1]) {
    add('track-led', 'kerb', 'strip', {a: [side * 21.65, .54, -19.6], b: [side * 21.65, .54, 19.6], width: .09, color: AR.cream, intensity: 1.3});
    add('track-led', 'kerb', 'strip', {a: [-21.6, .54, side * 19.7], b: [21.6, .54, side * 19.7], width: .09, color: AR.cream, intensity: 1.3});
  }
  for (let x = -13; x < 19; x += 1) add('track-led', 'row-axis', 'strip', {a: [x - .21, .272, ROW_AXIS.z], b: [x + .21, .272, ROW_AXIS.z], width: .05, color: AR.amber, intensity: 1.7});
  add('track-led', 'takeoff', 'strip', {a: [LINEUP_JUMP.takeoffX, .276, ROW_AXIS.z - 1.28], b: [LINEUP_JUMP.takeoffX, .276, ROW_AXIS.z + 1.28], width: .1, color: AR.cream, intensity: 1.9});
  for (const z of [.25, 2.75]) add('track-led', 'touchdown', 'strip', {a: [15.82, .272, z], b: [20.18, .272, z], width: .07, color: AR.cream, intensity: 1.7});
  add('track-led', 'hover-ring', 'ring', {pos: [HOVER_PAD.x, .285, HOVER_PAD.z], radius: 2.615, tube: .065, color: AR.amber, intensity: 1.9});
  add('track-led', 'hover-pool', 'card', {pos: [HOVER_PAD.x, .27, HOVER_PAD.z], size: [8, 8], color: AR.amber, intensity: .45});

  // Parked lineup: bright head and tail lamps, a short beam from each
  // headlamp and a ground slash in front of every car. The performing
  // Roadster's set follows its body (body-local, unscaled).
  for (const v of LINEUP) {
    const s = DEMO.carScale, L = CAR_LAMPS[v.kind], [hx, hy, hz] = L.head, [tx, ty, tz] = L.tail;
    const front = v.z + hz * s;
    for (const side of [-1, 1]) {
      const head = [v.x + side * hx * s, g + hy * s, front + .04];
      add('car-head', v.kind, 'halo', {pos: head, size: 1.5, color: AR.head, intensity: 1, car: v.kind});
      add('car-tail', v.kind, 'halo', {pos: [v.x + side * tx * s, g + ty * s, v.z + tz * s - .04], size: 1.05, color: AR.red, intensity: 1, car: v.kind});
      add('car-beam', v.kind, 'cone', {pos: head, aim: [v.x + side * (hx * s + .35), g, front + 4.2], spread: .3, length: 4.6, color: AR.head, intensity: .7, car: v.kind});
    }
    add('car-beam', v.kind, 'card', {pos: [v.x, g + .025, front + 2.6], size: [2.5, 4.4], color: AR.head, intensity: .55, car: v.kind});
  }
  {
    const [hx, hy, hz] = CAR_LAMPS.roadster.head, [tx, ty, tz] = CAR_LAMPS.roadster.tail, follow = 'roadster';
    for (const side of [-1, 1]) {
      add('car-head', 'roadster', 'halo', {pos: [side * hx, hy, hz + .03], size: 1.2, color: AR.head, intensity: 1, follow});
      add('car-tail', 'roadster', 'halo', {pos: [side * tx, ty, tz - .03], size: .85, color: AR.red, intensity: 1, follow});
      add('car-beam', 'roadster', 'cone', {pos: [side * hx, hy, hz + .03], aim: [side * (hx + .25), 0, hz + 3.3], spread: .3, length: 3.5, color: AR.head, intensity: .65, follow});
    }
  }
  return list;
}

export function landmarkFixtures() { return [...starbaseFixtures(), ...arenaFixtures()]; }

/** Kinds each site must carry, with a floor on the count (tests/night-landmarks). */
export const REQUIRED_KINDS = Object.freeze({
  starbase: {'tower-flood': 8, 'sky-beam': 2, 'tank-glow': 6, beacon: 12, 'pad-glow': 4, 'lz-light': 24, perimeter: 12, 'rocket-uplight': 6, 'tower-uplight': 4},
  arena: {mast: 4, 'mast-lamp': 32, 'mast-cone': 4, grandstand: 4, 'sign-glow': 2, 'track-led': 40, 'car-head': 10, 'car-tail': 10, 'car-beam': 10},
});
