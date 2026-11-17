# Stillwater & the Hinterlands — outskirts merge notes

This branch extends Astra south of the original `z=34` boundary. Stillwater Lake
sits between a woodland trail network, two log cabins, a three-pitch campground,
a ranger hut, wheat and vegetable fields, a red barn, and a southern apple
orchard. The shoreline, forest floor, reeds, rocks, wildflowers, deer, lanterns,
and evening fireflies give the town a gradual countryside border.

Thirteen additional people use the town's existing weighted pedestrian graph:
hikers, campers, cabin guests, an angler, a ranger, and three farm workers. They
walk to real stops, dwell, and choose another task. Workers carry produce back
to the barn; campers visit the fire in the evening. One hiker visits the town
market, and existing residents can choose countryside excursions. These are
authored activity schedules, not an agricultural economy or a resource system.
The canoe bobs at its mooring; it is not a boating simulation.

## Files and integration

All substantial additions live in their own files:

- `src/astra/outskirts-layout.js`: deterministic layout, lake exclusion,
  clearings, canopy reservations, connected graph extension, views.
- `src/astra/outskirts.js`: private Nature loader, instanced scenery,
  destination picking, water, wildlife, evening light.
- `src/astra/outskirts-life.js`: visitor schedules, path traversal, activities,
  picking and arrival audit.
- `src/astra/outskirts-bounds.json`: numeric measurements only; no model data.
- `tools/prepare-astra-outskirts.mjs`: prepares ignored local asset links and
  regenerates those measurements.
- `tools/shots-astra-outskirts.mjs`, `tests/astra-outskirts.test.mjs`: evidence
  and regression coverage specific to this expansion.

Four shared files have small integration edits. Preserve their intent when
resolving conflicts with the other Astra branches:

1. `main.js`: call `extendOutskirts(town, RESOLVED)` immediately after
   `compileAstra`, before constructing the world or residents. Spread
   `OUTSKIRTS_VIEWS` into the view map and allow its keys in `?view=`. Include
   outskirts people in picking and its destinations in cards. Expand the
   southern pan limit to `town.bounds.maxZ-1`. The whole-town camera now targets
   `(-7,7)` at `.75` zoom; recompute this if other branches enlarge the town.
2. `world.js`: build `buildOutskirts(scene,town)`, append its selectables,
   expose it on the returned world, and call `outskirts.update(t,night,hour)`.
3. `residents.js`: occasionally choose an outskirts destination during the day;
   use the raised deck height on the Stillwater fishing jetty.
4. `ui.js`: add the **Stillwater** view tab and derive the displayed district
   count from `town.districts.length`.

The core compiler, global catalog, package scripts, Vite config, existing tests,
and private asset loader are unchanged. Existing graph node indices stay stable.
`extendOutskirts` is idempotent and recomputes the town checker report. Its
additional destinations stay in `town.outskirts.destinations`, outside the
sports/civic `town.venues` list. The visitor list is separate from the original
32 residents; inspect `world.outskirts.life.people` or `world.outskirts.audit()`.

## Space ownership and merge order

The added footprint is approximately `x=-80..65, z=34..126`; the old town remains
north of it. Two gateways join existing nodes at `[-22,20.5]` and `[22,30]`.
The extension removes original trees whose canopies block those two approaches.
It replaces the original southern outline edge with an irregular rounded edge
and sets `town.bounds.maxZ=126`. Lake geometry is centered at `[-10,73]`, with
24 × 20 radii. Only the dock at `x=-10,z=49..55` enters the water.

The outline splice expects the original southeast corner `[65,34]` to match the
current maximum X and Z bounds. Run this extension before other extensions that
change those bounds, or combine outline edits explicitly in the lead branch.
New roads deliberately meet at authored endpoints; the test rejects any
unsplit intersection. When adding a crossing, insert a junction endpoint on the
relevant path. Avoid moving the gateways, cabins, tents or dock without updating
the matching geometry and clearance checks.

The old browser expansion capture asserts exactly six districts. With this
extension the runtime has seven, so that count assertion needs updating in the
combined branch. The pure compiler still produces its original six districts;
its tests and CLI retain their existing contract.

## Local setup and review

```sh
node tools/prepare-astra-outskirts.mjs
npm run dev -- --port 5190 --strictPort
```

Open `http://localhost:5190/?view=outskirts&seed=831`. Other new views are
`lake`, `campground`, `farmland`, and `woods`. The existing default route remains
Downtown. The **Stillwater** tab and ordinary pan/zoom controls reach the new area.

The preparation command links thirteen owned models from
`/workspace/threejs-assets/nature/bundle/glb/individual/` into
`public/licensed/astra-outskirts/`. This directory is covered by the existing
licensed-assets ignore rule and excluded from Vite builds. No GLBs are committed.
A private preview must run the preparation command or provide the same mapping.
The original Nature/Farm/Cozy models and character mapping are still required.

## Validation and evidence

```sh
node --test tests/astra.test.mjs tests/astra-outskirts.test.mjs
npm run build
node tools/shots-astra-outskirts.mjs
```

The five original compiler tests and four outskirts tests pass. The two seed
sweeps cover 100 maps each. Checks include connectivity, original node stability,
reachable destinations, deterministic output, canopy/path clearance, dry trails,
real model footprint clearance, and navigable intersections.

The browser capture runs on port 5190 only. It checks private asset responses,
console errors, the Stillwater tab, cabin roof selection, selecting/following a
visitor, pause/resume, actual arrivals after ten simulated minutes, evening
campfire arrivals, and a nonblank mobile canvas. All thirteen visitors complete
multiple stops. The daytime audit records 108 arrivals; workers reach the barn,
fields and orchard, and a hiker reaches the town market. This is functional
movement verification, not an FPS benchmark. The captured desktop frame reports
309 draw calls and about 1.8 million triangles; static outskirts scenery is
batched into 95 instanced draws for seed 831.

Screenshots and the machine-readable audit are under `shots/astra-outskirts/`:
`00-before.png`, the whole district, lake/cabins, campground, farmland, woods,
whole town, evening fire, mobile lake, and an evening gathering. `evidence.json`
contains requests, activity arrivals, visitor state, and the checks performed.

The build succeeds with the repository's existing large-bundle and mixed
static/dynamic import warnings. The source assets were kept local and excluded
from the commit. The pre-existing edits to root `ASTRA.md` and `astra-out.txt`
were left alone.
