# Fix P2: residents stack at a shared entry node

You are in git worktree `/workspace/cel-town-wt/life-queue` on branch `village/life-queue`, based on main `9dfc5f0`. Do not edit other worktrees or `/workspace/cel-town`. No purchases, git push, deploy, 4090, Claude, or Thistlebrook / tailgate-games. Local commits only. Do not merge.

## Problem

The day-in-the-life review (`out/codex-village-life-review.md` on main) approved with a P2 leftover: when several townsfolk share a destination, they all occupy the same registry entry node and visually stack. Review notes mentioned eight at lunch, eleven at the afternoon plaza, and all twelve at family supper.

## Fix

Spread arrivals around the place instead of stacking on one node. Give each reserved/occupying resident a stable queue slot offset from the entry (a small ring, a frontage line, or slots along the approach path — pick what reads clearly in a toon village). Slots must be deterministic for a given seed/hour/ids, stay on walkable ground, not sit inside building footprints, and remain close enough for greetings, chats, shopping, meals, and kids playing to still trigger.

`walkTo` must keep resolving through the world registry (no hardcoded world coordinates). Do not change compiled life-off JSON or frozen hashes. Prefer edits in `src/life/routine-runtime.js`, `people.js`, `destinations.js`, or a new helper under `src/life/` with one marked hook in each shared file you must touch. Do not rewrite the iso camera, compiler, catalog, or props stack.

Add a focused test that two or more residents seeking the same place do not share the same world position.

## Checks

`npm run test:life-routines`, `npm run test:checks`, `npm run test:parity`, and `npm run test:world-registry` must pass. Write `out/codex-village-life-queue-report.md` and commit locally. A couple of stills under `shots/village-life-queue/` (plaza or inn meal, showing spread people) are welcome. Do not merge.
