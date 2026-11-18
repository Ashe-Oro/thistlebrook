# Railway Grand Loop decisions

## 2026-11-18 · Corridor and service

- Used the existing West Works frontage and Airport Road crossing. The airport platform stays landside. The hospital and school district streets retain their existing geometry. The north approach stays outside Maple Hollow’s reserved parcel, with a future platform beside Hollow Crescent. Maple Drive joins Airport Road south of the retained 89.8° crossing near [67.485, −181.291]. The Maple integration lane confirms that the through airport service uses this deck and local Maple traffic turns at its own junction.
- Kept Union, Municipal Airport, Thistlebrook High and Lantern Quay in service. The grand circuit runs past the south side of Pinecrest, down the outer Coral Coast shore, around Starbase, past Saltwind Harbor and west across Stillwater before returning around Pinewood, Merrymead and the Roadster arena. The Pinecrest shuttle and harbor approach pass below the railway viaduct. Trestles carry the route over coastal shallows and the Stillwater watercourses. The tightest centreline fillets are 6 m at Union’s north throat.
- Lined up the passenger doors with the working face of each platform. The short platforms serve the steam set’s passenger section. The freight vehicles remain coupled along the running line. The 55.50 m consist is a steam locomotive, tender, two passenger coaches, guard’s coach, mail coach, freight van, open coal wagon and container flat. Pack geometry is linked under the ignored licensed library and receives the town lighting, ink and skin at runtime.
- Each platform dwell lasts 24 simulated seconds. The first lap starts at the Union platform at 06:30. The two loops are timed to make the final Union arrival at 22:00. The train rests on Union’s north siding overnight. It reverses clear of the points and pulls forward onto the platform before service, and shunts back to the siding after the final Union dwell.
- Applied the Maple integration lane’s shared rain and snow crossing fix from `fdc172d`. Train passengers also feed the fair-lot pedestrian yield logic. This resolves the clear-weather contact that appeared when a rail passenger walked toward Pinecrest on the first trial.

## 2026-11-18 · Measurements at seed 831

The centreline measures **2,447.046 m**, including **0 m in tunnel (0%)**. The traced, one-metre sample polygon measures 2,446.964 m. The main line encloses **8 of 10 (80%)** named district centres. West Works, downtown, Civic Green, Thistlebrook High, Saltwind Harbor, Coral Coast, Pinewood and Merrymead are inside. The Airport Road and Stillwater approaches place the airport and outskirts centroids outside the circuit. The mixed consist is **55.50 m** long and contains **seven coaches or wagons**, in addition to the engine and tender. A lap, including all 12 dwells, takes **626.81 simulated seconds**.

The station inventory uses registry destinations and the entrances used by the pedestrian graph. The walk includes the platform approach slope where present. Departure times are rounded to the nearest game minute. Each platform has a 24-second dwell.

| Place and walk origin | Platform sign | Walk | Departures |
| --- | --- | ---: | --- |
| West Works, Union hall front door [−88, −147] | Thistlebrook Union | 20.4 m | 06:46, 15:18 |
| Municipal Airport, landside terminal [77, −184] | Municipal Airport | 58.1 m | 07:21, 15:53 |
| Thistlebrook High and Owls Stadium, east spectator gate [60, −97] | Owls Stadium | 34.8 m | 07:45, 16:17 |
| Lantern Quay, district registry entry [55.272, −4.141] | Lantern Quay | 59.1 m | 08:14, 16:46 |
| Pinecrest Adventure Park, midway entrance [220, −8] | Pinecrest Park | 55.7 m | 08:45, 17:18 |
| Coral Coast, beach entry [274, 68] | Coral Coast Beach | 36.0 m | 09:19, 17:51 |
| Starbase, public visitor garden [183, 319] | Starbase | 53.3 m | 10:10, 18:42 |
| Saltwind Harbor, Shell Cove public boardwalk [135, 56] | Saltwind Harbor | 39.4 m | 10:53, 19:25 |
| Downtown, fountain and town square [−57, −1] | Old Town Centre | 57.4 m | 11:26, 19:58 |
| Pinewood, South Trailhead [−104, 119] | Pinewood South | 23.4 m | 11:58, 20:30 |
| Merrymead fair, Little Skywheel entrance [−199, −84] | Merrymead Fair | 35.6 m | 12:41, 21:13 |
| Roadster arena and Tesla lineup, public approach [−182, −179] | Roadster Arena | 24.4 m | 13:14, 21:46 |
| Maple Hollow, Hollow Crescent [24, −177.457] | Maple Hollow | 5.9 m in the integration probe | Conditional |

- Ran the Maple lane’s actual compiler hooks in a temporary overlay using `990ddce`. Its parcel record is appended after the railway is attached, so the railway also detects the earlier Maple layout record. The optional stop raised enclosure to **9 of 11 (81.8%)** and lap time to **662.10 s**. The North Crescent access connects to the local sidewalk graph. The railroad still crosses the Airport Road at 89.8° and the skatepark approach at 90°. The overlay was removed after the probe.
- A seeded Pumpkin Pantry placement at seed 99 fell inside the new Old Town Centre platform footprint. The vignette compiler now reserves the same platform and walking geometry it will later receive from the railway. The fixture passes at all five seeds.
- The five new stock files are `guards_coach.glb`, `mail_coach.glb`, `freight_van.glb`, `open_coal_wagon.glb` and `container_flat_wagon.glb`. Local links in `public/licensed/railway/` point to `/workspace/asset-packs/railway/glb/individual/`. The commit contains stock IDs and bounds metadata.
- Compared the two wide shots anonymously in random order. A showed a continuous ring around the developed area and a visibly longer train off the Pinewood shore. B showed a compact circuit grouped around West Works and the campus. Revealing the order confirmed A as the Grand Loop. The station and consist shots show the full train at a larger scale.

## 2026-11-18 · Capture and rendering

Captured in Chrome with Playwright, seed 831 and the default cel skin. The browser navigation opened the Grand Loop view, the skin control switched to neon and back to cel, all nine stock vehicles rendered, and two travellers waited on the Pinecrest platform. The scene registry returned zero render coverage errors.

| View | Railway visible | Railway hidden | Draw-call delta |
| --- | ---: | ---: | ---: |
| Wide aerial | 6,843 | 6,725 | +118 |
| Pinecrest platform | 794 | 716 | +78 |
| Owls Stadium crossing | 749 | 680 | +69 |
| Roadster Arena at night | 337 | 288 | +49 |
| Coral Coast consist | 565 | 516 | +49 |

The captures compare visibility in the same camera and clock state. The track uses merged ballast, rail and viaduct geometry, with instanced sleepers, trestle piers, platform modules and furniture. Each stop uses one instanced draw for all faces of its nameboards.

The 12-second MP4 samples one complete scheduled lap into 144 frames. It uses a stationary town render and the actual moving train meshes from the same camera and lighting. Replay the capture with `node tools/railway-grand-loop-shots.mjs <local Vite URL>`.

## 2026-11-18 · Final verification

- `node --test --test-concurrency=2 tests/*.mjs tools/life-routines.test.mjs` passed all 222 tests.
- `npm run test:checks` passed, and `npm run audit:roads` reported zero open findings.
- `npm run sim:collisions` and the separate `--weather rain` and `--weather snow` runs each produced zero collisions, unsafe crossings, pedestrians on the rails and vehicles on the rails outside legal decks over 5,400 samples.
- `npm run build` passed with the Vite chunk-size warning.
- The five PNGs decoded at 1920 × 1080. The lap MP4 decoded at 1120 × 700, 12 fps, with 144 frames. No GLBs are tracked.
