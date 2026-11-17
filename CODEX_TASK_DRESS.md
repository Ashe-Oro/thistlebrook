# Dress the large cel town + optional Edo / Autumn districts

Work only in `/workspace/cel-town`. You may READ pack READMEs and inspect GLBs under `/workspace/threejs-assets` (cozy-village, farm, nature, edo-village, autumn). Do not buy anything, do not git push, do not deploy, do not commit. Licensed GLBs already live in `public/licensed/` (gitignored: `public/licensed/` and `*.glb`). Do not copy licensed files anywhere else. No API keys.

The default hamlet (`specs/hamlet.json`, no `?size=large`) must stay unchanged in look and in compiled JSON for a given seed. All new dressing, animals, cobble use, the Edo district, and autumn variants apply only to the large preset (and optional URL flags). `npm run test:parity` must stay green.

## Goal

The large town's streets currently look empty. Residential prop scatter only picks the five-item `town-dressing` tag (`cv-firewood-stack`, `cv-plant-potted`, `cv-flower-bed`, `cv-rock-boulder`, `cv-rock-stone-pile`). Many useful meshes were already catalogued but never placed; more have now been copied into `public/licensed/`.

Done means:
1. New and previously catalogued-but-unplaced meshes are tagged (anchors, footprints via `npm run catalog:bounds`, categories, door anchors where relevant).
2. Large-town residential and street scatter is widened beyond the 5-item `town-dressing` tag so streets and yards read lived-in, while the road centre stays walkable (do not plant props on path OBBs; keep a clear walk corridor down each street, similar to how lamps/benches already sit on the verge).
3. Animals have simple placement rules: farm livestock in pastures / farmyard, wildlife at woodland edges, none in the plaza or in the road corridor.
4. An optional Japanese district using the Edo Village pack, and an autumn variant using the Autumn Harvest pack. URL flags (implement these exact names):
   - `/?size=large` — dressed default town (new props + animals + cobble where it helps). Same street skeleton as today so existing batch-2 cameras still work (south-lane at z=18, market-street at x=30, farm-track at x=58, etc.).
   - `/?size=large&district=edo` — the dressed large town PLUS a Japanese district attached on a free edge (do not overwrite the existing plaza / market / farm).
   - `/?size=large&season=autumn` — autumn foliage and harvest dressing (swap or add autumn trees/props; do not require a different street skeleton).
   Flags must compose: `/?size=large&district=edo&season=autumn` is valid.
   Thread the flags from `src/main.js` and `src/compile-page.js` into `compileTown` / the spec so they are deterministic per seed.
5. Existing checks still pass; extend them only if needed. Do not weaken hard checks. Determinism + node/browser parity kept.
6. `npm run catalog:bounds`, `npm run test:checks`, and `npm run test:parity` pass. Compile large seed 1, seed 1234, and one more seed (7 or 42) and confirm `town.ok` and reject checks pass (write the reports under `out/`).
7. Write `out/codex-dress.md`: new catalog ids (grouped by pack), what changed in scatter / animal rules, how the URL flags work, compile stats for seeds 1, 1234, and the third seed (houses, landmarks, props, trees, animals, checks), test results, and known issues.

You may run `npm run catalog:bounds`, `node tools/inspect-glb.mjs`, `node tools/inspect-door.mjs`, compile, tests, and `npm run build`. You do not need screenshots.

## Scale

- Cozy Village: existing `KIT_SCALE = 1.6`.
- Farm and Nature: scale `1.0` (already the convention).
- Edo Village and Autumn Harvest READMEs: 1 unit = 1 m, Y-up, +Z forward, architecture at ~70% real scale, bottom-centre pivots, seated on y=0. Inspect doors with `tools/inspect-door.mjs`. Pick a scale that sits with cozy homes (doors in the large town are ~1.9 m). If Edo/Autumn doors are short, a modest scale (similar spirit to KIT_SCALE, but do not blindly use 1.6) is fine — document the choice. Do not blow the pagoda up to absurd size; it is already ~11 m at source scale.

