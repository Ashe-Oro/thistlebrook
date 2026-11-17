# Living Village — M4 interactive props (Sol)

You are in git worktree `/workspace/cel-town-wt/props` on branch `village/m4-props`, based on main after the world-registry merge. Read `docs/village/INTERFACES.md` and `docs/village/WORLD-REGISTRY.md`. Do not edit `/workspace/cel-town` or other worktrees. No purchases, no git push, no deploy, no 4090, no Claude, no Thistlebrook / tailgate-games. Local commits on this branch only.

When finished, write `out/codex-village-props-report.md`, capture shots/video, and leave work committed here.

## File ownership (hard)

You MAY freely edit: new files you create (`src/life/props-interact.js`, any `src/catalog` sidecar for a mug/bowl/bell, `tools/shots-village-props.mjs`, `shots/village-props/`, docs). You may *call* `registerTool` / `executeTool` from `src/life/tools.js` and the world registry API; do not rewrite those modules (the Astra day-in-the-life job owns `tools.js` / planner / context, and will rebase onto registry).

One clearly marked hook only in each of: `src/life/index.js`, `src/life/interiors.js` or `doors.js` (only if needed for open/close), `package.json`, `README.md`. Additive tests namespaced `life-props` only.

DO NOT EDIT: `src/world/registry.js`, `src/compiler/**`, `districts.js`, `schedules.js`, `social.js`, `planner.js`, `context.js`, `economy.js`, `camera.js`, `daynight.js`, `dressing-runtime.js`, `atmosphere.js`, `interact-ui.js`, `hud.js`, `townsfolk.js`. Do not change compiled life-off JSON.

## Goal

Make a handful of world objects actually usable, through the **typed NPC tool layer** (and player E / the existing prompt hook if present):

1. **Sit** on benches (`sit` / sit on a registry `seat` point).
2. **Draw water** at the well.
3. **Ring a bell** if a chapel/bell or town bell exists; if seed 1234 large has no bell, add a modest runtime-only bell at a reachable registry point (do not alter default compiled layout).
4. **Buy from stalls** via the tools layer (`buy`), resolving the stall through the world registry (`resolvePlace` / `findPlace` / entry nodes). Economy stays a stub/counter.
5. **Open/close doors** at enterable buildings (bakery/inn/store/smithy). Use the existing interiors fade/door system; add a visible open/close or door state, don't invent a second interiors stack.
6. **M2 leftover:** the inn meal should include a visible mug or bowl (player or Clover/Rose at the inn). Keep it cozy/toon.

Player control: E (or a documented key) uses the nearest valid interaction. Expose something like `__life.props` / tool results for shots. `walkTo` and place resolution must use the registry — no hardcoded world coordinates.

Play URL remains `/?size=large&seed=1234&life=1` (this snapshot is the large town plus interiors, art dressing, and the registry).

## Shots

`tools/shots-village-props.mjs` + `npm run shots:village-props`. Same Playwright / Chrome / SwiftShader harness as prior milestones. Write `shots/village-props/`: `sit.png`, `well.png`, `stall-buy.png`, `door.png`, and either `bell.png` or `inn-mug.png`. A short 8–15s mp4 of 2–3 of these interactions is welcome. Post on for stills.

## Checks

`npm run test:checks`, `npm run test:parity`, and `npm run test:world-registry` must pass. Life-off hashes unchanged.

## Done means

The five interactions work, inn mug/bowl is visible, tests and hashes green, shots on disk, report written, local commit. Do not merge other worktrees.
