# Opus: swap the airport for the Airfield pack (Ashe asked, Nov 20 2026)

Ashe's ask: "swap out our airstrip assets with the new ones" — replace the box-built Thistlebrook Municipal Airport with the owned Airfield pack.

Read and follow `docs/specs/overnight/AIRFIELD-KIT.md` (the full spec) and the Airfield section of `/workspace/scratch/stylised-review/STYLISED-FIT.md` (hero model list and watch-fors), with these overrides:

- You are already in the worktree `/workspace/cel-town-wt/airfield-kit` on branch `village/airfield-kit` (base main 6e18f37). `public/licensed` is already symlinked. Run `npm install` if node_modules is missing.
- The pack is already downloaded at `/workspace/threejs-assets/airfield/bundle` (glb/, components/, palettes.json, preview/). Copy the GLBs you use into `public/licensed/airfield/` (it already holds fuel_truck, pushback_tug, baggage_cart_train). Do not use the threejsassets connector. If you need anything else, use the `tja` CLI (never print $TJA_API_KEY or download URLs).
- Skip the blind-critic loop. Instead, compare before/after stills yourself and keep only changes that look better.
- Keep the procedural airliners, the helicopter and the runway-reserving timetable. Don't scale `terminal_fbo` past ~1.3; cluster it with the flight club office and apron canopy. Night glow goes through the existing lamp-post / landmark-glow registry, no new point lights.
- Follow docs/TOWN-RULES.md (incl. TOWN-27: road traffic stays pack-only). Another Opus run is working on outskirts/nature in a different worktree; don't touch nature/outskirts placements.
- Run `npm run test:ci` (must pass) plus the new `tests/airfield-kit.test.mjs`.
- Shots go in `/workspace/scratch/opus-airfield/` (before-wide, after-wide, after-apron, after-night). Skip the video clip.
- CHANGELOG entry, local commits on `village/airfield-kit` only. No push, no deploy, no models:upload, no spending. Never commit licensed GLBs.

Finish with a short report: commit hash, test results, probe numbers before/after (draw calls, tris, added MB), shot paths, and anything you couldn't do.

What I'll check: the after-wide still has no box buildings left and at least 6 distinct pack structures; test:ci passes; added download ≤ 3 MB; no licensed files in git.
