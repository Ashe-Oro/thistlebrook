# Willowmere — day in the life

Implemented on `village/day-in-the-life`, confined to `/workspace/cel-town-wt/life`. Implementation commit: `db422ba` (`Add tool-driven daily routines for Willowmere residents`).

## Delivered

- All twelve existing townsfolk have table-driven morning, work, errands, meals, social time and night routines, with per-role differences and seeded afternoon timing.
- Nine registered tools own behavior changes. Definitions include argument/result schemas, prechecks and execution. Invalid calls return errors without side effects. Movement resolves registry queries and then graph routes; ordinary ticks walk, explicit time seeks reconstruct.
- Detached JSON-serializable contexts expose personality, job, obligations, assets, relationships, needs, schedule, actual location and action. `__life.context(id)`, `contexts()`, `tools()`, `history()` and `economy()` are available.
- `__life.planner` is replaceable with any `{plan(context, world)}` implementation. Current planner is entirely scripted; no model calls or external services.
- Friends Mabel/Bram and Ada/Oswin; family Rose/Pip; rivals Finn/Hazel; mutual crush Clover/Fern; additional friendship links for Rowan and Hugh. Nearby players receive tool-mediated weather-aware greetings in walk mode.
- Seeded weekday/weather with `weekday=mon..sun` and `weather=clear|overcast|rain|fog` overrides. Weekend and wet-weather alternatives affect routines and dialogue.
- Economy is only three intent counters. No prices, transactions, tokens or persistence.
- Single marked hooks in `src/life/index.js`, `src/life/social.js`, and `package.json`. No edits to compiler, registry, catalog, graph, people, camera, lighting, post, interiors or other worktrees.

## Reproduce

Open `/?size=large&seed=1234&life=1&weekday=wed&weather=clear`.

Seek with `__life.setHour(hour)`:

| Hour | Beat |
| --- | --- |
| 8 | Morning trades |
| 9.021 | Mabel/Bram smithy greeting |
| 12.021 | Ada/Oswin chat, Rowan shopping, Clover eating, Pip playing |
| 16.5 | Clover/Fern flowers conversation |
| 17.5 | Finn/Hazel rivalry |
| 18.75 | Rose/Pip family conversation |
| 20.5 | Hugh's lamp patrol |

## Validation

- `npm run test:checks`: pass (negative validation and batching checks).
- `npm run test:parity`: pass, including hamlet/large life-off SHA-256 fixtures for seeds 1, 7, 1234; forward/reverse and one-ulp math perturbation paths.
- `npm run test:life-routines`: 8 passing tests. Covers serialization, registered plans throughout the day, failed preconditions without mutation, graph paths before action, distant speech rejection, calendar overrides, legacy beats, replacement planner validation, repeatable runtime seeking with the player present, and weekend/weather variations.
- `npm run build`: pass; Vite's existing large-chunk advisory remains.
- Capture assertions check all twelve residents' feet against measured model bounds, reject building-footprint intersections and require the post stack on. All six final stills and six video pose samples pass; zero browser errors. Full-video ffmpeg decoding exits successfully. Details and ffprobe metadata are recorded in `shots/village-life/evidence.json`.

## Evidence

`tools/shots-village-life.mjs` / `npm run shots:village-life` uses local Chrome, SwiftShader and Vite preview. Supports `--video-only` and `--stills-only`. Post remains enabled with edges, normals, hulls, grading, quantization and Kuwahara smoothing; radius 2 reduces CPU capture cost. `ffprobe` verifies 24.000 seconds, 192 frames at 8 fps, 1280×720 H.264/yuv420p, with three slow camera arcs through the smithy greeting, plaza stories and flowers conversation.

Six stills: `morning-work.png`, `smithy-greeting.png`, `plaza-stories.png`, `inn-meal.png`, `flowers-for-fern.png`, `lamplighter.png` under `shots/village-life/`.

## Integration boundaries

The world registry is still the supplied empty stub. `destinations.js` contains the explicitly marked `TODO(rebase-registry)` adapter using existing reachable schedule nodes, including name/type/catalog-ID aliases. It only applies while the registry is empty. When the registry branch lands, bind the routine home/work/meeting aliases to real registry place IDs and participant interaction slots, then remove the adapter. No other worktree was merged.

The added paired conversations reuse the known reachable plaza pair slots. Market rivalry and family supper are conversational themes there, not interior scenes. Hugh's patrol is a work action on the plaza route; existing day/night code controls illumination. Weather affects planning/dialogue, not atmospheric rendering. Work/eat animations reuse existing grounded social gestures; no new rig or props were introduced. Calendar describes a reproducible day and does not persist dates. Seeking resets needs, relationship interaction counts and economy counters rather than replaying history.

No purchases, pushes, deployment, API keys, LLM calls, MCP server, GPU service, or token economy were used. Existing untracked launcher files and dependency/licensed-asset links are left alone.
