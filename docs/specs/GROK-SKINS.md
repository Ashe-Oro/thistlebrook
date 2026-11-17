# Build "Village skins", swappable looks for the cel village that switch live like a CSS theme.

## Reference
- Ashe, 17 Nov 2026: "i like the current look, let's just have multiple different skins that can be applied (similar to updating CSS on a website)."
- Gold still for the default skin: the deployed compressed build 7c6d639, captured on fixed cameras (`shots/grok-skins/base-cel-*.png`: wide `{x:-40,z:-2,zoom:1.9}`, downtown `{x:-57,z:-6,zoom:3.1}`, close `{x:-60,z:-4,zoom:5.6}`, hours 11 / 17.6 / 21.5, 1280x800, SwiftShader). Measurable: the new default must match it pixel for pixel (<0.1% of pixels off by more than 8/255 in any channel). Draw calls on those cameras: 3679 / 3766 (wide day / night), 2227 / 2283 (downtown).
- Cyberpunk skin reference: look v2 "Thistlebrook Neon" (dd9fda7, `docs/GROK-STYLE.md`, gold frames in `shots/grok-style/gold/`). Same numbers, now as data.
- New skins: "autumn storybook" (warm: rust/amber leaves, golden ground, amber windows) and "winter" (snow on every up-facing surface, slush roads, cold light, warm windows).

## Details
- A skin is one data file, `src/skins/<id>.js`, registered in `src/skins/index.js`. Blocks: `keys` (time-of-day light keys), `shade`, `halos`, `material` (palette ramp, chroma, tooth, wrap light, side lights, rim, windows/emission, wet ground, leaves, snow), `practicals` (bulbs, lamp pools, signs, building hulls, spill pools), `post` (tilt-shift, bloom, haze, wet reflections, vignette, grain, and a LUT grade block with day/smog/dusk/night grades and an hour schedule). A `null` block means "the default behaviour".
- The default skin `cel` is all-null and takes the original code path, so it is identical to today.
- Switch with `?skin=<id>` (`?look=v2` still means neon), the swatch picker at bottom-left, or K / Shift+K. Switching is live: no reload, no world rebuild. Crossing default <-> styled recompiles the toon programs once; styled <-> styled is uniforms only.
- Don't: add textures, meshes, network requests, or extra draw calls; touch roads, rides, water, terrain or traffic (other lanes own those).

## Tools
Three.js in this repo, Vite, playwright-core + /usr/bin/google-chrome (SwiftShader) for stills, probes and the clip, ffmpeg for the clip, node:test for tests. Grok does the work directly. Worktree `/workspace/cel-town-wt/grok-skins` (branch `village/grok-skins` from 7c6d639 + merge of dd9fda7), dev port 5218; baseline build 7c6d639 on port 5219 from a temporary detached worktree. Licensed files never committed.

## How to work
Autonomous; decisions appended to `docs/GROK-SKINS-LOG.md`. OWNER headers on new files; contract is `docs/SKINS.md`. Shared probe `tools/grok-skins-shots.mjs` reports GL draw calls and triangles per camera/hour for every skin (and with `--live`, after live switches on one page). Targets: default pixel diff <0.1% (>8/255); every skin's draw calls <= default on every probe camera; skin data < 8 KB each and zero new requests; full test suite and `npm run test:checks` green. Blind critic loop for the new skins (A/B order random) on legibility and style; the user's instruction (keep the current look as default) overrides critics.

## Deliver
Skin runtime + four skins, `docs/SKINS.md` (how to write a skin), stills of the same wide view per skin at day and night, a short live-switch clip, pixel-diff and draw-call numbers (`shots/grok-skins/`), test counts, CHANGELOG entry, one local commit on `village/grok-skins`. No push, no deploy.
