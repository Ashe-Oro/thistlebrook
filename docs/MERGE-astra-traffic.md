# Astra traffic — merge notes

This branch adds 16 moving road users: ten cars, two postal vans, one town
bus and three cyclists. Three parked cars occupy marked bays on existing
street stubs. Eight zebra crossings, five gold bus-stop signs and muted
asphalt/dashed centre lines make the road network visible at town scale.
The bus doors open during its seven-second stop; vans pause for unloading
and display a parcel. Cyclists ride the owned Cozy Village bicycle with a
posed, pedalling rider. Click a moving vehicle for its route/activity card.

## Files and integration

- `src/astra/traffic-simulation.js` is pure JavaScript: road selection,
  directional rounded lane paths, route data, right of way, following,
  stops and bounded diagnostic counters. It does not mutate the town.
- `src/astra/traffic.js` owns all traffic rendering, licensed bicycle loading,
  picking, and the adapter from existing residents to pedestrian positions
  and predicted velocities. Street geometry is merged by material.
- `tests/astra-traffic.test.mjs` tests the simulation without WebGL/assets.
- `tools/shots-astra-traffic.mjs` tests and captures the actual browser runtime.
- `shots/astra-traffic/` contains before/after, town, campus, quay, evening,
  mobile and route-card captures, plus `evidence.json`.

Only `src/astra/main.js` changes in shared code. When resolving its conflicts,
retain these hooks alongside other branches' systems:

```js
import { createTraffic } from './traffic.js';
// After world and residents exist:
const traffic = await createTraffic(scene, town, residents);
// In the existing unpaused simulation block, after residents.update(...):
traffic.update(dt * speed);
// Include traffic in window.__astra and traffic.audit() in its audit result.
```

The existing `pick()` also compares `traffic.pick(raycaster.ray)` against the
nearest building distance, and the pointer handler displays traffic's
`data.name`, `data.detail`, and `data.story` through the existing UI card.
No CSS, catalog, compiler, world, civic, resident or package files changed.
The user's pre-existing `ASTRA.md` and `astra-out.txt` edits are not committed.

## Roads, stops and right of way

Routes are authored loops checked against the compiled road geometry. Only
unowned lane/avenue roads at least 2.4 units wide are eligible, clipped north
of z=4. Vehicle centres use a 0.7-unit right-side lane offset; turns are
sampled curves instead of instantaneous right angles. Reversed loops use
the opposite lane. Cars follow shops, west, north and east district loops.

Route 1 connects **High Street → Campus & courts → Lantern Quay → Market
Square → Town Hall → High Street**. The campus stop is on the broad street
at the south entrance to the sports grounds, connected to the school's
existing walking paths. The existing yellow school bus in `civic.js` remains
a parked campus prop. The moving town bus is separate.

Vehicles accelerate, brake for the car/cycle ahead, reserve junctions and
bends before entering, and hold back far enough for turning vehicles to
clear. Pedestrian positions and short velocity predictions take priority
anywhere on the lane, including the marked crossings. Movement is substepped
at at most 1/30 second; the town's pause and 1×/3×/8× speed controls apply.

The wooden river bridges, door approaches, courts and narrow campus paths
remain pedestrian routes. Parking uses the existing west Main Street and
northwest street stubs. Bus signs sit just inside the existing road edge,
so the system does not widen roads into seeded building or tree parcels.

## Integration with the life / registry branches

The resident adapter expects `residents.people`, each with `object.position`,
`route` (town node indices), `wait`, and `speed`, plus `town.nodes`. If life
changes this shape, adapt the short `traffic.update()` pedestrian mapping;
the pure simulation accepts `{x, z, vx, vz}` records. Include any additional
pedestrians that can enter motor lanes in this mapping. Existing authored
court/fountain activity figures remain inside their venues.

`simulation.stops` exposes stable IDs, names, points and curb directions;
`simulation.crosswalks` exposes points and road axes. These are suitable
registry inputs. Vehicle `kind`, `route`, `position`, `status`, `stoppedAt`
and `visits` are available through `traffic.simulation.vehicles`.

If the road topology changes, adjust the loop anchors in the simulation.
The compiler check deliberately rejects a route that no longer lies on a
motor road instead of silently driving through a building. This is an
ambient transport simulation: parked cars do not yet search for spaces,
bus stops do not transfer residents into passengers, and deliveries do not
change a shop inventory. No dialogue is added.

## Assets and checks

The only additional private asset dependency is the already-catalogued
`cv-bicycle`, served through the existing `public/licensed` mapping to the
owned library. Vehicle bodies/riders/signs are procedural toon geometry.
No licensed model files or library copies are committed.

```sh
npm run dev -- --port 5191 --strictPort
node --test tests/astra-traffic.test.mjs
npm run test:astra
npm run build
node tools/shots-astra-traffic.mjs
```

The seven simulation tests cover road envelopes over multiple seeds,
repeated service at all five stops, deliveries, dwell/departure, pedestrian
priority and resumption, car/cycle following, deterministic runs, missing
road rejection, and oriented vehicle footprint separation at bends/merges
through fifteen simulated minutes. The browser runner checks actual bus
arrivals among the 32 residents, pedestrian yielding, delivery stops,
pause/resume, 8× speed, bus pointer selection and desktop/mobile rendering.
The latest browser evidence and its counters are in
`shots/astra-traffic/evidence.json`. Build warnings about chunk size and the
existing mixed dynamic/static `iso-interact.js` imports are unchanged.
