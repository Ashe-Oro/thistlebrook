# Iso camera review — P0–P3

Reviewed branch `village/iso-camera` at `c7058bd`, against main `9dfc5f0`, on 2026-11-16. Scope: the three implementation briefs, `ISO-CAMERA.md`, all three iso implementation reports, runtime source, existing stills, and fresh local checks.

## Decision

**APPROVE with P2/P3 leftovers only. No P0 or P1 found or remains.** No source fixes or local commits were needed. Work stayed in `/workspace/cel-town-wt/iso-camera`; no merge, push, deployment, purchases, external model calls, or film recapture.

## Findings

- **P2 — Presented density remains modest at overview.** `shots/village-iso/overview.png` and `mid-zoom.png` still show broad lawns and generous road spacing, especially around the residential grid. The added gardens, laundry, forest groups and market dressing improve readability, but the result remains less compact than the polish brief's reference. This is a presentation refinement, not broken lighting or missing runtime dressing. Follow-up: concentrate additional runtime yard detail around existing homes and streets while retaining frozen compiled layouts.
- **P3 — Ambient neighbours look like residents but have no inspection affordance.** `src/life/iso-diorama.js:43` clones twelve figures and removes instance metadata; `src/life/iso-interact.js:5` only registers tagged instances. These extra figures cannot show hover names or follow cards. The twelve canonical townsfolk are correctly inspectable and tool-driven. Follow-up: distinguish ambient extras visually or offer a generic neighbour label without implying additional scheduled identities.

P0: none. P1: none. The roster names already include roles (for example, “Finn · Shopkeeper”); missing role text is **not** a finding.

## Camera and interaction verification

Fresh built-app Chrome/SwiftShader checks used deterministic manual simulation steps and actual pointer/keyboard/touch input, without writing screenshots or film. `out/iso-review-browser.log` and `out/iso-review-browser/evidence.json` record the camera audit.

- Life startup uses an `OrthographicCamera`, exact elevation `atan(1/sqrt(2))` (35.26438968°), 45° base azimuth and Q/E quarter-turns. `stage.setMode('persp')` cannot switch it. No walking player exists; W/A/S/D/Tab/M do not change the view. The obsolete walk startup body has been removed from `index.js`.
- Wheel and real CDP two-finger pinch zoom; cursor-ground anchoring passes the harness tolerance of `1e-6` world units. Right-drag pans, zoom clamps to 0.85–8, and finite out-of-range targets clamp to village bounds. Empty-ground/Space/touch pan paths are also present in the pointer handlers. Bounds take priority over cursor anchoring at an edge, as documented.
- Startup and later `#x,z,zoom,h0` hashes load; serializer normalizes headings, and debounced `replaceState` preserves query parameters. Hash parser/normalization tests pass.
- HUD clock, F +3h, hidden Look panel, real resident ray-hit/hover/click, follow card with role and current activity, and close-to-release pass. Building selection reuses the existing interior builder; the current-build runtime checker enters/renders/exits the inn in both medium and large villages. The existing bakery still shows a roofless furnished room with a close control.

## Rendering and existing stills

Visually inspected `overview.png`, `mid-zoom.png`, `close.png`, `npc-card.png`, and `building-peek.png` under `shots/village-iso/`. The overview has evenly lit olive meadow, a plain pale background and visible brown soil sides. No near-black-green terrain, disc hills, sky dome, or close-zoom outline explosion appears. Buildings, props, people and HUD remain readable at the closer views. The density qualification above remains.

The runtime hides the sky and spherical backdrop hills, installs an extruded island, and clears fog. Fresh browser checks at hours 6, 10, 17 and 22 find fog null and sky hidden. The fog test also rejects an externally supplied distance fog object. The frame update fits shadows after camera movement; shadow tests verify visible-ground coverage across zooms 1/3/8, translated targets and rotated views. Orthographic ink uses world units per pixel, and hull thickness is capped in drawing-buffer pixels. These checks establish the mechanisms and sampled visual states; they are not a pixel-identical lighting guarantee for every possible view/time/device.

## Live routines, props and hooks

`src/life/iso-life.js:17` installs routines after publishing the iso API and before the initial `api.setHour(hour)`. `createProps` runs immediately after `createInteriors` at line 21. Atmosphere remains on the live path. The props iso branch returns before walking-player geometry/input setup and exposes four room doors, inn meal and town bell.

Fresh `node tools/check-iso-life.mjs` passes for **large and medium**, seed 1234, Wednesday/clear weather. All twelve canonical residents have tool state and completed actions at startup and after repeatable seeks:

| Seek hour | Social activities | Resident tools |
| --- | --- | --- |
| 9.021 | greet, chat | talkTo, work, rest |
| 12.021 | chat, shop, eat, play | eat, talkTo, buy, visit |

Events reference the canonical tool-driven residents, not the ambient clones. The checker also confirms retained API/HUD, installed props, orthographic room peeks and no browser errors. Evidence: `out/iso-review-runtime.log`.

Compared hook marker suffixes against `9dfc5f0`: all **23** existing WORKTREE-HOOK markers remain; current source/package has **27**. Atmosphere, routines, interiors and props markers moved beside live iso calls. Evidence: `out/iso-review-hooks.json`.

## Fresh validation

| Command | Result |
| --- | --- |
| `npm run test:checks` | PASS: negatives, batches, medium checks and browser/Node parity |
| `npm run test:parity` | PASS: clean exit 0; 31 hamlet / 4 large seeds, forward/reverse, normal and one-ulp math perturbation |
| `npm run test:world-registry` | PASS: 11 tests |
| `npm run test:medium` | PASS: seeds 1, 7, 1234 and browser/Node parity |
| `npm run test:life-routines` | PASS: 8 tests |
| `node --test tests/life-iso.test.mjs` | PASS: 4 tests |
| `npm run build` | PASS: existing chunk-size/static-dynamic import advisories |
| `node tools/check-iso-life.mjs` | PASS: current built-app routines, props, peeks, iso lock |
| Review browser input audit | PASS: controls, hashes, hover/follow, atmosphere |

Required test logs are `out/iso-review-test-0.log` through `iso-review-test-5.log`, in the command order requested; final parity evidence is `out/iso-review-parity-final.log` and its status JSON. The first parity process emitted all assertions but returned 143, so it was rerun independently to establish a clean exit.

Recomputed full life-off compiled JSON SHA-256 hashes for hamlet, large and medium, seeds **1, 7, 19, 1234**: all twelve match the recorded pre-polish baseline `c2abc62`. Compiler, catalog, specs and frozen fixtures have no diff against current main `9dfc5f0`; parity additionally checks the original frozen defaults. Evidence: `out/iso-review-hashes.json` and `.log`.

Existing captures and film are unchanged. Review evidence and this report were written under ignored `out/`; no local commit was created, consistent with the instruction to commit only P0/P1 fixes.
