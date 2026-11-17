# Living Village playtest

Branch: `village/playtest`. Local Vite production preview, `/usr/bin/google-chrome`, ANGLE SwiftShader, 1280×720. Target: `/?size=large&seed=1234&life=1` with a frozen clock, `post=0`, `prmax=1`, and a 256px shadow map for repeatable software-rendered captures. The initial default-post walk ran successfully, but its first screenshot timed out; the capture configuration was reduced without changing product defaults.

## Bugs

| ID | Severity | Repro / impact | Fix / status | Evidence |
| --- | --- | --- | --- | --- |
| PT-01 (M3 leftover) | P2 | Enter bakery, inn, store or smithy; face the back wall. The world-space room name stacks beneath the fixed title. | Fixed: remove only the shared back-wall duplicate room-name sign; retain HUD identity, exit and shop signs. | `shots/village-playtest/interior-sign.png`, other `interior-*.png`; baseline `before-interior-sign.png`. |
| PT-02 (M2 leftover) | P2 | Seek a social scene and orbit behind nearby scenery. Overlay sprites render after `clearDepth`, revealing names and speech through scenery. Those hidden sprites can also claim overlap space ahead of a visible name. | Fixed: ray-test the label and resident head against visible opaque world meshes before overlap culling. Ignore resident meshes and outlines. Keep nearest names ahead of speech when they compete; preserve original anchors. One marked hook in `social.js`, logic in `social-occlusion.js`. | `labels.png`, viewpoint sweep in `out/codex-village-playtest-evidence.json`, baseline sweep and `before-occluded-2.png` (Pip’s name over a streetlamp); final `labels-wall.png`. |
| PT-03 (known M4 prop leftover) | P3 | Enter the inn and look at the table settings: drink vessels are closed cylinders without handles, and dish props are flat discs. | Deferred to the M4 props worktree, as requested; no mug/bowl changes here. | `shots/village-playtest/interior-inn.png`. |
| PT-04 | P3 | Enter the inn or smithy and face the back-wall service plaque. Vertical timber crosses the service text (“ROOMS & SUPPER…” / “REPAIRS • TOOLS…”); the plaque planes sit slightly behind beam faces. | Filed, unfixed. Separate from the removed duplicate room-name sign; does not block play. | `shots/village-playtest/interior-inn.png`, `interior-smithy.png` and `before-interior-inn.png`. |

## Scope and validation

Required checks passed after the fixes:

- `npm run test:checks`: negative compiler/life/interior checks and batching/runtime geometry checks.
- `npm run test:parity`: full browser/Node JSON parity, including perturbed math; frozen life-off SHA-256 fixtures for hamlet and large seeds 1, 7, 1234 unchanged.
- `npm run test:world-registry`: 11 tests passed.
- `node --test tests/life-playtest-social.test.mjs`: 4 tests passed, covering scenery, invisible ancestors, low-wall head visibility, resident exclusion, name ordering and parallel isometric rays.

The baseline exposed blocked text in 2 of 12 viewpoints (Pip at index 2 and Oswin at index 3). The fixed social sweep passed all 12 viewpoints with no rendered label anchor ray intersecting scenery. The matched `before-occluded-2.png` / `labels-wall.png` pair shows Pip’s name removed from the streetlamp while Oswin’s visible name remains anchored. `labels.png` verifies nearby labels in a clear social view. The exact final build was also recaptured with `--proof-only` (streetlamp view and bakery title).

Occlusion hides whole labels using anchor/head rays; it does not mask individual glyph pixels at scenery edges. This was a functional software-rendered playtest, not a frame-rate benchmark. Room and social test sites are positioned through debug hooks; movement and door/lantern/stall actions use keyboard input.

Full browser run passed with zero captured page exceptions or HTTP asset failures:

- Real WASD walk input moved the player; Tab switched to overview for social views.
- `setHour(21)` produced the night still; F advanced to hour 0; seeking 9.021 produced the bakery/smith greeting, and 12.021 produced the plaza chat/play view.
- `__town.registry` contained 755 places and all four canonical civic names.
- Entered and exited bakery, inn, store and smithy using E at their prompts; switched the bakery lantern off and on; used the outdoor stall prompt with E.
- Nearby rendered labels retained zero horizontal anchor error; the fixed sweep had zero blocked labels across 12 viewpoints.

Capture-run cleanup: the long baseline/fixed exec sessions reported exit 143 after all assertions and evidence writes completed. The runner now uses Vite’s full `server.close()` API; the final focused proof rerun exited 0. All required npm check commands exited 0.

No P0/P1 issues were observed in this tested scope. Two P2 assigned leftovers are fixed; the two P3 items above remain filed. Inn mug/bowl belongs to M4 and is deliberately untouched. No compiler, registry, planner, lighting, camera or generated JSON changes.

Reproduce: `npm run build && node tools/playtest-village.mjs`. Baseline capture: `node tools/playtest-village.mjs --before` against the baseline build. Focused final proof: `node tools/playtest-village.mjs --proof-only`. Tests: `node --test tests/life-playtest-social.test.mjs`.