## Already in the catalog — do not duplicate

See `src/catalog/catalog.js` and `src/catalog/additions.js`. Many Cozy/Farm/Nature meshes are already tagged. Several are catalogued but not placed by `src/compiler/districts.js`.

### Catalogued but not placed — START PLACING THESE in the large town

Cozy street/yard: `cv-window-box`, `cv-laundry-line`, `cv-shop-hanging-sign`, `cv-bicycle`, `cv-birdhouse`, `cv-campfire`, `cv-hay-bale`, `cv-water-pump`, `cv-water-trough`, `cv-garden-plot`, `cv-pumpkin-patch`, `cv-tilled-field`.
Cozy water/roads: `cv-cobble-straight`, `cv-road-cobble-corner`, `cv-road-cobble-crossing`, `cv-road-cobble-tee`, `cv-road-dirt-road`, `cv-road-stone-footbridge`, `cv-dirt-path`, `cv-water-pond`, `cv-water-stream`, `cv-rock-stepping-stones`.
Also unused: `cv-store` (general store building — place it if a civic slot is free; do not break landmark counts/checks), `cv-rail-fence`, `farm-outhouse`, `farm-drystone-wall`, `farm-farm-gate`, `farm-rail-fence`, `nat-cattails`, `nat-tall-grass`, `nat-pine-sapling-staked`, `nat-lantern`, `nat-mushroom-cluster`, `nat-moss-cushion-rock`, `nat-river-stones`, `nat-creek-stepping-stones`.

You do not have to use every cobble tile as the sole road system. Prefer: keep the existing builder street skeleton (so cameras still work), and overlay or replace visible dirt with cobble along the main and market streets if you can do it without breaking door-reachability. If cobble overlay is risky, place cobble as plaza/market paving accents and a footbridge/pond feature, and say so in the summary. Walkability of the street corridor matters more than perfect tiling.

### New Cozy GLBs now in public/licensed/cozy-village/ (catalog these)

`festival_bunting_01`, `string_lights_01`, `aframe_chalkboard_01`, `door_wreath_01`, `chimney_smoke_01`.

Ids: `cv-festival-bunting`, `cv-string-lights`, `cv-aframe-chalkboard`, `cv-door-wreath`, `cv-chimney-smoke`. Tags should include `cozy-village` plus function (`bunting`, `lamp`/`lights`, `sign`, `wreath`, `smoke`) and a new shared style tag such as `street-dressing` so scatter can pick them.

