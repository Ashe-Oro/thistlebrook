# Living Village M1 — review and fix P0/P1

Work only in `/workspace/cel-town`. Same rules as M1: no purchases, no git push, no deploy, no commit, no licensed files outside `public/licensed/`, no touching tailgate-games / Thistlebrook / Agent Pixel / the 4090. You may run compile, `npm run test:checks`, `npm run test:parity`, `npm run build`, and `npm run shots:village-m1`.

M1 is implemented and the first capture exists. Your job is a **review against `docs/village/PLAN.md` (M1 only)** using severity P0–P3, then **fix every P0 and P1**, recapture any affected shots/video, update the plan's timing, and write `out/codex-village-m1-review.md`. The review is approved only when no P0 or P1 remains. Do not start M2–M5.

## Timing correction (update PLAN.md)

Codex's weekly quota resets at **6:53 PM ET today (Mon Nov 16)**, not 8:30 PM. The remaining milestones (M2–M5) must land by about **6:45 PM ET**. Update `docs/village/PLAN.md` so later-milestone timing reflects that (drop "around 8 PM" / 8:30 language). Do not otherwise expand M1 scope.

## What I already verified (look at these yourself)

Play URL: `/?size=large&seed=1234&life=1`. Stills and a 16s 1280×720 12fps mp4 are in `/workspace/cel-town/shots/village-m1/`. Sample video frames were extracted to `/tmp/village-m1-vid/f1.png` (start, afternoon), `f2.png` (~5s, dusk), `f3.png` (~10s, night), `f4.png` (end, night). `evidence.json` shows all 12 residents change XZ between hour 15.1 and 23.1. Checks, parity, and life-off JSON hashes were green at the end of the M1 run. Night windows and lamp pools look good in `night-windows.png`. HUD, clock, and lighting progression in the video are real.

## P1 you must treat as a blocker (confirm, then fix)

**NPCs standing on roofs.** This is visible and not a trick of one still:

- `shots/village-m1/village-life.mp4` / `/tmp/village-m1-vid/f1.png`: a figure is on the windmill cap; another figure sits on/against the brown-roofed market/shop building just right of the red pavilion.
- `f2.png`: **two townsfolk are clearly standing on the windmill's brown cap**, feet on the dome, silhouetted against the sky. This is not street-level perspective from market-street (x=30); they are elevated on the landmark at roughly [42, -1].
- `shots/village-m1/market-day.png` also shows a figure on that brown-roof shop/hall.

Runtime (`src/life/people.js`) sets `y` from `baseY = o.position.y` on the instantiated mesh, plus a tiny walk bob. Work/home nodes come from `src/life/schedules.js` (`destination()` uses door path snaps, then `nearestNode`). Investigate catalog `groundY`, the generated GLB origin/transform, whether a work node was snapped to a landmark origin inside/above the mesh, and whether any parent transform lifts them. Fix so every townsfolk's feet stay on the ground plane and workplaces/idles are on the door-path or street **in front of the facade**, never inside a footprint or on a roof. Strengthen `life-townsfolk` (or a helper) so a resident whose Y is well above ground, or whose node sits inside a landmark/house footprint, fails the check; add a negative. The existing intersection check did not catch this, so don't assume it is enough.

## Other findings (fix if clearly P1; otherwise P2/P3 and leftover)

- **Smithy sign/chalkboard** in `street-level.png` and `npcs-work.png`: a large dark board leans in the yard between the path and the blacksmith, almost as tall as the people, looking fallen or badly rotated. If this is a life-mode placement bug, fix it. If it is pre-existing large-town dressing (`cv-aframe-chalkboard` / hanging sign) and only obvious at street level, classify P2 and leave a note; do not spend the whole run retuning the compiler's market dressing.
- `street-level.png` and `npcs-work.png` are nearly the same camera; P3 composition, not a blocker. A distinct work framing is nice if you recapture anyway.
- Night stills/video are readable (windows + lamp pools). Ground stays quite green; that was an M1 readability choice, at most P3.
- Video uses `post=0` (documented). Stills keep the post stack. Fine for M1.
- Clock seek teleports to schedule stops; high timescale can abandon a long walk. Already documented. P3 / known limit.

## Also review (don't rubber-stamp)

Walk the M1 bar in PLAN.md: 12 dressed townsfolk, road-following schedules, walk camera + overview, day/night, lit windows/lamps, tests green, life-off JSON unchanged, Edo untouched. Spot-check for other P0/P1: NPCs inside walls, floating, broken geometry, walk camera clipping underground, life-off regressions, hooks (`__ready`, `__life`, `__stage`, …) broken, licensed files escaped `public/licensed/`.

## After fixes

- `npm run test:checks` and `npm run test:parity` must pass. Life-off hashes must still be byte-identical.
- Recapture affected shots and the mp4 with `npm run build && npm run shots:village-m1` (or a tighter recapture of the changed views + video if the existing script allows). Confirm in the new video that **nobody is standing on the windmill or any roof** and that people still move and the clock still goes afternoon → night.
- Write `out/codex-village-m1-review.md`: finding list (id, severity, status: fixed / leftover), what you changed, test/shot results, leftover P2/P3 for M2/M4. If you would approve M1 after the fixes, say APPROVE.

Do not start M2.
