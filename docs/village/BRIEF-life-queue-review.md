# Review: Life arrival queue slots (P0–P3)

Work only in `/workspace/cel-town-wt/life-queue` on branch `village/life-queue`, based on main `9dfc5f0`. No purchases, git push, deploy, 4090, Claude, or Thistlebrook / tailgate-games. Local commits only if you fix P0/P1. Do not edit other worktrees or `/workspace/cel-town`. Do not merge.

Review against `docs/village/BRIEF-life-queue.md` and `out/codex-village-life-queue-report.md`. Severity P0–P3. **Fix every P0 and P1.** Write `out/codex-village-life-queue-review.md`. Approve only when no P0 or P1 remains.

## Must verify

- When two or more residents seek the same registry place, they occupy distinct world positions (no stacking on a shared entry node). Slots are deterministic for a given seed/hour/ids, stay on walkable ground, stay out of building footprints, and remain close enough for greetings, chats, shopping, meals, and kids playing to still trigger.
- `walkTo` still resolves through the world registry (no hardcoded world coordinates). Frozen life-off hamlet/large hashes are unchanged. Compiler, catalog, iso camera, and props stack are not rewritten.
- Shared files keep a single marked `// WORKTREE-HOOK` line each.
- Re-run `npm run test:life-routines`, `npm run test:checks`, `npm run test:parity`, and `npm run test:world-registry`.
- Inspect stills under `shots/village-life-queue/` if present.

Do not merge into main. If you approve with only P2/P3 leftovers, say so clearly.
