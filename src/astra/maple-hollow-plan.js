// OWNER: opus-suburb lane. Maple Hollow: an American-suburb district north of
// Thistlebrook High (site x -40..60, z -185..-105). Pure layout data and compiler
// hooks: no THREE, no DOM, no random draws (every choice is a stable hash, so
// the town's seeded streams never move). Contract: docs/specs/maple-hollow-contract.md.
//
// Streets are regional (world-link) roads, so the grok-roads planner fillets
// them, the pedestrian graph lays sidewalks on both sides, true ends become
// turning circles (the cul-de-sacs) and regional traffic drives them.
export const MH = 'maple-hollow';
export const MAPLE_HOLLOW_BOUNDS = Object.freeze({minX: -42, maxX: 60, minZ: -183, maxZ: -106});
export const MAPLE_HOLLOW_VIEW = Object.freeze({x: 10, z: -145, zoom: 1.6});
// Scales against the town (docs/specs/suburb-assets.md; tuned values in docs/OPUS-SUBURB-LOG.md).
export const SCALE = Object.freeze({house: .75, prop: .75, car: .85, bus: .55, tree: .75, garage: .62});
const KERB = 2.8, VERGE = 4.1; // carriageway half width (REGIONAL.width / 2) and lot front setback from the centerline

// ---- streets (authored centerlines, world coordinates) ----
export const STREETS = Object.freeze({
  drive: {name: 'Maple Hollow Drive', points: [[-42, -139], [-24, -139], [-12, -140], [20, -141.5], [46, -143.5], [64, -147]]},
  birch: {name: 'Birch Lane', points: [[-24, -139], [-24, -174]]},
  crescent: {name: 'Hollow Crescent', points: [[-24, -174], [11, -179.5], [46, -174]]},
  cedar: {name: 'Cedar Lane', points: [[46, -174], [46, -143.5]]},
  hazel: {name: 'Hazel Court', points: [[-12, -140], [-12, -117]]},
  acorn: {name: 'Acorn Court', points: [[20, -141.5], [20, -117]]},
});
// Birch, Crescent and Cedar meet without another road at their corners, so
// they form one chain (filleted corners) between the two Drive junctions.

// ---- tiny geometry helpers ----
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
const r5 = (p) => p.map((v) => +v.toFixed(4));
export function segDist(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
export const polyDist = (p, pts) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1], pts[i])); return d; };
/** Point at distance s along a polyline, with its unit direction. */
export function along(pts, s) {
  for (let i = 1; i < pts.length; i++) { const l = len(sub(pts[i], pts[i - 1])); if (s <= l || i === pts.length - 1) { const d = unit(sub(pts[i], pts[i - 1])); return {p: add(pts[i - 1], mul(d, Math.min(s, l))), d}; } s -= l; }
}
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };

// ---- model footprints (raw pack metres: minX, minZ, maxX, maxZ; heights in suburb-assets.md) ----
export const FOOT = Object.freeze({
  bungalow_house: [-2.98, -2.67, 2.98, 2.85], ranch_house: [-4.08, -2.88, 4.08, 2.95], split_level_house: [-4.58, -2.97, 4.48, 3.52],
  two_story_house: [-3.68, -3.08, 3.68, 3.15], modern_house: [-7.34, -3.08, 4.28, 5.95], townhouse_duplex: [-3.78, -2.67, 3.78, 2.75],
  garage: [-3.28, -3.17, 3.28, 3.25], front_porch: [-1.94, -1.1, 1.94, 1.97], backyard_deck: [-2.2, -1.69, 2.2, 2.62],
  garden_shed: [-1.48, -1.27, 1.8, 1.27], kids_treehouse: [-1.99, -1.89, 1.87, 2.06], pergola: [-1.75, -1.72, 1.75, 1.72],
  swimming_pool: [-2.3, -1.6, 2.3, 1.6], swing_set: [-2.21, -.9, 1.64, 1.24], patio_table_chairs: [-1.05, -1.05, 1.05, 1.18],
  family_sedan: [-.7, -1.55, .7, 1.57], suv_minivan: [-.75, -1.6, .75, 1.61], family_pickup: [-.74, -1.76, .74, 1.75], school_bus: [-1.15, -4.02, 1.15, 4.05],
});
export const HOUSES = ['bungalow_house', 'ranch_house', 'split_level_house', 'two_story_house', 'modern_house', 'townhouse_duplex'];
export const HOUSE_LABEL = {bungalow_house: 'bungalow', ranch_house: 'ranch', split_level_house: 'split-level', two_story_house: 'two-storey', modern_house: 'modern', townhouse_duplex: 'duplex'};
// Palette swaps (sRGB). Index 0 keeps the model's own colour.
// Village palette (cream / terracotta / teal / sage): light warm walls, warm or slate roofs.
export const SIDING = ['keep', '#efe3c4', '#e9d29c', '#bccb9f', '#e3bf78', '#ecc7af', '#c3d8c4', '#f3efe2', '#dcc3a0'];
export const ROOF = ['keep', '#b65f3e', '#c4724a', '#6f8a6a', '#5e7487', '#8c5b3e', '#a9503a'];
export const ACCENT = ['keep', '#9e3a30', '#2f5a86', '#2f7f77', '#c9933c', '#4d6b3c'];
export const PAINT = ['keep', '#c8553d', '#f0ece2', '#9aa4ab', '#3f6f8f', '#5f7f56', '#d9b448', '#7a3f52'];

