# GROK-RIVER — Willow River, source to sea

OWNER: grok-river lane (branch `village/grok-river`, base `7c6d639`).

## Reference
- Ashe's screenshot `/workspace/refs/roads/ashe-river.png`: the town river stops dead at both ends, near Town Hall (west) and the Riverside Sessions stage (east).
- Measurable target, checked by `tests/astra-river.test.mjs`:
  - One connected channel: Mountain Pass spring, then the town bed, then Stillwater Lake, then the Gulf. No sample gap is larger than 1.6 m.
  - The water level never rises downstream. The falls drop more than 6 m. The mouth ends at sea level.
  - The water sits 3–20 cm above the ground it crosses: never hidden, never floating. The falls are draped on the real mountain mesh.
  - Every road or path sample that touches water lies on a bridge deck.
  - Zero buildings, props, trees, hills, fields, path nodes or activity slots in the water (seeds 0 and 831).
  - The deltas widen to more than 2.4× the base half-width at the sea, and more than 1.5× at the lake.

## Details
- Source: a cascade on the Mountain Pass peak `PARK_MOUNTAINS[105,0]`, bearing 328°, starting about 8 m up. It runs through the one clean gully in the boulder ring into a plunge pool at the foot.
- Upper Willow: runs from the pool west to the old bed at x=65. It bends north of Highway 4's scenic pull-out at (80.5,17).
- Town reach: the original `riverZ` bed, x 65 → -80. The original three bridges and trunk shimmer stay unchanged.
- Meadow reach: loops west outside the town slab, then southeast into Stillwater Lake's northwest shore. It ends in a sandy inflow delta.
- Stillwater Outflow: leaves the lake's southeast shore, runs south down the east meadow, then swings southwest to x≈14 and fans into a braided delta. It cuts through the beach in an estuary notch in `MAINLAND` (sand from z≈146.5). The water holds the coast level (0.036) to a ledge 4.5 m past the shoreline, then slopes down to sea level (-0.44) and is drawn in the Gulf's color, so it blends into the sea with no hard end. Surf foam sits on the water at the ledge.
- Levels (y): plunge 0.075 → town 0.06 / 0.05 → lake 0.04 → coast 0.036 → sea -0.44.
- Decisions log:
  1. River → lake → ocean, rather than straight to the ocean. Ashe named the lake, and the lake is in his frame.
  2. The flow runs east to west through town, because the only high ground near either end is the Mountain Pass peak beside the east end.
  3. The west reach goes outside x=-80 to avoid the promenade lane and the camp vignette, so no extra bridge is needed.
  4. It enters the lake from the northwest, not between the cabins, which avoids the fixed deer, fallen log and cabin clearings.
  5. The outflow crosses the lake loop once, between the windmill pump and the mossy log, then keeps well west of the coastal hills (hill-4, a cone, stands 8.8 m off the outer bank at seed 831).
  6. Mainland hills and meadow models in water are filtered after sampling, so their RNG stream keeps its seeds. Seed 831 loses 2 meadow models and no hills. Outskirts woodland rejects river samples inside its loop (like the lake), so the woods refill to their target count, but that stream reshuffles.
  7. Vignettes and rest-stop scenes reject boxes in the river: no change at seed 831.
  8. `prop()` now rejects river boxes. This removed a doorstep flower bed that sat in the water at (-30.7,12.9).
  9. Pre-existing, not moved: the Riverside Cottage's eave box overlaps the bed edge by 0.8 m, but its walls are dry. The test checks walls (box inset 0.9 m).
  10. The lake surfaces were lowered about 5 cm so the lake (0.04) sits below its inflow and above its outflow.
  11. Review fix (wip-mouth): the first mouth was a flat slab laid over the beach, with a foam arc out in the sea and a hill cone on the bank. Fixes, all in the generator: a `MAINLAND` estuary notch so the channel runs through the sand, the ledge-then-slope surface down to sea level, foam on the water, and hills dropped when any rim point of their footprint is within 6 m of the banks (test: 5.5 m).
  12. The woodland loop's draw budget went from 1600 to 2200 so the woods refill after losing the river corridor. The 100-seed minimum is 117 trees, against the test's floor of 110.

## Tools
- `src/compiler/water.js`: the plan. It covers reaches, levels, `inRiver`, `boxInRiver`, `groundAt`, bridges and `bridgeDeck`.
- `src/astra/water.js`: the renderer. It draws ribbons, bank skirts that meet the real ground, the falls drape, the plunge pool, deltas, surf, footbridges and shimmer.
- `tests/astra-river.test.mjs` (`npm run test:river`).
- `tools/river-map.mjs` (`npm run map:river`): plan map.
- `tools/shots-grok-river.mjs` (`npm run shots:river`): stills.

## How to work
- Fix in the generator only; no hand-placed patch meshes.
- Contract: `town.water` = `{reaches[{id,kind,points:[x,z,level,half,bank]}], pools, lake, source, mouth, bounds, bridges[{id,existing,reach,road,pos,yaw,length,width,deck}]}`.
- Road edits stay at zero. Bridges are added over existing paths and the paths are unchanged, so the grok-roads merge only touches the residents.js deck line.
- Probe each change with the test plus stills from Ashe's angle. Use the plan map for collision review.

## Deliver
- Before/after PNGs in `shots/grok-river/`: `before-ashe`, `after-ashe`, `after-wide`, plus close-ups.
- A local commit with a CHANGELOG entry. No push, no deploy, no licensed binaries.
