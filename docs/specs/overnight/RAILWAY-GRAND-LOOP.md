# Build "Railway grand loop", a longer mixed train on a line that circles the whole Thistlebrook map (branch `village/railway-grand-loop`, worktree `/workspace/cel-town-wt/railway-grand-loop`).

OWNER: railway-grand-loop lane. Base: current `main` (a9e88ca or later), which already has the railway-loop, vehicle-variety and weather merges. Ashe, 6:04 AM ET Nov 18: "There more of that easiest? It's so short. Plz make it travel around the map." Ashe, 6:06 AM ET: "Plz also include stops along the route at our various places of interest."

## Reference

Today's Loop Line is a steam locomotive, a tender and two coaches on a 591 m circuit, about 202 m of it in a tunnel, with stops at Thistlebrook Union, Municipal Airport, Thistlebrook High · Owls Stadium and Lantern Quay. That is the starting point, not the target. Current stills and the arrival clip live in `shots/railway-loop/` (after-wide, after-union, after-station, after-crossing, after-night, arrival-quay.mp4). Pack reference: [Railway](https://threejsassets.com/packs/railway) at `/workspace/asset-packs/railway` (steam and diesel stock, passenger coaches, freight wagons, stations, signalling, `level_crossing`). Re-material every mesh to the town toon shader and cel skin.

Gold still: a wide aerial in which a long train is visibly circling the town — not a short rake on a tight inner loop, and not a train that disappears into a long tunnel for a third of the lap. The rake should read as six or more trailing cars, and the alignment should follow the map's perimeter so districts sit inside the circuit.

| View | Aim | Files |
| --- | --- | --- |
| Wide aerial (gold) | The full perimeter line is readable; a long mixed train is on the move around the town | `shots/railway-grand-loop/after-wide.png` (compare `shots/railway-loop/after-wide.png`) |
| Station | A longer train at a platform, with waiting villagers on the platform only | `after-station.png` |
| Grade crossing | A gated, perpendicular road crossing; rails on grade (TOWN-04); people and cars use the legal path | `after-crossing.png` |
| Night | Lights on the train, platforms and crossings; the line still reads as one circuit | `after-night.png` |
| Lap clip | The train travelling around the map, not just arriving at one stop | `shots/railway-grand-loop/around-the-map.mp4` |

Measurable features of the gold wide still: the closed alignment encloses the town rather than cutting a chord across it; at least six trailing cars are countable in frame or in a follow-up mid shot; rail tops sit on or above grade on the surface legs; ink outlines match neighbouring cel buildings.

## Details

Replace the short inner loop with a main line that circles the whole town perimeter and links the districts. Maple Hollow is coming soon; leave a legal place for its road to cross the line, and a reserved halt or corridor, without painting over the suburb parcel.

Measurable targets:

