// Neighborhood 1: the Edo pack only. All coordinates are world X/Z metres.
import { math as Math } from './math.js';
import { toWorldXZ } from './geometry.js';
export const EDO_CAMERA_POCKET = { min: [-87, -105], max: [-59, -74] };
export const EDO_STREETS = [
  ['edo-approach', [-50, -58], [-50, -100], 3.2],
  ['edo-lantern-lane', [-50, -100], [48, -100], 2.8],
  ['edo-garden-walk', [-78, -94], [-50, -94], 2],
  ['edo-shrine-approach', [12, -100], [12, -132], 3.2],
  ['edo-tea-court', [-29, -100], [-29, -84], 2],
  ['edo-precinct-walk', [-20, -128], [42, -128], 2.4],
  ['edo-garden-spur', [-66, -94], [-68.5, -94], 1.2],
  ['edo-garden-east', [-68.5, -94], [-68.5, -83], 1.2],
  ['edo-bridge-loop', [-68.5, -83], [-82, -83], 1.2],
  ['edo-garden-west', [-82, -83], [-82, -94], 1.2],
  ['edo-garden-return', [-82, -94], [-78, -94], 1.2],
];
export function buildEdo(street, addBuilding) {
  const roads = new Map(EDO_STREETS.map(([name, a, b, w]) => [name, street(name, a, b, 'edo', w)]));
  const lane = 'edo-lantern-lane', shrine = 'edo-shrine-approach', court = 'edo-precinct-walk';
  const buildings = [
    ['machiya-townhouse', [-39, -106.8], 0, lane, 'house'],
    ['nagaya-rowhouse', [-23, -106.3], 0, lane, 'house'],
    ['minka-farmhouse', [43, -106.5], 0, lane, 'house'],
    ['merchant-shop', [-40, -93.2], Math.PI, lane, 'landmark'],
    ['nagaya-rowhouse', [-22, -93.7], Math.PI, lane, 'house'],
    ['noodle-shop', [-11, -93.8], Math.PI, lane, 'landmark'],
    ['kura-storehouse', [32, -93.8], Math.PI, lane, 'landmark'],
    ['machiya-townhouse', [-9, -106.8], 0, lane, 'house'],
    ['nagaya-rowhouse', [28, -106.3], 0, lane, 'house'],
    ['merchant-shop', [0, -93.2], Math.PI, lane, 'landmark'],
    ['noodle-shop', [43, -93.8], Math.PI, lane, 'landmark'],
    ['machiya-townhouse', [2, -106.8], 0, lane, 'house'],
    ['kura-storehouse', [21, -93.8], Math.PI, lane, 'landmark'],
    // South-facing veranda and pond share a reserved camera-clear garden.
    ['teahouse', [-73, -100], 0, 'edo-garden-walk', 'landmark'],
    ['shinto-shrine', [0, -141], 0, court, 'landmark'],
    ['worship-hall', [12, -140], 0, shrine, 'landmark'],
    ['multi-tier-pagoda', [35, -138], 0, court, 'landmark'],
    ['chozuya-pavilion', [26, -117], -Math.PI / 2, shrine, 'landmark'],
    ['shoro-bell-tower', [-15, -138], 0, court, 'landmark'],
  ];
  for (const [id, pos, yaw, name, kind] of buildings) addBuilding(`edo-${id}`, pos, yaw, roads.get(name), kind, 'edo');
}

