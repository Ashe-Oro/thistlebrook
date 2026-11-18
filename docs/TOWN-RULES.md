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
