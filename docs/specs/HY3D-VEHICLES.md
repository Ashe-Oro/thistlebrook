# HY3D vehicles: generated Tesla/SpaceX cel models in Thistlebrook

Ashe, 20 Nov 2026 (America/New_York): approved putting the 4090-generated Tesla/SpaceX models into the game, with the Roadster redone as the **new white Roadster** Tesla revealed on 15 Oct 2026 at SpaceX McGregor, Texas. Nothing goes live: this branch waits for Ashe's sign-off on before/after stills.

Worktree `/workspace/cel-town-wt/hy3d-vehicles`, branch `village/hy3d-vehicles`, from local main `4bf9465` (live). Commit locally only. **Do not merge, push, deploy, or run `npm run models:upload`** (it moves the private Blob pointer that CI deploys from).

## Inputs already in place

- `src/astra/hy3d/models.json`: the shipped set (slug, source GLB, look `tex`|`flat`, triangle budget, texture size, real-world dims in metres).
- `tools/build-hy3d-models.mjs` (add `"models:hy3d": "node tools/build-hy3d-models.mjs"` to package.json): reads `/workspace/shots/tesla-hy3d/processed/*.glb` (box-only pipeline output), simplifies, shrinks the texture to JPEG, Draco-compresses, writes `public/licensed/hy3d/<slug>.glb` (gitignored, like pack models). Already run: 13 models, about 0.7 MB total. `roadster-white` lands later; code must tolerate it (or any model) being missing.
- Each built GLB: one node, one mesh, one primitive (POSITION, NORMAL, TEXCOORD_0 for `tex`; no UVs for `flat`), one material. Units are metres, ground at y=0, long axis on +Z (vehicle front = +Z; verify per model visually/with bounds and add a per-slug yaw fix in models.json if any faces -Z), centred on X/Z.
- Shared loader: `src/gltf-loader.js` (`createGLTFLoader()` already wires Draco + meshopt). Toon: `src/toon.js` (`toonMaterial(color)`, `outlineMaterial(thickness)`, `toonVertexColorMaterial()`, `RAMP`).

## What to build

### 1. `src/astra/hy3d/index.js`
- `loadHy3dModels({base = import.meta.env?.BASE_URL ?? '/'} = {})` → `Promise<Map<slug, {geometry, material, outline, dims}>>`. Loads every manifest entry in parallel through the shared loader; a failed/missing file just leaves that slug out (log once with `console.warn`, never throw). Cache the promise (module-level) so callers share it.
- Materials: `tex` → a `MeshToonMaterial` using the existing toon ramp (`RAMP` / same gradientMap as `toonMaterial`) with `map` = the GLB baseColor texture (`colorSpace = SRGBColorSpace`), color white. `flat` → `toonMaterial(entry.color)`. One shared material per slug. Ink: one shared inverted-hull mesh per slug using `outlineMaterial(...)` with the same thickness convention as the procedural cars (≈ .011 for cars in car-local units, .016 for the Semi; scale appropriately for rockets). Mark hull meshes `userData.outline = true` as elsewhere.
- Pure helpers usable in Node tests without a browser: `hy3dTemplateFromGeometry(slug, geometry, {map})` (so tests can build fake templates from a BoxGeometry), and `fitToFootprint(dims, target)` returning the uniform scale + offset that fits the model's real-world box into a target `{width,length,height}` (fit by length, clamp so width never exceeds target width).
- Node / test environments: `loadHy3dModels` must resolve to an empty Map when there is no `fetch`/DOM, so every existing test still runs against the procedural fallback.

### 2. Tesla factory (`src/astra/tesla/models.js`, `lineup-models.js`)
- `createTeslaVehicle(kind, {color, scale, hy3d})`: when `hy3d` (the Map) has the slug for `kind`, build the generated body; otherwise keep today's procedural body unchanged.
  Kind → slug: `roadster`→`roadster-white`, `sedan`→`model-3`, `crossover`→`model-y`, `cybercab`→`cybercab`, `cybertruck`→`cybertruck`, `semi`→`semi`, and new kinds `model-s`→`model-s`, `model-x`→`model-x` (add `TESLA_STYLES` entries for these two at the same ≈0.49 units/metre the others use: Model S 4.97 m, Model X 5.04 m; derive width/height from models.json dims).
