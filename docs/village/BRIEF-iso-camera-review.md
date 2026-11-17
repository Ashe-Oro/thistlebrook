# Review: Iso camera (P0–P3)

Work only in `/workspace/cel-town-wt/iso-camera` on branch `village/iso-camera`, already rebased onto main `9dfc5f0` and with day-in-the-life / props wired into `createIsoLife`. No purchases, git push, deploy, 4090, Claude, or Thistlebrook / tailgate-games. Local commits only if you fix P0/P1. Do not edit other worktrees or `/workspace/cel-town`.

Review against `docs/village/BRIEF-iso-camera.md`, `docs/village/BRIEF-iso-camera-polish.md`, `docs/village/BRIEF-iso-wire-life.md`, `docs/village/ISO-CAMERA.md`, and the iso reports under `out/`. Severity P0–P3. **Fix every P0 and P1.** Write `out/codex-village-iso-camera-review.md`. Approve only when no P0 or P1 remains.

## Must verify

- Life mode is iso-only (true ~35.264° `OrthographicCamera`, no walk/WASD/mouse-look). Pan/zoom-to-cursor, optional Q/E 90° snaps, hash `#x,z,zoom,h0`, bounds clamp, HUD, hover labels, click-to-peek, NPC follow card.
- Overview lighting is even (no black-green terrain, no disc-hills, no sky dome). Fog is not distance-based in ortho. Shadow frustum follows the view. Diorama island with soil/cliff sides.
- `installRoutines` and `createProps` actually run inside `createIsoLife` (not only in dead code after the early return in `index.js`). Seek at social hours should drive the 12 townsfolk through the tools layer. All existing `WORKTREE-HOOK` lines remain.
- Re-run `npm run test:checks`, `npm run test:parity`, `npm run test:world-registry`, `npm run test:medium`, `npm run test:life-routines`, and `node --test tests/life-iso.test.mjs`. Life-off hashes unchanged.
- Inspect stills under `shots/village-iso/` (overview, mid-zoom, close). Do not recapture the living-village film.

Do not merge into main. If you approve with only P2/P3 leftovers, say so clearly.
