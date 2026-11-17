# Astra: one town, shared systems

Round 2 integrates all five descendants of `832eacf` into the nine-district town at `f67b40d`. The merge retains each source commit as a parent: life `16487bf`, light `5028e5c`, camera `1ee2e12`, catalog `f22fbc5`, traffic `7ba279f`.

The compiler still owns the district layout. The new western road circuit runs around Sunbeam's pedestrian court, through Civic Green, past the gardens and Union Station. Two buses serve nine stops, alongside cars, delivery vans and cyclists: 21 moving vehicles. Cars stay off the river footbridges and the terrace court. Closely spaced corners share one junction reservation so a pedestrian delay cannot leave the bus and an oncoming cyclist holding adjacent intersections. Traffic follows the new resident waypoint format, predicts pedestrian motion, and also yields to civic actors and service vehicles.

All forty named neighbours use the life executor. The eight terrace residents retain their actual homes and roles. The six West Works employees have distinct graph-connected workstations; production requires a real `work` action there. Alma works at the civic library, Fern at the clinic, and Otis covers the overnight clinic shift. Household errands are staggered. Games wait for reserved participants who are still arriving, with a bounded timeout. Closing-time decisions and numerical walking-step overshoot are covered by the routine tests. There is no resident dialogue or speech-bubble system.

The measured catalog is retained in full: 561 runtime models and 86 alternate exports, with source hashes, measured bounds, tags, groups and affordances. Ten compiled scenes provide fourteen enabled activity slots across all nine districts. Seven rest gardens are selected deterministically beside real streets; their measured parcels, props and complete approaches must clear buildings, venues, other scenes, streets and water. They reserve their footprints before foliage and other furnishings. The three original camp, harvest and tea recipes are retained. Named residents own their reservations; the catalog's separate demonstrator actors are disabled in the town. The catalog gallery remains available at `/catalog.html`.

Day-cycle lighting is registered after all districts, residents, props and vehicles are built. Camera controls preserve all district views, true isometric elevation, cursor-anchored zoom, touch gestures, four quarter-turns, shared URL views and resident/building inspection. Traffic inspection has moving selection bounds. Overview framing fits the expanded island and refits after rotation or viewport changes. The minimum zoom is now 0.35 to accommodate the full town on phones.

## Interfaces for the next merge

- Add district geometry before `createAstraLighting`, or call `lighting.register(root)` after adding it.
- `town.interactions` contains the catalog's measured 3D activity slots. `buildLifeRegistry` adapts these to the executor's world-space 2D places and also accepts `town.registry.places` / extra places. Invalid metadata is rejected.
- Resident `route` entries are `{pos:[x,z], node?}`. Read `person.actor.action`, `person.context`, and `person.object.position`; they are no longer arrays of node indices.
- `person.home` is a place ID. `person.workplace` retains the six Works renderer assignments. Other jobs live in `context.job.workplace`.
- A moving vehicle's pick record includes `bounds` and `object`; selection updates the bounds each frame.
- Simulation pause freezes all existing district animations, life, production and traffic. Clock controls call the same `setHour` adapter.
- Authored district offsets remain centralized in `astra-placement.js`; no later-round districts are included here.

## Verification and evidence

`npm run test:astra` covers 47 tests, including 100 seeded layouts, all-pairs destination reachability, natural daily routines, exclusive prop use, six workstations, all nine catalog districts, lighting continuity, camera links, nine bus stops, and fifteen minutes of vehicle footprint separation, recovery from pedestrian delays at the terrace switchback, and bus coverage with all forty residents moving. `npm run build` builds the production preview without copying licensed assets. `npm run test:astra:integration` exercises real browser input, touch, URL reload/Back, picking, follow mode, mobile layout, work production, pause and lighting.

Progress captures are `shots/astra/45–49`; browser evidence is in `round2-camera-evidence.json` and `round2-integration-evidence.json`. After the local merge commit, `npm run shots:astra:round2` captures day, golden hour, night and district close-ups (`50–63`), and `npm run film:astra:round2` records the 24-second tour (`64-astra-town-tour.mp4`). The preview uses port **5173**.

Licensed source models remain outside Git in the private asset library and ignored `public/licensed` link. Inventory metadata and rendered evidence are committed; raw models are not.
