# Build "Weather", rain and snow that change how Thistlebrook looks and how villagers spend the day (branch `village/weather`, worktree `/workspace/cel-town-wt/weather`).

OWNER: weather lane. Base: current `main`.

## Reference

`src/life/calendar.js` already picks `clear`, `overcast`, `rain` or `fog` (query `?weather=`). The HUD has a weather slot. The `winter` skin already lays shader snow on up-facing surfaces and slush on roads — that is a skin, not a weather system. Do not rewrite skins. Weather must look right in the default **cel** skin, and still look right if the player then switches to autumn, neon or winter.

Gold stills, seed 831, same cameras as a downtown wide and a residential street. Take clear-day before shots first:

| Weather | Aim | Files |
| --- | --- | --- |
| Rain, day | Visible streaks or drops, darker wet pavement with soft reflections, umbrellas or hooded walkers, fewer people lingering on benches | `after-rain-day.png` |
| Rain, dusk | Lamps read on wet ground, villagers head for cover | `after-rain-dusk.png` |
| Snow, day | Falling snow, a light cap on roofs, hedges and lamps, not a full winter-skin reskin of every material | `after-snow-day.png` |
| Clear after | Returning to `?weather=clear` restores the cel day with no leftover puddles or flakes | `after-clear.png` |

Measurable features: in the rain still, wet pavement is clearly darker than the clear before (mean pavement luminance drops at least 15% in a sampled road crop). In the snow still, flakes are visible against dark trees or roofs, and road carriageways stay darker and slushier than the sidewalks.

## Details

A town-wide weather state, driven by the calendar and `?weather=`, including a new **`snow`** type. Overcast and fog may be improved if cheap, but rain and snow are the work.

Look: a lightweight particle or sheet system for rain and snow, a wet-ground mask on roads and plazas, occasional puddles that sit on the surface (TOWN-04), and a soft sky/light shift (dimmer key, cooler fill when raining; cooler key and slightly brighter ground bounce when snowing). No photoreal rain maps that break cel. No second post stack that fights the existing one.

Routines change with the weather, using the existing life planner additively:

- Rain: outdoor linger, picnic and bench time shortens or moves indoors; shop and commute still happen; villagers use sidewalks and crossings only; some carry a simple umbrella prop while walking outside.
- Snow: slower outdoor walks, kids may still play, fewer picnic slots, more indoor visit/eat/rest; the fair and beach activities shrink when open-air.
- School, work shifts and already-scripted events (ballgame, fair hours) still run unless the weather is a documented closure (for example the ballgame is cancelled in rain — if you cancel it, show a covered or empty field and a test).
- `?weather=` and a small HUD control can change weather live without a world rebuild, the same way skins switch.

Out of scope: rewriting the winter skin, lightning and storms, flooding that carves new rivers, physics puddles, and any change to Maple Hollow or Vice Beach layouts. Do not retint the ocean with a full contrast pass (that belongs to the polish lane if it is still open).

## Tools

- Work only in `/workspace/cel-town-wt/weather`. Branch `village/weather` from `main`.
- New files: `src/astra/weather-plan.js` (pure), `src/astra/weather.js`, `src/astra/weather.css`. Additive hooks in `light-cycle.js` / `lighting.js`, the calendar (add `snow`), the HUD, and the life planner. Do not edit skin data files except to make sure weather still composes with them.
- Tests: the full suite, audits, plus `tests/weather.test.mjs` (state, routine changes, clear restore, no walkers on roads in rain or snow).
- Shots in `shots/weather/`. A short clip of a rainy downtown minute.
- No push, no deploy, no force-push. No licensed binaries.

## How to work

Autonomous, with no questions. Log assumptions in an append-only decisions log.

Measure the clear-day stills first. Keep weather a data state plus a renderer, so tests can set `rain` at 10:00 and assert planner choices without WebGL.

Measurable targets:

- `?weather=rain`, `snow`, `clear`, `overcast`, `fog` all resolve. Switching back to `clear` restores lighting and hides particles (pixel check on a pavement crop: max channel delta vs the original clear still under 8, except clock hands and moving people).
- At seed 831, 10:00, rain: outdoor picnic/bench occupancy is at least 50% lower than clear at the same time, and ≥ 80% of outdoor walkers have an umbrella or a documented "hurrying" state. 0 walkers on the carriageway except crossings (TOWN-01).
- Snow at midday does not wash the town to white (mean frame luminance stays below a recorded cap, well under the "washed-out winter skin" problem). Pavement stays readable.
- Particle systems stay within a recorded draw-call budget (document the delta; prefer one or two meshes, not one mesh per flake).
- `audit:roads` 0 open, `sim:collisions` 0. Injected "villager lingering on a bench through a whole rainy hour" fails the test if your rules forbid it.
- Blind critic loop on rain/snow vs clear, in random order, until weather is obvious and the town still looks cel, not like a film-grain overlay. Revert anything worse.

## Deliver

- Local commits only on `village/weather`. Never push or deploy.
- Stills and a rain clip in `shots/weather/`. Before/after luminance numbers in the log.
- Tests and audits green. CHANGELOG entry under Unreleased.
