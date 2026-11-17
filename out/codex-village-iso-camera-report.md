# Living Village — isometric diorama camera

Implemented locally on `village/iso-camera`, based on main `0b595b9`. No other worktrees were modified, no branches merged, and nothing was pushed or deployed. No paid services, API keys, LLM calls, MCP servers, or GPU rental were used.

## Result

Life mode now enters a single orthographic camera through one marked hook in `src/life/index.js`. It never invokes the walk controller or spawns its player figure. The twelve original residents, simulation, social events, atmosphere, and lighting remain active. Elevation is exactly `atan(1/sqrt(2))` (35.2643896828°); base yaw is 45°, with eased Q/E quarter-turns. Perspective switching is disabled in life mode, including the debug Look panel.

Wheel and touch pinch ease toward the pointer; right-drag, Space-drag, empty-ground left-drag, and touch drag pan. Targets clamp to the existing town-core bounds. Zoom spans 0.85–8 times the village-fit scale. Share hashes load at startup, react to later hash changes, and save with debounced `history.replaceState` without removing the play query. Hash syntax and the capture API are documented in `docs/village/ISO-CAMERA.md`.

Buildings and residents have hover tooltips. Resident clicks follow that resident and show their roster name/role plus the current social action or existing schedule activity. Bakery, inn, store, and smithy clicks show roofless versions of the existing interiors builder’s rooms with the same orthographic camera. Other building clicks ease into an exterior close-up. Empty ground, ground dragging, Escape, or the close control releases inspection; interior peeks return to the previous village view. Quiet clock and iso hints replace the dormant walk HUD. F still advances three hours; Look is hidden unless `debug=1`.

The shared three-step toon ramp, lighting palette, and inverted hulls remain. Runtime-only life tuning reduces painterly blur and crease strength. Hull widths respect imported model scales and cap at 0.85 drawing-buffer pixels. A single marked post hook scales ortho depth thresholds with world units per pixel: this prevents continuous ground slopes becoming solid ink at overview. The sky dome follows the ortho camera so distant camera placement cannot expose the dome’s faceted outside. DOF was omitted to keep props and residents readable.

## Ownership

New runtime files: `src/life/iso-camera.js`, `iso-life.js`, `iso-interact.js`, and `iso-hud.js`. Existing source changes are exactly one marked hook line each in `src/life/index.js`, `src/life/interiors.js`, and `src/post/post.js`, plus one capture script entry in `package.json`. All pre-existing WORKTREE-HOOK lines remain. Stage, walk-camera implementation, compiler, registry, catalog, lighting sources, people, schedules, tools, and other worktree-owned files were not edited.

## Validation

- `npm run build`: passed (existing large-bundle warning; the deliberately shared static/dynamic iso module also produces a harmless Vite chunk advisory).
- `npm run test:checks`: passed, including batch geometry and interiors checks.
- `npm run test:parity`: passed: 31 hamlet seeds and four large seeds, forward/reverse and one-ulp math perturbation.
- `npm run test:world-registry`: all 11 tests passed.
- `node --test tests/life-iso.test.mjs`: both tests passed (hash round trips/validation, heading normalization, clamp, exact angle).
- Independent SHA-256 comparison against a temporary archive of `0b595b9`: hamlet and large seeds 1, 7, 19, and 1234 are byte-identical with life off. Recorded in `shots/village-iso/life-off-hashes.json`.
- Additional final-source Chrome QA passed for non-life numeric cam/target coordinates, non-life iso/perspective switching, life-only camera locking, debug Look visibility with camera chooser hidden, ineffective WASD/Tab/M walking keys, and portrait resizing. Recorded in `shots/village-iso/additional-qa.json`.
- Chrome/SwiftShader capture assertions cover orthographic-only mode, all 12 residents, zoom limits, target clamps, cursor-anchored zoom, hidden Look panel, wheel, right drag, Q/E, F, real two-finger touch pinch, startup and later hash loading, actual NPC ray hit/hover/click/follow/close, and building peek/close. Detailed numerical evidence is in `shots/village-iso/evidence.json`.

## Captures

`npm run shots:village-iso` uses local `/usr/bin/google-chrome` with ANGLE/SwiftShader at 1280×720, `prmax=1`, and `shadowMap=1024`. Both `--stills-only` and `--video-only` are supported. The harness drives `__iso` and `__life.step`, with no walking input.

Stills: `overview.png`, `mid-zoom.png`, `close.png`, `npc-card.png`, and `building-peek.png` in `shots/village-iso/`. All use post processing, hulls, edges, and time-aware grading. The close/mid views use a quarter-turn to show the shop fronts. Capture hour is 10:00 AM.

Film: `shots/village-iso/village-iso.mp4`, 15 seconds, 1280×720, H.264/yuv420p, 12 fps, 180 output frames from 60 rendered keyframes (4 fps) with ffmpeg motion-compensated interpolation. Slow smoothstep pan and zoom from overview to the bakery street; post remains on. Probe details are recorded in the capture evidence.

## Practical limits

The room peeks reuse the established off-town room models rather than altering exterior roof assets. Storage coordinates never enter the share hash. Ground bounds take priority over cursor anchoring at a clamped boundary. Captures demonstrate the desktop 1280×720 path and real CDP touch pinch; physical mobile-device testing was not performed. Browser software rendering is slower than interactive GPU rendering.
