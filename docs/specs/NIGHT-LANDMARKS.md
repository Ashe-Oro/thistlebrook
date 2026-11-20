# Night landmarks — Starbase and the Roadster arena

Ashe, 19 Nov 2026 (America/New_York): "starbase and tesla need a lot more impressive lights at night."

This is a visual showpiece pass for after dark. Build it on this branch. Do not merge to main, push, or deploy. Ashe reviews stills and signs off before anything ships.

Read this file and do it. Commit locally when the work and tests are in.

## Context

Local main is `/workspace/cel-town-git` at `4188638` (live). This worktree is `/workspace/cel-town-wt/night-landmarks` on `village/night-landmarks`, branched from that tip.

Follow the streetlights pass (`village/streetlights`, commit `c6822a4`):

- `src/astra/lamp-posts.js` — pure fixture registry
- `src/astra/lamp-glow.js` — shared instanced heads, pools, additive halos; **no PointLights**; one `setLampNight()` drives the town
- `src/astra/lamp-look.js` — brightness constants; heads switch on at `LAMP_LOOK.headOn` (0.2)
- `tests/streetlights.test.mjs` — coverage and on/off behaviour

Reuse those modules where it is sensible (shared night factor, pool/halo patterns, instancing, material sharing). Do **not** register tower floods, beacons, or stadium masts as lamp posts. They are a different kind of fixture.

Leave the favicon alone. Licensed binaries stay in the gitignored `public/licensed/`. Do not add, commit, or rewrite pack files. Do not force-push. Do not touch unrelated districts except to hook a shared night helper.

## What is already there

**Starbase** (`src/astra/starbase.js`, `starbase-models.js`, `starbase-flight.js`):

- Root is named `Starbase Texas`, placed at `STARBASE_ORIGIN = [145, 50]`. Expansions then shift the frame by `WORLD_OFFSETS.starbase = [80, 230]`.
- Mechazilla lattice at local `(11, -24)`, columns up to y≈36, cap at y=36.5–37.3. Starship pad is a 10.5-radius concrete cylinder at `(20, -24)` with a flame trench to the south. Falcon pad and hinged strongback at `(48, 12)`, strongback ~18 m tall. Three slim poles with gold tips already stand at `(39, 7)`, `(57, 7)`, `(57, 20)`, height 20.5 — they look like unlit airfield lights.
- Cryogenic tank farm: six vertical tanks around `(28–38, -11 / -4)` plus three horizontal tanks and transfer pipes.
- LZ-1 `(-8, 43)` and LZ-2 `(27, 55)` already have a ring of 12 gold orbs each — unlit.
- Rockets are procedural toon meshes (`rocket()`), including the ones on the mounts and the rocket garden.
- `batchStatic(statics, root)` runs at the end of `buildStarbase`. Anything that animates or changes material at night must **not** go through `batchStatic`. Put lights in `moving` or a dedicated lights group added to `root` after batching.
- `api.update(t, night=0, hour=10)` already receives the town night factor and the clock, but **ignores `night`**. Hook the new lights here. People visibility already uses `hour`.

**Tesla / Roadster proving ground** (`src/astra/tesla/arena.js`, `index.js`, `models.js`, `lineup-models.js`, `demo-motion.js`):

- Arena root is named `Roadster proving ground`, local origin `DEMO = {x:-65, z:-62, …}`. Tesla town root is then placed at `WORLD_OFFSETS.roadster = [-140, -110]`. World centre and the `roadster` camera view are `{x:-205, z:-172, zoom:2.65}`.
- Lot is a 46×42 cel stage: cream kerbs, dark inner surface, suction ramp on the west with cream edge ribbons, amber dashed row axis, hover-pad ring, five parked Teslas in the lineup, east-side grandstand with `ROADSTER PROVING GROUND` signs and a phase caption.
- Static arena geometry is merged into toon batches at the end of `createDemoArena`. Night-varying emissive strips and glow meshes must be **overlays**, not baked into those batches. Solid mast geometry can be toon (batched or not); the lamps and cones stay separate.
- `arena.update(time, pose, night=0)` already passes `night` into `lineup.forEach(o => o.userData.animate({night}))`. Head and tail lamps only retint after `night > 0.25` (`#fffde1` / `#fa7961`). That is too shy. Amplify it and add visible headlight beams. Do not break the 87-second show, ramp contact tests, or clearance tests in `tests/astra-tesla.test.mjs`.

