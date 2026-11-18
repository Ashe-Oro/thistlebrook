<!-- OWNER: opus-suburb lane. Append-only build log for Maple Hollow. -->
# Maple Hollow build log (opus-suburb)

Append-only: assumptions, tuned values (old → new, and why), probe numbers and critic rounds.
Spec: `docs/specs/OPUS-SUBURB.md`. Contracts: `docs/specs/maple-hollow-contract.md`.

## 0. Baseline (before any Maple Hollow code, tree 94ad8ec)

Probe: `node tools/probe-maple-hollow.mjs --origin http://localhost:5321` (headless Chrome, SwiftShader, 1500 × 1000, seed 831, 10 s simulated per view).

| Probe | Value |
|---|---|
| Site view `{x:10,z:-145,zoom:1.5}`, 13:00 | 1124 draw calls, 12.84 M triangles |
| Close view `{x:10,z:-140,zoom:2.6}`, 13:00 | 362 draw calls, 11.70 M triangles |
| Dusk view (site camera, 20:30) | 1225 draw calls, 15.34 M triangles |
| Whole-world view | 8057 draw calls, 26.97 M triangles |
| People / town traffic / regional vehicles | 40 / 21 / 10 |
| `npm run deploy:dist` | 430 asset URLs; dist 33.3 MB, 454 files, 427 GLBs; unique content (first load) **21.2 MB** |
| `node --test 'tests/*.test.mjs'` | **160 tests, 160 pass** (212 s) |
| `npm run audit:roads` | **0 open**, 14 justified |
| `npm run sim:collisions` (24 h) | carCar 0, carPerson 0, personOnRoad 0, unsafeCrossing 0 (5400 samples) |
| `npm run test:checks` | OK (negatives, batches, medium 1/7/1234, parity) |
| Load time (headless, SwiftShader) | ~330 s while a deploy build ran alongside |

Note: `deploy:dist`'s headless verify timed out at 180 s under SwiftShader (the page needs ~330 s here). The dist numbers above are from the packer itself, which completes before the verify; later runs use `--skip-verify` for the size.

## 1. Assumptions

- **Reference images.** `public/licensed/suburban-neighborhood/reference/` doesn't exist in this checkout (neither does it under `/workspace/cel-town/`). Gold still 2 is therefore the pack thumbnail `/workspace/refs/asset-fit/thumbs/suburban-neighborhood.png`, the contact sheet `docs/specs/suburb-assets.jpg`, and renders of the vendor prebuilds (`prebuilds/cul_de_sac.glb`, `dressed_house_lot.glb`) taken locally for the critic. They're kept outside the repo, since they're licensed renders.
- **The GLBs in this checkout aren't Draco-compressed** (`extensionsUsed: none`, 7.9 MB for the folder). They load through the shared loader (`src/gltf-loader.js`, Draco and meshopt aware), and `deploy:dist` compresses them like every other pack.
- **Streets are regional (`world-link`) roads.** The grok-roads planner gives them one filleted record per chain, sidewalks on both sides from the pedestrian graph, turning circles at true ends (the cul-de-sacs), junction pads, and regional traffic that takes turns at junctions and yields to people. A `mapleHollow` flag on the records swaps the verge styling: concrete sidewalks and grass strips instead of the tan verge, and no rural fences.
- **Seeded order is preserved.** Maple Hollow is added in `compileWorld` after `compileAstra`, so the town's seeded RNG stream (trees, parcels) doesn't move. Landscape hills and trees inside the new region are filtered out by the existing `reserved()` test, which uses no random draws.
- **Driveway cars use `PARKING_BAYS`.** Each driveway car is a bay record (`maple-…`), so the audit and the collision sim see it like any other parked car.
- **The school bus is a scheduled regional vehicle** (`src/roads/regional-traffic.js`, `scheduled` option). It follows, yields and takes turns like the others, and the collision sim counts it. Kids board and alight through a transit hook in the life runtime (`life.setTransit`), so they're life actors and don't need a parallel system.

## 2. Component checklist (targets; `node tools/probe-maple-hollow.mjs [--origin …] [--audit] [--sim]` reports all of them)

