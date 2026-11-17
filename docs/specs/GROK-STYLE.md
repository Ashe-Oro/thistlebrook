# Build "Thistlebrook look v2", our own diorama art style for the cel village, proven on one district.

## Reference
- Papertrails (https://xikhar.github.io/papertrails/, repo /workspace/refs/papertrails, NO LICENSE: study techniques, write all code fresh, copy no code/assets). Stills: /workspace/refs/pt-village.jpg, /workspace/refs/pt-village-night.jpg, /workspace/refs/pt-eval/grok-shots/. Teardown: /workspace/refs/pt-eval/GROK-PAPERTRAILS-PIPELINE.md (+ PAPERTRAILS-PIPELINE.md from Opus if present).
- Our current look: shots in shots/sol-terrain/, shots/opus-review/, docs/OPUS-DESIGN-REVIEW.md.
- First make a gold still per view (day, sunset, night) for the chosen district: generate 4-6 concept frames (OpenAI Images via OPENAI_API_KEY is fine; never print the key) of OUR village in the new style, pick gold frames, and name measurable features (palette hexes, key/fill direction, blur band, edge rim width, % frame of a villager).

## Details
Ashe: "use what we can from the repo and come up with our own art style." Not paper cutouts copied wholesale: a tactile miniature-diorama look for our existing 3D vertex-colour models. Ideas to try: a matte material with tooth/grain and soft wrap lighting, light leaking through thin parts, PCSS-style soft contact shadows, pale cut-edge rim / ink outline, tilt-shift DOF at the focus point, warm key + cool fill rig fitted to the camera, a locked palette with inverse-grade so chosen colours land exactly, bloom on window/lantern glows at night, grain + vignette. Keep NPCs, traffic, and day/night working. No dialogue, no brand assets.

## Tools
Three.js (current repo), owned threejsassets models, gltf/glb as-is. Post at reduced res with low/medium/high quality setting. Probe: `node /tmp/measure.mjs <url>` for bytes; `/tmp/pt-shot.mjs` has a draw-call counter to reuse. Chrome /usr/bin/google-chrome with playwright-core (swiftshader).

## How to work
Do it yourself (Grok). Worktree /workspace/cel-town-wt/grok-style, branch village/grok-style, port 5213. Pick one dense district. Put the style behind a URL flag (?look=v2) so old and new compare. Append-only decisions log in docs/GROK-STYLE-LOG.md; OWNER header on new files. Loop: render same cameras old vs new vs gold; a separate blind harsh critic pass (spawn a fresh reasoning step, randomised A/B order) says which is better and why; fix; revert regressions. Measurable targets: draw calls no worse than baseline, frame time no worse than +3 ms in swiftshader, download unchanged. Stop when the critic consistently prefers v2 over old and calls it close to gold, or after ~6 rounds.

## Deliver
Stills in shots/grok-style/ (old vs v2 at day, sunset, night, same cameras; plus gold frames), a 15 s orbit/tour video, docs/GROK-STYLE.md with the style rules (palette, lights, material, post params) written so it can be applied town-wide, critic scores per round, probe numbers. Tests pass, CHANGELOG updated, local commit on village/grok-style, no push, licensed files never committed.

## CHANGE 10:48 AM (Ashe): "for our design, let's use a cyberpunk aesthetic"
This overrides the warm-diorama palette above. Keep the miniature-diorama craft techniques (tactile material, soft contact shadows, cut-edge rim/outline, tilt-shift DOF, camera-fitted light rig, locked palette + inverse grade, reduced-res post) but the look is cyberpunk: night-forward, neon magenta/cyan/acid accents on deep blue-violet, emissive signage and window strips, wet/reflective ground sheen, haze/volumetric glow, bloom on neon, rain or mist optional. Our cozy vertex-colour models get re-themed through palette + emissive keys (packs ship glow keys and night palettes in palettes.json) — no new licensed purchases. Daytime still needs to read well (smoggy, overcast, neon still visible). Regenerate gold concept frames in this style for day, dusk, night.
