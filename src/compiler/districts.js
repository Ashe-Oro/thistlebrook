import { spawnVillagers } from './villagers.js';
// Connected street districts. Slot order and all arithmetic are shared by Node
// and the browser; the original plaza compiler stays on its v3 random stream.
import { buildEdo, dressEdo, EDO_CAMERA_POCKET, edoWaterCrossing, edoNorenAtDoor, edoGardenRouteSupports, edoRopeAtHall } from './edo.js';
import { math as Math } from './math.js';
import { scaleCount } from './spec.js';
import { queryCatalog, rectForInst } from './compile.js';
import { obbFromRect, obbOverlap, obbCorners, obbPointDistance, rectXZ, pointInArea, toWorldXZ, rotDir, strutEnds, segPointDistance, dist, TAU, walkingRects } from './geometry.js';

const place = i => ({ x: i.pos[0], z: i.pos[1], rotY: i.rotY });
export function extendDistricts({ spec, catalog, rng, instances, buildings, lots, paths, area }) {
  const streets = [];
  const strip = (a, b, width, extra) => ({
    id: spec.paths.id, kind: 'path', pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    rotY: Math.atan2(b[0] - a[0], b[1] - a[1]), scale: 1,
    params: { length: dist(a, b), width }, ...extra,
  });
  function street(name, a, b, district, width = 3.2) {
    const p = strip(a, b, width, { streetId: name, district });
    streets.push(p); paths.push(p);
    return p;
  }
  street('green-approach', [0, 5.7], [0, 18], 'plaza');
  street('south-lane', [-50, 18], [58, 18], 'residential');
  street('west-lane', [-50, 18], [-50, -58], 'residential');
  street('upper-street', [-50, -36], [46, -36], 'residential');
  street('orchard-street', [-50, -58], [46, -58], 'residential');
  street('market-street', [30, 18], [30, -58], 'market', 4);
  street('farm-track', [58, 18], [58, -38], 'farm', 2.8);
  const pathObb = p => obbFromRect(rectForInst(p, catalog), place(p));
  function clear(entry, pos, rotY, scale = 1, lot = false, ownLot = null) {
    const pl = { x: pos[0], z: pos[1], rotY };
    const o = obbFromRect(lot ? entry.lot || rectXZ(entry.bounds) : rectXZ(entry.bounds), pl, scale);
    if (obbCorners(o).some(c => !pointInArea(area, c, 1))) return false;
    if (obbPointDistance(o, [0, 0]) < spec.plaza.ring.radius + spec.plaza.ring.width / 2 + 1) return false;
    if (lots.some(l => l !== ownLot && obbOverlap(o, l, 0.7))) return false;
    const walk = entry.walkOpening ? walkingRects(entry).map(r => obbFromRect(r, pl, scale)) : [o];
    if (paths.some(p => !edoGardenRouteSupports({id:entry.id,district:'edo'},p) && walk.some(w => obbOverlap(w, pathObb(p), entry.walkOpening ? 0.05 : entry.id === 'edo-noren-curtain' ? 0.3 : 0.4)))) return false;
    return true;
  }
  function addBuilding(id, pos, rotY, road, kind, district) {
    const entry = catalog.get(id);
    const snap = entry.pathSnaps[0];
    const a = toWorldXZ([snap.pos[0], snap.pos[2]], { x: pos[0], z: pos[1], rotY });
    const [A, B] = strutEnds(road);
    const end = A[0] === B[0] ? [A[0], a[1]] : [a[0], A[1]];
    if (road.district === 'edo') {
      end[0] = Math.max(Math.min(A[0], B[0]), Math.min(Math.max(A[0], B[0]), end[0]));
      end[1] = Math.max(Math.min(A[1], B[1]), Math.min(Math.max(A[1], B[1]), end[1]));
    }
    const dir = rotDir([snap.dir[0], snap.dir[2]], rotY);
    const p = strip(a, end, id === 'edo-worship-hall' ? 1.2 : spec.paths.width, { lot: buildings.length, district });
    if (!clear(entry, pos, rotY, 1, true)) return false;
    if (lots.some(l => obbOverlap(pathObb(p), l, 0.2))) return false;
    const lot = obbFromRect(entry.lot || entry.footprint, { x: pos[0], z: pos[1], rotY });
    const inst = { id, kind, pos, rotY, scale: 1, lot: buildings.length, district, street: road.streetId };
    const b = { entry, pos, rotY, index: buildings.length, kind, lot, inst, dp: { a, end, dir, bend: 0 } };
    buildings.push(b); lots.push(lot); instances.push(inst); paths.push(p);
    return true;
  }
  const road = id => streets.find(p => p.streetId === id);
  const cozyHomes = queryCatalog(catalog, spec.houses.pick);
  const [lo, hi] = scaleCount(spec.houses.count, spec.density.houses);
  const target = rng.int(lo, hi);
  const current = buildings.filter(b => b.kind === 'house').length;
  const streetCount = Math.max(0, target - current - 2);
  const slots = [];
  // Interleave rows so every seed populates both residential neighbourhoods.
  for (const x of [-40, -26, -12, 2, 16, 42]) {
    slots.push([[x, -46], 'upper-street', 0], [[x, -68], 'orchard-street', 0]);
  }
  for (const z of [-6, -22, -42, -58]) slots.push([[-61, z], 'west-lane', Math.PI / 2]);
  const extraRows = Math.max(0, Math.ceil((streetCount - slots.length) / 6));
  if (extraRows && spec.district !== 'edo') {
    const end = -58 - extraRows * 22;
    street('west-extension', [-50, -58], [-50, end], 'residential');
    street('east-extension', [30, -58], [30, end], 'residential');
    for (let row = 0; row < extraRows; row++) {
      const z = -80 - row * 22, name = `north-street-${row}`;
      street(name, [-50, z], [46, z], 'residential');
      for (const x of [-40, -26, -12, 2, 16, 42]) slots.push([[x, z - 10], name, 0]);
    }
  }
  for (const [pos, name, yaw] of slots.slice(0, streetCount)) {
    addBuilding(rng.pick(cozyHomes).id, pos, yaw, road(name), 'house', 'residential');
  }
  // The farm stays at source scale, with a track-facing farmhouse and cottage.
  addBuilding('farm-farmhouse', [71, -30], -Math.PI / 2, road('farm-track'), 'house', 'farm');
  addBuilding('farm-farmhand-cottage', [69, -12], -Math.PI / 2, road('farm-track'), 'house', 'farm');
  const civics = ['cv-blacksmith', 'cv-market-hall', 'cv-windmill', 'cv-store'];
  for (let i = 0; i < civics.length; i++) addBuilding(civics[i], [42, -27 + i * 13], -Math.PI / 2, road('market-street'), 'landmark', 'market');
  addBuilding('farm-produce-stand', [66, 4], -Math.PI / 2, road('farm-track'), 'landmark', 'farm');
  const civicTarget = rng.int(...spec.landmarks.count);
  for (const [i, id] of ['cv-bakery', 'cv-tavern', 'cv-chapel', 'cv-store'].entries()) {
    if (buildings.filter(b => b.kind === 'landmark').length >= civicTarget) break;
    addBuilding(id, [-37 + i * 16, 31], Math.PI, road('south-lane'), 'landmark', 'civic');
  }

  if (spec.district === 'edo') buildEdo(street, addBuilding);

  // All dressing uses full mesh bounds for rejection, including roof/canopy
  // overhangs. Keep collisions conservative rather than hiding them in checks.
  const occupied = instances.filter(i => catalog.has(i.id) && !['path', 'ring'].includes(i.kind))
    .map(i => ({ box: obbFromRect(rectXZ(catalog.get(i.id).bounds), place(i), i.scale), inst: i }));
  function dress(id, pos, rotY = 0, kind = 'prop', district = 'residential', scale = 1, facade = null) {
    const e = catalog.get(id);
    if (spec.district === 'edo' && ['tree', 'bush'].includes(kind)) {
      const o = obbFromRect(rectXZ(e.bounds), { x: pos[0], z: pos[1], rotY }, scale);
      const pocket = obbFromRect(EDO_CAMERA_POCKET, { x: 0, z: 0, rotY: 0 });
      if (obbOverlap(o, pocket)) return false;
    }
    const mountedRope = facade && edoRopeAtHall({id,pos,rotY,facadeLot:facade.index},facade.inst,facade.entry);
    if (!mountedRope && !clear(e, pos, rotY, scale, false, facade?.lot)) return false;
    const o = obbFromRect(rectXZ(e.bounds), { x: pos[0], z: pos[1], rotY }, scale);
    const candidate = { id, pos, rotY, district, scale, facadeLot: facade?.index };
    const waterChain = new Set(['edo-koi-pond-tile','edo-garden-stream-tile','edo-waterfall-cascade']);
    if (occupied.some(b => obbOverlap(o, b.box, waterChain.has(id) && waterChain.has(b.inst.id) ? 0 : 0.35)
      && !edoWaterCrossing(candidate, b.inst) && !edoNorenAtDoor(candidate, b.inst, catalog.get(b.inst.id)) && !edoRopeAtHall(candidate,b.inst,catalog.get(b.inst.id)))) return false;
    if (kind === 'tree' || kind === 'bush') {
      const rad = Math.max(e.footprint.max[0] - e.footprint.min[0], e.footprint.max[1] - e.footprint.min[1]) / 2 * scale;
      if (paths.some(p => { const [a, b] = strutEnds(p); return segPointDistance(a, b, pos) < p.params.width / 2 + rad + 0.4; })) return false;
    }
    occupied.push({ box: o, inst: { id, pos, rotY, district, scale } });
    instances.push({ id, kind, pos, rotY, scale, district, ...(facade ? { facadeLot: facade.index } : {}) });
    return true;
  }
  if (spec.district === 'edo') dressEdo(dress, (id, pos, rotY, street, pavingWidth) => {
    // Paving is a low visual skin. It cannot masquerade as a traversable path.
    instances.push({ id, kind: 'paving', pos, rotY, scale: 1, district: 'edo', street, ...(pavingWidth ? { pavingWidth } : {}) });
  });
  if (spec.district === 'edo') {
    const h = buildings.find(b => b.inst.id === 'edo-worship-hall');
    if (h) dress('edo-shimenawa-rope', toWorldXZ([0,h.entry.door.pos[2]+0.25],place(h)),h.rotY,'prop','edo',1,h);
  }
  // Reserve small market paving accents and a single farm pond before
  // loose stock can fill these pockets. Paving never replaces a walk path.
  for (const z of [-45, -51]) dress('cv-cobble-straight', [34.7, z], 0, 'prop', 'market', 0.4);
  for (const pos of [[94, -40], [96, -31], [92, -51], [90, 35]]) {
    if (dress('farm-farm-pond', pos, 0, 'prop', 'farm')) {
      dress('nat-cattails', [pos[0] - 3.5, pos[1]], 0, 'prop', 'farm');
      break;
    }
  }
  for (const z of [-21, -9, 3, 12]) dress('cv-aframe-chalkboard', [27, z], 0, 'prop', 'market');
  for (const [id, pos] of [['cv-garden-plot', [68, -57]], ['cv-tilled-field', [78, -57]],
    ['cv-rock-stepping-stones', [92, -47]], ['cv-road-stone-footbridge', [96, -20]]]) {
    dress(id, pos, 0, 'prop', 'farm');
  }
  // Market counters face the street (+X after canonicalising their -Z front).
  for (let z = -24; z <= 12; z += 6) {
    dress('cv-market-stall', [24, z], Math.PI / 2, 'prop', 'market');
    dress('cv-barrel', [20, z + 2], 0, 'prop', 'market');
    dress('cv-crate', [21, z - 2], 0, 'prop', 'market');
  }
  for (const [id, pos] of [
    ['cv-flower-cart', [24, 24]], ['cv-hand-cart', [35, 24]], ['cv-horse-cart', [46, 24]],
    ['farm-big-red-barn', [84, -27]], ['farm-stable', [84, -12]],
    ['farm-chicken-coop', [68, 25]], ['farm-greenhouse', [78, 22]],
    ['farm-grain-silo', [91, 7]], ['farm-hay-barn', [86, 20]],
    ['farm-windmill-pump', [64, -43]], ['farm-root-cellar', [82, -42]],
    ['farm-scarecrow', [68, -48]], ['farm-water-trough', [72, 15]],
  ]) dress(id, pos, 0, 'prop', pos[0] > 58 ? 'farm' : 'market');
  dress('cv-notice-board', [26, 15], 0, 'prop', 'market');
  dress('cv-directional-post', [-4, 15], 0, 'prop', 'plaza');
  dress('cv-village-entrance-sign', [-48, 22], 0, 'prop', 'residential');
  dress('nat-log-bench', [-46, 12], Math.PI / 2, 'prop', 'residential');
  dress('nat-granite-rock-cluster', [-45, 29], 0, 'prop', 'woodland');
  dress('nat-fallen-log-mossy', [-38, -81], 0, 'prop', 'woodland');
  for (let x = 65; x <= 85; x += 6) for (let z = -65; z <= -49; z += 6) {
    dress(rng.pick(['farm-crop-row-field', 'farm-pumpkin-patch', 'farm-sunflower-row', 'farm-corn-stalk-cluster', 'farm-wheat-cluster']), [x, z], 0, 'prop', 'farm');
  }
  for (let x = 65; x <= 85; x += 7) dress('farm-orchard-row', [x, -73], 0, 'prop', 'farm');
  for (const p of streets.filter(p => p.district !== 'edo')) {
    const [a, b] = strutEnds(p), length = dist(a, b), d = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    for (let t = 5; t < length - 2; t += 12) {
      const pos = [a[0] + d[0] * t + d[1] * 3, a[1] + d[1] * t - d[0] * 3];
      dress('cv-streetlamp', pos, 0, 'prop', p.district);
      dress('cv-bench', [pos[0] + d[0] * 4, pos[1] + d[1] * 4], p.rotY + Math.PI / 2, 'prop', p.district);
    }
  }
  // Small details follow street verges; even hanging runs reserve their
  // entire XZ extent, so their posts and supports cannot obstruct walking.
  for (const p of streets.filter(p => p.district !== 'farm' && p.district !== 'edo')) {
    const [a, b] = strutEnds(p), length = dist(a, b);
    const d = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    for (let t = 9, n = 0; t < length - 4; t += 18, n++) {
      const pos = [a[0] + d[0] * t - d[1] * 4.5, a[1] + d[1] * t + d[0] * 4.5];
      dress(n % 2 ? 'cv-string-lights' : 'cv-festival-bunting', pos, p.rotY + Math.PI / 2, 'prop', p.district);
    }
  }
  for (const h of buildings.filter(b => b.inst.district === 'residential' || b.inst.district === 'market' || b.inst.district === 'civic' || (b.inst.district === 'edo' && ['edo-machiya-townhouse', 'edo-nagaya-rowhouse', 'edo-merchant-shop', 'edo-noodle-shop'].includes(b.inst.id)))) {
    if (h.inst.district === 'edo') {
      const door = h.entry.door.pos;
      const pos = toWorldXZ([door[0], door[2]+0.15], place(h));
      dress('edo-noren-curtain', pos, h.rotY, 'prop', 'edo', 1, h);
      // Full andon fixtures beside the door avoid unsupported hanging orbs.
      for (const side of [-1,1]) {
        const lamp = toWorldXZ([side*2.1, h.entry.bounds.max[2]+0.9], place(h));
        if (dress('edo-andon-lantern-post', lamp, h.rotY, 'prop', 'edo', 1, h)) break;
      }
      if (h.inst.id === 'edo-noodle-shop' || h.inst.id === 'edo-merchant-shop') {
        // Stock flanks the opening on the street side, parallel to the facade.
        const basket = toWorldXZ([door[0]+2.9, door[2]+0.8], place(h));
        dress('edo-yaoya-baskets', basket, h.rotY, 'prop', 'edo', 1, h);
      }
    }
    const r = rectXZ(h.entry.bounds), front = r.max[1];
    // Facade-adjacent pockets flank the door approach, beyond the reserved
    // footprint. Attachments are elevated in the catalog; never sample the street.
    for (const [id, side] of (h.inst.district === 'edo'
      ? [['edo-shop-signboard', 1]]
      : h.kind === 'house'
      ? [['cv-window-box', -1], ['cv-door-wreath', 1]]
      : [['cv-aframe-chalkboard', -1], ['cv-shop-hanging-sign', 1]])) {
      for (const gap of [0.6, 0.8, 1]) {
        const pos = toWorldXZ([side * (h.inst.district === 'edo' ? 2.6 : h.kind === 'house' ? 2.3 : 3.1), front + gap], { x: h.pos[0], z: h.pos[1], rotY: h.rotY });
        if (dress(id, pos, h.rotY, 'prop', h.inst.district, 1, h)) break;
      }
    }
  }
  for (const [id, pos] of [
    ['nat-cattails', [86, -54]],
    ['nat-creek-stepping-stones', [88, -49]],
    ['cv-garden-plot', [-34, -55]], ['cv-pumpkin-patch', [-20, -55]],
    ['cv-tilled-field', [-7, -55]], ['farm-outhouse', [95, -18]],
    ['farm-farm-gate', [80, 32]], ['farm-rail-fence', [85, 32]], ['farm-drystone-wall', [91, 29]],
    ['cv-rail-fence', [-43, -78]], ['nat-lantern', [-43, -81]],
    ['farm-fireflies', [94, -34]], ['nat-meadow-fireflies', [-80, -34]],
    ['cv-chimney-smoke', [-47, -46]], ['farm-chimney-smoke', [78, -30]],
  ]) dress(id, pos, 0, 'prop', pos[0] > 58 ? 'farm' : 'residential');
  if (spec.season === 'autumn') {
    for (const [id, pos] of [['farm-stand', [73, 35]], ['harvest-pavilion', [51, 34]],
      ['pumpkin-stall', [16, 30]], ['cider-press-shed', [94, 20]]]) dress(`aut-${id}`, pos, 0, 'prop', 'farm');
  }
  function scatter(cfg, kind, mult, sample, district, list = queryCatalog(catalog, cfg.pick)) {
    if (!list.length) return;
    const n = rng.int(...scaleCount(cfg.count, mult));
    for (let i = 0; i < n; i++) for (let t = 0; t < spec.retries.placement; t++) {
      const e = rng.pick(list), pos = sample();
      if (dress(e.id, pos, rng.float(0, TAU), kind, district, kind === 'prop' ? 1 : rng.float(0.9, 1.1))) break;
    }
  }
  const forest = () => { const a = rng.float(0, TAU), r = rng.float(35, 101); return [Math.cos(a) * r, Math.sin(a) * r]; };
  // Keep tall foreground trees away from the camera-facing open green.
  const trees = () => { const p = forest(); return p[0] + p[1] > 45 ? [-p[0], -p[1]] : p; };
  const canopy = spec.season === 'autumn'
    ? ['aut-autumn-maple', 'aut-autumn-oak', 'aut-golden-birch', 'cv-tree-pine'].map(id => catalog.get(id))
    : queryCatalog(catalog, spec.trees.pick);
  scatter(spec.trees, 'tree', spec.density.trees, trees, 'woodland', canopy);
  scatter(spec.bushes, 'bush', spec.density.bushes, forest, 'woodland');
  // Stock stays immediately behind the stall row, leaving the approaches open.
  const market = () => [rng.float(18, 25), rng.float(-27, 14)];
  const homes = buildings.filter(b => b.kind === 'house' && b.inst.district === 'residential');
  const residential = () => {
    const h = rng.pick(homes), r = h.entry.lot || h.entry.footprint;
    const side = rng.sign();
    // Side yards just outside the reserved lot; all mesh/road clearance still
    // goes through dress(). Never fall back to an arbitrary field position.
    return toWorldXZ([side < 0 ? r.min[0] - rng.float(1.5, 3.5) : r.max[0] + rng.float(1.5, 3.5),
      rng.float(r.min[1], r.max[1])], { x: h.pos[0], z: h.pos[1], rotY: h.rotY });
  };
  const farmyard = () => [rng.float(64, 93), rng.float(-44, 33)];
  const stock = ['cv-crate', 'cv-barrel', 'cv-hand-cart', 'cv-wheelbarrow'].map(id => catalog.get(id));
  scatter({ count: spec.props.count.map(n => Math.round(n * 0.3)) }, 'prop', spec.density.props, market, 'market', stock);
  if (homes.length) scatter({ ...spec.props, pick: { style: 'yard-dressing' }, count: spec.props.count.map(n => Math.round(n * 0.55)) }, 'prop', spec.density.props, residential, 'residential');
  scatter({ count: [35, 45], pick: { style: 'farm-dressing' } }, 'prop', spec.density.props, farmyard, 'farm');
  for (const id of ['farm-cow', 'farm-horse', 'farm-pig', 'farm-chicken', 'farm-sheep', 'farm-duck', 'farm-goat']) {
    scatter({ count: [2, 2] }, 'prop', 1, farmyard, 'farm', [catalog.get(id)]);
  }
  scatter({ count: [5, 7], pick: { style: 'orchard', category: 'tree' } }, 'tree', 1, () => [rng.float(65, 90), rng.float(-85, -78)], 'farm');
  // Woodland-edge pockets stay away from the open green and the farm.
  const edge = () => [rng.float(-92, -76), rng.float(-52, 16)];
  for (const [id, count] of [['nat-deer', 3], ['nat-fox', 2], ['nat-rabbit', 4]]) {
    scatter({ count: [count, count] }, 'prop', 1, edge, 'woodland', [catalog.get(id)]);
  }
  for (const id of ['nat-pine-sapling-staked', 'nat-pine-sapling-staked', 'nat-birch', 'nat-pine', 'nat-willow', 'nat-birch', 'nat-pine', 'nat-willow']) {
    scatter({ count: [1, 1] }, 'tree', 1, trees, 'woodland', [catalog.get(id)]);
  }
  scatter({ count: [15, 20] }, 'prop', 1, forest, 'woodland',
    ['nat-tall-grass', 'nat-mushroom-cluster', 'nat-moss-cushion-rock', 'nat-river-stones', 'nat-lantern'].map(id => catalog.get(id)));
  if (spec.season === 'autumn') {
    const harvest = ['fallen-leaf-pile', 'gourd-squash-cluster', 'corn-shock', 'apple-crate',
      'bushel-basket', 'mums-in-pot', 'harvest-bunting', 'harvest-lantern', 'autumn-string-lights'];
    scatter({ count: [36, 44] }, 'prop', 1, residential, 'residential', harvest.map(id => catalog.get(`aut-${id}`)));
    scatter({ count: [22, 28] }, 'prop', 1, farmyard, 'farm',
      ['autumn-pumpkin-patch', 'autumn-hay-bale-round', 'loose-hay-stack', 'autumn-scarecrow', 'garden-cart', 'autumn-corn-stalk-cluster'].map(id => catalog.get(`aut-${id}`)));
  }
  // Nature is deliberately sparse: its uncompressed meshes cost far more.
  for (const id of ['nat-oak', 'nat-oak', 'nat-wildflower', 'nat-wildflower', 'nat-lichen-granite-boulder']) {
    for (let t = 0; t < spec.retries.placement; t++) if (dress(id, trees(), 0, id === 'nat-oak' ? 'tree' : 'prop', 'woodland')) break;
  }
  if (spec.district === 'edo') spawnVillagers({ instances, catalog, rng, area });
}
