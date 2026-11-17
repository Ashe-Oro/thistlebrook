# Review: World Registry (P0–P3)

Work only in `/workspace/cel-town-wt/registry` on branch `village/world-registry`. No purchases, no git push, no deploy, no 4090, no Claude, no Thistlebrook / tailgate-games. Local commits on this branch only if you fix P0/P1. Do not edit other worktrees or `/workspace/cel-town`.

Review against `docs/village/INTERFACES.md`, `docs/village/BRIEF-registry.md`, and `out/codex-village-registry-report.md`. Severity P0–P3. **Fix every P0 and P1.** Write `out/codex-village-registry-review.md`. Approve only when no P0 or P1 remains.

## Must verify

- `buildWorldRegistry` is generated from catalog/sidecar defaults plus placement (no per-seed hand tags). New seeds get tags automatically.
- Query API: `findPlace`, `getPlace`, `interactionPoints`, `nearestEntryNode`. `walkTo` resolution helpers exist and do not hardcode world coordinates.
- Entry nodes are connected to the existing walk graph and are reachable for every **building**. Validator fails the life/`{registry:true}` path otherwise, and must **not** run on default life-off `validate()` or change frozen compile JSON.
- Re-run `npm run test:checks` and `npm run test:parity`. Confirm hamlet/large life-off hashes for seeds 1, 7, 1234 (and 19 if tested) still match fixtures.
- Docs in `docs/village/WORLD-REGISTRY.md` match the implementation.

Do not merge into main. If you approve with only P2/P3 leftovers, say so clearly.
