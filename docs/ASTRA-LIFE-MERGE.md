# Astra life: merge notes

This branch implements the revised **environment interactions, no conversations**
scope. All 32 named residents use a deterministic scripted planner over a typed
context. There are no speech bubbles, dialogue trees, network/model calls, API
keys, tokens, or token economy. `talkTo` remains in the requested tool-name union
for compatibility and is explicitly rejected by the executor.

## Merge surface

Most code is new under `src/astra/life/`. The existing compiler, graph, catalog,
world registry for legacy village routes, district layouts and asset library are
unchanged.

- `src/astra/residents.js` becomes the small Three.js adapter for the life runtime.
  It retains `people`, `update(dt,t,hour)` and `pick(ray)`. Existing fields
  `name`, `role`, `object`, `node`, `route`, `destination`, `visits`, and `activity`
  remain available. `route` now contains waypoint records, `home` is a place ID,
  and `destination` is a life registry record with the original graph `node`.
- `src/astra/main.js`: pass the initial hour into `createResidents`, synchronize
  `residents.setHour` in both time-setting callbacks, create/update the small
  `createLifePanel` extension, and call
  `world.districts.civic.setActivityOwner?.('baseball',true)`.
- `src/astra/civic.js`: a small `setActivityOwner` hook hides the old eight ambient
  baseball players and their unrelated ball while residents own that activity.
  Preserve this hook when merging other civic changes. Other background sports,
  spectators and fountain extras remain the pre-existing scenery animations.
- `src/astra/ui.js`: change the footer hint from “say hello” to “follow a neighbour”.
- No package.json, Vite configuration, lockfile, compiled map or licensed assets
  are changed. Dev/capture commands use **5184 only**.

The two new small furnishings are on the existing fountain parcel: a picnic
table and a chess table. `visuals.js` draws these; `registry.js` supplies matching
world-space anchors. If another branch supplies those furnishings, override the
records with the same IDs (`life:picnic`, `life:chess`) to suppress these default
meshes and use the other branch's geometry. Do not draw both sets.

## Runtime and brain boundary

`createLife(town, { hour, places, brain })` is independent of Three.js and DOM.
`createResidents(scene,town,options)` accepts those same options. The default
brain is `scriptedPlanner`; `life.setBrain(replacement)` replaces it. A brain is a
synchronous function from an immutable, JSON-only snapshot to one action or null.
A future asynchronous integration can maintain a queue and return its next
validated action from this boundary; there is no model integration here.

```js
{
  tool: 'walkTo',
  args: { target: 'life:picnic', slot: 'north' },
  reason: 'A useful place to pause along the route'
}
// After arrival, a separate action:
{
  tool: 'eat',
  args: { target: 'life:picnic' },
  reason: 'Make time for a packed lunch'
}
```

The supported action names are `walkTo`, `talkTo` (disabled), `work`, `buy`,
`sell`, `payBill`, `rest`, `eat`, `visit`. `visit` uses the target's activity
metadata, so playing chess/baseball does not require adding another tool.
Arguments can only contain the string fields `target`, `slot`, `activity`,
`item`, `bill`; callers cannot choose prices, wages, movement speed or duration.
`execute(residentId, action)` returns `{ok,error?}` and checks location,
capabilities, opening hours, reservation ownership, inventory, bills and money.
The planner cannot mutate world state: every snapshot is a deep-frozen copy.
Passive needs decay and the shared clock are maintained by the executor.

`types.d.ts` defines `ResidentContext`, `PlanningContext`, `Brain`, `Action`,
`Place`, `Interaction`, and `InteractionSlot`. The profile factory and scripted
planner also have checked JSDoc types. Context includes job and shift, personality,
integer-cent money, bills, a real home assignment, inventory, relationships,
energy/hunger/recreation, schedule, bounded memory, and physical location.
Relationships grow from shared activities; familiar participants influence which
occupied game a resident joins. No conversations are simulated.

Routines include home breakfast, the assigned workplace/school, packed lunches,
stocking food, delivering produced goods, household bills every three days,
afternoon leisure, evenings at home or the quay, and home after 22:00. Daily
variation is seeded. Work produces bounded wages/goods; this is household state,
not a full market simulation. Poor residents can eat from their home pantry.
Nothing persists across a page reload.

## Interaction metadata contract for the registry job

Attach an `interaction` object to a **unique placed prop record**, not a reusable
catalog asset ID. All anchors are **absolute world coordinates**; transform model
local offsets by placement rotation/scale before exporting. Coordinates use XZ
pairs, yaw uses radians, and world +Z is forward. Heights are world Y metres.

The runtime reads records from these sources (later records override matching IDs):

1. Its adapter's building/venue/bench/furniture defaults.
2. `town.registry.places` records carrying `interaction`.
3. `options.places` records carrying `interaction`.
4. `town.props` instances carrying `interaction`, identified by `key` when given.

The existing legacy `src/world/registry.js` is deliberately untouched. The separate
registry branch can populate `town.registry.places` or pass its exported records
through `options.places`; no planner change is needed. The public adapter is
`buildLifeRegistry(town, extraPlaces)`. It rejects malformed interaction metadata
into `registry.rejected` instead of silently reserving or walking to bad anchors.

