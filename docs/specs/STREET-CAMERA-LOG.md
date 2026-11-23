# Street-level camera decisions and results

## 22 November 2026

### Camera and controls

- Zoom `0.12–15` uses the original map projection, camera arm, quarter-turns, cursor anchoring and named destinations. `ZOOM_LIMITS.max` still marks the end of the map range. The overall zoom stop moves from 15 to `STREET_ZOOM_MAX` at 45.
- Above 15, tilt is `log(zoom / 15) / log(3)`. Zoom 25.981 is half tilt. The isometric arm contracts by `(1 − tilt)^7`, and the eye descends to 1.8 m above the street. The map projection blends into perspective by interpolating homogeneous W and solving depth against the near and far planes. The full street lens uses 62° vertical on desktop and 40° horizontal on the 390 × 844 phone. Near and far move from 0.1 and 3000 m to 0.08 and 750 m. Ground picking uses the inverse projection for the tilted range.
- The camera starts with the map heading and eases toward the street heading and a slight downward pitch. At tilt 0.68, approximately zoom 31.7, dragging and arrow keys move along the ground. Right-drag and two-finger translation take over yaw and pitch. A change in two-finger distance continues to zoom, with both pointer updates evaluated together. Yaw can turn a full circle. Pitch ranges from −27° to +50°. The map keeps its existing gestures through the first part of the descent. Reduced motion applies requested zooms directly.
- Landing checks compiled building and venue footprints expanded by 0.42 m. A 16 m spatial grid limits the swept box tests. The camera descends toward the nearest clear landing, slides along walls one axis at a time, and shortens its look point near a wall. Raised terrain uses box bounds for steep hills and the compiled Pinewood heightfield for walkable trails.
- The control state keeps `x` and `z` as the navigation anchor. In the tilt range, it also reports `tilt` (0–1), `eyeHeight` (metres above the local floor), `lookYaw` and `lookPitch` (radians). Yaw zero faces north and positive yaw turns east. Positive pitch looks up. The angle fields are the street orientation the transition is easing toward. `controls.lookTarget` gives the actual street look point. `controls.resize()` rebuilds the tilted projection when the viewport changes.
- Shared links retain `x`, `y` (world z), `zoom`, `r`, and optional map `elevation`. Zooms above 15 accept `yaw` and `pitch`. Existing links up to 15 keep the same framing and serialization. A large finite zoom such as 99 now clamps to 45. The zoom-in button stays enabled through the map limit.
- Astra’s skin post-processing scales down the overhead tilt-shift blur during descent. The selected grade, lighting and outlines carry into the street view.

### Evidence setup

The overhead baseline is an isolated production build of `c8a89e5`. Both builds use the same local Fast Load alias table and compressed models. Gold stills use seed 831 at hour 10.4, the Autumn skin with post-processing on, and paused simulation after streaming and view preparation. Performance uses the default Cel skin with simulation running during measurement. Chrome runs locally with ANGLE SwiftShader. Phone6 uses a 390 × 844 touch viewport, device DPR 3, a renderer DPR cap of 1.75 while settled and 6× CPU throttling.

### Phone6

Chrome 156.0.8078.47 used a cold HTTP cache and the same local production asset-size manifest for both runs. Ready is measured at `__readyAt`, after the first town render. Steady samples include six rendered frames. The input probe schedules a 3 s touch pan from the opening view and records intervals during input delivery.

| Measure | Overhead-only baseline | Street camera build, overhead | Street camera build, Sunbeam |
| --- | ---: | ---: | ---: |
| Cold ready | 22.43 s | 23.56 s | Same navigation |
| First-render draws | 542 | 542 | Same navigation |
| Settled FPS | 0.352 | 0.324 | 0.704 |
| Settled frame p95 | 4,149.8 ms | 4,433.1 ms | 2,016.5 ms |
| Settled draws, median | 613 | 613 | 259 |
| Touch-pan frame p95 | 2,583.2 ms | 2,916.5 ms | — |
| Touch-pan draws, median | 605 | 602 | — |

