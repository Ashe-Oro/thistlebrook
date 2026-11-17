# Review: Village playtest bug-hunt (P0–P3)

Work only in `/workspace/cel-town-wt/playtest` on branch `village/playtest`. No purchases, no git push, no deploy, no 4090, no Claude, no Thistlebrook / tailgate-games. Local commits on this branch only if you fix P0/P1. Do not edit other worktrees or `/workspace/cel-town`.

Review against `docs/village/BRIEF-playtest.md` and `out/codex-village-playtest-report.md`. Severity P0–P3. **Fix every P0 and P1.** Write `out/codex-village-playtest-review.md`. Approve only when no P0 or P1 remains.

## Must verify

- Assigned leftovers: the faint duplicate interior room-name sign is gone (PT-01), and name/speech labels no longer draw through scenery (PT-02). Inn mug/bowl belongs to props and must stay untouched.
- One marked hook in `src/life/social.js` (occlusion helper); interiors change is minimal and does not rewrite the interiors stack. Do not regress enter/exit, lantern, or stall prompts.
- Re-run `npm run test:checks`, `npm run test:parity`, and `npm run test:world-registry`. Life-off hashes for hamlet/large seeds 1, 7, 1234 (and 19 if tested) must still match fixtures. Also run `node --test tests/life-playtest-social.test.mjs` if present.
- Inspect proof stills under `shots/village-playtest/` (interior-sign, labels-wall / labels, and a social/walk view). The implementation report may list P3 leftovers; those do not block approval.

Do not merge into main. If you approve with only P2/P3 leftovers, say so clearly.