**Clock.** `lighting.update` samples `LIGHT_KEYS` (`src/astra/light-cycle.js`). Index 9 is the practical-light / night factor already fed to `setLampNight` from `world.update`:

| Hour | Period | Night factor (approx.) |
| ---: | --- | ---: |
| 10.4 | Daylight | 0 |
| 17.4 | Golden hour | 0.08 |
| 18.4 | late golden / dusk blend | 0.42 |
| 19.3 | Dusk preset | 0.86 |
| 20.5+ | Moonlight | 1 |
| 21.0 | Moonlight | 1 |
| 6.3 | Dawn preset | 0.30 |

Fixtures fade in with this factor and switch fully on past `LAMP_LOOK.headOn` (0.2), same as streetlamps. They fade out through dawn. Drive them from the `night` argument already threaded into Starbase and the arena. Do not invent a second clock.

Default cel lighting has no extra bloom pass in `lighting.js`, but skins (`src/astra/skin/post.js`) bloom bright values at night. Make glow meshes bloom-friendly (additive, high value) so they pop on cel and bloom more on those skins. **Do not add a new postprocessing pass or EffectComposer.**

## Artistic direction

These two sites should feel like the night-time landmarks of the map — impressive from the district view and still readable in a closer framed shot. Keep the cel / toon look: hard shapes, authored colour, ink on solid fixtures. Glow is additive and slightly larger than life, not photoreal IES profiles.

**Starbase — cool industrial, with red aviation punctuation.**

- **Launch-tower floodlights and light beams.** Banks of floods on Mechazilla (top platform and at least one mid-level deck) aimed at the Starship pad and the stacked vehicles. Visible downward cones. Two to four tall, slender sky beams (searchlight columns) from the tower or pad corners, angled slightly off vertical so they read in an isometric view — this is the money shot. Cool white, maybe a hint of steel blue. Uplights at the base of the four lattice columns so the tower itself is a lit object, not a silhouette.
- **Glowing tank farm.** Emissive hoops or mid-tank bands on all six vertical tanks, a soft body wash, ground pools on the apron, and a faint cool/cyan frost feel on the pipes. Keep it lit and busy, not a nuclear glow.
- **Red aviation warning beacons.** Blinking red beacons on the Mechazilla cap (and a mid-tower beacon), the Falcon strongback top, the three existing 20.5 m poles (turn those gold tips into real beacons or add a beacon on each), and on the tall rockets (mount vehicles when visible, and the garden stacks). FAA-like: saturated red, period about 1–2 seconds, opacity or emissive pulse in `update(t)`. Synchronised or with a slight offset. No mesh churn — pulse existing materials.
- **Lit rocket hull with uplights.** Ground-level uplight cones on the Starship / Super Heavy on OLP-1 and Falcon on LC-2 so the stainless hulls catch a vertical wash. Prefer additive cones / sprites over rewriting `rocket()` toon materials. A thin additive rim or a few emissive body strips is fine if it stays cel. Flames already use `MeshBasicMaterial`; do not disturb burn / smoke logic.
- **Lit pad and a light-up perimeter.** A large ground pool and a glowing ring on the Starship pad (the existing pale ring can go emissive). Same idea, slightly smaller, on the Falcon pad. Flame-trench edges pick up a low warm or hard-white line. The gold orb rings on LZ-1 and LZ-2 light up (steady or a slow pulse). A sparse necklace of apron / perimeter fixtures around OLP-1 and LC-2 so the complex has a drawn outline at night. The `STARBASE / TEXAS` garden sign can get a modest backlit treatment; the launch site is the hero, not the highway.

**Tesla arena — warm stadium / show lights, cream and amber.**

