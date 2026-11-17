# Iso camera polish

Branch: `village/iso-camera`, based on main `c2abc62`. Local work and commit only; no merge, push, deployment, purchase, external model or GPU service. All edits are confined to this worktree.

## Rendering

The iso sky dome is hidden instead of moved/scaled with the camera. Backdrop sphere hills and the unbounded ground disk are replaced at runtime by a rounded soil-sided island. Its meadow uses Lambert lighting and gentle world-space colour variation. Background is the lighting system's plain horizon clear colour. Water cutouts for the large village's garden channels are retained. Distant woodland decoration no longer inflates camera framing, and objects beyond the island are hidden in their runtime instance matrices.

Orthographic depth ink uses drawing-buffer world units per pixel and the ink sampling width. Hulls retain their pixel-width cap. The fog hook explicitly clears distance fog whenever the stage is orthographic, even if another system has supplied a fog object. The directional shadow camera fits the current visible ground corners plus a 20-unit caster-height envelope, follows pan and zoom, and sets a suitable light distance/far plane. Sun direction is reset from lighting before translating the light and target together, preventing accumulated view-dependent direction changes.

## Density and ownership

Hero URL: `/?size=medium&seed=1234&life=1`. The 31 compiled homes, chapel, farms, stream and bridge are unchanged. Runtime adds 17 reserved garden beds with flowers, short fences and alternating laundry lines; street edging; 28 forest-edge tree placements using the existing tree assets; and twelve ambient neighbours walking the existing navigation graph. Existing art dressing supplies carts, barrels, baskets, flowers and other yard props. Furniture far from buildings is hidden instead of filling meadows.

The original twelve residents keep their roster, schedules, cards, social activity and building interactions. The additional neighbours are ambient visual walkers rather than new scheduled/inspectable roster entries. New additions are batched by geometry/material where appropriate. Garden placement respects existing dressing reservations and walk corridors. No compiler, catalog, frozen layout, registry, people/schedule implementation or lighting-polish internals were edited. Every pre-existing WORKTREE-HOOK line remains. The only additional shared-file hook is in `src/life/fog.js`.

## Validation

- `npm run build`: passed; existing Vite bundle-size advisory.
- `npm run test:checks`: passed.
- `npm run test:parity`: passed, including forward/reverse and one-ulp perturbation parity.
- `npm run test:world-registry`: passed, 11 tests.
- `npm run test:medium`: passed, seeds 1, 7, 1234.
- `node --test tests/life-iso.test.mjs`: passed, 4 tests, including fog rejection and shadow coverage at zooms 1/3/8 with translated targets and rotated views.
- SHA-256 of full life-off compiled JSON matches `c2abc62` for hamlet, large and medium, seeds 1, 7, 19, 1234 (12 comparisons). See `shots/village-iso/life-off-hashes.json`.
- Close-view shadow on/off diagnostic: disabling the sun's shadows changes 3.97% of pixels by more than 10 RGB levels, confirming cast/self shadow coverage in the close view.
- All 16 pre-existing WORKTREE-HOOK lines were checked against HEAD and preserved exactly.
- Large-village Chrome/SwiftShader smoke passed: orthographic camera, fog null, 11 reserved gardens, 19 forest-edge trees, original 12 inspectable residents, and successful post render. See `large-smoke.json`.
- Chrome/SwiftShader harness asserts startup/hash round trip, locked orthographic mode, true elevation, clamp, anchored wheel/touch zoom, pan/rotation/time controls, NPC hit/hover/follow/close and building peek/close. It also checks no fog, gardens, forest additions and ambient neighbours.

## Captures

`shots/village-iso/overview.png`, `mid-zoom.png`, `close.png`, `npc-card.png` and `building-peek.png` are recaptured with post on. Mid/close framing now covers the central residential/market streets. The overview shows the whole medium island against a plain background.

`village-iso.mp4` is a 24-second 1280×720 H.264/yuv420p film: 96 post-rendered keyframes at 4 fps, motion-interpolated to 24 fps, with a slow eased pan/zoom from overview to the market street. Simulation advances on each frame at timescale 12; the capture asserts that scheduled residents change position. The harness supports `--stills-only` and `--video-only`, including resuming encoding from a complete PNG set. The initial encoding process was interrupted; the final encode reused all 96 completed frames. Five original scheduled residents changed position during the recorded simulation. `evidence.json` records view states, runtime counts, movement and ffprobe results.

Visual density is improved through dressing and people; original street spacing and building placement remain intact as required. The film uses software rendering and temporal interpolation rather than a real-time hardware capture.
