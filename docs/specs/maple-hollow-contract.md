<!-- OWNER: opus-suburb lane. Component contract for Maple Hollow. -->
# Maple Hollow: component contract

Each component owns its files (an `OWNER: opus-suburb lane` header on every new file). Shared files get small, commented hooks only. The town keeps running at every step: `compileWorld` must pass `checkWorld`, and the probe (`tools/probe-maple-hollow.mjs`) reports on every build.

| Component | Owns | Reads | Writes into shared code |
|---|---|---|---|
| **Streets** | `src/astra/maple-hollow-plan.js` (`STREETS`, `addMapleHollow`, `flagMapleHollowRoads`) | `src/roads/regional.js` (planner) | `compileWorld` calls; `planLandscape` ignores `r.mapleHollow` roads; `landscape.js` skips drawing them |
| **Lots** | `maple-hollow-plan.js` (`planMapleHollow`, `LOT_SPECS`, `FOOT`, palettes) | — | `town.buildings` (kind `home`, `custom`), door paths (`kind: 'door'`) |
| **Props** | `maple-hollow-plan.js` (props, surfaces), `src/astra/maple-hollow-assets.js` (`SUBURB_MODELS`, material, `suburbBatch`) | the pack in `public/licensed/suburban-neighborhood/` | — |
| **Vehicles and bus** | `maple-hollow-plan.js` (`BUS`, `busRoute`, `MAPLE_HOLLOW_BAYS`, `MAPLE_HOLLOW_CROSSWALKS`) | `src/roads/regional-traffic.js` | `PARKING_BAYS` / `CROSSWALKS` spread in `traffic-simulation.js`; scheduled-vehicle support and `transit` in `regional-traffic.js`; `traffic.js` skips `mapleHollow` bays and crossings |
| **Life** | `MAPLE_HOLLOW_RESIDENTS`, `BBQ_HOSTS`, `addMapleHollowPlaces` (stops, yards, BBQ decks) | `src/astra/life/*` | roster and schedule in `profiles.js`; commute rule and private places in `planner.js`; `setTransit` (board and alight) in `runtime.js`; yard poses in `visuals.js`; kid scale and hidden riders in `residents.js` |
| **Lighting and skins** | `maple-hollow.js` (window `mhLit`, lamps, pools), `maple-hollow-assets.js` (shader hook) | `lighting.js` registration, the skin `material.js` window hook | none: Maple Hollow windows reuse the world.js hook string, so every skin restyles them |
| **Render** | `src/astra/maple-hollow.js` | everything above | `world.js` builds and updates it; `main.js` wires transit and the audit |
| **Probes and tests** | `tools/probe-maple-hollow.mjs`, `tests/maple-hollow.test.mjs`, `tools/shots-opus-suburb.mjs`, `tools/film-opus-suburb.mjs` | — | `tools/sim-collisions.mjs`: transit and riders |

## Interfaces

- **`town.mapleHollow`**: `{lots, props, bays, crosswalks, surfaces, streets, routeGroups, nodes, bus: {route, stops, runs, depot}, residents, bbqHosts}`. Lots carry `key, house, palette, houseAt, houseYaw, door, node, parts {house, driveway, lawn, mailbox, bins, plaque, yard}, yard {slots, grill, patio}, around`.
- **Scheduled vehicle** (in `createRegionalTraffic(town).transit.vehicles`): `{id, kind: 'school-bus', position, direction, doorOpen, stopAt, pickup[], dropoff[], door, stopNode, run, status}`. While `doorOpen`, it waits at least `BUS.dwell` and up to `BUS.maxDwell` seconds while `transit.pending(stopId) > 0`.
- **Life transit** (`life.setTransit(transit)`): commuters (`context.commute`) waiting at an open-door pickup stop board, and riders whose run drops off at that stop alight at `door`. Riders are hidden, skip planning and are never counted as pedestrians.
- **Private places**: `interaction.residents` lists who may use a yard, deck or stop. The planner's `available()` and the executor's `walkTo` both enforce it.

## Targets (reported by `tools/probe-maple-hollow.mjs`)

20–30 lots, each with a house, driveway, lawn, mailbox and bins · at most 150 added draw calls at the site view · at most 3 MB added first load · `audit:roads` 0 open · `sim:collisions` all zero · the full suite passes · 60 fps on a mid-range laptop isn't regressed.
