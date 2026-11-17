# Review: M4 interactive props (P0–P3)

Work only in `/workspace/cel-town-wt/props` on branch `village/m4-props`. No purchases, git push, deploy, 4090, Claude, or Thistlebrook / tailgate-games. Local commits only if you fix P0/P1. Do not edit other worktrees or `/workspace/cel-town`.

Review against `docs/village/BRIEF-props.md`, `docs/village/PROPS.md`, and `out/codex-village-props-report.md`. Severity P0–P3. **Fix every P0 and P1.** Write `out/codex-village-props-review.md`. Approve only when no P0 or P1 remains.

## Must verify

- Sit, well (draw water), stall buy via the tools layer, open/close doors on the existing interiors (no second interiors stack), and a visible inn mug/bowl are implemented. Seed 1234 large has no chapel; a runtime-only bell at a reachable registry point is acceptable.
- Place resolution and `walkTo` use the world registry — no hardcoded world coordinates. Economy stays a stub/counter. Life-off compiled JSON / frozen hashes unchanged.
- One marked hook per shared file (`index.js`, `interiors.js`, package.json, README). Do not rewrite files owned by other in-flight branches beyond those hooks.
- Re-run `npm run test:checks`, `npm run test:parity`, `npm run test:world-registry`, and `node --test tests/life-props.test.mjs`.
- Inspect stills under `shots/village-props/` (sit, well, stall-buy, door, and bell or inn-mug). This branch may still assume the older walk/E controls; do not require the iso camera here.

Do not merge into main. If you approve with only P2/P3 leftovers, say so clearly.
