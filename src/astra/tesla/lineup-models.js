import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonVertexColorMaterial, outlineMaterial } from '../../toon.js';
import { LANDMARK_LOOK, emitterLevel } from '../landmark-look.js';

// Stylised, logo-free Teslas for the Roadster lineup and town traffic.
// Every body is a loft of 8-point cross-sections (bottom, rocker, belt, roof
// on each side) swept front to back, painted per face with vertex colours so
// a whole car is ONE toon mesh + ONE ink hull + two emissive light meshes +
// one mesh per wheel. +Z is forward; the origin is the ground contact point.
// Units: ~0.49 per metre (town traffic scale), toy-sized wheels.

const INK = '#22333a', GLASS = '#2a4250', ROOF_GLASS = '#1d2c33', TRIM = '#2c3b40', RIM = '#9fb0b4';
const linear = hex => new THREE.Color(hex);

// Lamp colours, preallocated (animate runs every frame). Head lamps switch to
// night white at the streetlamp threshold; on stage (the arena lineup and the
// performing Roadster) both lamps are also pushed into HDR so they read and
// bloom after dark (TOWN-28). Braking keeps its own tint.
const HEAD_DAY = new THREE.Color('#e5eedc'), HEAD_NIGHT = new THREE.Color('#fffde1');
const TAIL = new THREE.Color('#fa7961'), BRAKE = new THREE.Color('#ffb58d');
export function stageLamps(light, tail, night = 0, braking = false, stage = false) {
  tail.color.copy(braking ? BRAKE : TAIL); light.color.copy(night > LANDMARK_LOOK.headOn ? HEAD_NIGHT : HEAD_DAY);
  if (!stage) return;
  const k = emitterLevel(night);
  light.color.multiplyScalar(1 + LANDMARK_LOOK.carHead * k); tail.color.multiplyScalar(1 + LANDMARK_LOOK.carTail * k);
}

// station: {z, y:[bottom, rocker, belt, (windowTop,) roof], w:[same], zone}
// zone names the segment from this station to the next one behind it. The
// optional window-top point splits the greenhouse into side glass and an
// upper band (roof rail / steel band); by default it sits 86% of the way up.
// Faces around the 10-point ring: 0 bottom, 1/9 lower, 2/8 side, 3/7 glass,
// 4/6 upper band, 5 roof.
const FACE = ['bottom', 'lower', 'side', 'glass', 'upper', 'roof', 'upper', 'glass', 'side', 'lower'], N = FACE.length;
function ring({ y, w }) {
  const top = (a, f = .86) => a.length === 5 ? a : [a[0], a[1], a[2], a[2] + (a[3] - a[2]) * f, a[3]];
  const [yb, yr, ye, yu, yt] = top(y), [wb, wr, we, wu, wt] = top(w);
  return [[-wb, yb], [wb, yb], [wr, yr], [we, ye], [wu, yu], [wt, yt], [-wt, yt], [-wu, yu], [-we, ye], [-wr, yr]];
}

