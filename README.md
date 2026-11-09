# Thistlebrook: a digital terrarium

A small three.js village life sim in the spirit of Smallville / generative agents, made into a game you watch. Eight villagers with
outfits, traits, goals, needs, keepsakes, memories, plans, crushes, grudges and alliances get on with their lives, and the
drama comes out of the simulation.

**Local only.** `licensed/` (the character engine and GLB packs) is gitignored and must never be pushed or uploaded anywhere.

## Run
```bash
npm install                 # once
node tools/build.mjs        # production bundle -> dist/   (add --dev for an unminified build)
node tools/serve.mjs        # http://127.0.0.1:5173  (serves dist/ plus licensed GLBs at /glb)
```
URL params: `?seed=7` gives a deterministic run, `?cam=free` starts in free cam, `?nopaper` skips the dawn Gazette popup.

Controls: click a villager to open the card (Relationships, Plan, Mind, Story). Use the dock for god powers (gift, rain,
traveller, festival) and views (relationship web, Gazette, recap, villagers). `Space` pauses and `Esc` deselects. 1×/4×/16× sets the speed.
Director cam picks the juiciest thing happening. Free cam lets you orbit.

## Verify / media
```bash
DAYS=4 SEED=7 node tools/verify.mjs   # headless multi-day soak with assertions -> verify-report.json
node tools/gallery.mjs                # staged review screenshots -> shots/final/
node tools/video.mjs                  # frame-exact director's cut (virtual clock, 24 fps) -> shots/terrarium.mp4
```

## Performance

`node tools/perf.mjs [W] [H]` is a headless probe. It reports **real** fps (rAF frames per wall-clock second), JS ms per frame (sim + UI + draw submission), draw calls, triangles and the dynamic render scale at three camera spots. Options: `MOBILE=1` emulates a phone; `Q='&dynres=0'` passes extra URL flags.

**What the governor does (src/main.ts `perf`).**
- **Villagers:** culled when off-screen. The ink outline is dropped beyond 34 m and real shadows beyond 26 m, where a blob shadow replaces them.
- **Shadow map:** refreshed every other frame (`?shadowEvery=N`).
- **Dynamic resolution:** the render scale moves between 0.65× (0.5× on software rasterisers) and the device ratio to hold 50–58 fps (`?dynres=0` turns it off).
- **Software rasterisers** (SwiftShader/llvmpipe, i.e. no GPU): MSAA is off and the shadow map is 1k.
- **UI:** the per-frame label/bubble layout no longer thrashes layout (sizes are cached, DOM writes are guarded), and the panels lost a backdrop blur.

**Measured headless numbers.** The box has no GPU, so these are SwiftShader CPU rasterisation at 1280×720.

| | overview | plaza | director |
|---|---|---|---|
| before (round 1) | 2.8–3.3 fps | 3.7–4.3 | 3.5–4 |
| after | ~12 fps | ~16–17 | ~12–13 |
| JS cost per frame (after) | 4.6 ms | 1.7 ms | 2.3 ms |
| phone emulation 390×844 (after) | 24 fps | 38 | 26 |

On a laptop GPU, frame time is bounded by JS cost. At about 2–5 ms per frame, that leaves room for 60 fps. That can't be measured here. Capture runs (`?capture`) keep full quality.

## Architecture (src/)
- `sim/sim.ts`: world clock, action executor, parties, fights, keepsakes, weather, witnesses, fact propagation.
- `sim/brain.ts`: `UtilityBrain`, which handles day plans (re-planned on interruptions), utility-scored choices, and reflections. `sim/llm.ts` is an optional LLM brain (off by default).
- `agents/memory.ts`: memory stream (observations, heard facts, reflections) with importance and retrieval.
- `sim/social.ts` + `sim/lines.ts`: social actions (chat, gift, flirt, confess, gossip, rumour, argue, accuse, steal, reconcile, deliver) and a personality-aware dialogue library.
- `sim/arcs.ts`: groups events into story arcs (missing keepsakes, romances, feuds, rumours) for the feed, recap and Gazette.
- `sim/director.ts`: director camera picks plus the dawn Gazette (headlines, standings, sweethearts).
- `sim/god.ts`: viewer god powers.
- `world/*`: town layout (Cozy Village + Countryside Farm), painted ground, nav grid + A*, sky/day-night, GPU rain, particles, point lights.
- `agents/avatar.ts`: dressed characters, procedural animation, expressions, tools/props.
- `ui/*`: chronicle feed, villager card, leaderboard, relationship web, recap, Gazette, toasts, bubbles, sound.

v1 scope: **no economy**. Jobs are ambient routines. Keepsakes are the only objects, and they carry story value only.

## Private hosting proposal (not deployed)
The **bundle itself contains the licensed character engine** (it is compiled in from `licensed/char`), and the GLBs are licensed,
so the whole deployment must be private, not just the models:
1. A private Vercel project, deployed from the CLI from this local folder (no public Git repo, and not `tailgate-games`).
2. **Deployment Protection** (Vercel Authentication or password) on all deployments, including production.
3. GLBs in **private Vercel Blob**. A small authenticated route (`/api/glb/[name]`) checks the session and streams the blob or
   returns a short-lived signed URL. The client loader switches from `/glb/...` to that route.
4. No source maps in production, `Cache-Control: private`, and `X-Robots-Tag: noindex`.
