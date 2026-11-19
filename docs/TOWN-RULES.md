# Thistlebrook town rules

Dates use America/New_York. The road audit reports rule IDs for graph and layout findings. Tests carry the same IDs for the simulation and render-data checks.

## TOWN-01 · Pedestrians stay off the carriageway

2026-11-17

> Villagers never walk on the road, only on sidewalks, paths and crosswalks, stepping onto the road only to cross.

The road audit samples walking edges against carriageway surfaces. The full-day collision test checks walking positions against those surfaces and the graph’s crossing corridors.

## TOWN-02 · Crosswalks connect curbs outside junctions

2026-11-17

> Crosswalks only connect sidewalk to sidewalk, perpendicular, curb to curb, never diagonal or triangular, never inside a junction.

The road audit checks both pedestrian landings, perpendicular alignment, curb span, junction clearance and cycles of three crossing edges.

## TOWN-03 · Sidewalks are continuous

2026-11-17

> Sidewalks are continuous, with no dead ends into grass or road.

The road audit checks sidewalk endpoints and walk-network connectivity.

Funfair Parking sits outside the town pedestrian graph, so `auditFairLot` (`tools/audit-town-rules.mjs`) applies TOWN-01, TOWN-02 and TOWN-03 to the lot itself. Visitor walk lines may only touch the aisles, apron or mountain road inside a zebra. Each zebra spans its aisle curb to curb, lands on a footway at both ends, stays out of aisle junctions and is used by a walk line, and every walk line reaches the Funfair gate. `tests/grok-fairlot.test.mjs` checks the lot is clean and that a short zebra or a walk line across an aisle is caught.

## TOWN-04 · Tracks, ramps and props sit on their surfaces

2026-11-17

> No terrain pieces (ramps, tracks) below ground level, and props sit on the surface.

The skatepark and Roadster tests sample the track and ramp surfaces. The road audit checks placement elevations for ground props and raised scene props.

Driveway parking is allowed when the car fits entirely on its documented paved bay and clears buildings, props, sidewalks, footpaths and crossings. The road audit checks each driveway bay against its pavement, oriented building footprints and walking routes.

## TOWN-05 · Structures have a connection

2026-11-17

> No orphan structures that connect to nothing (like the leftover rest stop near the Roadster lot).

The road audit checks building, venue and catalog scene access against the connected town graph. The registry expansion tests exercise rest-stop approaches and seat routes across seeds.

## TOWN-06 · Roads lead somewhere

2026-11-17

> Roads have no dead-end stubs; every road leads somewhere (lot, junction or district).

The road audit checks every carriageway terminus for a destination or continuing route and records the reason for each justified terminus.

## TOWN-07 · Home lots have breathing room and variety

2026-11-17

> Houses aren't crammed together on raised pads; give lots breathing room and variety.

The road audit checks home footprints and front yards, model or facade variety within each residential district, and residential pad elevations.

## TOWN-08 · Cel is the default and skins are swappable data

2026-11-17

> The cel look is the default; skins are swappable data files.

The skin tests check the cel default, per-skin data files and live switching back to the original cel appearance.

## TOWN-09 · Villagers sit and walk on their surfaces

2026-11-17

> Sit only at a reserved, documented seat. Seated hips meet the seat. Walk cycles play in place and the planted foot stays on the walking surface.

The road audit checks reserved seat anchors, bind poses, root motion and planted-foot drift. The animation tests inject off-seat sitting, floating hips, a bind pose and a skating step.

## TOWN-10 · Rails are not walkways

2026-11-17

> Pedestrians never walk on tracks; the railway owns its corridor and only meets streets at gated, perpendicular level crossings.

The road audit (`auditRailway` in `tools/audit-town-rules.mjs`) checks every sidewalk and footpath edge against the visible track outside level-crossing decks (`walk-on-rail`), track crossing carriageways at grade outside level crossings (`rail-on-road`), crossing angle and barriers (`rail-crossing`), parcels, hills and trees on the line, and land other lanes own (`rail-reserved`). The rail sides of TOWN-04 (floating track, track in water without a bridge), TOWN-05 (stations need a sign, lights and a sidewalk link) and TOWN-06 (closed loop, no orphan works stub) are checked there too. `npm run sim:collisions` counts people on the rails (`personOnRail`) and train contacts over a full day; `tests/railway-loop.test.mjs` injects each fault and expects it to fail.

