# Phone smoothness: fast start and lag-free thumb panning

## Reference
Ashe on his iPhone (Brave), Nov 21 2026 1:19 PM ET, on live Thistlebrook (main d3889e6, fast-load and Market Square opening). It still takes about 10 seconds before the town shows. Panning with a thumb works but lags behind the finger. The download before ready is only 2.7 MB now (/workspace/scratch/ship-fastload/download.json), so the time goes to CPU and GPU work, not the network. Known numbers: about 6,450 draw calls in the wide view, and 7,377 before fast-load. A desktop probe under SwiftShader also took about 10 s to ready.

## Details
1. Profile first, and write down where the 10 s goes: JS parse, model decode (Draco/KTX2 workers), scene build, shader compile, the first frames. Do the same for a pan gesture: frame times, what runs each frame, GC. Use Chrome tracing with CPU throttling (4x and 6x) at a 390x844 phone viewport with DPR 3, plus touch-event pans.
2. Fix the biggest costs, the root causes rather than settings tweaks. Likely levers, non-binding, so verify each: batch or instance static props and buildings per district to cut draw calls by a lot (merged static geometry, InstancedMesh or BatchedMesh); cap the pixel ratio on phones (for example 1.5–2) and use adaptive resolution while panning; compile shaders ahead of time or warm them up (renderer.compileAsync) so the first pan doesn't hitch; decode off the main thread and spread scene building across frames so the first view shows sooner; skip per-frame work for off-screen villagers and vehicles; pan input should update the camera on the same frame as the touch event (no smoothing lag on the finger, inertia only after release).
3. Keep the look the same, so a blind visual check matches. Keep the Market Square opening and the streaming order.

## Tools
Chrome DevTools Protocol tracing via playwright-core (/workspace/cel-town-git/node_modules) with /usr/bin/google-chrome, the existing tools/load-probe.mjs, three.js renderer.info, and any small helpers you write into tools/.

## How to work
Blind critic loop on before and after stills. Measurable targets at 390x844, DPR 3, 6x CPU throttle: time to ready at least 40% lower than today. During a scripted 3-second thumb pan, the 95th-percentile frame time is at least 40% lower, with no frame over 100 ms after the first second. The finger-to-camera delay is at most one frame. Wide-view draw calls are at or below 1,500. Desktop doesn't get slower. test:ci is green with the scoped ASTRA_ASSET_ROOT, as in earlier runs.

## Deliver
Local commits on village/phone-smooth only: no push, deploy or models:upload. If models change, list the licensed files for the pack. Add a CHANGELOG entry and docs/specs/PHONE-SMOOTH-LOG.md with the profile breakdown before and after. Put probe.json, the traces and the stills in /workspace/scratch/phone-smooth/. On this shared box, limit parallel builds and stop the background jobs you started when you're done.
