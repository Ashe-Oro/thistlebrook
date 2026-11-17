# Living Village — Day in the life (Astra workstream)

You are in git worktree `/workspace/cel-town-wt/life` on branch `village/day-in-the-life`. Read `docs/village/INTERFACES.md` first and implement against those stubs. Do not edit `/workspace/cel-town` or other worktrees. Do not buy anything, git push, or deploy. Local commits on this branch only. No API keys, no 4090, no Claude, no LLM calls, no MCP server, no token economy. No touching `/workspace/tailgate-games` or Thistlebrook.

When finished, write `out/codex-village-life-report.md`, capture shots/video, and leave work committed on this branch.

## File ownership (hard)

You MAY freely edit: `src/life/tools.js`, `context.js`, `planner.js`, `economy.js`; new files you create (`src/life/routines.js`, `relationships.js`, `dialogue.js`, `calendar.js`, data tables under `src/life/data/`, etc.); `docs/village/TOOLS.md`, `CONTEXT.md`, `PLANNER.md`, `ECONOMY.md`; `tools/shots-village-life.mjs`, `shots/village-life/`.

One clearly marked hook only in each of: `src/life/index.js`, `schedules.js`, `social.js`, `people.js`, `package.json`, `README.md`. Additive tests namespaced `life-routines` only.

DO NOT EDIT: `src/world/registry.js`, compiler files, `src/catalog/**` except you may *read* them, `src/life/camera.js`, `daynight.js`, `graph.js`, `src/post/**`, interiors/doors, `dressing-runtime.js`, `townsfolk.js`, `generate-townsfolk.mjs`, `districts.js`. Do not change compiled life-off JSON.

## Goal

Give all 12 existing Willowmere townsfolk a full day in the life that reads as a living village.

The 12 (ids stay `townsfolk-*`): Mabel Baker, Bram Smith, Rose Innkeeper, Finn Shopkeeper, Hazel Merchant, Oswin Miller, Clover Farmhand, Rowan Carpenter, Pip Child, Ada Elder, Fern Herbalist, Hugh Lamplighter. Play URL: `/?size=large&seed=1234&life=1`.

1. **Tools.** Implement the typed NPC tool registry in `src/life/tools.js`: `walkTo`, `talkTo`, `work`, `buy`, `sell`, `payBill`, `rest`, `eat`, `visit`. Each has args schema, result type, precondition, and execute, all in one registry. The sim executes NPC behavior only through these tools. `walkTo` MUST resolve name/type/id via `src/world/registry.js` (`findPlace` / `getPlace` / `nearestEntryNode`) then the walk graph — no hardcoded world coordinates. The registry implementation may still be a stub in this snapshot; code against the interface (see INTERFACES.md). You will rebase after the registry branch lands. Until then, a thin adapter may call the stub plus a temporary fallback that uses existing schedule nodes, clearly marked `// TODO(rebase-registry)`.

2. **Context.** Each NPC has a typed, JSON-serializable context: job, personality, money, bills/obligations, assets, relationships, needs, schedule, location, current action, hour/weekday/weather. Use `src/life/context.js`. Expose `__life.context(id)` and keep `JSON.parse(JSON.stringify(ctx))` working.

3. **Planner.** Implement a **scripted** planner behind `createPlanner()` in `src/life/planner.js`: `(context, world) => {tool, args} | null`. It must be fun to watch: full daily routines, weekday/weather/random variations, who they meet, what they say, where they go, relationships (friends, family, rivals, crushes), and reactions to each other, the player, time, and events. Data-driven: JSON/TS tables for routines, dialogue, relationships, variations — not a thicket of hardcoded branches. An LLM agent must be able to replace this planner later with no sim rewrite. Build NO LLM calls now.

4. **Economy hook.** Keep `src/life/economy.js` a stub (simple counters / no-ops). `buy`/`sell`/`payBill` may bump counters. No prices, tokens, or persistence.

5. **Calendar.** Seeded weekday and weather, overridable with `?weekday=` and `?weather=`, exposed on `__life`. Use `deriveSeed` for life-on RNG. Existing M2 seek hours should still produce recognizable social beats where possible (9.021 Mabel/Bram greeting at the smithy; 12.021 Ada/Oswin plaza chat, Rowan shopping, Clover eating, Pip playing) or document new reproducible seek hours.

6. **Hooks already in play:** `__ready`, `__life` (`hour`, `setHour`, `timescale`, `activities()`). Keep them. Extend as needed (`__life.planner`, `__life.weekday`, `__life.weather`).

7. **Checks.** Life-off JSON hashes unchanged. `npm run test:checks` and `npm run test:parity` must pass. Add unit tests that contexts serialize, tools precheck failures, and the planner returns registered tool calls. Feet stay on the ground; do not spawn Edo characters into Willowmere.

## Shots

Add `tools/shots-village-life.mjs` and `npm run shots:village-life`. Same harness style as `tools/shots-village-m2.mjs` (Playwright, Vite preview, `/usr/bin/google-chrome`, SwiftShader, evidence, `--video-only` / `--stills-only`, ffmpeg 1280×720 yuv420p). Write to `shots/village-life/`.

**Video is required and must be ~20–30 seconds**, social interactions visible, a good camera path, **post stack ON** (do not use `post=0`). Also capture 4–6 stills of distinct beats (morning work, a meeting/greeting, a meal or shop, a relationship moment, evening/lamplight, maybe a weather or weekday variant).

## Docs

Write `docs/village/TOOLS.md`, `CONTEXT.md`, `PLANNER.md`, `ECONOMY.md` describing the finished hooks for a future LLM brain and token economy (interfaces only).

## Done means

Data-driven day-in-the-life for all 12, tools+context+scripted planner live, economy stub only, tests and hashes green, 20–30s video + stills on disk, docs written, local commit. Do not merge other worktrees and do not start unrelated milestones.
