# Build "Street-level camera", a pinch-or-scroll tilt from Thistlebrook’s overhead map down to eye height on the street.

## Reference

The live town is https://thistlebrook.vercel.app (Sunbeam Mall just shipped; this branch starts from local main `c8a89e5`). The production camera is the orthographic map controller in `src/astra/camera.js` (`createMapCamera`), wired in `src/astra/main.js` as `window.__astra.controls`. Overhead zoom is `ZOOM_LIMITS` `{ min: 0.12, max: 15 }`. Default framing is the classic isometric arm (undefined elevation: radius 800, height `800/sqrt(2)`). Named views may set elevation 30–70 (for example `SUNBEAM_PHONE_VIEW` at `{ x: -126, z: -61.5, zoom: 3.7, elevation: 58 }`). Wheel and pinch zoom toward the pointer; one-finger or left-drag pans the ground; two-finger drag pans around the pinch midpoint and pinches to zoom; right-drag also pans; Q/E snap 90°; inertia follows a phone release. There is no look-around and no eye-height view today.

Ashe’s words (22 Nov 2026): pinch or scroll past the current zoom limit and the camera smoothly tilts from the overhead view down toward the horizon, reaching eye height (~1.6–2 m) at street level. In that mode, drag pans or walks along the street and a second gesture (two-finger drag on phone, right-drag on desktop) looks around. Zooming back out returns smoothly to the normal overhead camera. Keep collisions sensible: no clipping into buildings or under the ground. It must work on phone touch and desktop mouse, and phone performance must stay at least as good as now. Existing overhead behavior and the loading bar must not regress.

Gold stills, seed 831, hour 10.4, post on. Capture each view at phone 390×844 (DPR 3) and desktop ~1440×900:

| View | Aim | Files |
| --- | --- | --- |
| Overhead, Market Square or Home / opening | Indistinguishable from today’s map at the same zoom: isometric town, no horizon, no tilt | `shots/street-camera/overhead-phone.png`, `overhead-desktop.png` |
| Mid-tilt, same target as the street-level Sunbeam shot | Between map and street: the camera has started to pitch toward the horizon; shopfronts and pavement are already more upright; the move feels mid-transition, not a snap | `shots/street-camera/mid-tilt-phone.png`, `mid-tilt-desktop.png` |
| Street level, Sunbeam Mall, looking along the north–south promenade | Eye height (~1.6–2 m). A horizon is visible. The 6 m walk, pastel shopfronts, planters and people read clearly. No ground clip, no camera inside a facade | `shots/street-camera/street-sunbeam-phone.png`, `street-sunbeam-desktop.png` |
| Street level elsewhere (Market Square or downtown) | Same eye-height feel on a different street; buildings and people readable; no clipping | `shots/street-camera/street-elsewhere-phone.png`, `street-elsewhere-desktop.png` |

A good street still looks like standing on the street looking toward the horizon, not a zoomed-in ortho map. A good overhead still matches today’s map.

## Details

Extend the existing astra map camera. Do not switch the product to the old life walk camera or spawn a player figure. `src/life/camera.js` is a collision reference only (axis sliding, keep-out from footprints, `y` never below about 1.6–1.7). The unused life iso camera in `src/life/iso-camera.js` stays as it is.

1. **Overhead is unchanged** for every view with zoom at or below 15, including opening, Home, named `?view=` destinations, shared hashes with `zoom<=15` and optional elevation 30–70, Q/E, wheel/pinch toward the pointer, one-finger and left-drag pan, two-finger pan+pinch, right-drag pan, phone inertia, and `prefers-reduced-motion` jumps. `SUNBEAM_VIEW` / `SUNBEAM_PHONE_VIEW` and Market Square opening stay as they are.

2. **Past the current zoom stop, zoom becomes a smooth tilt.** Further wheel, pinch, `+` / zoom-in, or `controls.zoom` past 15 continues one continuous gesture: the camera tilts from the current overhead angle down toward the horizon and the viewpoint lowers to eye height (1.6–2.0 m above ground). Zooming out reverses the same path and returns to the normal overhead camera with no pop (reduced-motion may jump). Street level should feel like standing on the street looking toward the horizon, so a perspective camera (or a blend into one) is expected; a pure orthographic zoom cannot show a horizon. If ink, toon, fog, or post assume ortho, update them so outlines and grade still look right in the tilt and at street level (`src/toon.js` already branches on projection). Keep near/far planes sane so the ground does not vanish and distant town does not clip away.

3. **Street-level controls.** One-finger drag, left-drag, and arrow keys pan or walk along the street (move on the ground, in the look direction for forward/back). Two-finger drag on a phone and right-drag on desktop look around (yaw and pitch). Pinch distance still zooms: a change in finger distance zooms, a stable-distance two-finger translation looks around. In overhead, right-drag and two-finger keep today’s pan behavior. Look pitch must not flip upside down or stare into the ground; yaw is free. Look-around does not appear until you are meaningfully in the tilt/street range.

4. **Collisions.** The camera never goes under the ground. The camera and its look target stay out of building and venue footprints (use existing town building/venue boxes or equivalent cheap solids; prefer box/OBB tests, not per-frame mesh raycasts). Slide along walls the way the life walk camera does. Looking around must not push the camera through a facade. Cheap tests only — phone frame time matters.