- **Contract stays identical**: root (+Z forward, ground origin) → `userData.pivot` group at y=.43 → body at -.43; `userData.kind`, `userData.dimensions` = **exactly the same `TESLA_STYLES` width/length × scale as the procedural car** (traffic footprints, the arena row and every clearance test depend on these), `userData.jets` group, `userData.wheelRadius`, `animate({distance, braking, night, stage})`, `dispose()` (must not dispose shared template geometry/material). The generated mesh is scaled with `fitToFootprint` into the spec box.
- Wheels are baked into the generated mesh. `userData.wheels` becomes an array of invisible `Object3D` stand-ins at the procedural wheel positions (4, or 6 for the Semi) so code and tests that iterate wheels keep working; spinning them is a no-op visually. Note this in the spec outcome.
- **Lamps**: keep the procedural emissive head/tail meshes (`userData.lamp = 'head'|'tail'`, `stageLamps(...)` unchanged) but size/place them on the generated body: two head lamp strips at the front face and a tail bar at the rear face, at heights measured from the generated mesh (sample the mesh's front/rear extremes at the lamp band, sit 1–2 mm proud of the surface). For roadster-white the tail is the full-width red light bar. Update `CAR_LAMPS` in `src/astra/night-landmarks.js` (halo/beam fixtures) so the night halos/cones sit on the new lamp positions whenever the hy3d body is used — export one source of truth for lamp spots per kind from the factory and have night-landmarks consume it (with the procedural values as fallback). Headlights must visibly sit on the new cars at night.
- Draw calls per generated car: body (1) + hull (1) + head (1) + tail (1). Share geometry/material across copies.
- Roadster performer: same pivot/jets/cold-gas puffs/suction fans as today where they still make sense (keep the jets group and puff emitters; drop procedural fan housings only if they visibly clash). The 87-second show, `roadsterPose`, ramp contact tolerance and all clearance tests must still pass.

### 3. Wiring
- `src/astra/main.js`: start `loadHy3dModels()` early (in parallel with world/resident/traffic loading, not serially after), `await` it right before `createTeslaTown(...)`, and pass `{traffic, residents, hy3d}`. `createTeslaTown` → `createDemoArena(root, {residents, hy3d})` → lineup uses `createTeslaVehicle(kind, {..., hy3d})`; the performer Roadster too.
- Starbase (`src/astra/expansions.js` → `buildStarbase`, `src/astra/starbase.js`, `starbase-models.js`): pass `hy3d` through. Replace the **static display Starships** (`statics` loop, kind `'ship'`) with the generated `starship` (flat toon steel + ink), scaled to the procedural ship's height and centred where it stood, **before** `batchStatic` (it batches by geometry+material, so shared template geometry instances fine). For the flying `vehicles.ship`, swap only the visual body inside `rocket('ship').root` if the bounds match within 10% and the flame/aviation-beacon follow points still sit right; otherwise leave it procedural and say so. Keep the procedural Super Heavy booster, Falcon 9 / Falcon Heavy side boosters and upper stage (they need legs, separation and grid fins). Do **not** use `falcon9` in this pass.
- Fire tender: no generated fire engine exists; leave `af-fire-tender` (Airfield fuel truck) as is.
- **Road traffic stays pack-only (TOWN-27).** `installTeslaTraffic` stays at `count:0`. Do not add generated cars to `traffic-fleet.js`.

### 4. Natural homes for the other models (arena annex only)
The arena annex is world X [-88,-42], Z [-83,-41] in arena docs (it is offset by `WORLD_OFFSETS.roadster` at runtime; work in arena-local coordinates, origin DEMO). Add a small **Supercharger bay** on the annex apron, clear of: the ramp, the run-up/vault/touchdown corridor (`ROW_AXIS`, `LINEUP_JUMP`), the hover pad and its approach/return paths, the grandstand bounds, the campus walk connection, and the stadium mast fixtures:
- 4 Superchargers (instanced) in a row with a painted bay, a **Model S** and a **Model X** parked nose-in charging (hy3d, else procedural fallback), one **Megapack** behind the row, one **Powerwall** on a short wall or the Megapack end.
- 2–3 **Optimus** robots as pit crew standing by the lineup / charging bay (static, facing the action; a tiny idle bob is fine). Real-world scale: Optimus 1.73 m at the same ≈0.49 units/metre (DEMO.carScale applies to the arena cars; match whatever scale the lineup cars visually use so Optimus reads human-sized next to them and next to the spectators).
- Props at night: the Supercharger screens/LEDs may get a small emissive accent via the existing landmark night factor; no new lights.
- Add their bounds to `arena.audit()`.

### 5. Hosting / budget
- `tools/prepare-deploy-dist.mjs` must copy `licensed/hy3d/*.glb` into dist (it discovers URLs by scanning src for `licensed/...` strings and JSON; make sure the manifest's `dir` + slug URLs are discovered — add an explicit `addUrl` loop over `src/astra/hy3d/models.json` if the scanner doesn't see them). `compress-dist-glbs.mjs` will see already-Draco files; make sure it keeps them (or skips them) without breaking validation.
- Run `npm run deploy:dist` locally to confirm the files land in `dist/licensed/hy3d/` (do NOT upload). Report total added bytes.
- CI note for the spec outcome: at merge time the pack must be re-uploaded (`npm run deploy:dist && npm run models:upload`) or CI will lack `licensed/hy3d/`; the runtime fallback means a missing file degrades to procedural cars, never a crash.

### 6. Rule + tests
- Add **TOWN-29 · Generated models keep the authored footprint** to `docs/TOWN-RULES.md` (dated 2026-11-20, quote: "Is the vehicles, altho the roadster should be the new white version that was demoed a few weeks ago"): a generated (hy3d) body replaces only the look. Its published dimensions, collision/traffic footprint, lamp spots and show clearances are those of the authored vehicle it replaces; each shipped GLB stays within its triangle budget and the set stays under 1.5 MB; a missing model falls back to the procedural one. Road traffic stays pack-only (TOWN-27).
- `tests/hy3d-vehicles.test.mjs` (Node, no browser) asserting at least:
  1. models.json is well-formed; every `look:'tex'` has a texture size, every entry has dims and a budget; slugs map from every Tesla kind used by the arena.
  2. With fake templates (BoxGeometry via `hy3dTemplateFromGeometry`), for every kind: `userData.dimensions` equals the procedural car's dimensions (same scale), wheel stand-in count is 4 (6 for Semi), head/tail lamp meshes exist and sit at the body's front/rear (z within 5% of ±length/2) and inside the width; draw calls (visible meshes) ≤ 4; `dispose()` leaves the shared template geometry intact.
  3. Fallback: with an empty Map every kind builds the procedural car exactly as before.
  4. Arena with fake templates: the full lineup clearance/row-axis checks from `tests/astra-tesla.test.mjs` still hold (reuse its helpers), and the Supercharger bay / Optimus / Megapack / Powerwall bounds do not intersect the Roadster's swept trajectory footprint (sample `roadsterPose` over the full 87 s loop), the grandstand bounds, the ramp, or the hover pad.
  5. Starbase with a fake `starship` template: static display ships use it, heights match the procedural ship within 10%.
  6. If `public/licensed/hy3d/build-report.json` exists: every model ≤ its triangle budget, total ≤ 1.5 MB (skip with a message when absent, e.g. CI before models:fetch).
- Night lamps: `tests/night-landmarks.test.mjs` must still pass; extend it if lamp spots now come from the factory.
- `npm run test:ci` must pass completely (no `npm test` script exists). Also run `npm run build`.

### 7. Docs
- Append an **Outcome** section to this file: what replaced what, wheel stand-ins, lamp placement, draw calls, bytes, what stayed procedural and why.
- CHANGELOG `## Unreleased` entry at the top: "**Generated Tesla and SpaceX models.**" in the same voice as the neighbouring entries, ending with "This change awaits Ashe's sign-off on the stills." Link this spec.
- Commit locally on `village/hy3d-vehicles` with clear messages. No GLBs, photos or `public/licensed` content in git.

## Constraints
Leave the favicon alone. Do not touch Crayon, Thistlebrook 2D, Agent Pixel, or unrelated districts. Never force-push. Never print secrets. Keep the toon look: hard bands, authored colour, ink outline. Port 5194 is the dev port convention for captures (`npm run dev -- --port 5194 --strictPort`), but screenshots are taken by the coordinator; you do not need to produce stills.

## Outcome

- The Cybercab, Cybertruck, Semi, Model Y and Model 3 use the generated lineup bodies when available. The north apron has four instanced Superchargers, a nose-in Model S and Model X, a Megapack, a wall-mounted Powerwall and two Optimus pit crew. The arena audit reports their local bounds.
- The arena keeps its authored dimensions, pivot and 87-second choreography. The fit uses measured mesh extents and a uniform scale, so wide generated meshes occupy less of the authored length. Wheels are baked into the meshes. Four invisible wheel anchors, or six on the Semi, preserve the animation API. Spinning the anchors has no visible effect.
- Each generated car makes four visible draws during the show. The body and ink hull share the template geometry, and one draw each carries the projected front strips and rear bar. The lamp strips follow the mesh surfaces, about 1.5 mm proud in car-local units. The night halos and cones use those same measured positions.
- The performer uses the new white Roadster and falls back to the procedural white car when the GLB is unavailable. The generated body includes a full-width red tail bar, keeps the jets group and existing cold-gas emitters, and supplies the visible underbody where the modeled floor occupies the old fan and nozzle housing space. The fitted white mesh passed the full-loop clearance checks, including 0.0399 units of maximum overlap on the curved ramp against the 0.04-unit allowance.
- The two Rocket Garden Starships use the generated flat steel model, batched at the authored 12-unit height. The flying Starship keeps its procedural body. At that height the generated ship spans about 2.49 units across, compared with about 5.58 units including the flight model's fins, exceeding the 10% tolerance. The recovery cargo, Super Heavy, Falcon stages and flight fittings stay procedural. The fire tender and ordinary road traffic stay pack-only. The generated Falcon 9 is packaged but unused in the scene.
- Local packaging verified 14 already compressed GLBs in `dist/licensed/hy3d/`, totaling **836,736 bytes**. Powerwall was rebuilt to its 1,000-triangle budget. The browser reached the ready state both with the full set and during the earlier run with the expected optional Roadster 404. The Cybertruck is rotated 180° to correct its heading. The Supercharger is rotated 90° to face its screen toward the bays.
- When this change is approved for merge, the licensed pack needs to be rebuilt and re-uploaded with `npm run deploy:dist && npm run models:upload` so CI receives the HY3D files. A missing vehicle file selects the procedural body. Missing optional charging equipment and robots are omitted.