// Builds both the flat-shaded, vertex-coloured body and an indexed, smooth
// normal copy for the inverted-hull outline (so the ink line never cracks).
function loft(stations, paintOf) {
  const pos = [], col = [], hull = [], index = [];
  const rings = stations.map(s => ring(s).map(([x, y]) => new THREE.Vector3(x, y, s.z)));
  rings.forEach(r => r.forEach(v => hull.push(v.x, v.y, v.z)));
  const tri = (a, b, c, color) => {
    const e1 = b.clone().sub(a), e2 = c.clone().sub(a);
    if (e1.cross(e2).length() < 1e-7) return;
    const k = linear(color);
    for (const v of [a, b, c]) { pos.push(v.x, v.y, v.z); col.push(k.r, k.g, k.b); }
  };
  for (let n = 0; n < rings.length - 1; n++) for (let k = 0; k < N; k++) {
    const k2 = (k + 1) % N, a = rings[n][k], b = rings[n][k2], c = rings[n + 1][k2], d = rings[n + 1][k];
    const color = paintOf(stations[n].zone, FACE[k]);
    tri(a, c, b, color); tri(a, d, c, color);
    const ia = n * N + k, ib = n * N + k2;
    index.push(ia, ib + N, ib, ia, ia + N, ib + N);
  }
  const last = rings.length - 1;
  for (let k = 1; k < N - 1; k++) {
    const part = 'cap';
    tri(rings[0][0], rings[0][k], rings[0][k + 1], paintOf('front', part));
    tri(rings[last][0], rings[last][k + 1], rings[last][k], paintOf('rear', part));
    index.push(0, k, k + 1, last * N, last * N + k + 1, last * N + k);
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  body.computeVertexNormals();
  const outline = new THREE.BufferGeometry();
  outline.setAttribute('position', new THREE.Float32BufferAttribute(hull, 3));
  outline.setIndex(index); outline.computeVertexNormals();
  return { body, outline };
}

// Any primitive geometry, flattened and painted one colour.
function painted(geometry, color) {
  geometry.deleteAttribute('uv');
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  g.computeVertexNormals();
  const k = linear(color), n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const box = (x, y, z, w, h, d, color, { rx = 0, ry = 0, rz = 0 } = {}) =>
  painted(new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z), color);
// Flat polygon (in the car's side plane) facing +X on the right, -X on the left.
function sidePlate(points, x, side, color) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ShapeGeometry(shape);
  // Shape lies in XY with x=z_car; map (u,v,0) -> (x, v, u) and face outward.
  const m = new THREE.Matrix4().set(0, 0, side, x, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
  g.applyMatrix4(m);
  // The matrix is a reflection for side=+1 (det -1), so flip that winding.
  if (side > 0) { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3)[idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]; }
  return painted(g, color);
}
const arc = (cz, cy, r, from, to, n) => Array.from({ length: n + 1 }, (_, i) => { const a = from + (to - from) * i / n; return [cz + Math.cos(a) * r, cy + Math.sin(a) * r]; });

// --- Vehicle designs --------------------------------------------------------
// Each returns {stations, paint(zone, face), extras(add), wheels, lights}.
const S = (z, y, w, zone) => ({ z, y, w, zone });