// ---- lots: street, distance along it (centre of frontage), side (+1 = left of travel), frontage, depth ----
// Left of travel along a street is its +perp side ([-d.z, d.x]).
const LOT_SPECS = [
  // Ring, south row: north side of the Drive, fronts face south (toward the camera).
  ['drive', 29.3, -1, 11.4, 13.2], ['drive', 41.2, -1, 11.4, 13.2], ['drive', 53.1, -1, 11.4, 13.2], ['drive', 65.0, -1, 11.4, 13], ['drive', 76.9, -1, 11.4, 12.4],
  // Ring, north row: south side of Hollow Crescent, backyards face the camera.
  ['crescent', 17.4, 1, 10, 12.6], ['crescent', 27.6, 1, 10, 12.6], ['crescent', 43.4, 1, 10, 12.6], ['crescent', 53.6, 1, 10, 12],
  // West of Birch Lane and east of Cedar Lane.
  ['birch', 10.6, -1, 12.2, 11.5], ['birch', 23.2, -1, 12.2, 11.5],
  ['cedar', 7.2, -1, 10, 9.6], ['cedar', 18.0, -1, 10, 9.6],
  // Hazel Court and Acorn Court, both sides; the inner lots step back from the turning circles.
  ['hazel', 10.4, 1, 10.4, 11.2], ['hazel', 21.3, 1, 10.6, 9.6, 6.0], ['hazel', 9.8, -1, 10.4, 11.6], ['hazel', 20.9, -1, 11, 9.7, 6.0],
  ['acorn', 10.2, 1, 10.4, 11.6], ['acorn', 21.0, 1, 10.6, 9.7, 6.0], ['acorn', 10.2, -1, 10.4, 11.6], ['acorn', 21.0, -1, 10.6, 9.9, 6.0],
  // South side of the Drive, east of Acorn Court: deep lots that back onto the campus trees.
  ['drive', 84.1, 1, 11, 17], ['drive', 94.0, 1, 9.6, 13],
];
// Which lot is for sale, which is an empty plot (by index above).
const FOR_SALE = 11, VACANT = 16;
// Household names (no dialogue anywhere; these only label the parcels).
const FAMILIES = ['Park', 'Okafor', 'Lindqvist', 'Moreno', 'Haddad', 'Brennan', 'Castillo', 'Nakamura', 'Whitlock', 'Abara', 'Fontaine', 'Kowalski',
  'Delgado', 'Sato', 'Ferreira', 'Mbeki', 'Harlow', 'Quinn', 'Ostrowski', 'Reyes', 'Galloway', 'Thorne', 'Bianchi'];
const STREET_NO = {drive: 100, birch: 200, crescent: 300, cedar: 400, hazel: 500, acorn: 600};

// Local lot frame: +z points at the street (front), +x to the right when facing the street.
function frame(lot) {
  const f = lot.front, r = [-f[1], f[0]]; // r = f rotated -90deg: right-hand side when facing the street... from inside the lot
  return {
    w: (x, z) => r5(add(lot.center, add(mul(lot.right, x), mul(f, z)))),
    yaw: (turn = 0) => Math.atan2(f[0], f[1]) + turn,
  };
}
function buildLot(spec, i) {
  const [street, s, side, width, depth, setback = VERGE] = spec, pts = STREETS[street].points, {p, d} = along(pts, s);
  const perp = [-d[1], d[0]], out = mul(perp, side), front = mul(out, -1); // out: from street toward the lot; front: lot -> street
  const center = add(p, mul(out, setback + depth / 2));
  // Right-hand side in the house's own frame (three.js: rotation.y maps +x to (cos y, -sin y)).
  const yaw = Math.atan2(front[0], front[1]), right = [Math.cos(yaw), -Math.sin(yaw)];
  return {i, key: `maple-lot-${i}`, street, s, side, width, depth, setback, center: r5(center), front: r5(front), right: r5(right), yaw: +yaw.toFixed(5), streetPoint: r5(p), streetDir: r5(d)};
}

/** Model footprint in the same coordinates as a parking bay. */
export function mapleModelFootprint(model, center, yaw, scale) {
  const bounds = FOOT[model];
  if (!bounds || !Number.isFinite(scale)) return null;
  const [minX, minZ, maxX, maxZ] = bounds;
  const x = (minX + maxX) * scale / 2, z = (minZ + maxZ) * scale / 2;
  return {
    center: [center[0] + x * Math.cos(yaw) + z * Math.sin(yaw), center[1] - x * Math.sin(yaw) + z * Math.cos(yaw)],
    yaw, length: (maxZ - minZ) * scale, width: (maxX - minX) * scale,
  };
}

const rotFoot = (foot, scale, yaw, at) => { // world AABB of a rotated, scaled footprint
  const pts = [[foot[0], foot[1]], [foot[2], foot[1]], [foot[2], foot[3]], [foot[0], foot[3]]].map(([x, z]) => [at[0] + scale * (x * Math.cos(yaw) + z * Math.sin(yaw)), at[1] + scale * (-x * Math.sin(yaw) + z * Math.cos(yaw))]);
  return {min: [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1]))], max: [Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))]};
};

