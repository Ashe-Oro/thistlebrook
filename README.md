# Thistlebrook: a digital terrarium

A small three.js village life sim in the spirit of Smallville / generative agents, made into a game you watch. Sixteen villagers with
outfits, traits, goals, needs, keepsakes, memories, plans, crushes, grudges and alliances get on with their lives, and the
drama comes out of the simulation.

**Local only.** `licensed/` (the character engine and GLB packs) is gitignored and must never be pushed or uploaded anywhere.

## Run
```bash
npm install                 # once
node tools/build.mjs        # production bundle -> dist/   (add --dev for an unminified build)
node tools/serve.mjs        # http://127.0.0.1:5173  (serves dist/ plus licensed GLBs at /glb)
```
URL params: `?seed=7` gives a deterministic run (the sim advances in fixed 1/30 s steps, so the same seed tells the same story
at any frame rate or speed, in real time or via `terrarium.fastForward`), `?cam=free` starts in free cam, `?nopaper` skips the
dawn Gazette (and its "Previously in Thistlebrook" montage; `?nomontage` skips only the montage).

Save / resume: the village autosaves to localStorage every 20 s, at dawn and when the tab is hidden, and resumes on reload.
🌱 in the top bar starts a new village (new random seed). `?fresh` ignores the save for one load, `?nosave` never writes one,
and a `?seed=` that differs from the saved village starts that seed fresh.

Controls: click a villager to open the card (Relationships, Plan, Mind, Story). Use the dock for god powers (gift, rain,
traveller, festival) and views (relationship web, Gazette, recap, villagers). `Space` pauses and `Esc` deselects. 1×/4×/16× sets the speed.
Director cam picks the juiciest thing happening. Free cam lets you orbit.
God powers recharge after use (gift 8 s, rain 25 s, traveller/festival 30 s); they do nothing while paused, and rain won't
re-fire during a storm. Living-world touches: a bird flock by day, fish leaping in both ponds, ducks, a rainbow after a daytime
shower (with an "After the Rain" shot when the director has the camera), and a sepia dawn montage of yesterday's big moments.

## Verify / media
```bash
DAYS=4 SEED=7 node tools/verify.mjs   # headless multi-day soak with assertions -> verify-report.json
node tools/gallery.mjs                # staged review screenshots -> shots/final/
node tools/video.mjs                  # frame-exact director's cut (virtual clock, 24 fps) -> shots/terrarium.mp4
SEEDS=7,3,11 DAYS=8 node tools/soak.mjs  # multi-seed event-count stats (fights, arguments, contests, weddings...)
```

## Performance

`node tools/perf.mjs [W] [H]` is a headless probe. It reports **real** fps (rAF frames per wall-clock second), JS ms per frame (sim + UI + draw submission), draw calls, triangles and the dynamic render scale at three camera spots. Options: `MOBILE=1` emulates a phone; `Q='&dynres=0'` passes extra URL flags.

**What the governor does (src/main.ts `perf`).**
- **Villagers:** culled when off-screen. Beyond 40 m the 12-material character (12 draw calls) swaps to a one-draw twin with baked vertex colours. The ink outline is dropped beyond 34 m and real shadows beyond 26 m, where a blob shadow replaces them.
- **Shadow map:** refreshed every other frame (`?shadowEvery=N`).
- **Dynamic resolution:** the render scale moves between 0.65× (0.5× on software rasterisers) and the device ratio to hold 50–58 fps (`?dynres=0` turns it off).
- **Software rasterisers** (SwiftShader/llvmpipe, i.e. no GPU): MSAA is off and the shadow map is 1k.
- **UI:** the per-frame label/bubble layout no longer thrashes layout (sizes are cached, DOM writes are guarded), and the panels lost a backdrop blur.

**Measured headless numbers.** The box has no GPU, so these are SwiftShader CPU rasterisation at 1280×720.

| | overview | plaza | director |
|---|---|---|---|
| before (round 1) | 2.8–3.3 fps | 3.7–4.3 | 3.5–4 |
| after | ~12 fps | ~16–17 | ~12–13 |
| round 4 (16 villagers + extras) | 10.5 fps, 130 calls | 13.5, 119 calls | 16.4, 45 calls |
| JS cost per frame (after) | 4.6 ms | 1.7 ms | 2.3 ms |
| phone emulation 390×844 (after) | 24 fps | 38 | 26 |

On a laptop GPU, frame time is bounded by JS cost. At about 2–5 ms per frame, that leaves room for 60 fps. That can't be measured here. Capture runs (`?capture`) keep full quality.

## Music and ambience
- The **adaptive score** (`src/audio/music.ts`) is original and generative, synthesised live in WebAudio. There are no audio files and no samples. Its themes evoke the sparse open-world style without quoting anyone's melodies:

  | Theme | When it plays | Sound |
  |---|---|---|
  | Day field | By day | Sparse, rubato, open-voiced piano phrases in D major pentatonic, with long silences between them. |
  | Village | Camera near the plaza | A warmer variation in F with a lilting 3/4 left hand and an occasional flute. |
  | Night | At night | Slower and lower, on felt piano and celesta over soft strings. |
  | Rain | When it rains | A muted D-dorian tint, plus a low-pass on the whole mix. |
  | Festival / season finale | During festivals | A 6/8 jig on fiddle and flute, with piano, a frame drum and tambourine. The finale is fuller. |

