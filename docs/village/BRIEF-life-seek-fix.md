# Fix: life-routines seek test after registry rebase

You are in git worktree `/workspace/cel-town-wt/life` on branch `village/day-in-the-life`, already rebased onto current main (`30469e6`, which includes the medium expansion). Do not edit other worktrees or `/workspace/cel-town`. No purchases, git push, deploy, 4090, Claude, or Thistlebrook / tailgate-games. Local commits only.

`npm run test:life-routines` currently fails one test after the rebase onto the real world registry:

```
life-routines: runtime seeks execute tools and remain repeatable with player present
AssertionError: assert(first.every(c=>c.currentAction&&c.currentAction.tool!=='walkTo'))
```

The other seven tests pass. The likely cause is that `people.seek` still teleports residents to legacy schedule nodes, while `walkTo` now resolves through `src/life/destinations.js` / the real `town.registry` entry nodes, so some contexts are still mid-walk after a seek. `destinations.js` still has a `TODO(rebase-registry)` schedule-node fallback that no longer runs once `registry.places` is populated.

## Fix

- Keep using the registry for `walkTo` (no hardcoded world coordinates). Remove or shrink the leftover fallback if the real registry is sufficient.
- After `people.seek(hour)` / routine install, every resident should have arrived at that hour’s activity and `currentAction.tool` should not be `walkTo`. Do not weaken the assertion. Make seek and destination resolution consistent (seek to the registry entry node, or complete the walk during seek).
- Do not change life-off compiled JSON or frozen hashes. Do not rewrite files you do not own (camera, interiors, lighting, compiler, catalog, expansion, props, playtest, iso).
- One hook per shared file remains; do not drop art/interiors/medium hooks.

## Checks

`npm run test:life-routines` must be 8/8. Also `npm run test:checks`, `npm run test:parity`, and `npm run test:world-registry`. Write a short note in `out/codex-village-life-seek-fix.md` and commit locally. Do not merge, and do not recapture the living-village video yet (the iso camera recapture comes later).
