import * as THREE from 'three';
import { hillLayout, HILL_SPOTS } from './compiler/hills.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, toonMaterial, toonVertexColorMaterial, PALETTE } from './toon.js';

// Small helpers -------------------------------------------------------------
function box(w, h, d, color, opts) {
  return toon(new THREE.BoxGeometry(w, h, d), color, opts);
}
function cyl(rt, rb, h, color, seg = 16, opts) {
  return toon(new THREE.CylinderGeometry(rt, rb, h, seg), color, opts);
}
function at(obj, x, y, z) {
  obj.position.set(x, y, z);
  return obj;
}

// ---------------------------------------------------------------------------
// Gable roof: two tilted slabs meeting at a ridge + two triangular gable ends.
// Ridge runs along the Z (depth) axis. Returns a Group centred on the body top.
// ---------------------------------------------------------------------------
function gableRoof(w, d, peak, color) {
  const g = new THREE.Group();
  const over = 0.45; // eave overhang
  const rw = w + over * 2;
  const rd = d + over * 2;
  const slant = Math.hypot(rw / 2, peak);
  const angle = Math.atan2(peak, rw / 2);
  const t = 0.16; // slab thickness

  for (const s of [-1, 1]) {
    const slab = box(slant, t, rd, color, { thickness: 0.05 });
    slab.rotation.z = -s * angle; // right slab (s=+1) slopes down to +X: a peaked roof, not a V
    slab.position.set((s * rw) / 4, peak / 2, 0);
    g.add(slab);
  }

  // Ridge cap
  const ridge = box(0.22, 0.22, rd * 0.98, PALETTE.roofRidge, { thickness: 0.045 });
  ridge.position.set(0, peak + 0.02, 0);
  g.add(ridge);

  // Triangular gable ends fill the wall gap under the roof.
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, peak);
  shape.lineTo(-w / 2, 0);
  const tri = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
  tri.translate(0, 0, -0.05);
  for (const z of [-d / 2, d / 2]) {
    const end = toon(tri, PALETTE.wallShade, { thickness: 0.04 });
    end.position.z = z;
    g.add(end);
  }
  return g;
}

