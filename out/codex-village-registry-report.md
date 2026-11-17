# Living Village — World Registry report

Implemented on `village/world-registry` in `/workspace/cel-town-wt/registry`.

- Generated metadata for every non-NPC placement: unique placement IDs, semantic
  types, civic display names, owners/occupants, hours, capabilities, and transformed
  interaction anchors. Catalog defaults cover new assets/seeds automatically.
- Implemented all registry stubs, plus `resolvePlace`, `isOpen`, and
  `registryFailures`. Queries resolve name/type/ID to graph entry nodes for the
  dependent NPC tool layer; no NPC planner/tool files were changed.
- Connected entries with collision-checked bidirectional spurs and footprint-corner
  detours, including farm outbuildings. Reconnection is idempotent; graph rebuilding
  refreshes entry node IDs. Sealed entries fail instead of snapping through walls.
- Added one compiler hook and one graph hook (and their imports), plus the
  `test:world-registry` npm script. Default validation and instances remain unchanged.
- Added `docs/village/WORLD-REGISTRY.md` with schema, query semantics, navigation
  integration, defaults, examples, and limitations.

Validation:

- `WORLD_REGISTRY_DUMP=1 npm run test:world-registry`: **11 tests passed**.
  Large seeds 1, 7, 1234, and 19 pass in both life and explicit-registry modes.
  Coverage includes query filters/distance ordering, assigned occupants, overnight
  hours, JSON round trips, graph rebuilding, scaled/rotated future assets, repeated
  house IDs, multiple anchors, enclosed entries, metadata/coverage negatives, stale
  connected lists, and opt-in compile failures.
- `npm run test:checks`: **passed** (all intentional breaks caught; batch/runtime
  geometry checks passed).
- `npm run test:parity`: **passed**. All six frozen hamlet/large default hashes
  remain intact. Full JSON matches across Node/Vite and the one-ULP math
  perturbation pass (31 hamlet seeds and 4 large seeds, plus variants).
- `git diff --check`: passed.

Evidence: `out/registry-1234.json` contains seed-1234 life metadata for **755 places,
41 buildings**, all 41 buildings with reachable entries; graph has **5,599 nodes**,
all connected. The generated JSON stays local under ignored `out/`; this report
is committed explicitly.

Compatibility details:

- Registry attaches only for effective district life mode or `{registry:true}`.
  Existing hamlet `life:true` behavior is deliberately still a no-op: the unchanged
  parity suite requires this. Explicit `{registry:true}` enables hamlet registry.
- Vacant/unassigned properties use `owner:null, occupants:[]`; no invented NPCs.
  Existing townsfolk work defaults and assigned home/workplace lots supply occupants.
- Interior affordances are semantic anchors; this branch does not create interior
  furniture or interior navigation. Non-building props/zones may return entry node
  `-1` if no clear local approach exists; all buildings must resolve.
- Navigation searches roads within 64m for buildings, with local detour corners
  within 24m; prop approaches are direct and limited to 12m. Unreachable buildings
  fail the dedicated compile check.

No other worktrees, forbidden owned files, frozen fixtures, or licensed assets
were edited. No purchases, pushes, deployments, external APIs, or model calls were
made. Pre-existing untracked runtime/artifact files were left alone.