The matched run showed a 5% ready-time increase, 7% higher settled map p95, and 13% higher map-pan p95. First-render and settled overhead draw counts matched. In an earlier pair with the same model pack, ready went from 25.19 to 22.84 s, settled map p95 from 4,066.5 to 4,216.5 ms, and map-pan p95 from 3,549.9 to 2,799.9 ms. The paired runs show variation in ready and pan timing. Street rendering used 58% fewer draws than the settled map and more than doubled its measured frame rate. The street view missed the playable-rate target on this software-rendered profile. Physical-phone frame rate is unmeasured.

The progress bar increased monotonically and reached 100% 1.4 ms after baseline ready and 1.3 ms after street-build ready. Both runs recorded zero page errors and zero failed HTTP responses. Raw capture data is in `/workspace/scratch/street-camera/` under `baseline-phone6.json`, `after-phone6.json`, and the `trial-*-phone6.json` pair. The matched street profile looked north from `x = −125.7, z = −53` at 1.8 m eye height.

### Visual and browser verification

Market Square opening and the named Sunbeam map view were captured before and after on both viewports. RGB pixel comparison found zero changed pixels for both phone views and desktop Sunbeam. Desktop Market Square had five changed pixels out of 1,296,000. The independent blind reviewer had no preference across the four randomized map pairs and correctly ordered the randomized overhead, half-tilt and street captures on both viewports. Both street frames read as pedestrian eye level, with the shopfronts and people visible and no apparent geometry clipping.

The gold views use the Market Square opening, Sunbeam at `x = −125.7, z = −50` facing approximately north, and downtown at `x = −48, z = 7` facing along the road. The Sunbeam half-tilt and street views use the same anchor. Native Chromium touch and mouse events verified entry, walking, look-only gestures, zoom-out, and the zoom-in button at both limits. The eight stills and their camera data are in `shots/street-camera/`.

### Direct browser imports

The first CI pass caught a HUD browser test regression. That test imports the camera module directly, and importing the terrain compiler there pulled in modules that rely on Vite. The Astra entry point now supplies terrain to the camera only when street collision data is first needed. The existing HUD browser test passed on rerun. The rebuilt app reproduced all six half-tilt and street PNGs byte-for-byte and passed the native gesture checks on both viewports. The committed overhead PNGs are the originals used in the blind comparison.

### Automated verification

- `npm run build`, the 12 focused camera tests and the three direct-browser HUD tests passed.
- `npm run test:astra` passed 141 tests using the supplied CI asset root. The unscoped invocation reported one inventory mismatch because the shared installation includes packs beyond the catalog's inventory.
- `npm run test:checks` and the standalone clear-weather `npm run sim:collisions` passed.
- Scoped `npm run test:ci` passed all 338 tests, browser/Node parity, the rain and snow collision simulations, and traffic. The standalone scoped traffic run also passed. Seeds 831, 42 and 99 recorded zero overlaps, stalls and deadlock releases.

### Final Phone6 comparison

This repeat used a fresh Chrome process for each run. The baseline and final build used the same private asset pack and size manifest. Storm and traffic tests had finished before the browser pair started.

| Measure | Overhead-only baseline | Final build, overhead | Final build, Sunbeam street |
| --- | ---: | ---: | ---: |
| Cold ready | 25.77 s | 24.13 s | Same navigation |
| First-render draws | 542 | 542 | Same navigation |
| Settled FPS | 0.339 | 0.326 | 0.701 |
| Settled frame p95 | 4,249.8 ms | 4,799.8 ms | 1,633.3 ms |
| Settled draws, median | 613 | 613 | 259 |
| Touch-pan frame p95 | 2,633.3 ms | 2,883.2 ms | — |
| Touch-pan draws, median | 604 | 604 | — |

Ready improved by 6.4% in this pair. The final overhead run measured 13% higher settled p95 and 9.5% higher pan p95. Steady FPS fell by 3.9% with identical overhead draw counts. The small frame samples and variation between runs leave overhead timing inconclusive. Street rendering missed the playable-rate target under SwiftShader.

The loading bar reached 100% 1.3 ms after ready on the baseline and 2.7 ms after ready on the final build. Both fresh processes recorded zero page errors and failed HTTP responses. The final raw files are `/workspace/scratch/street-camera/isolated-baseline-phone6.json` and `/workspace/scratch/street-camera/isolated-after-phone6.json`.