- **Stadium floodlight masts with visible cones.** New authored masts (four lot corners, or four corners plus a pair covering the ramp) with a bank of lamps on a cross-arm. Toon steel / ink for the mast, bright lamp heads, wide downward cones that wash the ramp, the lineup, and the hover pad. These should feel like a small stadium, not traffic-light poles.
- **Grandstand lighting.** Under-board wash and a halo behind `ROADSTER PROVING GROUND`. Emissive or basic-lit row rails (the existing amber seat strips). A soft pool on the stand so spectators are not in silhouette.
- **Lit track edges and ramp LED strips.** Overlay emissive LED-like strips on the suction-ramp cream edges, the amber row-axis dashes, the takeoff / touchdown marks, and the hover ring. Thin, bright, slightly blooming. Daytime geometry stays as it is; the LED layer fades with night.
- **Glowing branded sign.** The front and back `ROADSTER PROVING GROUND` signs (and the phase caption) become backlit / emissive at night. A modest halo or backlight plane behind the board. Do not change the lettering or the show-phase update.
- **Headlights and taillights on the parked Teslas.** The lineup already has lamp meshes. At night they must read clearly: bright white (or slightly cool) headlights, red tails, and short fake headlight cones or ground slashes in front of each parked car. The performing Roadster should get the same brighter lamps so the show reads after dark. Keep `animate({night})` as the hook; raise the look without breaking braking tints or motion tests.

Colour: Starbase = cool white + ice cyan tanks + red beacons. Tesla = warm white floods + cream/amber LEDs + red tails. Do not turn either site neon-pink or skin-dependent.

## Performance

- **Few real lights.** Zero new shadow-casting lights. Prefer zero `PointLight` / `SpotLight` / extra `DirectionalLight`. If a single unshadowed fill is truly necessary, cap at **two** unshadowed lights total across both sites and document why. Almost everything is emissive meshes, additive cones, pools, and sprites.
- **Batch.** Instanced or merged meshes, shared materials, one night uniform (or one `setLandmarkNight(night)` alongside `setLampNight`). A handful of draws per district (masts, heads, cones, pools, beacons, strips) — not one mesh per lamp.
- **No new post process**, no extra render targets, no per-frame allocations in `update`.
- Beacons blink by pulsing uniforms / opacity / emissive, never by adding or disposing meshes.
- Cones and sprites: `depthWrite = false`, no shadows, tight-ish geometry. Sky beams must not tank fill rate — keep them few and modestly wide.
- Do not cause a big FPS drop. A small, documented draw-call bump is expected.

## Architecture

Suggested shape (you may tighten the names, not the ideas):

- `src/astra/landmark-glow.js` — shared cheap primitives and materials (cones, pools, halos, beacon bulbs, LED strips). Import-friendly from both districts. A `setLandmarkNight(value)` that the two `update` paths call. Reuse pool-texture / halo-shader ideas from `lamp-glow.js` rather than copying them blindly if a shared import stays cycle-free.
- A **pure fixture registry** (for example `src/astra/night-landmarks.js`, or one file per district) listing every fixture: site, kind, local position, aim, and role. Tests assert against this list the way `lampPosts()` is tested.
- `buildStarbaseLights(...)` wired from `buildStarbase` after `batchStatic`.
- `buildArenaLights(...)` wired from `createDemoArena` (or `createTeslaTown` if that is cleaner) without disturbing `grandstandBounds`, lineup poses, or `audit()`.
- Keep look constants in one place (a `LANDMARK_LOOK` or similar), including on-threshold, cone opacities, beacon period, and sign emissive.

Export enough for tests to build the glow, set night, and step time without booting the whole town if possible. If a test needs `buildStarbase` / `createDemoArena`, that is fine — those already run under `tests/astra-starbase.test.mjs` and `tests/astra-tesla.test.mjs`. Headless THREE meshes are enough; do not require Chrome for the automated check.

## Tests

Add `tests/night-landmarks.test.mjs`. It must assert at least:

1. **Fixtures exist.** Required kinds are present with a sensible minimum count:
   - Starbase: tower floods, sky beams, tank-farm glows, red beacons (tower, poles/strongback, rockets), pad pools/rings, perimeter or LZ lights, rocket uplights.
   - Tesla: floodlight masts and cones, grandstand lights, ramp/track LED strips, glowing sign, parked-car head and tail lamps (and headlight beams).
