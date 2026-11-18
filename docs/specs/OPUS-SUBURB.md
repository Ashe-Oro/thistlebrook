<!-- OWNER: opus-suburb lane (spec prepared by Grok executor, built by Claude Opus). -->
# Build "Maple Hollow", a new American-suburb district of 20–30 homes on the empty field north of Astra High, in the Astra cel village (`/workspace/cel-town-wt/opus-suburb`, branch `village/opus-suburb`).

## Reference
- **Gold still 1, the town:** the existing homes district (Willowbank and Sunbeam Terrace), `shots/astra-homes/05-seven-district-town.png` and `06-windows-at-dusk.png`. Maple Hollow must read as the same world: same ink weight, palette, shadow softness and object scale next to its neighbours.
- **Gold still 2, the neighbourhood:** the pack's official cover, `public/licensed/suburban-neighborhood/reference/official-cover.png`, plus the vendor prebuilds `reference/prebuild-cul-de-sac.png` and `reference/prebuild-dressed-house-lot.png`. Match their density: every lot has a house, a driveway, a lawn and 2–4 yard props, and the streets have trees, lamps and parked cars.
- **The site:** `shots/opus-suburb/before-plan.png` (plan, site boxed) and `before-site.png`, `before-close.png`, `before-rotated.png`, `before-dusk.png` (game camera). Site box x −40…60, z −185…−105 (about 100 × 80 m). It is bounded by West Works (venues to x −46) and the lane at x −42 on the west, the airport world-link road at x 64 on the east, the Astra High campus (z ≥ −100) on the south, and hills and pines (z ≤ −190) on the north.
- **Assets:** `docs/specs/suburb-assets.md` (all 63 models with sizes in metres, scale advice, town reference sizes) and the contact sheet `docs/specs/suburb-assets.jpg`.

## Details
- **Layout.** 20–30 lots on curving residential streets with at least one cul-de-sac. Connect to the existing network in two places: off the airport road (x 64) and off the West Works lane and avenue around (−42, −139). Add sidewalks on both sides and crosswalks at every junction and at the school edge. Put an HOA entrance sign at the main entry. Use the roads system (`src/roads/*`, the filleted single-record roads from grok-roads) and its parking bays (`PARKING_BAYS` in `src/astra/traffic-simulation.js`); don't use pack street tiles as roads. Traffic follows the same rules as the rest of town: cars yield at crossings, take turns at junctions and park only in bays or driveways.
- **Lots.** Mix the six house types (`bungalow`, `ranch`, `split_level`, `two_story`, `modern`, `townhouse_duplex`) with garages and porches. Vary the yaw and the palette so no two neighbours match. Each lot gets a lawn, a driveway apron, a mailbox, wheelie bins and an address plaque, plus some of: pool, deck, patio set, BBQ, swing set, treehouse, basketball hoop, shed, pergola, hedges and fences, flower beds. Line the streets with shade and flowering trees, streetlamps, hydrants and stop signs. Park family cars (sedan, SUV, pickup) in driveways. One or two lots can be for sale or vacant for variety.
- **Life.** Use the existing life and schedule system (`src/astra/life/*`, `residents.js`); don't build a parallel one. New households live here. On weekday mornings adults drive or walk to work and kids walk to the stop. A pack school bus runs a morning and afternoon loop from Maple Hollow to Astra High (next door) and back, using the roads system. After school, kids play in yards (swing sets, hoops, treehouses, sprinklers). Some evenings bring a BBQ with neighbours on the deck. At dusk, porch lights, streetlamps and windows come on through the existing light cycle, and they go off late.
- **Look.** Use the cel default: ink outlines (same per-piece outline path as `src/astra/themepark-assets.js`), the town palette and lighting. Every skin in `src/skins/` (cel, neon, autumn, winter; `?skin=` or K) must restyle Maple Hollow correctly. Don't use the pack's sky domes or clouds, any brand logos, or any dialogue.
- **Scale.** Start from `suburb-assets.md`: houses and props at about 0.75, cars at about 0.6 to match the traffic cars, and the bus at about 0.45. The critic decides from there.
- **Keep out:** the grok-woods lane's area (`WOODS_AREA`, x −200…−72, z −28…124) and the grok-fairlot lane's area (around x 195…250, z −15…45). Don't edit those lanes' files. Don't touch Crayon, Thistlebrook 2D, Agent Pixel or `/workspace/refs/asset-pipeline`.

