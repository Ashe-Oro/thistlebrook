# Visual fix pass for the large town (seed 1234)

I rendered `/?size=large&seed=1234` (overview persp/iso plus close market and farm shots). The town structure is good: plaza, residential grid, market (blacksmith / market hall / windmill), farm outskirts (barn, farmhouse, silo, animals, crops). No obvious floating buildings. Default hamlet must stay byte-identical for seed 1234 (cmp against out/baseline/town-1234.json). Do not weaken hard checks.

Please fix these obvious dressing problems in the large preset only:

1. **Wrong ground props.** `cv-window-box`, `cv-shop-hanging-sign`, and `cv-birdhouse` are scattered on open grass (14/14/12 instances, almost all district `dressing`). They look like they belong on building walls, not as lawn ornaments. Remove them from the generic ground-dressing pick pool. If you still place them, snap them to house/landmark walls; otherwise just don't place them in the large town.

2. **Orphan fence bits.** `farm-rail-fence` (6) and `farm-drystone-wall` (4) are being placed as short isolated prop segments in the farm field (visible in the farm close-up). Do not scatter fence modules as props. Either omit them from dressing, or place them as real continuous fence runs.

3. **Random field clutter.** The plaza/market approaches are over-scattered with notice boards, directional posts, laundry lines, benches sitting in open grass not along a street, and hanging signs. Keep dense dressing, but place it with intent: lamps and benches along streets, stalls/crates/barrels/carts in the market, farm props in the farm district, flowers/rocks in woodland/yards. Reduce unscoped `dressing` field scatter, especially civic signage in the middle of lawns.

4. Do not retune hamlet. Keep `npm run test:checks` and `npm run test:parity` green. Recompile `--size large --seed 1234`. If placement rules change, rerun a large sweep (20 seeds is enough if 50 is slow) and keep after-retry pass rate high. Update `out/codex-large.md` with what changed and new seed-1234 counts.

No screenshots needed (I will rerender). No git push, no deploy, no buying, no licensed files outside public/licensed/.