```js
{
  id: 'park:picnic-table:03', // stable placement ID
  name: 'Orchard picnic table',
  pos: [12, 18],            // world XZ centre; cosmetic/query position
  interaction: {
    version: 1,
    activity: 'picnic',     // sit | picnic | chess | baseball | browse | work | sleep
    label: 'Lunch in the orchard',
    tools: ['eat', 'rest', 'visit'],
    duration: 32,          // simulated seconds; 2..600
    minParticipants: 1,    // independent use; chess = 2, baseball = 3
    hours: [6, 22],        // 24-hour clock; [0,24] always open, [20,4] overnight
    entryNode: 123,        // REPLACE with a real connected Astra graph node
    approach: [[12,20],[13.5,18]], // graph entry → safe circulation area
    slots: [
      {
        id: 'south',       // unique within this prop; one resident per slot
        kind: 'seat',      // seat | standing | player
        position: [12,19],
        facing: Math.PI,
        seatHeight: 0.49,  // required for seats; world seat surface
        animation: 'sit',  // sit | eat | chess | pitch | bat | field | work | idle
        approach: [[13.5,19]] // circulation area → seat; final position is appended
      }
    ]
  }
}
```

**Navigation authoring responsibility:** the registry/district owner must provide
collision-free `approach` polylines, including gates, stairs/frontages, circulation
around a table, and separate seat approaches. Schema validation checks values;
it is not a navmesh or a general prop-collision solver. The executor first follows
the compiler's weighted shortest path to `entryNode`, then the common approach,
then the slot approach and exact slot position. Departure retraces that local
path before using the street graph. It never snaps a remote resident to a prop.
The default bench adapter additionally rejects spurs through buildings, venue
boundaries, trunks, nearby props or water. Only two of the existing compiled
benches pass that conservative test on seed 831; future explicitly tagged
benches can provide authored access paths for the others.

Slots reserve atomically when `walkTo` is accepted; a full prop causes rejection
and the scripted planner chooses a different stop. Reservations include walkers
on the way. A resident can opportunistically reconsider a route only at a reached
street-graph node, never in the middle of an edge. Reservations release on the
next accepted departure; approaches are retraced at walking speed. Road traffic
uses the existing graph without a crowd avoidance solver. Missing partners wait
up to 130 simulated seconds, then give up and return to their routine.

For **chess**, provide exactly two seats with roles `white` and `black`,
`minParticipants:2`, and `activity:'chess'`. Both residents must physically arrive
and start `visit`/`rest` before the board advances. A shared 50-second opening
study plays ten legal half-moves, including the castling rook movement, then
resets. It is an authored opening exercise, not a chess AI. Longer durations
round up to whole 50-second studies.

For **baseball**, provide exactly three `player` slots with roles `batter`,
`pitcher`, `fielder`, animations `bat`, `pitch`, `field`, and
`minParticipants:3`. Also provide:

```js
game: {
  bases: [[-22,-73],[-14,-81],[-22,-89],[-30,-81]], // home, first, second, third
  mound: [-22,-81],
  field: [-13,-93] // fielding target inside the outfield
}
```

The shared 36-second practice drill winds up, pitches to home, hits a ball into
the outfield, fields it, returns it to the mound, and runs the batter through
first/second/third/home in order. The default session is three repetitions
(108 seconds). Durations round up to complete repetitions so actors do not leave
mid-pitch. This is three-person batting practice, not a scored nine-a-side game.
Each participant's `visit` action owns the activity; the renderer samples the
same group clock for the players, bat and ball. Navigation location remains the
reserved role anchor while the sport animates, and a completed drill ends at
that anchor before departure. Do not reuse the baseball animation on another
field without transforming all of its game coordinates and access paths.

For custom `sit`/`picnic` props, the renderer uses private geometry copies to bend
the owned rigid character model at hips/knees, aligns it to the slot, and restores
the original shared geometry when it leaves. The renderer does not mutate cached
licensed meshes. Custom geometry remains the responsibility of the registry or
district renderer; only the two built-in `furnishing` defaults draw new furniture.

## Inspect and verify

The live inspector is `window.__astra.residents.life`. Useful fields are
`actors`, `registry`, `reservations`, `games`, and bounded `events`.
`life.audit()` returns JSON evidence; `life.snapshot(actor)` shows the exact brain
input. Individual people expose `.context` and `.actor.history`. Only developer
inspection exposes action traces; the normal resident card shows current
activity, needs and a short itinerary.

```sh
npm run dev -- --port 5184 --strictPort
node --test tests/astra-life.test.mjs
npm run test:astra
npm run build
node tools/shots-astra-life.mjs
# Optional isolated type check, without adding a repository dependency:
npm exec --yes --package typescript -- tsc --allowJs --checkJs false --noEmit --strict --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/astra/life/planner.js src/astra/life/profiles.js
```

Validation: nine lifecycle tests cover immutable brain inputs, unknown/disabled
and unaffordable actions, single-owner seats, departure paths, integer money and
one-time bill payment, waiting for a second chess player, baseball phases and
base order, deterministic multi-day routines, no navigation teleports, midnight
and manual time changes, and three additional map seeds. The five existing Astra
tests pass, including the 100-seed map sweep. The build passes with its existing
large-bundle/dynamic-import warnings. Planner/profile strict type checking passes.

`shots/astra-life/` contains six browser screenshots and `evidence.json`. The
capture advances the **normal planner**, without teleporting actors, filling
inventory, changing needs or forcing activity calls. It checks real pointer
selection, the speed controls, live context cards, natural meal/chess/baseball
arrivals, pause, follow, mobile card bounds and nighttime home returns. All 32
residents returned home in the captured night check; the browser reported no
errors. Raw assets remain in the existing ignored private mapping.