## Tools
- Three.js and the existing compiler (`src/compiler/world-plan.js`) at seed 831. Add the district the way other districts are added, as a region and a district entry with a "Maple Hollow" nav tab.
- **Assets:** the owned ThreeJS Assets *Suburban Neighborhood* pack at `public/licensed/suburban-neighborhood/` (a symlink to `/workspace/cel-town-git/public/licensed`). The GLBs are already Draco-compressed, so load them with the shared Draco loader and use `InstancedMesh` per model. Licensed binaries are never committed, copied into `src/` or `docs/`, or pushed.
- **Deploy wiring:** `tools/prepare-deploy-dist.mjs` only ships models whose literal `licensed/suburban-neighborhood/<name>.glb` path appears in `src/`, or teach `collectUrls` the new loader. `npm run deploy:dist` must list them. The CI Blob model pack then needs a re-upload (`npm run models:upload`). Leave that step to Ashe and say so in your hand-off.
- **Probes:** `npm run audit:roads`, `npm run sim:collisions`, `node --test 'tests/*.test.mjs'`, `npm run test:checks`, and `__astra.audit()` (draw calls, triangles, people, traffic). Use `tools/shots-opus-suburb.mjs <origin> <label> [views]` for stills (`npx vite --port <n>` for the origin) and `tools/river-map.mjs out.png -140 -260 120 -60` for the plan. Use ffmpeg for the tour mp4.

## How to work
Work autonomously and don't ask questions. Log assumptions and tuned values (old → new, with the reason) in an append-only `docs/OPUS-SUBURB-LOG.md`. First record baseline numbers (draw calls and triangles at the site views, `deploy:dist` first-load MB, and the test count). Then write a component checklist (streets, lots, props, vehicles and bus, life, lighting and skins) with these targets, which one probe script reports on every build:
- 20–30 lots, each with a house, driveway, lawn, mailbox and bins.
- At most **150** added draw calls at the site view (instance everything).
- At most **3 MB** added first load after Draco.
- `audit:roads` **0 open**.
- `sim:collisions` **all zero** (car-car, car-person, people on the road).
- The full suite passes, with new tests in `tests/maple-hollow.test.mjs`: lot count, every lot reachable from the network, no overlap with other regions, the woods or fair lot, bus route on roads, and residents' schedules covering home, work and school.
- 60 fps on a mid-range laptop is not regressed.

Give one sub-agent or lane per component. Each owns its files (an OWNER header at the top of every new file) against a short contract doc, and the town keeps running. Loop: a separate harsh **blind critic** sees before and after shots, and Maple Hollow next to gold stills 1 and 2, in random order. It says which is better and lists fixes. Iterate until critics can't pick the gold reference out reliably and are wowed. Judge motion and life, not just stills. Revert anything that makes things worse. Ashe's instructions override critics.

## Deliver
- Commits on `village/opus-suburb`, local only, never pushed and never force-pushed, with a CHANGELOG entry.
- `shots/opus-suburb/after-*.png` for the same views as the before shots, plus a day, dusk and night set and one shot per skin.
- `shots/opus-suburb/tour.mp4` (about 30–45 s): the morning bus run, after-school yards, a BBQ evening and lights at night.
- A final side-by-side with critic scores, probe numbers before and after, and run instructions in `docs/OPUS-SUBURB-LOG.md`.
- A hand-off note listing the deploy step that needs Ashe (Blob model re-upload).
