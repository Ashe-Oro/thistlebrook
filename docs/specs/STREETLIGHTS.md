# Build "Streetlights", a night-lighting fix so every lamp post in Thistlebrook turns on at dusk and reads a bit brighter.

## Reference

Ashe's dusk/night screenshot of Market Square (`id: 'market'`, also named Market Square in `src/compiler/astra.js`): `shots/streetlights/ashe-ref.png` (same file at `/workspace/scratch/streetlights/ashe-ref.png`). Iso view of the residential/market block: half-timber houses with red, olive and navy roofs, the stone well with a wooden roof near the centre, a notice board, bunting, the lakeshore at bottom left, and a white car.

Several black lamp posts in that frame have no glow: along the left street, at the right edge, and near the bottom centre. A few, including the one by the white car and the one by the water, do glow.

Good looks like that same block at dusk/night with every visible lamp post lit (warm emissive head plus a soft ground pool), and the same standard applied across the whole town, not only this block. Keep the cel look. Do not blow the highlights or flatten the night.

## Details

Every placed lamp post in the town lights at dusk and night. No missing, orphaned, or dark posts. This includes, at least:

- Hand-placed `cv-streetlamp` props in `town.props` (Market Square and the other compiler/astra lists).
- Street-plan kerbside lamps from `src/astra/street-plan.js` (`city-lamp`, `cozy-lamp`, `sub-lamp`) instanced in `src/astra/traffic.js`. These are the likely dark posts in Ashe's shot: night glow/halo/pool in `src/astra/world.js` and `src/astra/lighting.js` currently attach only to `town.props` entries with `id === 'cv-streetlamp'`.
- Other placed lamp posts (Maple Hollow streetlamps, work-district and fairground lamps, railway station lamps, and the legacy `?life=1` day/night path in `src/life/daynight.js`, which caps `scene.add(light)` at 10 PointLights).

Root-cause the miss before changing brightness. Confirm or disprove the street-plan registration gap (and the 10-light cap on the legacy path), and fix every real cause you find (budget, pool limit, distance culling, unregistered lamps, or a model variant missing an emissive).

Raise brightness about 30–50% for both the emissive glow at the fixture and the light pool on the ground, without blowing out the cel look or tanking FPS. Prefer the existing cheap decals / lantern halos / instanced pools. Do not add a PointLight per street-plan lamp; there are many of them. Maple Hollow already has its own instanced pools — keep that pattern working and include it in the brightness pass if those are lamp posts in the town.

Do not move or remove lamp posts. Do not restyle the models. Do not change day lighting. Do not merge, push, or publish.

## Tools

Work only in this worktree (`/workspace/cel-town-wt/streetlights`, branch `village/streetlights`, base `7b03f88`). Do not touch `/workspace/cel-town-git`. Use the existing Three.js lighting, street-plan, world, and test helpers (`compileWorld`, `planStreets`, `createTrafficSimulation`). No new asset packs. No generated or hand-drawn art.

## How to work

Autonomous, no questions. Log the root cause and the old-to-new brightness values in a short note at the top of a new test file or in `docs/specs/STREETLIGHTS.md` (an "Outcome" section is fine). Add an automated test that every placed lamp post (all of the sources above, including street-plan `kind === 'lamp'` items) has a light or glow entry, and that the entries stay in 1:1 correspondence — no orphans, no dark posts. Run that focused test. Do not run the full `test:ci` suite (the parent will). Do not take screenshots (the parent will). Do not commit, merge, or push.

## Deliver

Code changes in the worktree, a CHANGELOG entry under Unreleased (same tone as the existing entries), the new test, and a brief written root cause plus the brightness change. Leave the working tree uncommitted.

## Outcome

**Root cause (confirmed).** The night glow (the bulb and ground pool in `world.js`, and the halo in `lighting.js`) was attached only to `town.props` entries with `id === 'cv-streetlamp'`. On seed 831 that is 6 posts. `planStreets` places 112 more kerbside lamps (86 `cozy-lamp`, 23 `city-lamp`, 3 `sub-lamp`), and `traffic.js` instanced them with no glow at all. These are the dark posts in Ashe's shot. The Suburban lamp's glass glows only inside Maple Hollow's shader, so the street-plan copy had no emissive either. Other gaps found in the same pass:

- Merrymead Park (5 posts) had no glow.
- Sunbeam Court (3) had PointLights but no lit head.
- Civic Green (7), the Works yard (5) and the railway platforms (8) had heads but no ground pool.
- Funfair Parking pooled only every third lamp (`i % 3`).

**Disproved.** The legacy `?life=1` 10-PointLight cap does not leave any post dark. Every lamp there keeps its lens, and `lighting-polish.js` gives each one its own pool. The cap stays for FPS. No pool limit or distance culling was involved: the new instanced batches compute bounds from their instances, and halos are not frustum-culled.

**Fix.**
- `src/astra/lamp-posts.js` is a pure registry of all 205 posts. Each entry records its source, fixture head and glow owner. The modules that place hand-written posts now read their coordinates from it.
- `src/astra/lamp-glow.js` gives every post that lacks a glow an instanced head, pool and halo. That is 3 draws per district and no PointLights. Its materials are shared, so `world.update` drives the night factor and `lighting.setSkin` styles the halos.
- `tests/streetlights.test.mjs` checks 1:1 coverage for every source and that there are no orphans or duplicates.

**Brightness** (full night, old → new, `src/astra/lamp-look.js`):

| Glow | Old | New |
| --- | ---: | ---: |
| Ground pool opacity (props + shared glow) | .60 | .84 |
| Lantern halo alpha | .27 | .38 |
| Maple Hollow lamp glass emissive | 1.6 | 2.2 |
| Maple Hollow pools | .80 | 1.12 |
| Kit lamp pools (midway, coast) | .48 | .67 |
| Harbour quay PointLights | 2.5 | 3.5 |
| Sunbeam PointLights | 5 | 7 |
| `?life=1` lamp light / pools | 16 / .80 | 22 / 1.12 |

**Not verified here.** The lamp GLBs are not in this worktree, so the City and Suburban head offsets (`LAMP_FIXTURES`) come from the bounds in `FURNITURE_MODELS`. They are not measured from the meshes. Night screenshots should confirm that the heads sit in the lanterns.
