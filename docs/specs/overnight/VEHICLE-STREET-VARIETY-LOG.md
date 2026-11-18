# Vehicle & street variety: decisions log (append-only)

Branch `village/vehicle-variety`, worktree `/workspace/cel-town-wt/vehicle-variety`, dev port 5252, seed 831.

## 2026-11-17 evening (America/New_York)

- **Packs used.** City (owned, release archived at `/workspace/threejs-packs/city/city-bundle-2026-08-27.zip`): sedan, taxi, city bus, delivery van, garbage truck, bicycle, bus shelter, street lamp, bench, bike rack, street tree, bin, sign. Already-licensed Vice Beach (pastel sedan, convertible, sports convertible, police car, cigarette speedboat, airboat, motor yacht, floatplane), Suburban (family sedan, pickup, minivan), Nature (rowboat, kayak, canoe) and Cozy Village (streetlamp). `node tools/link-vehicle-variety-assets.mjs` copies the new GLBs into the gitignored `public/licensed/`. No GLB is committed.
- **Blocked download.** The City: Paris pack (Bateau Mouche passenger boat) download was refused by the box's automatic safety review as "not covered by trusted intent". I did not escalate because Ashe was asleep. The Vice Beach motor yacht stands in as the "Saltwind coastal ferry" until the Paris boat can be downloaded with approval. Swamp & Bayou is not in the catalog. No jet skis, ferry model or sailboats were invented.
- **Sim footprints stay honest.** Models are scaled to fit inside each sim footprint (`FOOTPRINT` in `traffic-fleet.js`), never the other way round. Car length went from 1.85 to 2.05 and bus width to 1.1 so pack proportions read correctly. sim:collisions checks those same footprints.
- **Retinting.** Pack vehicles are single vertex-coloured meshes, and palettes.json cannot recolour them. `vehicle-models.js` retints only the body-paint hue window, on a cloned geometry per (model, colour), and caches each one. Liveried vehicles (taxi, police, bus livery, van, truck, minivan, sports convertible) keep the colours they ship with.
- **No adjacent repeats.** Moving cars follow a fixed order per route (`MOVING` in `traffic-fleet.js`), and bays within 4 m never share model+colour (tested).
- **Parking.** 10 legal bays (was 3): High Street west ×2, Campus Lane, Willowbank lane ×3, Willowbank west, Market south ×3. All are checked by the road audit (`parked-on-lane`, `parked-on-path`) and by sim:collisions, including the crossing-clear rule. The school bus is unused because no legal bay sits near the campus.
- **Street classes.** `street-plan.js` classifies every motor road as `boulevard` (avenue ≥ 4.2 m), `avenue` (downtown), `town` or `residential` (off the bus routes, narrow, or nearest a neighbourhood). Each class has its own asphalt tone, edge and centre lines, lamp model, spacing, extras and trees. Shelters go behind real bus stops. A bus shelter is allowed on the Founders Fountain plaza rim because downtown kerbs are too tight anywhere else.
- **Cycle strip.** A green strip with a lane line and chevrons runs both sides of Civic Avenue (x −80, z −33→−77, then west to x −99), 1.55 m off the centre line and 0.6 m wide. The town cyclist's reverse station loop rides inside it (tested). The strip ends at x −99 because the street envelope narrows at x −100.
- **Watercraft (TOWN-10).** `water-traffic-plan.js` is pure and holds every hull, berth, rack, loop and the cruiser timetable. The two Shell Cove rowboats keep their registered placements (`district-models.json` ids), so the registry is unchanged. Boats that move have no registry placement because they are dynamic like traffic. Kayaks are hidden ashore at night on the Coral Coast, and the cove kayak sits on the Shell Cove rack at night. The fishing cutters keep their procedural slips.
- **Cruiser.** Ties up overnight at the Gullwatch T-head ferry berth and runs three return trips to the Coral Coast anchorage: 07:00, 10:00 and 13:00 out, back by 09:30, 12:30 and 15:30. From 15:30 it is back at its berth. Tested every half hour 07–17.
- **Fair-lot conflict found by the sim.** The longer cars and extra bays shifted residents' timing, and sim:collisions then found lot cars stopping on the Pinecrest park footpath that crosses the Funfair apron (resident:clover/june walking into a yielding lot car). This was latent on main. Fix: `PARK_PATH` in `fair-lot-plan.js`. Lot cars now give way to anyone within 5 m of the crossing point and never stop on the footpath, the same as the painted crosswalks. A test keeps the copy in step with the compiled footpath.
- **Pack location.** The City pack lives at `/workspace/threejs-packs/city/` (zip archive plus unpacked bundle), not in `/workspace/threejs-assets/`. `tests/astra-catalog.test.mjs` inventories every GLB under `threejs-assets` against the catalog, and the City pack is not a catalog pack: the lane loads its models directly by path.
- **Willowbank lane bays removed.** The after stills showed three lane bays at x −10 covering a home's garden bed. The audit had no check for that. A new audit category, `parked-on-lot` (TOWN-04), now rejects bays over gardens, buildings, venues, props, trees and fences, and a test injects the old bay. The east kerb has a barrel and a picket fence, so the three bays were dropped instead of moved. That leaves 7 legal bays with 6 models.
- **Street trees off garden beds.** The second residential still showed two street trees over the same garden bed. `furnitureProblems` now rejects furniture within 0.25 m of a garden bed, and trees within 1.2 m (canopy overhang), and treats supplemental props such as fences as obstacles. A test injects a tree beside a bed. Downtown now has 7 lamps (was 9), still ≥ 4.