/** The complete, deterministic Maple Hollow layout (lots, yards, props, bays, crosswalks, stops). */
export function planMapleHollow() {
  const lots = LOT_SPECS.map(buildLot), props = [], bays = [], crosswalks = [], surfaces = [];
  const prop = (model, pos, yaw, extra = {}) => { const p = {model, pos: r5(pos), yaw: +yaw.toFixed(5), scale: extra.scale ?? SCALE.prop, ...extra}; props.push(p); return p; };
  let prevHouse = null, prevSiding = -1, cursor = 0;
  const ORDER = ['two_story_house', 'ranch_house', 'townhouse_duplex', 'split_level_house', 'bungalow_house', 'modern_house'];
  for (const lot of lots) {
    const F = frame(lot), W = lot.width, D = lot.depth, h = hash('mh:' + lot.i), h2 = hash('mh2:' + lot.i), h3 = hash('mh3:' + lot.i);
    lot.family = FAMILIES[lot.i % FAMILIES.length];
    lot.number = STREET_NO[lot.street] + 2 * (lot.i % 9) + (lot.side > 0 ? 1 : 2);
    lot.address = `${lot.number} ${STREETS[lot.street].name}`;
    lot.parts = {};
    lot.vacant = lot.i === VACANT; lot.forSale = lot.i === FOR_SALE || lot.vacant;
    // Ground: lawn over the whole lot (drawn by the renderer from these rectangles).
    surfaces.push({kind: 'lawn', lot: lot.key, center: lot.center, yaw: lot.yaw, size: [W - .2, D - .2], stripe: h > .5});
    lot.parts.lawn = true;
    const gside = (lot.i % 2 ? 1 : -1) * (h3 > .8 ? -1 : 1); // garage / driveway side (local x sign)
    if (lot.vacant) {
      for (const [x, z] of [[-2, 1.5], [2.4, -1.2], [-1, -3], [1.5, 3]]) prop('lawn_tuft_scatter', F.w(x, z), lot.yaw + x, {lot: lot.key, scale: .8});
      prop('rockery_boulders', F.w(-W / 2 + 2, -D / 2 + 2), lot.yaw, {lot: lot.key, scale: .55});
      prop('for_sale_sign', F.w(W / 2 - 2.2, D / 2 - .6), F.yaw(), {lot: lot.key});
      prop('mailbox', F.w(gside * (W / 2 - 1.2), D / 2 - .3), F.yaw(), {lot: lot.key}); lot.parts.mailbox = true;
      continue;
    }
    // House type: wide lots get the big models; no neighbour repeats the previous type.
    const fits = HOUSES.filter((m) => { const f = FOOT[m]; return (f[2] - f[0]) * SCALE.house <= W - 2.2 && (f[3] - f[1]) * SCALE.house <= D - 5; });
    // Rotate through all six types (so each appears three or four times); skip a type that doesn't fit or repeats a neighbour.
    let house = null; for (let k = 0; k < HOUSES.length && !house; k++) { const m = ORDER[(cursor + k) % ORDER.length]; if (fits.includes(m) && m !== prevHouse) { house = m; cursor += k + 1; } }
    house ??= fits.find((m) => m !== prevHouse) || fits[0]; prevHouse = house; lot.house = house;
    let siding = 1 + Math.floor(h2 * (SIDING.length - 1)); if (siding === prevSiding) siding = 1 + (siding % (SIDING.length - 1)); prevSiding = siding;
    lot.palette = {siding: house === 'modern_house' ? 1 : siding, roof: 1 + Math.floor(h3 * (ROOF.length - 1)), accent: 1 + (lot.i * 3) % (ACCENT.length - 1), paint: 1 + Math.floor(hash('paint:' + lot.i) * (PAINT.length - 1))};
    const hf = FOOT[house], hs = SCALE.house, hw = (hf[2] - hf[0]) * hs;
    // Garage beside the house when the frontage allows; the house shifts to the other side.
    const gf = FOOT.garage, gs = SCALE.garage, gw = (gf[2] - gf[0]) * gs;
    const garage = !['townhouse_duplex', 'modern_house'].includes(house) && W >= hw + gw + 1.4 && D >= 11;
    const setback = D >= 12 ? 3.6 : 3.0; // front yard depth (porch + walk)
    const houseFront = D / 2 - setback, hz = houseFront - hf[3] * hs;
    let hx = garage ? -gside * (W / 2 - .6 - hf[2] * hs) : 0; if (!garage) hx = -gside * Math.max(0, (W - hw) / 2 - 2.8);
    lot.parts.house = true;
    const houseAt = F.w(hx - (hf[0] + hf[2]) / 2 * hs, hz);
    lot.houseAt = houseAt; lot.houseYaw = F.yaw();
    lot.box = rotFoot(hf, hs, lot.houseYaw, houseAt);
    // Door: centre of the façade (the pack doors sit near the middle of each front).
    lot.door = F.w(hx, houseFront + .35);
    const porch = ['bungalow_house', 'ranch_house', 'two_story_house'].includes(house) && setback >= 3.4;
    if (porch) { prop('front_porch', F.w(hx, houseFront + 1.1 * hs), F.yaw(), {lot: lot.key, castShadow: true}); lot.door = F.w(hx, houseFront + 2.35); }
    // Driveway (local x = dx) from the kerb to the garage or the house front line.
    const dx = garage ? gside * (W / 2 - .6 - gw / 2) : gside * (W / 2 - 1.7);
    const dEnd = garage ? houseFront - .25 : houseFront - 1.2;
    const dLen = D / 2 + (VERGE - KERB) - dEnd;
    surfaces.push({kind: 'driveway', lot: lot.key, center: F.w(dx, dEnd + dLen / 2), yaw: lot.yaw, size: [2.7, dLen]});
    lot.parts.driveway = true;
    if (garage) prop('garage', F.w(dx, houseFront - gf[3] * gs - .25), F.yaw(), {scale: gs, lot: lot.key, castShadow: true, glow: true});
    // Driveway car: a parking bay on the driveway (traffic-simulation PARKING_BAYS), nose to the street.
    const carModel = ['family_sedan', 'suv_minivan', 'family_pickup'][Math.floor(h3 * 3)];
    const carZ = D / 2 - 1.4;
    if (h > .12) {
      const center = F.w(dx, carZ), yaw = F.yaw(), cf = FOOT[carModel];
      while (bays.some((b) => b.model === carModel && b.colour === PAINT[lot.palette.paint] && len(sub(b.center, center)) < 4)) {
        lot.palette.paint = 1 + lot.palette.paint % (PAINT.length - 1);
      }
      const bay = {id: `maple-${lot.i}`, type: 'driveway', center, yaw: +yaw.toFixed(5), length: +((cf[3] - cf[1]) * SCALE.car).toFixed(3), width: +((cf[2] - cf[0]) * SCALE.car).toFixed(3), road: r5(lot.streetPoint), model: carModel, colour: PAINT[lot.palette.paint], lot: lot.key};
      bays.push(bay); lot.bay = bay.id;
    }
    // Kerbside: mailbox by the driveway, wheelie bins at the garage end, address plaque on the walk.
    prop('mailbox', F.w(dx + gside * 1.75, D / 2 - .35), F.yaw(), {lot: lot.key}); lot.parts.mailbox = true;
    prop('wheelie_bins', F.w(dx - gside * 2.05, dEnd + .2), F.yaw(gside > 0 ? -Math.PI / 2 : Math.PI / 2), {lot: lot.key}); lot.parts.bins = true;
    prop('address_plaque', F.w(hx + (gside > 0 ? -1 : 1) * 1.1, D / 2 - .45), F.yaw(), {lot: lot.key, plaque: lot.number}); lot.parts.plaque = true;
    prop('stepping_stones', F.w(hx, (houseFront + (porch ? 2.3 : .2) + D / 2) / 2), F.yaw(), {scale: [.7, .75, Math.max(.2, (D / 2 - houseFront - (porch ? 2.3 : .2)) / 4)], lot: lot.key, flatY: 0});
    // Front garden: beds against the façade, a hedge or picket fence on the side line, a front tree.
    prop('flower_bed', F.w(hx - gside * (hw / 2 + .2), houseFront + .9), F.yaw(), {scale: .55, lot: lot.key});
    if (W - hw - (garage ? gw : 0) > 3.4 || !garage) prop(h2 > .5 ? 'boxwood_hedge' : 'flower_bed', F.w(hx + gside * (hw / 2 - .9), houseFront + .35), F.yaw(), {scale: .6, lot: lot.key});
    for (const side of [-1, 1]) prop('boxwood_hedge', F.w(hx + side * Math.min(hw / 2 - .7, 1.9), houseFront + .45), F.yaw(), {lot: lot.key, scale: .5});
    const treeModel = h > .55 ? 'shade_tree' : h > .3 ? 'flowering_tree' : 'arborvitae_conifer';
    prop(treeModel, F.w(-gside * (W / 2 - 1.6), D / 2 - 1.5), h2 * 6.28, {scale: treeModel === 'shade_tree' ? .62 + h * .18 : .72 + h3 * .2, lot: lot.key, castShadow: true, tree: true});
    if (h3 > .55) for (let k = 0; k < 2; k++) prop('picket_fence', F.w(-gside * (W / 2 - .15), D / 2 - 1.2 - (k + .5) * 1.55 - 2.2), F.yaw(Math.PI / 2), {lot: lot.key});
    // Backyard: area behind the house (local z from -D/2 to house back).
    const back = hz + hf[1] * hs, yardD = back + D / 2; // depth of the backyard
    const yard = {lot: lot.key, slots: []};
    // Way round to the backyard: the wider side gap (the garage takes one side).
    const houseL = hx - hw / 2, houseR = hx + hw / 2, gL = garage && gside < 0 ? dx + gw / 2 : -W / 2, gR = garage && gside > 0 ? dx - gw / 2 : W / 2;
    // Always the side away from the driveway, so nobody walks through the parked car.
    const sx = gside > 0 ? (houseL + Math.max(-W / 2, gL)) / 2 : (houseR + Math.min(W / 2, gR)) / 2;
    lot.around = [F.w(hx, houseFront + .9), F.w(sx, houseFront + .9), F.w(sx, back - 1.1)];
    const bx = (u) => hx + u * (W / 2 - 1.8);
    if (yardD > 2.4) {
      // Rear privacy fence along the back line, hedges on the sides.
      // Rear line: a short run of pale picket or privacy fence by the patio, the rest hedges and gaps.
      const fence = hash('fence:' + lot.i) > .5 ? 'picket_fence' : 'privacy_fence';
      for (let x = -W / 2 + 1.1, k = 0; x < W / 2 - .5; x += 1.55, k++) { const m = k % 4 === 3 ? null : k % 4 === 2 ? 'boxwood_hedge' : fence; if (m) prop(m, F.w(x, -D / 2 + .2), F.yaw(), {lot: lot.key, ...(m === 'boxwood_hedge' ? {scale: .66} : {})}); }
      const zMid = -D / 2 + yardD / 2;
      const pick = Math.floor(hash('yard:' + lot.i) * 6);
      if (yardD > 4.2) { const deck = prop('backyard_deck', F.w(hx * .4, back - 1.69 * hs - .1), F.yaw(Math.PI), {lot: lot.key, castShadow: true}); lot.deck = deck.pos; }
      prop('bbq_grill', F.w(hx * .4 + (gside > 0 ? -1 : 1) * 2.3, back - 1.0), F.yaw(Math.PI), {lot: lot.key});
      yard.grill = F.w(hx * .4 + (gside > 0 ? -1 : 1) * 2.3, back - 1.75);
      const kind = ['swing', 'treehouse', 'hoop', 'pool', 'sprinkler'][(lot.i + pick) % 5]; // every yard kind appears
      lot.yardKind = kind;
      if (kind === 'swing') { const at = F.w(bx(gside), zMid); prop('swing_set', at, F.yaw(), {lot: lot.key, castShadow: true, swing: true}); yard.slots.push({id: 'swing', at: F.w(bx(gside) - .6 * hs, zMid + .15), facing: F.yaw()}, {id: 'swing-2', at: F.w(bx(gside) + .7 * hs, zMid + .15), facing: F.yaw()}); }
      if (kind === 'treehouse' && yardD > 3.6) { const at = F.w(bx(gside), zMid - .3); prop('kids_treehouse', at, F.yaw(Math.PI), {lot: lot.key, castShadow: true, scale: .55}); yard.slots.push({id: 'treehouse', at: F.w(bx(gside) + .2, zMid - .2), facing: F.yaw()}); }
      if (kind === 'hoop' || (kind === 'treehouse' && yardD <= 3.6)) { lot.yardKind = 'hoop'; const at = F.w(dx, dEnd - .4); prop('basketball_hoop', at, F.yaw(), {lot: lot.key, castShadow: true}); // Players stand on the lawn beside the driveway, clear of the parked car.
        yard.slots.push({id: 'hoop', at: F.w(dx - gside * 2.1, dEnd + .9), facing: F.yaw(Math.PI) + gside * .5, shoot: true}, {id: 'hoop-2', at: F.w(dx - gside * 2.5, dEnd + 2.1), facing: F.yaw(Math.PI) + gside * .6}); }
      if (kind === 'pool' && yardD > 3.4) { prop('swimming_pool', F.w(bx(gside) * .8, zMid), F.yaw(), {lot: lot.key, flatY: 0, scale: .6}); yard.slots.push({id: 'pool', at: F.w(bx(gside) * .8 + 2.4 * hs * 1.25, zMid + .6), facing: F.yaw(-Math.PI / 2)}); }
      else if (kind === 'pool') { lot.yardKind = 'sprinkler'; }
      if (lot.yardKind === 'sprinkler') { prop('hose_reel_sprinkler', F.w(-bx(gside) * .3, -D / 2 + 1.1), F.yaw(), {lot: lot.key}); prop('sprinkler_spray', F.w(bx(gside) * .4, zMid), F.yaw(), {lot: lot.key, spray: true}); yard.slots.push({id: 'sprinkler', at: F.w(bx(gside) * .4 + 1.3, zMid + .3), facing: F.yaw(-Math.PI / 2)}, {id: 'sprinkler-2', at: F.w(bx(gside) * .4 - 1.4, zMid - .2), facing: F.yaw(Math.PI / 2)}); }
      // A few extras by lot hash: shed, pergola, patio set, lawn mower.
      if (lot.i % 3 === 0 && yardD > 4.5) prop('garden_shed', F.w(-bx(gside) * .95, -D / 2 + 1.5), F.yaw(Math.PI), {lot: lot.key, castShadow: true, scale: .6});
      else if (lot.i % 3 === 1 && yardD > 4.5) prop('pergola', F.w(-bx(gside) * .9, -D / 2 + 1.9), F.yaw(), {lot: lot.key, castShadow: true, scale: .62});
      const patio = F.w(hx * .4 - (gside > 0 ? -1 : 1) * 2.4, back - 1.6);
      prop('patio_table_chairs', patio, F.yaw(), {lot: lot.key, scale: .6});
      yard.patio = patio;
      if (lot.i % 4 === 2) prop('lawn_mower', F.w(-gside * (W / 2 - 1.2), houseFront - 1.0), F.yaw(Math.PI / 2), {lot: lot.key, scale: .6});
      lot.parts.yard = true;
    }
    lot.yard = yard;
    if (lot.forSale) prop('for_sale_sign', F.w(-gside * (W / 2 - 2.6), D / 2 - .7), F.yaw(), {lot: lot.key});
  }
  // ---- street furniture: lamps, hydrants, stop signs, trees on the verge line ----
  const streetProps = [];
  for (const [id, st] of Object.entries(STREETS)) {
    let total = 0; for (let i = 1; i < st.points.length; i++) total += len(sub(st.points[i], st.points[i - 1]));
    for (let s = 7, k = 0; s < total - 5; s += 13, k++) {
      const {p, d} = along(st.points, s), side = k % 2 ? 1 : -1, n = mul([-d[1], d[0]], side);
      streetProps.push({model: 'streetlamp', pos: r5(add(p, mul(n, VERGE + .1))), yaw: +Math.atan2(-n[0], -n[1]).toFixed(5) + Math.PI / 2, street: id, lamp: true});
      if (k % 3 === 1) streetProps.push({model: 'fire_hydrant', pos: r5(add(add(p, mul(n, -VERGE - .05)), mul(d, 2.5))), yaw: 0, street: id});
    }
  }
  // Street trees on the loop's open outer verge (the Crescent's hill side, and Birch and Cedar where
  // no lot fronts), between the lamps and clear of lots (critic round 2: the outer side of the loop read bare).
  const lampsAt = streetProps.filter((q) => q.lamp).map((q) => q.pos), B = MAPLE_HOLLOW_BOUNDS;
  for (const id of ['crescent', 'birch', 'cedar']) {
    const st = STREETS[id]; let total = 0; for (let i = 1; i < st.points.length; i++) total += len(sub(st.points[i], st.points[i - 1]));
    for (let s = 9, k = 0; s < total - 8; s += 8.5, k++) {
      const {p, d} = along(st.points, s), out = [d[1], -d[0]], q = r5(add(p, mul(out, VERGE + .9)));
      if (q[0] < B.minX + 1 || q[0] > B.maxX - 1 || q[1] < B.minZ - 1.5 || q[1] > B.maxZ - 1) continue; // the site box runs to z -185
      if (lampsAt.some((l) => Math.hypot(l[0] - q[0], l[1] - q[1]) < 3) || lots.some((l) => Math.abs((q[0] - l.center[0]) * l.right[0] + (q[1] - l.center[1]) * l.right[1]) < l.width / 2 + .6 && Math.abs((q[0] - l.center[0]) * l.front[0] + (q[1] - l.center[1]) * l.front[1]) < l.depth / 2 + .6)) continue;
      streetProps.push({model: k % 3 === 2 ? 'flowering_tree' : 'shade_tree', pos: q, yaw: s, scale: k % 3 === 2 ? .8 : .66 + (k % 2) * .08, tree: true, castShadow: true, street: id});
    }
  }
  // Stop signs where each side street meets the Drive (on the right-hand kerb before the junction).
  // Junction-mouth crossings come from the pedestrian graph (drawn by traffic.js).
  for (const [id, pts, rev] of [['birch', STREETS.birch.points, false], ['cedar', STREETS.cedar.points, true], ['hazel', STREETS.hazel.points, false], ['acorn', STREETS.acorn.points, false]]) {
    const end = rev ? pts.at(-1) : pts[0], next = rev ? pts.at(-2) : pts[1], d = unit(sub(end, next)), right = [d[1], -d[0]];
    streetProps.push({model: 'street_stop_sign', pos: r5(add(add(end, mul(d, -5.4)), mul(right, VERGE + .15))), yaw: +Math.atan2(-d[0], -d[1]).toFixed(5), street: id});
  }
  crosswalks.push(...MAPLE_HOLLOW_CROSSWALKS);
  // HOA entrance sign, entry garden and the Hollow Green pocket park (south-west corner).
  let entry = [
    {model: 'hoa_entrance_sign', pos: [-34.5, -132.6], yaw: -Math.PI / 2 + .35, scale: .62, castShadow: true, hoa: true},
    {model: 'flower_bed', pos: [-37.6, -130.4], yaw: 0, scale: .7}, {model: 'flower_bed', pos: [-31.4, -133.9], yaw: .4, scale: .6},
    {model: 'flowering_tree', pos: [-38.4, -126.6], yaw: 1.2, scale: .85, tree: true, castShadow: true},
    {model: 'flowering_tree', pos: [-30.2, -128.2], yaw: 2.4, scale: .78, tree: true, castShadow: true},
    {model: 'arborvitae_conifer', pos: [-39.2, -134.6], yaw: 0, scale: .7, tree: true, castShadow: true},
    {model: 'shade_tree', pos: [-35.5, -112.5], yaw: .3, scale: .8, tree: true, castShadow: true},
    {model: 'shade_tree', pos: [-30.8, -118.6], yaw: 2.1, scale: .7, tree: true, castShadow: true},
    {model: 'patio_table_chairs', pos: [-35.6, -119.8], yaw: 0, scale: .62},
    {model: 'swing_set', pos: [-36.2, -124.2], yaw: Math.PI / 2, castShadow: true, swing: true},
    {model: 'rockery_boulders', pos: [-30.5, -110.5], yaw: .7, scale: .7},
    {model: 'pond_garden', pos: [-32.8, -114.2], yaw: .2, scale: .7, flatY: 0},
  ].map((p) => ({scale: SCALE.prop, ...p}));
  surfaces.push({kind: 'park', center: [-34, -120.5], yaw: 0, size: [12, 28]});
  // Inside the ring's rounded corners: a picnic green and a little orchard.
  entry.push({model: 'patio_table_chairs', pos: [-15.6, -164.2], yaw: .4, scale: .62}, {model: 'shade_tree', pos: [-18.2, -160.6], yaw: 1, scale: .7, tree: true, castShadow: true},
    {model: 'flowering_tree', pos: [-13.6, -167.8], yaw: 2, scale: .75, tree: true, castShadow: true}, {model: 'flower_bed', pos: [-17.8, -166.4], yaw: 0, scale: .6},
    {model: 'shade_tree', pos: [37.8, -163.4], yaw: 2.2, scale: .66, tree: true, castShadow: true}, {model: 'arborvitae_conifer', pos: [39.6, -167.6], yaw: 0, scale: .7, tree: true, castShadow: true});
  surfaces.push({kind: 'park', center: [-16, -163.8], yaw: 0, size: [6.5, 8]});
  // Campus edge: shade trees along the strip between the courts and the stadium.
  for (let x = -26; x <= 34; x += 6.5) if (Math.abs(x + 12) > 7.5 && Math.abs(x - 21) > 8) entry.push({model: 'shade_tree', pos: [x, -107.6], yaw: x, scale: .66, tree: true, castShadow: true});
  // Campus edge: a row of shade trees between the deep lots and Owls Memorial Stadium.
  for (let x = 38; x <= 58; x += 6.5) streetProps.push({model: 'shade_tree', pos: [x, -106.8], yaw: x, scale: .7, tree: true, castShadow: true});
  // Street furniture never stands in another street's junction mouth, a driveway or a lot's front walk.
  const clearOfStreets = (p) => Object.values(STREETS).every((st) => polyDist(p.pos, st.points) > VERGE - .2);
  const clearOfDrives = (p) => !surfaces.some((s) => s.kind === 'driveway' && Math.hypot(s.center[0] - p.pos[0], s.center[1] - p.pos[1]) < s.size[1] / 2 + .8 && Math.abs((p.pos[0] - s.center[0]) * Math.cos(s.yaw) - (p.pos[1] - s.center[1]) * Math.sin(s.yaw)) < 2.1);
  const street = streetProps.filter((p) => clearOfStreets(p) && (p.model === 'street_stop_sign' || clearOfDrives(p)));
  return {lots, props: [...props, ...street.map((p) => ({scale: SCALE.prop, ...p})), ...entry], bays, crosswalks, surfaces};
}

