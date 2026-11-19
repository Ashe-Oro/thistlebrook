# TRAFFIC-FIX: no overlaps, no stalls, every vehicle a pack model

Branch `village/traffic-fix`, worktree `/workspace/cel-town-wt/traffic-fix`, based on local main `1d763c2` (Merge village/railway-tunnels). Dates are America/New_York.

## Reference
Ashe, 19 Nov 2026 (screenshots described, not attached):
1. **Collisions.** At a city intersection with zebras, lamps and trees, a large red truck with a tan roof rack (the Civic Quarter fire engine, a code-drawn box model) is drawn inside a large dark blue-grey vehicle just above it. Big vehicles pass through each other.
2. **Jam.** On a two-lane regional road beside a curved railway viaduct, near where the road ends at a tan rounded patch (a turning-circle pad), an orange box "van" (the regional shuttle) is in front and 4 cream box cars are behind it, bumper to bumper, and none of them ever moves.
3. "Please replace our vehicles with assets from the ThreeJS pack."

## Investigation already done (read-only, on 1d763c2)
Probe: `docs/specs/TRAFFIC-FIX-probe-before.mjs` (run `node docs/specs/TRAFFIC-FIX-probe-before.mjs <worktree>/ 4`), output `TRAFFIC-FIX-probe-before.json`. 4 sim hours from 07:00, seed 831, no pedestrians: **9 vehicles stalled > 30 s, 5 overlapping pairs.** `npm run sim:collisions` reports carCar 0 only because it never sees the vehicles that collide (see below).

