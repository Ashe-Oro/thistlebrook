# Living Village — Isometric diorama camera (high-priority Sol job)

You are in git worktree `/workspace/cel-town-wt/iso-camera` on branch `village/iso-camera`, based on main at `0b595b9` (wave 1 interiors+art, wave 2 registry, wave 3 buildings+lighting). Read this brief fully. Do not edit `/workspace/cel-town` or other worktrees. Do not buy anything, git push, or deploy. Local commits on this branch only. No API keys, no 4090, no Claude, no LLM calls, no MCP server. No touching `/workspace/tailgate-games` or Thistlebrook.

When finished, write `out/codex-village-iso-camera-report.md`, capture the shots/video below, and leave work committed on this branch.

## Why this job exists

Ashe wants Willowmere to play like [Tiny Las Vegas](https://tinylasvegas.com/#-226,-20,0.4729,h0): a dense, readable miniature-diorama village seen through a true isometric orthographic camera. **There is no free-walking camera.** Do not implement or keep WASD walking, pointer-lock mouse-look, a third-person follow rig, or a Tab/M walk↔overview toggle in life mode.

The walk-camera branch `village/camera-ui` was reviewed and then **unmerged** from main. Do **not** merge that branch. You may *read* (not modify) `/workspace/cel-town-wt/camera-ui/src/life/hud.js` and `interact-ui.js` to salvage HUD clock styling, name-tag/tooltip ideas, and hover-prompt chrome. Rewrite controls and hints for iso pan/zoom/click. Leave walk-specific code behind.

## Already on this snapshot (use it, do not invent a second stack)

- `src/stage.js` already has an orthographic path: `?cam=iso` builds a `THREE.OrthographicCamera`, `setIsoFit()` frames the town core, and iso currently uses **30° elevation** (commented as 2:1-ish) with `OrbitControls` (`minZoom` 0.5 / `maxZoom` 3). Fog is already disabled in iso.
- Life mode currently calls `createWalkCamera` in `src/life/camera.js` / `index.js`, which swaps `stage.camera` to a **perspective** walk cam and is the thing you are replacing.
- Art atmosphere, interiors, lighting polish, and opt-in `?variety=1` building variety are already hooked on main. Keep every existing `// WORKTREE-HOOK` line.
- `__ready`, `__stage`, `__town`, `__post`, `__scene`, `__THREE`, `__renderer`, `__life`, `?prmax`, `?shadowMap`, and (for non-life / QA pages) `?cam=` / `?target=` must keep working.
- Life-off compiled JSON for hamlet/large seeds 1, 7, 1234 (and 19 as used in tests) must stay byte-identical. Camera work is runtime-only.

## File ownership (hard)

You MAY freely edit and create:

- `src/life/iso-camera.js`, `iso-interact.js`, `iso-hud.js` (names may vary; keep them under `src/life/`)
- `tools/shots-village-iso.mjs`, `shots/village-iso/`
- `docs/village/ISO-CAMERA.md`, this brief, `out/codex-village-iso-camera-report.md`

One clearly marked hook line only in each of: `src/life/index.js`, `src/life/camera.js` (or stop calling walk from index and hook only index — either is fine), `src/stage.js` (only if you must change default iso elevation/azimuth, disable orbit-rotate, or expose a small API; do not rewrite the kit/hamlet perspective path), `src/post/post.js` (optional tilt-shift/DOF), `src/life/interiors.js` (optional cutaway/peek hook — do not invent a second interiors stack), `package.json`, `README.md`. Additive tests namespaced `life-iso` only.

DO NOT EDIT: `src/world/registry.js`; compiler files; `src/catalog/**` except you may *read* them; lighting files (`daynight.js`, `sky.js`, `fog.js`, `lighting-polish.js`) except a post hook; `src/life/tools.js`, `context.js`, `planner.js`, `economy.js`, `schedules.js`, `people.js`, `graph.js`; props/expansion/playtest files; `dressing-runtime.js`, `townsfolk.js`, `generate-townsfolk.mjs`, `districts.js`. Do not change compiled life-off JSON. Do not rewrite `src/life/social.js` except a single marked hook if you must attach building/NPC hover to the existing label overlay.

In-flight worktrees (`life`, `props`, `expansion`, `playtest`) own their files. Read them if useful; do not edit them.

## Goal

In `life=1`, a `THREE.OrthographicCamera` at classic isometric angle is the **only** camera.

1. **Angle.** Pitch `atan(1/sqrt(2))` ≈ 35.264°, yaw 45° (or 45° + N×90° after a rotate snap). No perspective. Upgrade the existing 30° stage iso for life; do not leave a walk/persp camera selectable in life mode. Keep perspective + the Look-panel iso toggle working on non-life kit/compile pages.

2. **Zoom.** Smooth, eased, via wheel and pinch, from a whole-village overview down to close street level, **zooming toward the cursor** (the world point under the pointer stays under the pointer). Clamp min/max so overview shows the village and close-up is readable, not a single texture texel.

3. **Pan.** Drag: right-drag or Space+drag; also left-drag on empty ground. Touch drag to pan. Clamp the look-at / target to village bounds (town core / life graph / `setIsoFit` boxes — do not let the camera wander into empty field).

4. **Rotate (optional but wanted).** Q/E (or equivalent) 90° yaw snaps, eased, around the current ground target, staying isometric.

5. **Shareable hash.** Encode camera state in the URL hash like Tiny Las Vegas: `#x,z,zoom,h0` (world ground x,z, a documented zoom scalar, heading `h0`/`h90`/`h180`/`h270` or an integer degrees multiple of 90). Load from hash on startup; update with `history.replaceState` (debounced) as the view moves. Query string stays the play URL; do not break `?size=large&seed=1234&life=1`. Preserve `?cam=`/`?target=` for non-life QA; in life, hash wins when present.

6. **No player avatar walking the streets.** Do not spawn or steer the old walk-mode player figure. Residents remain the 12 townsfolk.

7. **Interaction without walking.**
   - Hover a building or NPC: name tag / tooltip (reuse social labels where they already work; add building names, preferably via the world registry when `town.registry` exists: civic names, houses).
   - Click a building: open a cutaway/peek of its interior (roof fade or the existing interiors room view) **or** eased zoom-to that building. Prefer a visible roof-fade/cutaway for enterable places (bakery/inn/store/smithy) if interiors are already on this snapshot; otherwise zoom-to. Clicking empty ground or a close control cancels follow/peek.
   - Click an NPC: follow it (camera tracks that resident, still iso) and show a small card with their name/role and current action. Read the action from the tools/life layer when present (`__life.activities()`, people state, or context); if the day-in-the-life tools are not merged yet, show the current schedule/activity string already exposed by `__life` / social. Do not call LLMs.

8. **HUD.** Quiet clock (Willowmere, time, period: Daylight / Golden hour / Moonlit). Hints for wheel/pinch zoom, drag pan, Q/E rotate, click to inspect. Hide the Look panel unless `debug=1`. F can still skip +3 hours.

9. **Look.** Dense, readable miniature-diorama: trees, props, people, carts stay crisp at mid and close zoom. Keep MeshToonMaterial, the 3-step ramp, and inverted-hull outlines. Tune outlines and the post stack so they work in **ortho at all zoom levels** (no hairline explosion at close zoom, no disappearing edges at overview). Optional subtle tilt-shift / DOF at close zoom only, if it actually looks good; easy to disable (`?dof=0` or similar). Soft, rich palette — do not flatten lighting polish.

Play URL: `/?size=large&seed=1234&life=1` (hash appended). `?variety=1` may be used in one density shot but is not required for the default view.

## Shots

`tools/shots-village-iso.mjs` + `npm run shots:village-iso`. Same Playwright / local Chrome / SwiftShader harness as prior milestones (`/usr/bin/google-chrome`, `--use-gl=angle --use-angle=swiftshader`). Write `shots/village-iso/`:

- `overview.png` — whole village, default or wide zoom
- `mid-zoom.png` — street-level cluster, readable houses/props/people
- `close.png` — close street, crisp edges, HUD visible; tilt-shift only if it is on and helps
- Optional but welcome: `npc-card.png` (follow + action card) and/or `building-peek.png` (cutaway or zoom-to)
- `village-iso.mp4` — 12–20s, 1280×720, H.264 yuv420p, slow eased pan and zoom (overview → mid → close or a gentle orbit-by-pan). Post **on** for stills; post on for the movie if SwiftShader can finish it, otherwise document `post=0` and keep stills with post.

`--stills-only` / `--video-only` supported. Drive the camera through the iso API or hash (`__life.camera` / a documented `window.__iso` is fine) — do not use WASD. Support `?prmax`, `?shadowMap`, `__ready`, `__post.render`.

## Checks

`npm run test:checks`, `npm run test:parity`, and `npm run test:world-registry` must pass. Life-off hashes unchanged. Add a small `life-iso` test if useful (hash parse/serialize, bounds clamp, zoom-to-cursor invariant, no perspective camera in life mode).

## Done means

Life mode is iso-only (no walk camera), pan/zoom/hash/clamps work, hover and click interactions work, the look is a crisp diorama at three zoom levels, tests and hashes are green, shots and a short video are on disk, docs and a report are written, work is committed locally. Do not merge other worktrees.
