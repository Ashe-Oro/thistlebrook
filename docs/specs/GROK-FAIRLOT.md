# GROK-FAIRLOT: Funfair Parking next to Pinecrest

## Reference
- Gold still: Ashe's screenshot `/workspace/refs/roads/ashe-fairlot.png`. It
  shows the empty lawn between the curved mountain road (which ended in a dead-end stub),
  the Coral Coast blocks to the south-west, and the Pinecrest FUNFAIR gate and
  fence. Ask: "turn this into a parking lot next to the amusement park".
- Same camera in this worktree: `{x:222, z:16, zoom:3}` at 18.6 h
  (`shots/grok-fairlot/before-ashe.png` / `after-ashe.png`), plus day,
  wide and close views.
- Target:
  - an asphalt lot with marked bays (>= 60), and parked cars only in bays;
  - the road stub enters and leaves the lot, so it is no longer a dead end;
  - a walkway and crosswalks that reach the gate;
  - a busy lot while the fair is open and a few cars at night;
  - zero collisions and no new open road-audit findings.

## Details
- Layout: `src/astra/fair-lot-plan.js` (pure).
  - Lot x 223-268.4, z 4.6-32.2; reserve x 211-272, z 1.5-35.5.
  - 64 bays (1.83 x 3 m) in four rows across two islands.
  - 5 aisles: A0 two-way along the fence; A1 and A2 one-way; W and E connectors.
  - Promenade at x~245.7 with zebras on A0 and A1.
  - Walkway along the fence to the gate plaza; it passes south of the ticket-queue stanchions.
  - Planters, 10 trees, 13 lamps, a ticket booth and the "FUNFAIR PARKING" sign at the road end.
  - The apron joins the APPROACH road's final 30 m to the lot.
  - Per-bay arrival and departure paths are filleted, with the largest clear turn radius.
- Sim: `src/astra/fair-lot-sim.js` (pure, seeded).
  - Occupancy by hour: about 4 cars overnight, 52-56 in the afternoon, draining after 22:30. Cars churn while the fair is open.
  - Locks:
    - bay-mouth locks;
    - a merge lock with the Pinecrest shuttle (predicted with `shuttleDue`);
    - a direction-shared apron.
  - Cars follow the car ahead, keep crosswalks clear, and yield to walkers.
  - Visitors walk between their car and the gate on the walkway and promenade.
  - Styles: hatchbacks plus toy Tesla sedan, crossover and Cybertruck.
- Render: `src/astra/fair-lot.js`.
  - Plain parts are merged into one vertex-coloured mesh. Lamp heads and signs are instanced.
  - Cars are instanced per style in three layers: paint, trim and ink.
  - Visitors use instanced townsfolk.
  - Empty batches are hidden, so they cost no draw call.
  - Wired through `expansions.js`; `world.js` passes residents to it.
- `themepark.js` skips scatter pines inside the reserve but still consumes their random draws, so every other id is unchanged. Two pine records were removed from `district-models.json`.
- Out of scope: `src/roads/*` and anything in the village/grok-woods lane.

## Tools
- Dev server on port 5228; 5218 was held by a stale grok-skins vite.
- `node tools/shots-grok-fairlot.mjs <origin> before|after [view]` saves stills and prints draw calls with and without the lot.
- `npm run test:grok-fairlot` runs `tests/grok-fairlot.test.mjs`:
  - layout;
  - cars fit their bays and turns are clear;
  - the walk reaches the gate;
  - parked cars only in bays;
  - day sims at seeds 831 and 42 have zero conflicts.
- `npm run audit:roads`, `npm run sim:collisions` (now includes lot cars and visitors), the full `node --test tests/*.mjs tools/life-routines.test.mjs`, and `npm run test:checks`.

## How to work
- Keep layout and sim pure and test them in Node; the renderer only draws them.
- Every car motion is a precomputed path with a clear sweep. A lock must be taken before a car enters a shared region.
- Keep registry ids stable: no new rng draws in themepark scatter.
- Small local commits. Never push or deploy.
- Decisions:
  1. Arrivals take the apron as they spawn. Waiting on the road put cars in the shuttle's path.
  2. A departing car keeps its bay reserved until it has left the bay mouth. Arrivals get priority on overlapping mouths. This fixed a seed-42 deadlock.
  3. Walkers stop 0.6 m back from the kerb, and cars stop short of zebras. This removes standoffs where each side waited for the other.
  4. The walk line moved to z 4.05 so it passes south of the queue stanchions.
  5. Empty instanced meshes keep count >= 1 so the registry coverage check stays happy. They are hidden, so they cost no draw call.

## Deliver
- Commits on `village/grok-fairlot` (local only).
- Stills `shots/grok-fairlot/{before,after}-*.png`.
- Results:
  - `audit:roads`: 0 open.
  - `sim:collisions`: all zero.
  - Draw-call delta for the lot from the shot tool.
  - All tests pass.
- CHANGELOG entry.
