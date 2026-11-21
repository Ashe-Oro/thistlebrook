# Build "Fast Load", a Thistlebrook that's ready in a few seconds and streams the rest in the background.

## Reference
- Today: thistlebrook.vercel.app downloads about 22 MB before the town is ready (20.4 MB measured Nov 17, plus the airfield and nature packs). The latest measurement, if present, is in /workspace/scratch/ship-nov21/download.json.
- Target feel: like Google Maps or a good web game. The opening view appears fast and looks complete. Other districts fill in while the visitor looks around, with no pop-in near the camera and no blank hole if they jump to a far district (show a soft placeholder, then the real models).
- Gold stills: capture the current live opening view (desktop 1440x900 and phone 390x844) and the wide zoomed-out view before changing anything. After the change, those views must look the same to a blind critic, once loading has finished.

## Details
Three parts, all approved by Ashe:
1. **First view first, the rest streamed.** The initial payload covers only what the opening camera sees: terrain, the water, roads, the town centre, and the models in frame. Everything else loads in the background, nearest districts first. The Explore menu and camera jumps raise a district's priority. Ready means the opening view is fully drawn and interactive.
2. **Lower-detail distance copies.** Generate simplified copies of heavy models (trees, rocks, foliage, buildings, vehicles). The zoomed-out and far views use them, and full detail loads as the camera comes close. This should also recover the Nature pass's +16% triangle cost.
3. **Harder compression.** Draco with position/normal/UV quantization (fix the code that reads raw geometry so it works with quantized data or dequantizes on load), KTX2/Basis for textures, deduplicating identical meshes and textures across packs, and dropping anything in the deploy that's never placed. Also add long-lived cache headers on hashed model files.
Don'ts: no visible quality loss at normal zoom, no change to gameplay, layout, UI or the day/night look. Don't touch the favicon. Interiors, the inspector and the minimap stay on hold.

## Tools
Repo /workspace/cel-town-git (Three.js + Vite). Work in a new worktree from current local main on branch village/fast-load. Use gltf-transform (simplify, quantize, draco, ktx2/uastc or etc1s via toktx if available; otherwise install it under /workspace/tools) and meshoptimizer's simplifier. Licensed models: originals and every modified or simplified copy live only in gitignored public/licensed/ and the private Blob model pack, never in git. The build scripts that generate them are committed. Use tools/compress-dist-glbs.mjs, deploy:dist and models:upload as the starting point. Never run models:upload or deploy yourself; I'll do that.

## How to work
Work autonomously, without questions, and keep docs/specs/FAST-LOAD-LOG.md as an append-only decisions log. Write one probe script, tools/load-probe.mjs, that loads a local production build with Playwright (playwright-core in node_modules, /usr/bin/google-chrome with --use-angle=swiftshader) under a simulated 20 Mbps connection. It reports bytes until ready, time until ready, total bytes after everything has streamed, draw calls, triangles in the opening and wide views, and frame time. Run it before the change and after each part.
Targets:
- At most 5 MB transferred before ready on desktop, and 4 MB on phone.
- Total bytes after full streaming at least 30% below today.
- Wide-view triangles back to at most the pre-Nature level.
- Draw calls not worse.
- `npm run test:ci` green, with ASTRA_ASSET_ROOT scoped to the expected packs as in earlier runs. The known astra-catalog failure is caused by extra packs in /workspace/threejs-assets.
- Add tests for the load order (opening-view set first, then priority on a camera jump) and for a district that never loads falling back to a placeholder.
Visual check: a blind side-by-side of before and after for the opening, wide, phone and one close-up view. Fix anything a critic can pick out at normal zoom. Revert anything that makes things worse.

## Deliver
Local commits on village/fast-load (no push, no deploy, no models:upload). Include:
- A CHANGELOG entry.
- Probe numbers before and after in /workspace/scratch/fast-load/probe.json.
- Before and after stills in /workspace/scratch/fast-load/.
- A list of the new or changed licensed files that need to go into the model pack.
- A plain summary of what each part saved.