Maple Hollow Drive joins Airport Road, whose northbound approach has a gated, perpendicular crossing on the Grand Loop. `tests/maple-hollow.test.mjs` checks that connection and that Maple's local traffic turns before the Airport Road junction.

## TOWN-11 · Boats stay in the water, at a berth or on a beach rack

2026-11-17

> Boats stay in the water or at a documented berth or beach rack. Hulls never sit on roads, quays or sand (except a documented kayak/canoe rack) and never clip docks, pilings or seawalls.

`src/astra/water-traffic-plan.js` lists every hull, berth, rack and route. `watercraftFindings` samples every hull at every quarter hour against the mainland and harbor land, the Gullwatch pier, the T-head, the breakwater and the lighthouse, the Shell Cove and Coral Coast swimming lines, and every road and walk. It also checks hull-to-hull overlaps. The road audit reports these as `boat-placement` and `boat-clash`. Its tests inject a yacht on the quay, a hull through the pier and a kayak on a carriageway, and each one has to fail.

## TOWN-12 · No two matching cars side by side

2026-11-17

> No two cars that share a look — the same pack model and the same body colour — travel or park side by side.

`assignFleet` and `parkedFleet` (`src/astra/traffic-fleet.js`) pick looks so that consecutive vehicles on a route, and parked cars whose bays are within 4 m, never share a look. `tests/vehicle-variety.test.mjs` checks the compiled seed-831 fleet and neighbouring bays, and treats two identical neighbouring looks as a failure.

## TOWN-13 · Vehicles give way to people on paths

2026-11-17

> Lot cars and other vehicles give way to people on paths and walk lines, and they never come to rest on a residents' walk line or a zebra.

The fair-lot simulator (`src/astra/fair-lot-sim.js`) stops a car short of the Funfair approach walk line while anyone is near the crossing, and `keepClear` will not leave a car resting on that line or a zebra. Town traffic (`src/astra/traffic-simulation.js`) counts `pedestrianYields` the same way. `tests/grok-fairlot.test.mjs` and `tests/astra-traffic.test.mjs` require yields to happen and reject a car that stays on the walk line.

Regional drivers yield while a pedestrian is in either lane of a marked crossing. `tests/maple-hollow.test.mjs` exercises that yield on both halves of a zebra.

## TOWN-14 · Distant scenery colours stay world-locked

2026-11-18

> Distant scenery colours are world-locked and don't shift with camera movement.

Backdrop hills, landscape mountains and theme-park peaks are tagged `userData.scenery`. Their skin side lights and rims use world-space normals, never the camera's left/right. Autumn and winter set `side.space: 'world'` so the rest of those skins stay locked too. Neon may keep camera-fixed side lights on buildings, but tagged scenery is still world-locked. `tests/town-scenery.test.mjs` checks the tags, the shader path, and that a fixed world normal keeps the same side-light contribution from three camera yaws.

## TOWN-15 · Snow scenes keep contour

2026-11-18

> Snow scenes keep contour: value bands and shadow hue, never flat white.

The winter skin lays cool blue-violet shadow snow, a mid band and a slightly warm highlight, with slope-worn patches, crease AO, a lip on downward edges, slushy tyre tracks on roads and only a light dusting on dark evergreens. Measurable targets live in `docs/WINTER-LOOK.md` and `src/astra/skin/winter-look.js`: snow-pixel luminance spread of at least 0.22, at least three value bands in a top-down sample, and no more than 12% of snow pixels near pure white. `tests/winter-look.test.mjs` checks the skin data, the shader, and a headless histogram of a synthetic isometric snow field, and will also fail a captured winter still that breaks the same numbers.

## TOWN-16 · The HUD stays decluttered

2026-11-18

> Declutter the UI: no "Your view"/share panel, no "drag to pan" hint, no happenings box, no bottom control bar, no sound control. The top-right clock and its dropdown are the single place to set time.

Ashe asked at 9:51 AM ET on 18 Nov 2026. The town view keeps only the masthead, the explore menu, the top-right clock and the small map tools (zoom, turn, home). The clock's dropdown holds the time presets and slider, pause and speed, weather and skin, so those features stay reachable; `?weather=` and `?skin=` URL params still work. There is no sound in the town, so there is no sound toggle. `tests/ui-declutter.test.mjs` fails if any removed piece comes back in markup, code or CSS, and drives the real UI modules in headless Chrome to prove the dropdown sets time, pace, weather and skin.

