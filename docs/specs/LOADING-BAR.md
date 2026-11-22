# Build "Loading Bar", an accurate progress and time-left indicator on Thistlebrook's boot screen and during later loads.

## Reference
- Live Thistlebrook (https://thistlebrook.vercel.app) and this worktree at 73febdb already show a full-screen cream overlay (`.loading` on `#e8ede3`) with the sprout ❧, Fraunces heading "A little world awaits.", and DM Sans line "Opening the shutters, putting the kettle on…". There is no bar and no time estimate. The overlay fades when `loading.done` is set after the opening view's first frame (`window.__ready`).
- Match that typography and the existing cream glass cards (`.glass`: `#fffdf4ed`, soft shadow, 15px radius, `#344c40` / `#839079` text). Gold stills: desktop 1440×900 and phone 390×844 of the current boot screen, then of the new bar at about 10%, 50% and 90%, plus the slim post-ready indicator.
- Accuracy gold: the bar tracks real work, not a timer. On a phone6 probe (390×844, DPR 3, 6× CPU throttle, same profile as `tools/phone-smooth-probe.mjs`) and on desktop (1440×900), displayed progress stays within about 15 percentage points of elapsed-time fraction across the boot, and it must not sit at 99% for a long stretch. Phone6 ready is currently about 19s in `/workspace/scratch/phone-smooth/probe.json`.

## Details
Progress comes from real work, weighted by bytes, using known sizes from a build-time manifest written into `dist` by `deploy:dist` (`tools/prepare-deploy-dist.mjs`). Prefer those sizes over `Content-Length`, which may be missing for compressed or Blob files. Include both original and aliased/hashed URLs the browser actually requests. Record which files belong to the opening view (the headless verify run already sees them) versus later streamed districts, so the boot bar is not diluted by the rest of the town.

Phases, all part of the same monotonic 0–100% for the opening boot: download, decode (Draco / GLB parse), shader compile (`renderer.compileAsync` in the existing `onPrepare` path), and first-frame / ready. Weight phases so the curve follows wall time, and within download and decode weight by manifest bytes. Shader compile may use the same byte sizes or object sizes. The first-frame slice completes exactly when the opening view is ready (today: after `opening`, the first `step(0)`, and `window.__ready = true`). The bar never goes backwards, including when a new file is discovered; it reaches 100% right at ready, not earlier, and does not linger at 99%.

Once there is enough rate data, show a smoothed honest time-left estimate. Hide it when the rate is unstable. Do not invent a countdown from a timer.

Cover the initial boot to the opening view on the existing full-screen overlay, keeping the current heading and subtitle. After the town is visible, or when a later big load starts (background districts streaming, or the visitor jumping into an unloaded district), show a slim, unobtrusive indicator. It must work at 390×844 and on desktop, must not cover map controls (phone view-tabs sit near `bottom: 78px` and the zoom tools at `bottom: 20px`; desktop tools are bottom-right and view-tabs are top-center), and must not intercept pointer events. In Vite dev, if the manifest is absent, fall back to `Content-Length` or observed sizes without breaking the boot.

Do not change gameplay, camera, streaming order, or visual quality. Do not touch `src/astra/static-batches.js`. Do not edit `/workspace/cel-town-git`.

## Tools
Work only in `/workspace/cel-town-wt/loading-bar` on branch `village/loading-bar` (already created from 73febdb). `node_modules` and `public/licensed` are already symlinked; do not copy licensed files into the worktree or into git. Use playwright-core from `node_modules` and `/usr/bin/google-chrome` with the same SwiftShader flags as `tools/phone-smooth-probe.mjs`. For `npm run test:ci` use `ASTRA_ASSET_ROOT="$(cat /workspace/scratch/ship-fastload/ci-asset-root.txt)"`. Probes should run against a local `deploy:dist` (a size manifest in `dist` is required); `--skip-verify` is fine while iterating, but the recorded curve must come from a production dist that includes the manifest and opening assets. Never run `models:upload`, never push, never deploy, never print secrets.

## How to work
Work autonomously, with no questions. Keep `docs/specs/LOADING-BAR-LOG.md` as an append-only decisions log (weights, curve numbers, stalls). Expose a small probe hook such as `window.__loadProgress` with current progress, phase, eta, and a progress-versus-time sample list.

Add unit tests for the math: monotonic progress, 100% only at ready, byte weighting, newly discovered work does not move the bar backwards, ETA hidden when unstable, and boot versus slim modes. Add a test that a generated size manifest matches on-disk bytes. Existing district-stream tests must stay green.

Write `tools/loading-bar-probe.mjs` (or an equivalent) that loads the production dist under the phone6 and desktop profiles, records the progress-versus-time curve, reports max |progress − time fraction| (ignore the first few percent if startup is noisy, and state the window), time spent between 99% and 100%, and whether the 15-point budget held. If the first curve misses the budget, retune phase weights and rerun once. Put curves, JSON, and stills in `/workspace/scratch/loading-bar/` (not in git). Capture the bar at about 10%, 50% and 90% on both phone and desktop. On this shared box, run one heavy job at a time, leave CPU for others, and stop any servers or browsers you started.

## Deliver
Local commit(s) on `village/loading-bar` only. Include a CHANGELOG entry under Unreleased, this spec, the decisions log with the curve numbers, the new tests, and `npm run test:ci` green with the scoped asset root. Do not push or deploy. In the final summary, state how progress is computed (phases and weights), the accuracy numbers for phone6 and desktop, the branch and SHA, test results, and the shot paths.