| Component | Files (owner: opus-suburb) | Target / check |
|---|---|---|
| Streets | `maple-hollow-plan.js` (`STREETS`), regional planner | Curving streets, ≥1 cul-de-sac, two connections (airport road x 64; West Works lane/avenue at −42, −139), sidewalks both sides, crossings at junctions, bus stops and the school edge; `audit:roads` 0 open |
| Lots | `maple-hollow-plan.js` (`LOT_SPECS`, `planMapleHollow`) | 20–30 lots; each has house, driveway, lawn, mailbox, bins, plaque; six house types; no neighbour repeats; one for sale, one vacant |
| Props | `maple-hollow-assets.js`, `maple-hollow.js` | One InstancedMesh + ink hull per model; ≤150 added draw calls at the site view |
| Vehicles and bus | `regional-traffic.js` (scheduled vehicle), `PARKING_BAYS` | Driveway cars in bays; bus loop on regional roads; `sim:collisions` all zero |
| Life | `profiles.js`, `planner.js`, `runtime.js` (transit), `visuals.js` | 14 residents in 7 households; kids ride the bus; yards after school; BBQ evenings |
| Lighting and skins | material hook (`uAstraNight`), `mhLit`, lamp pools | Windows on at dusk, off late (per house); every skin restyles them |

## 3. Tuned values (old → new, and why)