// ---------------------------------------------------------------------------
// House — parametric so each one is distinct (size, porch side, chimney,
// window layout, trim). Door + front windows face +Z before rotation.
// ---------------------------------------------------------------------------
export function makeHouse(opts = {}) {
  const {
    w = 5,
    h = 3,
    d = 4.2,
    peak = 2.0,
    wall = PALETTE.wall,
    roof = PALETTE.roof,
    trim = PALETTE.trim,
    chimney = 'left', // 'left' | 'right' | 'none'
    porch = true,
    windows = [-1.4, 1.4], // x offsets of front windows
  } = opts;

  const house = new THREE.Group();

  // Stone footing + body
  const footing = box(w + 0.2, 0.5, d + 0.2, PALETTE.stone, { thickness: 0.045 });
  at(footing, 0, 0.25, 0);
  house.add(footing);

  const body = box(w, h, d, wall, { thickness: 0.05 });
  at(body, 0, 0.5 + h / 2, 0);
  house.add(body);

  // Roof sits on top of the body
  const roofGrp = gableRoof(w, d, peak, roof);
  roofGrp.position.set(0, 0.5 + h, 0);
  house.add(roofGrp);

  const front = d / 2 + 0.03;

  // Door
  const door = box(1.1, 1.9, 0.12, trim, { thickness: 0.03 });
  at(door, 0, 0.5 + 0.95, front);
  house.add(door);
  const knob = box(0.12, 0.12, 0.1, PALETTE.woodDark, { thickness: 0.02 });
  at(knob, 0.35, 0.5 + 1.0, front + 0.05);
  house.add(knob);

  // Front windows (frame + teal shutters)
  for (const wx of windows) {
    const frame = box(1.0, 1.0, 0.1, PALETTE.wall, { thickness: 0.03 });
    at(frame, wx, 0.5 + h * 0.62, front);
    house.add(frame);
    const glass = box(0.74, 0.74, 0.08, '#cdeef0', { thickness: 0.02 });
    at(glass, wx, 0.5 + h * 0.62, front + 0.03);
    house.add(glass);
    for (const s of [-1, 1]) {
      const shutter = box(0.26, 1.0, 0.08, trim, { thickness: 0.025 });
      at(shutter, wx + s * 0.64, 0.5 + h * 0.62, front - 0.01);
      house.add(shutter);
    }
  }

  // Side window for extra variation
  {
    const sx = d / 2 - 1.1;
    const frame = box(0.1, 1.0, 1.0, PALETTE.wall, { thickness: 0.03 });
    at(frame, -(w / 2 + 0.03), 0.5 + h * 0.62, sx - 0.3);
    house.add(frame);
    const glass = box(0.08, 0.74, 0.74, '#cdeef0', { thickness: 0.02 });
    at(glass, -(w / 2 + 0.06), 0.5 + h * 0.62, sx - 0.3);
    house.add(glass);
  }

  // Chimney
  if (chimney !== 'none') {
    const cx = chimney === 'left' ? -w * 0.28 : w * 0.28;
    const chim = box(0.7, 1.7, 0.7, PALETTE.stoneDark, { thickness: 0.04 });
    at(chim, cx, 0.5 + h + peak * 0.5, -d * 0.1);
    house.add(chim);
    const cap = box(0.9, 0.18, 0.9, PALETTE.ink, { thickness: 0.03 });
    at(cap, cx, 0.5 + h + peak * 0.5 + 0.9, -d * 0.1);
    house.add(cap);
  }

  // Porch: deck + posts + shed roof in front of the door
  if (porch) {
    const pd = 1.6; // porch depth
    const pw = w * 0.86;
    const deck = box(pw, 0.3, pd, PALETTE.wood, { thickness: 0.04 });
    at(deck, 0, 0.5, d / 2 + pd / 2);
    house.add(deck);

    // Steps
    const step = box(pw * 0.5, 0.18, 0.5, PALETTE.woodDark, { thickness: 0.03 });
    at(step, 0, 0.32, d / 2 + pd + 0.1);
    house.add(step);

    const postH = 1.9;
    for (const s of [-1, 1]) {
      const post = box(0.2, postH, 0.2, PALETTE.wood, { thickness: 0.03 });
      at(post, (s * pw) / 2 + s * -0.1, 0.65 + postH / 2, d / 2 + pd - 0.15);
      house.add(post);
    }

    // Porch shed roof
    const shed = box(pw + 0.5, 0.14, pd + 0.4, PALETTE.roof, { thickness: 0.04 });
    at(shed, 0, 0.65 + postH + 0.05, d / 2 + pd / 2);
    shed.rotation.x = -0.18;
    house.add(shed);

    // Railing
    for (const s of [-1, 1]) {
      const rail = box(0.1, 0.1, pd - 0.2, PALETTE.woodDark, { thickness: 0.02 });
      at(rail, (s * pw) / 2, 0.95, d / 2 + pd / 2);
      house.add(rail);
    }
  }

  return house;
}

// ---------------------------------------------------------------------------
// Tree — trunk + a cluster of overlapping toon spheres (puffy, two-tone).
// ---------------------------------------------------------------------------
export function makeTree(scale = 1, seed = 0) {
  const t = new THREE.Group();
  const trunkH = 1.8 * scale;
  const trunk = cyl(0.28 * scale, 0.42 * scale, trunkH, PALETTE.trunk, 8, { thickness: 0.04 });
  at(trunk, 0, trunkH / 2, 0);
  t.add(trunk);

  const rnd = (i) => {
    const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const puffs = [
    { x: 0, y: trunkH + 1.3 * scale, z: 0, r: 1.6 * scale, c: PALETTE.leafMid },
    { x: -1.0 * scale, y: trunkH + 0.9 * scale, z: 0.3 * scale, r: 1.1 * scale, c: PALETTE.leafDark },
    { x: 0.9 * scale, y: trunkH + 1.0 * scale, z: -0.4 * scale, r: 1.15 * scale, c: PALETTE.leafMid },
    { x: 0.2 * scale, y: trunkH + 2.2 * scale, z: 0.2 * scale, r: 1.05 * scale, c: PALETTE.leafLight },
    { x: -0.4 * scale, y: trunkH + 1.6 * scale, z: -0.8 * scale, r: 0.95 * scale, c: PALETTE.leafDark },
  ];
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i];
    const jitter = (rnd(i) - 0.5) * 0.3 * scale;
    const puff = toon(new THREE.IcosahedronGeometry(p.r, 1), p.c, { thickness: 0.05, ramp: 'foliage' });
    at(puff, p.x + jitter, p.y, p.z + jitter);
    t.add(puff);
  }
  return t;
}

