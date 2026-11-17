# Large town compiler (Codex / GPT-6.1-Sol)

Work only in /workspace/cel-town unless you need to read pack READMEs under /workspace/threejs-assets (already copied). Do not buy anything, do not git push, do not deploy, do not commit or copy licensed GLBs outside public/licensed/ (already gitignored). Do not modify /workspace/limezu. No API keys.

## Goal
Build a much larger town with the existing seeded cel-town compiler, using many more of the already-downloaded ThreeJS Assets (lifetime licence). Keep the current default hamlet unchanged in look and in compiled JSON for a given seed. Add a size/density preset (`?size=large`, and a `specs/large.json`) rather than changing `specs/hamlet.json` counts.

Done means:
1. New assets are tagged in the catalog (anchors, footprints via `npm run catalog:bounds`, categories, door anchors where relevant).
2. A large preset produces roughly 3–5× the current lot count (today: 4–6 houses + 1–2 landmarks), with multiple districts, more streets, a market area, farm outskirts, dense prop dressing, and varied trees.
3. All existing checks still pass; extend them as needed (no overlaps, doors reachable, gates at doors, house facing where it still applies). Determinism + node/browser parity kept.
4. `npm run test:checks` and `npm run test:parity` pass. A seed sweep of the large preset is recorded (aim for a high after-retry pass rate; target ≥90% after retries on 20–50 seeds; if lower, fix placement, don’t weaken hard checks).
5. Performance: the box has no GPU (SwiftShader). Use instancing/merging for repeated meshes (trees, bushes, fences, props, lamps, crops) so a large town can render. Grow the ground/hills to cover the larger area (makeGround is currently a radius-70 disk).
6. Write a short summary to `out/codex-large.md`: new catalog ids (grouped by pack), large vs default lot/building/prop counts (use seed 1234 for both specs), test results, any known issues, and what `?size=large` does.

You do not need to take screenshots; a later pass will. You may run `npm run catalog:bounds`, compile, tests, and `npm run build`.

## Assets already copied into public/licensed/ (do not re-download)

Scale conventions (from pack READMEs): all packs are 1 unit = 1 m, Y-up, +Z forward, vertex-coloured. Existing Cozy Village entries use `KIT_SCALE = 1.6` so their ~1.2 m doors match builder doors (~1.9). Farm door leaves are already 1.9–2.1 m — use **scale 1.0** for farm (and nature) so a farmhouse stays a bit larger than a cozy cottage, not enormous. Do not apply KIT_SCALE 1.6 to farm/nature.

### Already in the catalog (do not duplicate)
Cozy: home_cottage/thatched/timber_2storey/townhouse, bakery, tavern, chapel, general_store, well, picket_fence, dirt_path, cobble_straight, tree_oak, bush_round, barrel.

### New Cozy Village GLBs in public/licensed/cozy-village/ (tag these)
Buildings: bld_blacksmith_01.glb, bld_market_hall_01.glb, bld_windmill_01.glb
Market: market_stall_01.glb, flower_cart_01.glb, shop_hanging_sign_01.glb
Props: bench_01, crate_01, streetlamp_01, campfire_01, firewood_stack_01, directional_post_01, notice_board_01, laundry_line_01, birdhouse_01, plant_potted_01, window_box_01, hay_bale_01, water_pump_01, water_trough_01, village_entrance_sign_01, flower_bed_01, pumpkin_patch_01
Foliage: tree_fruit_01, tree_pine_01, hedge_straight_01
Vehicles: veh_hand_cart_01, veh_horse_cart_01, veh_wheelbarrow_01, veh_bicycle_01
Fences/paths: rail_fence_01, road_cobble_corner_01, road_cobble_crossing_01, road_cobble_tee_01, road_dirt_road_01, road_stone_footbridge_01
Terrain/water/rocks: terrain_garden_plot_01, terrain_tilled_field_01, water_pond_01, water_stream_01, rock_boulder_01, rock_stepping_stones_01, rock_stone_pile_01

