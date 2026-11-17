# Turn `?district=edo` into a real attached Edo neighborhood

Work only in `/workspace/cel-town` unless you need to READ pack files under `/workspace/threejs-assets/edo-village/`. Do not buy anything, do not git push, do not deploy, do not commit. Licensed GLBs already live in `public/licensed/edo-village/` (75 files; gitignored). Do not copy licensed files anywhere else. No API keys. Do not run `npm install` / `npm ci` (node_modules is already present). Do not start any render on a remote Windows PC or any RTX 4090. You do not need to write render scripts outside this repo.

## Context

The large town already has an optional `?district=edo` / `--district edo` flag. Today it is a thin add-on that *shrinks* the main village to make room (house target minus 3, civic landmark target minus 9, then count ranges are bumped). Buildings sit in two stiff rows on `edo-lane` at z=-126 / z=-97, with a stub `edo-approach` from [-50,-58] to [-50,-112]. Many of the 75 Edo models are uncatalogued. The teahouse/koi camera used in batch 3 (`cam [-28, 4.2, -72]` looking at `[-40, 1.6, -90]`) was blocked by a tree.

Ashe wants neighborhoods built one pack at a time, with a sign-off gate before the next. Neighborhood 1 is Japanese/Edo, using the already-owned Edo Village pack. The flag name stays `district=edo`.

The default hamlet (`specs/hamlet.json`, no `?size=large`) must stay unchanged in compiled JSON for a given seed. The default large town *without* `district=edo` must keep the existing street skeleton (south-lane z=18, market-street x=30, farm-track x=58, west-lane, orchard-street, upper-street) and must not lose buildings or dressing. `npm run test:parity` and `npm run test:checks` must stay green.

## Goal — done means

1. **Main village stays intact.** When `district=edo`, do not subtract from the main-village house or civic landmark targets. Do not skip bakery/tavern/chapel/store to "make room." Edo buildings are *additive*. Adjust house/landmark count checks so default large (no edo) is unchanged, and edo compiles are not failed for having *more* buildings. A clean approach: keep core (non-edo) counts in the existing ranges, and add neighborhood-level count/presence checks for edo. Do not weaken hard checks.

2. **A distinct Edo zone attached by a connecting road.** Keep the neighborhood north of the existing village, reached from the west-lane / orchard-street junction around [-50, -58]. The connector must be a real path in the street graph, joined to an existing main-village street so door-reachability can walk from an Edo door to the plaza. When edo is on, do **not** grow `west-extension` / `north-street-*` extra rows into the Edo zone.

3. **Its own street grammar** (not two uniform rows of mixed buildings):
   - A **shrine approach** that actually walks *through* the great torii toward the shrine precinct (shrine, worship hall, chozuya, bell tower, pagoda, komainu, ema rack, shimenawa, brazier, tsukubai as they fit).
   - A **lantern-lined merchant lane** (andon posts and stone lanterns on the verge — do not dress Edo streets with `cv-streetlamp` / `cv-festival-bunting`). Machiya, nagaya, merchant shop, noodle shop, kura, yatai stalls, signs, noren, barrels, baskets, carts.
   - A **teahouse with a koi pond** (pond + arched bridge + tea table / garden stones / iris / maybe shishi-odoshi and a wisteria trellis). This garden must include a **reserved camera-clear pocket**: no trees, tall bamboo, or large bushes in front of the teahouse/pond. Document the pocket and a recommended camera (pos + target) that sees the teahouse *and* the pond without a canopy in the foreground.
   - **Merchant rows** facing the lantern lane.
   - **Cherry and pine** (and maple / shidare willow / sakura saplings as accents) along edges and the approach, off the walk corridor and out of the teahouse camera pocket.
   - **Fences and walls**: `takegaki` and, once catalogued, `ishigaki` along the precinct and neighborhood edge. Do not block doors or the road.

4. **Smooth transition at the boundary.** At the connector, Cozy village language should give way to Edo language over a short stretch: stone paving / lanterns begin, maybe the smaller `torii_gate` as a neighborhood entrance, no sudden wall of mismatched props. The walk path stays continuous.

5. **Use as many of the 75 Edo models as make sense.** Catalog additional meshes that help the grammar (see list below). Terrain sky/cloud domes should stay unused (the renderer has a procedural sky). Record every unused individual model and why in `out/codex-edo-neighborhood.md`. Prefer placing catalogued pieces that already exist, then catalog new ones that are useful.