## TOWN-17 · The Northern Loop runs continuously with at least six trailing cars

2026-11-18

> The train runs 24/7.

Ashe approved a 590.50 m northern loop between Roadster Proving Ground and Maple Hollow. The train pauses for passengers at its two platforms on every lap. The audit counts passenger coaches and freight wagons toward the six-car minimum, excluding the locomotive and tender. The previous Grand Loop coverage requirement is superseded for this route.

## TOWN-18 · Both northern landmarks need a named rail stop

2026-11-18

> Every listed major point of interest has a station or halt within 60 m by pedestrian path, and that stop has a named platform sign.

The road audit measures both approved walks from the landmark to the platform and checks the named sign. Eleven earlier stops are deferred under the northern-only approval.

## TOWN-19 · Rail can enter terrain only through a tunnel with portals

2026-11-18

> If it goes into the mountain that's fine but it needs to have a tunnel.

The audit measures the roof, both walls, the flanks and the face at each opening. On open track it checks the full clearance corridor against the terrain. The renderer cuts the same hills along the surveyed approach and bore, and the railway tests raycast through all six mouths.

## TOWN-20 · Festival-goers face the stage and keep the boards and roads clear

2026-11-18

> Festival-goers face the stage and never stand on the stage or the roads.

At 1:12 PM ET, Ashe asked to “put a band up there and have like a little music festival” at the outdoor auditorium in the bottom-left of town. The Merrymead Bandshell lawn slots aim toward the centre of the boards. Listeners may turn up to 40° from that heading. The road audit checks standing positions against carriageways and Merrymead park roads and checks the audience approaches and festival fixture clearances. `tests/music-festival.test.mjs` injects a listener on the boards, one facing away and one standing in a park road. Each fault must fail the festival check and produce an open road-audit finding.

## TOWN-21 · Rail stays clear of water

2026-11-18

> Please update the tracks to never go over the water.

The audit checks sea, rivers, inland streams and pools against the full track footprint. A future permitted inland stream span requires a real bridge with supports on land. The approved loop has zero water encounters.

## TOWN-22 · Track footprints clear the road and neighbouring objects

2026-11-18

> Tracks collide with the road. In general, you need better collision detection.

Every metre of the track corridor must clear lots, buildings, plazas, props and tree crowns. Only registered road crossings within ten degrees of perpendicular are allowed. The crossing must have a flush deck, continuous rails and opposed kerb gates on clear land.

## TOWN-23 · Every platform sits on land

2026-11-18

> Doesn't make sense to have the tracks in the water.

The audit samples the whole platform and its end ramps against the same water inventory used for track. Both passenger platforms also have clear land approaches.

## TOWN-24 · Placed objects keep carriageways clear

2026-11-18

> In general, you need better collision detection.

Audit the physical footprint of props, structures, planters, patios and parking against nearby traffic surfaces. The road audit also checks parking against local footways and other placements. The Lantern Room's tables and hedge planters share a compiled terrace footprint so all their parts stay behind the kerb.

## TOWN-25 · Vehicles never overlap

2026-11-19

> Every road vehicle, of every system, keeps its model’s footprint clear of every other at all times, junctions included.

Every road vehicle keeps its model's footprint clear of other vehicles, including through junctions. `tools/sim-traffic.mjs` samples all vehicle systems and tests the oriented footprints for overlap.

## TOWN-26 · Traffic never jams

2026-11-19

> A road end is a turnaround, never a trap.

Vehicles keep moving or stop for a red light, a closed gate that reopens, a person on the crossing, or a scheduled stop. The traffic check reports waits over 30 seconds and identifies the blocker. A road end is a turnaround. `tests/traffic-fix.test.mjs` exercises the former road-end lockup and an artificial gate.

## TOWN-27 · Every vehicle is a pack model

2026-11-19

> Please replace our vehicles with assets from the ThreeJS pack.

Road vehicles use owned ThreeJS Assets models with cel shading and an ink outline. The footprint comes from the model's measured bounds and its rendered scale. `tests/traffic-fix.test.mjs` checks the bounds against the licensed models. The Roadster arena is a separate authored show.

## Rules in progress on other lanes

These are already Ashe's rules. Their checks land with the lanes building those features.

- **Villager needs** (`village/life-needs`) and **school day** (`village/school-day`) had not added new town rules at the time of this audit.
