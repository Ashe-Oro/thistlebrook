# Astra camera and inspection merge notes

This branch replaces Astra's OrbitControls with a fixed isometric orthographic map camera. Camera state is shareable; buildings and residents retain their existing stories and gain selection markers. No compiler, district, asset catalog, resident simulation, dependency, or Vite configuration changes are required.

## Files and integration

- `src/astra/camera.js`: input, ground-plane projection, eased zoom and view transitions, quarter-turn rotation, hash persistence, and bounds derived from compiled nodes and parcel boxes.
- `src/astra/camera-ui.js` and `camera.css`: existing toolbar enhancement, zoom readout, share action, oriented compass, keyboard help, mobile layout, live resident activity and follow state.
- `src/astra/selection.js`: resident ring and building/venue corner markers. Does not mutate kit materials or district geometry.
- `src/astra/main.js`: the only shared application integration file changed. Creates the controller and UI, passes tap/hover callbacks into existing picking and stories, updates the controller each frame, and removes OrbitControls and the old duplicate pointer/rotation handlers.
- `tests/astra-camera.test.mjs` and `tools/shots-astra-camera.mjs`: hash/bounds unit tests and deterministic browser interaction checks.
- `tools/shots-astra.mjs`: existing regression runner now advances positive frame time before zoom assertions. Optional `ASTRA_SHOTS` output override avoids overwriting older evidence.

When resolving a `main.js` conflict, preserve the lead branch's district view presets and story additions. Keep the new `createMapCamera` wiring, `controls.view(dest, immediate)`, `controls.update(dt)`, `controls.restore()` at startup, and `inspectPoint(x, y)` callback. Remove the old OrbitControls, `desiredView`, `heading`, `orient`, pointer listeners and hardcoded pan clamps. The map controller owns these behaviors now. `__astra.controls.target`, `__astra.view(...)`, `pick(...)`, and the other existing debugging hooks remain available. `__astra.audit().camera` adds serializable camera state.

New buildings and venues continue to be discovered through `world.selectables` (`type`, `data`, `bounds`). Optional `data.description` or `data.story` takes precedence over the old authored story dictionaries. Unknown venue types receive a generic story. Resident inspection still uses `residents.pick` and each resident's existing `name`, `role`, `story`, `activity`, and `object`.

## Controls and persistence

- Left/right/middle drag or one-finger drag pans on the ground plane. Arrow keys pan with the same projection.
- Scroll, trackpad, pinch, toolbar +/− or keyboard +/− zoom between 0.7× and 5×. Wheel delta units are normalized. Zoom eases with elapsed frame time and keeps the ground point under the cursor fixed, except when a map boundary prevents movement. Pinch uses its midpoint.
- Q/E or the rotate button turns exactly 90°. Pitch never changes. Four turns return to the same orientation.
- H/Home or Reset view goes to the town preset. Existing district tabs still use their current presets.
- Primary click/tap inspects; hover names a place or resident. A drag that returns to its starting point remains a drag. Right clicks, multitouch gestures and pointer cancellation never select.
- Resident cards show current activity and toggle Follow/Stop following. Manual camera input ends following. Escape, Close details or an empty-ground click clears inspection.
- Reduced-motion preference removes zoom and view-transition easing. Keyboard shortcuts ignore form fields, links, buttons, editable text and browser modifier combinations.

Example: `/?seed=831#x=-57&y=-6&zoom=3.5&r=0`.

Hash `x,y` are horizontal map coordinates: `y` maps to Three.js `z`, not camera altitude. `zoom` is orthographic zoom; `r` is the quarter-turn index 0–3. Positions round to 0.001 world units and zoom to 0.0001. Valid hash state takes precedence over `?view=` at startup. Invalid/incomplete values fall back to the requested/default view; zoom and coordinates are bounded. Other hash fields and all query parameters are retained.

The address updates with `history.replaceState`, throttled to at most one scheduled write per 160 ms, with a final write on page exit or Share view. This avoids polluting Back history. External hash changes and Back/Forward restore the camera. Share copies the current visible view, with a selectable link fallback if clipboard access is unavailable. A link restores camera framing, not simulation time or selection.

## Validation and screenshots

Use **port 5186 only** for this branch:

```sh
npm run dev -- --host 0.0.0.0 --port 5186 --strictPort
node --test tests/astra-camera.test.mjs
node tools/shots-astra-camera.mjs
ASTRA_URL=http://localhost:5186/ ASTRA_SHOTS=/tmp/astra-camera-regression/ npm run shots:astra
npm run test:astra
npm run build
```

The new browser runner records real pointer, wheel, keyboard and native CDP touch input. Frames advance explicitly to check easing and cursor-anchor accuracy. It also checks follow overrides, live activity, rotation, limits, copying, reload, hash navigation, browser Back, invalid links, reduced motion and a 390×844 mobile layout. Evidence is in `shots/astra-camera/evidence.json` and the adjacent PNGs. `01-before.png` is the pre-change reference; the other images show the final UI.

Validation on this branch passed: all 3 camera unit tests, all 5 Astra compiler tests (including the 100-seed sweep), all 10 browser check groups, the existing Astra interaction regression, and the production build. The measured cursor-anchor error was approximately `2.01e-14` world units. A final UI check also confirmed no repeated live-card DOM mutations while paused, scrollable mobile help, and no horizontal overflow at 844×390.

The existing build may report its pre-existing mixed static/dynamic `iso-interact.js` import and large bundle warnings. Licensed models are read through the existing ignored `public/licensed` mapping to the owned library; no models or library changes belong in this commit. No deployment or remote push is part of this change.
