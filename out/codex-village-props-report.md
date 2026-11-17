# Living Village M4 — interactive props

Branch: `village/m4-props`, worktree `/workspace/cel-town-wt/props`.
Play URL: `/?size=large&seed=1234&life=1`.

Implemented in the new `src/life/props-interact.js` module:

- E rests the player on a registry seat; E or WASD stands again. A private mesh copy bends the rigid player's hips/knees without changing shared licensed character assets.
- E at a well draws water, increments the actor's water counter, and displays a held pail.
- Seed 1234 has no chapel/bell. A modest brass town bell is built only at runtime beside the Village Green's reachable registry entry. E swings it and synthesizes a short chime (visual feedback remains in muted Chrome).
- E buys market produce through `executeTool('buy', ...)`, resolving the registry place and checking hours/distance. Inventory counters only; no economy module changes.
- Typed open/close actions operate all four existing civic rooms (bakery, inn, store, smithy), reusing their entry/exit fades. Paneled door leaves visibly swing. E at the exit closes/returns; O offers the same typed door action.
- Handled teal mugs, tea and soup bowls are visible on the inn tables; E beside the left table records a meal.
- `__life.props` exposes actor counters, candidates, JSON-safe inspection, tool history, runtime props and registry-based `walkTo`. Routes use registry entry nodes and are followed waypoint by waypoint. Invalid/disconnected routes fail.

The props module registers schemas/prechecks/results through the existing tools registry. Existing canonical definitions are preserved; fallback `walkTo`, `buy` and `eat` fill the current branch's stubs. Other actor contexts receive serializable action and counter results; their owning simulation drives their meshes. Integration details and controls are in `docs/village/PROPS.md`.

Ownership: one marked initialization hook in `src/life/index.js`, one marked action delegation hook in `src/life/interiors.js`, one npm capture script, one README addition. No registry, compiler, planner, economy, camera, atmosphere or default-layout changes. No other worktrees edited, merges, purchases, pushes or deployments.

Validation:

- `npm run test:checks` — passed.
- `npm run test:parity` — passed: six frozen life-off hashes unchanged; large seeds and 31-seed Vite/Node agreement, including math perturbation.
- `npm run test:world-registry` — passed.
- `node --test tests/life-props.test.mjs` — passed: real compiled registry routes, guards/counters, missing/disconnected destinations and preservation of pre-existing tool definitions.
- `npm run build` — passed (existing large-bundle advisory only).

Evidence: `tools/shots-village-props.mjs` / `npm run shots:village-props` uses local Chrome with ANGLE/SwiftShader and post on for stills. The harness stages actors using registry/room points, presses E, asserts results, and audits all four door transitions. Final captures and recording details are listed in `shots/village-props/evidence.json`.

The six frozen hashes are also recorded in `shots/village-props/life-off-hashes.json`. Capture batches support `--part=outdoor`, `--part=indoor` and `--part=video` so local process interruptions do not discard completed evidence.

Evidence gallery: [bench](../shots/village-props/sit.png), [well](../shots/village-props/well.png), [stall purchase](../shots/village-props/stall-buy.png), [door](../shots/village-props/door.png), [bell](../shots/village-props/bell.png), [inn mug](../shots/village-props/inn-mug.png). Recording: [8-second well/bell tour](../shots/village-props/village-props.mp4).

Recording capture uses 640×360 at 6 fps with distant props culled beyond 26m for SwiftShader performance. All six stills use the full town at 1280×720 with post enabled.

Final artifact audit passed: six 1280×720 PNGs; 8-second H.264/yuv420p MP4, 48 frames at 640×360; both recorded tools returned success; all four civic door audits passed; zero runtime errors. Temporary recording frames were removed. Local capture stages exited successfully.
