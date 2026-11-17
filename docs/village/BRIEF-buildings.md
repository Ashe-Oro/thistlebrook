# Living Village — Building variety and owned-pack import (Sol)

You are in git worktree `/workspace/cel-town-wt/buildings` on branch `village/building-variety`. Read `docs/village/INTERFACES.md`. Do not edit `/workspace/cel-town` or other worktrees. Do not buy anything, git push, or deploy. Local commits on this branch only. No API keys, no 4090, no Claude. No touching `/workspace/tailgate-games` or Thistlebrook.

When finished, write `out/codex-village-buildings-report.md`, capture shots, and leave work committed on this branch.

## File ownership (hard)

You MAY freely edit: new catalog/sidecar files you create (e.g. `src/catalog/buildings-extra.js`, `src/catalog/townsfolk-variants.js`), import/generate scripts under `tools/`, `docs/` notes for new assets, `tools/shots-village-buildings.mjs`, `shots/village-buildings/`. Downloads go in gitignored `public/licensed/` (already a symlink to the shared library).

One clearly marked hook only in each of: `src/catalog/catalog.js` (spread/import new entries), `package.json`, `README.md`. Additive tests only if namespaced `building-variety`.

DO NOT EDIT: `src/compiler/districts.js`, default placement pools in `compile.js`, `src/life/**` except you may read them, `src/world/registry.js`, `townsfolk.js`, `tools/generate-townsfolk.mjs`, interiors, dressing-runtime, post, frozen fixtures.

**Hash safety:** default life-off compiled JSON must stay byte-identical. New buildings and props may be catalogued freely, but they must appear only via opt-in (`?variety=1` / a new spec flag / life-only or runtime placement). Do not change default hamlet or large layouts.

## Assets (owned lifetime library — do not purchase)

The account already owns the ThreeJS Assets lifetime library. Use packs already on disk under `public/licensed/` first (village, autumn, stylised, kitchen/dining/bookshop, Character Model Basic + Wardrobe, existing cozy/farm catalogs). Prefer unused catalogued meshes before downloading more.

If you need another owned pack, use the threejsassets approach: search owned catalog, `get_product_download_link` / `get_asset_download_link`, curl the short-lived signed URL immediately into `public/licensed/<pack>/`, extract, delete the zip. Do **not** retry the Village Folk / `christmas-folk` pack — it 404s; that is a known entitlement/hosting issue. Do not invent endpoints. Convert imported meshes with the existing toon loader (`MeshToonMaterial` + inverted-hull outlines). Record credits in a local notes file; licensed files stay gitignored and must never be committed or pushed.

Goal: more building variety (additional house/civic/farm looks that still read as the same cozy cel-shaded town) and more props, plus **varied villager models** without editing `src/catalog/townsfolk.js` (the art worktree owns that file). Put any extra character variants in `src/catalog/townsfolk-variants.js` and load them only behind the opt-in flag. Keep the same 12 townsfolk ids as the default life cast; variants may swap or extend appearance when the flag is on. Do not spawn Edo/samurai/miko into Willowmere.

## Shots

`tools/shots-village-buildings.mjs` + `npm run shots:village-buildings`. Same Playwright/Chrome/SwiftShader harness as M2. Write `shots/village-buildings/`: at least `houses.png`, `props.png`, `villagers.png` (or equivalent) showing the new variety on large seed 1234 with the opt-in flag, plus a short 8–15s mp4 if cheap. `post` may stay on for stills.

## Checks

`npm run test:checks` and `npm run test:parity` must pass. Prove life-off hashes unchanged. New entries follow existing catalog conventions (`source:'mesh'`, paths under `licensed/...`, bounds if you add entries — `npm run catalog:bounds` if needed).

## Done means

Visible new building/prop/villager variety behind an opt-in flag, hashes intact, shots on disk, report written, local commit. Do not merge other worktrees.
