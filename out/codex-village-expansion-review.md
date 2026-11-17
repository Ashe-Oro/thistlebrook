# Medium village expansion review

Verdict: **APPROVED with one P2 leftover. No P0 or P1 remains.**

Reviewed branch `village/medium-expansion`, HEAD `daaff81`, against `docs/village/BRIEF-expansion.md` and `out/codex-village-expansion-report.md`. All work stayed in `/workspace/cel-town-wt/expansion`.

## Findings (P0–P3)

- **P0: none.**
- **P1: none.** No implementation fixes or commits were required.
- **P2 — Stream continuity validator misses lateral displacement** (`src/compiler/medium.js:54`). The continuity assertion checks rotation and consecutive X spacing, but not Z alignment or actual adjacency of water bounds. Reproduction: compile medium seed 1234, move the first `cv-water-stream` instance by `pos[1] += 10`, then call `mediumFailures(town, catalog)`. It returns `[]` despite a detached water tile and a gap. Add a two-dimensional adjacency/alignment check and a negative test for lateral displacement. This is a regression-detection gap; the delivered seed-1234 river is joined in the inspected stills and the generated bridge route passes.
- **P3: none.**

## Verification

- Reran `npm run test:checks`, `npm run test:parity`, `npm run test:world-registry`, and `npm run test:medium`: all exited successfully. Registry suite: 11/11 passing. Medium checks cover seeds 1, 7, 1234, reachable chapel/farm entries, both bridge banks, roof exclusions, registry-only/default modes, bridge/path/orientation negatives, and full default/life JSON parity through Vite SSR.
- `npm run build` passed with the existing bundle-size advisory. `git diff --check` passed.
- The six frozen hamlet/large life-off SHA-256 fixtures for seeds 1, 7, 1234 passed unchanged. Additionally compared all eight full life-off JSON outputs (hamlet/large, seeds 1, 7, 19, 1234) against the compiler source from local `main`, loaded through Vite: byte-identical. There is no frozen seed-19 fixture; its additional baseline hashes are hamlet `39e5c047b53d67da2d5c32baf4f503d078f25bb574aa1fe8c0bd506d3a2ba210` and large `7a54025af7fea68be84327ec24b060cade5257760cb1bea1fb8887c7e443be01`.
- Medium is a new `specs/medium.json` plus guarded `compileMedium` dispatch. The default `validate()` implementation, hamlet/large specs, district compiler, placement pools, fixtures, catalog, and life/registry modules are unchanged from main. Existing registry/life hooks remain intact. Each changed shared file has exactly one medium `WORKTREE-HOOK` marker; the pre-existing registry/art markers remain.
- Fresh local Chromium/SwiftShader smoke checks of the built play page passed with no script or asset errors. `/?size=medium&seed=1234&life=1` produced 31 homes, two chapels, 55 registry buildings, and 12 residents. Both `/?seed=1234&life=1` and `/?size=large&seed=1234&life=1` retained 20 homes and 12 residents. Rendering-only quality flags were appended for the software renderer.
- Seed 1234 remains the documented recommended demo. Medium bridge reachability and farmland/field presence passed the dedicated checks. Navigation retains the documented planar XZ graph with a connected path through the bridge.
- Opened and visually inspected all four existing captures: `shots/village-medium/overview.png` shows the expanded connected town and stream crossing; `farms.png` clearly shows the barn, farm buildings, fields and orchard; `river-bridge.png` shows joined water tiles and the aligned bridge/path; `chapel.png` clearly shows the chapel beside the civic center. No empty-field substitute or broken river join was observed.

Only this review report was added. No commit, merge, push, deployment, purchase, external model call, or other-worktree edit was performed. Existing untracked files were left alone.
