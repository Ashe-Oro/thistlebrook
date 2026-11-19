# Build "Railway Reroute", a collision-aware replan of the Thistlebrook Grand Loop: planned on a map first, reviewed, then built.

Supersedes `RAILWAY-MOUNTAIN-TUNNELS.md` (its tunnel goals are folded in below). The superseded lane's work in progress is commit `c1de921` "WIP: tunnels (superseded by reroute)" (`src/compiler/terrain.js`, edits to `src/compiler/railway.js` and `tools/railway-map.mjs`). Reuse what is useful, discard the rest.

**This spec has two stages. Stage A is plan only and changes nothing in the world. Stage B starts only after the plan is reviewed and Ashe approves it.** If you were asked to do Stage A, stop after Stage A's Deliver list.

## Reference
- Ashe, 18 Nov 2026 (ET), on the live site: "tracks collide with the road. In general, you need better collision detection." "Doesn't make sense to have the tracks in the water. What can change so this is more intelligently placed?" "Please update the tracks to never go over the water." "It needs to be in our cel shaded style" (mountains and the trees by the track look flat and unshaded). "If it goes into the mountain that's fine but it needs to have a tunnel." "Next time you should draw out how you want the tracks laid and ask Opus to review it with high thinking." Earlier (11:41 AM): "I'm okay with tunnels. I think tunnels are cool. It should tunnel through some of the mountains."
- The bugs, Ashe's screenshots of the live site, in `shots/railway-reroute/bugs/`. Every one must be fixed and re-shot from the same camera:
  - `rail-into-mountain-no-tunnel.png`: track runs straight into a flat, untextured mountain with no portal; the trees there have no ink outline.
  - `skatepark-crossing-mountain.png`: by the Astra stadium and skatepark, a brown slab on the road, gate arms hanging in the air, track vanishing under an unshaded mountain.
  - `trees-through-rail.png`: pines and broadleaf trees growing through the raised track.
  - `floating-station-over-water.png`: a station and its track floating over the sea beside Coral beach.
  - `airport-crossing.png`: by the airport, a brown slab over the road, rails turning into thin lines across it, track cutting diagonally into the parking area.
  - `track-over-road-station.png`: track running along and over a road beside a station.
  - `track-through-parking-lot.png`: the elevated track cutting through Funfair Parking over parked cars.
  - `lantern-room-patio-on-road.png`: café patio sets and hedge planters on the road and lane markings near Lantern's Room (not rail, fixed in Stage B by the general overlap audit).
