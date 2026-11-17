# Edo villagers — 12 cel-shaded characters from owned rigs

Work only in `/workspace/cel-town` except to READ (and, if needed, COPY licensed files from) `/workspace/threejs-assets/`. Do not buy anything, do not git push, do not deploy, do not commit. Do not copy licensed GLBs anywhere except `public/licensed/` (already gitignored). No API keys. Do not run `npm install` / `npm ci`. Do not touch OK-COMPUTER or any RTX 4090 / Windows work. Do not start Neighborhood 2. Do not use PixelLab. Do not open a dev server, `vite preview`, `npm run shots`, or any local listener — you cannot, and screenshots will be taken after you exit.

You may run `npm run catalog:bounds`, `node tools/inspect-glb.mjs`, compile (`node tools/compile.mjs`), `npm run test:checks`, `npm run test:parity`, and `npm run build`.

When finished, write a short report to `out/codex-edo-villagers-report.md` listing: the 12 ids and display names; which owned body/style/wardrobe pieces each uses; which accessories you had to author procedurally and why; placement (x,z and street); idle vs walk; test results; anything you could not do.

## Context — what already exists

There are **no villagers / NPCs / characters** in cel-town today. Edo is neighborhood 1 (`?district=edo`, seed 1234). Streets and landmarks (world x,z metres):

| Street | From | To | Width |
| --- | --- | --- | --- |
| edo-approach | [-50,-58] | [-50,-100] | 3.2 |
| edo-lantern-lane | [-50,-100] | [48,-100] | 2.8 |
| edo-garden-walk | [-78,-94] | [-50,-94] | 2.0 |
| edo-shrine-approach | [12,-100] | [12,-132] | 3.2 |
| edo-tea-court | [-29,-100] | [-29,-84] | 2.0 |
| edo-precinct-walk | [-20,-128] | [42,-128] | 2.4 |
| garden / bridge loop | around the koi pond | see `src/compiler/edo.js` | 1.2 |

Key spots: teahouse [-73,-100], koi pond / arched bridge near [-68.5,-89] (bridge spans water), great torii [12,-123], shrine / worship hall around [0..12, -140], minka at [43,-106.5], merchant shops along the lantern lane. Camera-clear garden pocket `EDO_CAMERA_POCKET` x=[-87,-59], z=[-105,-74] must stay tree/bamboo/large-bush clear (villagers may stand at the edges, not block the teahouse sightline).

Default hamlet JSON and default large (no edo) JSON must stay **byte-identical** for seeds 1, 1234, and 7. Do not regress `window.__stage`, `__town`, `__post`, `__scene`, `__THREE`, `__renderer`, `__ready`, `?prmax`, `?shadowMap`. Fog for edo stays `[260, 540]`.

## Owned character sources (use these first)

Confirmed on disk, already owned, never buy:

1. **Character Model Basic** (toon, 65-bone Mixamo rig, styles `hero` / `vanilla` / `chunky`, palettes including `ninja`, `adventurer`, `autumn`, …)
   - `/workspace/threejs-assets/character-model-basic/x/character-model-basic-source-1.1.0/`
   - Engine: `src/vanilla/character.ts` (`createCharacter`, `loadCharacterGlb`), `src/character/`.
   - Pre-exported GLBs in `models/` (vanilla, hero, chunky). Draco; decoder already at `public/draco/`.
2. **Basic Character — Wardrobe** (151 items, 18 outfits)
   - `/workspace/threejs-assets/character-model-basic-wardrobe/x/character-model-basic-wardrobe-source-1.0.0/`
   - `dressCharacter`, `OUTFITS`, item tables in `src/character-wardrobe/`.
   - Useful existing items (recolor, do not invent a Western street look): `straw-hat`, `robe`, `long-skirt`, `skirt`, `tunic`, `topknot`, `headband`, `sandals`, `cloak-hooded`, `hood-up`, `cape`, `vest`, `breeches`, `satchel`, `bun`, `twintails`, `ponytail-high`, `ponytail-low`, `beard-long`, `beard-full`, `stubble`, barefoot, `bucket-hat`. Prefer these over jeans, sneakers, hoodies, baseball caps, spacesuits, hazmat, Santa, etc.
3. **Edo Village pack** — inspected. **No people / character / NPC models.** Buildings and props only (handcart, palanquin, paper lantern, wagasa, yaoya baskets, etc. may be used as held or nearby props). Do not pretend it contains villagers.
4. **Village Folk** (`christmas-folk`) — owned under the lifetime licence, but the pack is unpublished and the download URL 404s. The folder `/workspace/threejs-assets/christmas-folk/` is empty. If you happen to find usable folk meshes already cached elsewhere on the box, you may use them. Do not spend time retrying purchases or inventing endpoints. Do not buy anything.

Town style: `MeshToonMaterial` + 3-step ramp + inverted-hull outline via `toon()` / `toonMaterial` / `outlineMaterial` / `toonVertexColorMaterial` in `src/toon.js`. Imported meshes are converted in `src/catalog/loader.js`. Match that look. The character pack targets three `^0.180`; this project is `three@^0.169` — if the engine import fights the version, generate or load GLBs (or port only what you need) rather than upgrading three.js.