- **Cars, 0.6 → 0.85.** Regional cars on these streets are 2.9 m long (the sim's footprint), and residents are 1.9 m tall. At 0.6 a sedan is 1.9 m, a toy beside the people. At 0.85 it's 2.65 m, close to the vendor's own car-to-house ratio in `prebuilds/cul_de_sac` (0.42 there, 0.48 here). Moving family cars draw at 0.9 (2.8 m) to match their sim footprint.
- **Bus, 0.45 → 0.55** (4.4 m). It fills the 4.4 × 1.6 m footprint it has in the regional sim (regional shuttles are 4.6 m).
- **Garage, 0.75 → 0.62.** At 0.75 the garage (4.9 × 4.8 m) was as big as a bungalow.
- **Treehouse 0.55, pool 0.6, swing set 0.75.** These fit the 2.5–4.5 m backyards of the court lots.
- **Ink hull, 0.03 → 0.042 m.** Critic round 1 found the outlines weaker than the village's.
- **Residential asphalt drawn 5.6 → 4.6 m**, with a 0.5 m grass strip each side. The simulated carriageway stays 5.6 m, so the lanes (±1.3 m, 1.35 m cars, a 1.6 m bus), the kerb and the sidewalk the walk graph uses (3.35 m out) are unchanged. Critic round 1 said the roads read wider than the houses.
- **Road tone, #76847b → #86918a**: lighter and warmer, after the critic.
- **Palette.** The pack's colours (blue-grey, khaki, brown roofs) → village palette: walls cream, butter, sage, sky, blush, mint, white, sand; roofs terracotta, clay, sage, slate, brown, brick. The baked wood-grain and shingle noise is flattened to three tones (0.8 / 1.0 / 1.15 of the surface colour). The modern house keeps its own colours.
- **Window lights.** On at 18.6–20.0 and off at 22.6–24.8 → on at 18.3–19.4 and off at 23.2–01.6 (per house). Lamp pools grow from 6.5 → 9 m (streetlamps) and 3.4 → 4.6 m (porches), at opacity 0.55 → 0.8. Critic round 1 scored the night 3/10.
- **Backyard fences.** Continuous privacy-fence rows → runs of pale picket or privacy fence broken by hedges and gaps, after the critic's "long brown bars".
- **Vacant lot.** The `vacant_lot_tile` dirt square → a mown lawn with tufts, a rockery and the For Sale sign.
- **BBQ nights**, `day % 3 === 2` → Friday to Sunday evenings (day 0 of the sim is a Friday). Adults head home after work (15.2–15.8) so they're on the street for it.
- **Crossing guard (`src/roads/collisions.js`).** A parked car used to count as "approaching" any crossing it faced within 6 m. Driveway cars near junctions then held kids at the kerb all day in the sim (the app doesn't feed parked bays to the guard). A parked car now blocks only a crossing it physically sits on.
- **Regional spawn.** Lines through Maple Hollow share the airport road, so two cars could spawn on one spot (9 car-car overlaps at hour 0). A car now steps along its own line until it stands clear; no shuttle buses run on suburban lines.

## 4. Critic round 1 (blind, shuffled names; key in /tmp, not committed)

Before/after: **after preferred** ("a dead green hole … fills it with a readable neighbourhood"). Gold test: **every image classified correctly** (0.7–0.98 confidence). Scores: same world 4, density 5, layout 5, night 3, wow 5.
Top fixes: re-shade the pack look to the village palette; fix the night; soften shadows; narrow the roads; break up the fences; fill the loop interior and the margins; give streets a steady rhythm of trees and lamps; no zebras inside cul-de-sac bulbs; vary cars and props, with shrubs at the foundations; the beige flat-roof box (the modern house recoloured) reads as a placeholder.
Done for round 2: everything above except shadows. Shadow length and softness are the shared light cycle's, so changing them would restyle the whole world; I took the day stills at 13:00–16:00 instead of golden hour.

## 5. Merge with main and TOWN-RULES (2026-11-17, evening)

- **Merged `main`** (TOWN-RULES audits, curb-to-curb crosswalks, Pinewood woods, Funfair Parking, Tesla lineup, the Thistlebrook rename) into `village/opus-suburb` at 0676164. Conflicts were resolved by keeping main's code and re-adding the Maple Hollow hooks: the nav tab, `CROSSWALKS` spread, `world.js` build/update, `compileWorld` order (`planWoods`/`registerWoods` kept), and `sim-collisions` transit plus the fair-lot audit. Main's walk-graph crosswalk renderer replaces our old junction-zebra code, so the diagonal zebras in round 1/2 shots are now perpendicular curb-to-curb ones (TOWN-02). Place names follow the rename (Thistlebrook High School, Thistlebrook Town Hall).
- **TOWN-07 home variety.** Every home was registered as `custom` with the same `height` and no colour, so the audit saw one facade. Homes now report `color: siding/roof` and `shop: house model`. Result: `audit:roads` 1 → **0 open**.
- **Environment note.** `tests/astra-catalog.test.mjs` walks `/workspace/threejs-assets` when it exists. Two raw packs (`city`, `railway`) landed there at 20:15 and 20:39 from outside this lane, so the inventory check failed once. It passes without the raw library (as on CI) and passed again in the later full runs. This lane didn't touch the inventory.

## 6. Life: the afternoon bus (found by a full-day trace, not by the tests)

A weekday trace (`life` + `regional-traffic`, 06:36–18:30) showed the morning run fine (7/7) but the afternoon run boarding only 2, then 6, of 7 kids. After school the kids walked into town (Saint Willow's, the Little Mill, benches) instead of playing in their yards. Causes and fixes, with old → new values:
- Kids left school at midday on errands (lunch-bag restock, Pinecrest picnic), so they were far away at the bell. **Bus kids now stay on campus until the bell** (class, then recess), with a packed lunch at school when hungry.
- School out **15.0 → 14.8**, afternoon bus departure **15.05 → 15.2**, missed-bus cut-off **16.4 → 16.6**. The kids are waiting when the bus arrives (~15.7) instead of still walking (~0.7 h from class to the stop).
- **The school stop had 6 waiting places for 7 kids**, so the 7th never got a slot and never boarded. Stops now get one place per rider.
- **Homebound drop-off.** Every rider got off at the first homebound stop. Riders now step off only at their own stop (3 at the Drive, 4 at Acorn Court).
- After the bus, a hungry kid **snacks at home** instead of walking to a town café, and bus kids skip weekday-afternoon lunch-bag trips (they restock at weekends). Result: all 7 play in yards from ~16.5 to 19.2, visiting each other's yards.
- New test (in `tests/maple-hollow.test.mjs`): kids stay on campus until the bell, every kid rides the afternoon bus, each steps off at their own stop, and all are back in Maple Hollow playing in yards.

Crossing safety (`sim:collisions` caught it once the afternoon run worked): Toby and Ivy stepped onto the Drive crossing at (24, −143.6) just as the bus pulled away from the Drive stop 12 m off. A stopped vehicle more than 6 m away counted as safe, and the bus only looked 0.5 s ahead in its own lane. Fixes: a bus **dwelling with its doors open counts as moving** for the crossing guard (`collisions.js`), and the **bus predicts pedestrians 0–2 s ahead** (regional cars keep 0–0.5 s). `sim:collisions` now names the vehicle, its position, speed and status in unsafe-crossing reports. Result: 2 → **0** unsafe crossings, **14 bus rides** a weekday (7 each way).

## 7. Render fix: dark far-side sidewalks

Critic round 2 flagged a "dark brown sidewalk strip" along the Drive. Pixel probes ruled out shadows (shadow map off: no change) and main's walk-graph strips (hidden under ours). The cause: the ground mesh forced every normal to (0, 1, 0), but with `DoubleSide`, three.js lights back faces with the normal reversed. The ribbons on one side of each street (sidewalk, kerb, verge) were wound clockwise, so they were lit from below and rendered dark. Triangles are now wound to face up (`groundBuilder().mesh()`). Every far-side sidewalk is light again.

## 8. Critic rounds 2 and 3 (blind, shuffled names; keys in /tmp, not committed)

Material: before-site/dusk, after-site/day/evening/street, gold still 1 (`shots/astra-homes/05`, `06`), gold still 2 (the pack thumbnail; licensed, kept outside the repo).

| Round | Gold picked out? | Same world | Density | Layout | Night | Wow |
|---|---|---|---|---|---|---|
| 1 | yes, every image (0.7–0.98) | 4 | 5 | 5 | 3 | 5 |
| 2 | yes (0.85–0.95) | 6 | 5 | 6 | 6 | 5 |
| 3 | yes (0.9–0.97) | 5 | 5 | 6 | 4 | 5 |

Every round preferred after over before. Round 2 → 3 is flat within critic noise (different critic, different stills: round 3 saw the 22:48 night still, round 2 the 20:12 evening one).
- **Done after round 2:** the dark-sidewalk fix (§7), street trees on the Crescent's bare hill-side verge, sky-blue siding → ochre, and the modern house takes cream siding (its dark upper volume isn't a recolourable role, so it still reads darker than the rest).
- **Done after round 3:** the bus lay-by is paved over the turning circle's sidewalk ring (the parked bus read as standing on the pavement).
- **Not done, with reasons.** *Houses on the loop's outer side:* Birch and Cedar already have lots there; the Crescent's outer side is the district edge (z −183) against the hills. *Softer, shorter shadows* and a *navy night grade:* these belong to the shared light cycle and would restyle the whole town; they're out of scope for this lane. *Curb-parked cars:* they'd need new `PARKING_BAYS` on 5.6 m residential streets that the bus and cars pass through, so I left them out to keep `sim:collisions` at zero. *Continuous fence runs* and *more cul-de-sac lots:* listed for a follow-up.
- **Verdict.** Critics still pick the gold references out reliably and aren't wowed (5/10). The spec's "iterate until critics can't tell" bar is **not met**. The district is complete, live and rule-clean, but the look gap to the town (palette and ink weight of the pack houses, shared shadows) needs another art pass.

## 9. Probe numbers, before → after (headless Chrome, SwiftShader, seed 831)

| Probe | Baseline (94ad8ec) | Final |
|---|---|---|
| Lots / complete | 0 | 23 / 22 (+1 vacant plot; 2 for sale), 6 house types |
| Site view draw calls (audit) | 1124 | 1387. Maple Hollow's own share is **+119** (renderer count with shadow passes, MH group hidden vs shown, same frame); the rest is main's merged lanes |
| Close view draw calls (audit) | 362 | 622 (Maple Hollow **+117**) |
| Triangles added at the site view | — | +1.19 M |
| First load after Draco (`deploy:dist --skip-verify`) | 21.2 MB | 21.7 MB (Maple Hollow's 43 models: **+0.36 MB**) |
| `audit:roads` | 0 open, 14 justified | **0 open**, 16 justified |
| `sim:collisions` (24 h) | 0/0/0/0 | **0/0/0/0**, 14 bus rides, 5400 samples |
| Full suite | 160/160 | **187/187** (`node --test 'tests/*.test.mjs'`); `test:checks` OK; `life-routines` 9/9 |
| People / town traffic / regional | 40 / 21 / 10 | 54 / 21 / 10 (+14 residents) |

Frame rate: there's no GPU here (SwiftShader), so 60 fps can't be measured directly. The proxy is the added draw calls (+119, all instanced: one InstancedMesh and one ink hull per model) and +1.19 M triangles. That's about 4 % of the site view's frame, in line with the other districts.

## 10. Run instructions

```
npx vite --port 5321                                   # dev server
node tools/probe-maple-hollow.mjs --origin http://localhost:5321 --audit --sim
node --test tests/maple-hollow.test.mjs                # or the full suite: node --test 'tests/*.test.mjs'
npm run audit:roads && npm run sim:collisions && npm run test:checks
node tools/shots-opus-suburb.mjs http://localhost:5321 after [site close rotated dusk day evening night street skin-cel …]
node tools/film-opus-suburb.mjs http://localhost:5321 12   # -> shots/opus-suburb/tour.mp4
```
In the app: the "Maple Hollow" tab under Town life, or `?view=maple-hollow`; `?skin=neon|autumn|winter` or K to switch skins.
Run the skin stills one per process: switching skins in a long capture session crashed SwiftShader's tab here (memory).

## 11. Hand-off

- **Needs Ashe:** re-upload the CI Blob model pack (`npm run models:upload`). `deploy:dist` already lists the 43 `licensed/suburban-neighborhood/*.glb` models (literal paths in `src/astra/maple-hollow-assets.js`), but the CI fetch won't have them until the pack is re-uploaded. No licensed binaries are committed (`public/licensed` is a git-ignored symlink).
- Tour: `shots/opus-suburb/tour.mp4` (40 s, 1280 × 720, 12 fps, 7.6 MB): the morning bus run, after-school yards, a BBQ evening and lights coming on at night.
- Local commits only on `village/opus-suburb`; nothing pushed.
