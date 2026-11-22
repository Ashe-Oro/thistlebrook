# Build "Sunbeam Mall", a north–south pedestrian promenade in Thistlebrook, like Denver’s 16th Street, on the Sunbeam Terrace block.

## Reference

Ashe photographed the live town (https://thistlebrook.vercel.app) at 12:24 PM ET on 22 Nov 2026. The shot is a phone view of the three-storey pastel row apartments (blue, yellow, pink facades) around the small paved court at Sunbeam Terrace, with a ferris wheel in the upper left of the frame and a cafe at the bottom. His words: “turn these apartment buildings 90 degrees so that the street goes north and south. Add more apartment buildings and make this a big walking area, almost like 16th Street in Denver. I want this to look very lively with a bunch of little shops and people playing, sitting out there playing chess … a typical retail area for businesses, but also office apartments on top with a big walking area in the middle.”

That block is Sunbeam Terrace today, not Coral Coast (already a north–south beach strip) and not Old Town Centre. Confirm in the compiled seed-831 town: custom `sunbeam-rowhouse` buildings around an east–west pedestrian court at world x about −144…−108, z about −69…−34 after `DISTRICT_OFFSETS.sunbeam` of [−65, 0]. Layout lives in `src/astra/sunbeam-layout.js`; mesh, courtyard life and dusk in `src/astra/sunbeam.js`. Current court road: local [−77, −52] to [−40, −52], marked `kind: 'pedestrian'`. Before stills: `shots/astra-homes/03-sunbeam-terrace.png` and `07-sunbeam-mobile.png`, plus new before captures you take on this branch before editing.

16th Street gold (reference only, do not copy brands, buses, or construction fences) lives in `/workspace/scratch/sunbeam-mall-refs/` and on Wikimedia Commons:

| File | What to match |
| --- | --- |
| `16th_Street_Mall_northwest_past_Tremont_Place.jpeg` | Gold along-mall view: a wide pale paved walk, a line of trees in planters down the spine, globe lamps, shopfronts and awnings on both sides, cafe umbrellas and seating spilling a little onto the sides, people strolling. The centre is for walking, not a traffic lane. |
| `16th_St_Plaza.jpg` | Patterned paving and a continuous shop wall; trees in boxes; the mall is clearly longer than a courtyard. |
| `Lunch_time_(3060827304).jpg` | Density of people, striped awnings, cafe tables, a kiosk or stall, tree shade. |
| `Crowded_Downtown_Sidewalk_(2804409846).jpg`, `Intersection_of_16th_Street_Mall_and_Lawrence_Street_in_Denver,_CO.jpg`, `16th_Street_Mall_Denver.JPG` | Mixed-use frontage, signs, window-shopping. |

Do not copy 16th Street’s 2025 centre transit lane or FreeRide buses. Ashe asked for a walking area in the middle. Keep Thistlebrook’s cel look and pastel facades; this is a village mall, not a Denver replica and not Vice Beach neon.

Gold stills, seed 831, hour 10.4 (and one dusk 19.5 if lights matter):

| View | Aim | Files |
| --- | --- | --- |
| Phone 390×844, similar zoom to Ashe’s shot / `?view=sunbeam` | A long north–south promenade reads immediately; buildings face it on both sides; the walk down the middle is wide and busy | `shots/sunbeam-mall/after-phone.png` |
| Desktop overview (~1440×900) | The mall is a distinct, longer walking street, not a small court; neighbours (Works, campus, bus loop) still read as themselves | `shots/sunbeam-mall/after-desktop.png` |
| Close-up of chess and cafe life | At least one chess table with two people sitting and playing, cafe seating, shopfronts and awnings, no props in the walk | `shots/sunbeam-mall/after-chess-cafe.png` |
| Along-mall view | Looking down the N–S axis: trees in planters, lamps, a clear centre walk, shop signs on both sides | `shots/sunbeam-mall/after-axis.png` |

A good after still: you can walk a straight visual corridor north–south; ground-floor shops have awnings or signs; upper floors read as apartments or offices; people are using the middle, not just decorating it.

## Details

Rotate the Sunbeam block 90 degrees so the street runs north–south (+z south, −z north). Keep the district on this west terrace. Add buildings and lengthen the promenade so it feels like a real mall, not a spun courtyard.

Survey the compiled seed-831 parcels before locking a footprint. Current reservation after the offset is about x −144…−108, z −69…−34. West Works sits further north after `DISTRICT_OFFSETS.works` ([0, −70]); the west island edge is near x −147; south of about z −29 the outline already cuts back. Extend the island only if needed, the same way Sunbeam first lifted the northwest notch, and never overlap West Works, Maple Hollow, the campus, the river, or drive the perimeter bus loop through the mall. The mall walk is pedestrian only. Aim for a promenade at least as long as today’s east–west court (~37 m) and preferably about 50–70 m if the land is clear. Log the final world rectangle.

Line both sides with mixed-use buildings, 3–5 storeys, pastel cel facades (keep the blue / yellow / pink and the existing Sunbeam palette). Ground floor is shops: storefronts, awnings, hanging signs, a little outdoor cafe seating that does not block the walk. Upper floors are apartments or small offices. Doors and approaches face the promenade and join the town graph. Raise the frontage count from 9 to at least 14. Keep the eight named residents (Nell, Otis, Cleo, Rafi, Mae, Sol, Zara, Emil), their homes, and Nell’s Corner and The Washhouse as shops among the new ones. Existing tests that hard-code nine homes and the old court bounds must be updated to the new plan, still checking that every Sunbeam door reaches school, The Reading Room, and Willowbank.

Down the middle: a wide paved promenade (clear walking corridor at least 4.5 m, preferably ~6 m) with trees in planters, benches, lamps, at least two chess tables with villagers sitting and playing, people strolling and window-shopping, plus a kiosk and a street-performer touch. Chess can be a small code-as-art table and chairs with seated `townsfolk-*` (there is no chess GLB in the owned packs). Ambient mall life uses instanced owned townsfolk, batched static furnishings, and the shared clock; it freezes when paused. Named residents keep normal navigation, greetings and night-home behaviour. Windows and lamps still light at dusk.

Walkable and dense, not cluttered: no props, chairs, planters, trees or kiosks in the centre walk or in door corridors. No footprint overlaps. Seeded trees stay out of the authored mall reservation. `audit:roads` stays clean in this area. Walking sims and `npm run sim:collisions` must pass, including walks along the mall and from new doors into the rest of town.

Out of scope: shipping, PRs, deploy, renaming the GitHub repo, moving the ferris wheel or Coral Coast, enabling a new default skin, or a ticket/economy sim.

## Tools

Work in `/workspace/cel-town-git` on branch `village/sunbeam-mall` (already created from current main). Do not create another worktree. The checkout has unrelated dirty files (deleted `out/*` logs, untracked `docs/specs/overnight/*`, `ci-bootstrap-out.txt`, `tools/hy3d-studio*`). Leave all of that alone; only add and commit mall files.

Use the owned threejsassets catalog (`/home/box/bin/tja search`, `tja pack`, `tja asset`). Good starting points: city / metropolis / cozy-village buildings and street furniture (apartment blocks at village scale, `corner-shop-01`, `cafe-terrace-01`, `flower-planter-01`, `plaza-bench-01`, `info-kiosk-01`, existing `cv-bench`, `cv-streetlamp`, cafe table/chair sets from city-paris or bookshop). Register new individuals with `tools/inventory-library.mjs` if they are not already in the catalog. Never commit GLBs or other licensed files; keep serving them through the existing `/workspace/threejs-assets` and `public/licensed` mapping. Skip realistic-city / highrise / cyberpunk / wasteland / Vice Beach neon unless a single prop still reads as cel Thistlebrook after the toon shader. Code-as-art Three.js is fine for paving, awnings, signs, chess tables and similar, in the same spirit as today’s `sunbeam.js`. Do not hand-draw or script painted bitmaps when a catalog mesh or simple procedural form will do.

Preferred files: extend `src/astra/sunbeam-layout.js` and `src/astra/sunbeam.js` (plus tests, shots, docs, CHANGELOG). Additive hooks in `src/compiler/astra.js`, camera / navigation / residents only if the new bounds or view require it. Do not rewrite unrelated districts.

Tests: update `tests/sunbeam.test.mjs`; add mall-specific checks (N–S promenade, ≥14 frontages, ≥2 ground-floor shops beyond the original two if you add them, two chess tables with seated players, a clear centre walk, graph connectivity, reservation vs trees). Run `node --test tests/sunbeam.test.mjs tests/astra.test.mjs`, `npm run test:astra`, `npm run test:checks`, `npm run audit:roads`, `npm run sim:collisions`. There is no `validate.py` in this repo; skip it. For a full `npm run test:ci` use `ASTRA_ASSET_ROOT="$(cat /workspace/scratch/ship-fastload/ci-asset-root.txt)"` if time allows after the focused suite is green.

Shots and perf use playwright-core and `/usr/bin/google-chrome` with the same SwiftShader flags as `tools/phone-smooth-probe.mjs`. Pick a free port, not 5173. Write stills and a small evidence JSON to `shots/sunbeam-mall/`. Perf: phone6 profile (390×844, DPR 3, 6× CPU throttle) on `?view=sunbeam&seed=831&hour=10.4`, recording fps and load / ready time before and after. Put probe JSON under `/workspace/scratch/sunbeam-mall/` (not in git) and summarise the numbers in `docs/specs/SUNBEAM-MALL-LOG.md`. Before shots and the before probe must be taken on the untouched layout.

On this shared box, run at most one heavy job of your own at a time (a Cornhole Codex job may already be running). Leave CPU and memory for others. Stop servers, browsers and temp processes you start. Never push, never deploy, never force-push, never print secrets, never copy licensed files into git.

## How to work

Autonomous, with no questions. Log assumptions, the final parcel, frontage count, promenade length and width, and old→new values in the append-only `docs/specs/SUNBEAM-MALL-LOG.md`.

Measurable targets:

- Promenade axis is north–south. A straight clear walk of ≥ 4.5 m width and at least the old court length (prefer 50–70 m) exists down the middle.
- ≥ 14 mixed-use frontages, 0 footprint overlaps, doors on the mall, both sides lined.
- ≥ 2 chess tables, each with two seated players in the plan at hour 10.4; ≥ 1 cafe seating cluster; ≥ 1 kiosk; ≥ 1 street performer; visible strollers / window-shoppers.
- Every Sunbeam door still paths to school, The Reading Room, and a Willowbank home. `sim:collisions` stays 0. `audit:roads` has 0 new opens from this work.
- Phone 390×844 and desktop stills as in the table. A blind critic, shown before/after in random order, should pick after as the livelier, clearly N–S mall and must not prefer before for walkability. If a change blocks the walk or fights village scale, revert it. Ashe’s words override critics.
- Phone6 fps and ready time are recorded before and after. Do not tank the phone profile: instance repeated props and people, batch static mall meshes, and note the draw-call / triangle delta. A small cost is acceptable for the added life; a large stall or missing first view is not.

Keep looping on layout and life until the gold stills hold and the tests pass.

## Deliver

Local commit(s) on `village/sunbeam-mall` only. Include a CHANGELOG entry under Unreleased, this spec, the decisions log with parcel and probe numbers, updated `docs/SUNBEAM.md` if the bounds or view change, tests, and stills in `shots/sunbeam-mall/`. Do not push or deploy. In the final summary state: branch and SHA, what changed, promenade length/width and frontage count, test results, before/after phone6 fps and load time, shot paths, and any decision that needs Ashe’s input.
