# Living Village M2 — review and fix P0/P1

Work only in `/workspace/cel-town`. Same rules as M2: no purchases, no git push, no deploy, no commit, no licensed files outside `public/licensed/`, no 4090, no Thistlebrook / tailgate-games / Agent Pixel. You may run compile, `npm run test:checks`, `npm run test:parity`, `npm run build`, and `npm run shots:village-m2` (and `--video-only` / `--stills-only` if present).

M2 is implemented. Your job is a **review against `docs/village/PLAN.md` (M2 only)** using severity P0–P3, then **fix every P0 and P1**, recapture any affected shots/video under `/workspace/cel-town/shots/village-m2/`, and write `out/codex-village-m2-review.md`. Approved only when no P0 or P1 remains. Do not start M3.

Play URL: `/?size=large&seed=1234&life=1`. Implementation report: `out/codex-village-m2-report.md`. Documented seed-1234 hours: 9.021 greeting, 12.021 chat/shop/eat/play, 21.5 night grass.

## What already looks solid (verify, don't redo)

- Greeting at the smithy: Bram/Mabel, "Hiya!", names readable (`greeting.png`).
- Shopping now reads as a real stall visit: Rowan at crates/awning, "Two loaves, please!" (`shopping.png`).
- Inn lunch is at the tavern door: Rose and Clover, "Mmm! Lunch time." (`inn-meal.png`).
- Pip has a visible ball and "Catch!" / "One more round!" play bubbles.
- Ada/Oswin plaza chat lines are readable; the 12s video end frame shows the dialogue changing ("Aye. Wind's back!") and the ball having moved.
- Night grass is clearly darker and less saturated, with windows and lamp pools still readable (`night-grass.png`). This P2 from M1 looks fixed.
- Smithy A-frame is much smaller than M1 (no longer person-height and fallen). Fine as P3 leftover if a slight awkward placement remains.
- Checks, parity, and life-off hashes were reported green. Re-run them after any code change.

## Findings to judge

**Shot set is redundant (at least P2; recapture even if you leave it P2).**
- `greeting.png`, `names-labels.png`, and `smithy-sign.png` are essentially the same camera and moment.
- `pair-chat.png` and `kids-playing.png` are essentially the same plaza frame (chat + Pip in one shot).
The behaviors exist, but the proof set should show each one clearly. After any code fixes, recapture with **distinct cameras**: a closer pair-chat on Ada/Oswin facing each other; a closer kids-playing on Pip and the ball; a names-labels street view that isn't just the greeting; a smithy-sign still that actually frames the A-frame.

**Name-tag anchoring (P2, promote to P1 if you find it is generally broken).**
In `pair-chat.png`, `kids-playing.png`, and the video, the `Ada · Elder` tag sits at the very top of the screen, far from Ada (the purple figure). Bram/Mabel/Pip tags are well placed. Fix the billboard so each label stays above its person. Also, a tiny unreadable mid-distance bubble appears in the plaza shots — hide or cull off-size/off-screen/distant bubbles.

**Inn meal (P2).** It is a standing door conversation more than a visible meal (no mug/bowl). A small held cup or "eating" prop would help, but do not start interiors.

**Video (P3 unless something is actually broken).** 12s plaza clip, 117 kb/s, start and mid frames are nearly identical; the end does change lines and ball position. Acceptable. If you recapture, a slightly longer or more obviously animated clip is welcome; keep bubbles readable. Stills keep the post stack; video may use the existing throughput settings.

Walk the M2 bar: greetings, pair chats with bubbles/emotes, stall shopping, inn-front meal, kids playing, names/roles on hover or nearby, the two visual P2s, seeded/reproducible events, reservations without deadlock, tests green, life-off JSON unchanged, Edo unharmed, feet on the ground. Look for other P0/P1: overlapping bodies, labels/bubbles unreadable as a system, NPCs in walls/roofs, life-off regressions, hooks broken (`__ready`, `__life`, `__life.activities()`).

## After fixes

- Checks, parity, life-off hashes must still pass.
- Recapture affected stills (and the mp4 if social/label rendering changed) with `npm run build` and the M2 shot script. Confirm distinct proof frames and that Ada's label sits on Ada.
- Write `out/codex-village-m2-review.md`: findings (id, severity, status), what changed, test/shot results, leftover P2/P3 for M3/M4. Say APPROVE if no P0/P1 remain.

Do not start M3.