## Goal — 12 distinct Edo villagers

Add these twelve, each with a distinct silhouette, clothing colors, and a readable prop or hat:

| Role | Suggested look (adapt, but keep the role readable at a glance) |
| --- | --- |
| Merchant | Indigo or noren-like coat, money pouch or cloth-wrapped goods |
| Samurai | Topknot, hakama / dark kamishimo, katana |
| Monk | Shaved or close head, saffron or black robe, staff or juzu |
| Tea-house hostess | Kimono + obi, hair up, maybe a small tray or uchiwa |
| Farmer | `straw-hat`, work kimono or noragi, maybe a hoe or sheaf |
| Fisherman | Straw or bucket hat, darker short kimono, fishing rod |
| Child | Smaller proportions / `chunky` or scaled-down, bright color, maybe a ball or pinwheel |
| Elder | Slight stoop, greyer hair/beard, walking stick, muted kimono |
| Lantern maker | Workshop apron or rolled sleeves, paper lantern in hand or at feet |
| Shrine maiden (miko) | White kosode + red hakama, hair ribbon, gohei or ofuda |
| Porter | Load on a shoulder yoke or next to `edo-handcart`, sturdy clothes |
| Ronin | Looser topknot or unkempt, faded kimono, sheathed sword, no formal kamishimo |

**Dress and recolor the owned rigs first.** Author procedural low-poly meshes only for garments, hats, or props the wardrobe / Edo pack does not already provide (kimono/kosode/hakama/obi, sugegasa/jingasa, katana, fishing rod, gohei, yoke, paper-lantern holdable, etc.). Do not build fully procedural bodies if the owned character can be the body.

Ids: `edo-villager-merchant`, `edo-villager-samurai`, … kebab-case, catalog `name` is the display name. Scale so adults read ~1.6–1.8 m tall next to the Edo buildings (catalog scale 1.25 for most Edo meshes; pagoda 1.0). Child clearly shorter. Front +Z in the local frame, origin at the feet.

Licensed GLBs and any generated dressed GLBs live under `public/licensed/characters/` (or similar under `public/licensed/`). Do not vendor the character-engine TypeScript into tracked `src/` if you can import it from `/workspace/threejs-assets/...` in a generator script, or emit gitignored GLBs and catalog them as `source: 'mesh'`. If Vite needs `server.fs.allow` for a generator, that is fine; do not loosen the repo so licensed sources would be published.

## Placement, seeding, motion

Place them through the compiler/spawner so layouts stay seeded. Only when `district=edo`. Spread across:

- lantern lane (merchant, lantern maker, porter, maybe samurai)
- edo-approach / plaza transition (at least one — child or elder near the core plaza / approach)
- shrine approach / precinct (miko, monk)
- teahouse / garden walk / tea court (hostess)
- arched bridge / koi pond (fisherman, maybe ronin)
- minka / east lane (farmer)

Idle or walking, seeded. Store route/phase on the instance (street id, t0, speed) so the compiled JSON is deterministic. Runtime can animate from that data (simple walk along the assigned street, or a short idle bob / weight shift). Do **not** batch walking villagers (animation needs a real object). Exclude them from instanced batches in `runtime.js`.

## Kind and checks (important)

Do **not** use instance `kind: 'prop'` or `'tree'`/`'bush'`. Props are in `solids` (footprint-overlap) and `scatter` (`props-off-paths` will fail if they stand on the lane). Use a new kind `'villager'`.

- Do not add `'villager'` to `CORE_KINDS` (keeps suggested cameras / hamlet framing unchanged).
- Catalog `tags.category` may stay `'prop'` (schema `CATEGORIES` does not include villager) unless you extend the schema carefully and keep existing entries valid.
- `dress()` in `districts.js` rejects overlaps with occupied bounds — either place villagers after dressing with an overlap exemption, or a dedicated `spawnVillagers()` that does not treat path occupancy as a failure. They may stand on the walk; they must not intersect building footprints or sit inside a wall.
- `within-area` still applies; keep them inside the area.
- Existing edo checks must stay green. Do not weaken them.
- Add a hard check `edo-villagers`: when edo is on, exactly 12 villager instances, 12 distinct `edo-villager-*` ids, all `district === 'edo'`. Prove it with a negative in `tools/check-negatives.mjs` (drop one; the check must fail). When edo is off, zero villagers.
- Run `npm run catalog:bounds` if you add builder or mesh entries. `npm run test:checks` and `npm run test:parity` must pass.

## Lineup hook for later screenshots

Add `?lineup=villagers` on `compile.html` (seed/district still parsed). When set, after the town (or instead of a busy backdrop, on a simple ground) arrange the 12 villagers in a single labeled row, facing the camera, lit clearly. Reuse existing toon/outline. Keep `__ready`. You do not take the screenshot.

## Done means

- 12 distinct Edo villagers visible in `?district=edo&seed=1234`, built from owned rigs + recolors + wardrobe, with procedural pieces only where the pack is missing a garment or prop.
- Seeded placement on lane, plaza/approach, shrine, and bridge; idle or walking at runtime.
- Checks + parity green; no licensed files outside gitignored paths; no listeners opened; report written.