2. **On at night, off by day.** After `setNight(0)` / `update(..., night=0)` at hour 10.4, glow meshes are hidden or opacity/emissive ≈ 0. After `night=1` at hour 21, they are visible and clearly on (opacity/emissive above a real threshold, not just `> 0` on a 1e-8 default). Dusk (`night ≈ 0.86`) is on. The fade tracks the night factor (a mid value is between day and full night).
3. **Beacons blink at night.** Two different times in `update(t)` at `night=1` produce different beacon intensities; at `night=0` they stay off.
4. **Performance contract.** No new shadow-casting lights. `PointLight` + `SpotLight` count across the new fixtures ≤ 2, none with `castShadow`. No extra `DirectionalLight`.
5. **Rule hook.** `TOWN_RULE.nightLandmarks === 'TOWN-28'`. `docs/TOWN-RULES.md` has a heading that the existing sync test in `tests/grok-roads.test.mjs` will accept (see format below). The night-landmarks test itself is the automated check named in that rule.
6. **Wiring.** Source inspection (or a runtime hook) confirms `starbase.update` and the arena / tesla update actually drive the landmark night factor.

Do not weaken or rewrite existing Starbase flight tests or Tesla surface / clearance / show tests. If you must touch `rocket()`, `createDemoArena` audit output, or vehicle `animate`, keep those tests green.

`npm test` does not exist. You may run slices such as:

```
node --test --test-concurrency=1 tests/night-landmarks.test.mjs tests/astra-starbase.test.mjs tests/astra-tesla.test.mjs tests/streetlights.test.mjs
```

A later agent will run full `npm run test:ci`. Keep that suite green.

## Docs, changelog, rule

Add a CHANGELOG entry at the top of `## Unreleased` (same prose style as the Streetlights entry). Mention both sites, that lights follow the existing dusk/dawn clock, and that this is awaiting Ashe's visual sign-off. Link `[Spec](docs/specs/NIGHT-LANDMARKS.md)` and `[Captures](shots/night-landmarks/)` even if the capture folder is created later.

Copy or write the durable spec to `docs/specs/NIGHT-LANDMARKS.md` (this brief can stay at the worktree root as well). A short "Outcome" section at the bottom is welcome once you know counts.

Add **TOWN-28** in both `docs/TOWN-RULES.md` and `src/compiler/town-rules.js` (`nightLandmarks: 'TOWN-28'`). The sync test is:

```js
const headings = [...rules.matchAll(/^## (TOWN-\d+) .+\n\n(\d{4}-\d{2}-\d{2})\n\n> (.+)\n\n[\s\S]+?(?=\n## |$)/gm)];
assert.deepEqual(headings.map(([, id]) => id), Object.values(TOWN_RULE));
```

Insert the new rule **after TOWN-27 and before** `## Rules in progress on other lanes`. Exact shape:

```
## TOWN-28 · Starbase and the Roadster arena light up after dark

2026-11-19

> starbase and tesla need a lot more impressive lights at night

Starbase Texas and the Roadster proving ground are night-time showpieces: tower floods and beams, a glowing tank farm, blinking red aviation beacons, lit pads and perimeters, stadium masts and cones, grandstand and LED track lighting, a backlit sign, and bright headlights and taillights on the parked Teslas. Fixtures follow the existing day/night clock. `tests/night-landmarks.test.mjs` checks that the fixtures exist and are on at night and off by day.
```

## Commit

Commit locally on `village/night-landmarks` when the code, tests, changelog, rule, and spec are in.

- Do not push. Never force-push.
- Do not merge to main or deploy.
- Do not commit anything under `public/licensed/`.
- You do not need to capture screenshots; a later step will shoot night (21:00) and dusk stills into `shots/night-landmarks/`. Do not add huge binary stills unless you already produced small ones while working.
- Write a clear commit message in the same voice as `c6822a4` ("Light every lamp post at dusk…").

If a choice is ambiguous, pick the more impressive option that still respects the performance cap and the cel look.

## Outcome

Built on `village/night-landmarks`. Not merged, pushed or deployed. It is waiting for Ashe's sign-off on the stills.

**Shape.**
- `src/astra/landmark-look.js` is import-free. It holds `LANDMARK_LOOK` (strengths, beacon period, sign and car-lamp boosts), the two site palettes, and the `emitterLevel` / `beaconLevel` curves.
- `src/astra/night-landmarks.js` is the pure fixture registry. It lists 258 Starbase fixtures and 292 arena fixtures, each with a site, kind, role, render primitive and local position. None of them are registered as lamp posts.
- `src/astra/landmark-glow.js` holds the shared materials and turns any fixture list into at most 8 draws. `setLandmarkNight(night, t)` drives every fixture, the same pattern as `setLampNight`.
- `src/astra/starbase-lights.js` is wired from `buildStarbase` after `batchStatic`. `src/astra/tesla/arena-lights.js` is wired from `createDemoArena` after the toon batches.
- Both run from the `update(…, night)` calls the town already makes. There is no second clock.