Root causes found:
- **R1: road-end turnaround deadlock (src/roads/regional-traffic.js).** At a line end, `place()` tapers the lane offset to 0 over `END_TAPER` (5 m), so a vehicle that turns around (`turning`, 180° in place) ends up on the centreline, facing the queue behind it. The follow rule (`a.across < (w+w)/2+.3 && (align > .2 || a.along < (L+L)/2+2.5)`) then makes the turned vehicle wait for the oncoming queue, and the queue wait for it. Nobody ever moves. Reproduced on line 2 (end ≈ (66,34): shuttle regional-3 has turned, cars 5, 6, 4 and 2 are queued; this is Ashe's orange van plus 4 cream cars), on lines 3/4 (end (77,-184)) and on lines 5/1 (around (-173,-36)). The Northern Loop has **no level crossings** (`town.railway.crossings` is empty), so gates are not involved. Still keep the gate path correct, for any future crossing.
- **R2: Civic Quarter vehicles are outside every simulation (src/astra/civic-quarter.js, civic-quarter-life.js).** The fire engine (`FIRE_ROUTE`) and the community-supplies delivery truck (`DELIVERY_ROUTE`) are pushed along authored polylines by a clock. They never look at other vehicles. They drive Civic Avenue (x = -80) and the (-80,-77) and (-80,-52) junctions, which the West Loop bus, cars and the cycle strip also use. The town sim sees them only as a *pedestrian point* (traffic.js `update`: `pedestrians.push(civic.engine, civic.delivery)`), so its 4.3 m length doesn't exist for anyone. They are also authored at 4.3 × 2 m against town cars of 2.05 × 0.9, so they are badly out of scale. The probe shows engine vs West cars and the cycle at (-81.6,-78.5), (-89.5,-76.3) and (-80.7,-53.8), and engine vs delivery at (-82.9,-52).
- **R3: the town sim (src/astra/traffic-simulation.js) has no picture of other systems.** Following only sees same-path or aligned (>.45) vehicles in its own list. Junction zones release on the owner's *centre* passing, not its tail. Footprints are class constants, not the rendered model's bounds. Regional, fair-lot and civic vehicles are invisible to it.
- **R4: primitive vehicles still in the world** (code-drawn boxes and orbs, against Ashe's rule that we never draw assets ourselves):
  - `src/astra/landscape.js` ~L111–119: regional cars (orange/teal/cream boxes) and the tan regional shuttle.
  - `src/astra/civic-quarter.js` ~L104–121: 2 fire engines, the ambulance, the police car and the delivery truck.
  - `src/astra/civic.js` ~L46: the "ASTRA SCHOOL BUS" box bus (check).
  - `src/astra/airport/index.js` ~L59–60: the apron tug and baggage carts.
  - `src/astra/tesla/adapter.js` (installTeslaTraffic): 7 town-traffic cars replaced by code-lofted Tesla look-alikes.
  - `src/astra/fair-lot.js` L39: lot cars that are code-lofted Teslas.
  - Grep for anything else: any Group or mesh built from Box, Cylinder or Sphere geometry that represents a road vehicle, in any district. The starbase recovery *boat* tug is a watercraft and out of scope, but list it in the log.
  - Already pack models (keep them, and switch them to the new footprint source): the town fleet (`traffic-fleet.js` FLEET_MODELS), Maple Hollow family cars and the school bus, the ferry and yachts.

## Details: what to build
1. **One vehicle model registry** (extend `src/astra/traffic-fleet.js` or add `src/astra/vehicle-registry.js`, pure, no THREE). For every pack vehicle: path, pack, measured `min`/`max` from the GLB (use `tools/inspect-glb.mjs` / `npm run catalog:bounds` style, reading the real file), pivot, and retint window. **Footprint = model bounds × render scale**, exported for every system. Remove the hand constants (`FOOTPRINT`, regional `length: 2.9/4.6`, civic 4.3 × 2) as collision sources. Each system's sim length and width come from the model it renders. Scale consistently: pick one world-units-per-metre factor per road system (town streets; regional roads), document it, and keep each vehicle's real length ratio within a system (a bus clearly longer than a car, the fire engine about bus length, and so on). A unit test checks that every sim vehicle's footprint equals its rendered model's scaled bounds (±2 cm) and that every rendered vehicle has a registry entry.
2. **Replace every primitive and procedural road vehicle with an owned pack model.** Each uses the existing `src/astra/vehicle-models.js` path: merged vertex-colour geometry, `toonVertexColorMaterial`, and an ink hull via `outlineMaterial` (cel toon + ink outline, like every imported asset). Proposed mapping (change it only with a reason in the log):
   - Regional cars: mix of `city/car_sedan_01`, `city/taxi_01` (sparingly), `vice-beach/pastel_sedan`, `vice-beach/convertible_cruiser`, `suburban-neighborhood/family_sedan`, `family_pickup`, `suv_minivan`, with body retints from `BODY_COLOURS`. Neighbours on a line never share model+colour.
   - Regional shuttle: `city/city_bus_01`, retinted warm tan/orange so it still reads as the "shuttle".
   - Civic fire engine (both): there is **no fire engine in the ThreeJS Assets catalog** (searched "fire truck", "fire", "truck", "vehicle"). Use `airfield/fuel_truck.glb` (red cab-over, amber beacon; already downloaded) as the fire tender. Keep the existing code beacons only if they are emissive lights on the model, not body geometry. If it reads badly in the render, say so in the log and pick the closest pack truck. Don't build one.
   - Ambulance: `realistic-city/realistic_ambulance_01.glb` (downloaded). It is textured plus vertex colours, and the loader keeps only vertex colours. Render it. If it comes out grey or muddy, fall back to `city/delivery_van_01` with a white/green retint, and say which you chose.
   - Police car: `vice-beach/police_cruiser` (already in the fleet).
   - Delivery truck: `city/delivery_van_01`.
   - Civic school bus (if primitive): `suburban-neighborhood/school_bus`.
   - Airport tug and carts: `airfield/pushback_tug.glb` and `airfield/baggage_cart_train.glb` (downloaded).
   - Town-traffic Teslas: turn off the adapter's car swap (`count: 0`, or remove its install call) so those 7 cars use their FLEET_MODELS pack models. **Keep the Roadster arena lineup and the Roadster itself as they are.** That show is Tesla-specific, the pack has no Teslas, and Ashe decides separately. Record this as an open question in the log and CHANGELOG.
   - Fair-lot cars: pack cars (the same family as the town fleet) instead of `createTeslaVehicle`, fitted to the lot's bay footprint from real bounds.
3. **Pack model file policy (follow exactly).** Licensed GLBs live only in `public/licensed/<pack>/` (a gitignored symlink to `/workspace/cel-town/public/licensed`). Never `git add` a .glb, never copy one into `src/`, `docs/` or `shots/` (renders are fine). The new files are already there: `airfield/{fuel_truck,pushback_tug,baggage_cart_train}.glb` and `realistic-city/realistic_ambulance_01.glb`. If you need another model, stop and list it in the log rather than downloading it. Draco: raw files stay raw locally. `npm run deploy:dist` compresses what the town requests (`tools/compress-dist-glbs.mjs`). Make sure `deploy:dist` collects every new path (its headless verify must pass with no missing-model requests), and that the models load Draco-compressed from `dist/`. Do **not** run `models:upload` or touch Vercel Blob. That happens at publish time.
4. **Simulation fixes (root causes, not tuning).**
   - R1: line ends. Vehicles turn around *within the carriageway* without sitting on the centreline against the queue. Use a reserved turn zone at the line end (one vehicle at a time, turning-circle or 3-point arc that ends in the opposite lane), and queue the others behind the zone entry. Following must ignore vehicles in the opposite lane (use lane side + heading, not just a distance cone), so oncoming traffic never blocks you.
   - Deadlock release (general): detect a wait-for cycle (A waits on B ... waits on A) and resolve it deterministically, for example by lowest id or by who holds the zone. Log each release in `events.deadlocksReleased`. The target in steady state is 0 releases. Treat a release as a safety net, never as the fix.
   - R2: civic vehicles become simulation vehicles. Put the fire engine (with its response/assist/return cycle from `civicLifeState`), the delivery truck, and any moving patrol or ambulance into `createTrafficSimulation` as route vehicles on real lanes (`makeLane`). They obey following, junction-zone reservation, pedestrians and stops, with dwell at the bin fire and at the depot. The fire engine may get *priority*: others yield to it at junctions, and nobody pulls into its path. Priority never permits overlap. The authored scene reads positions from the sim only. Parked civic vehicles become parked footprints (like `PARKING_BAYS`) that moving traffic and checks know about.
   - R3: junction zones release only when the owner's whole footprint (tail included) has left the zone. Zone entry is a footprint-sweep reservation, so long vehicles can't be caught half-in. Following uses real footprints (gap = centre distance − half lengths − margin) and also sees crossing traffic that is inside or entering the zone. Where systems share asphalt (regional line ends near town junctions, the fair-lot apron, civic routes), make each system see the others' vehicles.
   - Gates and lights: keep `Waiting at level crossing` correct (stop at the stop line, go when it reopens). If there are no crossings, the check must still prove that a closed→open gate releases the queue (unit test with a synthetic crossing).
5. **Automated checks** (new `tools/sim-traffic.mjs` plus `tests/traffic-fix.test.mjs`, wired into `test:ci`):
   - (a) **Overlap:** a long seeded run (24 sim hours at the same 90 s/hour clock as sim-collisions, seeds 831 plus two more) with *every* vehicle system: town, regional (incl. Maple Hollow and the school bus), civic (moving and parked), fair lot, parked bays, at-grade trains if any. OBB test (`src/roads/collisions.js` footprintsOverlap) on model-derived footprints, every sample, with no 6 m centre-distance shortcut that could miss long vehicles. Required: **0 overlaps**. Report pair, ids, kinds, statuses, location and hour.
   - (b) **Stalls:** no moving vehicle may sit stationary (< 5 cm moved) for > 30 s sim time unless its cause is an allowed one: red light, a closed gate that reopens (and it moves within 15 s of reopening), a scheduled dwell (bus stop, unloading, boarding, depot/parked, fire-scene assist), or yielding to a person who is actually on the crossing. Required: **0 stalls**. Report id, kind, location, status, how long, and the blocking chain (who it waits on).
   - Negative tests: re-inject the old line-end taper turnaround → the stall check fails. Inject a scripted vehicle that ignores traffic → the overlap check fails. A footprint smaller than its model → the registry test fails.
   - Keep `npm run sim:collisions` green, and extend it to include civic vehicles with real footprints.
6. **Town rules.** Add to `docs/TOWN-RULES.md`, dated 2026-11-19, with checks named:
   - **TOWN-25 · Vehicles never overlap.** Every road vehicle, of every system, keeps its model's footprint clear of every other at all times, junctions included.
   - **TOWN-26 · Traffic never jams.** No vehicle waits > 30 s except at a red light, a closed gate that reopens, or a scheduled stop. A road end is a turnaround, never a trap.
   - **TOWN-27 · Every vehicle is a pack model.** Road vehicles are owned ThreeJS Assets models under the toon material and ink outline, scaled from their real bounds. Footprints come from the same bounds. No code-drawn vehicles.
   (If 25–27 are taken by then, use the next free numbers.)

## Tools
- Builder: you (Codex Sol, local) for the whole branch. Read files and run node, vite and playwright as needed.
- Use the existing shot and film tools as templates: `tools/film-vehicle-variety.mjs`, `tools/railway-tunnels-shots.mjs`, `tools/shots-astra-traffic.mjs`, and the `window.__astra` hooks (`setHour`, `step`, `view`, `setPaused`, `audit()`).
- Serve with `npx vite --port 5297 --strictPort` from this worktree (5291 is in use by another worktree; leave it alone). Kill your own server at the end.

## How to work
- Don't touch local `main`, other worktrees, `/workspace/pixel-town-map`, Thistlebrook 2D, Crayon or Agent Pixel. No git push, no publish, no `vercel` commands, no Blob, no network downloads.
- Never print secrets. Never write tokens anywhere.
- Commit locally on `village/traffic-fix` in small honest commits. Never amend or force anything.
- At most one heavy process of your own at a time (one vite plus one playwright, or one long sim). Another job shares this box.
- Keep a log at `docs/specs/TRAFFIC-FIX-LOG.md`: decisions, mapping changes, numbers.
- Don't weaken existing tests or audits to get green. If one conflicts, fix the cause or explain it in the log.

## Deliver
1. Code and checks as above, with **overlap = 0 and stalls = 0** from `tools/sim-traffic.mjs` (show before numbers from the base commit via the same harness, `--root`, and after numbers).
2. All green: `npm run test:ci`, `npm run audit:roads`, the railway audit (`node tools/audit-railway-layout.mjs`, plus `tests/railway-loop.test.mjs` in test:ci), `npm run sim:collisions` (clear, rain, snow), `npm run build`, and `npm run deploy:dist` with its headless verify (no missing models, new GLBs compressed in dist/).
3. Evidence in `shots/traffic-fix/`:
   - `intersection-yield.png` plus a frame strip: big vehicles (bus, fire engine, delivery) yielding at a shared junction, no overlap.
   - `road-end-before.png` (base) and `road-end-after.png`: the formerly stuck road end with traffic turning and flowing.
   - `fleet-lineup.png`: every new pack vehicle side by side at its in-game scale with labels.
   - `traffic-fix.mp4`: 30–60 s showing all three.
   - `metrics.json`: before/after overlap and stall counts, deadlock releases, and a per-system vehicle count.
4. `CHANGELOG.md` entry under Unreleased (plain words: what Ashe will see, the root causes, the vehicle mapping, the open Tesla-arena question, and the note that the Blob model pack must be re-uploaded at publish so CI deploys carry the new GLBs).
5. Final message: root causes, fix summary, model mapping table (old → pack file), commits (hashes), test results, before/after numbers, evidence paths, anything left open.