5. **Hash, UI, and API.** Existing overhead links stay valid and produce the same view. Street state may extend the hash (a zoom past 15, or an extra param) without breaking old links. Update tests that currently clamp `zoom=99` to `ZOOM_LIMITS.max` (15) so they match the new contract honestly. Zoom-in stays enabled past 15 and disables only at full street level; zoom-out still disables at `ZOOM_LIMITS.min`. Keep `__astra.controls` (`view`, `zoom`, `state`, `groundAt`, `update`, …) usable for shots and tests; document any new fields (`tilt`, eye height, look yaw/pitch) in `docs/specs/STREET-CAMERA-LOG.md`.

6. **Out of scope.** No ship PR, push, or deploy. No player avatar. No interior walkthrough. No skin or loading-bar redesign. Do not rewrite districts.

## Tools

Work only in `/workspace/cel-town-wt/street-camera` on branch `village/street-camera` (already created from main `c8a89e5`). `node_modules` is a symlink to the shared install; do not reinstall unless something is actually missing. Preferred files: `src/astra/camera.js`, `src/astra/camera-ui.js`, tests, a small shot/probe script under `tools/`, stills in `shots/street-camera/`, this spec, `docs/specs/STREET-CAMERA-LOG.md`, and CHANGELOG. Touch `src/astra/main.js`, toon, post, or fog only if the tilt or perspective switch needs it.

Tests: extend `tests/astra-camera.test.mjs` and add a focused street-camera test module covering the tilt continuum, eye-height range, overhead invariance below zoom 15, hash compatibility, look-around vs pan gesture split, and collision cases (into a box, under the ground, sliding along a wall). Update `tools/shots-astra-camera.mjs` if it assumes `zoom(100)` clamps to 15. Run `node --test tests/astra-camera.test.mjs` plus the new tests, `npm run test:astra`, `npm run test:checks`, and `npm run sim:collisions`. For `npm run test:ci` and `npm run sim:traffic`, use `ASTRA_ASSET_ROOT="$(cat /workspace/scratch/ship-fastload/ci-asset-root.txt)"` (that file currently points at `/workspace/scratch/ship-nov21/ci-assets-paTd6N`). There is no `validate.py`.

Shots and perf: playwright-core and `/usr/bin/google-chrome`, same SwiftShader flags as `tools/phone-smooth-probe.mjs`. Pick a free port, not 5173. Drive the camera through `__astra.controls` / `__astra.view` after `__ready`. Write the eight stills above (and a short evidence JSON) to `shots/street-camera/`. Phone6 probe (390×844, DPR 3, 6× CPU throttle) on the opening view and once settled at street level in Sunbeam: record ready time, settled fps or frame-time p95, and draw calls before (overhead-only baseline on this same build, zoom clamped as today) and after (with street mode present, measured both overhead and at street level). Put raw probe JSON under `/workspace/scratch/street-camera/` (not in git) and summarise numbers in the log.

On this shared box, run at most one heavy job of your own at a time, and do not start more than one long build or browser probe in parallel. Leave CPU and memory for others. Stop servers, browsers, and temp processes you start. Never push, never deploy, never force-push, never print secrets, never copy licensed files into git.

## How to work

Autonomous, with no questions. Log assumptions, the zoom-to-tilt mapping, eye height chosen, projection blend, gesture rules, collision approach, hash contract, and old→new values in the append-only `docs/specs/STREET-CAMERA-LOG.md`.

Measurable targets:

- For any overhead state with zoom ≤ 15, pan, zoom, rotate, opening, and hash behavior match today’s camera. A still at the Market Square opening and at `?view=sunbeam` must match a baseline taken on this branch before the camera changes (pixel-near, same framing).
- Zooming past 15 tilts smoothly; at full street level the camera height is between 1.6 m and 2.0 m inclusive, a horizon is visible, and looking along Sunbeam’s N–S promenade (`x ≈ -126`, z between about −87 and −36) shows the walk and shopfronts. Mid-tilt is visually between the two.
- Collision tests: a move that would enter a building box is rejected or slid; camera `y` never drops below the eye-height floor; a look that would clip into a facade is kept out. No underground shots.
- Gesture tests (unit or a small headless pointer sequence): in street mode, left/one-finger drag changes ground position, right-drag / two-finger translation changes look, pinch distance changes zoom/tilt. In overhead, two-finger and right-drag still pan.
- Phone6 ready time and overhead pan/frame-time are not worse than the same-build overhead baseline (small noise is fine; a clear regression is not). Street-level frame time stays playable on that profile; log the number. Loading-bar tests and the opening progress behavior stay green.
- A blind critic, shown overhead before/after in random order, must not prefer one as “the real map.” Shown mid-tilt vs street vs overhead, they should order them as overhead → mid → street and call the street view an eye-level look down the street. If a change makes overhead feel worse or clips the camera, revert it. Ashe’s words override critics.

Loop until the gold stills hold, collisions are clean, and the tests pass. Use subagents only if they stay inside this worktree and do not start extra heavy jobs.

## Deliver

Local commit(s) on `village/street-camera` only. Include a CHANGELOG entry under Unreleased (same prose style as the closer-zoom and loading-progress entries), this spec, the decisions log with probe numbers, tests, and stills in `shots/street-camera/`. Do not push or deploy. In the final summary state: branch and SHA, how the controls feel in one short paragraph, the zoom-to-tilt mapping and eye height, test results, phone6 ready time and fps/frame-time (overhead baseline vs after, plus street level), and the shot file paths.