function sedanLike({ tall }) {
  // Model 3: low fastback sedan, smooth grille-less nose, long rear glass
  // down to a short trunk lid with a lip. Model Y: crossover, visibly taller
  // and higher-riding, roof peak over the rear seats, short near-vertical
  // liftgate with a spoiler lip, dark lower cladding.
  const stations = tall ? [
    S(1.17, [.23, .35, .45, .45], [.37, .44, .41, .39], 'nose'),
    S(1.12, [.19, .35, .54, .54], [.44, .53, .49, .46], 'hood'),
    S(.88, [.17, .35, .61, .61], [.46, .54, .52, .48], 'hood'),
    S(.56, [.17, .35, .65, .66], [.46, .54, .53, .49], 'windshield'),
    S(.06, [.17, .35, .68, .94], [.46, .54, .52, .38], 'roof'),
    S(-.38, [.17, .35, .69, 1.0], [.46, .54, .52, .37], 'roof'),
    S(-.78, [.17, .35, .69, .965], [.46, .54, .52, .38], 'rearglass'),
    S(-1.05, [.18, .36, .69, .80], [.46, .54, .51, .42], 'deck'),
    S(-1.12, [.20, .37, .67, .77], [.45, .53, .49, .43], 'tail'),
    S(-1.17, [.27, .37, .61, .61], [.41, .49, .45, .42]),
  ] : [
    S(1.15, [.18, .25, .29, .29], [.36, .42, .39, .37], 'nose'),
    S(1.08, [.135, .25, .37, .37], [.43, .51, .47, .44], 'hood'),
    S(.84, [.115, .26, .46, .46], [.44, .52, .50, .46], 'hood'),
    S(.56, [.115, .26, .50, .51], [.44, .52, .51, .47], 'windshield'),
    S(.06, [.115, .26, .53, .74], [.44, .52, .50, .37], 'roof'),
    S(-.24, [.115, .26, .535, .775], [.44, .52, .50, .35], 'roof'),
    S(-.46, [.115, .26, .54, .76], [.44, .52, .50, .36], 'rearglass'),
    S(-.90, [.115, .27, .545, .575], [.44, .52, .50, .42], 'deck'),
    S(-1.08, [.13, .28, .55, .575], [.43, .51, .48, .44], 'tail'),
    S(-1.15, [.18, .28, .48, .48], [.38, .46, .42, .40]),
  ];
  const len = stations[0].z, r = tall ? .235 : .22, fz = tall ? .74 : .73, rz = tall ? -.71 : -.70;
  return {
    stations, roofColor: ROOF_GLASS, upperColor: TRIM, paintLower: tall ? TRIM : null,
    wheels: [fz, rz].map(z => ({ z, r, x: .47 })), rimStyle: 'aero',
    arches: 'round', archColor: tall ? TRIM : INK,
    extras(add, paint) {
      for (const s of [-1, 1]) {
        if (!tall) add(sidePlate([[-.5, .21], [.5, .21], [.5, .24], [-.5, .24]], .525, s, TRIM));
      }
      // Dark lower front intake strip under the grille-less nose.
      add(box(0, tall ? .25 : .18, len - .02, .62, .05, .05, TRIM));
    },
    lights(front, tail) {
      // Long, narrow, swept headlamps running into the wings; the 2025 Model Y
      // adds a full-width light bar above smaller lamps.
      for (const s of [-1, 1]) front(box(s * .31, tall ? .44 : .35, len - .1, .26, .022, .06, '#fff', { ry: -s * .55, rz: s * .08 }));
      if (tall) front(box(0, .525, len - .05, .62, .016, .05, '#fff'));
      if (tall) tail(box(0, .54, -len + .045, .72, .03, .05, '#fff'));
      else for (const s of [-1, 1]) tail(box(s * .3, .5, -len + .055, .2, .045, .04, '#fff'));
    },
  };
}

function cybercab() {
  // Compact two-seat teardrop: windshield starting right above the front axle
  // and flowing into one long fastback curve to a very short tail, no rear
  // window, full-width light bars, big flat gold discs on thin tyres.
  return {
    stations: [
      S(1.03, [.15, .24, .29, .29], [.36, .42, .40, .38], 'nose'),
      S(.97, [.12, .24, .36, .36], [.42, .50, .47, .44], 'hood'),
      S(.76, [.11, .24, .42, .42], [.43, .51, .49, .45], 'hood'),
      S(.56, [.11, .24, .46, .47], [.43, .51, .50, .46], 'windshield'),
      S(.10, [.13, .26, .51, .75], [.43, .51, .49, .40], 'roof'),
      S(-.08, [.13, .26, .515, .77], [.43, .51, .49, .40], 'slope'),
      S(-.26, [.13, .26, .515, .745], [.43, .51, .49, .40], 'deck'),
      S(-.46, [.13, .265, .515, .69], [.43, .51, .49, .40], 'deck'),
      S(-.70, [.135, .27, .50, .58], [.43, .51, .48, .39], 'deck'),
      S(-.93, [.15, .275, .46, .47], [.42, .50, .46, .40], 'tail'),
      S(-1.03, [.20, .275, .40, .40], [.36, .44, .40, .38]),
    ],
    roofColor: ROOF_GLASS, upperColor: ROOF_GLASS, sideGlass: ['windshield', 'roof', 'slope'],
    wheels: [.70, -.68].map(z => ({ z, r: .215, x: .45 })), rimStyle: 'disc', arches: 'none', archColor: INK,
    extras(add) {
      for (const s of [-1, 1]) add(sidePlate([[-.44, .12], [.46, .12], [.46, .17], [-.44, .17]], .515, s, TRIM));
    },
    lights(front, tail) {
      front(box(0, .325, .995, .78, .016, .06, '#fff'));
      tail(box(0, .44, -.98, .74, .028, .05, '#fff'));
    },
  };
}

