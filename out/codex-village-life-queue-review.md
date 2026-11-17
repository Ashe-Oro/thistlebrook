# Life arrival queue review

Date: 2026-11-16. Reviewed `village/life-queue` at `ba3762b` against base `9dfc5f0`, `docs/village/BRIEF-life-queue.md`, and `out/codex-village-life-queue-report.md`.

**APPROVED with P2/P3 leftovers only. No P0 or P1 findings remain.** The scheduled shared-place arrivals are separated, deterministic, navigable, and within social range. Approval covers the shipped routines; arbitrary custom-planner destinations have the P2 limitation below.

## Findings

### P2 — Unscheduled custom-planner visits still share an entry

Location: `src/life/arrival-slots.js:20` and `src/life/arrival-slots.js:49`, consumed by `src/life/destinations.js:16`.

Slots are allocated only for resident/place pairs present in `placeTargets` when routines are installed. The returned resolver silently returns the registry entry for every other pair. The public planner and `walkTo` adapter accept other valid registry destinations, so two residents sent to the same unscheduled place still stack.

Reproduced with large seed 1234: build routines and install slots, then resolve `place:landmark:lot:0` for `townsfolk-baker` and `townsfolk-blacksmith`. Both resolutions succeed and return node **1330**. This affects custom planners or new destinations outside the bound routine targets; the existing daily schedules are covered. A follow-up should allocate deterministic slots for these requests, or explicitly constrain the supported planner destination set. Add a regression for two residents requesting a place absent from their initial bindings.

### P3 — Spread groups remain visually crowded

Locations: `shots/village-life-queue/plaza.png`, `lunch.png`, and `family-supper.png`.

All three stills were inspected. Distinct feet/root positions are visible, but compact frontage spacing leaves substantial projected body overlap, and the supper capture is dark. This is a presentation limitation, not the original shared-node stacking. A later composition/spacing pass could improve silhouettes while preserving the four-metre interaction limit.

## Verification

All required commands were rerun successfully in this review:

| Command | Result |
| --- | --- |
| `npm run test:life-routines` | PASS, 9/9 |
| `npm run test:checks` | PASS, negative checks, batches, medium seeds 1/7/1234 and browser/Node parity |
| `npm run test:parity` | PASS, 31 hamlet seeds and four large seeds, forward/reverse, ordinary and one-ulp-perturbed Vite SSR |
| `npm run test:world-registry` | PASS, 11/11 |
| `git diff --check` | PASS |

Additional read-only checks:

- Independently checked every allocated slot for large seeds 1, 7, and 1234 (60, 54, and 60 slots). All lie inside the ground boundary with 0.4m margin, outside every registry building footprint and navigation blocker with at least 0.3m clearance, and within 3m of their registry entry. Approach segments sampled at 101 points are clear. Every allocated pair is at least 0.95m apart; pairs sharing a place are less than 3.95m apart. Registry place records remain byte-identical after installation. The implementation's 0.05m sampling with 0.33m clearance also protects the short edges between samples.
- The regression suite verifies deterministic allocation under reversed resident iteration, repeatable seeks across schedule boundaries, actual adapter positions, and assigned home/work identity. IDs and places are sorted; positions derive from seeded registry geometry and remain stable across hours.
- Ran a fresh Vite SSR smoke with the real `createPeople` implementation and Three.js scene roots. Both 12.021 → 13.5 and 17.99 → 18.75 begin with walking, then finish with all twelve residents at distinct assigned nodes and their actions completed. This supplements the test suite's simplified movement adapter.
- Inspected the stored browser evidence rather than recapturing it. It records twelve resident roots in each still, zero page errors, chat/play at the plaza, chat/eat at supper, and chat/shop/eat/play at lunch. Reservation nodes are remapped to the same slots used by movement, preserving the social arrival checks. Same-place participants fit `talkTo`'s four-metre limit. Greeting reservation handling and the moving-neighbour proximity check are unchanged; the stills themselves do not establish a transient greeting.
- Broader allocation smoke: seeds 2/3/4/5/8/9/10/11/12/42 pass. Seeds 0/6/19/99 fail earlier in routine binding with `Unreachable routine destination: townsfolk-baker tavern`, before slot installation. Routine binding, navigation graph, registry, and compiler files match the base revision; binding supplies no `arrivalNode`, so the changed destination expression retains its original entry-node behavior there. These existing reachability failures are not introduced by this patch.

## Scope and invariants

`walkTo` continues to resolve place identity and a reachable entry through the world registry before selecting a resident slot. There are no hardcoded world destinations. Frozen life-off hamlet/large hashes pass the existing fixtures; fixture files and compiled JSON were not changed. The compiler, catalog, iso camera, and props stack were not rewritten.

Each touched shared runtime file (`people.js`, `routine-runtime.js`, and `destinations.js`) has exactly one marked `// WORKTREE-HOOK` line. The helper and tests are additive.

No source fixes were necessary for P0/P1. This review adds only this review file and makes no commit. Work remained in `/workspace/cel-town-wt/life-queue`; no merge, push, deployment, purchase, or prohibited service use was performed. Existing untracked launcher/dependency/asset entries were left untouched.
