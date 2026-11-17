# Merrymead Park / fairground merge notes

This branch adds a seventh district with six accessible venues, an animated
Ferris wheel and carousel, three owned market stalls serving food, an evening
bandshell, picnic tables and lawn, and seven owned duck models in a pond.

## Run and inspect

Use port **5189** for this worktree:

```sh
npm run dev -- --port 5189 --strictPort
# http://localhost:5189/?view=fair&day=5&hour=16&seed=831
node --test tests/astra.test.mjs tests/astra-fair.test.mjs
node tools/shots-astra-fair.mjs
npm run build
```

The first progress capture and final daytime, evening, close-up and mobile
captures are in `shots/astra-fair/`. `evidence.json` records arrivals, activity
occupancy, weekly demand, closing, pause/resume and browser errors.

## Files and small integration hooks

- `src/compiler/astra-fair.js`: district declaration, six parcels, street
  connections, `FAIR_VIEW`, and pure `fairSchedule(day, hour)`.
- `src/astra/fairground.js`: rendering and ride/pond/stage animation; static
  meshes are batched, all models load through the existing private catalog.
- `src/astra/fair-life.js`: 30 additional park visitors, shared-graph routes,
  reserved activity slots, waits, food props and walking departures.
- `src/astra/fair-ui.js` and `fair.css`: the park tab and advance-day control.
- `src/compiler/astra.js`: import and call `addFairground(town)` immediately
  after the base venue declarations, before parcel/foliage reservations and
  before the pedestrian graph is built.
- `src/astra/world.js`: construct the fair, expose `world.fair`, and forward
  `(elapsed, hour, night, day)` to its update from the world update function.
- `src/astra/main.js`: import the fair view/UI, accept `?view=fair&day=5`, keep
  a Monday=0 calendar (default Friday=4), advance it at midnight, pass the day
  to world/residents, expose `__astra.day` / `setDay()`, and use venue `story`
  text for fair selection cards. Fair stats are included in the main audit.
- `src/astra/residents.js`: shared residents also choose the fair, especially
  on weekend afternoons; closed rides/food are excluded from new choices.
- `src/astra/ui.js`: district count comes from compiled data.
- Existing compiler tests and the expansion capture's count assertions change
  from 6 districts/8 venues to 7/14. Buildings remain 26. Reconcile these
  counts after other districts merge.

## Land and connection contract

Merrymead occupies the former northwest notch: approximately **x -79…-41,
 z -103…-35**. It fills the northwest outline out to `[-80,-104]` and uses an
 apron reservation to prevent random trees from landing on rides or lawns.
 `addFairground` currently replaces the base six-point L outline with its
 four-point rectangular union. **When merging other land extensions, union
 their outline changes rather than overwriting them with this base-specific
 assignment.** The bounds themselves stay unchanged on this branch.

Two connections join the existing graph:

- South gate: `[-42,-36] → [-42,-33] → [-34,-33]`.
- Campus: `[-42,-57] → [-38,-57] → [-38,-69] → [-36,-69]`.

Venue IDs are `fair-wheel`, `fair-carousel`, `fair-pond`, `fair-picnic`,
`fair-band`, and `fair-food`; district ID is `fair`. Names/types are unique.
`fair-life.js` relies on the south gate node `[-42,-33]` and its authored
activity approaches. Moving the district requires updating both files' points.
Camera bounds already include the district; the camera branch can keep its
own controls and add `fair: FAIR_VIEW` to its view registry.

## Weekly behavior

The day control advances the whole town calendar without resetting time.
Weekday rides/food run 15:00–22:00; weekend rides/food run 11:00–22:00.
Weekend 13:00–21:00 demand is 30 dedicated visitors, versus 12 during weekday
opening hours. Quiet daytime park use is 5. Weekend concerts run 16:00–21:30;
weekday concerts run 18:00–21:30. Nobody new enters after 23:00; people already
in the park finish their approach and walk out through the gate.

Dedicated visitors reserve distinct activity spots before travelling, follow
`shortestPath()` between venues, then use authored clear local approaches.
They wait at counters and rides, look at the ducks and band, and hold picnic
cups. No dialogue UI is added. Named town residents remain selectable and
can visit the same compiled venue entrances.

Ride riders and musicians are authored activity actors, not a full admission
or economy simulation: queueing people do not transfer into the moving seats.
The gondolas counter-rotate to stay upright; the ponies bob; both rides stop
when closed and all motion/visitor decisions freeze when paused.

## Assets and verification

People, trees, market stalls, benches, flowers, lamps, crates and ducks use
existing catalog IDs from the owned Cozy Village, Farm and character packs.
`public/licensed` remains an ignored local mapping into the owned library.
No raw models or library files are included in the commit. Vite's existing
`copyPublicDir: false` remains in force.

Verified: production build; all eight compiler/schedule tests including the
100-seed layout sweep; browser arrivals at all six attractions; no duplicate
activity slots; no people crossing pond water; named town resident arrivals;
walking departures; stopped closed rides; pause/resume; venue click; day
control and Sunday rollover; desktop/evening/mobile captures with no browser
errors. The build retains the pre-existing bundle-size and mixed-import warnings.
