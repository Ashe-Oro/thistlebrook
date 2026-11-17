# Review: art polish (P0–P3)

Work only in `/workspace/cel-town-art` on branch `village/art-polish`. Same rules: no purchases, no git push, no deploy, no licensed files outside `public/licensed/`, no 4090, no Claude, no Thistlebrook / tailgate-games. You may make local commits on this branch if you fix P0/P1. Do not edit other worktrees or `/workspace/cel-town`. Do not retry the Village Folk / christmas-folk download (known 404).

Review against `docs/village/BRIEF-art.md` and `out/codex-village-art-report.md`. Severity P0–P3. **Fix every P0 and P1**, recapture any affected shots/video under `shots/village-art/`, and write `out/codex-village-art-review.md`. Approve only when no P0 or P1 remains.

Play URL: `/?size=large&seed=1234&life=1`. Shots: `shots/village-art/{market-dressed,yards,townsfolk-lineup,night-atmosphere}.png` and `village-art.mp4`.

## What already looks solid (verify, don't redo)

- `market-dressed.png` and `yards.png` show denser props (crates, baskets, benches, carts, fences) that still read as the same cozy town.
- Night still keeps grass nocturnal with warm lamp pools and lit windows.
- Twelve townsfolk remain the same ids; wardrobe looks more distinct.
- Dressing is runtime-only (`dressing-runtime.js`); report claims life-off hashes unchanged and checks/parity green. Re-run those after any code change. Do not change compiled default JSON or `districts.js`.

## Findings to judge

- The final `townsfolk-lineup.png` (11:18) places all 12 on a flat studio void, not in Willowmere. An earlier in-street lineup was more useful as village proof. Recapture a **readable in-town lineup** (all 12 distinct, not buried in props) even if you leave the studio frame as an extra. Treat a missing or unreadable in-town lineup as P2 unless the characters themselves are broken (then P1).
- Check dressing doesn't overlap buildings/paths/fences, feet stay grounded, and no modern/out-of-style props slipped in.
- Video should orbit or move through the dressed town; confirm duration and that post is documented.

Do not start other milestones. Do not merge. If you approve with only P2/P3 leftovers, say so clearly and leave those documented.