## Probes (seed 831, `tools/shots-vehicle-variety.mjs`, swiftshader 1440×1000)

| view | draw calls before | after | delta |
|---|---|---|---|
| downtown | 981 | 917 | −6.5% |
| residential | 747 | 694 | −7.1% |
| harbor | 791 | 805 | +1.8% |
| coast | 659 | 663 | +0.6% |
| avenue (cycle strip) | 603 | 626 | +3.8% |

Triangles in the downtown view went from 11.53 M to 12.97 M (pack vehicles plus the City street tree). Page download from the resource-timing probe went from 52.4 MB before to 35.2 MB after. That number depends on the dev server's dependency cache, so it is not a like-for-like budget figure. The new City GLBs are 0.16–1.3 MB each, uncompressed.

## Results

- `node --test tests/*.mjs tools/life-routines.test.mjs`: 193/193 pass (run with `--test-concurrency=2` to save memory).
- `npm run test:checks`: pass.
- `npm run audit:roads`: 0 open, 14 justified.
- `npm run sim:collisions`: carCar 0, carPerson 0, personOnRoad 0, unsafeCrossing 0, boatClash 0, boatPerson 0 over 5400 samples.

## Not done

- **Blob upload.** `npm run deploy:dist` fails before compressing: `@gltf-transform/functions` is missing from the shared `/workspace/cel-town-git/node_modules`, which only has `core` and `extensions`. I did not run `npm install` in the shared tree because other lanes build from it. A real `models:upload` from this branch would also overwrite `models/latest.json` with a pack built from a tree older than main (villager-anims, Tesla and woods models missing). The upload should run from main after this branch is merged: `npm run deploy:dist && npm run models:upload -- --dry-run`, then the real upload.
- **Critic loop.** No independent blind critic was available in this run. I compared the before/after pairs myself. After: mixed retinted pack cars, shelters, benches, racks, trees and lamps by street class, a green cycle strip, boats at the pier and on the coast, and the ferry. Before: box cars, empty water. Two regressions found that way were fixed: bays over a garden, and trees over a garden.

## 2026-11-18 · Merged to main as TOWN-11

main had already taken TOWN-09 (villager animations) and TOWN-10 (railway-loop: rails are not walkways), so on merge the boat rule was renumbered **TOWN-11 · Boats stay in the water, at a berth or on a beach rack**. Entries above that say TOWN-10 refer to this rule.
