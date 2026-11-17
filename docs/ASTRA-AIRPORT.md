# Astra Municipal Airport — merge notes

Airport contribution on the `astra-airport` worktree. Open
`http://localhost:5193/?view=airport&seed=831`, or choose **Airport** in the view tabs.

## What is here

An eastern airfield with a commercial twin-engine airliner, two high-wing light
planes and a helicopter, all built as original toon geometry. The airliner has
retracting landing gear, cabin windows and underwing engines; the light planes
have spinning propellers and fixed landing gear. The helicopter has animated main and tail rotors.

Fixed-wing traffic repeats a 210-second circuit: stand service → pushback →
taxi out → takeoff → climb → town flyover → approach → landing → rollout →
taxi in. Three staggered slots keep the runway exclusive. Aircraft stay in the
scene for their entire circuits: no disappearance or position reset at an edge.
The helicopter repeats a separate 100-second vertical lift, town patrol and
vertical landing circuit. All motion uses the town simulation's elapsed time,
so pause and 1×/3×/8× controls apply to aviation too.

The airfield includes a glass-front terminal, tower with rotating radar, club
hangar, stands, runway markings and edge lights, helipad, windsock, perimeter
fence, parking and a landside connection to the existing road at (46, -33).
Owned benches and six owned character models appear around the terminal.
Passengers walk the stand approach during commercial ground service; a baggage
tug circulates on the terminal side. These are local activity actors, not new
members of the town's resident graph.

## Files and merge hooks

All new rendering and traffic logic lives in `src/astra/airport/`:

- `traffic.js`: parcel/view constants, fleet definitions, pure deterministic
  flight sampling. Uses Three vectors/curves but needs neither DOM nor WebGL.
- `aircraft.js`: original aircraft and helicopter geometry.
- `index.js`: airfield scene, private props/people, animation and audit API.

Three shared files have small additive changes:

1. `src/astra/world.js`: import and await `buildAirport(scene)`; add airport
   selectables; expose `world.airport`; call `airport.update(t, night)`.
2. `src/astra/main.js`: register `airport: world.airport.view`; allow
   `?view=airport`; handle terminal selection; expand camera pan bounds to
   x=146 and z=-113.
3. `src/astra/ui.js`: append the Airport view button.

No compiler, catalog, resident-routing or global CSS changes. The existing
compiler's six districts, 26 buildings and eight venues remain intact. This
module supplies a separate parcel x=[65,146], z=[-113,14], touching the original
island at x=65. Reserve that area when combining other expansions. Flight
circuits extend roughly to z=-195 and z=128, with town flyovers at y=34–43;
helicopter patrol is lower, y=14–29. Future tall buildings should be checked
against these routes. The existing overall town view is unchanged; the Airport
tab frames the new district.

The airfield is an authored activity simulation, not a flight simulator or a
reactive air-traffic controller. A compiler-level airport destination and town
resident travel to the terminal are follow-up integrations for the lead.
Private assets remain referenced through the existing `place()` loader; no GLBs,
source-library files or new private mappings are committed.

## Verification and evidence

```sh
npm run dev -- --port 5193 --strictPort
node --test tests/astra-airport.test.mjs
npm run test:astra
npm run build
node tools/shots-astra-airport.mjs
node tools/shots-astra-airport.mjs --film
```

`shots/astra-airport/` contains screenshots, browser audit JSON and the MP4.
The capture runner always uses port 5193 and an isolated browser with manual
simulation advancement. Its 16-second film compresses several flight phases;
it is a directed capture, rather than a real-time 1× screen recording.
Intermediate frames are ignored and removed after encoding.

The numerical checks sample two whole traffic periods, checking continuous
positions, finite coordinates, ground clearance, periodicity, actual town
flyovers, aircraft separation, every flight phase, exclusive runway occupancy,
and the helicopter's vertical pad arrivals/departures. Browser checks cover
asset loading, tab navigation, terminal selection, speed controls, all flight phases, pause/resume and day/night
rendering; a mobile screenshot is included. The original 100-seed town suite
and production build also pass. Existing Vite warnings concern bundle size
and an older mixed static/dynamic import in `iso-interact.js`.
