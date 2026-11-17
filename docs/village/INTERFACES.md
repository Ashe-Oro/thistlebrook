# Willowmere shared interfaces

These stubs live on `main` so five parallel worktrees can code against the same contracts and merge later. Implementations fill in the stubs; they do not invent a second API.

**Hard rules for every worktree**

- Do not change default (life-off) `compileTown()` JSON. Frozen SHA-256 for hamlet/large seeds 1, 7, 1234 must stay byte-identical. Do not add fields to instances or to the top-level town object on the default path, and do not add checks to `validate()` that run when `life` is off.
- Do not git push, do not buy anything, do not call an LLM API, do not stand up an MCP server, do not implement a real token economy.
- Shared files may gain **one clearly marked hook line** per worktree, e.g. `// WORKTREE-HOOK registry`. Nothing more in those files.
- Licensed GLBs stay under gitignored `public/licensed/`.

## Modules (already on main as stubs)

| Module | Role |
| --- | --- |
| `src/world/registry.js` | World registry: places, queries, entry nodes |
| `src/life/tools.js` | Typed NPC actions (`walkTo`, `talkTo`, `work`, `buy`, `sell`, `payBill`, `rest`, `eat`, `visit`) |
| `src/life/context.js` | JSON-serializable NPC state |
| `src/life/planner.js` | `Planner.plan(context, world) -> {tool, args} \| null` |
| `src/life/economy.js` | Wallet/inventory no-op or simple counters |

## World registry

`buildWorldRegistry(town, catalog)` is called from the compiler **only** when `life` is on or an explicit `{registry:true}` option is set. Never attach `town.registry` on the default life-off path.

Place records include: unique `id`, `type`, human `name`, `owner` / `occupants` (NPC ids), `hours`, `points` (door/entry, seats, counters, beds, workstations, each with position and facing), `capabilities`, and `pos`.

Queryable API:

- `findPlace(registry, {type, capability, ownerId, openAt, near, name})` → places sorted by distance to `near` when given, each with its nearest entry node
- `getPlace(registry, id)`
- `interactionPoints(registry, placeId, kind)`
- `nearestEntryNode(registry, graph, placeId)`
- `connectRegistryToGraph(registry, graph, town, catalog)` adds reachable entry nodes onto the existing walk graph (same idea as stall-front spurs)

`walkTo('market')` / `walkTo({type:'bakery'})` / `walkTo({name:'The Gilded Goose'})` resolves through the registry to an entry node, then paths. No hardcoded world coordinates in the NPC tool layer.

Tags are **generated** from catalog/sidecar defaults plus placement. No hand-tagging per seed. New assets and new seeds pick them up automatically.

Validator (life/registry path only, also as tests): every **building** has at least one reachable entry node and occupant/hours/capabilities set; fail that compile/check otherwise. Life-off `validate()` stays untouched.

Canonical civic display names (catalog defaults, not per-seed tags; matches interiors work in flight): `cv-bakery` The Flour & Fern, `cv-tavern` The Copper Kettle, `cv-store` Willowmere Provisions, `cv-blacksmith` Bram's Workshop.

House catalog ids are reused; place ids must be unique (`place:house:<lot>` or similar).

## NPC tools, context, planner

The sim executes NPC behavior only via registered tools. Each tool has `name`, `argsSchema`, `resultSchema`, `precheck`, and `execute`, in one registry (`registerTool`).

`walkTo` must use the world registry (name/type/id → entry node → graph route). If the registry implementation is still a stub in this worktree, code against the interface and rebase after the registry branch merges.

Context (see `createNpcContext`) is fully JSON-serializable: job, personality, money, bills, obligations, assets, inventory, relationships, needs, schedule, location, current action, plus hour/weekday/weather.

`createPlanner()` returns `{ plan(context, world) }`. The day-in-the-life job ships a scripted planner that is fun to watch (routines, weekday/weather/random variation, meetings, dialogue, relationships, reactions). A future LLM brain replaces only the planner.

`createEconomy()` stays a stub: simple counters or no-ops. `buy` / `sell` / `payBill` may bump those counters; no prices, tokens, or persistence.

Document the finished tool registry, context schema, planner hook, economy hook, and world registry in `docs/village/` (owned by the implementing worktrees; this file is the contract).

## File ownership

| Worktree | Branch | Owns (create/edit freely) | Hook-only |
| --- | --- | --- | --- |
| `life` | `village/day-in-the-life` | `src/life/tools.js`, `context.js`, `planner.js`, `economy.js`, new routine/relationship/dialogue/calendar data, `docs/village/{TOOLS,CONTEXT,PLANNER,ECONOMY}.md`, `tools/shots-village-life.mjs`, `shots/village-life/` | `src/life/index.js`, `schedules.js`, `social.js`, `people.js`, `package.json`, `README.md`. Additive `life-routines` checks only. |
| `registry` | `village/world-registry` | `src/world/registry.js`, `src/catalog/places.js` (sidecar defaults), `src/life/registry-runtime.js` if needed, `docs/village/WORLD-REGISTRY.md`, registry tests | `src/compiler/compile.js` (life or `{registry:true}` only), `src/life/graph.js` or one line in `schedules.js` after the walk graph is built, `package.json`, `README.md`. Additive `world-registry` checks only. Do not change default `validate()`. |
| `buildings` | `village/building-variety` | New catalog/sidecar files, import scripts under `tools/`, `public/licensed/` downloads (gitignored), `docs/village` notes for new assets, optional `src/catalog/townsfolk-variants.js` | `src/catalog/catalog.js` (one spread/import), `package.json`, `README.md`. **Do not** change `districts.js` or default placement pools. New buildings appear only via new catalog entries plus an opt-in spec flag or life-only/runtime placement, never by altering frozen default layouts. |
| `lighting` | `village/lighting-polish` | New `src/life/sky.js`, `src/life/fog.js`, `src/life/lighting-polish.js`, additive `src/post/` helpers you create | `src/life/daynight.js` (one hook), `src/post/post.js` (one hook), `package.json`, `README.md`, `tools/shots-village-light.mjs`. Do not edit `dressing-runtime.js` or `atmosphere.js`. |
| `camera-ui` | `village/camera-ui` | New `src/life/interact-ui.js`, `src/life/hud.js` (clock/HUD/prompts), optional camera helpers you create | `src/life/camera.js` (one hook), `src/life/index.js` (one hook), `package.json`, `README.md`. Do not rewrite `social.js` (labels already live there); you may *call* a documented API or add a hook line. Do not edit interiors/doors. |

**Nobody edits:** the other worktrees' owned files; `/workspace/tailgate-games`; Thistlebrook; frozen fixtures under `tools/fixtures/`.

Parallel jobs already running outside this set (M3 interiors in `/workspace/cel-town-m3`, art polish in `/workspace/cel-town-art`) own `src/life/interiors.js`, `doors.js`, `src/catalog/interiors.js`, `src/life/dressing-runtime.js`, `src/catalog/townsfolk.js`, and `tools/generate-townsfolk.mjs`. Do not touch those.
