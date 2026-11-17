# Wire day-in-the-life routines into iso mode

You are in git worktree `/workspace/cel-town-wt/iso-camera` on branch `village/iso-camera`. This branch is already rebased onto main `9dfc5f0` (life, props, playtest, expansion). Do not edit other worktrees or `/workspace/cel-town`. No purchases, git push, deploy, 4090, Claude, or Thistlebrook / tailgate-games. Local commits only. Do not merge.

## Problem

`createLife` in `src/life/index.js` returns immediately into `createIsoLife`, so the `installRoutines` and `createProps` hooks that now live *after* that return on main never run. Iso currently has atmosphere and interiors, but the 12 townsfolk do not run the tool-driven day-in-the-life system, and M4 props are not installed.

## Fix

In `src/life/iso-life.js` (`createIsoLife`), after `api`/`window.__life` exists and **before** the initial `api.setHour(hour)` (so wrapped `people.seek` is used):

```
await import('./routine-runtime.js').then(m=>m.installRoutines({town,people,social,api,q,stage})); // WORKTREE-HOOK life-routines
```

After `createInteriors(...)`:

```
await (await import('./props-interact.js')).createProps(stage,town,camera,api); // WORKTREE-HOOK props
```

Keep the existing art atmosphere call and interiors call. Do not reintroduce a walk camera or WASD player. Preserve every `WORKTREE-HOOK` line (iso, art, interiors, lighting, medium, playtest, props, life-routines). You may tidy the now-dead walk-camera body after the early return in `index.js`, but those hook comments must still exist — either remain in `index.js` or, preferably, live next to the real calls in `iso-life.js` (and a short comment in `index.js` pointing at that).

`installRoutines` may attach `contexts` / planner helpers on `api`. Do not drop iso fields (`mode:'iso'`, `camera`, `hud`, `step`, `setHour`, `setTimescale`, `activities`). After wiring, a seek at 9.021 / 12.021 should show greetings, chats, shopping, and kids playing via the existing social/tools layer, not only ambient extra walkers.

## Checks

`npm run test:life-routines`, `npm run test:checks`, `npm run test:parity`, `npm run test:world-registry`, `npm run test:medium`, and `node --test tests/life-iso.test.mjs` must pass. Life-off hashes unchanged. Write `out/codex-village-iso-wire-life.md` and commit locally. Do **not** recapture the living-village film yet (that happens after review and merge).
