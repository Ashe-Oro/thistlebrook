# Iso camera polish — lighting, diorama edge, density, recapture (high priority)

You are in git worktree `/workspace/cel-town-wt/iso-camera` on branch `village/iso-camera`. Continue the existing iso implementation; do not start over and do not reintroduce a walk camera. No purchases, git push, deploy, 4090, Claude, or Thistlebrook / tailgate-games. Local commits only. Do not edit other worktrees or `/workspace/cel-town`.

This branch is already rebased onto current main `c2abc62` (reviewed medium expansion + playtest occlusion/sign fixes). The iso camera itself is committed (`fead269` / `4b59579`: true 35.264° ortho, hash `#x,z,zoom,h0`, HUD, click-to-peek, NPC card, 15s film). Keep every existing `WORKTREE-HOOK` line (art, interiors, lighting, building-variety, medium, playtest, and your iso hooks). `createIsoLife` already calls atmosphere and interiors; do not reintroduce a walk camera. Dead walk-camera code after the early return in `src/life/index.js` may be left or tidied, but do not drop hook comments.

Ashe was shown `close.png` and `building-peek.png` and likes the iso idea. He rejected the overview look and the sparse village. Fix the issues below, then recapture.

## 1. Overview lighting is broken — must be identical at every zoom

At overview zoom the terrain went near-black-green (a later post `uDepthThreshOrtho` scale brightened the grass somewhat, but this is not done). Boundary hills still render as flat dark/green discs with bright lit caps. This is not acceptable.

Fix root causes, not a single still:

- Lighting must look the same at overview, mid, and close zoom. If a post/ink/outline/depth pass scales with ortho zoom, scale it in world units so ground slopes are not treated as silhouettes at wide zoom and outlines do not explode at close zoom.
- **Fog must not be distance-based in ortho.** Use height fog or none. `src/life/fog.js` still writes `near`/`far` whenever `scene.fog` exists; iso must not re-enable perspective distance fog. Soft clear / plain background, not a haze that darkens the map.
- **Shadow frustum follows the view** (cover the visible ground at the current pan/zoom; do not leave the overview in a huge stale shadow camera, and do not let close zoom go unshadowed or over-dark).
- **No sky dome in iso.** Hide or remove it. The current code still tracks `skies` and parents them to the camera; that reads as overlapping discs / a blob island. Do not scale the dome to “cover” the problem.
- For the village edge, use a **Tiny Las Vegas–style diorama**: a clean island edge with soil/cliff sides, sitting on a soft plain background that matches https://tinylasvegas.com/#-226,-20,0.4729,h0. Hills are allowed only if they are actually lit 3D relief, not flat discs. Prefer the island.

## 2. Density — far too sparse versus Tiny Las Vegas

Large empty grass; lamps and benches scattered randomly in fields. Tighten the *presented* village:

- Use the recommended play URL `/?size=medium&seed=1234&life=1` for the hero shots and video (31 homes, chapel, farms, bridged stream are already on main). Keep `size=large` working. Do **not** change frozen hamlet/large compiled layouts or life-off hashes.
- Cluster houses along streets with yards, fences, gardens, carts, laundry lines, barrels, flowers, and people visibly out and about.
- Props belong near buildings and paths, not in open fields. If existing dressing scatters furniture into fields, constrain or replace it in the iso/life runtime (hook, do not rewrite the compiler).
- Varied tree clusters and forest edges rather than an even sprinkle.
- Grass is too flat and saturated: add subtle tonal variation, and paths with edging.

Runtime-only dressing / an iso diorama mesh is the right layer. One marked hook per shared file. New files under `src/life/` (e.g. `iso-diorama.js`) are fine. Do not edit the medium compiler, catalog, props/playtest/life-tools worktrees, or lighting-polish internals except a single fog/shadow hook if required.

## 3. Recapture

Update `tools/shots-village-iso.mjs` and write `shots/village-iso/`:

- `overview.png` — whole medium village, even lighting, clear diorama island (no black terrain, no disc hills, no sky dome).
- `mid-zoom.png` — a dense street/yard cluster, readable props and people, not a half-empty forest.
- `close.png` — close street, crisp edges, HUD visible, people/props in frame.
- Optional: recapture `npc-card.png` / `building-peek.png` if the framing improved.
- `village-iso.mp4` — **20–30 seconds**, 1280×720, H.264 yuv420p, slow eased pan and zoom (overview → mid → close or a gentle path across streets), **post on**, **villagers moving** (timescale > 0; do not freeze the sim for the whole film). `--stills-only` / `--video-only` supported.

Chrome + SwiftShader harness as before. `__ready`, `__iso` / hash, `__post.render`.

## Checks

`npm run test:checks`, `npm run test:parity`, `npm run test:world-registry`, and `npm run test:medium` must pass. Life-off hashes unchanged. Extend `tests/life-iso.test.mjs` if useful. Write `out/codex-village-iso-camera-polish-report.md` and commit locally. Do not merge.
