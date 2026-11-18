# Build "Railway loop", a district-linking train with pack stations in Thistlebrook (branch `village/railway-loop`, worktree `/workspace/cel-town-wt/railway-loop`).

OWNER: railway-loop lane. Base: current `main`.

## Reference

West Works already has Thistlebrook Union Station and a short platform siding (`town.workRail`, x −112 to −47, z −96) with a shuttle that dwells and returns. Hugh tends the station. That siding is the gold starting point: keep the station as a real stop, then give the town a loop that reads as one railway.

Owned pack: [Railway](https://threejsassets.com/packs/railway) (slug `railway`, 132 assets). Modular track, stations, signalling, steam and diesel rolling stock, four lighting moods. Demo: https://threejsassets.com/packs/railway/demo. Re-material every mesh to the town toon shader and cel skin; do not use the pack's mood lighting as a second look.

Gold stills (seed 831), take before shots first:

| View | Aim | Files |
| --- | --- | --- |
| Union Station arrival | A locomotive and coaches sit at the existing platform; waiting villagers stay on the platform, never the rails or the road | `before-union.png` / `after-union.png` |
| A new station | Platform, canopy, sign, crosswalk from the sidewalk, at least one waiting resident during daytime | `before-station.png` / `after-station.png` |
| A grade crossing or bridge | Track crosses a road or the river cleanly; rails and sleepers sit on the surface (TOWN-04); pedestrians use a marked crossing or under/overpass | `after-crossing.png` |
| Wide loop | The whole circuit reads as one line that links districts, not a floating train | `after-wide.png` |

Measurable features of the gold arrival still: the train fills 25–40% of frame width, the platform is continuous curb-to-train, rail tops sit on or above grade, ink outlines match neighbouring cel buildings.

## Details

A closed passenger loop with at least four stations: **Union Station** (existing, dressed with the pack), **Downtown or Market Square**, **Municipal Airport** (landside, not the apron), and one more at **Saltwind Harbor or Thistlebrook High**. A diesel or steam set of at least one locomotive plus two coaches runs a timetable all day, dwells 20–40 simulated seconds at each stop, and rests overnight at Union or a small yard next to West Works.

Alignment rules:

- Survey reserved land before picking a corridor. Do not enter Maple Hollow (`x` −42..60, `z` −183..−106), Pinewood (`WOODS_AREA` / `FRINGE_AREA` in the woods lane), Funfair Parking, the Roadster grounds, Starbase, Pinecrest, or Vice Beach (Coral Coast / Ocean Drive and any `grok-vicebeach` parcel). Stay off the Willow River bed except on a bridge.
- The existing `workRail` is the Union Station platform track. Extend it; do not leave it as an orphan stub (TOWN-06).
- Rails are their own corridor, not carriageway and not sidewalk. Pedestrians never walk on tracks (extend TOWN-01 to rails). Road crossings are bridges or gated, perpendicular crossings with a pedestrian route that stays legal.
- Stations connect to the sidewalk graph. Each has a platform, a sign, lights, and a graph node. No orphan structures (TOWN-05).
- Villagers who are travelling by train walk to the platform on the sidewalk graph, wait, ride, and walk off at the destination. They never path along the rails.
- Cars and the Pinecrest shuttle yield at grade crossings. `sim:collisions` stays at zero.
- Cel is the default. Skins restyle the train and station materials through the existing skin data path; do not hard-code a second look.

Out of scope: freight operations beyond the existing West Works warehouse, a second independent line, airport apron rail, rewriting `work-district.js` workers, and any Vice Beach or Maple Hollow streets.

## Tools

- Work only in `/workspace/cel-town-wt/railway-loop`. Create with `git -C /workspace/cel-town-git worktree add -b village/railway-loop /workspace/cel-town-wt/railway-loop main`, then `npm install` and symlink `public/licensed` to `/workspace/cel-town-git/public/licensed`.
- Download the Railway pack through the threejsassets connector (`get_pack_details`, `get_product_download_link` / `get_download_link`) into the shared licensed or `ASTRA_ASSET_ROOT` tree. Register it with `tools/inventory-library.mjs` as needed. **Never commit licensed or derived GLBs.** Catalog metadata (ids, bounds) may be committed. Re-toon on load, same as other owned kits.
- Keep plan and timetable pure (no THREE, no DOM) in new files such as `src/compiler/railway.js` and `src/astra/railway-plan.js`. Render in `src/astra/railway.js`. Hook `world-plan.js`, `world.js`, `expansions.js`, `navigation.js` and `place-info.js` additively only.
- Tests: `node --test tests/*.mjs tools/life-routines.test.mjs`, `npm run test:checks`, `npm run audit:roads`, `npm run sim:collisions`, plus new `tests/railway-loop.test.mjs`.
- Shots: Playwright and `/usr/bin/google-chrome`, free dev port, not 5173 if it is taken. Write stills and a short arrival clip to `shots/railway-loop/`.
- No push, no deploy, no force-push. Do not print secrets. Do not use Fast mode or Astra.

## How to work

Autonomous, with no questions. Log assumptions in an append-only decisions log at the bottom of this spec or `docs/specs/overnight/RAILWAY-LOOP-LOG.md`.

Study the pack roster and the existing Union Station, take before shots, reserve a corridor against the live `opus-suburb`, `grok-woods` and `grok-vicebeach` worktrees, then build plan, tests, render and timetable.

Measurable targets:

- At least 4 stations on one closed loop; every station is a sidewalk-graph destination.
- Daytime: a train is at a platform or underway for every sampled minute between 06:30 and 22:00 at seed 831. Overnight the set is parked at a documented siding.
- Dwell 20–40 simulated seconds. End-to-end loop time is documented and under 12 simulated minutes at 1×.
- 0 pedestrians or cars on the rails except legal crossings. Injected faults (a walk edge on the track, a floating rail, a station with no sidewalk link) fail the new tests and the road audit.
- New town rule **TOWN-09** (or the next free id): rails are not walkways; quote a short rule in `docs/TOWN-RULES.md` and attach a check.
- `audit:roads` 0 open. `sim:collisions` 0 events, including the train and platform walkers.
- Draw-call delta for the railway, from the shot tool, is recorded. Prefer instancing and merged track meshes.
- Blind critic loop on before/after stills in random order until the after is clearly a working railway and the before is the short isolated siding. Revert anything worse. Ashe's rules override critics.

## Deliver

- Local commits only on `village/railway-loop`. Never push or deploy.
- Stills and a short clip in `shots/railway-loop/`. Probe numbers (stations, loop time, draw calls) in the log.
- All required tests and audits green. CHANGELOG entry under Unreleased.
