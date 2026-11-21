// Source metres. Farm and Nature retain their native door / vegetation scale.
const mesh = (pack, file, category, styles = []) => ({
  id: `${pack === 'cozy-village' ? 'cv' : pack === 'nature' ? 'nat' : 'farm'}-${file.replace(/_01$/, '').replaceAll('_', '-').replace(/^bld-/, '').replace(/^veh-/, '').replace(/^terrain-/, '')}`,
  name: file.replaceAll('_', ' '), tags: { category, style: [pack, ...styles] },
  source: 'mesh', path: `licensed/${pack}/${file}.glb`, license: 'tja-commercial',
  scale: pack === 'cozy-village' ? 1.6 : 1, groundY: 100, eaveY: null, door: null,
});
function building(pack, file, category, wall, step, eave) {
  const e = mesh(pack, file, category, [category === 'house' ? 'dwelling' : 'civic']);
  return { ...e, groundY: 0.4, eaveY: eave, lotMargin: 1,
    door: { pos: [0, 0.3, wall], facing: [0, 0, 1] },
    pathSnaps: [{ pos: [0, 0, step + 0.3], dir: [0, 0, 1] }] };
}
const cv = (files, category, styles) => files.split(' ').map(f => mesh('cozy-village', `${f}_01`, category, styles));
const farm = (files, category, styles) => files.split(' ').map(f => mesh('farm', f, category, styles));
export const ADDITIONS = [
  building('cozy-village', 'bld_blacksmith_01', 'landmark', 1.798, 1.798, 2.1),
  // Both awnings are public: choose +Z, with the snap beyond its canopy edge.
  building('cozy-village', 'bld_market_hall_01', 'landmark', 0.884, 1.74, 2.1),
  building('cozy-village', 'bld_windmill_01', 'landmark', 1.4, 1.75, 2.4),
  building('farm', 'farmhouse', 'house', 3.13, 4.4, 3.7),
  building('farm', 'farmhand_cottage', 'house', 2.29, 2.55, 2.8),
  building('farm', 'produce_stand', 'landmark', 0.635, 0.635, 1.8),
  { ...mesh('cozy-village', 'market_stall_01', 'prop', ['stall', 'market']),
    yawOffset: 3.141592653589793,
    door: { pos: [0, 0, -0.418], facing: [0, 0, -1] },
    pathSnaps: [{ pos: [0, 0, -0.72], dir: [0, 0, -1] }] },
  ...cv('flower_cart veh_hand_cart veh_horse_cart veh_wheelbarrow veh_bicycle', 'prop', ['cart', 'market']),
  ...cv('bench crate campfire firewood_stack directional_post notice_board laundry_line birdhouse plant_potted window_box hay_bale water_pump water_trough village_entrance_sign flower_bed pumpkin_patch shop_hanging_sign', 'prop', ['dressing']),
  ...cv('streetlamp', 'prop', ['lamp']),
  ...cv('tree_fruit tree_pine', 'tree', ['canopy']),
  ...cv('hedge_straight', 'bush', ['hedge']),
  ...cv('rail_fence', 'fence', ['rail']),
  ...cv('road_cobble_corner road_cobble_crossing road_cobble_tee road_dirt_road road_stone_footbridge', 'path', ['road']),
  ...cv('terrain_garden_plot terrain_tilled_field', 'prop', ['crop']),
  ...cv('water_pond water_stream', 'prop', ['water']),
  ...cv('rock_boulder rock_stepping_stones rock_stone_pile', 'prop', ['rock']),
  // These are agricultural structures, never door-reachable dwellings.
  ...farm('hay_barn chicken_coop stable greenhouse outhouse windmill_pump root_cellar grain_silo big_red_barn', 'prop', ['farm-structure']),
  ...farm('wheelbarrow rain_barrel milk_churns produce_crates grain_sacks scarecrow water_trough feed_trough hay_bale_round hay_bale_square haystack weathervane', 'prop', ['farm-dressing']),
  ...farm('farm_gate', 'gate', ['rail']),
  ...farm('apple_tree', 'tree', ['orchard']),
  ...farm('crop_row_field sunflower_row pumpkin_patch orchard_row wheat_cluster corn_stalk_cluster', 'prop', ['crop']),
  ...farm('rail_fence drystone_wall', 'fence', ['rail']),
  ...farm('chicken sheep duck goat cow horse pig', 'prop', ['animal', 'livestock']),
  ...farm('farm_pond fireflies chimney_smoke', 'prop', ['feature']),
  ...cv('festival_bunting string_lights aframe_chalkboard door_wreath chimney_smoke', 'prop', ['street-dressing']),
  ...'deer fox rabbit'.split(' ').map(f => mesh('nature', f, 'prop', ['animal', 'wildlife'])),
  ...'birch pine willow'.split(' ').map(f => mesh('nature', f, 'tree', ['feature-tree'])),
  ...'split_firewood_pile meadow_fireflies'.split(' ').map(f => mesh('nature', f, 'prop', ['dressing'])),
  ...'oak pine_sapling_staked'.split(' ').map(f => mesh('nature', f, 'tree', ['sparse'])),
  // OPUS-NATURE (docs/specs/NATURE-PACK-REVIEW.md): outdoor-edge dressing. The
  // 'nature-edge' style keeps them out of every existing scatter pool.
  ...'silver_snag axe_chopping_stump fern lily_pad_patch shore_rock_shelf'.split(' ').map(f => mesh('nature', f, 'prop', ['nature-edge', f.includes('rock') ? 'rock' : 'dressing'])),
  ...'grey_heron mallard_duck'.split(' ').map(f => mesh('nature', f, 'prop', ['nature-edge', 'wildlife'])),
  ...'trail_marker_post park_info_board'.split(' ').map(f => mesh('nature', f, 'prop', ['nature-edge', 'trail'])),
  ...'wildflower tall_grass cattails granite_rock_cluster lichen_granite_boulder moss_cushion_rock fallen_log_mossy log_bench lantern mushroom_cluster river_stones creek_stepping_stones'.split(' ').map(f => mesh('nature', f, 'prop', ['sparse', f.includes('rock') || f.includes('stone') || f.includes('boulder') ? 'rock' : 'dressing'])),
];

