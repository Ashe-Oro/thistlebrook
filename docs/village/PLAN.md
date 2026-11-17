# Living Village — November 16–17 build plan

Base: the compiled large cozy town, seed 1234. Monday is the dense implementation day: the quota resets at 6:53 PM ET today (Mon Nov 16), and M2–M5 must land by about 6:45 PM ET. Tuesday is reserved for verification and corrections. M1 is complete and approved. M2 is in progress in this run; M3–M5 remain subsequent runs. Preserve the toon/post pipeline, private packs, and byte-identical life-off compilation throughout.

## M1 — Living village foundation (complete, approved)
Goal: a village Ashe can walk through, with twelve recognizable residents, road-following schedules and readable nights.
In scope: opt-in `life=1` / `village=1`, third-person ground movement and collisions, overview toggle, clock hooks, sun/sky/fog, window and lamp glow, owned dressed character exports, compiled navigation and schedules, hard checks, screenshots and a short MP4.
Out of scope: conversations, interiors, commerce and skeletal animation.
Files: `src/life/{camera,daynight,graph,schedules,index}.js`, townsfolk catalog/generator, compiler/checks and both page entry points; `tools/shots-village-m1.mjs`.
Run: `/?size=large&seed=1234&life=1`; debug with `/compile.html?size=large&seed=1234&life=1`. Build, checks, parity, then shots.
Done/proof: day overview, street view with a person, market, golden hour, lit night windows/lamps, two workers and 10–20 seconds of moving people with advancing lighting. All six frozen life-off seed hashes match; Edo remains separate.
Risks: disconnected plaza ring/door connections, character export compatibility, excess point-light cost on SwiftShader, facade glow placement. Resolve these before calling M1 complete.

## M2 — Richer lives (Monday afternoon, in progress)
Goal: residents acknowledge each other and visibly use the village.
In scope: names/roles, greetings, pair chats, stall shopping, inn meals, children playing and varied seeded schedules. Out of scope: full dialogue trees, economy or persistence.
Files: `src/life/schedules.js`, resident interaction/awareness module and compact HUD labels.
Run: same life URL, hours 9, 12, 17; accelerate time for schedule review.
Done/proof: close screenshots of a greeting, pair chat, purchase, inn meal and children playing; a repeatable seeded interaction check.
Risks: crowd deadlock and overlapping bodies. Keep road traffic independent from interaction reservations.

## M3 — Interiors & props (Monday late afternoon, next run)
Goal: enter four useful, handsome toon spaces.
In scope: bakery, inn, store and smithy interiors, doors/triggers, counters, stall use and lightable lanterns. Out of scope: furnishing every home or inventory systems.
Files: `src/life/interiors.js`, trigger/prop modules, catalog additions and runtime hooks.
Run: life URL with a documented interior/debug selector for each civic building.
Done/proof: street-to-interior traversal video, one shot per interior and door/lantern use checks.
Risks: closed exterior collision and interior visibility; define doorway transitions and exit placement explicitly.

## M4 — Visual polish + playtest (Monday early evening, next run)
Goal: a coherent street-level experience with no P0/P1 defects.
In scope: camera obstruction refinement, locomotion/bob polish, toon lighting, night atmosphere and grounded/clipping corrections; focused Codex review and fixes. Out of scope: new gameplay systems.
Files: camera/daynight/runtime/toon modules and shot harness.
Run: scripted route from plaza through market and farm, day and night; checks/parity/build.
Done/proof: matched before/after street and night shots; recorded walk route; P0/P1 review list closed.
Risks: visual changes drifting the default look; all life-specific adjustments remain gated.

## M5 — Evening lock + optional Edo walk (lock by about 6:45 PM ET, before the 6:53 PM reset)
Goal: lock the build, document it and optionally walk into the existing Edo district.
In scope: combined `life=1&district=edo` traversal, residual fixes, final shots/video and README. Out of scope: Japanese schedules, new districts or new systems after the lock.
Files: life integration, README and final capture scripts/report.
Run: `/?size=large&seed=1234&life=1&district=edo`, plus unchanged default/Edo regression URLs.
Done/proof: final day/night reel, cozy-to-Edo walk if stable, reproducible commands and known issues. Tuesday: repeat clean build/checks and fix only verified regressions.
Risks: last-minute scope growth and district camera/fog interactions. Leave optional Edo work unfinished rather than destabilize the cozy village.
