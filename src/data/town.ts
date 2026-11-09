// Town definition. The village is a list of DISTRICTS so it can grow: add a district (with its own
// lots, resources and places) and the world, nav grid and sim pick it up without code changes.
// Coordinates: metres, x = east, z = south (toward the default camera). Doors face +z unless rotated.

export type AssetKey = string; // 'pack/name'
export const ASSET_SCALE: Record<string, number> = { cozy: 1.6, farm: 1.0, nature: 1.0 };
// Per-asset overrides (props that should not get the full building scale).
export const SCALE_OVERRIDE: Record<string, number> = {
  'cozy/road_cobble_straight_01': 1, 'cozy/road_cobble_crossing_01': 1, 'cozy/road_cobble_tee_01': 1, 'cozy/road_cobble_corner_01': 1,
  'cozy/road_dirt_road_01': 1, 'cozy/terrain_village_green_01': 1, 'cozy/terrain_dirt_path_01': 1, 'cozy/water_pond_01': 1.4,
  'cozy/bench_01': 1.05, 'cozy/barrel_01': 1.05, 'cozy/crate_01': 1.1, 'cozy/streetlamp_01': 1.45, 'cozy/flower_bed_01': 1.1,
  'cozy/tree_oak_01': 1.35, 'cozy/tree_pine_01': 1.5, 'cozy/tree_fruit_01': 1.35, 'cozy/rock_boulder_01': 1.2, 'cozy/rock_stone_pile_01': 1.15,
  'cozy/market_stall_01': 1.55, 'cozy/well_01': 1.3, 'cozy/notice_board_01': 1.15, 'cozy/string_lights_01': 1.3, 'cozy/hay_bale_01': 1.1,
  'cozy/picket_fence_01': 1.1, 'cozy/rail_fence_01': 1.1, 'cozy/firewood_stack_01': 1.1, 'cozy/festival_bunting_01': 1.4, 'cozy/bush_round_01': 1.1,
  'cozy/veh_hand_cart_01': 1.2, 'cozy/water_trough_01': 1.1, 'cozy/directional_post_01': 1.3, 'cozy/village_entrance_sign_01': 1.3,
  'cozy/laundry_line_01': 1.2, 'cozy/pumpkin_patch_01': 1.1, 'cozy/flower_cart_01': 1.2, 'cozy/aframe_chalkboard_01': 1.0, 'cozy/plant_potted_01': 1.2,
};
export const scaleOf = (a: AssetKey) => SCALE_OVERRIDE[a] ?? ASSET_SCALE[a.split('/')[0]] ?? 1;

export type PlaceKind = 'home' | 'bakery' | 'store' | 'tavern' | 'smithy' | 'market' | 'well' | 'field' | 'coop' | 'orchard'
  | 'forest' | 'quarry' | 'campfire' | 'plaza' | 'pond' | 'barn' | 'chapel' | 'windmill' | 'bench' | 'pasture';
export interface PlaceDef { id: string; kind: PlaceKind; name: string; enterable?: boolean; chimney?: [number, number, number]; }
export interface LotDef { a: AssetKey; x: number; z: number; rot?: number; s?: number; place?: PlaceDef; solid?: boolean; tag?: string; }
export interface ResourceDef { kind: 'tree' | 'rock' | 'plot' | 'apple'; a: AssetKey; x: number; z: number; rot?: number; s?: number; hero?: boolean; }
export interface DistrictDef { id: string; name: string; lots: LotDef[]; resources: ResourceDef[]; spots?: { id: string; kind: PlaceKind; name: string; x: number; z: number }[]; }