const fenceLengths = { 'cv-rail-fence': [-1.269, 1.283], 'farm-rail-fence': [-2.015, 2.015], 'farm-drystone-wall': [-2, 2], 'farm-farm-gate': [-1.31, 1.31] };
// Ground-safe yard details only. Furniture, civic signs and wall attachments
// need intentional placement; agricultural props belong in the farm district.
const yardDressing = new Set(['cv-firewood-stack', 'cv-plant-potted', 'cv-flower-bed', 'cv-rock-boulder', 'cv-rock-stone-pile']);
for (const entry of ADDITIONS) {
  if (['cv-window-box', 'cv-laundry-line', 'cv-shop-hanging-sign', 'cv-bicycle', 'cv-birdhouse', 'cv-campfire', 'cv-hay-bale', 'cv-water-pump', 'cv-water-trough', 'nat-split-firewood-pile', 'cv-bench', 'cv-crate', 'cv-hand-cart', 'cv-horse-cart', 'cv-wheelbarrow', ...yardDressing].includes(entry.id)) entry.tags.style.push('street-dressing');
  if (['cv-laundry-line', 'cv-bicycle', 'cv-birdhouse', 'cv-campfire', 'cv-hay-bale', 'cv-water-pump', 'cv-water-trough', 'nat-split-firewood-pile', ...yardDressing].includes(entry.id)) entry.tags.style.push('yard-dressing');
  if (['nat-cattails', 'nat-fern', 'nat-tall-grass'].includes(entry.id)) entry.outline = 0.012;
  if (entry.id === 'cv-window-box') entry.yOffset = 0.8;
  if (entry.id === 'cv-door-wreath') entry.yOffset = 1;
  if (entry.id === 'cv-shop-hanging-sign') entry.yOffset = 1.2;
  if (entry.id.includes('smoke')) { entry.yOffset = entry.scale === 1.6 ? 4 : 6; entry.tags.style.push('smoke'); }
  if (entry.id.includes('bunting')) entry.tags.style.push('bunting');
  if (entry.id.includes('lights')) entry.tags.style.push('lights', 'lamp');
  if (entry.id === 'cv-aframe-chalkboard') entry.tags.style.push('sign');
  if (entry.id.includes('wreath')) entry.tags.style.push('wreath');
  // Functional tags support authoring queries without widening legacy pools.
  if (yardDressing.has(entry.id)) entry.tags.style.push('town-dressing');
  const functionTag = entry.id.replace(/^(cv|farm|nat)-/, '').replace(/^farm-/, '');
  entry.tags.style.push(functionTag);
  if (functionTag.includes('sign') || functionTag.includes('post') || functionTag.includes('notice')) entry.tags.style.push('sign');
  if (functionTag.includes('flower')) entry.tags.style.push('flower');
  if (functionTag.includes('lantern')) entry.tags.style.push('lamp');
  if (functionTag.includes('bench')) entry.tags.style.push('bench');
  if (functionTag.includes('barrow')) entry.tags.style.push('cart');
  const ends = fenceLengths[entry.id];
  if (ends) entry.fenceSnaps = ends.map((x, i) => ({ pos: [x, 0, 0], dir: [i ? 1 : -1, 0, 0] }));
  if (entry.tags.category === 'path') {
    entry.tags.style.push(entry.id.includes('bridge') ? 'bridge' : 'tile');
    entry.pathSnaps = [{ pos: [0, 0, -2], dir: [0, 0, -1] }, { pos: [0, 0, 2], dir: [0, 0, 1] }];
    if (entry.id.includes('corner')) entry.pathSnaps[0] = { pos: [-2, 0, 0], dir: [-1, 0, 0] };
    if (entry.id.includes('crossing') || entry.id.includes('tee')) entry.pathSnaps.push({ pos: [-2, 0, 0], dir: [-1, 0, 0] });
    if (entry.id.includes('crossing')) entry.pathSnaps.push({ pos: [2, 0, 0], dir: [1, 0, 0] });
    if (entry.id.includes('footbridge')) entry.pathSnaps = [{ pos: [-1.7, 0, 0], dir: [-1, 0, 0] }, { pos: [1.7, 0, 0], dir: [1, 0, 0] }];
  }
}