- Current line: plan `src/compiler/railway.js`, timetable `src/astra/railway-plan.js`, render `src/astra/railway.js`, existing map tool `tools/railway-map.mjs`, log `RAILWAY-GRAND-LOOP-LOG.md` (2,447 m, 12 stops + Maple Hollow, 7 trailing cars). Rules: `docs/TOWN-RULES.md`, ids in `src/compiler/town-rules.js`, road audit `tools/audit-town-rules.mjs` (`auditRailway`).
- Root cause to address: the loop was drawn as a ring around the town edge and nudged outward on contact, and the audits that already claim to catch `rail-on-road` and track in water passed it. Before planning, write down for each bug screenshot why the current audit missed it (for example, Astra/airport/fair roads and lots not in the audit's road index, coastal trestles counted as bridges, trees and terrain from other modules not sampled). The new planner and checks must close each of those gaps.

## Details
### Stage A: plan only (no edits to the world, renderer or live line)
- **Obstacle and cost grid** built from the real compiled world, not hand-copied shapes: every region including Astra (downtown, airport, coast, harbor, fair, civic, homes, outskirts, Starbase), the woods and Maple Hollow. Layers: sea, coast, rivers, streams and pools; beach; carriageways of every kind; parking lots and aprons; building footprints; plazas, sports fields and parcels; props and outdoor furniture; trees; terrain height (landscape and backdrop mountains, Pinecrest/theme-park peaks, mountain pass, woods ridge, autumn peaks); reserved lanes (`RAIL_RESERVED`, the festival bandshell). Grid resolution of 1 m or finer near obstacles; rail footprint = ballast width plus clearance.
- **Route planner**: A* (or similar, e.g. A* over a lattice with a curvature-limited motion model, then smoothing) that produces a closed loop through ordered waypoints at every stop. Respect a minimum curve radius and a maximum grade the train can run; report both.
- **Hard bans**: water of any kind (no sea or coast trestles; only a small inland stream may get a short bridge, with its piers on land); parking lots; buildings; plazas; props. Trees inside the rail corridor are removed (count them; prefer routes that clear fewer).
- **Roads** are crossed only at level crossings that are perpendicular (within 10°), at ground level (rail top flush with the road), with continuous rails across the deck and no raised slab, with gates standing on the kerb on both sides and never inside a lot. Penalise each crossing so the planner uses as few as practical. No rail running along a road.
- **Mountains and hills** are crossed only through real tunnels: a bore enclosed by terrain along its whole length (sample every 1 m; cover above the bore at least clearance + 1.5 m), with a stone portal at each end, in our cel style. Elsewhere, any rail, ballast or car vertex below the terrain surface is a ban. At least 2 tunnels if the terrain allows (Ashe likes tunnels).
- **Stations** sit fully on land, platform and stairs included, each within a 60 m sidewalk walk of its landmark (TOWN-18). Keep every stop (12 + Maple Hollow) and the 7+ car train. The floating Coral beach station moves inland or is dropped and replaced by an on-land stop that still serves Coral beach; say which.
- **Outputs**:
  - `tools/railway-plan.mjs` (planner; deterministic for seed 831; rerunnable).
  - `tools/railway-plan.json`: the closed centreline polyline, per-segment type (surface, crossing, tunnel, bridge, station), every crossing (road id, angle, gate positions, clearance to the nearest lot or building), every tunnel (portal positions, length, minimum cover), every bridge (span, what it crosses, pier positions), every station (position, landmark, walk distance), trees cleared, total length, minimum radius, maximum grade, and the total cost.
  - `tools/railway-plan.png`: top-down map at a scale where roads and lots are legible (and zoomed insets for each crossing, tunnel, bridge and each bug location). It shows every obstacle class in a distinct colour with a legend, the old line faintly, the proposed centreline and corridor, crossings, tunnels (dashed through the mountain, portals marked), bridges, stations with their walk lines, and a side table listing the cost and clearance at each crossing, tunnel, bridge and station.
  - A plan validator that runs every ban against the JSON and prints zero violations, plus a list of anything it had to trade off.
  - `docs/specs/overnight/RAILWAY-REROUTE-LOG.md`: the root-cause notes, decisions, and the numbers above, old vs new.

### Stage B: build (only after the review and Ashe's approval)
- Apply the reviewed route to the plan, timetable and render. Remove the floating station and every coastal trestle.
- Apply our toon material and ink outline to the mountains, terrain, portals and the trees near the line, fixing the root cause of their flat look (find why they bypass the cel pipeline, TOWN-08, rather than patching individual meshes). Skins still restyle them as data.
- Level crossings: a flush deck with continuous rails, gates on the kerb at both sides, square to the road.
- New town rules, each in `docs/TOWN-RULES.md` with Ashe's words and the date, in `TOWN_RULE`, and with an automated check that fails the audit or the tests. TOWN-20 is reserved by the festival lane; use TOWN-19 and then TOWN-21 onward (re-check the file and `../music-festival` before writing):
  - TOWN-19 · The rail enters terrain only through a tunnel with portals.
  - TOWN-21 · The rail never goes over water.
  - TOWN-22 · The rail footprint never overlaps a road except at registered perpendicular crossings, and never overlaps any lot, building, plaza, prop or tree.
  - TOWN-23 · Every platform sits fully on land.
  - TOWN-24 · Nothing overlaps what it shouldn't: a general footprint-overlap audit over every placed object, so outdoor furniture or planters on a road also fail. Fix the Lantern's Room patios with it.
- Each check gets fault-injection tests that reproduce the bug screenshots (track on the sea, track through Funfair Parking, a slab crossing at 35°, a tree in the corridor, a portal removed, a lowered hill, a patio on a road) and must fail.

## Tools
- Worktree `/workspace/cel-town-wt/railway-tunnels` on `village/railway-tunnels` (based on main `08033f5`). node 24 / npm; `public/licensed` symlink for the owned models (never commit them).
- Planner and map: node, existing compilers (`compileWorld`, Astra compile), playwright-core with `/usr/bin/google-chrome` for SVG to PNG as `tools/railway-map.mjs` does.
- Assets (Stage B): check the owned ThreeJS Assets packs first (the `threejsassets` library and `public/licensed`) for tunnel portals, bridges and crossing gates; build in code only what the packs lack, and give everything our toon material and ink outline.
- Checks, one at a time (shared 15 GB box): `node --test --test-concurrency=2 tests/*.mjs tools/life-routines.test.mjs`, `npm run test:checks`, `npm run audit:roads`, `npm run sim:collisions` (also `-- --weather rain` and `-- --weather snow`), `npm run build`. Never pkill broadly; other agents run node and codex on this box.

## How to work
- Autonomous, no questions; log assumptions in the append-only `RAILWAY-REROUTE-LOG.md`.
- Stage A targets: plan validator reports 0 violations; 0 m over water (only a stream bridge allowed, piers on land); 0 overlaps with lots, buildings, plazas, props; every crossing within 10° of perpendicular, gates on kerbs and outside lots; every tunnel's minimum cover ≥ clearance + 1.5 m; every station on land and ≤ 60 m walk; loop closed; minimum radius and maximum grade stated and runnable by the current train; crossing count and trees cleared as low as practical (report both).
- Critic: look at your own plan image as a harsh reviewer who has not seen the code. Is any obstacle class hard to read? Does the line touch anything it shouldn't at the insets? Would Ashe look at it and say it makes sense? Fix and redraw.
- Stage B targets: all checks above green; sim:collisions 0 events of every category in clear, rain and snow; audit:roads 0 open; the new rules' fault injections fail; draw calls at the wide view and each portal reported before and after, with a modest increase.
- Commit locally at each milestone (never push, never force-push, never publish).

## Deliver
- **Stage A**: `tools/railway-plan.mjs`, `tools/railway-plan.json`, `tools/railway-plan.png` (with insets and the cost and clearance table), the validator output, and `RAILWAY-REROUTE-LOG.md` with root causes and numbers; a local commit "railway reroute: Stage A plan". Then stop.
- **Stage B**: code; TOWN-19 and TOWN-21 to TOWN-24 with checks and fault tests; the patio fix; CHANGELOG entry under Unreleased; all green (`node --test ...`, `test:checks`, `audit:roads`, `sim:collisions`, `build`); before and after shots from the same cameras as each bug screenshot in `shots/railway-reroute/` (`<bug>-before.png` / `<bug>-after.png`); a clip `shots/railway-reroute/through-the-tunnels.mp4` of the train through the tunnels; local milestone commits. No push or publish.
