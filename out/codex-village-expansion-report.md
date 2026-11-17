# Living Village — medium expansion

Branch: `village/medium-expansion`. Local worktree: `/workspace/cel-town-wt/expansion`.

Recommended play URL: `/?size=medium&seed=1234&life=1`.

Medium seed 1234 has **31 homes** (large seed 1234 has 20), **10 civic landmarks**, **55 registry buildings**, 12 townsfolk and a 6,875-node connected life/registry graph. It retains the original plaza, market and farm district, adds residential rows, includes two chapels, and extends the sunny town edge with a continuous stream and stone footbridge. Existing farm buildings, crop/garden patches and orchards remain at the edge. The bridge carries an actual connected path centerline. Registry metadata and reachable entries are generated from existing catalog defaults; no buildings or people are tagged per seed.

Implementation: `specs/medium.json` opts into `src/compiler/medium.js` through a guarded compiler dispatch. The helper invokes the existing district compiler with the expanded spec, reclaims loose vegetation/dressing only in the stream/path corridor, adds water/bridge skins plus the continuous walking strip, reruns the existing validators, retains facing-cap checks, then spawns life and attaches the registry. Dedicated medium checks validate stream continuity/orientation, bridge alignment and water/building separation. Shared UI/CLI hooks recognize explicit medium size. Medium defaults to seed 1234. Omitted-size behavior is preserved.

No changes to large/hamlet specs, placement pools, districts.js, NPC tools/planner/social, camera UI, interiors/doors, dressing runtime or townsfolk assets. No new assets, downloads, purchases, APIs, deployment, pushes or other-worktree merges. Only existing licensed meshes are reused; licensed files remain uncommitted.

Validation passed:

- `npm run test:checks`: existing negatives, batches/runtime checks, and additive medium checks.
- `npm run test:parity`: frozen SHA-256 fixtures for hamlet/large seeds 1, 7, 1234; browser/Node parity, including perturbed math.
- `npm run test:world-registry`: all 11 tests.
- `npm run test:medium`: seeds 1, 7, 1234; more homes; chapel/farm/barn registry entries; bridge route on both banks; life validation (including people off roofs); registry-only/life-off modes; negative bridge, path and stream tests; full medium JSON parity through Vite SSR in default and life modes.
- `npm run build`: successful. Existing bundle-size advisory remains.
- Local browser capture: medium compile OK, 12 residents, no browser/asset errors; post-processing enabled for stills.

Evidence: `shots/village-medium/overview.png`, `farms.png`, `river-bridge.png`, `chapel.png`, and `evidence.json`. Regenerate with `npm run build && npm run shots:village-medium`. The optional `-- --video` flag records a 10-second orbit; the delivered evidence is four stills. Capture uses software WebGL, 1280×720, frozen time, reduced Kuwahara smoothing, and extended capture fog (overview near/far 250/600) to show the whole town on the shared CPU. Capture settings do not change application lighting defaults.

Existing interiors retain their existing four civic rooms; additional chapels and farm structures are exteriors. Navigation remains the project's planar XZ walk graph; water is visual geometry, and only the bridge's underlying path grants a river crossing.

Frozen default hashes verified against the unchanged fixtures:

| Compile | SHA-256 |
| --- | --- |
| hamlet 1 | `298ce18a20d64e3937782c459c02bacd743f8363aa892c0b224ab5d3eabf711c` |
| hamlet 7 | `6fa8e8ef35cb7bcc65bde159a68e820be7947ce925749063d1372a3255186670` |
| hamlet 1234 | `6b63379057bf8b8bd5b7c1e9b94df62a902177e89ec48e3ec2bc8bb9d60b1d5d` |
| large 1 | `af385e77f92655f40d9aea9356b4aecea7e72677488a3bbfb2c34f526716eac3` |
| large 7 | `2e34f0ef4bb8fea5d30f896519d3a8691b34fc88209d2bbcbb827c5ce191c719` |
| large 1234 | `884c24dcf270e07a2625995c74e587f602e2d299d7d6a4839cd2d5ef811bd6c2` |
