# Living Village — Milestone 3: interiors and enterable doors

You are working in the git worktree `/workspace/cel-town-m3` on branch `village/m3-interiors`. The live tree `/workspace/cel-town` is reserved for a running M2 review — do not edit it. Do not buy anything, do not git push, do not deploy. You may make local commits on this branch only. Licensed GLBs stay under `public/licensed/` (a symlink to the shared library; already gitignored). No API keys, no 4090, no Claude. No touching `/workspace/tailgate-games` or Thistlebrook.

When finished, write `out/codex-village-m3-report.md` and leave your work committed on `village/m3-interiors`.

## Parallel-work file ownership (hard)

This worktree is for interiors only. Other jobs are editing social life and art/dressing in parallel. Merge comes later.

You MAY create or freely edit:
- `src/life/interiors.js` (and `src/life/doors.js` if you split)
- `src/catalog/interiors.js` (new catalog entries only)
- `tools/shots-village-m3.mjs`, `shots/village-m3/`, `package.json` script `shots:village-m3`
- `docs/village/BRIEF-m3.md`, `out/codex-village-m3-*`

You may add **one clearly marked hook** in each of these shared files and nothing more:
- `src/life/index.js` — after life is created, call `createInteriors(...)` behind `// WORKTREE-HOOK interiors`
- `src/catalog/catalog.js` — spread `INTERIOR_CATALOG` into `CATALOG` behind `// WORKTREE-HOOK interiors`
- `README.md` — a short "Interiors" subsection at the end of the Living village section
- additive tests in `tools/check-negatives.mjs` only if namespaced `life-interiors` and existing tests stay intact

DO NOT EDIT: `src/life/social.js`, `people.js`, `schedules.js`, `camera.js`, `daynight.js`, `graph.js`, `tools/shots-village-m1.mjs`, `tools/shots-village-m2.mjs`, `src/compiler/districts.js`, `src/catalog/townsfolk.js`, `tools/generate-townsfolk.mjs`. Do not change compiled life-off JSON. If you need the walk camera or town instances, import them, don't rewrite them.

## Context

Play URL remains `/?size=large&seed=1234&life=1`. M1 walk/day-night/schedules and M2 social life already exist in this snapshot (a later merge may bring M2 review fixes). Civic buildings: `cv-bakery`, `cv-tavern` (inn), `cv-store`, `cv-blacksmith` (already a mostly open workshop), plus houses.

PLAN.md M3: enter bakery, inn, store and smithy; doors/triggers; counters; stall use; lightable lanterns. Out of scope: furnishing every home, inventory systems.

## Owned interior assets (already on disk, do not re-download)

Under `public/licensed/` (symlink):
- `kitchen/` — Kitchen Interior pack (prebuilds + individual props: fruit bowl, shelves, tables, stove, etc.). **Many pieces are modern** (fridge, microwave, dishwasher). Cherry-pick only what can pass in a cozy cel-shaded village after toon conversion. Do **not** drop stainless appliances into Willowmere.
- `dining-room/` — tables, windsor chairs, sideboard, plates, teapot, wine, benches. Good for the inn if re-tooned.
- `bookshop/` — bookcases, checkout counter, reading nook, benches, lamps. Good for the general store if re-tooned.
- Existing cozy-village / farm / autumn props already catalogued — prefer these when they fit (barrels, crates, counters, stalls).
- The smithy exterior is already an open workshop with anvil; "entering" it can be walking under the existing roof plus a modest back-room or dressed interior depth, not a modern garage.

Convert imported meshes with the existing loader / `MeshToonMaterial` + inverted-hull outlines. Catalog new ids with a prefix like `int-` or `kit-`, `source:'mesh'`, paths under `licensed/...`, and run `npm run catalog:bounds` if you add entries.

## Goal

1. **Enter four spaces.** The player can walk up to the bakery, inn, and store doors, activate a trigger (E or automatic proximity — pick one, document it), and enter a handsome toon interior. Exit is obvious (door / E / walk back). The smithy counts if the player can step into its working floor clearly. Interiors should feel like rooms (floor, walls, doorway, furniture, warm light), not empty boxes.
2. **Doors.** Visible door open/close or a clean fade/step through the doorway. Do not leave the player stuck in a collider. Exterior collision must still stop wall-walking; the doorway is the hole.
3. **Counters and stalls.** Inside the store and bakery, a counter the player (and later NPCs) can stand at. Market stalls stay outdoor (already in M2 shopping); a "use" prompt at a stall or counter is enough (no inventory).
4. **Lightable lanterns.** At least a couple of indoor (or porch) lanterns/lamps the player can light/extinguish (E or a documented key). Honest fixtures, no bare orbs.
5. **Hooks.** Keep `__ready`, `__life`. Add something like `__life.interior` (`null` or `{id:'bakery',...}`) and `?interior=bakery` for shots.
6. **Checks.** Life-on: four enterable interiors exist, door triggers have positions, lanterns are real fixtures. Negatives for a missing bakery interior or a trigger inside a wall. Life-off JSON hashes unchanged (`out/village-m1-baseline.json` or the copy in this worktree). `npm run test:checks` and `npm run test:parity` must pass. Feet still on the ground.

## Shots

Add `tools/shots-village-m3.mjs` and `npm run shots:village-m3`. Same harness style as M2 (Playwright, Vite preview, `/usr/bin/google-chrome`, SwiftShader, evidence, `--video-only` if useful, ffmpeg 1280×720 yuv420p, 10–20s). Write to `shots/village-m3/`.

Capture:
- `bakery.png`, `inn.png`, `store.png`, `smithy.png` — inside (or in-workshop) with furniture readable
- `doorway.png` — street-to-interior at a door, mid-transition or just inside looking back out
- `lantern.png` — a lantern being on, fixture visible
- `village-interiors.mp4` — 10–20s walking from a street through a door into at least one interior (and preferably a second, or lighting a lantern)

Update README with enter/exit/lantern controls.

## Done means

Four enterable spaces, door triggers, counters, lightable lanterns, tests green, hashes intact, shots and video on disk, report written, local commit on this branch. Do not start M4 or merge into other worktrees.