// Painted mid-block crossings: both Maple Hollow bus stops, and the Thistlebrook High
// stop on the airport road at the school edge. `dir` runs along the road.
export const MAPLE_HOLLOW_CROSSWALKS = Object.freeze([
  {point: [36, -142.7308], axis: 'z', dir: [.99705, -.07669], street: 'drive', mapleHollow: true},
  {point: [20, -127], axis: 'x', dir: [0, 1], street: 'acorn', mapleHollow: true},
  {point: [64, -80.5], axis: 'x', dir: [0, 1], street: 'airport', mapleHollow: true},
]);
// ---- households and residents (life system) ----
// Kids take the school bus (stop = morning boarding stop); adults walk or drive to work.
export const MAPLE_HOLLOW_RESIDENTS = Object.freeze([
  {name: 'Dana', role: 'Nurse', lot: 0, work: 'Willow Community Clinic', model: 'herbalist', favourite: 'sit'},
  {name: 'Toby', role: 'Kid', lot: 0, kid: true, stop: 'mh-stop-drive', model: 'child', favourite: 'play'},
  {name: 'Marcus', role: 'Science teacher', lot: 2, work: 'Thistlebrook High School', model: 'shopkeeper', favourite: 'sit'},
  {name: 'Ivy', role: 'Kid', lot: 2, kid: true, stop: 'mh-stop-drive', model: 'merchant', favourite: 'play'},
  {name: 'Priya', role: 'Librarian', lot: 6, work: 'Civic Library & Story Garden', model: 'innkeeper', favourite: 'sit'},
  {name: 'Leo', role: 'Kid', lot: 6, kid: true, stop: 'mh-stop-drive', model: 'carpenter', favourite: 'play'},
  {name: 'Ruth', role: 'Retired engineer', lot: 9, work: null, model: 'elder', favourite: 'sit'},
  {name: 'Sam', role: 'Postal carrier', lot: 13, work: 'The Post Office', model: 'watch', favourite: 'sit'},
  {name: 'Nia', role: 'Kid', lot: 13, kid: true, stop: 'mh-stop-acorn', model: 'child', favourite: 'play'},
  {name: 'Owen', role: 'Kid', lot: 15, kid: true, stop: 'mh-stop-acorn', model: 'farmhand', favourite: 'play'},
  {name: 'Grace', role: 'Baker', lot: 15, work: 'Sunrise Bakehouse', model: 'merchant', favourite: 'sit'},
  {name: 'Eli', role: 'Kid', lot: 19, kid: true, stop: 'mh-stop-acorn', model: 'blacksmith', favourite: 'play'},
  {name: 'Jonah', role: 'Carpenter', lot: 19, work: 'Bram’s Workshop', model: 'carpenter', favourite: 'sit'},
  {name: 'Mira', role: 'Kid', lot: 21, kid: true, stop: 'mh-stop-acorn', model: 'herbalist', favourite: 'play'},
]);
// Friday-to-Sunday evenings bring a BBQ on a host's deck; the host rotates by day.
export const BBQ_HOSTS = Object.freeze([2, 15, 19]);
export const KID_SCALE = .64;