// Low round bush
export function makeBush(scale = 1) {
  const b = new THREE.Group();
  for (const o of [
    [0, 0.4 * scale, 0, 0.7 * scale, PALETTE.leafDark],
    [0.5 * scale, 0.5 * scale, 0.1 * scale, 0.55 * scale, PALETTE.leafMid],
    [-0.45 * scale, 0.45 * scale, -0.1 * scale, 0.5 * scale, PALETTE.leafMid],
  ]) {
    const puff = toon(new THREE.IcosahedronGeometry(o[3], 1), o[4], { thickness: 0.04, ramp: 'foliage' });
    at(puff, o[0], o[1], o[2]);
    b.add(puff);
  }
  return b;
}

// ---------------------------------------------------------------------------
// Well — stone ring, dark water, two posts, a little gable canopy.
// ---------------------------------------------------------------------------
export function makeWell() {
  const well = new THREE.Group();

  const ring = cyl(1.1, 1.1, 1.1, PALETTE.stone, 18, { thickness: 0.05 });
  at(ring, 0, 0.55, 0);
  well.add(ring);

  const lip = cyl(1.2, 1.2, 0.18, PALETTE.stoneDark, 18, { thickness: 0.04 });
  at(lip, 0, 1.12, 0);
  well.add(lip);

  const water = cyl(0.92, 0.92, 0.1, '#2b5f73', 18, { thickness: 0.02, cast: false });
  at(water, 0, 1.08, 0);
  well.add(water);

  for (const s of [-1, 1]) {
    const post = box(0.25, 2.1, 0.25, PALETTE.wood, { thickness: 0.03 });
    at(post, s * 0.95, 1.1 + 1.05, 0);
    well.add(post);
  }

  const canopy = gableRoof(2.8, 1.8, 0.9, PALETTE.roof);
  canopy.position.set(0, 3.2, 0);
  well.add(canopy);

  // Bucket on a crossbar
  const bar = box(2.0, 0.16, 0.16, PALETTE.woodDark, { thickness: 0.02 });
  at(bar, 0, 3.0, 0);
  well.add(bar);
  const bucket = cyl(0.3, 0.26, 0.5, PALETTE.woodDark, 10, { thickness: 0.03 });
  at(bucket, 0, 2.2, 0);
  well.add(bucket);

  return well;
}

// ---------------------------------------------------------------------------
// Fence run between two points — posts with two horizontal rails.
// ---------------------------------------------------------------------------
export function makeFence(x1, z1, x2, z2, spacing = 2.0) {
  const f = new THREE.Group();
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.round(len / spacing));
  const ang = Math.atan2(dx, dz);

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const post = box(0.2, 1.1, 0.2, PALETTE.wood, { thickness: 0.03 });
    at(post, x1 + dx * t, 0.55, z1 + dz * t);
    f.add(post);
  }
  for (const y of [0.45, 0.85]) {
    const rail = box(0.12, 0.14, len, PALETTE.woodDark, { thickness: 0.025 });
    at(rail, (x1 + x2) / 2, y, (z1 + z2) / 2);
    rail.rotation.y = ang;
    f.add(rail);
  }
  return f;
}

