# Edo neighborhood v2 — fix known issues and densify (Neighborhood 1 only)

Work only in `/workspace/cel-town` unless you need to READ pack files under `/workspace/threejs-assets/` or `public/licensed/`. Do not buy anything, do not git push, do not deploy, do not commit. Do not copy licensed GLBs anywhere else. No API keys. Do not run `npm install` / `npm ci` (node_modules is already present). Do not touch OK-COMPUTER, do not start any RTX 4090 / Windows / Playwright-GPU work. You do not need to write render scripts under `/workspace/celtown-render` (those will be prepared afterwards). Do not start Neighborhood 2 (Farm) or a city pack. Do not generate new PixelLab characters.

You may run `npm run catalog:bounds`, `node tools/inspect-glb.mjs`, `node tools/inspect-door.mjs`, compile, `npm run test:checks`, `npm run test:parity`, and `npm run build`. You do not need to take screenshots.

## Context

Neighborhood 1 (`?district=edo` / `--district edo`) is already an attached zone north of the intact core village. Report: `out/codex-edo-neighborhood.md`. Layout today (world x,z metres):

| Street | From | To | Width |
| --- | --- | --- | --- |
| edo-approach | [-50,-58] | [-50,-100] | 3.2 |
| edo-lantern-lane | [-50,-100] | [48,-100] | 3.2 |
| edo-garden-walk | [-78,-94] | [-50,-94] | 2.0 |
| edo-shrine-approach | [12,-100] | [12,-132] | 3.2 |
| edo-precinct-walk | [-20,-128] | [42,-128] | 2.4 |

Key placements: teahouse [-73,-100], koi pond [-73,-89], arched bridge [-68.5,-89] (BESIDE the pond, not over it), stream [-73,-83], great torii [12,-107], shrine [12,-139]. Camera-clear garden pocket `EDO_CAMERA_POCKET` x=[-87,-59], z=[-105,-74] must stay tree/bamboo/large-bush clear. Recommended cameras (update these if you move landmarks, and write the new vectors in the report):

| View | Position | Target |
| --- | --- | --- |
| Edo overview | [120,115,20] | [-13,1,-104] |
| Lantern lane eye | [-43,2.5,-100] | [38,2,-100] |
| Shrine through great torii | [12,2.2,-101] | [12,2,-139] |
| Teahouse + koi | [-69,4.8,-77] | [-73,1.4,-96] |

A 4090 render of this layout (batch 4) confirmed five visual problems plus a lamp-glow bug. Fix all of them, then densify the neighborhood with already-owned assets. 68 of 75 Edo models are catalogued; unused on purpose today: three sky domes, `edo_cloud_bank`, `forest_floor_tile`, `packed_earth_tile`, `moss_tile`. Sky/cloud domes must stay unused (procedural sky). Terrain tiles may be used only if they genuinely help a surface without fighting the ground shader; prefer stone road pieces for the street.

Catalog scale stays **1.25** (pagoda **1.0**). Ids stay `edo-<kebab>`. Keep `district=edo` and `season=autumn` flags. Default hamlet JSON and default large (no edo) JSON must stay byte-identical for seeds 1, 1234, and 7. Core village streets and house/landmark bands must not shrink. When edo is on, do not grow west-extension / north-street rows into the Edo zone. Area radius may stay 150 or grow modestly with edo only.

## Do not regress render hooks

`src/main.js` must keep `window.__stage`, `window.__town`, `window.__post`, `window.__scene`, `window.__THREE`. `src/stage.js` must keep `window.__renderer`, `?prmax`, `?shadowMap`, and `window.__shadowMap`. You may edit these files (fog in particular lives in `src/main.js` / `src/compile-page.js` / `src/stage.js`) but do not delete or "simplify" the hooks.

## Goal — done means

### 1. Fix the five known issues

