# Sunbeam Mall decisions

Append-only. Record parcel, lengths, frontage counts, old → new values, and probe numbers.


## Seed 831 parcel

| Measure | Old Sunbeam Terrace | Sunbeam Mall |
| --- | --- | --- |
| Pedestrian axis, world coordinates | East–west, `[-142,-52]` to `[-105,-52]` | North–south, `[-126,-87]` to `[-126,-36]` |
| Promenade length | 37 m | 51 m |
| Clear walking width | 3 m | 6 m |
| Paved width | 13.4 m across the court | 13.5 m |
| Authored scenery reservation | x −144…−108, z −69…−34 | x −140…−112, z −87…−36 |
| Frontages | 9 | 14, seven on each side |
| Ground-floor shops | 2 | 14, including Nell’s Corner and The Washhouse |

The finished pavement occupies x −132.75…−119.25 and z −87…−36.
The centre walk occupies x −129…−123 over the same length. The 3 m links
beyond its ends meet the perimeter streets at z −90 and z −33. Each
front door connects to the walk through its own clear approach.

The old bus return crossed the extension at z −70. Its north bend moves to
z −90 between x −144 and the station avenue at x −115. The west and south
legs and the Sunbeam stop stay in place. The station avenue ends at the
new bend. The former link at z −73 is removed and east access on x −105
joins Civic Avenue at z −77. The terrace notch extends from z −73 to
−94, leaving room for the widened perimeter street. The extension stays
south of West Works and west of Civic Green and the campus.

The arrangement uses the existing pastel palette and preserves the eight
named home IDs. The storefronts share the original rowhouse construction.
Owned Cozy Village furnishings and townsfolk use the private asset
mapping. The paving, storefront details, globe lights and chess furniture
are procedural. Furnishings occupy the side bays between door approaches.

## Camera and photo review

The phone opening stays at a 390 × 844 viewport. Its centre moved from
`[-125,-52]` to `[-126,-61.5]` and its zoom changed from 4.4 to 3.7.
The first blind comparison preferred the mall for street life and its longer
shop frontage, and preferred the older court for the visibility of its paving.
The foreground pottery building was reduced to four storeys, and the phone
view now looks down at 58° so the clear walk is visible between the two rows.
A fresh blind comparison with the pictures in random order selected the final
mall for liveliness, length, and visible walkability.

The desktop still uses a wider context view with West Works, Civic Green,
part of the campus, and the perimeter loop. The close and axial stills use
capture-only perspective views. Day stills are at hour 10.4 and the dusk still
is at hour 19.5. The browser check opened the mall through Explore, picked
Nell’s Corner, found all eight home IDs, and verified that pause freezes and
resume advances mall life.

## Phone6 profile

The untouched `5b022b5` and the mall framing build used the same local
Fast Load model files and URL aliases. Chrome 156 ran with ANGLE SwiftShader
on three available CPU cores, with a 390 × 844 touch viewport, device DPR 3,
and 6× CPU throttling. The renderer capped its resting DPR at 1.75. Each
probe started with HTTP caching disabled. Ready time is the browser’s
`__readyAt` timestamp for the first town render. Steady FPS uses five
frame intervals after streaming settled and the camera returned to Sunbeam.
The 3 s touch gesture also counts the first completed frame crossing release.

| Phone6 measure | Before | After |
| --- | ---: | ---: |
| Cold ready time | 26.89 s | 26.62 s |
| Steady FPS | 0.147 | 0.162 |
| Touch-pan FPS | 0.119 | 0.111 |
| First-render draw calls | 409 | 438 |
| First-render triangles | 3,092,061 | 3,565,166 |
| Settled draw calls | 433 | 446 |
| Settled triangles | 3,326,130 | 3,567,086 |

The software-rendered gesture submitted one frame in each run. The settled
view adds 13 draw calls and 240,956 triangles across the visible town.
The mall itself accounts for 126,226 triangles in the final settled render
list. Both probes completed with zero page errors and failed HTTP responses.
Raw profiles are in `/workspace/scratch/sunbeam-mall/before-phone6.json`
and `/workspace/scratch/sunbeam-mall/after-phone6.json`.

## Verification

- The isolated production build passed. The focused suite (9 tests), Astra
  suite (131 tests), and `test:checks` passed with the scoped CI asset root.
- Seed 831 road audit went from 0 open and 16 justified to 0 open and
  16 justified. All 14 doors reach school, The Reading Room, and Willowbank
  in both the compiled paths and the sidewalk graph.
- The longer West Loop changed arrival timing enough to expose an existing
  curb intrusion on the fire tender’s return turn. Widening that one turn
  kept the vehicle’s swept footprint off the sidewalk. The final clear-day
  simulation recorded 0 contacts or unsafe crossings across 5,400 samples.
- The dusk browser check caught the weather layer’s copy of the window
  material. A shared shader uniform now carries the clock’s light level
  into that copy. At hour 19.5, the same rendered pane changed from
  RGB 79, 104, 106 to 218, 172, 115, and the globe lamps lit the side bays.

### Dusk-fix phone6 recheck

After the dusk fix, the same cold profile recorded **30.52 s** to ready,
**0.160 steady FPS**, and **0.120 touch-pan FPS**. The last run had the
same draw and triangle counts as the framing build, with zero page errors
and failed responses. The cold runs ranged from 26.89 to 28.80 s on the
baseline and 26.62 to 30.52 s on the mall. The final before/after pair,
including cold and settled draw counts, is in the evidence JSON.

### Full-suite traffic follow-up

The full CI pass completed all 328 test cases, `test:checks`, and the
rain and snow collision runs. Its final traffic step found seven queued
vehicles on seeds 831 and 42, all behind the same bicycle and delivery
van at Civic Green. The untouched baseline had zero stalls on those
seeds. The West Loop bicycle now waits for the junction from its offset
cycle strip.

The changed traffic timing also exposed a curb sweep at the bus turn
near `[-105,-103]` and a pedestrian conflict at the station driveway.
The West Loop turn now gives the bus enough room between both sidewalks.
The app and collision simulator share the same driveway clearance check.

The post-fix reruns passed all 18 targeted Astra traffic and integration
tests. The traffic simulation on seeds 831, 42, and 99 each recorded
zero overlaps, stalls, and deadlock releases. The clear, rain, and snow
collision runs each recorded zero incidents in 5,400 samples. The final
road audit retained zero opens and 16 justified findings.

### Final production capture

The final build and browser run passed. The latest phone6 pair measured
**0.147 → 0.184 steady FPS**, **0.119 → 0.115 touch-pan FPS**, and
**26.89 → 25.69 s** to the first render. Across mall runs, cold ready
times ranged from 25.69 to 30.52 s. The draw and triangle counts stayed
at the values above. The raw JSON and the committed evidence file hold
the final samples. The five after stills were captured again from this
build.
