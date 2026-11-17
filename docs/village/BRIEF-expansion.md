# Living Village — Medium-size expansion (Sol)

You are in git worktree `/workspace/cel-town-wt/expansion` on branch `village/medium-expansion`, based on main after the world-registry merge. Read `docs/village/INTERFACES.md` and `docs/village/WORLD-REGISTRY.md`. Do not edit `/workspace/cel-town` or other worktrees. No purchases, no git push, no deploy, no 4090, no Claude, no Thistlebrook / tailgate-games. Local commits on this branch only.

When finished, write `out/codex-village-expansion-report.md`, capture shots/video, and leave work committed here.

## File ownership (hard)

You MAY freely edit: a new `specs/medium.json` (and any new `src/compiler/medium.js` or similar helper), new catalog/sidecar entries for farms/fields/river/bridge/chapel if needed, `tools/shots-village-medium.mjs`, `shots/village-medium/`, docs/README play-URL notes.

One clearly marked hook only in each of: `src/compile-page.js` / the size-selector so `size=medium` is recognized, `tools/compile.mjs` (so `--size medium` works), `package.json`, `README.md`. You may extend the compiler **only on the medium spec path**.

**Hash safety (read twice).** Frozen default `compileTown` JSON for hamlet and large seeds 1, 7, 1234 must stay byte-identical. Do **not** change `specs/large.json`, `specs/hamlet.json`, default placement pools for those specs, or `districts.js` behavior when compiling large/hamlet. `npm run test:checks` and `npm run test:parity` must pass, including frozen SHA-256 fixtures.

DO NOT EDIT: `src/life/tools.js`, `planner.js`, `social.js`, interiors/doors, dressing-runtime, camera-ui files, `townsfolk.js`. Registry should pick up new medium-spec buildings automatically via catalog/sidecar defaults — don't hand-tag seed 1234.

## Goal

Grow Willowmere to a **true medium size** that still feels like one cozy town, not a second map:

- More homes than the current large layout.
- A chapel or other landmark (large seed 1234 currently has no chapel).
- Farms and fields at the edge.
- A river or stream with a bridge (toon, walkable if it crosses a path).
- Seed **1234** remains the default seed. The recommended play URL becomes `/?size=medium&seed=1234&life=1`.
- Do **not** change the implicit default used when `size` is omitted if that would break existing large-town checks. Document the new URL instead (or add `size=medium` as an explicit choice). Existing `/?size=large&seed=1234&life=1` must keep working and stay hash-stable.
- Life/registry/interiors should still function on the medium town: walk graph, registry entry nodes for new buildings, no people in roofs. If a civic is missing an interior, that is OK; extras can be exteriors. Prefer reusing already-catalogued cozy/farm meshes, runtime- or spec-only placement for anything new.

## Shots

`npm run shots:village-medium`. Write `shots/village-medium/`: `overview.png` (the whole medium town, seed 1234), `farms.png` (fields/farms), `river-bridge.png` or `chapel.png`. A 10–20s overview orbit mp4 is welcome. Post on for stills.

## Checks

`npm run test:checks`, `npm run test:parity`, `npm run test:world-registry` must pass. Add a medium-spec compile check (ok, registry entries for new landmarks, walkable bridge/chapel entry) without weakening large/hamlet negatives.

## Done means

A distinct medium seed-1234 town with more homes, a chapel or landmark, farms/fields, and a river/bridge; hashes intact; shots on disk; report written; local commit. Do not merge other worktrees.