// ---- school bus: a scheduled regional vehicle (src/roads/regional-traffic.js) ----
// Waypoints along road centerlines; the route runs depot -> Acorn Court ->
// Drive -> airport road south to its end at the campus, turns there and comes
// back. Morning: board in Maple Hollow on the way out, alight at Thistlebrook High on
// the way back. Afternoon: board at Thistlebrook High, alight in Maple Hollow.
export const BUS = Object.freeze({
  depot: [23.6, -112.4], // the lay-by beside Acorn Court's turning circle
  waypoints: [[20, -117], [20, -141.5], [46, -143.5], [64, -147], [64, -69]],
  stops: [
    {id: 'mh-stop-acorn', name: 'Acorn Court bus stop', at: [20, -127], forward: true, wait: [16.1, -127]},
    {id: 'mh-stop-drive', name: 'Maple Hollow Drive bus stop', at: [36, -142.7308], forward: true, wait: [36, -146.85]},
    {id: 'mh-stop-school', name: 'Thistlebrook High bus stop', at: [64, -78], forward: false, wait: [60.4, -78], school: true},
    {id: 'mh-stop-drive-home', name: 'Maple Hollow Drive (homebound)', at: [36, -142.7308], forward: false, home: true},
    {id: 'mh-stop-acorn-home', name: 'Acorn Court (homebound)', at: [20, -127], forward: false, home: true},
  ],
  // Departure hours (weekdays). Pickup/dropoff lists name the stops used on each run.
  runs: [
    {id: 'morning', depart: 7.35, pickup: ['mh-stop-acorn', 'mh-stop-drive'], dropoff: ['mh-stop-school']},
    {id: 'afternoon', depart: 15.2, pickup: ['mh-stop-school'], dropoff: ['mh-stop-drive-home', 'mh-stop-acorn-home']},
  ],
  dwell: 9, maxDwell: 60,
});

