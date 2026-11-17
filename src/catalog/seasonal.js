// Optional packs never enter legacy hamlet selection pools. Source metres;
// Edo doors use 1.25, the already eleven-metre pagoda retains native scale.
const mesh = (pack, file, category = 'prop', styles = []) => ({
  id: `${pack === 'edo-village' ? 'edo' : 'aut'}-${file.replaceAll('_', '-')}`,
  name: file.replaceAll('_', ' '), tags: { category, style: [pack, ...styles, file.replaceAll('_', '-')] },
  source: 'mesh', path: `licensed/${pack}/${file}.glb`, license: 'tja-commercial',
  scale: pack === 'edo-village' ? (file === 'multi_tier_pagoda' ? 1 : 1.25) : 1.1,
  groundY: 100, eaveY: null, door: null,
});
const many = (pack, files, category, styles) => files.split(' ').map(f => mesh(pack, f, category, styles));
// Thresholds inspected with tools/inspect-door.mjs, +Z fronts. The snap is
// beyond the front canopy so the approach cannot start underneath the roof.
const edoBuildings = [
  ['machiya_townhouse', 'house', 2.392], ['nagaya_rowhouse', 'house', 1.943],
  ['minka_farmhouse', 'house', 2.057], ['teahouse', 'landmark', 2.255],
  ['merchant_shop', 'landmark', 2.318], ['noodle_shop', 'landmark', 1.734],
  ['kura_storehouse', 'landmark', 1.763], ['shinto_shrine', 'landmark', 2.572],
  ['worship_hall', 'landmark', 2.01], ['multi_tier_pagoda', 'landmark', 2.07],
  ['chozuya_pavilion', 'landmark', 1.216], ['shoro_bell_tower', 'landmark', 2.086],
];
export const SEASONAL = [
  ...edoBuildings.map(([file, category, front]) => ({
    ...mesh('edo-village', file, category, [category === 'house' ? 'dwelling' : 'civic']),
    groundY: 0.4, eaveY: 2.2, lotMargin: 0.8,
    door: { pos: [0, 0.2, front], facing: [0, 0, 1] },
    pathSnaps: [{ pos: [0, 0, front + 0.5], dir: [0, 0, 1] }],
  })),
  ...many('edo-village', 'great_torii torii_gate yatai_food_stall yaoya_baskets sake_barrels handcart merchant_ox_cart shop_signboard noren_curtain paper_lantern andon_lantern_post stone_lantern festival_garland nobori_banner wagasa_parasol tea_table taiko_drum bonsai_pot koi_pond_tile arched_bridge tsurube_well', 'prop', ['district-dressing']),
  ...many('edo-village', 'sakura_tree sakura_sapling pine_tree maple_tree bamboo_clump bamboo_stalk shidare_willow', 'tree', ['garden']),
  ...many('edo-village', 'hydrangea_bush iris_clump wisteria_trellis', 'bush', ['garden']),
  { ...mesh('edo-village', 'road_stone_straight', 'path', ['tile']),
    pathSnaps: [{ pos: [0, 0, -2], dir: [0, 0, -1] }, { pos: [0, 0, 2], dir: [0, 0, 1] }] },
  { ...mesh('edo-village', 'takegaki_fence', 'fence', ['fence']),
    fenceSnaps: [{ pos: [-2, 0, 0], dir: [-1, 0, 0] }, { pos: [2, 0, 0], dir: [1, 0, 0] }] },
  ...many('edo-village', 'ema_rack ishigaki_wall komainu_pair karesansui_center raked_gravel_tile zen_sand_rake shishi_odoshi shrine_brazier shimenawa_rope tsukubai_basin garden_moss_boulder garden_stone moss_mound stepping_stone_rock stepping_stone_tile garden_stream_tile waterfall_cascade rice_paddy_tile road_stone_corner road_stone_tjunction road_stone_4way palanquin pebble_scatter', 'prop', ['district-dressing']),
  ...many('autumn', 'autumn_maple autumn_oak golden_birch', 'tree', ['canopy']),
  ...many('autumn', 'bare_hedgerow', 'bush', ['hedge']),
  ...many('autumn', 'fallen_leaf_pile leaf_strewn_grass leaf_footpath dry_meadow_tile ornamental_grass spent_sunflowers mossy_rock autumn_pumpkin_patch gourd_squash_cluster corn_shock autumn_corn_stalk_cluster autumn_hay_bale_round autumn_hay_bale_square loose_hay_stack apple_crate bushel_basket cornucopia mums_in_pot harvest_bunting harvest_lantern autumn_string_lights fire_pit garden_cart autumn_wheelbarrow autumn_scarecrow farm_stand_sign orchard_signpost', 'prop', ['harvest']),
  ...many('autumn', 'farm_stand harvest_pavilion cider_press_shed pumpkin_stall autumn_hay_barn autumn_garden_shed autumn_root_cellar', 'prop', ['farm-structure']),
  { ...mesh('autumn', 'farm_cottage', 'house', ['dwelling']), groundY: 0.4, eaveY: 2.8, lotMargin: 1,
    door: { pos: [0, 0.2, 3.662], facing: [0, 0, 1] },
    pathSnaps: [{ pos: [0, 0, 4.162], dir: [0, 0, 1] }] },
];

for (const e of SEASONAL) {
  // Inspected post inner edges, conservatively inset from the real opening.
  // Only these measured portals admit a walking corridor under their lintel.
  if (e.id === 'edo-great-torii') e.walkOpening = 3.3; // source full width; world 4.125m
  if (e.id === 'edo-torii-gate') e.walkOpening = 1.9;
  if (e.id.startsWith('edo-road-stone-')) { e.tags.style.push('street-paving'); e.yOffset = e.id === 'edo-road-stone-corner' ? -0.18 : -0.13; }
  // Source bed top is 0.18m; world rim becomes (0.18-0.164)*1.25 = 0.02m.
  if (['edo-koi-pond-tile','edo-garden-stream-tile','edo-raked-gravel-tile','edo-rice-paddy-tile'].includes(e.id)) e.yOffset = -0.164;
  // Inspected pair: inner dog edges ±0.875m world; keep a 1.7m passage.
  if (e.id === 'edo-komainu-pair') e.walkOpening = 1.36;
  if (e.id === 'edo-shimenawa-rope') e.yOffset = 1.35;
  if (e.id === 'edo-noren-curtain') e.yOffset = 0.9;
  for (const tag of ['lantern', 'bunting', 'lights', 'sign', 'stall', 'pond', 'bridge', 'fence']) {
    if (e.id.includes(tag)) e.tags.style.push(tag === 'lantern' ? 'lamp' : tag);
  }
  if (e.id === 'edo-tsurube-well') {
    e.tags.category = 'well';
    e.pathSnaps = [{ pos: [0, 0, 1.5], dir: [0, 0, 1] }];
  }
}
