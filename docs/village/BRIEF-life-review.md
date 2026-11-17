# Review: Day-in-the-life + seek fix (P0–P3)

Work only in `/workspace/cel-town-wt/life` on branch `village/day-in-the-life`, already rebased onto current main (expansion + playtest). No purchases, git push, deploy, 4090, Claude, or Thistlebrook / tailgate-games. Local commits only if you fix P0/P1. Do not edit other worktrees or `/workspace/cel-town`.

Review against `docs/village/BRIEF-life.md`, `docs/village/INTERFACES.md`, `out/codex-village-life-report.md`, and `out/codex-village-life-seek-fix.md`. Severity P0–P3. **Fix every P0 and P1.** Write `out/codex-village-life-review.md`. Approve only when no P0 or P1 remains.

## Must verify

- All 12 townsfolk have tool-driven routines; behavior goes through the tools registry (`walkTo` resolves via the world registry, no hardcoded coordinates). The post-rebase seek fix keeps `people.seek` consistent with registry entry nodes; the original non-walking assertion was not weakened.
- No LLM calls, no MCP server, no token economy. Context is JSON-serializable. Life-off hashes unchanged.
- Existing hooks remain: art, interiors, medium, playtest occlusion, and the life-routines hooks. Do not drop any.
- Re-run `npm run test:life-routines`, `npm run test:checks`, `npm run test:parity`, and `npm run test:world-registry`.

Do not merge into main. If you approve with only P2/P3 leftovers, say so clearly. Do not recapture the living-village video (iso recapture comes later).
