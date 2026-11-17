# Starbase Texas — merge notes

A separate coastal district east of Lantern Quay, with two launch complexes,
two concrete Falcon landing zones and an offshore autonomous drone ship.
Open `http://localhost:5198/?view=starbase&seed=831`. The **Starbase Texas** tab
and five local camera buttons also reach it. Existing pause, speed, lighting,
pan, zoom and selection controls apply. No NPC dialogue was added.

## Merge surface

All district implementation is isolated in these new files:

- `src/astra/starbase.js`: coastal terrain, Highway 4, architecture, tower,
  moving chopsticks, plumbing, ship, tug, transporter, licensed townsfolk,
  local paved routes, pooled exhaust/smoke and selectable locations.
- `src/astra/starbase-models.js`: shared toon primitives, reusable rocket
  models, four grid fins, four Starship flaps, deployable Falcon legs,
  exhaust and static instancing.
- `src/astra/starbase-flight.js`: pure deterministic 192-second flight clock,
  stage positions, deployment states, recovery targets and camera presets.
- `src/astra/starbase-ui.js` and `starbase.css`: appended district tab,
  flight status and local view controls.
- `tests/astra-starbase.test.mjs`: flight profiles, separation/catch/landing
  continuity, clock repeatability and waypoint path invariants.
- `tools/shots-astra-starbase.mjs`, `tools/film-astra-starbase.mjs`: browser
  verification and evidence generation; both exclusively use port 5198.

Only two existing source files are edited:

1. `src/astra/world.js` imports/builds Starbase, merges its selectables, exposes
   `world.starbase`, and updates it with the shared elapsed clock.
2. `src/astra/main.js` imports the camera presets and UI, admits the new query
   views, extends the camera pan ceiling to x=285/z=140, adds the selection
   badge, updates the panel, and displays the current flight in the moment box.

No compiler, navigation graph, existing district placement, asset registry,
package scripts or Vite configuration is changed. Keep other agents' additions
when resolving the two integration points. Existing **The town** overview
continues to frame the nine original districts; **Whole coast** frames Starbase.

The district's root is at world `[145, 0, 50]`. Its coastal shelf occupies
approximately world x=81–213, z=-6–130; the sea extends to x=286.
The causeway starts at the existing road endpoint `[46,30]`, turns south to
`[46,38]`, skirts the bandstand, then reaches Highway 4. Visitors walk this
connection. Local workers use paved routes behind the closed range gate;
the transporter shuttles between the Megabay doorway and its pad-side staging
lane. These are deterministic local activity routes, not additions to the
compiler's town-wide resident destination graph.

## Visible sequence

| Seconds | Activity |
| --- | --- |
| 0–10 | Stack ready; tank farm frosting and venting |
| 10–23 | Starship stack launches through rolling exhaust |
| 23–37 | Hot staging; ship continues upward, Super Heavy returns |
| 37–47 | Chopsticks catch; booster lowers and rolls clear on a recovery dolly |
| 47–62 | Ship returns broadside with black heat shield and four flaps |
| 62–69 | Ship relights, flips upright and recovers onto the cleared mount |
| 69–80 | Both stages recovered |
| 80–100 | Falcon 9 count and liftoff |
| 100–116 | Stage separation and offshore booster landing, legs deploying |
| 116–134 | Booster remains fixed to drone-ship deck during the tow to port |
| 134–154 | Falcon Heavy-style three-core count and liftoff |
| 154–172 | Side boosters separate and descend together |
| 172–184 | Both side boosters upright on LZ-1 and LZ-2 |
| 184–192 | Tower raises Starship; Super Heavy rolls back beneath it to restack |

At the loop boundary, Falcon vehicles are replenished for the next demonstration.
Upper Falcon stages continue offscreen; the reusable Falcon first stages recover.
This is a compressed, authored diorama, not an orbital mechanics simulation.
The combined Falcon/Starship site is intentionally fictional: the Texas coast
and Starbase structures are paired with Florida-style Falcon recovery facilities.
Distances and turnaround times are compressed so every requested activity can
be watched in one district. Starship's return is the requested authored sequence,
not an attempt to reproduce a particular real test flight.

## Research references

- [SpaceX Starship](https://www.spacex.com/vehicles/starship/): vehicle identity,
  stainless body, Super Heavy/ship configuration and reuse concept.
- [SpaceX Falcon payload guide, May 2025](https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf):
  Falcon proportions, grid fins, landing legs and vehicle configuration.
- [NASA: Falcon Heavy side boosters stick the landing](https://science.nasa.gov/blogs/goes/2024/06/25/falcon-heavy-side-boosters-stick-the-landing/):
  near-simultaneous landings at LZ-1 and LZ-2 in Florida.
- [FAA: SpaceX Falcon program](https://www.faa.gov/space/stakeholder_engagement/SpaceX_Falcon_Program):
  distinguishes Falcon launch/recovery sites from Starbase.
- [NASASpaceFlight: Pad B's major milestones](https://www.youtube.com/watch?v=P5vt3ejB7eo):
  tower chopsticks, tank farm and flame-trench construction.
- [NASASpaceFlight: Goodbye High Bay + Hello Pad B Flame Trench](https://www.youtube.com/watch?v=AiADMTDkHwQ):
  build-site and flame-trench visual reference.
- [Tiny Las Vegas](https://tinylasvegas.com): requested isometric pan/zoom
  diorama reference; the research fetch could not read this site.

## Assets and validation

Owned `townsfolk-farmhand`, `elder`, `merchant`, `child`, `innkeeper`,
`cv-bench` and `cv-tree-fruit` assets use the existing private catalog mapping.
No raw licensed assets or new asset copies are committed. All spaceflight and
industrial models are native Three.js geometry with the existing toon ramp.
Static geometry is instanced and smoke meshes are reused.

```sh
npm run dev -- --port 5198 --strictPort
node --test tests/astra-starbase.test.mjs
npm run test:astra
npm run build
node tools/shots-astra-starbase.mjs
node tools/film-astra-starbase.mjs
```

Evidence is in `shots/astra-starbase/`: twelve desktop/mobile captures,
`evidence.json`, and `13-launch-and-return.mp4`. The film shows launch, tower
catch, ship return, offshore touchdown/tow and synchronized land recovery.
The browser runner checks errors, actual pause/resume, navigation button,
pointer selection and mobile rendering. Unit tests verify the continuous flight
boundaries and exact deck attachment throughout towing. The existing town
suite includes its 100-seed placement/navigation sweep.

Pre-existing `ASTRA.md` changes and untracked `astra-out.txt` belong to the task
setup and are intentionally excluded from this commit.

Final verification: 14 existing town tests and 4 new Starbase tests passed;
production build passed (existing chunk-size/dynamic-import warnings only).
The final browser evidence contains zero console/page errors. The MP4 is
24.75 seconds, H.264, 1280×900, 12 fps / 297 frames and decodes without errors.
