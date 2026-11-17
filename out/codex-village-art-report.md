# Living Village art polish

Branch: `village/art-polish`, worktree: `/workspace/cel-town-art`.

## Changes

- Added deterministic, life-only street/yard/market dressing in `src/life/dressing-runtime.js`. Seed 1234 adds **255 props**: 49 around civic/market buildings, 80 around residential lots, and 126 along streets. Existing Cozy Village, Autumn Harvest, Farm and Nature catalog ids supply flower carts, mums, planters, produce crates, apple crates, baskets, gourds, benches, garden carts, firewood and lanterns. No catalog expansion or compiler placement changes were needed.
- Placement uses `deriveSeed`, existing `blockers`, SAT overlap helpers, full model bounds, and reserved navigation strips. Building footprints and overhang bounds, fences, all paved paths, existing props and other new dressing are reserved. Accepted additions keep at least 0.22 m separation; the independent audit requires 0.18 m. The compiled town is compared before/after runtime assembly to catch mutation.
- Reused the existing town instancing helper after loading each prop through the toon loader. This retains `MeshToonMaterial`, inverted hulls, shadows, and source transforms while batching repeated props.
- Added 35 subtle warm radial pools beneath existing streetlamps and a small daytime street fill in `src/life/atmosphere.js`. The existing lighting update remains responsible for night grass, sun, windows and lamps. No post-processing architecture changes.
- Gave all twelve existing residents individual hair/skin/trouser palettes and clearer silhouettes: work boots, flat caps, beret, beards, moustache, ringlets, braids, dreadlocks, skirts, overalls, scarf and glasses. Adult heights vary from 1.58 to 1.89 m; Pip stays 1.12 m. Ids, roles, workplaces, spawn count and schedule schema remain unchanged. No samurai/miko looks.
- Regenerated all twelve GLBs with `node tools/generate-townsfolk.mjs` into gitignored `public/licensed/characters/`. Source assets remain in the owned shared library; no GLBs are committed. `codex-village-art-characters.json` records the twelve generated file hashes, outfits and measured heights; identity comparison against HEAD confirms the roster is unchanged.

## Validation

- `npm run build`: passed.
- `npm run test:checks`: passed, including existing life/social negatives and instancing checks.
- `npm run test:parity`: passed, including 31 hamlet seeds, four large seeds, variants and one-ulp math perturbation.
- Life-off full JSON SHA-256 hashes match the pre-edit baseline for both hamlet and large layouts at seeds 1, 7, 19 and 1234. Exact hashes are recorded in `codex-village-art-hashes-before.json` and `codex-village-art-hashes-after.json`. No compiled JSON was edited.
- Art placement audit: seeds 1/7/19/1234 produce 259/246/260/255 deterministic additions, with zero reserved-geometry or dressing overlaps and no compiled-town mutation. Each seed rejects deliberately injected house, path and duplicate-prop collisions.
- Video verification: H.264, 1280×720, 12.000 seconds, 96 frames, all 96 decoded frames distinct; metadata and SHA-256 are in `codex-village-art-video.json`. Capture completed without browser or asset errors.
- Capture script also verifies the rendered additions use toon materials and hulls, and that all twelve residents' measured feet stay within 0.12 m of the ground.

## Captures and reproduction

`npm run build && npm run shots:village-art`

The capture script uses local Chrome, SwiftShader and ffmpeg. Output is in `shots/village-art/`:

- `market-dressed.png`
- `yards.png`
- `townsfolk-lineup.png`
- `night-atmosphere.png`
- `village-art.mp4` — 12-second, 1280×720 market orbit, 96 frames at 8 fps.
- `evidence.json` — hashes, placement counts, negatives, material/feet audit, camera poses, runtime errors and video settings.

Stills use the normal post stack; the software-rendered video keeps toon materials and hulls, with screen-space post and shadow maps disabled. Stills and video read the preserved canvas directly. The lineup temporarily poses the real resident meshes against a clear portrait floor for capture, then restores the live scene; no lineup behavior is added to the application.

Audit without rendering: `node tools/shots-village-art.mjs --audit-only`. Stills without video: `npm run shots:village-art -- --stills-only`. Resume the clip against existing still evidence with `npm run shots:village-art -- --video-only`.

Only the marked art hook was added to `src/life/index.js`, plus a short marked README note and the requested package script. No interiors, social/navigation/daynight edits, other worktree edits, purchases, external model services, push or deployment.

Pre-existing untracked runner output and workspace symlinks were left unstaged.
