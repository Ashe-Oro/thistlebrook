# Traffic fix log

## 2026-11-19

- Measured the vehicle GLBs in model space with glTF Transform. Town streets use 0.56 world units per nominal metre, regional roads use 0.90, and the airport apron uses 0.75. The independently authored school bus, fire tender, ambulance and bicycle have documented model-unit conversions in the registry. Marked parking uses a uniform fit into each bay. Collision checks read the exact same model specification as the renderer.
- Regional cars use City sedans and taxis, Vice Beach pastel sedans and convertibles, and Suburban Neighborhood family cars. Regional and Pinecrest shuttles use the City bus. The Pinecrest pair was an additional pair of primitives found during the code audit.
- The two Civic Green fire engines use the Airfield fuel truck, the police car uses the Vice Beach police cruiser, the delivery truck uses the City delivery van, and the Astra High bay uses the Suburban Neighborhood school bus. The clinic tests the Realistic City ambulance with its vertex colours. The airport uses the Airfield pushback tug and baggage cart train.
- Funfair Parking uses City sedans, Vice Beach pastel sedans, and Suburban Neighborhood sedans and pickups. Road traffic uses the existing pack fleet with the Tesla car swap disabled. The Roadster and the arena show still use the authored Tesla models. Whether to replace that show is an open decision for Ashe.
- The Starbase recovery tug is a watercraft. Its body is outside this road-vehicle change.
- The licensed Airfield and Realistic City files were already present and Draco-encoded. Their local files were used as supplied. The publish step needs an updated Blob model pack so CI deploys can fetch them.

### Full-day baseline

The same sampling harness ran from 07:00 for 24 hours at 90 seconds per town hour. It loaded commit `1d763c2` from a temporary export with `--root`. The counts include all vehicle subsystems and resident schedules. The original four-hour investigation ran without pedestrians and covered fewer systems.

| Seed | Overlapping pairs | Stalled vehicles |
| --- | ---: | ---: |
| 831 | 20 | 14 |
| 42 | 13 | 18 |
| 99 | 17 | 14 |

The two approach lanes stay offset through a moving semicircle. The nearest driver reserves the turn from the stop line. A turnaround and a nearby junction share a reservation wherever their swept areas meet. The Civic Green driveways and the Civic Avenue bend also share a reservation. The owner clears the reservation after its body and projected path have left the zone.

### Browser evidence

The same camera shows the baseline queue and the repaired turnaround at the Lantern Quay road end. The junction sequence starts the West Loop bus, fire tender and delivery van on their real approach lanes and advances the town simulation. Each captured step checked oriented vehicle footprints. The stills show the reservation sequence through the zebra crossings.

The fuel truck has a red cab and amber beacon, and the pack's tank and hose details are visible at street scale. The ambulance keeps a cream body and green markings with vertex colours, so the Realistic City model is used. The lineup shows the regional, town, fair-lot and airport models at their in-game scales. The film runs 32 seconds. [Browser evidence](../../shots/traffic-fix/)

### Clinic sidewalk

The first clear-weather audit found the delivery van waiting across the clinic sidewalk in its original depot position. The loading bay now sits west of the entrance and behind the through sidewalk. The audit cleared all 27 contact samples after the move. A unit test also checks the sidewalk against the parked van's footprint.

### Verified traffic

Each 24-hour run sampled 10,800 states. Seeds 831, 42 and 99 each finished with zero overlaps, zero stalls and zero deadlock releases. Across those seeds the baseline had 50 overlapping pairs and 46 stalled vehicles. The Northern Loop had no at-grade crossings. The synthetic closed-gate test holds both vehicles in its queue and confirms they pass after reopening. [Per-seed incidents and per-system counts](../../shots/traffic-fix/metrics.json)

### Deployment bundle

`npm run deploy:dist` ran the production build and verified the result in a headless browser. It collected 544 asset URLs. The app reached ready state with 319 asset requests and zero 404s. The fuel truck, pushback tug, baggage cart train and ambulance each returned HTTP 200 from `dist/` and have `KHR_draco_mesh_compression` in their shipped GLB headers.

Clear, rain and snow collision runs each checked 5,400 samples and reported zero incidents. The road layout audit had zero open findings, and the railway audit and Northern Loop tests passed.

