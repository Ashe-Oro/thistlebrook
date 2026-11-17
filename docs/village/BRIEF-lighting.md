# Living Village — Lighting, day/night, and toon polish (Sol)

You are in git worktree `/workspace/cel-town-wt/lighting` on branch `village/lighting-polish`. Read `docs/village/INTERFACES.md`. Do not edit `/workspace/cel-town` or other worktrees. Do not buy anything, git push, or deploy. Local commits on this branch only. No API keys, no 4090, no Claude. No touching `/workspace/tailgate-games` or Thistlebrook.

When finished, write `out/codex-village-lighting-report.md`, capture shots/video, and leave work committed on this branch.

## File ownership (hard)

You MAY freely edit new files: `src/life/sky.js`, `src/life/fog.js`, `src/life/lighting-polish.js`, any additive `src/post/` helper you create (do not rewrite the whole post stack), `tools/shots-village-light.mjs`, `shots/village-light/`, and a short README subsection.

One clearly marked hook only in each of: `src/life/daynight.js`, `src/post/post.js`, `package.json`, `README.md`. Additive tests only if namespaced `life-lighting`.

DO NOT EDIT: `src/life/dressing-runtime.js`, `atmosphere.js` (another worktree), `social.js`, `schedules.js`, `people.js`, `camera.js`, interiors/doors, compiler, registry stubs, `townsfolk.js`, `districts.js`. Do not change compiled life-off JSON. Night grass darken/desaturate already exists in the M2 life path — improve, don't regress it, and keep the change life-only or hook-only so hashes stay intact.

## Goal

Raise the lighting and toon read of Willowmere so time of day is unmistakable and pretty:

- Sky gradient that changes with the existing day/night clock (dawn, day, golden hour, dusk, night)
- Subtle fog or depth haze that fits the cel look (don't milk-out the town)
- Window glow already exists; keep it honest and improve falloff if cheap
- Lamp pools: warm, limited count, no shadow-casting point-light explosion
- Golden hour: warmer key light / grade, readable long shadows if the existing renderer allows
- Night: grass stays nocturnal (darker, less saturated), sky and lamps carry the mood
- Stay inside `MeshToonMaterial` + the existing 3-step ramp + inverted-hull outlines + post chain. Don't replace the toon system.

Play URL remains `/?size=large&seed=1234&life=1`. Keep `__life.setHour` / `?hour=` working. Prefer exposing any new looks via the existing post/Look panel flags rather than a new debug soup.

## Shots

`tools/shots-village-light.mjs` + `npm run shots:village-light`. Harness style matches M2 (Playwright, Vite preview, `/usr/bin/google-chrome`, SwiftShader, evidence, `--video-only` / `--stills-only`, 1280×720 yuv420p). Write `shots/village-light/`.

Capture stills: `dawn.png`, `day.png`, `golden-hour.png`, `night.png` (and optional `fog.png`). A 10–20s mp4 with **post ON** sweeping hour from late afternoon through night.

## Checks

`npm run test:checks` and `npm run test:parity` must pass. Life-off hashes unchanged. No new browser/asset errors in the shot evidence.

## Done means

Visible lighting/sky/fog/golden-hour/night polish, tests and hashes green, stills + video on disk, report written, local commit. Do not merge other worktrees.