6. **Seeded and validated.** Add neighborhood-level hard checks, for example:
   - Edo streets exist and are connected to the plaza path graph (road connects).
   - Edo building doors are reachable (existing `door-reachable` should cover this if the connector is in the graph; do not weaken it).
   - No footprint/roof overlaps (existing checks).
   - Required precinct features present when `district=edo` (at least: great torii or torii gate on/over the approach, shrine, teahouse, koi pond, and some lanterns).
   Extend `tools/check-negatives.mjs` with at least one edo-specific negative (e.g. sever the connector or remove the shrine street) so the new check is proven. Default large negatives must keep passing.

7. **Tests and compiles.** `npm run catalog:bounds`, `npm run test:checks`, and `npm run test:parity` pass. Compile large:
   - seed 1, 1234, and 7 *without* edo (must still be `town.ok`, 21/21 or whatever the current check count is, and the main village must not shrink vs today's reports under `out/dress-seed1` etc. — at least houses/landmarks should not drop).
   - seed 1, 1234, and 7 *with* `--district edo` (and optionally one edo+autumn compose on 1234).
   Write reports under `out/edo-neigh-seed*/`.

8. **Do not regress render hooks.** `src/main.js` must keep `window.__stage`, `window.__town`, `window.__post`, `window.__scene`, `window.__THREE`. `src/stage.js` must keep `window.__renderer`, `?prmax`, `?shadowMap`, and `window.__shadowMap`. These are required for 4090 Playwright renders later. Do not delete or "simplify" them.

9. Write `out/codex-edo-neighborhood.md` covering: layout (street names and coordinates), recommended cameras (overview, lane eye, shrine approach through the torii, teahouse/koi — this last one must be tree-clear), catalog ids added, compile stats, unused models and why, checks added, test results, known issues.

You may run `npm run catalog:bounds`, `node tools/inspect-glb.mjs`, `node tools/inspect-door.mjs`, compile, tests, and `npm run build`. You do not need screenshots (SwiftShader previews will be taken afterwards).

## Scale and catalog conventions

- Existing Edo scale stays **1.25**, except the pagoda stays **1.0** (~11 m). New entries must use the same convention.
- Ids: `edo-<kebab-of-filename>` e.g. `ishigaki_wall.glb` → `edo-ishigaki-wall`. Path `licensed/edo-village/<file>.glb`, `license: 'tja-commercial'`.
- Style tags include `edo-village` plus function. Buildings keep `category: 'house'` or `'landmark'` consistently with current Edo entries. Props stay `prop`. Trees stay `tree`. Fences if you can use the existing fence category without breaking fence checks; otherwise prop + careful placement is fine (document the choice).
- Inspect doors with `tools/inspect-door.mjs`. Many Edo buildings have no protruding step; authored +Z front / threshold anchors are OK (as in the earlier dress pass).
- After catalog edits, run `npm run catalog:bounds`.

## Uncatalogued individuals (31) — catalog and use the useful ones

Useful for this neighborhood (catalog + place if they fit checks):
`ema_rack`, `ishigaki_wall`, `komainu_pair`, `karesansui_center`, `raked_gravel_tile`, `zen_sand_rake`, `shishi_odoshi`, `shrine_brazier`, `shimenawa_rope`, `tsukubai_basin`, `garden_moss_boulder`, `garden_stone`, `moss_mound`, `stepping_stone_rock`, `stepping_stone_tile`, `garden_stream_tile`, `waterfall_cascade`, `rice_paddy_tile` (optional, near the minka only, not as a farm replacement), `road_stone_corner`, `road_stone_tjunction`, `road_stone_4way` (visual paving accents along Edo streets; do **not** replace the walkable builder path — same rule as Cozy cobble), `shidare_willow`, `palanquin` (optional prop).

Likely unused, and you should say so:
`spring_day_sky_dome`, `sky_sunset_dome`, `festival_night_sky_dome`, `edo_cloud_bank` — procedural sky already exists.
`forest_floor_tile`, `packed_earth_tile`, `moss_tile` — terrain tiles; only use if they genuinely help the transition without fighting the ground shader. If not, leave unused and explain.

Already catalogued (44) — use more of them in the new grammar, including `edo-road-stone-straight`, `edo-takegaki-fence`, `edo-sakura-tree`, `edo-pine-tree`, `edo-stone-lantern`, `edo-andon-lantern-post`, `edo-wisteria-trellis`, etc.

## Checks and flags

- URL / compile flags stay exactly `district=edo` and `season=autumn`, composable, large preset only.
- Threading through `src/main.js`, `src/compile-page.js`, and `tools/compile.mjs` already exists; keep it.
- Area radius may stay 150 or grow modestly if the neighborhood needs it; do not shrink the default large radius of 110 when edo is off.

## After compiling

Print a compact instance list for seed 1234 with `--district edo`: every Edo catalog id and its count, plus street names and building positions. Put that in the report so cameras can be aimed later.
