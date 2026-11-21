# OPUS-NATURE: review the Nature pack and refresh Thistlebrook's outdoor areas

Branch: village/nature-outdoors (this worktree). Local commits only. Never push, never deploy, never run publish-main.sh.

## Source
- The owned ThreeJS Assets "Nature" pack (https://threejsassets.com/packs/nature) is downloaded at
  /workspace/threejs-assets/nature/bundle (glb/, components/, preview/, palettes.json, README.md, LICENSE.txt).
- 83 GLBs. Only ~25 are copied into public/licensed/nature, and only 11 placements use it today (all in `outskirts`).
- Licensed binaries stay in gitignored public/licensed/ (symlinked here). Never commit pack binaries or put them anywhere public.

## Task
1. Review the whole pack: read the README and palettes, look at preview/ images, and render a contact sheet of every GLB
   (headless, reuse tools/shots-*.mjs patterns) at the town's scale next to a villager. Write
   docs/specs/NATURE-PACK-REVIEW.md: each model, what it is, size, triangle count, whether it fits Thistlebrook's cel look, and
   where it would go (keep / use / skip with a reason).
2. Update the outdoor areas: the outskirts and woods (see docs/specs/GROK-WOODS.md, MERGE-WOODS-RESULT.md,
   tools/shots-astra-outskirts.mjs, tools/shots-grok-woods.mjs) and other natural edges such as riverbanks and park
   borders. Use the best Nature models to add variety and believable
   natural groupings (tree clusters by species, understory, rocks, logs, creek details, wildlife as static or idle props).
   Replace repetitive or weaker placeholders where a Nature model is clearly better. Copy only the GLBs you use into
   public/licensed/nature/ and register them the way existing pack models are registered.
3. Respect docs/TOWN-RULES.md and every existing test: no props on roads or paths, keep walkable routes clear, no
   floating or buried models, authored footprints (TOWN-29), road vehicles stay pack-only (TOWN-27). Add any new rule
   Ashe would expect to TOWN-RULES.md with an automated check in tests/.
4. Watch performance: report download-size and draw-call deltas; instance repeated models. Use Draco like the rest.
5. `npm run test:ci` must pass. Add tests/nature-outdoors.test.mjs.
6. Before/after shots of each changed area (day, plus one dusk) into /workspace/scratch/opus-nature/, made via renderer.domElement.toDataURL, zoom ≤ 5.
7. Add a CHANGELOG entry and commit locally, in small commits.

## Report (final message)
Commits, the counts (models reviewed, models used, placements added or replaced), size and draw-call deltas, the test result, the shot paths, and anything you'd want Ashe to decide.

## Outcome

20 Nov 2026, branch `village/nature-outdoors`. Model review: [NATURE-PACK-REVIEW](NATURE-PACK-REVIEW.md). Rule: TOWN-30.

### What changed

All counts are for seed 831.

| Area | Added | Replaced in place | Nature models |
| --- | ---: | ---: | --- |
| Pinewood (woods, glades, pond, trails) | 39 | 67 | pine, birch, oak, silver snag, lichen granite, moss rock, fern, chopping stump, mushroom log, staked sapling, lily pads, mallard, heron, deer, fox, rabbit, trail marker, info board |
| Willow River and Stillwater Outflow banks | 51 | 0, plus the river's box reeds | willow, cattails, river stones, shore rock shelf, heron, mallard |
| Stillwater Lake shore and Birch Hollow | 42 | 8 kit pines, plus the lake's box reeds and blob rocks | cattails, river stones, rock shelf, lily pads, mallard, heron, fox, rabbit, fern, pine |
| Merrymead Park west edge | 14 | 1 | oak, birch, granite, moss rock, wildflower, rabbit |
| Open meadow | 0 | 35 kit boulders | lichen granite |
| **Total** | **146** | **111** | **24 models** |

- Replacements keep each model's position, rotation and footprint. Trees are height-matched to the kit tree they replace, so Pinewood's trail sight lines and the grok-woods density and mix still hold.
- Waterside river dressing is listed in `town.water.dressing` and registered as part of the river (GROK-RIVER keeps landscape models 1 m off the water). Everything else is a `town.landscape.models` record with its own registry ID. Both lists are instanced by `landscape.js`, one batch per asset part.
- Cattails, ferns and tall grass use a 0.012 ink line instead of 0.035, so their blades read green.
- New rule TOWN-30 (`natureEdgeFindings`, in the road audit and in `tests/nature-outdoors.test.mjs`): footprints, including crowns, clear every road, path, trail and bridge, and every model sits on its recorded surface.

### Cost

Source: `tools/shots-opus-nature.mjs` at seed 831, paused, 1500 × 1000. The draw calls and triangles come from `renderer.info` and include the shadow pass.

| View | Draw calls before → after | Triangles before → after |
| --- | --- | --- |
| Whole town | 6,636 → 6,539 (−97) | 28.84 M → 33.56 M (+4.72 M) |
| Pinewood wide | 1,181 → 1,168 (−13) | 15.04 M → 19.76 M |
| Pinewood pond | 290 → 323 (+33) | 13.22 M → 17.51 M |
| Fern Hollow | 529 → 553 (+24) | 13.34 M → 17.63 M |
| Lookout | 347 → 385 (+38) | 12.69 M → 17.01 M |
| Trailhead | 543 → 581 (+38) | 13.45 M → 17.30 M |
| Stillwater Lake | 707 → 715 (+8) | 15.03 M → 19.14 M |
| Birch Hollow | 515 → 514 (−1) | 14.35 M → 18.52 M |
| Willow River meadow reach | 679 → 657 (−22) | 14.60 M → 18.91 M |
| Stillwater Outflow | 546 → 511 (−35) | 13.12 M → 16.84 M |
| Merrymead edge | 735 → 753 (+18) | 12.93 M → 15.44 M |

- **Download.** The town loads 18 more GLBs: 16.1 MB raw, **1.15 MB after Draco** with the deploy compressor's settings. `trail_marker_post` is byte-identical to the Stillwater copy, so the deploy aliases it.
- **Triangles.** The new dressing is 2.39 M source triangles. Each instance draws its body, its ink hull and its shadow. Instanced batches span the map, so frustum culling rarely drops them, and every view pays about +4 M. The kit pine is 248 triangles and the Nature pine 23,424; every heavy model was capped for that reason (see the review).

### Checks

- `tests/nature-outdoors.test.mjs`: 6 tests over seeds 831, 0 and 42, including 5 injected faults.
- `tests/grok-woods.test.mjs`, `tests/astra-river.test.mjs` and `tests/astra-outskirts.test.mjs` pass unchanged.
- `npm run audit:roads`: 0 open findings, 16 justified.
- `npm run test:ci` passes (exit 0): 298/298 node tests, `test:checks`, `sim:collisions` in rain and snow with no events, and `sim:traffic` with 0 overlaps and 0 stalls on seeds 831, 42 and 99. Locally, `tests/astra-catalog.test.mjs` fails on the base commit too, because `/workspace/threejs-assets` was re-downloaded this morning with extra packs and `bundle/` copies. It passes with `ASTRA_ASSET_ROOT` pointed at a mirror of the inventoried packs, as CI does with its own model pack.

### Stills

`/workspace/scratch/opus-nature/before-<view>.png` and `after-<view>.png` for `wide`, `woods-wide`, `woods-pond`, `woods-fern-hollow`, `woods-lookout`, `woods-trailhead`, `lake`, `birch-hollow`, `river-meadow`, `river-outflow` and `merrymead-edge`. Each area also has a `-dusk` still (19:24). The pack contact sheets are `nature-pack-sheet-1.png` and `-2.png`.

### For Ashe

1. **Triangle budget.** The town costs +16% triangles. Reduced-detail copies of the pack's trees, rocks, cattails and ferns, made with the meshopt simplifier at deploy, would likely cut most of that. They are derivatives of licensed files, so this is your call.
2. **The Pinewood South Trail crosses Pinewood Pond.** The tread is drawn straight over the water. This predates this lane and shows in `before-woods-pond.png`. The pond dressing keeps clear of the tread.
3. **Pinewood Lookout.** The pack's `lookout_tower` would fit there, but hikers rest on the current deck. Kept, not placed.
4. **Willow Spring Falls.** The pack's `waterfall` hero could replace the draped cascade. Kept, not placed.
5. **Autumn maple.** `maple_autumn` is baked orange and is kept for an autumn look.
