# Scripted day in the life

`createPlanner()` returns `{kind:'scripted', plan(context, world)}`. Its output is exactly `{tool,args}` or `null`. `planNext` is a convenience wrapper. Assign a replacement object to `__life.planner` to replace decision making without replacing navigation or rendering. There are no LLM calls, keys, network brains or MCP servers.

The planner requests a walk when the current routine changes, waits for arrival, then requests the beat's action once. Failed proximity checks retry until both participants arrive. `world` supplies graph, registry, contexts, destinations, `arrived`, `move`, `act`, and the economy interface. These are local adapters; a future remote planner should receive a read-only serialized projection rather than the live world.

`data/routines.js` holds common daily beats, twelve personalities/job descriptions, per-role overrides, relationships and dialogue, paired meetings, weekday/weather rules, and ambient lines. `routines.js` compiles the tables into schedules. Weekends add an afternoon gathering; rain/fog replace the afternoon stroll with an inn visit. Each resident gets a seeded afternoon errand. Weather affects choices/dialogue; this workstream does not draw rain or fog. Calendar randomness uses `deriveSeed` independently of compiler placement randomness.

Use `/?size=large&seed=1234&life=1&weekday=wed&weather=clear`. Supported weekdays: mon–sun; weather: clear, overcast, rain, fog. Invalid overrides fall back to the seed. Read `__life.weekday` and `__life.weather`. These describe a repeatable day, not a persistent advancing calendar.

Reproducible seek beats:

| Hour | Beat |
| --- | --- |
| 8 | Morning trades and work |
| 9.021 | Mabel/Bram greeting at smithy |
| 12.021 | Ada/Oswin stories, Rowan buying, Clover eating, Pip playing |
| 16.5 | Clover/Fern exchange flowers (crush) |
| 17.5 | Finn/Hazel friendly market rivalry |
| 18.75 | Rose/Pip family supper conversation |
| 20.5 | Hugh's lantern patrol while neighbours settle home |

The three added paired meetings reuse the reachable plaza conversation slots, including the market rivalry and family supper conversation; symbolic event targets describe their topic, not an interior location. Existing M2 meal/shop destinations are preserved. Hugh patrols an existing plaza destination; lamp illumination remains controlled by the day/night renderer.

`__life.hour`, `setHour`, `setTimescale`, `activities`, `mode` and `__ready` remain available. `activities()` includes existing renderer reservations; context/currentAction is the authoritative tool state. Movement travels the original graph continuously during ticking. Time seeks are immediate reconstructions. Player proximity in walk mode requests a weather-aware greeting through `talkTo`, throttled to once per fifteen game minutes.

Run `npm run test:life-routines`, `npm run test:checks`, `npm run test:parity`, then build and `npm run shots:village-life`. Capture flags: `--stills-only` and `--video-only`. Captures use local Chrome, SwiftShader, post processing on, and a 24-second 1280×720 H.264/yuv420p film.

For slow software rendering, `--video-only --frames=32` checkpoints a partial capture. Continue with `--video-only --resume --frames=32` until 192 frames exist; the final batch encodes the 24-second film and removes intermediate frames. `--resume` without a frame limit finishes all remaining frames. The harness asserts `__post.options.post === true`; its evidence records the actual post options.
