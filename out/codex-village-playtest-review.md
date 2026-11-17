# Village playtest review

Date: 2026-11-16. Branch: `village/playtest`; reviewed implementation commit `b89da54` at review HEAD `ff274c7`. Reviewed against `docs/village/BRIEF-playtest.md`, `docs/village/INTERFACES.md`, and `out/codex-village-playtest-report.md`.

Decision: **APPROVED with P3 leftovers only. No P0 or P1 remains in the reviewed scope.** PT-01 and PT-02 are fixed in the tested cases; PT-03 and PT-04 remain open and do not block approval.

## Findings and assigned leftovers

| ID | Severity | Review result |
| --- | --- | --- |
| PT-01 | P2, fixed | Compared `before-interior-sign.png` with `interior-sign.png`: the faint back-wall room title is removed while the HUD title remains readable. The same shared construction serves all four rooms. |
| PT-02 | P2, fixed in tested cases | Compared `before-occluded-2.png` with `labels-wall.png`: Pip's name no longer draws over the foreground streetlamp; Oswin's visible name and the speech bubble remain anchored. `labels.png` shows readable nearby names and speech in a clear social view. The helper tests label/head visibility before overlap culling, excludes resident meshes and invisible ancestors, and handles parallel orthographic rays. |
| PT-03 | P3, open | Inn vessels and dishes retain their existing shapes. These props belong to M4 and were not changed. Evidence: `shots/village-playtest/interior-inn.png`. |
| PT-04 | P3, open | Timber/shelf uprights obscure parts of service-plaque text in the inn and smithy. Confirmed in `interior-inn.png` and `interior-smithy.png`; this is separate from the duplicate room title. |

No additional P0/P1 findings. Inspected the original interior, labels-wall, labels, walk, and before/final comparison stills under `shots/village-playtest/`.

## Scope review

`src/life/interiors.js:97` removes only the shared duplicate title call and adds a comment. It preserves the exit/return signs and leaves the room stack, furniture, props, lanterns, collision, doors, and interaction code intact. `src/life/social.js:54` contains one marked `WORKTREE-HOOK playtest` call, plus the helper import at line 4; the existing overlay and overlap pass remain in place. The implementation does not change compiler, catalog, specs, fixtures, registry, planner, camera, lighting, or compiled life-off JSON.

## Validation

All completed commands below exited 0 during this review:

- `npm run test:checks`: all negative/compiler/life/interior and batching/runtime geometry checks passed.
- `npm run test:parity`: both ordinary Vite SSR and one-ulp math perturbation passed; 31 hamlet seeds and four large seeds, forward and reverse, with full JSON equality.
- `npm run test:world-registry`: 11/11 passed, including seeds 1, 7, 1234, and 19.
- `node --test tests/life-playtest-social.test.mjs`: 4/4 passed.
- `npm run build`: passed; existing bundle-size warning only.

Separately recomputed life-off SHA-256 values for hamlet/large seeds 1, 7, 1234, and 19. All six available frozen fixtures (1, 7, 1234 for each size) match exactly. There is no seed-19 frozen fixture in this repository, so a fixture match for 19 cannot be claimed. Seed 19 passed full JSON parity; compiler/catalog/spec/fixture files are byte-unchanged from the pre-playtest base. Current hashes are saved in `out/codex-village-playtest-review-hashes.json`; parity output is in `out/codex-village-playtest-review-parity.log`.

Independent production-build browser rerun exited 0 using `/usr/bin/google-chrome`, ANGLE SwiftShader, and large seed 1234 with life enabled. The reviewer runner preserves the implementation harness assertions while skipping screenshot recapture; the existing proof stills were inspected directly. Results:

- WASD moved the player 2.5 world units; night seeking and F advancement passed.
- Greeting and plaza social scenes were exercised; all four sampled name/speech anchors had zero horizontal error.
- All 12 social viewpoints passed with no visible label anchor blocked by scenery; each view retained 2–4 labels.
- Entered and exited bakery, inn, store, and smithy using E at their prompts; bakery lantern switched off and back on; outdoor stall interaction passed.
- Registry contained 755 places and all four canonical civic names; zero captured page exceptions or HTTP asset failures.

Runtime evidence: `out/codex-village-playtest-review-evidence.json`, `out/codex-village-playtest-review-browser.log`, and the namespaced reviewer runner `out/codex-village-playtest-review-run.mjs`. An earlier capture attempt ended with signal 143 before completion; approval uses the completed exit-0 rerun.

## Limits and workspace handling

Occlusion remains a whole-label anchor/head test, as documented in the implementation report; it does not clip individual glyph pixels at scenery edges. The tests and stills establish the reported wall/streetlamp fixes, rather than exhaustive per-pixel occlusion or a frame-rate benchmark.

Review work stays in `/workspace/cel-town-wt/playtest`. No source fixes or local commits were made. No merge, push, deployment, purchase, other-worktree edit, or prohibited service/hardware use.