function cybertruck() {
  // Flat-panel trapezoid wedge: one straight line from the nose to a single
  // roof apex, one straight line down the sail to the tailgate. Bare steel
  // with a steel band above the side glass, dark trapezoid wheel arches,
  // thin black rocker and a full-width light bar at each end.
  const nose = [1.4, .57], apex = [.02, 1.0], tail = [-1.4, .63];
  const up = z => nose[1] + (nose[0] - z) / (nose[0] - apex[0]) * (apex[1] - nose[1]);
  const down = z => apex[1] - (apex[0] - z) / (apex[0] - tail[0]) * (apex[1] - tail[1]);
  const lo = [.27, .34];
  return {
    stations: [
      S(1.4, [.29, .35, .56, .565, .57], [.46, .53, .53, .52, .51], 'hood'),
      S(.74, [lo[0], lo[1], .62, up(.74) - .02, up(.74)], [.47, .55, .555, .50, .49], 'windshield'),
      S(apex[0], [lo[0], lo[1], .66, .84, 1.0], [.47, .55, .555, .45, .37], 'roof'),
      S(-.30, [lo[0], lo[1], .67, down(-.30) - .07, down(-.30)], [.47, .55, .555, .45, .39], 'rearside'),
      S(-.50, [lo[0], lo[1], .675, down(-.50) - .03, down(-.50)], [.47, .55, .555, .45, .42], 'vault'),
      S(-1.4, [.29, .36, .63, .63, .63], [.46, .53, .53, .51, .5]),
    ],
    roofColor: GLASS, upperColor: null, sideGlass: ['windshield', 'roof', 'rearside'], paintLower: TRIM,
    wheels: [.86, -.84].map(z => ({ z, r: .27, x: .49 })), rimStyle: 'hex', arches: 'trapezoid', archColor: TRIM,
    extras(add, paint) {
      for (const s of [-1, 1]) add(box(s * .575, .62, .64, .07, .05, .1, paint, { ry: s * .3 }));
    },
    lights(front, tail) {
      front(box(0, .555, 1.405, 1.0, .024, .02, '#fff'));
      tail(box(0, .61, -1.405, 1.0, .03, .02, '#fff'));
    },
  };
}

function semi() {
  // Tall cab-over tractor, no trailer: rounded nose pushed forward, raked
  // wraparound windshield (centre driving seat), roof curving up into the tall
  // rear fairing, battery side skirts, exposed tandem rear axles, fifth wheel.
  return {
    stations: [
      S(1.72, [.30, .40, .50, .50], [.48, .55, .52, .50], 'nose'),
      S(1.68, [.27, .40, .68, .68], [.55, .60, .58, .55], 'hood'),
      S(1.58, [.27, .40, .82, .82], [.58, .62, .60, .57], 'hood'),
      S(1.42, [.27, .40, .92, .93], [.59, .62, .62, .59], 'windshield'),
      S(.86, [.27, .40, .96, 1.46], [.59, .62, .62, .53], 'cabin'),
      S(.56, [.27, .40, .99, 1.62], [.59, .62, .62, .51], 'roof'),
      S(.30, [.27, .40, 1.04, 1.72], [.59, .62, .62, .52], 'roof'),
      S(-.05, [.27, .40, 1.05, 1.85], [.59, .62, .62, .54], 'roof'),
      S(-.40, [.27, .40, 1.05, 1.93], [.59, .62, .62, .56], 'roof'),
      S(-.66, [.27, .40, 1.05, 1.96], [.59, .62, .62, .57]),
    ],
    roofColor: null, upperColor: GLASS, sideGlass: ['windshield', 'cabin'], wrapGlass: true, paintLower: TRIM,
    wheels: [1.12, -1.0, -1.48].map(z => ({ z, r: .3, x: .5 })), rimStyle: 'truck', arches: 'round', archColor: INK,
    extras(add, paint) {
      // Chassis rails, rear deck, fifth wheel, mirrors and the step.
      for (const s of [-1, 1]) add(box(s * .3, .45, -1.2, .12, .14, 1.1, INK));
      add(box(0, .56, -1.2, .74, .06, .96, '#55666b'));
      add(painted(new THREE.CylinderGeometry(.24, .26, .07, 12).translate(0, .63, -1.25), '#7f9094'));
      add(box(0, .67, -1.25, .08, .02, .3, INK));
      for (const s of [-1, 1]) {
        add(box(s * .65, 1.02, 1.3, .04, .14, .05, INK, { ry: s * .2 }));
        add(box(s * .63, .3, .3, .035, .05, .9, INK));
      }
      add(box(0, .33, 1.68, 1.0, .1, .08, TRIM));
    },
    lights(front, tail) {
      // Thin headlamps at the outer nose corners, wrapping into the sides.
      for (const s of [-1, 1]) front(box(s * .44, .64, 1.6, .26, .025, .1, '#fff', { ry: -s * .7, rz: s * .15 }));
      for (const s of [-1, 1]) tail(box(s * .3, .47, -1.765, .14, .06, .03, '#fff'));
    },
  };
}