const H = Math.PI;
export const TOWN = {
  name: 'Thistlebrook',
  bounds: { minX: -50, maxX: 50, minZ: -34, maxZ: 28 },
  districts: [
    {
      id: 'old-town', name: 'Old Town',
      lots: [
        // Back lane homes (row A)
        { a: 'cozy/home_cottage_01', x: -28, z: -21, place: { id: 'home-mara', kind: 'home', name: 'Thistle Cottage', enterable: true, chimney: [0.9, 4.9, -0.6] } },
        { a: 'cozy/home_thatched_house_01', x: -19.5, z: -21, place: { id: 'home-quill', kind: 'home', name: 'Quill House', enterable: true, chimney: [1.6, 5.6, -0.3] } },
        { a: 'cozy/home_timber_2storey_01', x: -11, z: -21, place: { id: 'home-jen', kind: 'home', name: 'Marlow Hall', enterable: true, chimney: [1.4, 7.6, -0.6] } },
        { a: 'cozy/home_townhouse_01', x: -3.5, z: -21, place: { id: 'home-tom', kind: 'home', name: 'Ashby Townhouse', enterable: true, chimney: [0.6, 6.1, -0.8] } },
        { a: 'cozy/bld_chapel_01', x: 4, z: -22, place: { id: 'chapel', kind: 'chapel', name: 'the chapel' } },
        { a: 'farm/farmhand_cottage', x: 13, z: -21, place: { id: 'home-spare', kind: 'home', name: 'Willow Cottage', enterable: true } },
        // Main street (row B)
        { a: 'cozy/bld_bakery_01', x: -27, z: -10, place: { id: 'bakery', kind: 'bakery', name: 'the bakery', enterable: true, chimney: [1.3, 5.6, -0.9] } },
        { a: 'cozy/bld_general_store_01', x: -19, z: -10, place: { id: 'store', kind: 'store', name: 'the general store', enterable: true } },
        { a: 'cozy/bld_tavern_inn_01', x: -9.5, z: -10.5, place: { id: 'tavern', kind: 'tavern', name: 'the Tipsy Thistle', enterable: true, chimney: [-1.6, 8.6, -0.6] } },
        { a: 'cozy/bld_blacksmith_01', x: 0.5, z: -10, place: { id: 'smithy', kind: 'smithy', name: 'the smithy', enterable: true, chimney: [-1.2, 6.6, -0.9] } },
        { a: 'cozy/home_cottage_01', x: 8.5, z: -10, rot: 0, place: { id: 'home-edgar', kind: 'home', name: 'Vale Cottage', enterable: true, chimney: [0.9, 4.9, -0.6] } },
        // Plaza
        { a: 'cozy/well_01', x: -9, z: 6, place: { id: 'well', kind: 'well', name: 'the well' } },
        { a: 'cozy/market_stall_01', x: -15, z: 2.5, place: { id: 'market', kind: 'market', name: 'the market' } },
        { a: 'cozy/market_stall_01', x: -3, z: 2.5, tag: 'stall2' },
        { a: 'cozy/notice_board_01', x: 1.5, z: 1.8 },
        { a: 'cozy/bench_01', x: -15, z: 10, rot: 0, tag: 'bench', solid: false },
        { a: 'cozy/bench_01', x: -3, z: 10, rot: 0, tag: 'bench', solid: false },
        { a: 'cozy/flower_bed_01', x: -9, z: 11 }, { a: 'cozy/flower_cart_01', x: 4, z: 6, rot: -0.5 },
        { a: 'cozy/streetlamp_01', x: -18, z: 0.4, tag: 'lamp' }, { a: 'cozy/streetlamp_01', x: 0, z: 0.4, tag: 'lamp' }, { a: 'cozy/streetlamp_01', x: -9, z: 12.5, tag: 'lamp' },
        { a: 'cozy/streetlamp_01', x: -33, z: -5.6, tag: 'lamp' }, { a: 'cozy/streetlamp_01', x: 13, z: -5.6, tag: 'lamp' },
        { a: 'cozy/string_lights_01', x: -9.5, z: -5.2, tag: 'stringlights', solid: false },
        { a: 'cozy/barrel_01', x: -14.2, z: -6.4 }, { a: 'cozy/barrel_01', x: -13.4, z: -6.9 }, { a: 'cozy/crate_01', x: -22.4, z: -6.6 },
        { a: 'cozy/firewood_stack_01', x: -3.4, z: -7.2, rot: H / 2 }, { a: 'cozy/hay_bale_01', x: 4.3, z: -6.8 },
        { a: 'cozy/aframe_chalkboard_01', x: -24.5, z: -6.4, rot: 0.3 }, { a: 'cozy/plant_potted_01', x: -16.3, z: -6.8 },
        { a: 'cozy/village_entrance_sign_01', x: -40, z: -1.2, rot: H / 2 }, { a: 'cozy/directional_post_01', x: 16, z: -1.2 },
        { a: 'cozy/laundry_line_01', x: -24, z: -16.3 }, { a: 'cozy/picket_fence_01', x: -31.5, z: -17.3 }, { a: 'cozy/picket_fence_01', x: -15, z: -17.3 },
        { a: 'cozy/veh_hand_cart_01', x: -12, z: 1.5, rot: 0.7 },
        // Campfire green (night gatherings)
        { a: 'nature/stone_ring_campfire', x: -25, z: 10, place: { id: 'campfire', kind: 'campfire', name: 'the campfire' } },
        { a: 'nature/log_bench', x: -25, z: 7.6, tag: 'logbench', solid: false }, { a: 'nature/log_bench', x: -27.4, z: 10.6, rot: H / 2, tag: 'logbench', solid: false },
        { a: 'nature/log_bench', x: -22.6, z: 10.6, rot: -H / 2, tag: 'logbench', solid: false }, { a: 'nature/log_bench', x: -25, z: 12.6, rot: H, tag: 'logbench', solid: false },
        { a: 'cozy/water_pond_01', x: -36, z: 13, place: { id: 'pond', kind: 'pond', name: 'the pond' } },
      ],
      resources: [
        // West woods (wood) — mix of cheap cozy trees and two hero pines
        { kind: 'tree', a: 'nature/pine', x: -42, z: -14, hero: true }, { kind: 'tree', a: 'nature/pine', x: -45, z: 2, hero: true },
        { kind: 'tree', a: 'cozy/tree_pine_01', x: -38, z: -20 }, { kind: 'tree', a: 'cozy/tree_oak_01', x: -40, z: -7 },
        { kind: 'tree', a: 'cozy/tree_pine_01', x: -44, z: -8 }, { kind: 'tree', a: 'cozy/tree_oak_01', x: -38, z: 4 },
        { kind: 'tree', a: 'cozy/tree_pine_01', x: -41, z: 9 }, { kind: 'tree', a: 'cozy/tree_pine_01', x: -36, z: -12 },
        { kind: 'tree', a: 'nature/maple_autumn', x: -31, z: 19 }, { kind: 'tree', a: 'cozy/tree_oak_01', x: -18, z: 20 },
        // Orchard (food)
        { kind: 'apple', a: 'farm/apple_tree', x: 2, z: 15 }, { kind: 'apple', a: 'farm/apple_tree', x: 8, z: 18 }, { kind: 'apple', a: 'cozy/tree_fruit_01', x: -3, z: 19 },
      ],
      spots: [
        { id: 'plaza', kind: 'plaza', name: 'the plaza', x: -9, z: 3.5 },
        { id: 'forest', kind: 'forest', name: 'the west woods', x: -36, z: -4 },
        { id: 'orchard', kind: 'orchard', name: 'the orchard', x: 3, z: 17 },
      ],
    },
    {
      id: 'farmstead', name: 'Fenn Farmstead',
      lots: [
        { a: 'farm/farmhouse', x: 24, z: -11, place: { id: 'home-fenn', kind: 'home', name: 'Fenn Farmhouse', enterable: true, chimney: [2.2, 6.9, -1.6] } },
        { a: 'farm/big_red_barn', x: 36, z: -10, place: { id: 'barn', kind: 'barn', name: 'the big red barn', enterable: true } },
        { a: 'farm/chicken_coop', x: 39, z: 6, place: { id: 'coop', kind: 'coop', name: 'the chicken coop' } },
        { a: 'cozy/bld_windmill_01', x: 26, z: -24, place: { id: 'windmill', kind: 'windmill', name: 'the windmill' } },
        { a: 'farm/scarecrow', x: 23, z: 13.5 }, { a: 'farm/hay_bale_round', x: 31, z: -4.5 }, { a: 'farm/hay_bale_square', x: 33, z: -4.2 },
        { a: 'farm/grain_sacks', x: 28.5, z: -5.2 }, { a: 'farm/milk_churns', x: 40, z: -4.6 }, { a: 'farm/water_trough', x: 44, z: 10 },
        { a: 'farm/feed_trough', x: 35, z: 9 }, { a: 'farm/produce_stand', x: 14, z: 2.5, place: { id: 'farmstand', kind: 'market', name: 'the farm stand' } },
        { a: 'farm/rail_fence', x: 33, z: 3 }, { a: 'farm/rail_fence', x: 37, z: 3 }, { a: 'farm/rail_fence', x: 41.5, z: 3 },
        { a: 'farm/rail_fence', x: 31, z: 5, rot: H / 2 }, { a: 'farm/rail_fence', x: 31, z: 13, rot: H / 2 },
        { a: 'farm/rail_fence', x: 46, z: 7, rot: H / 2 }, { a: 'farm/rail_fence', x: 46, z: 11, rot: H / 2 },
        { a: 'farm/rail_fence', x: 33, z: 15 }, { a: 'farm/rail_fence', x: 37, z: 15 }, { a: 'farm/rail_fence', x: 41, z: 15 }, { a: 'farm/rail_fence', x: 44.5, z: 15 },
        { a: 'farm/weathervane', x: 20.5, z: -6 },
      ],
      resources: [
        ...[14, 18, 22, 26].flatMap(x => [7, 11].map(z => ({ kind: 'plot' as const, a: 'farm/ploughed_field', x, z }))),
        { kind: 'tree', a: 'cozy/tree_oak_01', x: 47, z: -16 }, { kind: 'tree', a: 'cozy/tree_pine_01', x: 46, z: 20 },
      ],
      spots: [{ id: 'fields', kind: 'field', name: 'the fields', x: 20, z: 9 }, { id: 'pasture', kind: 'pasture', name: 'the pasture', x: 38, z: 9 }],
    },
    {
      id: 'quarry', name: 'Stonegap Quarry',
      lots: [{ a: 'cozy/veh_wheelbarrow_01', x: 36, z: -19.5, rot: 0.6 }],
      resources: [
        { kind: 'rock', a: 'nature/granite_rock_cluster', x: 40, z: -26, s: 1.6, hero: true }, { kind: 'rock', a: 'nature/lichen_granite_boulder', x: 45, z: -21, s: 1.2, hero: true },
        { kind: 'rock', a: 'cozy/rock_boulder_01', x: 35, z: -27 }, { kind: 'rock', a: 'cozy/rock_boulder_01', x: 44, z: -29, rot: 1.2 },
        { kind: 'rock', a: 'cozy/rock_stone_pile_01', x: 38, z: -22 }, { kind: 'rock', a: 'cozy/rock_stone_pile_01', x: 47, z: -26 },
        { kind: 'rock', a: 'farm/field_boulder', x: 32, z: -29, s: 1.6 },
      ],
      spots: [{ id: 'quarry', kind: 'quarry', name: 'the quarry', x: 39, z: -21 }],
    },
  ] as DistrictDef[],
  roads: [
    // [asset, x0, z, x1, axis] — straight tile runs on the 4 m grid
    { a: 'cozy/road_cobble_straight_01', from: -42, to: 18, z: -3, axis: 'x' },
    { a: 'cozy/road_dirt_road_01', from: -32, to: 16, z: -15.5, axis: 'x' },
    { a: 'farm/track_straight', from: 22, to: 42, z: -3, axis: 'x' },
  ],
};
