# Living Village — art / visual polish and more owned props

You are working in the git worktree `/workspace/cel-town-art` on branch `village/art-polish`. The live tree `/workspace/cel-town` is reserved for a running M2 review — do not edit it. Do not buy anything, do not git push, do not deploy. You may make local commits on this branch only. Licensed GLBs stay under `public/licensed/` (a symlink to the shared library; gitignored). No API keys, no 4090, no Claude. No touching tailgate-games or Thistlebrook.

When finished, write `out/codex-village-art-report.md` and leave your work committed on `village/art-polish`.

## Parallel-work file ownership (hard)

Other jobs are editing M2 social life and M3 interiors in parallel. Merge comes later.

You MAY create or freely edit:
- `src/life/atmosphere.js` and/or `src/life/dressing-runtime.js` (new)
- `src/catalog/art-additions.js` (new catalog entries only)
- `tools/generate-townsfolk.mjs` and `src/catalog/townsfolk.js` **only** to vary existing twelve residents' looks (same ids/roles/schedules). Do not change spawn counts, ids, or schedule schema.
- `tools/shots-village-art.mjs`, `shots/village-art/`, `package.json` script `shots:village-art`
- `docs/village/BRIEF-art.md`, `out/codex-village-art-*`

You may add **one clearly marked hook** in each of these shared files and nothing more:
- `src/life/index.js` — `createAtmosphere` / `createDressing` behind `// WORKTREE-HOOK art`
- `src/catalog/catalog.js` — spread `ART_ADDITIONS` behind `// WORKTREE-HOOK art`
- `README.md` — a short visual/dressing note

DO NOT EDIT: `src/life/social.js`, `people.js`, `schedules.js`, `camera.js`, `daynight.js` (night grass already landed in M2; if you add more atmosphere, do it in `atmosphere.js`), `src/life/interiors.js`, `src/compiler/districts.js`, `tools/shots-village-m1.mjs`, `tools/shots-village-m2.mjs`. Do **not** change compiled life-off JSON. Extra dressing must be **runtime-only** (life mode on), or catalog entries that are not placed by the existing dresser.

## Goal — make the village look richer using owned packs

Owned library already on disk at `public/licensed/` and `/workspace/threejs-assets/`:
- Cozy Village, Countryside Farm, Nature, Autumn Harvest — many catalogued pieces are still unused or sparse. Prefer unused catalog ids before adding new ones.
- Character Model Basic + Wardrobe — already used for the 12 townsfolk. **Village Folk (`christmas-folk`) download still 404s** and is not on disk; do not waste time retrying purchases or inventing endpoints. Vary the twelve with more distinct wardrobe/style/silhouette/color choices and regenerate their gitignored GLBs with the existing generator.
- Kitchen / dining-room / bookshop packs were just added under `public/licensed/{kitchen,dining-room,bookshop}/` for the interiors job. You may use a few **outdoor-safe** props (planters, benches, hanging plants) if they toon well. Do not build interiors here and do not drop modern appliances outside.

Keep the cel-shaded look: convert meshes through the existing loader (`MeshToonMaterial` + inverted hull). One consistent cozy/toon family.

Concrete deliverables:
1. **Richer street dressing (life mode only, runtime).** More of the owned cozy/autumn/farm/nature props along streets, yards, and the market — flower carts, crates, planters, benches, lanterns, harvest bits, animals if they already exist and aren't silly. Stay off walk paths and building footprints (reuse `blockers` / obstruction helpers). Seeded (`deriveSeed`) so seed 1234 is deterministic. Do not mutate compiled instance lists for life-off hashes.
2. **More varied villager models.** The twelve keep the same ids and jobs, but should read more distinct at a glance (hair, hats, outfits, proportions, colors). Regenerate GLBs into `public/licensed/characters/`. Don't introduce samurai/miko looks.
3. **Visual polish.** Small life-only improvements that don't rewrite the post stack: tighter shadow or lamp pool readability, slightly better street-level fill, maybe chimney smoke already in catalog actually visible, no new post-processing architecture. Do not undo nocturnal grass or the smithy sign scale fix (those live in daynight / loader / M2 code — leave them; you may add complementary atmosphere).
4. **Hooks / checks.** Life-off JSON hashes must stay byte-identical. `npm run test:checks` and `npm run test:parity` pass. A life-on check or audit that extra dressing does not intersect architecture or block streets; negative if useful.

## Shots

`tools/shots-village-art.mjs` + `npm run shots:village-art`. Same Playwright/Chrome/SwiftShader/ffmpeg pattern. Output `shots/village-art/`:
- `market-dressed.png` — denser market/street dressing
- `yards.png` — residential yards/paths with new dressing
- `townsfolk-lineup.png` or a street close-up showing more distinct villagers
- `night-atmosphere.png` — night still that still has dark grass + lamps, plus any polish
- `village-art.mp4` — 8–16s orbit or street walk showing the richer dressing

## Done means

Richer deterministic life-only dressing, more distinct townsfolk, tests and hashes green, shots/video on disk, report written, local commit on this branch. Do not start interiors or merge into other worktrees.