/** Compiler hook (compileWorld, before planRegionalRoads): streets, homes, door paths, stop paths. */
export function addMapleHollow(town) {
  const plan = planMapleHollow();
  const group0 = town.regionalRouteCount || 0, groups = [];
  for (const st of Object.values(STREETS)) {
    const routeGroup = town.regionalRouteCount = (town.regionalRouteCount || 0) + 1; groups.push(routeGroup - 1);
    for (let i = 1; i < st.points.length; i++) town.roads.push({a: [...st.points[i - 1]], b: [...st.points[i]], width: 8, kind: 'world-link', owner: 'world-link', routeGroup: routeGroup - 1, mapleHollow: true});
  }
  town.districts.push({id: MH, name: 'Maple Hollow', type: 'neighbourhood', center: [12, -150]});
  // Homes are buildings: the life registry finds them, and every door joins the street graph.
  const nearestOnStreet = (lot) => { const st = STREETS[lot.street].points; let best = null; for (let i = 1; i < st.length; i++) { const a = st[i - 1], b = st[i], d = sub(b, a), t = Math.max(0, Math.min(1, ((lot.door[0] - a[0]) * d[0] + (lot.door[1] - a[1]) * d[1]) / (d[0] ** 2 + d[1] ** 2))), q = add(a, mul(d, t)); const dd = len(sub(q, lot.door)); if (!best || dd < best.d) best = {d: dd, q: r5(q)}; } return best.q; };
  for (const lot of plan.lots) {
    if (lot.vacant) { lot.node = null; continue; }
    const join = nearestOnStreet(lot), walk = r5(add(lot.door, mul(unit(sub(join, lot.door)), Math.max(0, len(sub(join, lot.door)) - VERGE - .2))));
    lot.join = join; lot.walk = walk;
    town.buildings.push({key: lot.key, id: 'maple-hollow-' + lot.house.replace('_house', ''), custom: true, name: `${lot.address} · The ${lot.family}s`, pos: [...lot.houseAt], rot: lot.houseYaw, box: lot.box, door: [...lot.door], approach: walk, join, kind: 'home', district: MH, height: 6,
      // Facade identity for the TOWN-07 variety audit: model, siding and roof colours.
      color: `${SIDING[lot.palette.siding]}/${ROOF[lot.palette.roof]}`, shop: lot.house,
      story: `A ${HOUSE_LABEL[lot.house]} on ${STREETS[lot.street].name}${lot.forSale ? ', with a For Sale sign on the lawn' : ''}. ${lot.yardKind === 'pool' ? 'A pool out back' : lot.yardKind === 'treehouse' ? 'A treehouse in the backyard' : lot.yardKind === 'hoop' ? 'A hoop over the driveway' : lot.yardKind === 'sprinkler' ? 'The sprinkler runs on warm afternoons' : 'A swing set out back'}, a mailbox at the kerb and the bins by the garage.`});
    town.roads.push({a: [...lot.door], b: walk, width: 1.1, kind: 'door', owner: lot.key, mapleHollow: true, external: MH}, {a: walk, b: join, width: 1.1, kind: 'door', owner: lot.key, mapleHollow: true, external: MH});
  }
  // Bus stops: a short paved spur from the waiting spot to the street, so each stop is a graph node.
  const stopNodes = {};
  for (const s of BUS.stops) if (s.wait) {
    const st = Object.values(STREETS).find((v) => polyDist(s.at, v.points) < .05);
    const target = st ? s.at : null; if (!target) continue; // the school stop uses the airport-road footpath node
    town.roads.push({a: [...s.wait], b: [...s.at], width: 1.2, kind: 'walk', owner: MH, mapleHollow: true, external: MH, mapleHollowStop: s.id});
    stopNodes[s.id] = s.wait;
  }
  town.mapleHollow = {...plan, routeGroups: groups.filter((g) => g >= group0), streets: STREETS, stopPoints: stopNodes, residents: MAPLE_HOLLOW_RESIDENTS, bbqHosts: BBQ_HOSTS};
  return town.mapleHollow;
}

