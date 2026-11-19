# TRAFFIC-FIX-2: real-world vehicle scale and the Starbase transporter

The branch is `village/traffic-fix` in worktree `/workspace/cel-town-wt/traffic-fix`. It continues from `c7a4e09`. Read `docs/specs/TRAFFIC-FIX.md` and `docs/specs/TRAFFIC-FIX-LOG.md` first. Every rule in TRAFFIC-FIX.md under "How to work" still applies: no push, no publish, no Blob, no network downloads, no edits to main or other worktrees, never print secrets, small local commits, and no more than one heavy process of your own. Serve on port 5297 and kill the server when you finish.

## Reference
Ashe, 10:17 AM ET on 19 Nov 2026: "Fix the vehicle sizes and the Starbase transporter first, then ship it."

## 1. One consistent metres-per-unit scale for vehicles
Today each system sizes vehicles in its own way. These are the visible problems in `shots/traffic-fix/fleet-lineup.png`:
- The police cruiser is far too small next to the other town cars.
- The Town school bus and the Regional school bus come out at different sizes.
- A parked bay car renders about 20% larger than the same model when it drives (the parked fit is about 0.67, the driving fit about 0.56).
- `metresPerUnit` values are hand-picked: fire tender 1.4, ambulance 0.65, school bus 0.68.

Fix it at the source:
- Add a **target real-world length table** by vehicle class: sedan/hatch ~4.5 m, taxi/police ~4.8 m, convertible/sports ~4.4 m, pickup ~5.3 m, minivan/SUV ~5.0 m, delivery van ~5.0 m (box van ~6 m), ambulance ~6.0 m, garbage truck ~8 m, fire tender ~8 m, city bus ~11.5 m, school bus ~11 m, pushback tug ~5 m, baggage cart train ~10 m (whole train), Starbase transporter: whatever fits its cargo deck. Then compute **one world-units-per-metre factor** for road vehicles, derived from the town's existing car scale, so roads, lanes, bays and junctions still fit. A town car's rendered length should stay close to today's town car (the 2.05-unit footprint class). If the regional roads truly need their own factor, document why. The two school buses must match either way. If you can avoid a second factor, do.
- **Model scale = targetLength × unitsPerMetre / measured model length**, using each model's measured bounds. Use the same scale everywhere the same model appears: driving, parked bays, driveways, the fair lot, civic, and the lineup. Bays that can't hold the scaled car must be lengthened to fit, or get a smaller model. Never shrink just one placement.
- **Collision footprints follow the new scale automatically.** They are the model bounds × scale, as in TRAFFIC-FIX. Update sim spacing, junction zones, stop dwell points and bay geometry wherever longer buses or trucks need it. Keep `audit:roads` (driveway bays, TOWN-04) green by fixing the geometry, not the audit.
- Add a unit test. Every vehicle placement's scale equals the class formula (±1%). The two school buses render the same length. Every placement of the same model has the same scale.
- Re-shoot `shots/traffic-fix/fleet-lineup.png` with every vehicle at its in-game scale on one baseline, labelled by class and length in metres.

## 2. The Starbase transporter
In `src/astra/starbase.js`, around lines 87–88, the `transporter` (a box deck plus 14 cylinder wheels, carrying `rocket('ship')`) and the `recoveryDolly` (a box plus cylinder wheels) are drawn in code. Replace both with owned pack models, using the same handling as the other licensed vehicles: `vehicle-models.js` geometry, toon material, ink outline, scale from measured bounds, and a registry entry with a footprint. The catalog has **no SPMT, crawler transporter, low-loader or rocket vehicle**. I searched transporter, flatbed, trailer, crawler, heavy, lorry, loader, dolly and forklift. These candidates are already downloaded under `public/licensed/`:
- `airfield/pushback_tug.glb`: a low, heavy, ballasted airport tug. It's the real-world analogue of a heavy mover.
- `farm/red_tractor.glb` + `farm/tractor_trailer.glb`: a tractor towing a flat plank trailer.
- `railway/flatbed_wagon.glb`: has a flat deck but sits on rail bogies, so it's probably wrong for a road.
- Also in the folder: `city/garbage_truck_01`, `airfield/fuel_truck`.

Render the realistic options carrying the ship and pick the one that reads best as "moves a rocket stage to the pad". My guess is the pushback tug scaled up as the deck mover, or the tractor + trailer, but go by the render. The cargo must sit on the model's real deck height, not float or sink. The recovery dolly gets a pack model too; it can be the same family. If the transporter moves on the service road, make sure it's in whatever collision and stall checks cover Starbase vehicles. If none do, add Starbase road vehicles to `tools/sim-traffic.mjs`. Write the choice and the reasons in the log. Save the still as `shots/traffic-fix/starbase-transporter.png`, a close 3/4 view of the transporter carrying the ship on the service road.

## 3. Verify
Everything must be green: `npm run sim:traffic` (overlap 0, stalls 0, all seeds), `npm run test:ci`, `npm run audit:roads`, `node tools/audit-railway-layout.mjs`, `npm run build`, and `npm run deploy:dist` with its headless verify. The headless verify must show 0 missing requests and the new GLBs Draco-compressed in `dist/`. Update `shots/traffic-fix/metrics.json`. Add to the TRAFFIC-FIX CHANGELOG entry: the scale table, the transporter choice, and the full list of new GLBs the Blob pack must include (the earlier 4, plus any added here). Commit locally.

## Deliver
Your final message: the scale table (class → target m → scale per model), what changed for the police car, the school buses and the parked cars, the transporter model and why, test results with numbers, commit hashes, and the image paths.