- **Winter** swaps in glassy bells and the odd sleigh-bell shimmer.
- **Dawn and dusk crossfade**, because:
  - themes are picked per phrase, by weight, with hysteresis;
  - each phrase's pad overlaps the next.
- **Story cues:**
  - a tension sting on brawl and showdown beats;
  - a resolution flourish on Found! and on resolved storylines;
  - a tender wedding motif at the vows.
- **Ambience** (`src/audio/ambience.ts`): wind, daytime birds, crickets and an owl at night, and rain.
- **Controls:** sound is off until you click 🔊. That's the browser's autoplay gesture.
  - The 🔊 popover has a mute button, music and ambience toggles, and a music volume slider.
  - Settings are saved in `localStorage['thistlebrook.audio']`. A saved "on" resumes at your first click or key.
- **Previews:**
  - `node tools/music/render.mjs` renders `shots/audio/{day_field,village,night,festival}.mp3` offline, through the same engine.
  - `node tools/music_demo.mjs` records `shots/music_demo.mp4`, a day → dusk → night transition with its score.
- **Credits:** see `AUDIO_CREDITS.md`.

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
- `ui/*`: chronicle feed, villager card, leaderboard, relationship web, recap, Gazette, toasts, bubbles, sound mixer; `audio/*`: generative score and ambience.
- `ui/bubbletext.ts`: turns dialogue and chronicle events into short speech-bubble lines (2–8 words, mood tint from the emoji). Only the display is shortened. `sim.transcripts` keeps every exchange's full lines (speakers, time, place) for a future "read their conversation" view once villagers are real AI agents.

### Default screen (round 8, cozy declutter)
- The world is the star. Interactions appear as small rounded speech bubbles over heads. Two-way exchanges alternate, and at most 4 bubbles show at once (3 on phones), nearest the camera or focus first. Bubbles shrink with distance and hide when the speaker is far away or behind a building.
- The chronicle, storylines and leaderboard start **closed**. Open them from the dock (📜 📺 🏆). The open/closed state is saved in `localStorage` under `thistlebrook.panels`. 📜 shows a small badge for big news you haven't seen.
- The dock is one slim row of icons with tooltips. The top bar is a few floating pills. Name tags appear only on hover, or for the selected/followed villager at close range. The first-visit tip shows once.
- Captions, achievement toasts and beat titles are one short line each. The letterbox is thin. A letter arrives as a small toast you can tap to open the handwritten card.

v1 scope: **no economy**. Jobs are ambient routines. Keepsakes are the only objects, and they carry story value only.

## Private hosting proposal (not deployed)
The **bundle itself contains the licensed character engine** (it is compiled in from `licensed/char`), and the GLBs are licensed,
so the whole deployment must be private, not just the models:
1. A private Vercel project, deployed from the CLI from this local folder (no public Git repo, and not `tailgate-games`).
2. **Deployment Protection** (Vercel Authentication or password) on all deployments, including production.
3. GLBs in **private Vercel Blob**. A small authenticated route (`/api/glb/[name]`) checks the session and streams the blob or
   returns a short-lived signed URL. The client loader switches from `/glb/...` to that route.
4. No source maps in production, `Cache-Control: private`, and `X-Robots-Tag: noindex`.

## Optional LLM dialogue

Off by default. An OpenAI-compatible chat completion server can decorate speech bubbles and the villager card's thoughts
and beliefs. Simulation decisions, timing, memories and chronicle entries always use the deterministic originals.
Late replies keep the original bubble; errors silently fall back and pause requests for 60 seconds.

For example, serve a Qwen model with llama.cpp or vLLM on your local machine, then open:

```text
?llm=http%3A%2F%2Flocalhost%3A8000%2Fv1%2Fchat%2Fcompletions&llmModel=Qwen3-8B
```

Use the model name your server exposes. The server must allow CORS requests from the village's origin, including
`Content-Type` and `Authorization` headers if used. An HTTPS page also needs an HTTPS endpoint.
Optional `&llmKey=...` supplies a key for this session only; URL configuration is never saved automatically.
Avoid putting private keys in shared URLs or browser history.

Persist configuration explicitly in the browser console:

```js
terrarium.enableLLM({ endpoint: 'http://localhost:8000/v1/chat/completions', model: 'Qwen3-8B', maxCallsPerMin: 20, timeoutMs: 2500 });
terrarium.llmStatus(); // {enabled, ok, calls, cacheHits, failures}
terrarium.disableLLM();
```

Configuration uses localStorage `terrarium.llm` with `{endpoint, model, apiKey?, maxCallsPerMin?, timeoutMs?}`;
calling `enableLLM` persists any supplied key in that browser. `?llm=0` disables saved configuration for one load.
The top bar shows an enabled/offline chip. Requests have a 2500 ms default timeout, at most three in flight,
a default limit of 20 calls per minute, and a 256-entry in-memory LRU keyed by speaker and original text.
`ok` means enabled and outside failure backoff; counters are cumulative for this page session.