// ---------------------------------------------------------------------------
// Ground, dirt paths, rolling hills, sky dome, clouds.
// ---------------------------------------------------------------------------
export function makeGround(radius = 70, cutouts = []) {
  const g = new THREE.Group();

  let geometry = new THREE.CircleGeometry(radius, 48);
  if (cutouts.length) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
    for (const { min, max } of cutouts) {
      const hole = new THREE.Path();
      // Shape XY becomes world X/-Z after the disk rotation.
      hole.moveTo(min[0], -min[1]); hole.lineTo(max[0], -min[1]);
      hole.lineTo(max[0], -max[1]); hole.lineTo(min[0], -max[1]); hole.closePath();
      shape.holes.push(hole);
    }
    geometry.dispose();
    geometry = new THREE.ShapeGeometry(shape, 48);
  }
  const disk = new THREE.Mesh(
    geometry,
    toonMaterial(PALETTE.grass)
  );
  disk.rotation.x = -Math.PI / 2;
  disk.receiveShadow = true;
  g.add(disk);

  // Central green: a slightly brighter raised patch
  const green = new THREE.Mesh(new THREE.CircleGeometry(9, 40), toonMaterial(PALETTE.grassDark));
  green.rotation.x = -Math.PI / 2;
  green.position.y = 0.015;
  green.receiveShadow = true;
  g.add(green);

  return g;
}