export function dressEdo(dress, pave) {
  const put = (id, pos, yaw = 0, kind = 'prop') => dress(`edo-${id}`, pos, yaw, kind, 'edo');
  // The large portal straddles the real walking strip, facing the shrine.
  put('great-torii', [12, -123]);
  // Small entrance portal on the narrower garden branch (2.375m opening).
  // Keep it beside the main transition, rather than narrowing the main road.
  put('torii-gate', [-56, -94], Math.PI / 2);
  for (const z of [-64, -72, -80, -88, -96]) {
    put('stone-lantern', [-53, z]); put('andon-lantern-post', [-47, z - 2]);
  }
  for (let x = -44; x <= 46; x += 9) {
    put('andon-lantern-post', [x, -103.5]); put('stone-lantern', [x + 2, -96.5]);
  }
  for (const [z, offset] of [[-113,3.5],[-125.5,3.3],[-132,3.3]]) {
    put('andon-lantern-post', [12-offset, z]); put('andon-lantern-post', [12+offset, z]);
  }
  // Five-metre pitch (slightly shorter between fixed junctions).
  for (let z = -60; z > -100; z -= 5) pave('edo-road-stone-straight', [-50,z], 0, 'edo-approach');
  pave('edo-road-stone-corner', [-50,-100], 0, 'edo-lantern-lane');
  for (const [a,b] of [[-50,-29],[-29,12],[12,48]]) {
    const steps = Math.ceil((b-a)/5);
    for (let k=1;k<steps;k++) pave('edo-road-stone-straight', [a+(b-a)*k/steps,-100], Math.PI/2, 'edo-lantern-lane');
  }
  pave('edo-road-stone-straight', [48,-100], Math.PI/2, 'edo-lantern-lane');
  pave('edo-road-stone-tjunction', [-29,-100], 0, 'edo-lantern-lane');
  pave('edo-road-stone-tjunction', [12,-100], Math.PI, 'edo-lantern-lane');
  for (let k=1;k<6;k++) pave('edo-road-stone-straight', [12,-100-28*k/6], 0, 'edo-shrine-approach');
  pave('edo-road-stone-4way', [12,-128], 0, 'edo-shrine-approach');
  pave('edo-road-stone-straight', [12,-132], 0, 'edo-shrine-approach');
  // One two-metre-wide row, with its bed height retained at native scale.
  for (let z = -95; z <= -85; z += 5) pave('edo-road-stone-straight', [-29,z], 0, 'edo-tea-court', 2);
  put('torii-gate', [-29,-85.5]);
  put('torii-gate', [50,-100], Math.PI/2);
  // Light the garden from its sides, leaving x=-73..-69 camera sightline open.
  for (const pos of [[-84.5,-90],[-66.9,-86],[-78,-79],[-63,-97],[-77.5,-97.5]]) put('andon-lantern-post', pos);
  for (const pos of [[-83.5,-98],[-66.8,-97.2],[-76.9,-84.7]]) put('stone-lantern', pos);
  // Court seating and stock sit outside the joined walking strip.
  for (const pos of [[-33,-85],[-25,-85],[-33,-89]]) put('tea-table', pos);
  for (const pos of [[-33,-82],[-25,-82]]) put('bonsai-pot', pos);
  for (const pos of [[-32,-88],[-26,-88]]) put('andon-lantern-post', pos);
  for (const x of [-45,-34,-13,-4,21,37,47]) {
    put('sake-barrels', [x,-104]);
    put('bonsai-pot', [x,-96]);
  }

  const features = [
    ['koi-pond-tile', [-73, -88]],
    ['tea-table', [-78.5, -91.2]], ['wagasa-parasol', [-78.7, -88.2]],
    ['garden-stream-tile', [-73, -83]], ['waterfall-cascade', [-73, -78.4]],
    ['wisteria-trellis', [-82, -101]], ['shishi-odoshi', [-77, -89]],
    ['tsukubai-basin', [-68.4, -97]], ['garden-moss-boulder', [-78, -104]],
    ['garden-stone', [-67, -100]], ['moss-mound', [-76, -76]],
    ['stepping-stone-rock', [-65.1, -102.4]],
    ['iris-clump', [-76.7, -86.5]], ['iris-clump', [-69.2, -81.5]],
    ['bonsai-pot', [-65.2,-100]],
    ['pebble-scatter', [-65.3, -101.8]],
    ['ema-rack', [18.8, -134]], ['komainu-pair', [12, -134.5]],
    ['shrine-brazier', [18, -136]],
    ['karesansui-center', [-4, -121]], ['raked-gravel-tile', [-12, -121]],
    ['zen-sand-rake', [-16, -121]], ['palanquin', [-21, -133]],
    ['rice-paddy-tile', [43, -120]], ['tsurube-well', [-33, -90.8]],
    ['yatai-food-stall', [-31, -103.5]], ['yatai-food-stall', [20, -105.7]],
    ['sake-barrels', [-39, -106]],
    ['handcart', [-31, -109]], ['merchant-ox-cart', [35, -106]],
    ['nobori-banner', [-5, -96]], ['andon-lantern-post', [5, -96]],
    ['taiko-drum', [2, -135]], ['bonsai-pot', [-29, -94]],
    ['festival-garland', [23, -94]],
  ];
  for (const [id, pos] of features) put(id, pos, ['tea-table','wagasa-parasol'].includes(id) ? Math.PI/2 : 0);
  put('arched-bridge', [-73, -83], Math.PI / 2);
  for (const pos of [[-54,-68],[-46,-77],[-36.5,-83],[-21.5,-83]]) dress('cv-crate', pos, 0, 'prop', 'edo');
  for (const pos of [[-46,-84],[-34,-82]]) dress('aut-bushel-basket', pos, 0, 'prop', 'edo');
  for (const pos of [[-35,-80],[-23,-80]]) dress('aut-mums-in-pot', pos, 0, 'prop', 'edo');
  for (const [id, pos] of [
    ['sakura-tree', [-59, -116]], ['sakura-tree', [-39, -122]],
    ['pine-tree', [-25, -142]], ['pine-tree', [47, -132]],
    ['maple-tree', [53, -115]], ['shidare-willow', [-87, -112]],
    ['sakura-sapling', [-57, -85]], ['sakura-sapling', [-57, -96]],
    ['bamboo-clump', [-26, -127]], ['bamboo-stalk', [-28, -130]],
  ]) put(id, pos, 0, 'tree');
  put('hydrangea-bush', [-85, -116], 0, 'bush');
  // Edge fences are props: they are not the compiler's gated house-lot runs.
  // South street wall and two short lot screens retain open roji alleys.
  for (const x of [-44,-36]) put('takegaki-fence', [x,-87]);
  for (const x of [-7,9]) put('takegaki-fence', [x,-91]);
  for (const x of [-39,-32,-24,-16,-8,1,10,20,30,40,49]) put('pine-tree', [x,-80], 0, 'tree');
  for (const x of [-42, -36, -30, -24]) put('takegaki-fence', [x, -120]);
  for (const x of [-18, -12, -6, 0, 6, 12, 18, 24, 30]) put('ishigaki-wall', [x, -145]);
}

