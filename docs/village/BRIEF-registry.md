# Living Village — World Registry (Sol)

You are in git worktree `/workspace/cel-town-wt/registry` on branch `village/world-registry`. Read `docs/village/INTERFACES.md` first and **implement the stubs** in `src/world/registry.js`. Do not edit `/workspace/cel-town` or other worktrees. Do not buy anything, git push, or deploy. Local commits on this branch only. No API keys, no 4090, no Claude, no LLM. No touching `/workspace/tailgate-games` or Thistlebrook.

When finished, write `out/codex-village-registry-report.md` and leave work committed on this branch. This branch is a dependency for the NPC tool layer; prefer a complete, tested API over screenshots.

## File ownership (hard)

You MAY freely edit: `src/world/registry.js`, new `src/catalog/places.js` (or similar sidecar defaults), new `src/life/registry-runtime.js` if you need a runtime wrapper, `docs/village/WORLD-REGISTRY.md`, and new test files.

One clearly marked hook only in each of: `src/compiler/compile.js` (attach registry only when `life` is on or `{registry:true}` is passed — never on the default path), `src/life/graph.js` and/or one line in `src/life/schedules.js` after `buildWalkGraph` (`// WORKTREE-HOOK registry`), `package.json`, `README.md`. Additive tests namespaced `world-registry` only.

DO NOT EDIT: `src/life/tools.js`, `context.js`, `planner.js`, `economy.js`, `social.js`, `people.js`, `camera.js`, `daynight.js`, interiors, dressing, `townsfolk.js`, `generate-townsfolk.mjs`, `districts.js` instance fields, `src/compiler/checks.js` default `validate()` path, frozen fixtures. Do not change compiled life-off JSON.

## Goal

1. **Rich metadata for every placed building, prop, and zone.** Each place has: unique `id`, `type` (market, tavern, home, farm, well, smithy, bakery, plaza, store, …), a human `name` (e.g. "The Gilded Goose"), owner/occupants (NPC ids), opening hours, interaction points (door/entry, seats, counters, beds, workstations, each with position and facing), and capabilities (buy, sell, eat, sleep, work, rest, …). House catalog ids are reused across lots — place ids must be unique (`place:house:<lot>` or similar).

2. **Generate tags in the town compiler** from catalog/sidecar defaults plus placement, so new assets and new seeds get them automatically. No hand-tagging per seed. Civic catalog defaults (not per-seed): `cv-bakery` The Flour & Fern, `cv-tavern` The Copper Kettle, `cv-store` Willowmere Provisions, `cv-blacksmith` Bram's Workshop. Occupants can be inferred from townsfolk `work` (and homes when assigned). Hours/capabilities come from type defaults in the sidecar.

3. **Queryable API** (signatures already in the stub): `findPlace({type, capability, ownerId, openAt, near, name})` returns places sorted by distance when `near` is set, including nearest entry node; `getPlace(id)`; `interactionPoints(placeId, kind)`; `nearestEntryNode`.

4. **Connect entry nodes to the existing walk graph** (`src/life/graph.js`, `buildWalkGraph`). Add reachable spur/entry nodes (same idea as stall-front spurs in `schedules.js`). `walkTo('market')` in the NPC tool layer will resolve name/type to the registry, then the entry node, then `route()`. No hardcoded coordinates in that layer — provide the resolution helpers they will call.

5. **Validator.** Every **building** has at least one reachable entry node and occupant/hours/capabilities set; fail the life/registry compile or the dedicated check otherwise. Do **not** add this to default life-off `validate()`: that would change frozen `town.report` JSON. Run it when `life` is on, when `{registry:true}` is set, and in tests (`world-registry` negatives + unit tests for seeds 1, 7, 1234 large, and at least one other seed to prove new seeds are automatic).

6. **Hash safety (read this twice).** `tools/parity.mjs` hashes the entire default `compileTown(spec, catalog, {seed})` object. Frozen files cover hamlet/large seeds 1, 7, 1234 life-off. Default return shape and instance fields must stay byte-identical. Attach `town.registry` only on the life / `{registry:true}` path. Do not add default validate checks.

## Docs and tests

Write `docs/village/WORLD-REGISTRY.md`. `npm run test:checks` and `npm run test:parity` must pass. A small compile dump (e.g. `out/registry-1234.json`) is enough evidence; Playwright shots are optional.

## Done means

Generated registry, query API, graph-connected entry nodes, validator + tests green, hashes intact, docs written, local commit. Do not merge other worktrees and do not implement the NPC planner.
