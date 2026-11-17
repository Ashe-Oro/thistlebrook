# GROK-ROADS — roads, sidewalks, road audit and car/person safety

OWNER: grok-roads lane (branch `village/grok-roads`, worktree `/workspace/cel-town-wt/grok-roads`, dev port 5215).
Base: `7c6d639`. Theme-park ride files are out of scope (the coaster is being fixed on `village/grok-coaster`).

## Reference

- Ashe's screenshots (outside the repo, not committed): `/workspace/refs/roads/ashe-roads.png`
  (fairground left, Roadster lot top right, town bottom), `ashe-walkers.png` (Founders Fountain square),
  `ashe-harbor.png` (Saltwind Harbor: a car and a van on a jagged spur, stepped edges near the fish market, a stub).
- Matching captures from the same cameras, seed 831, hour 10.4 (`tools/shots-grok-roads.mjs`):

| View | Camera | Before | After |
| --- | --- | --- | --- |
| Ashe's roads shot | `{x:-180,z:-120,zoom:1.6}` | `shots/grok-roads/before-ashe.png` | `shots/grok-roads/after-ashe.png` |
| Wider west network | `{x:-150,z:-100,zoom:1.05}` | `shots/grok-roads/before-network.png` | `shots/grok-roads/after-network.png` |
| Founders Fountain | `{x:-57,z:-6,zoom:5.2}` | `shots/grok-roads/before-fountain.png` | `shots/grok-roads/after-fountain.png` |
| Saltwind Harbor | `{x:140,z:31,zoom:4.6}` | `shots/grok-roads/before-harbor.png` | `shots/grok-roads/after-harbor.png` |

## Details

Wanted: one road per route, proper T/4-way junctions, no stubs, sensible curves, nothing crossing paths,
plazas or buildings, every district connected; villagers on sidewalks and crossings only; cars and people
never overlapping; parked cars in real bays; zero events over a simulated day.

Root causes found and fixed:

1. **Regional roads were drawn leg by leg.** `planRegionalRoads` bent each authored leg on its own
   (a `sin²` bulge whose side flipped with the road index) and shifted the carriageway sideways by up to
   4.6 m, then rendered every leg as its own spline. Every join stacked two ribbons, made lens loops and
   pinches, and left jagged spurs. Now `src/roads/regional.js` merges legs into chains between real
   junctions/termini, fillets the corners once (radius ≤ 14 m) and emits ONE record and ONE centerline per
   chain; the renderer draws verge and asphalt along that centerline, a junction pad at T-joins and a
   turning circle only at true ends.
2. **Authored links duplicated other roads.** The fair link re-ran the fair's own path and ended in a 2 m
   stub; the skatepark link doubled the airport spine; harbor/coast and the airport approach had 2–4 m
   dog-legs; the coast link doubled a coast lane. The links were re-authored (`src/compiler/world-plan.js`),
   with short `connectFootpath` walks where only pedestrians continue. Downtown's perimeter bus loop was
   authored on top of two existing streets (`[-42,-103]→[-80,-103]` and the Sunbeam lane on z = −33);
   the loop now reuses them instead of laying a second ribbon.
3. **Clearances used a road that was too narrow.** Links were authored 3.6 m wide but render 5.6 m with an
   8 m verge, so rest stops, props and harbor pines were placed on the final asphalt. Links are now
   authored at the verge width, wide-road rest-stop setbacks grow by the extra half width, rest-stop and
   vignette aisles and seat approaches must clear carriageways, and town props left inside a verge step
   out to the fence line. The harbor road no longer squeezes past the bandstand: a town lane takes that
   gap and the regional road starts at x = 66 and runs along z = 30.
4. **Residents walked down the road axis.** Life routing used the road centerline graph. A pedestrian
   graph (`src/roads/pedestrian.js`) now puts kerb-side sidewalks on both sides of every carriageway,
   with crossings only at junction mouths, bends, dead ends and painted crosswalks. Footpaths are clipped
   at the kerb, and a final pass (`keepToSidewalks`) keeps door exits and venue approaches off the asphalt.
   Downtown errand walkers use the sidewalks (`src/astra/downtown-errands.js`). Sidewalk strips and zebra
   stripes are drawn where there was no walkable edge.
5. **Cars and people had no shared rules.** Parked cars stood on the lane; now they sit in marked bays,
   which are reserved ground for rest gardens. Walkers wait at a crossing while a car is close
   (`crossingClear`), regional cars yield to people, follow the car ahead and take turns at shared
   junctions (`src/roads/regional-traffic.js`). Regional lines that T into a street turn around 7 m short
   of it, and town cars hold 1 m further back from a claimed junction so a turning bus can sweep the corner.
6. **Small fixes.** Straight runs of one street class carry one width. The inlet crossing on Highway 4 is
   drawn as a bridge (deck, piers, parapets). The walk-graph relaxation is bounded.

## Tools

- `node tools/audit-roads.mjs [--root tree] [--label x] [--json out] [--shots]` (`npm run audit:roads`).
  Covers overlaps and duplicates, dead ends and stubs, width steps and stepped joins, roads over buildings,
  venues, water or footpaths, hill clipping, disconnected districts and walk islands, and parked cars,
  parked-car paths and props on the lane. Results are in `docs/ROAD-AUDIT.md`.
- `node tools/sim-collisions.mjs [--root tree] [--hours 24]` (`npm run sim:collisions`): a full-day sim
  that counts car-car, car-person, person-on-road and unsafe-crossing events. It runs against the old
  tree too, so before and after numbers come from the same harness.
- `node tools/shots-grok-roads.mjs <origin> <label> [view|name={json}]`: same-camera stills.
- Tests: `tests/grok-roads.test.mjs` (the audit is clean; a duplicate ribbon and a stub both fail it) and
  `tests/grok-roads-sim.test.mjs` (a full day with zero events), via `npm run test:grok-roads`.

## How to work

- Fix the generator, planner or router, not the symptom; every justified audit exception carries a reason.
- Keep `src/roads/*` pure (no THREE, no DOM); renderers only mirror the data.
- Re-run the audit and sim after any road, prop or scene placement change; both must stay at zero open/events.
- Don't touch the theme-park ride files, other worktrees, licensed assets or deploys.

## Deliver

- Local commits on `village/grok-roads`; no pushes, no deploys.
- Shots in `shots/grok-roads/` (before/after for Ashe's camera, the wider network, the fountain and the
  harbor; audit crops in `shots/grok-roads/audit/`).
- `docs/ROAD-AUDIT.md`, CHANGELOG entry, and this spec.

### Decisions log

- One regional record per chain; corner nodes move onto the fillet apex so the walk graph never orphans a point.
- Harbor approach: a 3.2 m town lane between the bandstand and the farm fence (5.6 m does not fit), then the regional road.
- Justified audit exceptions (not changed): the 1 m downtown chicane at (−36, −16/−15), which the town and
  west bus loops depend on; Civic Avenue's cul-de-sac at (−43, −77) beside the ballpark fence; the
  avenue→lane class change at (−32, 4); the Highway 4 inlet bridge; and stop connectors that meet the road axis.