// A flat dirt path quad from A to B.
export function makePath(x1, z1, x2, z2, width = 2.4) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz) + width * 0.5; // slight overlap at the ends
  const geo = new THREE.PlaneGeometry(width, len);
  geo.rotateX(-Math.PI / 2); // bake flat: length now runs along the local Z axis
  const mesh = new THREE.Mesh(geo, toonMaterial(PALETTE.dirt));
  mesh.rotation.y = Math.atan2(dx, dz); // orient length along the A->B line
  mesh.position.set((x1 + x2) / 2, 0.03, (z1 + z2) / 2);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Fence gate — two posts and a swinging picket panel (one leaf, or two meeting
// in the middle when the gap is wide), each leaf with top/bottom rails and a
// diagonal brace. Sized to sit in a picket-fence run (Cozy picket ~1.31 tall
// in world units). Local frame: X runs along the fence line, the hinge line is
// z = 0, +Z points OUT of the lot. `open` 0..1 swings the leaves inward (-Z)
// by up to 90 deg; the default 0.55 (~50 deg) keeps them reading as a gate,
// angled at the sides of the path with its centre visibly open. Merged per colour.
// ---------------------------------------------------------------------------
function boxAt(list, w, h, d, x, y, z, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  list.push(g);
}

function gateLeaf(len, height, flip) {
  // Built along +X from the hinge (x = 0); `flip` mirrors it to run along -X.
  const pickets = [], frame = [];
  const s = flip ? -1 : 1;
  const railY = [0.3, height - 0.28];
  for (const y of railY) boxAt(frame, len, 0.1, 0.06, s * len / 2, y, -0.035);
  // Diagonal brace from the bottom hinge corner up to the top free corner.
  const bx = len - 0.12, by = railY[1] - railY[0];
  const blen = Math.hypot(bx, by);
  boxAt(frame, blen, 0.09, 0.05, s * (0.06 + bx / 2), (railY[0] + railY[1]) / 2, -0.035, s * Math.atan2(by, bx));
  // Pickets with diamond tips, flush with the fence pickets.
  const n = Math.max(3, Math.round(len / 0.24));
  const pw = Math.min(0.13, (len / n) * 0.62);
  for (let i = 0; i < n; i++) {
    const x = s * ((i + 0.5) / n) * len;
    boxAt(pickets, pw, height - 0.16, 0.05, x, 0.08 + (height - 0.16) / 2, 0.02);
    boxAt(pickets, pw * 0.72, pw * 0.72, 0.05, x, height - 0.08, 0.02, Math.PI / 4);
  }
  const leaf = new THREE.Group();
  leaf.add(toon(mergeGeometries(pickets), PALETTE.wall, { thickness: 0.022 }));
  leaf.add(toon(mergeGeometries(frame), PALETTE.woodDark, { thickness: 0.02 }));
  return leaf;
}

// Gate dimensions shared with the compiler (compile.js mirrors gateLeafLength
// to cap `open` so swung leaves never reach the house).
export const GATE_POST = 0.26;
// Leaves are capped at GATE_LEAF_MAX so a ~50 deg swing stays inside the
// ~0.8 front setback of the smallest lots (closed, a two-leaf gate then shows a
// latch gap of ~0.5; gates are always drawn open).
export const GATE_LEAF_MAX = 1.0;
export function gateLeafLength(width, two = width > 2.2) {
  const span = width - GATE_POST - 0.06; // clear opening between the post faces
  return Math.min(GATE_LEAF_MAX, two ? span / 2 - 0.08 : span - 0.08);
}

export function makeGate({ width = 2.9, open = 0.55, height = 1.22, leaves = 'auto' } = {}) {
  const g = new THREE.Group();
  // Posts: thicker and taller than the picket-fence posts, with a lighter
  // cream cap + pyramid finial so the gate reads at default zoom.
  const post = GATE_POST, postH = height + 0.42;
  const posts = [], caps = [];
  for (const sx of [-1, 1]) {
    boxAt(posts, post, postH, post, sx * width / 2, postH / 2, 0);
    boxAt(caps, post + 0.1, 0.1, post + 0.1, sx * width / 2, postH + 0.05, 0);
    const fin = new THREE.ConeGeometry(post * 0.5, 0.2, 4);
    fin.rotateY(Math.PI / 4);
    fin.translate(sx * width / 2, postH + 0.2, 0);
    caps.push(fin.toNonIndexed());
  }
  g.add(toon(mergeGeometries(posts), PALETTE.wood, { thickness: 0.03 }));
  g.add(toon(mergeGeometries(caps.map((c) => (c.index ? c.toNonIndexed() : c))), PALETTE.wall, { thickness: 0.03 }));

  const two = leaves === 2 || (leaves === 'auto' && width > 2.2);
  const len = gateLeafLength(width, two);
  const ang = Math.max(0, Math.min(1, open)) * Math.PI / 2;
  const hinge = width / 2 - post / 2 - 0.02;
  // Left leaf hinged on the -X post, running +X; rotation.y = +ang swings +X toward -Z.
  const left = gateLeaf(len, height, false);
  left.position.set(-hinge, 0, 0);
  left.rotation.y = ang;
  g.add(left);
  if (two) {
    const right = gateLeaf(len, height, true);
    right.position.set(hinge, 0, 0);
    right.rotation.y = -ang;
    g.add(right);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Plaza ring — a paved loop around the well that every door path joins.
// Default style 'cobble': a dark mortar base ring, 3-5 rows of tightly packed
// irregular cobbles (chamfered, jittered, slightly domed low prisms in a few
// stone tones, running-bond staggered) and a raised kerb band on the inner and
// outer edges. Everything but the base is ONE vertex-coloured toon mesh
// (~10k tris for the default ring). style:'flat' keeps the old flat band with
// inset stones. Centred on the origin; inner/outer are WORLD radii
// (= ring.radius -/+ width/2). Path strips (y 0.03) tuck under the paving.
// ---------------------------------------------------------------------------
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePlazaRing(opts = {}) {
  if (opts.style === 'flat') return makeFlatRing(opts);
  const {
    inner = 5.1, outer = 6.9, segments = 48, seed = 11,
    kerb = '#d3c9b3',
    rowSize = 0.37, gap = 0.06,
  } = opts;
  // Warm beige-grey stones (nudged toward the dirt paths' #c7a469) over a mid
  // mortar, so the ring reads calm at default zoom. Legacy (pre-cobble) params
  // still work: `color` (the old band colour) becomes the mortar and `stone`
  // seeds the stone tones, unless `mortar` / `tones` are given explicitly.
  const mortar = opts.mortar ?? opts.color ?? '#8c8170';
  const tones = opts.tones ?? (opts.stone != null
    ? [1, 0.92, 1.07, 0.96, 1.03].map((k) => '#' + new THREE.Color(opts.stone).multiplyScalar(k).getHexString())
    : ['#bdb29c', '#ada28b', '#c6bba3', '#b4a78f', '#b9ad94']);
  const rnd = mulberry(seed);
  const g = new THREE.Group();
  const baseY = 0.024;

  // Mortar base.
  const ringSeg = Math.max(64, segments * 2);
  const base = new THREE.Mesh(new THREE.RingGeometry(inner, outer, ringSeg), toonMaterial(mortar));
  base.rotation.x = -Math.PI / 2;
  base.position.y = baseY;
  base.receiveShadow = true;
  g.add(base);

  const P = [], C = [];
  const col = new THREE.Color();
  const v = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)];
  const tri = (a, b, c, hint) => {
    // Wind so the face normal points along `hint`.
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    const n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
    if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) { P.push(p[0], p[1], p[2]); C.push(col.r, col.g, col.b); }
  };
  const quad = (a, b, c, d, hint) => { tri(a, b, c, hint); tri(a, c, d, hint); };

  // Kerb bands: raised annuli with a top and both side walls.
  const kw = 0.16, kh = 0.07;
  const K = Math.max(96, segments * 3);
  col.set(kerb);
  for (const [r0, r1] of [[inner, inner + kw], [outer - kw, outer]]) {
    for (let i = 0; i < K; i++) {
      const a0 = (i / K) * Math.PI * 2, a1 = ((i + 1) / K) * Math.PI * 2, am = (a0 + a1) / 2;
      const y0 = baseY, y1 = baseY + kh;
      quad(v(r0, a0, y1), v(r1, a0, y1), v(r1, a1, y1), v(r0, a1, y1), [0, 1, 0]);
      quad(v(r0, a0, y0), v(r0, a1, y0), v(r0, a1, y1), v(r0, a0, y1), [-Math.cos(am), 0, -Math.sin(am)]);
      quad(v(r1, a0, y0), v(r1, a1, y0), v(r1, a1, y1), v(r1, a0, y1), [Math.cos(am), 0, Math.sin(am)]);
    }
  }

  // Cobble rows between the kerbs.
  const f0 = inner + kw + gap * 0.5, f1 = outer - kw - gap * 0.5;
  const rows = Math.max(2, Math.min(5, Math.round((f1 - f0) / rowSize)));
  const rowH = (f1 - f0) / rows;
  for (let k = 0; k < rows; k++) {
    const r0 = f0 + k * rowH, r1 = r0 + rowH, rm = (r0 + r1) / 2;
    const n = Math.max(12, Math.round((Math.PI * 2 * rm) / (rowH * (1.05 + 0.15 * rnd()))));
    const cell = (Math.PI * 2) / n;
    const off = (k % 2) * 0.5 + rnd() * 0.2; // running-bond stagger
    const cuts = [];
    for (let i = 0; i < n; i++) cuts.push((i + off + (rnd() - 0.5) * 0.36) * cell);
    for (let i = 0; i < n; i++) {
      const aA = cuts[i], aB = i + 1 < n ? cuts[i + 1] : cuts[0] + Math.PI * 2;
      const ri = r0 + gap / 2 + rnd() * 0.012, ro = r1 - gap / 2 - rnd() * 0.012;
      const gi = (gap / 2) / ri, go = (gap / 2) / ro;
      // Sector corners (inset by the mortar gap), chamfered into an octagon.
      const corners = [[ri, aA + gi], [ri, aB - gi], [ro, aB - go], [ro, aA + go]];
      const poly = [];
      for (let c = 0; c < 4; c++) {
        const p = corners[c], q = corners[(c + 1) % 4];
        for (const t of [0.2 + rnd() * 0.06, 0.8 - rnd() * 0.06]) {
          const r = p[0] + (q[0] - p[0]) * t, a = p[1] + (q[1] - p[1]) * t;
          const jr = (rnd() - 0.5) * 0.018, ja = ((rnd() - 0.5) * 0.018) / r;
          poly.push([r + jr, a + ja]);
        }
      }
      const top = baseY + 0.028 + rnd() * 0.014;
      const tone = tones[Math.floor(rnd() * tones.length)];
      col.set(tone).multiplyScalar(0.96 + rnd() * 0.08); // gentler per-stone jitter: less busy
      let cr = 0, ca = 0;
      for (const [r, a] of poly) { cr += r; ca += a; }
      cr /= poly.length; ca /= poly.length;
      const apex = v(cr, ca, top + 0.01); // gentle dome
      const m = poly.length;
      for (let j = 0; j < m; j++) {
        const [ra, aa] = poly[j], [rb, ab] = poly[(j + 1) % m];
        const A = v(ra, aa, top), B = v(rb, ab, top);
        tri(apex, A, B, [0, 1, 0]);
        // Skirt down to the mortar so the cobble reads as a low stone.
        const out = [(A[0] + B[0]) / 2 - apex[0], 0, (A[2] + B[2]) / 2 - apex[2]];
        quad(A, B, v(rb, ab, baseY), v(ra, aa, baseY), out);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.computeVertexNormals(); // non-indexed: flat per-face normals
  const paving = new THREE.Mesh(geo, toonVertexColorMaterial());
  paving.receiveShadow = true;
  g.add(paving);
  return g;
}

function makeFlatRing({ inner = 5.1, outer = 6.9, segments = 48, color = PALETTE.dirtDark, stone = PALETTE.stoneDark } = {}) {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.RingGeometry(inner, outer, Math.max(8, segments)), toonMaterial(color));
  band.rotation.x = -Math.PI / 2;
  band.position.y = 0.024; // above the plaza disk (0.02), below path strips (0.03)
  band.receiveShadow = true;
  g.add(band);

  // Darker inset stones scattered along the centreline for a cobbled feel.
  const mid = (inner + outer) / 2;
  const rStone = Math.max(0.18, (outer - inner) * 0.26);
  const n = Math.max(6, Math.round(segments / 3));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.12;
    const s = new THREE.Mesh(new THREE.CircleGeometry(rStone, 6), toonMaterial(stone));
    s.rotation.x = -Math.PI / 2;
    s.position.set(Math.cos(a) * mid, 0.028, Math.sin(a) * mid);
    s.receiveShadow = true;
    g.add(s);
  }
  return g;
}

export function makeHills(extentScale = 1, occupied = []) {
  const g = new THREE.Group();
  const colors = [PALETTE.hillFar, PALETTE.hill, PALETTE.hillFar, PALETTE.hill, PALETTE.hillFar, PALETTE.hill];
  for (const [index, h] of hillLayout(extentScale, occupied).entries()) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(HILL_SPOTS[index][3], 20, 14), toonMaterial(colors[index]));
    hill.position.set(h.x, h.y, h.z);
    hill.scale.set(extentScale, 0.5 * extentScale, extentScale);
    hill.receiveShadow = true;
    hill.userData.scenery = hill.material.userData.scenery = true;
    g.add(hill);
  }
  return g;
}

export function makeSky() {
  const geo = new THREE.SphereGeometry(300, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      bottom: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: /* glsl */ `
      varying float vH;
      void main() {
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vH;
      uniform vec3 top; uniform vec3 bottom;
      void main() {
        float t = smoothstep(-0.05, 0.6, vH);
        gl_FragColor = vec4(mix(bottom, top, t), 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

export function makeCloud(scale = 1) {
  const c = new THREE.Group();
  const puffs = [
    [0, 0, 0, 1.6],
    [1.6, -0.2, 0.2, 1.2],
    [-1.7, -0.1, -0.1, 1.1],
    [0.6, 0.5, 0.1, 1.0],
    [-0.8, 0.4, 0.2, 0.9],
  ];
  for (const [x, y, z, r] of puffs) {
    const puff = toon(new THREE.IcosahedronGeometry(r * scale, 1), PALETTE.cloud, {
      thickness: 0.05,
      cast: false,
      receive: false,
    });
    at(puff, x * scale, y * scale, z * scale);
    c.add(puff);
  }
  return c;
}