**Behaviour.**
- Additive glow (cones, beams, pools, halos, washes) scales linearly with the night factor, like the streetlamp pools.
- Solid emitters (lenses, LED strips, rings, beacon bulbs) ramp in between 0.1 and `headOn` (0.2) and are fully on past it.
- All of it is hidden at 10.4 (factor 0) and on at dusk (0.86), moonlight (1) and the dawn preset (0.30).
- Beacons flash together on a 1.6 s period. The bulb colour and halo strength pulse; no meshes are added or removed.
- Fixtures on moving objects ride with them: rocket nose beacons, hull washes that fade as a vehicle climbs off the pad, the strongback beacon, and the Roadster's lamps and beams.

| Starbase kind | Fixtures |
| --- | --- |
| Tower floods | 8 banks (5 top platform, 2 mid deck, 1 low deck), each lens + halo + cone |
| Tower uplights | 4 column cones + base pool |
| Sky beams | 4 searchlights from the OLP-1 corners, 150 high, 11–13° off vertical, with toon drums |
| Tank farm | 12 ice hoops + 6 cap rings, 6 body washes, apron / tank pools, pipe frost |
| Red beacons | 20: cap + platform corners (5), mid tower (2), strongback, 3 poles, 6 flight vehicles, 3 garden stacks |
| Lit hulls | 9 uplight cones (OLP-1, LC-2, garden), 9 rim washes (6 follow the flight vehicles) |
| Pads | OLP-1 and LC-2 pools and emissive rings, inner mount ring, trench edge lines and floor glow |
| LZ-1 / LZ-2 | all 24 gold orbs lit with halos, target rings, pools |
| Apron necklace | 22 in-ground lights around OLP-1 and LC-2, clear of roads, trench, tower, tanks, pipes and poles |
| Garden sign | backlight card + ground pool |

| Arena kind | Fixtures |
| --- | --- |
| Stadium masts | 6 toon steel masts (4 corners on the verge + 2 covering the ramp), 8 lenses each, halos, a wide cone and a pool |
| Grandstand | amber seat-rail LEDs, front rail, 4 board downlights, stand pool |
| Sign | halo cards behind the front and back boards, LED top/bottom edges, board labels brightened ×1.55 at night |
| Track LEDs | both ramp edges (72 segments), the four kerbs, 32 row-axis dashes, takeoff and touchdown marks, hover ring and pool |
| Cars | head and tail halos, 2 headlight beams and a ground slash per parked car; the performing Roadster has the same halos and beams on its body |

The Tesla head and tail lamps switch to night white at `headOn` (0.2, previously 0.25). On stage (the lineup and the Roadster, `animate({night, stage: true})`), the head lamps go up to ×3.4 and the tail lamps to ×2.6 in HDR. The braking tint keeps its hue. Town-traffic Teslas keep their old colours.

**Cost.**
- No PointLight, SpotLight or extra DirectionalLight, and no new shadow-casting light. No new post pass or render target. `update` does no per-frame allocation.
- Starbase adds 10 meshes: 8 glow plus the toon housings and their ink. The arena adds 8: 4 glow plus the masts and their ink.
- Measured through the capture tool (`renderer.info` draw calls, baseline `4188638` → this branch):

| View | Night 21:00 | Day 10:40 |
| --- | ---: | ---: |
| `starbase` | 1115 → 1127 (+12) | 1120 → 1122 (+2) |
| `roadster` | 452 → 465 (+13) | 480 → 484 (+4) |

The skin bloom picks up the HDR emitters and additive glow. The default cel render has no bloom, so there they read as bright, hard shapes.

**Checks.**
- `tests/night-landmarks.test.mjs` covers fixtures, placement, the on/off fade, beacon blink, followers, the performance contract and the TOWN-28 wiring.
- `tests/astra-starbase.test.mjs`, `tests/astra-tesla.test.mjs` and `tests/streetlights.test.mjs` are unchanged and pass.
- `tools/shots-night-landmarks.mjs` shoots the night, dusk and day stills into `shots/night-landmarks/`. It needs a `vite build` and the licensed packs.
