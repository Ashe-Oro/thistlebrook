# M3 interiors review — 2026-11-16

Decision: **APPROVE with P2/P3 leftovers only; no P0 or P1 remains.** Scope: `/workspace/cel-town-m3`, branch `village/m3-interiors`, implementation commit `208ad4a`. Reviewed against `docs/village/BRIEF-m3.md` and `out/codex-village-m3-report.md`.

## Findings

No P0 or P1 found. All acceptance-blocking checks passed; the following polish findings remain documented and unfixed.

- **P2 — duplicate room signage and faint world-space lettering.** `src/life/interiors.js:97` places a room-name sign on the back wall while `src/life/interiors.js:157` also displays the room name in the HUD. In bakery, inn, store, and smithy stills, the sign sits just below/behind the HUD and its lettering is faint with the full post stack. Timber also crosses some signs. The primary title/subtitle, furniture, and interaction prompts remain readable; this is localized scene-sign legibility and redundant labeling, not a broken HUD or unreadable scene. Leave for polish: move/remove the duplicate sign or improve its placement/post legibility. Counter, hearth, and doorway world-space lettering also loses clarity with post; the actionable DOM prompt remains clear.
- **P3 — Look control in captures.** The collapsed compile-page Look control remains in the lower-right corner of all interior stills and video (`tools/shots-village-m3.mjs:33`). It does not obscure the rooms, lantern, doorway, or interaction prompts. Hide it in a future presentation-only pass.
- **P3 — stale notice at video start.** The first street frame still says “Browse the market stall · fresh village produce,” carried over from the harness's prior stall test. The actual door prompt/entry works and the notice clears on entry. Allow the notice to expire before recording in a future capture pass.

## Visual and video review

Inspected all six requested PNGs at 1280×720. Bakery has bread shelves, hearth fire, barrel, sacks and counter; inn has furnished tables/chairs and hearth; store has books, jars, produce and counter; smithy has anvil, workbench/tools and forge. Store has no hearth, which is consistent with the brief (the report's room-specific description does not promise one). Lantern shot shows a supported metal-framed lantern. Doorway shot shows a framed opening and the clear “E · Return to Willowmere” prompt.

Decoded the actual MP4 to `out/codex-village-m3-review-video.jpg`, rather than relying only on the supplied proof PNGs. Confirmed street approach → fade/entry → bakery/counter → lantern interaction → automatic exit back to the street. Existing frame-by-frame evidence records bakery entry by frame 24, lantern off at 88/on at 100, doorway crossing at 132, and outside at 143. ffprobe independently confirms H.264, 1280×720, 12 fps, yuv420p, exactly 12 seconds. The recording disables post processing, hull outlines, and shadows for SwiftShader; the stills retain post and hulls. This difference is disclosed, acceptable for M3, and explains the sharper world-space lettering in video.

The exterior is a fade portal at a safe doorstep; the indoor doorway is a real collision opening leading into a lit vestibule. The image is not a live view of the outdoor street through the portal. This matches the brief's permitted fade/step transition.

## Fresh verification

- `npm run test:checks`: PASS, including namespaced missing-bakery and trigger-inside-wall negatives, additional-seed safe triggers, life-off exclusion, and existing checks/batches.
- `npm run test:parity`: PASS. Both Vite SSR and one-ulp math perturbation pass; 31 hamlet seeds and four large seeds produce identical full JSON, including the frozen default-layout fixtures and life/Edo variants.
- `npm run build`: PASS, with the existing large-chunk advisory.
- Independently recomputed all eight life-off SHA-256 values (hamlet/large × seeds 1, 7, 19, 1234): identical to `out/codex-village-m3-baseline.json`.
- Fresh Playwright/Chrome browser verification: PASS for bakery, inn, store, and smithy. Keyboard E entry/exit, automatic walking exit through the doorway, all four wall boundaries away from the opening, backing away after each wall collision, bakery/store counter collision/use, feet at y=0, lantern off/on, and lantern state surviving exit/re-entry all passed. Eight fixtures carry real fixture metadata. `__life.interior` returns the active room and returns to null outside. Fresh `?interior=bakery` load passed; no page errors or failed asset responses. Review runner/evidence are `out/codex-village-m3-review-checks.mjs` and `out/codex-village-m3-review-evidence.json`.
- The initial default play URL loaded successfully. Sustained movement probes used `post=0&prmax=1&shadowMap=256` for software-rendering speed. Supplied full-post stills were independently inspected. An initial review-runner assertion used a forced position inside the inn bench; the probe was corrected to clear floor and the entire suite rerun successfully. This required no product fix.
- Existing harness evidence plus source review confirm solid exterior footprint/gate collision, stall use, direct `interior=store`, camera-mode guards, and counter collision. The M3 wrapper preserves the exterior walk updater and uses safe doorstep triggers; it does not carve the licensed exterior mesh.

## Changes and scope

No application code changes or P0/P1 fixes were required. Existing shots/video were preserved because no rendering or behavior changed. Review-only runner, JSON evidence, decoded video contact sheet, and this report are under `out/`. No local commit, merge, push, deployment, purchase, licensed-asset copy, external model call, or discrete GPU use. No other worktree edited. No milestone beyond M3 started.