/** Right after planRegionalRoads: the new chain records carry the Maple Hollow flag. */
export function flagMapleHollowRoads(town, planRegionalLines) {
  const mh = town.mapleHollow; if (!mh) return;
  const groups = new Set(mh.routeGroups);
  for (const r of town.roads) if (r.kind === 'world-link' && r.centerline && (r.routeGroups || [r.routeGroup]).every((g) => groups.has(g))) r.mapleHollow = true;
  // Keep local traffic on the neighbourhood streets. The airport approach has
  // its own through service past the Maple junction.
  const roads = town.roads.filter((r) => r.kind === 'world-link');
  const driveGroup = mh.routeGroups[0];
  const groupOf = (r) => !r.mapleHollow ? 'through' : r.routeGroups.includes(driveGroup) ? 'drive' : 'side-streets';
  town.regionalLines = ['through', 'drive', 'side-streets'].flatMap((group) => {
    const indices = roads.flatMap((r, i) => groupOf(r) === group ? [i] : []);
    return planRegionalLines(indices.map((i) => roads[i])).map((line) => ({
      ...line, roads: line.roads.map((i) => indices[i]), mapleHollow: group !== 'through',
    }));
  }).map((line, id) => ({...line, id}));
}
/** After the final graph rebuild: building nodes, the region, stop nodes and the bus route. */
export function finishMapleHollow(town, node) {
  const mh = town.mapleHollow; if (!mh) return;
  for (const b of town.buildings) if (b.district === MH) b.node = node(b.door);
  town.regions.push({id: MH, offset: [0, 0], bounds: {...MAPLE_HOLLOW_BOUNDS}, ground: false});
  for (const lot of mh.lots) if (lot.door && !lot.vacant) lot.node = node(lot.door);
  mh.nodes = {};
  for (const [id, p] of Object.entries(mh.stopPoints)) mh.nodes[id] = node(p);
  mh.nodes['mh-stop-school'] = node([60, -69]);
  mh.bus = {...BUS, route: busRoute(town)};
}

