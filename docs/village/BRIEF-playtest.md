# Living Village — Playtest bug hunt (Sol)

You are in git worktree `/workspace/cel-town-wt/playtest` on branch `village/playtest`, based on main after wave 1 (interiors + art) and the world-registry merge. Read `docs/village/INTERFACES.md`. Do not edit `/workspace/cel-town` or other worktrees. No purchases, no git push, no deploy, no 4090, no Claude, no Thistlebrook / tailgate-games. Local commits on this branch only.

When finished, write `out/codex-village-playtest-report.md` (a bug list with severity and fix/status), recapture any affected proof shots under `shots/village-playtest/`, and leave work committed here.

## File ownership (hard)

You MAY freely edit: `tools/playtest-village.mjs` (and helpers), `shots/village-playtest/`, `out/codex-village-playtest-*`, and **targeted fixes** for the leftovers and bugs you file, in:

- `src/life/interiors.js` — **M3 P2 leftover: duplicate room signage** (world-space sign stacking under the HUD title in bakery/inn/store/smithy). Move or remove the faint duplicate sign; don't gut the interiors system.
- Label occlusion — **M2 P2 leftover: names/bubbles showing through scenery, and overlap-cull hiding a nearby name poorly.** Prefer a new helper (e.g. `src/life/social-occlusion.js`) plus **one marked hook line** in `src/life/social.js`. Do not rewrite the social overlay; the day-in-the-life job also hooks that file.
- Other clearly broken player-facing bugs you prove with Playwright, fixed in the smallest local change. If a fix belongs to another in-flight worktree (tools/planner, lighting-polish files, building-variety, camera-feel, medium spec), file it in the report and do not take those files.

One hook line only in `package.json` / `README.md` if you add `npm run playtest:village`. Additive tests namespaced `life-playtest`.

DO NOT EDIT: `src/world/registry.js`, compiler/default specs, `districts.js`, `planner.js`, `tools.js`, `dressing-runtime.js`, `camera-feel.js`, `interact-ui.js` (except a hook if you must), `townsfolk.js`. Leave the **inn mug/bowl** to the M4 props worktree. Do not change compiled life-off JSON.

## Goal

1. Walk the merged build with Playwright (Vite preview, `/usr/bin/google-chrome`, SwiftShader) at `/?size=large&seed=1234&life=1`.
2. Exercise: walk camera, day/night (`setHour` / F), nearby names, a greeting or plaza scene if seek hours work, enter/exit at least one interior, a lantern, a stall prompt if present, registry presence (`__town.registry` / civic names).
3. File every real issue with severity P0–P3, repro, and evidence.
4. **Fix P0/P1 and the two assigned leftovers** (duplicate sign, label occlusion). Recapture proof stills.
5. Don't flatten the town into a test harness; keep the cozy play feel.

## Shots

At least: `shots/village-playtest/interior-sign.png` (room title readable, no stacked faint sign), `labels.png` (names anchored, not obviously punching through a nearby wall if you can demonstrate the fix), and one playtest walk/interior still. Optional short mp4.

## Checks

`npm run test:checks`, `npm run test:parity`, and `npm run test:world-registry` must pass after fixes. Life-off hashes unchanged.

## Done means

Playtest report with filed bugs, assigned leftovers fixed, hashes green, proof shots on disk, local commit. Do not merge other worktrees.