**(a) Fog too heavy.** Day and golden-hour overviews wash out the far Edo zone. Fog is currently `fog: [120, 320]` in `src/main.js` and `src/compile-page.js` (`THREE.Fog`, near 120 / far 320). The overview camera is about 200+ m from the shrine, so the neighborhood is already in mid-fog. When `district=edo` is on, push fog back so the whole attached neighborhood stays readable in a high overview, without eliminating atmospheric depth entirely. Do not change default hamlet or default-large (no edo) fog. Re-tune if you move the overview camera.

**(b) Shrine facade not visible in the through-torii still.** Camera [12, 2.2, -101] → [12, 2, -139] is framed at the great torii ([12,-107]); the shrine at [12,-139] never reads in the still (only grass, shimenawa, stone lanterns, pagoda on the right). A fly-through that continues past the gate does show the shrine clearly, so the building exists. Adjust shrine placement and/or the torii and/or the recommended camera so that, in a single still looking *through* the great torii, the shrine facade is clearly recognizable (not a tiny smudge and not hidden under the lintel/rope/hill). Keep the "through the gate" composition. The walk must still go through the torii. Update the recommended camera in the report. Do not block the walk with torii posts (existing check).

**(c) Bridge must span water.** `edo-arched-bridge` unscaled bounds are roughly x ±0.6, z ±1.76 (short span). The koi pond tile is 4×4 m. Today the bridge sits at [-68.5,-89] beside the pond at [-73,-89]. Place the bridge so it actually spans the pond and/or a stream channel — a person could walk over water, not on the grass beside it. You may rearrange pond, `garden-stream-tile`, waterfall, and stepping stones, and you may use more than one water tile to make a channel the bridge can honestly span. Stay inside or thoughtfully update the camera-clear pocket so the recommended teahouse/koi camera still sees teahouse + water + bridge without a tree in the foreground. Add a hard check (see below).

**(d) Teahouse garden too dark at night.** The night preview of the garden is almost unlit. Add visible lantern fixtures in the garden (prefer `edo-andon-lantern-post` and/or `edo-stone-lantern`, optionally a hung `edo-paper-lantern` on a fixture — not a bare glow). Keep them out of the center of the reserved camera corridor. Headless night shots place a point light at y=2.95 above every instance whose id is in `{edo-andon-lantern-post, edo-stone-lantern, edo-paper-lantern}`, so fixtures must exist as real meshes at those x,z positions. Do not invent invisible lights in the compiler.

**(e) Lane too wide and empty; shops set back; dirt strip with curbs instead of a paved street.** This is the biggest layout problem. Buildings today sit ~10–12 m off the lantern-lane centerline (houses at z=-112, shops at z=-88/-90, lane at z=-100, width 3.2). The visual is a wide grass mall with a dirt path and stone curb accents (`edo-road-stone-straight` tiles are 4×4 AABB but read as edge curbs on the builder dirt road from `builders.js`). Fix all three:

- Narrow the *felt* street: pull shopfronts and facing house fronts to the street edge (a tight frontage, on the order of 1–3 m from the walk edge, not 10 m of lawn). Inspect doors with `tools/inspect-door.mjs` and keep door-reachable / facing checks green.
- You may narrow the lane width modestly if that helps, but frontage and surface matter more than the numeric width.
- Replace the dirt-strip-plus-curbs look with a visible paved / stone street surface along edo-approach, edo-lantern-lane, and edo-shrine-approach. Inspect the road-stone GLBs (`node tools/inspect-glb.mjs`). If a single tile is only a border, compose a filled surface (overlapping tiles, more pieces, corners/t-junctions/4ways, or another owned stone/earth piece that actually reads as pavement). Visual paving must remain a skin on top of the real walk graph — do not replace traversable builder paths with decoration-only tiles (existing `edo-street-paving` rule). The dirt path should not be the dominant surface.

### 2. Also fix lamp glows with no posts (shrine-approach night)