Placement intent:
- Bunting and string lights: along market street and main residential streets, on the verge or spanning the street if the mesh is a hanging run. Keep the walk corridor clear. Include them in night-friendly dressing (lamps already exist).
- A-frame chalkboard: outside bakery, store, stalls, tavern.
- Door wreaths and window boxes: prefer door-adjacent / facade placement on residential houses (use each house's door / front wall). If exact facade attach is too fragile, place them tightly against the front wall / door path, not randomly in the street.
- Chimney smoke: sit at chimney height near residential or farmhouse roofs (`yOffset` / position). A few plumes, not one per tree.

### New Farm GLBs in public/licensed/farm/

`cow`, `horse`, `pig`, `farm_pond`, `fireflies`, `chimney_smoke`.

Ids: `farm-cow`, `farm-horse`, `farm-pig`, `farm-farm-pond`, `farm-fireflies`, `farm-chimney-smoke`. Animals get `style: ['farm', 'animal', 'livestock']` and stay `category: 'prop'` unless you carefully extend CATEGORIES (prefer not to — keep category `prop`).

Place `farm-farm-pond` in the farm district (not in the plaza). Fireflies sparsely at farm/woodland edge for dusk/night. Farm chimney smoke near the farmhouse.

Skip modern vehicles still not requested (`red_tractor`, `pickup_truck`, `combine_harvester`).

### New Nature GLBs in public/licensed/nature/

`deer`, `fox`, `rabbit`, `birch`, `pine`, `willow`, `split_firewood_pile`, `meadow_fireflies`.

Ids: `nat-deer`, `nat-fox`, `nat-rabbit`, `nat-birch`, `nat-pine`, `nat-willow`, `nat-split-firewood-pile`, `nat-meadow-fireflies`.

IMPORTANT: `birch`, `pine`, and `willow` are large uncompressed meshes (3–5 MB, high tri counts). Use them as a handful of feature trees (maybe 4–8 total), not as the dense forest. Keep the bulk of trees on Cozy oak/fruit/pine. Wildlife (deer, fox, rabbit) at woodland edges, few in number, off the roads and plaza. `split_firewood-pile` in residential side yards with existing firewood stacks. Meadow fireflies sparse at edges.

Animals (farm + nature) are static posed meshes — no clips. Just place them.

## Edo Village — public/licensed/edo-village/ (75 individuals, already copied)

Catalog the pieces needed for a readable Japanese district, with the toon shader via the existing mesh loader (same `license: 'tja-commercial'` path pattern `licensed/edo-village/<file>.glb`). Ids: `edo-*`. Style tags include `edo-village` plus function.

Must include at least:
- Dwellings / landmarks: `machiya_townhouse`, `nagaya_rowhouse`, `minka_farmhouse`, `teahouse`, `merchant_shop`, `noodle_shop`, `kura_storehouse`, `shinto_shrine`, `worship_hall`, `multi_tier_pagoda`, `chozuya_pavilion`, `shoro_bell_tower`, `great_torii`, `torii_gate`
- Market / props: `yatai_food_stall`, `yaoya_baskets`, `sake_barrels`, `handcart`, `merchant_ox_cart`, `shop_signboard`, `noren_curtain`, `paper_lantern`, `andon_lantern_post`, `stone_lantern`, `festival_garland`, `nobori_banner`, `wagasa_parasol`, `tea_table`, `taiko_drum`
- Nature / garden: `sakura_tree`, `sakura_sapling`, `pine_tree`, `maple_tree`, `bamboo_clump`, `bamboo_stalk`, `hydrangea_bush`, `iris_clump`, `wisteria_trellis`, `bonsai_pot`, `koi_pond_tile`, `arched_bridge`, `tsurube_well`
- Roads / fences as needed: `road_stone_straight` (and corner/T/4way if you use a small stone-street module), `takegaki_fence`
- A well: `tsurube_well` as category `well` or a district landmark

Houses and civic buildings need door + pathSnaps. Inspect with `inspect-door.mjs`. You do not have to catalog every one of the 75 assets; skip sky domes unless trivial, and skip prebuilds. Catalog enough that the district looks like a shrine/pagoda precinct, a machiya lane, a teahouse by a koi pond, and a small stall row.

Layout: attach the Edo district on a free edge of the large town (suggest the west or north side, away from the farm at +X). Include a short approach street so it is reachable from the existing path network if checks require door-reachability for houses. Keep existing streets/cameras intact. Only build this district when `district=edo`.

## Autumn Harvest — public/licensed/autumn/ (57 individuals, already copied)

Ids: `aut-*`. Style tags include `autumn` plus function. Path `licensed/autumn/<file>.glb`. Scale as above.

Catalog at least:
- Trees / ground: `autumn_maple`, `autumn_oak`, `golden_birch`, `bare_hedgerow`, `fallen_leaf_pile`, `leaf_strewn_grass`, `leaf_footpath`, `dry_meadow_tile`, `ornamental_grass`, `spent_sunflowers`, `mossy_rock`
- Harvest props: `autumn_pumpkin_patch`, `gourd_squash_cluster`, `corn_shock`, `autumn_corn_stalk_cluster`, `autumn_hay_bale_round`, `autumn_hay_bale_square`, `loose_hay_stack`, `apple_crate`, `bushel_basket`, `cornucopia`, `mums_in_pot`, `harvest_bunting`, `harvest_lantern`, `autumn_string_lights`, `fire_pit`, `garden_cart`, `autumn_wheelbarrow`, `autumn_scarecrow`
- Structures (optional but useful for the autumn town shots): `farm_cottage` (house, inspect door), `farm_stand`, `harvest_pavilion`, `cider_press_shed`, `pumpkin_stall`, `autumn_hay_barn`, `autumn_garden_shed`, `autumn_root_cellar`, `farm_stand_sign`, `orchard_signpost`
- Skip `farm_pickup` and `farm_tractor` (modern / off-tone). Skip sky domes unless trivial.

When `season=autumn`:
- Prefer autumn trees in the woodland scatter (keep some cozy pines).
- Add harvest dressing along streets and the farm (pumpkins, corn shocks, leaf piles, bunting, lanterns, hay).
- You may place `harvest_pavilion` or `farm_stand` as an extra landmark in the farm or market edge if it fits checks.
- Do not require a full rebuild of the street skeleton.

## Scatter / walkability rules (large town)

Widen residential and street scatter:
- Add a `street-dressing` (or reuse and expand `town-dressing`) style tag covering: window box, laundry, hanging sign, bicycle, birdhouse, chalkboard, bunting, string lights, wreath, potted plant, flower bed, firewood, hay bale, water pump, barrel, crate, campfire, split firewood, benches (already placed along streets — keep them), plus carts on market verges only.
- Residential yards: plants, laundry, firewood, wreaths/window boxes on fronts, a bicycle, a birdhouse, maybe a campfire or pump. Not livestock.
- Streets: bunting/lights, benches (existing), chalkboards near shops, barrels/crates only on market verges, hanging signs at civic/market fronts. Keep the central ~2 m (or the path width) of every street clear.
- Do not dump 200 crates in the road. Lived-in, not cluttered. Prop counts can go up, but reject checks must still pass and door paths must stay clear.
- Animals: livestock (`farm-cow/horse/pig` plus existing chicken/sheep/duck/goat) only in the farmyard / a pasture pocket off the farm track. Wildlife (`nat-deer/fox/rabbit`) only at woodland edges, few (e.g. 2–6 deer, 1–3 foxes, 2–5 rabbits). No animals on streets or in the plaza.
- Ponds: one cozy or farm pond as a feature (green edge or farm), with stepping stones / footbridge if they fit.

Keep `extendDistricts` street coordinates stable (green-approach, south-lane, west-lane, upper-street, orchard-street, market-street, farm-track). New dressing uses `dress()` / scatter with collision against lots and paths, same as today.

## Catalog conventions

Follow `src/catalog/schema.js` and helpers in `catalog.js` / `additions.js`.
- Ids: `cv-*`, `farm-*`, `nat-*`, `edo-*`, `aut-*`.
- Keep categories in `CATEGORIES`. Prefer `prop` for animals, stalls, smoke, lights. Houses and civic need doors.
- After edits: `npm run catalog:bounds`. kit.html should pick up new entries automatically.
- Instancing: existing instancing for repeated meshes should cover new repeated props/trees if they go through the same path. If not, hook them up so the large town still renders.

## Tests and compile

- `npm run test:checks` and `npm run test:parity` must pass (hamlet unchanged).
- `node tools/compile.mjs --size large --seed 1 --out out/dress-seed1/`
- `node tools/compile.mjs --size large --seed 1234 --out out/dress-seed1234/`
- One more seed (7 or 42) likewise.
- Also compile with `&district=edo` and `&season=autumn` (or however you thread flags into the node compile CLI — add `--district edo` and `--season autumn` flags to `tools/compile.mjs` if needed) for seed 1234, and confirm ok.
- If a large seed fails checks, fix placement; do not weaken hard checks.
- Record stats and failing check names (if any) in `out/codex-dress.md`.

## Style of change

Match existing code style in `additions.js` and `districts.js`. Prefer extending helpers over rewriting the compiler. No unrelated refactors.

Write the summary last, after tests and compiles have actually been run.
