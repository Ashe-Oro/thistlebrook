# Village lighting polish

Play: `/?size=large&seed=1234&life=1` (also `?hour=17.25` or `__life.setHour(17.25)`).

The life-only day/night wrapper adds peach dawn and amber dusk skies, distance haze, a lower golden-hour directional key with long shadows, blue moonlight, and soft warm ground pools beneath the existing lamps. The base day/night implementation still owns window panes and nocturnal grass colors. No new point lights are added: the existing maximum of ten remains unshadowed. Materials retain MeshToonMaterial, the existing three-step ramp, inverted-hull outlines and post chain.

The time-aware grade uses the existing Look → grade toggle and `?grade=0`; post can still be toggled normally. Orthographic mode continues to omit fog. Runtime defaults outside life are unchanged. Shared day/night and post files each have one marked lighting hook line; package.json adds one capture command and README adds one marked paragraph.

Validation:

- `npm run build`: passed (existing bundle-size advisory).
- `npm run test:checks`: passed.
- `npm run test:parity`: passed, including all frozen life-off hashes for hamlet/large seeds 1, 7, 1234; normal Vite and one-ulp perturbation JSON parity passed.
- Node integration check: preserved the base update, verified hour seeks and lower golden-hour key, and confirmed orthographic fog remains disabled.

Capture command: `npm run build && npm run shots:village-light`. Supports `--stills-only` and `--video-only`, including an initially empty output directory. Interrupted `--video-only` captures resume saved contiguous frames; a full run discards old checkpoints. Chrome at `/usr/bin/google-chrome` uses SwiftShader. The harness renders on demand to avoid GPU queues; it reads the preserved canvas directly, records browser/asset errors and runtime state, checks the hour hooks, grade gate, ten-light cap and night grass. The nonexistent favicon is fulfilled locally with HTTP 204. Capture settings use the supported `kuwahara=3`, `shadowMap=1024`, `prmax=1` flags; all other post defaults remain enabled.

Artifacts are in `shots/village-light/`: `dawn.png` (6.25), `day.png` (12), `golden-hour.png` (17.25), `night.png` (21.5), `village-light.mp4` and `evidence.json`. The movie sweeps 16:00–22:30 with post, grade, hulls and shadow maps enabled throughout, encoded at 1280×720, 10fps, 12 seconds, H.264/yuv420p. A fixed camera makes the changing illumination easy to compare. Capture completed successfully. `evidence.json` records all four stills, the 16:00–22:30 post-enabled video samples, and zero browser/asset errors. FFprobe confirms 1280×720, yuv420p, 120 frames and 12.000000 seconds. Temporary frame checkpoints were removed after encoding.
