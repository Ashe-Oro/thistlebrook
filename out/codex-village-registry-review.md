# World Registry review (P0–P3)

Reviewed 2026-11-16 on `village/world-registry`, implementation commit
`d136d7d2dfada58473029885750f7d6512471a45`, against
`docs/village/INTERFACES.md`, `docs/village/BRIEF-registry.md`, and
`out/codex-village-registry-report.md`.

## Decision

APPROVED. No P0, P1, P2, or P3 findings remain. No implementation fixes were
needed, and no local commit was made under the review's commit restriction.

## Verified behavior

- `buildWorldRegistry` derives every non-villager placement's metadata from
  `src/catalog/places.js`, resolved catalog overrides, placement transforms, and
  townsfolk assignments. There are no seed-specific tags. Unique place IDs use
  building lots or instance indices. Canonical civic names match the interface.
- `findPlace`, `getPlace`, `interactionPoints`, and `nearestEntryNode` are
  implemented. Filters, distance ordering, missing targets, transformed anchors,
  and opening hours have passing coverage. `resolvePlace` supports ID/name/type
  strings and query objects; tools can resolve a graph destination without world
  coordinate constants. NPC tool execution remains outside this branch's scope.
- Building entries connect to the existing graph with bidirectional spurs and
  collision-checked approaches. All buildings in large seeds 1, 7, 1234, and 19
  have routes from the existing connected component in both registry-only and
  life modes. Reconnection and graph rebuilding pass the dedicated tests.
- `registryFailures` checks metadata, placement coverage, building classification,
  entry/node position agreement, and actual edge reachability. The stale
  connected-list negative fails correctly. Vacant occupants are explicitly `[]`.
- Additional review experiment: overriding house entry anchors to their footprint
  centers causes both `{registry:true}` and `{life:true}` large seed-1 compiles to
  return `town.ok:false` and `town.report.ok:false`, with 21 unreachable-building
  failures each. Default compile with that same catalog still passes and has no
  registry. Direct `validate()` does not add a world-registry check, even when
  given an opt-in town.
- Compiler and graph integration use marked hooks. `src/compiler/checks.js` and
  frozen fixtures have no changes from the pre-implementation commit.
- `docs/village/WORLD-REGISTRY.md` matches implementation, including anchor
  transforms, query semantics, vacant properties, optional unresolved props,
  navigation search limits, and semantic interior affordances. Hamlet `life:true`
  remains the pre-existing no-op required by parity; hamlet registry uses explicit
  `{registry:true}`. This documented compatibility exception is not a blocker.

## Validation

- `npm run test:world-registry`: PASS, 11/11 tests. Includes new seed 19, future
  catalog assets, sealed entries, metadata negatives, and default isolation.
- `npm run test:checks`: PASS; intentional breaks caught and batch/runtime
  geometry checks passed.
- `npm run test:parity`: PASS, exit 0. Full JSON matches across Node/Vite in
  forward/reverse runs for 31 hamlet seeds and four large seeds, including seed
  19, plus variants; the one-ULP math perturbation pass also succeeds.
- `git diff --check`: PASS before report creation; repeated after writing.

Independent SHA-256 calculation of complete default life-off compile JSON:

| Spec | Seed | SHA-256 | Frozen fixture |
| --- | --- | --- | --- |
| hamlet | 1 | `298ce18a20d64e3937782c459c02bacd743f8363aa892c0b224ab5d3eabf711c` | MATCH |
| hamlet | 7 | `6fa8e8ef35cb7bcc65bde159a68e820be7947ce925749063d1372a3255186670` | MATCH |
| hamlet | 1234 | `6b63379057bf8b8bd5b7c1e9b94df62a902177e89ec48e3ec2bc8bb9d60b1d5d` | MATCH |
| large | 1 | `af385e77f92655f40d9aea9356b4aecea7e72677488a3bbfb2c34f526716eac3` | MATCH |
| large | 7 | `2e34f0ef4bb8fea5d30f896519d3a8691b34fc88209d2bbcbb827c5ce191c719` | MATCH |
| large | 1234 | `884c24dcf270e07a2625995c74e587f602e2d299d7d6a4839cd2d5ef811bd6c2` | MATCH |
| hamlet | 19 | `39e5c047b53d67da2d5c32baf4f503d078f25bb574aa1fe8c0bd506d3a2ba210` | No fixture exists |
| large | 19 | `7a54025af7fea68be84327ec24b060cade5257760cb1bea1fb8887c7e443be01` | No fixture exists |

All eight default towns have neither `town.registry` nor a world-registry report
check. The six frozen comparisons use
`tools/fixtures/pre-villagers-defaults.sha256.json`; seed 19 cannot be claimed as
a frozen-fixture match because the repository has no seed-19 fixture.

## Scope

Only this review report was written. Existing untracked files were left alone.
No other worktrees were edited; no purchases, pushes, deployments, merges, GPU
jobs, or external model/API calls were performed.
