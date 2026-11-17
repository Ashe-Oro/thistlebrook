# Iso day-in-the-life wiring

Implemented on `village/iso-camera` in `/workspace/cel-town-wt/iso-camera`.

The iso startup path now installs routines after publishing `window.__life` and before its initial `setHour`, so both initial placement and later seeks use the wrapped people runtime. Props install immediately after the existing interiors call. Atmosphere and all requested WORKTREE-HOOK markers remain; art, interiors, routines, and props markers now sit beside their live iso calls. Removed the unreachable walk-camera implementation from `index.js` and left a pointer to the iso hooks.

`createProps` previously dereferenced `camera.player` immediately, which iso intentionally does not provide. Iso now receives the shared room doors, handled mugs/soup, and town bell, plus `api.props` inspection, and returns before walking-player geometry, input handlers, prompts, or camera updates are installed. Player-operated prop actions remain limited to the walking implementation; this change does not add a walking rig or WASD controls to iso. Routine tools retain their canonical implementations.

The existing iso API fields remain: `mode`, `camera`, `hud`, `step`, `setHour`, `setTimescale`, and `activities`; routine context/planner helpers are added to that same object.

## Validation

All required commands passed:

- `npm run test:life-routines` — 8 tests.
- `npm run test:checks` — negative checks, batches, and medium checks.
- `npm run test:parity` — normal Vite SSR and one-ulp math perturbation; full JSON parity.
- `npm run test:world-registry` — 11 tests.
- `npm run test:medium` — seeds 1, 7, 1234 and browser/Node parity.
- `node --test tests/life-iso.test.mjs` — 4 tests.

`npm run build` also passed, with Vite warnings about the existing mixed static/dynamic iso-interact import and a large bundle.

Added `tools/check-iso-life.mjs`, run with `node tools/check-iso-life.mjs` after building. It launches local Chrome using SwiftShader and checks the actual built startup path for both large and medium seed 1234, Wednesday/clear weather. No film or screenshots are captured.

Browser evidence for both village sizes:

| Hour | Social activities | Townsfolk tools |
| --- | --- | --- |
| 9.021 | greet, chat | talkTo, work, rest |
| 12.021 | chat, shop, eat, play | eat, talkTo, buy, visit |

All 12 townsfolk have completed tool actions at startup and on seeks. Repeated seeks produce identical contexts, and events refer to the tool-driven residents. The check also verifies four installed room doors, the inn meal and bell, a successful inn peek/exit, a retained orthographic camera/HUD/API, no walking player, unchanged view after W/Tab input, and no browser errors.

Life-off compiler hashes remain equal to the frozen fixtures in `tools/fixtures/pre-villagers-defaults.sha256.json` (hamlet and large, seeds 1/7/1234) and `tools/fixtures/hamlet-1234.sha256`, enforced by the parity check. Compiler/spec/catalog files and hash fixtures were not changed.

No living-village film was recaptured. Existing untracked session files, dependencies, and licensed assets were left out of the commit. Work is local only; no merge, push, or deployment.