export const LINEUP_DESIGNS = { sedan: () => sedanLike({ tall: false }), crossover: () => sedanLike({ tall: true }), cybercab, cybertruck, semi };

function makeWheel(r, style, paint) {
  const tireW = style === 'truck' ? .2 : style === 'disc' ? .11 : style === 'hex' ? .17 : .15, parts = [];
  parts.push(painted(new THREE.CylinderGeometry(r, r, tireW, 20).rotateZ(Math.PI / 2), INK));
  const face = tireW / 2 + .004;
  const disc = (rad, x, color, seg = 16) => parts.push(painted(new THREE.CylinderGeometry(rad, rad, .012, seg).rotateZ(Math.PI / 2).translate(x, 0, 0), color));
  for (const s of [-1, 1]) {
    if (style === 'disc') { disc(r * .86, s * face, paint); disc(r * .14, s * (face + .008), '#9a7b45', 8); }
    else if (style === 'hex') { disc(r * .78, s * face, '#3d4c52', 10); disc(r * .42, s * (face + .006), '#57676c', 10); }
    else if (style === 'truck') { disc(r * .62, s * face, '#b9c6c8', 12); disc(r * .26, s * (face + .006), '#7c8b8f', 8); }
    else {
      disc(r * .74, s * face, '#46555b');
      for (let k = 0; k < 5; k++) parts.push(painted(new THREE.BoxGeometry(.008, r * 1.36, .04).rotateX(k * Math.PI / 5).translate(s * (face + .005), 0, 0), RIM));
    }
  }
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g;
}