- **Length:** the closed path is at least 3× the current loop, so ≥ 1773 m (today's centreline is 591 m). Document the new length and the share that is in tunnel.
- **Stock:** each service train is a locomotive (plus tender if it is steam) and **at least six coaches or wagons**, mixed passenger and freight, chosen from the Railway pack (`passenger_coach`, `guards_coach`, `mail_coach`, and wagons such as `freight_van`, `cattle_wagon`, `open_coal_wagon`, `hopper_wagon`, `tanker_wagon`, `flatbed_wagon`, `container_flat_wagon`, `brake_van`). Do not invent unlicensed rolling stock.
- **Stations at places of interest:** first inventory the town's landmarks and points of interest from the registry and district data. The major list to cover includes Pinecrest theme park, the Roadster arena / Tesla lineup, Starbase, the fair, the harbor / Lantern Quay, Coral Coast beach, the woods, the Municipal Airport, Owls Stadium, downtown / Union, and Maple Hollow once that parcel is merged. Route the line so each of those has a station or halt within easy walking distance: at most 60 m by the pedestrian path (not as the crow flies) from a documented entrance, gate or centroid of the place. Two neighbouring places may share one stop only if both are within that 60 m walk. Keep the four existing stops where they still serve a listed place; add as many new stations or halts as the inventory requires. Every stop has a named platform sign, lights, a sidewalk-graph walk link (TOWN-05) and a documented dwell on the timetable. No orphan structures.
- **Alignment:** the line runs around the town, not through district interiors. Prefer the perimeter. Use a tunnel only where the surface truly has no room; do not bury a long return leg the way Loop Q did (~202 m) if the train can go around. Curves are smooth; document a minimum radius and avoid kinks at crossings and platforms.
- **Crossings:** every road meeting is a gated, perpendicular level crossing (or a bridge). Keep **TOWN-10 · Rails are not walkways**: pedestrians never walk on tracks; cars and the Pinecrest shuttle yield at the deck; `sim:collisions` stays at zero, including rain and snow. `audit:roads` stays at 0 open.
- **Service:** a timetable runs through the day, with a documented dwell at each stop, and the set rests overnight at a documented siding (Union or a small yard). Optional, not required: a second train running the other way on the same loop, with passing or timing that never collides.
- **New town rules** (TOWN-17 and TOWN-18). Quote both in `docs/TOWN-RULES.md` and attach automated checks. Extend `tests/railway-loop.test.mjs` or add `tests/railway-grand-loop.test.mjs`.
  1. The main line must circle the town: the closed path encloses at least 80% of the district centroids (West Works, downtown, civic/school, airport, harbor/coast, woods, fair/outskirts, and Maple Hollow when that parcel is present), and each service train has at least six coaches or wagons. The check fails if the path is too short, fails the enclosure test, or the rake is under six trailing cars.
  2. Every listed major point of interest has a station or halt within 60 m by pedestrian path, and that stop has a named platform sign. The check fails if any inventoried place is farther than 60 m, unlinked, or missing a sign. Maple Hollow is required only once that parcel is present on the branch.
- Cel stays the default look. Skins restyle materials through the existing skin data path.

Out of scope: rewriting work-district labour, airport-apron rail, publishing, and any change that undoes TOWN-10 or the weather/vehicle merges.

Coordinate with the **MAPLE-INTEGRATION** lane (`/workspace/cel-town-wt/maple-integration`, branch `village/maple-integration`), which is adding a gated perpendicular crossing where Maple Hollow's road meets the railway. Avoid conflicts where you can: keep a legal Maple road crossing (or a reserved crossing site) even if you reroute the corridor, prefer additive edits to shared files (`src/compiler/railway.js`, `src/astra/railway-plan.js`, `src/astra/railway.js`, audits and tests), and log any corridor move.

## Tools

- Work only in `/workspace/cel-town-wt/railway-grand-loop` on `village/railway-grand-loop`. Licensed pack files stay under the gitignored `public/licensed` symlink; **never commit licensed or derived GLBs.** Catalog metadata (ids, bounds) may be committed. Re-toon on load, same as the existing loop.
- Keep plan and timetable pure (no THREE, no DOM) in `src/compiler/railway.js` and `src/astra/railway-plan.js`. Render in `src/astra/railway.js`. Hook `world-plan.js`, `world.js`, `expansions.js`, `navigation.js` and `place-info.js` additively only.
- Tests, run one command at a time to save memory: `node --test --test-concurrency=2 tests/*.mjs tools/life-routines.test.mjs`, `npm run test:checks`, `npm run audit:roads`, `npm run sim:collisions`, and `npm run build`. Also run rain and snow collision sims once the clear-weather sim is green.
- Shots: Playwright and `/usr/bin/google-chrome`, one dev server or browser at a time, a free port (not 5173 if it is taken). Write stills and the around-the-map clip to `shots/railway-grand-loop/`.
- No push, no deploy, no force-push, no `publish-main.sh`. Do not print secrets. Do not use Fast mode or Astra.

## How to work

Autonomous, with no questions. Log assumptions in an append-only decisions log at `docs/specs/overnight/RAILWAY-GRAND-LOOP-LOG.md`.

Study the current 591 m alignment, the pack roster and Maple Hollow's reserved road. Inventory landmarks and points of interest from the registry and district data, then plan the perimeter corridor so each major place gets a stop, extend tests, build track and named stations, lengthen the rake, and write a timetable with a dwell at every stop.

Measurable targets:

- Loop centreline ≥ 1773 m, documented, with tunnel share far below today's 202 / 591 unless a short bore is the only legal move.
- ≥ 6 trailing coaches or wagons on each service train; mixed passenger and freight.
- Enough stations or halts that every listed major point of interest is within 60 m by pedestrian path of a named stop; each stop is on the sidewalk graph and has a dwell. Log the inventory, the path distance from each place to its stop, and the sign name.
- Enclosure check: the closed path contains ≥ 80% of the named district centroids. Train-length check: trailing-car count ≥ 6. POI check: every listed place (Maple Hollow when present) is ≤ 60 m by path from a named station. All three live under the new town rules and fail CI when broken.
- Daytime service on a timetable; overnight berth documented. A dwell at every stop, documented.
- 0 pedestrians or cars on the rails except legal crossings. Injected faults still fail the rail tests and the road audit.
- `audit:roads` 0 open. `sim:collisions` 0 events in clear, rain and snow, including the longer train and platform walkers.
- Draw-call delta for the railway, from the shot tool, is recorded. Prefer instancing and merged track meshes.
- Blind critic loop on before/after stills (current loop vs grand loop) in random order until the after is clearly a long train circling the town and the before is the short inner circuit. Revert anything worse. Ashe's rules override critics. Commit at milestones.

## Deliver

- Local commits only on `village/railway-grand-loop`. Never push or deploy.
- CHANGELOG entry under Unreleased. Decisions log with probe numbers (length, tunnel share, stations, rake, loop time, draw calls, enclosure percentage, and the POI-to-station path distances).
- Stills (wide aerial, station, crossing, night) and an around-the-map clip in `shots/railway-grand-loop/`.
- All required tests, audits and collision sims green, including the new town-rule checks for loop length, train length, enclosure and POI walking distance.
