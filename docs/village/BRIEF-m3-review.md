# Review: M3 interiors (P0–P3)

Work only in `/workspace/cel-town-m3` on branch `village/m3-interiors`. Same rules as the implementation brief: no purchases, no git push, no deploy, no licensed files outside `public/licensed/`, no 4090, no Claude, no Thistlebrook / tailgate-games. You may make local commits on this branch if you fix P0/P1. Do not edit other worktrees or `/workspace/cel-town`.

Review M3 against `docs/village/BRIEF-m3.md` and the implementation report `out/codex-village-m3-report.md`. Severity P0–P3. **Fix every P0 and P1**, recapture any affected shots/video under `shots/village-m3/`, and write `out/codex-village-m3-review.md`. Approve only when no P0 or P1 remains.

Play URL: `/?size=large&seed=1234&life=1`. Enter with E at bakery/inn/store/smithy doors; lanterns toggle; `?interior=bakery` if implemented. Shots: `shots/village-m3/{bakery,inn,store,smithy,doorway,lantern}.png` and `village-interiors.mp4`.

## What already looks solid (verify, don't redo)

- Bakery “The Flour & Fern” reads as a furnished toon room: shelves, loaves, hearth fire, barrel, sacks, counter.
- Inn “The Copper Kettle”, store “Willowmere Provisions”, and “Bram’s Workshop” exist with tables/books/anvil and hearths.
- Doorway shot looks back through a real door opening with “E · Return to Willowmere”.
- Lantern fixture is a visible lantern, not a bare orb.
- Report claims keyboard entry/exit, indoor collision, eight lanterns, life-off hashes unchanged, checks/parity green. Re-run `npm run test:checks` and `npm run test:parity` after any code change. Do not break default life-off compile JSON.

## Findings to judge

- A faint second title/sign is visible through/under the room title in bakery/inn/store stills (world-space sign stacking with the HUD). Promote to P1 only if it is unreadable clutter or a broken overlay; otherwise P2.
- The compile-page “Look” dropdown is still in interior stills. P3 unless it breaks the shot.
- Confirm the player cannot get stuck, walls hold, doorway is the hole, and `?interior=` / `__life.interior` work.
- Video is 12s; confirm it actually shows street approach, entry, an interior, and lantern or exit. Post may be off for video (document if so).

Do not start other milestones. Do not merge. If you approve with only P2/P3 leftovers, say so clearly and leave those documented.