`npm run test:ci` passed all 269 tests, the negative checks, the rain and snow collision runs, and the three full-day traffic simulations.

### Shared vehicle scale

A 4.5 m sedan occupies the existing 2.05-unit town car footprint, giving every pack vehicle 0.455556 world units per metre. The registry divides each class’s target length in world units by the model’s measured length. Town and regional driving, static bays, Maple Hollow driveways, Funfair parking, civic, airport ground service and Starbase all use the same calculation and the same scaled bounds for collisions. The City delivery van has a box body and uses the 6 m box-van class. The City sedan uses a scale of 0.6706 in every placement. The police cruiser grows from 1.639 to 2.187 world units and matches the taxi’s length. Both school buses measure 5.011 world units at a scale of 0.6209.

The first shared-scale run exposed 15 stalled vehicles per seed. Two queues formed where the City bus or a civic truck could no longer clear an opposing vehicle. Town bus corridors and the Civic Avenue lanes provide more clearance, the downtown jog has a shallower curve, and junctions reserve space ahead of the longer noses. The High Street and Civic Green bus stops, florist and quay dwell points, and civic supply drop-off sit farther from junction or crossing traffic. Curbside bays use their model dimensions and moved behind the wider sidewalks. Maple Hollow driveways and the Funfair bays fit the shared-scale cars with the existing pavement. At the clinic, the wider junction reservation exposed a queue position across the sidewalk. The delivery bay starts 1.65 units farther back and moved 1.52 units east to keep the driveway clear of the clinic’s sidewalk waiting area. A regression check covers both a parked van and a van waiting to enter the junction. The Civic Avenue bend and Town Hall approach have 0.6 units of extra hold-line clearance for the bus’s front corner. Waiting approaches get the next turn before a new platoon can take the reservation. The downtown jog and its adjacent junction share a reservation so a waiting car stays clear of the bus's sweep. The fire tender stops half a body length short of its turnaround for the assist, with its full footprint clear of both sidewalks. Moving vehicles check their next oriented footprint against nearby walkers, including where the outside corner reaches past their current heading. At Funfair Parking, walkers on the far side of the apron had been holding departures through the next shuttle window. The apron reserves the portion of road each car will sweep and retains pedestrian clearance on the approach.

### Starbase road transport

I compared the oversized Airfield pushback tug, the Farm tractor and trailer, and a Railway flatbed carrying the upright ship. The tug’s cab occupies part of its deck and enlarging it would give the airport’s tug a second scale. The railway flatbed’s rail bogies read as a rail vehicle. The fuel truck and garbage truck both have fixed bodies and lack a load platform. The Farm trailer shows the stage supported by a broad load surface, with its own wheels and a separate tow tractor. Its 13 m target fits the existing ship without resizing the cargo, and the 7.5 m tractor stays in proportion to the trailer. The engine-bell bottoms sit at the measured inner deck height below the side rails.

The convoy tows east toward the pad and backs west to the factory, with six-second stops at the ends. The service gate opens while it passes, and the visitor and worker crossings stay west of the convoy’s swept path. The recovery trailer waits on the raised apron under the recovered booster. The full-day traffic check samples the tractor, transport trailer and recovery dolly at their rendered world positions. [Fleet lineup](../../shots/traffic-fix/fleet-lineup.png) · [Starbase transporter](../../shots/traffic-fix/starbase-transporter.png)

### Shared-scale verification

The final traffic run on `94aff5a` sampled 10,800 states per seed over 24 town hours. Seeds 831, 42 and 99 each reported zero overlaps, stalls and deadlock releases. The Starbase count is three in every run. The clear, rain and snow collision runs each reported zero incidents across 5,400 samples. The road audit reported zero open findings, and the railway audit passed.

The production bundle collected 546 asset URLs. Its headless session reached ready state with 321 asset requests and zero missing requests. The four earlier vehicle GLBs and both Farm GLBs returned HTTP 200. Every mesh primitive in those six files uses Draco compression in `dist/`. [Verification metrics](../../shots/traffic-fix/metrics.json)

`npm run test:ci` passed all 271 tests, the negative and parity checks, and repeat runs of the rain, snow and three-seed traffic simulations.
