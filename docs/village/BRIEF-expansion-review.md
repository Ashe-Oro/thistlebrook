# Review: Medium-size village expansion (P0–P3)

Work only in `/workspace/cel-town-wt/expansion` on branch `village/medium-expansion`. No purchases, no git push, no deploy, no 4090, no Claude, no Thistlebrook / tailgate-games. Local commits on this branch only if you fix P0/P1. Do not edit other worktrees or `/workspace/cel-town`.

Review against `docs/village/BRIEF-expansion.md` and `out/codex-village-expansion-report.md`. Severity P0–P3. **Fix every P0 and P1.** Write `out/codex-village-expansion-review.md`. Approve only when no P0 or P1 remains.

## Must verify

- Medium is a **new** spec (`specs/medium.json` / `compileMedium`), not a change to frozen hamlet or large layouts. Default omitted-`size` behavior in life mode must stay as it was (do not silently switch the default to medium if that would break checks or hashes).
- Play URL `/?size=medium&seed=1234&life=1` produces a denser town: more homes than large, a chapel/landmark, farms/fields, and a river/stream with a reachable bridge. Seed 1234 is the recommended demo seed.
- Re-run `npm run test:checks`, `npm run test:parity`, and `npm run test:world-registry` (and `test:medium` if present). Hamlet/large life-off hashes for seeds 1, 7, 1234 (and 19 if tested) must still match fixtures. The medium compiler hook in `compile.js` must not mutate the default life-off `validate()` path or compiled JSON of hamlet/large.
- Registry/life hooks already on main stay intact. One marked `WORKTREE-HOOK` line per shared file.
- Inspect the captured stills under `shots/village-medium/` (overview, farms, river-bridge, chapel): they should clearly show those features, not an empty field or a broken river join.

Do not merge into main. If you approve with only P2/P3 leftovers, say so clearly.
