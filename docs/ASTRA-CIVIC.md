# Civic Green

Open `http://localhost:5181/?view=civic&seed=831` or choose **Civic Green** in the view tabs. Use **3pm** for the outdoor reading circle and the moon for evening. The server for this worktree uses port **5181** only:

```sh
npm run dev -- --port 5181 --strictPort
node --test tests/astra-civic.test.mjs
npm run test:astra
node tools/shots-astra-civic.mjs
npm run build
```

The northwest district adds Station 01, Willow Community Clinic, Civic Library, a neighbourhood police post, and Willow Park. Architecture and five vehicles are procedural toon geometry; the 18 local people, trees, benches and three pond ducks use the existing owned asset mapping. No licensed models are copied into source or build output.

The park has a walkable circuit, pond, story circle, play structure and picnic area. Every service entrance joins the same pedestrian graph as downtown and the campus. Existing residents can visit all five destinations; Alma's librarian routine now includes the library and Fern visits the clinic.

Local activity follows the shared simulation clock, speed and pause controls:

- Fire response runs on a 110-second authored cycle: ready, drive to the bin fire, assist and extinguish, return, ready. Response is available at night too. The second engine stays in its bay.
- A delivery van travels between the clinic forecourt and the downtown approach from 08:00 to 16:00. A courier carries a parcel while it is parked.
- The library's local readers appear from 08:00 to 19:00. From 15:00 to 18:00 the children and librarian walk to the park, gather, and return.
- An officer walks the civic paths. Joggers, picnickers and the play area are active from 06:00 to 21:00. Ducks circle the pond.

These are authored vignettes, not a healthcare model, economy, traffic solver or stochastic emergency simulation. Local activity actors are distinct from the 32 named, selectable residents; the five facilities are selectable.

## Merge points

Most implementation is isolated in three files:

| File | Responsibility |
| --- | --- |
| `src/astra/civic-quarter-plan.js` | District bounds, venue parcels, connected roads, stories, camera preset |
| `src/astra/civic-quarter.js` | Architecture, owned model instances, moving vehicles, local activity, selection bounds, audit |
| `src/astra/civic-quarter-life.js` | Pure time/route helpers and service schedules |

The compiler invokes `planCivicQuarter(town)` before venue approaches and reservations. The plan fills the former northwest notch and extends the island to x = -104; it preserves the river's original extent separately from the expanded map bounds. `world.js` builds and updates the district. Small hooks in `main.js` add the civic camera, bounds-aware panning, venue descriptions and local happenings. `ui.js` adds the view tab, dynamic district count, and scrolls the selected tab into view on narrow screens. `residents.js` adds two workplace destinations.

The town now reports 7 districts, 13 public venues, and the unchanged 26 kit building parcels. The four new service buildings are public venue parcels, like the existing school. Compiler assertions and the existing expansion capture expectations have been updated accordingly; adjust totals when combining other district branches.

## Evidence

`shots/astra-civic/00-before.png` records the original town. Captures 01–07 show morning, response, library/park, afternoon, the connected town, evening and mobile. `evidence.json` records browser checks, zero console errors, actual resident arrivals at all five destinations, and activity state. The capture runner uses only port 5181 and does not change other districts' screenshots.