// Shortest path over the planned regional centerlines between consecutive waypoints.
export function busRoute(town) {
  const recs = town.roads.filter((r) => r.kind === 'world-link' && r.centerline);
  const keyOf = (p) => p.map((v) => v.toFixed(2)).join(','), pts = new Map(), edges = new Map();
  const id = (p) => { const k = keyOf(p); if (!pts.has(k)) { pts.set(k, p); edges.set(k, []); } return k; };
  for (const r of recs) for (let i = 1; i < r.centerline.length; i++) { const a = id(r.centerline[i - 1]), b = id(r.centerline[i]), w = len(sub(r.centerline[i], r.centerline[i - 1])); edges.get(a).push([b, w]); edges.get(b).push([a, w]); }
  const nearest = (p) => { let best = null, bd = Infinity; for (const [k, q] of pts) { const d = len(sub(p, q)); if (d < bd) { bd = d; best = k; } } return best; };
  const path = (s, t) => { const dist = new Map([[s, 0]]), prev = new Map(), open = new Set([s]); while (open.size) { let u = null; for (const k of open) if (u === null || dist.get(k) < dist.get(u)) u = k; open.delete(u); if (u === t) break; for (const [v, w] of edges.get(u)) { const nd = dist.get(u) + w; if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); open.add(v); } } } const out = []; for (let k = t; k; k = prev.get(k)) { out.unshift(pts.get(k)); if (k === s) break; } return out; };
  let route = [[...BUS.depot]];
  const way = BUS.waypoints.map(nearest);
  for (let i = 1; i < way.length; i++) route = route.concat(path(way[i - 1], way[i]).slice(i === 1 ? 0 : 1));
  return route.map(r5);
}

// ---- life places: bus stops, backyard play and BBQ decks (registry places with interactions) ----
const standing = (id, position, facing, animation = 'idle', approach = []) => ({id, kind: 'standing', position: r5(position), facing: +facing.toFixed(4), animation, approach: approach.map(r5)});
export function addMapleHollowPlaces(town) {
  const mh = town.mapleHollow; if (!mh) return;
  const ids = (pred) => MAPLE_HOLLOW_RESIDENTS.filter(pred).map((r) => 'resident:' + r.name.toLowerCase());
  const kids = ids((r) => r.kid), everyone = ids(() => true);
  const place = (id, name, kind, node, pos, interaction, owner = 'Maple Hollow HOA') => {
    const record = {id, type: 'area', kind, name, district: MH, owner, occupants: [], hours: [...interaction.hours], capabilities: ['walkTo', ...interaction.tools], pos: r5(pos), node,
      entryPoints: [{node, position: [...town.nodes[node]], approach: []}], interactionPoints: interaction.slots, interaction,
      activity: {enabled: true, activity: interaction.activity, animation: interaction.slots[0].animation, slots: interaction.slots}};
    town.registry.places.push(record); return record;
  };
  // Bus stops: waiting spots on the sidewalk on the bus's side of the street.
  for (const s of BUS.stops.filter((s) => s.wait)) {
    const node = mh.nodes[s.id], riders = ids((r) => r.kid && (r.stop === s.id || s.school));
    const st = s.school ? [[64, -69], [64, -184]] : Object.values(STREETS).find((v) => polyDist(s.at, v.points) < .05).points;
    let best = null; for (let i = 1; i < st.length; i++) { const d = segDist(s.at, st[i - 1], st[i]); if (!best || d < best.d) best = {d, dir: unit(sub(st[i], st[i - 1]))}; }
    const out = unit(sub(s.wait, s.at)), kerb = add(s.at, mul(out, 3.35)), face = Math.atan2(-out[0], -out[1]);
    // One waiting place per rider: all seven kids share the school stop.
    const n = Math.max(6, riders.length), slots = Array.from({length: n}, (_, k) => standing(String(k), add(kerb, mul(best.dir, (k - (n - 1) / 2) * .75 + (s.school ? -1.5 : 0))), face));
    const approach = s.school ? [[60.65, -70.2], [60.65, -75.5]] : [];
    place(s.id, s.name, 'bus-stop', node, s.wait, {version: 1, activity: 'queue', label: 'Waiting for the school bus', tools: ['visit'], duration: 600, minParticipants: 1, entryNode: node, approach, slots, hours: [6.5, 17.5], residents: riders, busStop: s.id});
  }
  // Backyard play after school: swing sets, treehouses, hoops, sprinklers and pools.
  for (const lot of mh.lots.filter((l) => l.yard?.slots.length && Number.isInteger(l.node))) {
    const hoop = lot.yardKind === 'hoop', label = {swing: 'On the swing set', treehouse: 'Up at the treehouse', hoop: 'Shooting hoops', pool: 'Splashing in the pool', sprinkler: 'Running through the sprinkler'}[lot.yardKind];
    const slots = lot.yard.slots.map((q) => standing(q.id, q.at, q.facing, q.shoot ? 'work' : 'idle'));
    place(`mh-yard:${lot.key}`, `The ${lot.family}s’ ${hoop ? 'driveway hoop' : 'backyard'}`, 'yard', lot.node, lot.yard.slots[0].at,
      {version: 1, activity: 'play', label, tools: ['visit'], duration: 150, minParticipants: 1, entryNode: lot.node, approach: hoop ? [] : lot.around.slice(1), slots, hours: [15, 20.25], residents: kids, yard: lot.yardKind}, `The ${lot.family} family`);
  }
  // BBQ evenings on a host's deck: one at the grill, four round the patio table.
  for (const i of BBQ_HOSTS) {
    const lot = mh.lots[i]; if (!lot?.yard?.patio || !Number.isInteger(lot.node)) continue;
    const c = lot.yard.patio, F = frame(lot), seatAt = (k) => add(c, mul([Math.cos(k * Math.PI / 2 + .6), Math.sin(k * Math.PI / 2 + .6)], .62));
    const slots = [standing('grill', lot.yard.grill, lot.houseYaw + Math.PI, 'work'),
      ...[0, 1, 2, 3].map((k) => { const p = seatAt(k), d = sub(c, p); return {id: 'seat-' + k, kind: 'seat', position: r5(p), facing: +Math.atan2(d[0], d[1]).toFixed(4), seatHeight: .3, animation: 'eat', approach: []}; }),
      standing('chat', add(c, mul(lot.front, -1.6)), lot.houseYaw, 'idle')];
    void F;
    place(`mh-bbq:${lot.key}`, `BBQ at the ${lot.family}s’`, 'bbq', lot.node, c, {version: 1, activity: 'picnic', label: 'BBQ with the neighbours', tools: ['eat', 'rest', 'visit'], duration: 240, minParticipants: 1, entryNode: lot.node, approach: lot.around.slice(1), slots, hours: [17.5, 22], residents: everyone, bbq: true}, `The ${lot.family} family`);
  }
}

// Driveway parking bays for traffic-simulation.js (the audit and the collision sim see every one).
export const MAPLE_HOLLOW_BAYS = Object.freeze(planMapleHollow().bays.map((b) => Object.freeze(b)));
