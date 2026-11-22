# Loading Bar decisions

- Use the original loading overlay and finish it at the existing first-frame readiness boundary. Keep the slim indicator independent so loading scenery cannot move the opening progress backwards.
- Size the bytes after compression and Fast Load staging. Record physical paths and aliases, with the actual opening request set from each of the desktop and phone verification runs. Models requested by alternate seeds and shared camera links are registered as they are discovered.
- Read model transfer bytes from Three.js progress events and completed dependencies from Resource Timing. Credit decoded bytes when the GLTF loader returns a scene. Use explicit completed planning and scene assembly checkpoints for CPU work and reserve the final slice for the first draw. ETA uses recent progress slopes and disappears when the rate varies or the work stalls.

## Calibration

| Phase | Phone | Desktop |
| --- | ---: | ---: |
| World planning | 12% | 23% |
| Download | 10% | 6% |
| GLB decode | 30% | 20% |
| Scene assembly | 38% | 38% |
| Shader compile | 2.5% | 2.5% |
| First frame and ready | 7.5% | 10.5% |

- The slim indicator weights download, decode, compile and district settlement at 30%, 45%, 10% and 15%. It stays visible while the district queue is working and takes a new batch for later model work.
- Opening shader credit comes from completed `compileAsync` objects. The reserved balance completes with the first render, which compiles any remaining programs. The existing renderer capability check and district scheduling still apply.
- The first run reached ready in 19.116 s on phone6 and 7.011 s on desktop. The maximum errors were 17.898 and 30.775 points, respectively. The desktop planner held the bar at zero until 2.158 s. The phone held a 70.1% paint for about 4.24 s during scene work.
- The worker now reports finished planning stages on both profiles. The boot UI gets a paint before synchronous batching and the first draw. The first reweighting brought the early desktop stall under budget, but the bar advanced too far before batching. Peak errors were 15.980 points on phone6 and 22.772 on desktop. The final weights assign more of that slice to completed assembly.

## Production probe

`npm run deploy:dist -- --no-publish-cache` verified both profiles locally. The generated manifest matched the bytes on disk for all 1,191 URLs after resolving aliases. It recorded 167 opening downloads (6.81 MB) and 152 GLBs (2.07 MB) on phone, 175 opening downloads (7.02 MB) and 160 GLBs (2.28 MB) on desktop, and 209 later request URLs.

The comparison covers 5–100% of navigation-to-ready time and checks both sides of each visible progress step. The phone run uses 390×844, DPR 3 and 6× CPU throttling. Desktop uses 1440×900 at normal CPU speed. Both use Chromium with SwiftShader and a cold HTTP cache. Curves and stills were recorded on separate runs.

| Profile | Ready | Max error | Time at 99% | 15-point budget |
| --- | ---: | ---: | ---: | --- |
| Phone6 | 22.089 s | 10.000 points | 0 ms | Pass |
| Desktop | 6.042 s | 13.058 points | 0 ms | Pass |

- The longest hold on phone was 3.95 s at 72.5% during scene assembly. The last pre-ready paint was 90% (2.60 s on phone) and 87% (1.57 s on desktop). The first 100% paint followed the readiness timestamp by 1.8 ms on phone and 0.2 ms on desktop, in the same JavaScript task.
- Both profiles loaded Fraunces and DM Sans. The slim indicator had `pointer-events: none` and no overlap with the visible navigation and map tools.
- The curve JSON, CSV, SVG and baseline, progress and slim stills are in `/workspace/scratch/loading-bar/`.

## Final verification

The background meter now starts with the verified later transfer sizes and queued district count. The final production rerun used the same boot weights and window. The on-disk check again covered all 1,191 URLs. This build recorded 245 later request URLs.

| Profile | Ready | Max error | Time at 99% | 15-point budget |
| --- | ---: | ---: | ---: | --- |
| Phone6 | 21.355 s | 10.076 points | 0 ms | Pass |
| Desktop | 6.616 s | 13.000 points | 0 ms | Pass |

The phone held at 72.5% for 4.10 s during assembly. The final waits from the previous pre-ready paint to 100% were 2.49 s on phone and 1.64 s on desktop. The 100% update followed the readiness timestamp by 1.3 ms and 0.3 ms, respectively.

The phone stills show 10%, 48% and 90%. The desktop stills show 11%, 49% and 87%. The baseline stills use the boot UI built from `73febdb`. Both slim captures show the open map with the indicator clear of its controls.
