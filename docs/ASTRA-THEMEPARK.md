# Pinecrest Adventure Park — Fairground rebuild

Pinecrest is the RollerCoaster Tycoon-style park east of town, reached by the
mountain road from Lantern Quay. The area inside the fence has been rebuilt with
the licensed **Fairground & Amusement Park** pack (`public/licensed/fairground/`,
67 models plus 6 prebuilt courts). Open `http://localhost:5207/?view=themepark&seed=831`.

The terrain, approach road, mountains, forest and shuttle buses in
`themepark.js` are unchanged. Other lanes own those systems.

## What is here

- **Entrance:** the FUN FAIR arch with turnstiles, two ticket booths with queue
  stanchions, fountains, urns, a park map, a WELCOME banner over Main Street and
  festoon lights across the plaza.
- **Paths:** every path edge is an axis-aligned run of 4 m midway tiles.
  `pathTiles()` picks the straight, corner, T or 4-way tile and its rotation
  from each tile's open sides. Plazas use the paved and plaza tiles. Every ride
  has `road_queue_lane` switchback tiles, and guests walk the zig-zag inside them.
- **Copperhead:** a closed 29-model circuit (30 kit cells; one station model
  covers two cells) built from the snap-together kit at 1.5× scale. It has a
  station, a six-piece chain lift to 21 m, a 180° turn, a long drop, a camelback
  and a return. Raised pieces stand on stacked `coaster_support` towers. Two
  trains, each three `roller_coaster_car` models, follow the rail by arc length.
  They dwell in the station, chain up the lift and roll down under gravity.
  `themepark-coaster.js` holds the piece geometry and is pure, so it can be tested.
- **Animated rides:** the merged pack meshes are split at load time into rigid
  parts using welded triangle connectivity (`splitFairground`):
  - Skyline Wheel (Ferris): 16 gondolas stay level as the wheel turns.
  - Woodland Carousel: the deck turns and 16 gallopers bob.
  - Teacup Twirl: the saucer turns and six cups spin.
  - Swingin' Pines (chair-o-plane): the canopy spins its 12 chairs up and down.
  - Pinefall: the drop tower runs load, lift, hold, drop and bounce.
  - Pine Bumpers: five pavilion cars and two loose `bumper_car` models dodge about.
  - Little Racers: five kiddie cars circle a small track.
  - Pinecrest Express: a tram shuttles along the north walk.
  - The flat rides load while stopped, ramp up, run, then ramp down.
- **Midway:** hoopla, ring toss, a shooting gallery and prize shelves face
  cotton candy, popcorn, ice cream and hot-dog stalls. The game-booth and
  food-stall prebuilt rows sit behind them. There is a Big Top at the end of the
  north walk, plus a fountain court, picnic tables, benches and bins.
- **Night:** bulb, neon, lamp-globe and glass vertex colours from the pack's day
  palette get a per-vertex `glow` attribute. After dusk they emit, with a gentle
  bulb chase, and warm light pools sit under every lamp and the big rides.
  String lights and bunting hang over Main Street, both midway streets and the
  promenade.
- **Crowd:** 180 Pinecrest guests (`themepark-guests.js`) walk the path graph
  and join ride queues. The queues are ordered and advance with 0.8 m spacing.
  Guests board when a ride dispatches (per train, per gondola or per cycle),
  ride in a real seat that moves with the ride (seated pose), then eat, play or
  watch. Before the first frame the park is pre-simulated for 160 s so it opens
  busy.

## Registry

- **Models:** every placed pack model, static or moving, is a registered model
  placement with a stable content ID (`tagDistrictModels`). They are listed in
  `district-models.json`, which is regenerated with
  `PORT=5207 node tools/capture-registry-models.mjs --write`.
- **Library inventory:** the pack is measured into the owned-library inventory
  (`assets.json`, pack `fairground`, 73 records: 67 individual and 6 prebuilt).
  `tools/inventory-library.mjs` now also reads `public/licensed/fairground`.
  The pack's assets use their own groups (`fairground-rides`,
  `fairground-midway`, `fairground-landscape`), so town vignettes never pick
  them by accident. `/owned-assets/fairground/…` serves the private copy for the
  gallery.
- **Activity points:** `PARK_ACTIVITIES` in `themepark-plan.js` is the single
  source for activity points. `registry/park-activities.js` turns it into 58
  executable, reservable places:

  | Activity | Places |
  | --- | --- |
  | `ride` | 9 rides; residents get their own seats, the highest seat numbers |
  | `queue` | 9 queue lines |
  | `picnic` (eating) | stalls and picnic tables |
  | `play` | game booths |
  | `watch` | benches facing the rides, the Copperhead lookout, the fountain and the Big Top show |

  The interaction schema gains the `ride`, `queue`, `play` and `watch`
  activities. Park hours are 09:00–23:00.
- **Residents on rides:** when a town resident rides, `life/visuals.js` asks the
  park for the live seat pose, through `registerRidePoses`. The resident waits
  at their loading mark until the next dispatch, then rides one cycle in a real
  seat.

## Files

| File | Responsibility |
| --- | --- |
| `src/astra/themepark-plan.js` | Path graph, tiles, queues, coaster sequence, rides, stalls, activity points, venues |
| `src/astra/themepark-coaster.js` | Kit piece profiles, circuit layout, arc-length path, timetable |
| `src/astra/themepark-assets.js` | Pack loader, toon and glow material, ink hulls, rigid-part splitter, mirrored variants |
| `src/astra/themepark-rides.js` | Ride construction, animation, dispatch times and seat anchors |
| `src/astra/themepark-midway.js` | Tiles, entrance, stalls, lights, fence and landscaping |
| `src/astra/themepark-guests.js` | Guest simulation and instanced crowd |
| `src/astra/registry/park-activities.js` | Registry records for the activity points |
| `tests/astra-themepark.test.mjs` | Graph, tiles, circuit closure and train spacing, ride profiles, crowd, registry routing |

The pack's sky domes (day, sunset and night) are inventoried but not placed,
because the global light cycle owns the sky. Licensed files are never committed;
`public/licensed/` stays ignored.

## Evidence

`shots/opus-fairground/` has stills at day, sunset and night, plus
`rides.mp4`. Captures use port 5207 only (`node tools/shots-opus-fairground.mjs`; add `--film-only` to redo the 7-second film).
