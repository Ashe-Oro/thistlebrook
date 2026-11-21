# Phone smoothness profile

November 21, 2026. Baseline `d3889e6` with the Market Square opening. The before and after production bundles used identical locally prepared Fast Load model payloads and routes. Captures and traces are under `/workspace/scratch/phone-smooth/`.

## Cold startup

Chrome 156 with ANGLE SwiftShader, a 390 × 844 touch viewport, device DPR 3, and 6× CPU throttling. The probe disables HTTP caching and uses a fresh browser per profile. Ready is the application's first town render submission, recorded by `__readyAt`.

| Cost | Before | After |
| --- | ---: | ---: |
| Main thread JavaScript compilation events | 22 ms | 25 ms |
| World plan | 28.6 s sampled on main | 1.86 s wall time, including 1.55 s on the planner worker |
| Draco worker execution, two worker threads summed | 142 ms | 142 ms |
| Scene assembly and asset loading | About 17 s | 14.39 s from plan to first render |
| WebGL shader and program queries through ready | 446 ms | 523 ms |
| First render submission including scene update | About 1.56 s sampled | 2.19 s wall time |
| Main thread minor and major GC through ready | 1.51 s | 0.47 s |

The rows use different trace scopes and some overlap. The uninstrumented baseline uses CPU samples and trace spans. The after build adds marks around planning, scene assembly, and the first render. The startup trace contains Draco decode and main thread geometry setup, including unpacking attributes and welding outlines. The Market Square opening made no KTX2 decoder requests in either run. JavaScript module evaluation on the baseline included the synchronous world plan. Most of its samples came from library-scene placement, Pinewood trail clearance, and rebuilding the road graph.

Spatial indexes narrow the compiler's clearance and intersection searches. The exact checks and placement order agree with the baseline. The compiled plans were byte-identical for seeds 831, 42, and 1234. On the phone, the planner runs in a worker and adds 346 kB of gzipped JavaScript. The same scoped districts gate the opening and the same nearest-first queue streams the rest.

## Rendering and touch

The renderer merges compatible static geometry, instances repeated models, and submits compatible rigid parts with WebGL multi-draw. The wide view combines more draws once streaming settles. Browsers without that extension use the existing mesh path for those parts and still use static merging and instance culling. Vegetation and street furniture submit only placements that intersect the view or a refreshed shadow map. Offscreen crowds and actors keep their simulation state. Phone drags temporarily use the existing lower meshes, reduce the drawing-buffer ratio from 1.75 to 1, and reuse the shadow map while its coverage holds. Resting views restore full detail.

A touch move updates the camera during the event. UI and URL publication follow through the frame loop. Inertia begins after release and respects reduced motion. The probe sends a three-second trajectory at 30 Hz through Chrome's touch input protocol. It compares each latest delivered camera state with the next submitted town frame. Frame intervals use successive render starts. The sample includes an interval crossing finger release so a renderer stall spanning the end of the gesture is visible.

| 6× gesture trace | Before | After |
| --- | ---: | ---: |
| Renderer, including command waits | 15.88 s | 7.10 s |
| Shadow pass, including command waits | 7.01 s | 0.33 s |
| GPU command-buffer waits | 13.43 s | 4.92 s |
| Resident update | 514 ms | 473 ms |
| World update | 337 ms | 331 ms |
| Main thread minor GC | 60 ms | 39 ms |

These are overlapping totals across each trace's gesture window. The renderer numbers come from sampled stacks. Command waits and GC come from trace spans. Settled opening triangles fell from 14.85 million to 3.11 million. Both gesture traces contain long buffer waits and delayed touch delivery. A trial that compiled streamed shaders and primed uniforms before the pan recorded a 4.03 s p95 against 3.53 s for the retained build. The trial was reverted. The report keeps the scheduled trajectory, delivered events, actual gesture duration, render intervals, and matches.

## Acceptance

| Profile | Ready before → after | Pan p95 before → after | Wide draws before → after |
| --- | ---: | ---: | ---: |
| Phone, 6× | 48.34 → 19.24 s (−60.2%) | 6,795 → 3,535 ms (−48.0%) | 6,473 → 1,390 |
| Phone, 4× | 34.70 → 13.91 s (−59.9%) | 6,362 → 2,919 ms (−54.1%) | 6,473 → 1,390 |
| Desktop, 1× | 9.13 → 6.74 s (−26.2%) | — | 6,453 → 1,389 |

At 6×, ready time, pan p95 improvement, and wide draws passed their targets. Delivered camera updates appeared on the next rendered frame. The 100 ms maximum after the first second **missed** its target. The observed maximum was 3,535 ms. The 3 s input dispatch took 16.74 s before and 9.94 s after to reach finger-up in Chrome. The 6× runs had four measured frames apiece, and the longest measured input-to-submit time after the change was 6.14 s. This is the software-rendering result on the shared box.

The final blind reviewer found matching views in all eight randomized pairs. The phone images were 99.8370% to 99.9952% pixel-identical. The desktop images were 99.7096% to 99.9417% pixel-identical. All pairs had a mean absolute RGB channel difference below 0.0043 on a 0–255 scale. The reviewer recorded impressions before unblinding. The notes and metrics are in `blind/` and `blind-desktop-ready/` in the artifact directory.

The ready camera and opening district set matched on both devices. The separate Fast Load probe also passed Overview, minimum zoom, Home button, Home key, and both phone camera-link checks. All 73 phone and 63 desktop streaming jobs completed, with zero failed resource requests or page errors. The desktop measurements also decreased for the opening, wide, and Harvest render submissions. Render submissions can include GPU work queued by a previous view.

Scoped `npm run test:ci` exited successfully. All 314 tests passed, along with the repository checks, rain and snow collision runs, and the traffic runs for seeds 831, 42, and 99. The CI log and exit status are `test-ci.log` and `test-ci.exit` in the artifact directory.

## Reproduction

Use the same prepared model routes and compressed files in both production builds. Run from this worktree with the shared dependencies linked in `node_modules`.

```sh
node tools/phone-smooth-probe.mjs before /workspace/scratch/phone-smooth/before-dist
node tools/phone-smooth-probe.mjs after /workspace/scratch/phone-smooth/after-dist
node tools/phone-smooth-probe.mjs before /workspace/scratch/phone-smooth/before-dist --stills phone6 desktop
node tools/phone-smooth-probe.mjs after /workspace/scratch/phone-smooth/after-dist --stills phone6 desktop
ASTRA_ASSET_ROOT="$(cat /workspace/scratch/ship-fastload/ci-asset-root.txt)" npm run test:ci
```

The traces cover cold startup and the settled pan separately. The still pass freezes at ready and captures the streamed Market Square, wide, and Harvest views at the same seed and time. The phone stills retain a 390 × 844 viewport and DPR 3 with unthrottled CPU. Draw calls use the main view's `renderer.info.render.calls`, as in the Fast Load probe. The application and assets were built and measured locally.