### Farm (Countryside Farm Kit) in public/licensed/farm/
Buildings: farmhouse, farmhand_cottage, hay_barn, chicken_coop, stable, greenhouse, produce_stand, outhouse, windmill_pump, root_cellar, grain_silo, big_red_barn
Props: wheelbarrow, rain_barrel, milk_churns, produce_crates, grain_sacks, scarecrow, water_trough, feed_trough, hay_bale_round, hay_bale_square, haystack, farm_gate, weathervane
Crops/trees: apple_tree, crop_row_field, sunflower_row, pumpkin_patch, orchard_row, wheat_cluster, corn_stalk_cluster
Fences: rail_fence, drystone_wall
Animals (treat as props): chicken, sheep, duck, goat
Skip modern vehicles (none were copied).

### Nature (lighter pieces only) in public/licensed/nature/
oak, pine_sapling_staked, wildflower, tall_grass, cattails, granite_rock_cluster, lichen_granite_boulder, moss_cushion_rock, fallen_log_mossy, log_bench, lantern, mushroom_cluster, river_stones, creek_stepping_stones
These GLBs are uncompressed and heavier than Cozy/Farm (Draco). Prefer Cozy trees/bushes for dense dressing; use Nature sparsely (a few oaks, rocks, wildflowers, a log bench) so SwiftShader survives.

## Catalog tagging
Follow `src/catalog/schema.js` and the helpers in `src/catalog/catalog.js`.
- Ids: `cv-*` for cozy, `farm-*` for farm, `nat-*` for nature.
- Keep existing categories where possible: house, landmark, well, fence, gate, path, tree, bush, prop. You MAY add categories (e.g. stall, crop, rock, animal) only if you also update `CATEGORIES`, validateEntry, the compiler pick filters, and checks. Style tags should include the pack (`cozy-village` / `farm` / `nature`) plus function (`stall`, `lamp`, `cart`, `crop`, `animal`, `rock`, `bridge`, …).
- Houses and civic buildings need door + pathSnaps. Use `tools/inspect-door.mjs` and `tools/inspect-glb.mjs`. Pack convention is +Z forward, but it is not always a protruding step — several new buildings report no step (blacksmith, farmhouse, barn, coop, greenhouse, produce_stand). For those, put the door on the front wall (+Z unless the mesh clearly faces another way). Market stall_01 has a counter protrusion on **-Z** (at z=-0.418); honor actual facing (add yawOffset or use door.facing — today `doorPath` in compile.js assumes +Z, so you must make non-+Z fronts work without breaking existing +Z assets).
- Inspect-door notes (source metres):
  - blacksmith: bbox z ±1.798, no step; likely door on +Z at z≈1.80
  - market hall: mid body z ±0.884, +Z and -Z both protrude 0.651 to ±1.535 (awning both sides?). Pick a sensible public front, document it.
  - windmill: +Z protrude 0.35 at 1.75
  - market stall: front appears -Z
  - farmhand_cottage: +Z step at 2.55, wall ~2.29
  - farmhouse: large (7.4 x 7.8 x 6.6), no low-band step; inspect more carefully
  - hay_barn / big_red_barn / stable / grain_silo: farm outskirts landmarks or houses without requiring a perfect door if they are not used as door-reachable dwellings. If they lack a usable door, do not categorize them as `house`; use landmark or a farm-structure category and only run door-reachable/house-facing on entries that have doors.
- After edits: `npm run catalog:bounds`. kit.html should pick up new entries automatically.

