# Living Village — Milestone 2: richer lives

Work only in `/workspace/cel-town`. Do not buy anything, do not git push, do not deploy, do not commit. Licensed GLBs stay in `public/licensed/` (gitignored). No API keys. Do not touch `/workspace/tailgate-games`, Thistlebrook, Agent Pixel, Crayon, or any RTX 4090 (it is on another machine and is out of scope). You may run compile, `npm run catalog:bounds`, `npm run test:checks`, `npm run test:parity`, `npm run build`, and shot scripts you add.

When finished, write `out/codex-village-m2-report.md`.

## Context

M1 is done and approved. Play URL is still:

```
/?size=large&seed=1234&life=1
```

(`village=1` is an alias; omitting `size` already defaults to large in life mode.) The town is Willowmere: 12 dressed cozy townsfolk with home/work/plaza/home schedules, walk camera, day/night, lit windows and lamps. Modules live in `src/life/{camera,daynight,graph,schedules,people,index}.js`. Catalog/names are in `src/catalog/townsfolk.js` (e.g. `Mabel · Baker`, `Pip · Child`, `Rose · Innkeeper`). Hooks: `window.__life` (`hour`, `setHour`, `timescale`, `setTimescale`, `mode`), plus `__ready`, `__stage`, `__town`, `__post`, `__scene`, `__THREE`, `__renderer`. Shot pattern is `tools/shots-village-m1.mjs` (Playwright + Vite preview + `/usr/bin/google-chrome` + SwiftShader + ffmpeg, `--video-only` and evidence checkpoints). Do not regress those hooks.

This run is **M2 only**. Do not start interiors (M3), Edo walks (M5), or a broad visual rewrite (M4). Mark M1 complete and M2 in progress in `docs/village/PLAN.md`; keep the 6:53 PM ET reset and ~6:45 PM ET landing target for M2–M5.

## Hard non-regression rules

- Life-off compiled JSON for hamlet/large seeds 1, 1234, and 7 must stay **byte-identical** (see `out/village-m1-baseline.json` / `out/village-m1-regression.json`). If life-on compile needs more RNG, use `deriveSeed`. Do not change plaza/district placement or chalkboard *compiled instance fields* just to fix a sign — prefer a **runtime visual** correction so hashes stay frozen.
- `npm run test:checks` and `npm run test:parity` must pass. Do not weaken `life-townsfolk`, Edo checks, or grounding/foot-height/in-footprint assertions from the M1 review.
- Townsfolk stay `kind: 'villager'`, uninstanced, feet on the ground, on the walk graph, not inside house/landmark footprints or on roofs.
- Edo roster and idle animator stay as they are. No samurai in Willowmere.
- Keep `__ready` and `__life`. Licensed files stay private.

## Goal

Residents acknowledge each other and visibly use the village. Player-facing text stays short and gamer-style.

### 1. Readable names / roles

Show each townsfolk's display name (already `"Mabel · Baker"` etc.) when the player is nearby and/or when the cursor hovers them. A world-space label or compact screen-space tag is fine. It must be readable in a street-level still. Do not permanently wallpaper every name at overview scale (overview can hide them, or show only a few). In shot tools, a query such as `?labels=1` (or a `__life` helper) should force nearby/hover labels on for the names screenshot without needing a real mouse hover if that is flaky in headless Chrome.

### 2. Greetings

When two residents pass close on a road or at a door, they briefly greet: a small wave/weight-shift or emote, plus a short speech bubble ("Mornin'", "Hiya", "Evening") that appears and fades. Seeded, with a cooldown so they don't spam. Reproducible for seed 1234 at a documented hour.

### 3. Pair chats with speech bubbles or emotes

At least one seeded pair sits or stands together (a bench, plaza, or well is ideal), faces each other, and trades short bubbles or emotes for a while ("Heard about the mill?", "Aye."). Use **interaction reservations** so two chats don't claim the same bench and so road traffic can still pass; do not deadlock pathfinding. Bubbles must be obvious in a close screenshot.

### 4. Shopping at stalls

During the day, at least one resident (not only the merchant standing still) approaches a market stall, pauses as if buying, and shows a short bubble or emote ("Two loaves", "I'll take it"). The stall merchant may answer. Stay outside; no interiors.

### 5. Eating at the inn

During a meal window (late morning, midday, or evening — pick one and document it), at least one resident eats at the **tavern front** or at outdoor seating if the layout has it (tables/benches near `cv-tavern`). A mug/bowl prop or a clearly readable "eating" emote/bubble is enough. Do not place them inside the closed inn mesh (interiors are M3). Rose the innkeeper can serve or stay at the door.

### 6. Kids playing

