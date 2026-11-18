# GROK-WOODS: Pinewood woods, trails and hikers

> Note: the original lane brief was not in the worktree when the lane was
> resumed. This file was written afterwards from the brief's summary
> (woods, trails and hikers filling the empty meadow, about x -200 to -72;
> reference `/workspace/refs/roads/ashe-emptyfield.png`) and from what the
> lane built. Treat it as a record of the contract the code follows.

## Reference
- Ashe's screenshot `/workspace/refs/roads/ashe-emptyfield.png`: a large empty
  green meadow between the Pine ridge peaks (top left), the Willow River's
  west loop (bottom right) and downtown (top right).
- Base: `village/grok-merge` at c05e81e (live build).

## Details
- Fill the meadow (plan polygon `WOODS_AREA`, x about -200 to -72) with a mixed
  forest of owned kit trees (pines and oaks), bushes, boulders and mossy logs.
- A foothill ridge (Pinewood Ridge) ties the two existing Pine ridge peaks
  together; summit lookout deck and a South Knob cairn. Roads, the river,
  the coast and the fair stay flat (ridge height is zero outside its footprint).
- Dirt trails draped on the terrain: Pinewood Trail from a trailhead off the
  Fair Lane sidewalk, Lookout switchbacks (about 20% grade), ridge walk, knob
  descent, a Willow River trail from the riverside path, pond path and meadow
  cut. Trails touch roads only at their trailheads; never on a carriageway.
- Glades: Pinewood Pond, Fern Hollow picnic, Foxglove and Bluebell meadows,
  lookout and cairn clearings, trailhead clearings. Trees never hide a trail
  from the default camera.
- Hikers: deterministic, clock-driven (pure like `ballgame.js`): 12 on
  weekdays, 22 at weekends, some in pairs, on the trails from 08:00, all off by
  17:30 (weekends 18:00), none at night. They walk on the tread, rest at the
  lookout, cairn or pond, never in water or on a carriageway, and count as
  pedestrians in the collision sim.
- Registry records for the ridge, pond, lookout, trails, trailheads and hikers.

## Tools
- Owned kit only (`cv-*`, `nat-*`, `townsfolk-*` rigs); no new licensed binaries.
- `src/compiler/woods.js` (pure plan), `src/astra/woods.js` (render),
  `src/astra/woods-hikers.js` (hikers), `tests/grok-woods.test.mjs`,
  `tools/shots-grok-woods.mjs`, `tools/film-grok-woods.mjs`.

## How to work
- Worktree `/workspace/cel-town-wt/grok-woods`, branch `village/grok-woods`.
- Keep draw calls in check: instanced trees, merged trail ribbons and merged
  lookout/cairn/post geometry.

## Deliver
- All of `node --test tests/*.mjs tools/life-routines.test.mjs`,
  `npm run test:checks`, `npm run audit:roads` and `npm run sim:collisions` pass.
- CHANGELOG entry; stills in `shots/grok-woods/` (`after-ashe.png` from Ashe's
  camera, a wide shot, a close shot with hikers); local commits only.