export function createLineupVehicle(kind, spec, { color, scale = 1 } = {}) {
  const design = LINEUP_DESIGNS[kind](), paint = color || spec.color;
  const root = new THREE.Group(); root.name = spec.name; root.scale.setScalar(scale);
  const pivot = new THREE.Group(); pivot.position.y = .43; root.add(pivot);
  const body = new THREE.Group(); body.position.y = -.43; pivot.add(body);
  const owned = [], parts = [];
  const side = design.sideGlass || ['windshield', 'roof', 'rearglass'];
  const paintOf = (zone, face) => {
    if (face === 'bottom') return INK;
    if (face === 'lower') return design.paintLower || paint;
    if (face === 'cap') return paint;
    if (face === 'glass') {
      if (design.wrapGlass && zone === 'windshield') return GLASS;
      return side.includes(zone) ? GLASS : paint;
    }
    if (face === 'upper') {
      if (design.wrapGlass && zone === 'windshield') return GLASS;
      return side.includes(zone) && design.upperColor ? design.upperColor : paint;
    }
    if (face === 'roof') {
      if (zone === 'windshield' || zone === 'rearglass') return GLASS;
      if (zone === 'roof' && design.roofColor) return design.roofColor;
      return paint;
    }
    return paint;
  };
  const { body: shell, outline } = loft(design.stations, paintOf);
  parts.push(shell);
  const add = g => parts.push(g);
  design.extras(add, paint);
  // Dark wheel wells behind each tyre, so wheels read in the flat cel look.
  const bodyRear = design.stations.at(-1).z;
  for (const w of design.arches === 'none' ? [] : design.wheels) for (const s of [-1, 1]) {
    if (w.z - w.r < bodyRear) continue;
    const R = w.r + .035, pts = design.arches === 'trapezoid'
      ? [[w.z - R * 1.25, .2], [w.z - R * .8, w.r + R * .9], [w.z + R * .8, w.r + R * .9], [w.z + R * 1.25, .2]]
      : arc(w.z, w.r, R, 0, Math.PI, 10);
    const st = design.stations, beltAt = z => { for (let i = 0; i < st.length - 1; i++) if (z <= st[i].z && z >= st[i + 1].z) { const u = (st[i].z - z) / (st[i].z - st[i + 1].z); return st[i].y[2] + (st[i + 1].y[2] - st[i].y[2]) * u; } return st.at(-1).y[2]; };
    const capY = beltAt(w.z) - .035;
    pts.forEach(p => { p[1] = Math.min(p[1], capY); });
    const x = design.stations[2].w[1] + .002;
    add(sidePlate(pts, x, s, design.archColor));
  }
  const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose());
  const mesh = new THREE.Mesh(geometry, toonVertexColorMaterial()); mesh.castShadow = true; mesh.receiveShadow = true; body.add(mesh);
  const hull = new THREE.Mesh(outline, outlineMaterial(kind === 'semi' ? .016 : .011)); hull.userData.outline = true; body.add(hull);
  owned.push(geometry, outline);
  // Emissive lamps: one mesh per colour so braking and night can retint them.
  const light = new THREE.MeshBasicMaterial({ color: '#e5eedc' }), tail = new THREE.MeshBasicMaterial({ color: '#fa7961' });
  const fronts = [], tails = [];
  design.lights(g => fronts.push(g), g => tails.push(g));
  for (const [list, material, lamp] of [[fronts, light, 'head'], [tails, tail, 'tail']]) {
    const g = mergeGeometries(list); list.forEach(p => p.dispose()); g.deleteAttribute('color');
    const m = new THREE.Mesh(g, material); m.userData.lamp = lamp; body.add(m); owned.push(g);
  }
  const wheels = [], r0 = design.wheels[0].r;
  const wheelGeometry = new Map();
  for (const w of design.wheels) for (const s of [-1, 1]) {
    if (!wheelGeometry.has(w.r)) { const g = makeWheel(w.r, design.rimStyle, paint); wheelGeometry.set(w.r, g); owned.push(g); }
    const wheel = new THREE.Mesh(wheelGeometry.get(w.r), toonVertexColorMaterial());
    wheel.position.set(s * w.x, w.r, w.z); wheel.castShadow = true; body.add(wheel); wheels.push(wheel);
  }
  const jets = new THREE.Group(); body.add(jets); jets.visible = false;
  const bounds = new THREE.Box3().setFromObject(root);
  root.userData = {
    kind, wheels, wheelRadius: r0 * scale, pivot, jets,
    dimensions: { width: spec.width * scale, length: spec.length * scale, height: (bounds.max.y / scale + .03) * scale },
    animate({ distance = 0, braking = false, night = 0, stage = false } = {}) {
      for (let i = 0; i < wheels.length; i++) wheels[i].rotation.x = distance / (design.wheels[i >> 1].r * scale);
      stageLamps(light, tail, night, braking, stage);
    },
    dispose() { owned.forEach(g => g.dispose()); light.dispose(); tail.dispose(); root.removeFromParent(); },
  };
  return root;
}