Pip (`townsfolk-child`) gets a visible play loop on the green or plaza (a simple toon ball, hoop, or tag circuit). "Kids" is satisfied by a clear play activity; a second child is welcome only if you update checks to "at least 12 distinct townsfolk" (never fewer) and keep life-off JSON unchanged. Play must read in a still (running, ball in motion, or a play emote).

### 7. Varied seeded schedules

Richer than M1's single work block: staggered offsets already exist — add activity slots (shop, meal, play, chat, greet-on-commute) so these behaviors actually happen at documented hours for seed 1234. Keep home at night. Clock seek (`setHour`) should reconstruct a sensible pose for the activity at that hour (already the M1 seek model), so screenshots can jump to 9 / 12 / 17 (or the hours you document) and see the event.

Road walking stays on the graph. Interactions happen at reserved nodes (stall front, bench, play spot, inn front) that are on or adjacent to the graph, not inside footprints.

### 8. Cheap visual P2s from M1 (in scope here)

**(a) Oversized smithy A-frame sign.** In `street-level.png` / `npcs-work.png` a huge `cv-aframe-chalkboard` leans in the blacksmith yard, almost as tall as the people. It is pre-existing facade dressing in `src/compiler/districts.js` (also present with life off). Fix the **visual**: upright, human-scaled, not blocking the path or looking fallen. Do **not** change life-off compiled JSON. A runtime correction (or a catalog/visual scale that does not mutate compiled instance records) is the right path. Other market A-frames may be cleaned up the same way if they share the bug; don't retune the whole dresser.

**(b) Night grass more nocturnal.** In life mode, desaturate and darken grass (and the plaza green if it stays day-bright) under moonlight so nights feel like night, while windows and lamp pools stay readable. Do not turn the scene into black soup. **Do not change default hamlet or life-off large appearance** — gate this on life mode. Hills may shift slightly; the obvious problem is the flat grass.

## Determinism, hooks, checks

Extend `window.__life` (keep existing fields) with something shot scripts can call, for example:

- `activities()` → list of current events `{type, ids, pos}` where `type` is `greet` | `chat` | `shop` | `eat` | `play` (and maybe `work` / `walk`)
- optional `setHour` already seeks; document the seed-1234 hours at which a greeting, a pair chat, a shop, an inn meal, and play are guaranteed visible (or appear within a few game minutes at timescale 1)

Add a hard check (life-on only) that seed 1234 (and probably 1 and 7) compile with the required activity slots / reservation metadata, and that the child has a play destination, someone has a stall shop, someone has an inn-meal stop, and at least one chat pair is defined. Prove failures with negatives in `tools/check-negatives.mjs`. Existing grounding checks stay.

Keep performance reasonable on SwiftShader (no heavy per-frame canvas text for 12 always-on labels at overview; bubbles are few and short-lived).

## Shots and video

Add `tools/shots-village-m2.mjs` and `npm run shots:village-m2`. Follow the M1 harness: build is a prerequisite, Vite preview, system Chrome + SwiftShader, evidence.json, `--video-only` retry, pose/feet assertions, ffmpeg yuv420p 1280×720, 10–20s, 12 fps. Write to `/workspace/cel-town/shots/village-m2/` (create the dir). If `__ready` never arrives, save `-failed.png` and fail.

Capture at least:

1. `greeting.png` — two residents greeting, bubble or emote visible
2. `pair-chat.png` — a seated/standing pair with bubbles or emotes
3. `shopping.png` — a resident shopping at a stall
4. `inn-meal.png` — eating at the inn front
5. `kids-playing.png` — Pip (and friend if any) clearly playing
6. `names-labels.png` — street-level, names/roles readable
7. `night-grass.png` — night overview or street, grass clearly darker/less saturated than M1, windows and lamps still lit
8. Optional but useful: `smithy-sign.png` or a street-level work shot proving the A-frame is now a normal-sized upright sign

Plus `village-life.mp4` (~12–20s): time may advance, but the clip must show **at least two live social behaviors** (bubbles/greet/chat/shop/eat/play) and preferably a lighting shift or the nocturnal grass. Prefer a camera that can actually see bubbles (street or mid-close), not only a distant overview. Still copy `video-start.png` / mid / end frames. Stills keep the post stack; video may use `post=0` like M1 if needed for throughput.

Also update the README "Living village" section with the new behaviors, label/hover controls, documented hours, and the M2 shot command.

## Done means

- All six social/name features are visible and seeded, plus the two visual P2s.
- Checks, parity, and life-off hashes green; Edo unharmed; feet still on the ground.
- Shot script run (`npm run build` at least; run the shots if the browser works, which it did in M1).
- Report: what landed, how to run, documented hours, shot/video paths, known limits, leftover for M3 (interiors).

Do not start M3.