## CRITICAL: do not change the default hamlet for a given seed
Adding mesh houses/trees/props to the pick pool would change `specs/hamlet.json` output (pick is currently `{ category: 'house' }` + prefer mesh, etc.).
- Tag original v3 kit entries with a stable style such as `v3-kit` (or tighten hamlet.json pick/prefer to an explicit allowlist of the existing ids).
- New assets must NOT enter the default hamlet pick pools.
- `npm run compile -- --seed 1234` (default spec) should still produce a town with the same instance ids/kinds/counts as before (positions may only change if you had to fix a compiler bug; prefer zero change). If default compiled output changes, explain why in the summary and keep it visually the same class of town (4–6 houses, 1–2 landmarks, same checks).

## Large town compiler
Add `specs/large.json` and a `?size=large` query param on `index` and `compile.html` (and honor `--spec specs/large.json` which already works). CLI may also accept `--size large` as sugar. Default with no flag remains hamlet.

Target counts for the large preset (ranges, density-scalable), about 3–5× lots:
- Houses: about 16–24 (mix of cozy homes + a couple of farm cottages/farmhouse on the edge)
- Landmarks / civic: about 5–8 (existing bakery/tavern/chapel/store PLUS blacksmith, market hall, windmill; maybe produce stand)
- Market: a cluster of stalls, carts, crates, barrels, benches, lamps near the plaza or on a short market street
- Farm outskirts: barn/stable/coop/greenhouse/silo, crop rows, hay, animals, rail or dry-stone fences, scarecrow, orchard/apple tree
- Trees: many, mixed species (cozy oak/fruit/pine plus a few nature oaks), bushes, hedges, flowers, rocks
- Props: dense (lamps along streets, benches, barrels, crates, carts, signs, laundry, troughs, etc.)
- Streets: more than the current single door-to-ring strips — additional connecting streets / a second residential street or concentric ring on the camera-away side, plus a farm track to the outskirts. Door paths must still reach the path network / plaza (extend door-reachable if the network is no longer “every path ends on the plaza ring” only).
- Multiple districts or neighbourhoods around/beyond the plaza ring: at least plaza+civic, residential streets, market, farm edge. Not just a bigger single crescent of the same 6 houses.

Facing rules: the current house-facing check (door ≤45° off camera, ≤50° off plaza, path bend cap) was designed for one plaza arc. Keep it for plaza-ring lots. For street lots and farm buildings, add an explicit rule (e.g. door faces the street they sit on, with a street-facing check) rather than silently failing house-facing. Do not weaken house-facing for plaza lots. Gates still required on fenced fronts (`gate-at-door`).

Grow `area.radius` and ground/hills so nothing floats off the grass. Camera auto-fit must still frame the core.

Retries: large towns may need a slightly higher town-retry budget, but keep placement deterministic.

## Performance
`src/compiler/runtime.js` currently place()s every instance as its own object. For repeated mesh ids, instance or merge (InstancedMesh or merged BufferGeometry, shared materials) so a large town is renderable under SwiftShader. Preserve userData.inst if anything relies on it, or keep it on the instance/parent. Note rough compile time in the summary; frame times will be measured later with `?perf=1`.

## Tests and docs in-repo
- Keep `npm run test:checks` (13 broken cases) green; add negatives if you add hard checks.
- Keep `npm run test:parity` green (it uses the default catalog/spec path — if it hardcodes hamlet, leave that; optionally add a large-spec parity loop, or a shorter one, if cheap).
- Sweep the large spec (e.g. `npm run compile -- --spec specs/large.json --sweep 20` or 50) and write the report under `out/`.
- Update README with `?size=large`, the new packs, and the “default hamlet is unchanged” note.
- Do not write PIPELINES.md (another step will).

## Implementation style
Match existing code: small focused modules, no noisy comments, shared `math.js` arithmetic for anything that must stay parity-safe, deterministic slot ordering. Prefer extending compile.js/spec.js/checks.js cleanly; if compile.js gets unwieldy, split district placement into a new file under src/compiler/.

Start by reading the compiler, catalog, hamlet spec, and checks. Then catalog the assets, tighten default picks, implement the large preset + districts, instancing, tests, and the summary.