In the night shrine still, yellow orbs sat on/above the grass with no obvious fixture under them. Compiler-side: every night light source in the shrine approach and precinct must have a visible lantern post or stone lantern (or hanging lantern on a visible support) at that x,z. Do not place bare `edo-paper-lantern` on empty grass if that would spawn a 2.95 m glow with no post. Tight, regular stone lanterns along the approach are good if each glow will sit on a real fixture. (The render script's glow height may be adjusted later; your job is honest fixture placement.)

### 3. Grow the neighborhood with already-owned assets

Use more of the owned Edo pack plus suitable already-licensed Nature / Autumn / Cozy props under `public/licensed/` that credibly belong in this Japanese street/garden (do not drop Cozy streetlamps, festival bunting, or string lights into Edo — existing check). Prefer unused or underused catalog entries before adding new ids.

Required growth (as many as fit checks and the grammar):

- Denser street dressing along the lantern lane and approach: noren, signboards, barrels, crates, baskets, carts, planters/bonsai, benches or tea tables as seating, more stone lanterns / andon posts. `edo-shop-signboard` and `edo-noren-curtain` are catalogued but were not placed at all — use them on shopfronts.
- More varied houses/shops along the lane (additional machiya, nagaya, merchant shop, noodle shop, kura, yatai as they fit). Keep doors reachable, no footprint/roof overlaps, no blocking the walk.
- A second small side street **or** a second small garden court if it fits without colliding with the shrine precinct or teahouse pocket. It must join the existing Edo street graph (and thereby the plaza).
- Keep a smooth Cozy→Edo transition on edo-approach.
- Keep cherry/pine/maple/willow on edges, off the walk and out of the teahouse camera pocket.

If you catalog any new meshes, use the existing conventions and run `npm run catalog:bounds`. Record every still-unused Edo individual model and why. Do not catalog sky/cloud domes just to raise the 68/75 count.

### 4. Checks (all must stay green; add two new hard checks)

Keep `edo-connected-streets`, `edo-required-features`, `edo-camera-pocket`, `edo-street-paving`, and all existing hard checks. Do not weaken them.

Add:

- `edo-bridge-over-water`: when edo is on, the arched bridge's footprint must overlap the koi pond and/or a garden stream / water tile so the span actually crosses water (not merely sit adjacent). Prove it with a negative in `tools/check-negatives.mjs` (move the bridge onto grass beside the water; the check must fail).
- `edo-shopfront-setback`: when edo is on, merchant/shop/machiya/nagaya (and any new lane frontage buildings) facing edo-lantern-lane must have their front facade within a tight, documented distance of the lane walk edge (choose a clear threshold that matches the new tight frontage, and document it). Prove it with a negative (push one shop 10 m back; the check must fail).

Existing hamlet/large negatives must keep passing. A missing core landmark still cannot be masked by extra Edo buildings.

`npm run catalog:bounds`, `npm run test:checks`, and `npm run test:parity` must pass. Compile large seeds 1, 1234, and 7 without edo (town.ok, core counts must not drop vs current) and with `--district edo` (and optionally one edo+autumn on 1234). Write reports under `out/edo-v2-seed*/`.

### 5. Report

Write `out/codex-edo-v2.md` covering: what changed per issue (a)–(e) and the lamp-glow fixture fix; new/updated street coordinates and widths; building positions for seed 1234 + edo; recommended cameras (overview, lane eye, shrine-through-torii, teahouse/koi) with a short justification, especially the new shrine camera; catalog ids added or newly placed; compile stats (houses, landmarks, props, instances, animals, attempt) for seeds 1/1234/7 + edo and confirmation that no-edo compiles are unchanged; unused Edo models and why; new checks and test results; known remaining issues.

Also print a compact instance-count list of every Edo catalog id on seed 1234 + edo.

## Constraints (repeat)

- No purchases, no git push, no commit, no deploy, no API keys, no npm install, no 4090, no Farm/city neighborhood, no new PixelLab characters.
- Do not break default hamlet or default large (no edo).
- Do not drop render hooks.
- Do not replace the walk graph with visual paving.
