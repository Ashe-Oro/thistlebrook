# Day-in-the-life + seek fix review

Date: 2026-11-16. Reviewed HEAD `ddea784` on `village/day-in-the-life`, including implementation `dc2892e` and seek fix `b7cbd2a`, against `docs/village/BRIEF-life.md`, `docs/village/INTERFACES.md`, `out/codex-village-life-report.md`, and `out/codex-village-life-seek-fix.md`.

**APPROVED with P2/P3 leftovers only. No P0 or P1 remains.** No implementation fixes or local commits were necessary. Approval covers the routine/tool and seek integration; the presentation limitations below remain visible.

## Findings

- **P2 — Shared destinations collapse resident spacing.** `src/life/routines.js:43–47` replaces each participant's spaced node with the same place's single nearest entry node. The earlier spacing at line 21 and paired reservation slots consequently disappear. Reproduce with `/?size=large&seed=1234&life=1&weekday=wed&weather=clear`, then `__life.setHour(12.021)`: eight residents share the tavern destination, while Ada, Oswin, and Pip share the plaza destination. At 16.5, eleven residents share the plaza node; at 18.75, all twelve share the tavern node. Confirmed using actual browser contexts and rendered scene roots, rather than just schedule tables. Actions and seeks complete, but overlapping characters obscure the social scenes. Follow-up: retain registry-based arrival while providing collision-free participant slots or visual spacing derived from world navigation. Add a distinct-position check to capture assertions; present assertions check feet/building intersections, not resident overlap. This is a presentation defect, not a failed route, missing resident, or incomplete tool action.
- **P3 — Integration documentation still describes the pre-rebase adapter.** `docs/village/TOOLS.md:18` says the registry is empty and owned destinations still need binding; the current implementation already binds them. `docs/village/PLANNER.md:23` says added meetings reuse plaza slots, but registry binding now sends rivalry to the market and family supper to the tavern. Update these descriptions to match the seek fix and distinguish historical capture evidence from current runtime behavior.

## Required verification

- **All twelve residents:** `data/routines.js` supplies twelve role profiles and daily/role/weather/weekday tables. `routine-runtime.js` creates twelve contexts, invokes `planner.plan`, and routes resulting behavior through `executeTool`. The nine tools are registered with argument/result schemas, prechecks, and execution. Legacy passing greetings are suppressed from rendering by the life-routines social hook; routine and player actions use registered tools.
- **Registry movement:** `destinations.js` resolves IDs, catalog IDs, names, and types through `getPlace`, `findPlace`, and `nearestEntryNode`, then checks graph connectivity and routes. No world coordinates are embedded in the tool layer. A populated registry cannot fall back to symbolic schedule nodes. Home/work bindings preserve assigned catalog ID and lot identity.
- **Seek fix:** the runtime installs the registry-resolved node as the people's schedule goal before calling the original `people.seek`, synchronizes actual positions, then executes the arrived action. Compared the original implementation test with the current test: `assert(first.every(c=>c.currentAction&&c.currentAction.tool!=='walkTo'))` remains intact. Added assertions strengthen coverage of registry entry positions, owned home/work destinations, installation, and every routine boundary.
- **Local browser check:** Vite source server plus local Chrome/SwiftShader, large seed 1234, Wednesday/clear, post stack enabled. At 38 distinct routine boundaries, all twelve contexts had completed non-walking actions, locations equaled their destination graph positions, and repeated seeks produced identical serialized contexts. Zero page errors. Existing greeting, plaza chat, shopping, meal, play, relationship, and lamplighter beats remain available. This checks actual `createPeople` integration in addition to the unit test's people adapter. It does not certify visual spacing or recapture the film.
- **Serializable state and economy:** context round-trip tests pass; browser context serialization succeeds. Source inspection finds no LLM/network brain, MCP server, or token economy in the added life modules. Economy remains three intent counters, zero wallet, and empty inventory; no prices or persistence.
- **Hooks preserved:** the branch diff adds one life-routines line in each of `index.js` and `social.js` and adds its package scripts. Existing art and interiors hooks remain in `index.js`; medium selectors/compiler/package hooks remain; playtest `filterSocialText` still runs before overlap culling. Registry, compiler, catalog, people, schedules, day/night, post, README, and frozen fixtures have no branch changes relative to main.
- **Life-off stability:** parity checks retain the frozen hamlet/large SHA-256 fixtures for seeds 1, 7, and 1234, plus the original hamlet-1234 fixture. All pass; fixtures were not edited.

## Checks rerun

| Command | Result |
| --- | --- |
| `npm run test:life-routines` | PASS, 8/8 |
| `npm run test:checks` | PASS, negatives, batches, medium seeds 1/7/1234 and browser/Node full JSON parity |
| `npm run test:parity` | PASS, 31 hamlet seeds and four large seeds forward/reverse, variants, frozen hashes, and one-ulp perturbation |
| `npm run test:world-registry` | PASS, 11/11 |
| `node --test tests/life-playtest-social.test.mjs` | PASS, 4/4, including isometric occlusion |
| `git diff --check` | PASS |

Work was confined to `/workspace/cel-town-wt/life`. Only this review report was added. Existing untracked launcher/dependency/licensed-asset entries were left alone. No merge, push, deployment, purchase, external model call, GPU service, or living-village video recapture was performed.