// Only the inspected stream crossing is a layered composition. Channel runs
// local Z, water is within x=±0.75 source (±0.9375 world), deck spans local Z.
// Abutments must lie beyond both banks. No other solid overlap is permitted.
export function edoWaterCrossing(a, b) {
  const bridge = a.id === 'edo-arched-bridge' ? a : b.id === 'edo-arched-bridge' ? b : null;
  const water = a.id === 'edo-garden-stream-tile' ? a : b.id === 'edo-garden-stream-tile' ? b : null;
  if (!bridge || !water || bridge.district !== 'edo' || water.district !== 'edo') return false;
  const dx = bridge.pos[0] - water.pos[0], dz = bridge.pos[1] - water.pos[1];
  const c = Math.cos(water.rotY), s = Math.sin(water.rotY);
  return Math.abs(dx*c-dz*s) <= 0.35 && Math.abs(dx*s+dz*c) <= 1.2
    && Math.abs(Math.sin(bridge.rotY-water.rotY)) > 0.99
    && (bridge.scale || 1) === 1 && (water.scale || 1) === 1;
}
export const EDO_FRONTAGE_MAX = 3; // door threshold to lane walk edge, metres

// Noren are elevated attachments to an authored door, not loose street props.
export function edoNorenAtDoor(noren, host, entry) {
  if (noren.id !== 'edo-noren-curtain' || host.district !== 'edo' || !entry?.door
      || noren.facadeLot !== host.lot || Math.abs(Math.cos(noren.rotY-host.rotY)) < 0.999) return false;
  const door = toWorldXZ([entry.door.pos[0]*(host.scale || 1), entry.door.pos[2]*(host.scale || 1)],
    { x:host.pos[0], z:host.pos[1], rotY:host.rotY });
  return Math.hypot(noren.pos[0]-door[0],noren.pos[1]-door[1]) <= 0.3;
}

// The route crosses only the inspected bridge deck and its low stream bed.
export function edoGardenRouteSupports(i, p) {
  return p.streetId === 'edo-bridge-loop' && i.district === 'edo'
    && ['edo-garden-stream-tile','edo-arched-bridge'].includes(i.id);
}

// Measured elevated rope at the hall entrance, anchored like a noren.
export function edoRopeAtHall(rope, host, entry) {
  if (rope.id !== 'edo-shimenawa-rope' || host.id !== 'edo-worship-hall'
      || host.district !== 'edo' || rope.facadeLot !== host.lot || !entry?.door
      || Math.abs(rope.rotY-host.rotY) > 0.001) return false;
  const anchor = toWorldXZ([0,entry.door.pos[2]+0.25], {x:host.pos[0],z:host.pos[1],rotY:host.rotY});
  return Math.hypot(rope.pos[0]-anchor[0],rope.pos[1]-anchor[1]) < 0.05;
}
