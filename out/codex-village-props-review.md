# M4 interactive props review

Verdict: **APPROVED with P2/P3 leftovers. No P0 or P1 remains.**

Reviewed on 2026-11-16 in `/workspace/cel-town-wt/props`, branch
`village/m4-props`, HEAD `d9a0d20986ab29751706373bb63b2a3856a84777`.
Scope: `BRIEF-props.md`, `PROPS.md`, the implementation report, branch diff
against `main`, tools/tests, and all six supplied stills. The older walk/E
controls are accepted; an iso camera is outside this review.

## Findings

- **P2 — NPC proximity depends on the player's current room.**
  `src/life/props-interact.js:105` selects the room-local approach using
  `api.interior`, without receiving the acting context. The shared precheck at
  lines 25–26 uses that approach for NPC callers too. When the player enters the
  inn, an NPC still standing at its exterior trigger changes from being in range
  for `openDoor` to being rejected as too far away. Conversely, the NPC's own
  interior location cannot select its approach independently. Pass the actor to
  the approach adapter and distinguish player room state from NPC location.
  This does not block the demonstrated player interactions; it is an NPC
  integration edge case in the documented external actor adapter.
- **P3 — The package hook lacks an explicit marker.** `package.json:21` adds
  exactly one namespaced `shots:village-props` script, but no `WORKTREE-HOOK`
  marker. The index, interiors, and README additions each have one explicit
  props marker. Ownership scope is otherwise respected. If literal marking is
  required in JSON, put a shell-compatible marker in this existing script value
  rather than adding another shared-file hook or invalid JSON comments.
- **P3 — Two interaction prompts can appear together.** The props prompt at
  `src/life/props-interact.js:135` coexists with the existing interiors prompt
  (`src/life/interiors.js:201`). `stall-buy.png` displays both the successful
  purchase and “E · Browse market stall”; `door.png` similarly combines the
  props result with the original exit prompt. Prefer a single prompt owner when
  props handles the action, through the permitted hook. Actions still execute
  through the typed tool path.

No P0/P1 fixes were necessary. Implementation files were left unchanged; no
local commit was made, as commits are authorized only for P0/P1 fixes.

## Required behavior and boundaries

- Sit, draw water, buy, ring bell, open/close, and eat register through the
  existing `registerTool`/`executeTool` layer. Guards check kind, proximity,
  stall hours, and transition availability. Counters remain in actor state;
  there are no prices, payments, persistence, or economy-module changes.
- `walkTo` resolves registry ID/name/type/query, selects `nearestEntryNode`, and
  routes through the existing graph. Player movement follows graph waypoints.
  Outdoor interaction positions come from registry points or the existing
  interiors' triggers. Bell placement is an offset from a registry entry;
  furniture coordinates are room-local, not hardcoded outdoor destinations.
- A fresh seed-1234 large life compile contains **zero chapels**. The runtime
  bell uses `place:plaza:instance:0` (Village Green), whose reachable entry is
  graph node 1320. It adds meshes without mutating compiled instances/registry.
- Doors attach paneled leaves to the existing four room groups and call the
  existing `interiors.enter`/`exit` fade API. There is no second interiors stack.
  Supplied evidence audits bakery, inn, store, and smithy open/close transitions.
- Visually inspected `sit.png`, `well.png`, `stall-buy.png`, `door.png`,
  `bell.png`, and `inn-mug.png`: seated player, well/pail, stall purchase feedback,
  entered doorway, modest bell, and clearly handled teal mugs/bowls are visible.
  All six are 1280×720. Stored evidence reports post enabled for stills and zero
  runtime errors; evidence records successful typed actions and counter changes.
- The diff has one small props hook in index, interiors, package, and README;
  the explicit package-marker exception is listed above. No changes to other
  branches' owned compiler, registry, tools, economy, planner, camera, or other
  protected modules, and no frozen-fixture changes.

## Verification rerun

- `npm run test:checks` — PASS, negative checks and batch/runtime geometry checks.
- `npm run test:parity` — PASS, all six frozen life-off hashes, 31 hamlet seeds
  and four large seeds in forward/reverse order, including one-ulp math
  perturbation and opt-in variants.
- `npm run test:world-registry` — PASS, 11 tests.
- `node --test tests/life-props.test.mjs` — PASS, 5 tests.
- `npm run build` — PASS, existing bundle-size advisory only.
- Fresh local Chrome/ANGLE/SwiftShader browser check against that build — PASS:
  real E input for sit/stand, draw water, buy, ring bell, and open/close of all
  four rooms. Water/produce counters incremented; zero page errors. Staging
  positions came from registry approaches and existing room triggers. Existing
  stills/evidence were preserved.
- Saved `shots/village-props/life-off-hashes.json` exactly matches all six
  frozen fixture entries. `git diff --check` passes.

Work stayed in this worktree. No merge, push, deployment, purchase, external
model call, or edits to other worktrees were performed.
