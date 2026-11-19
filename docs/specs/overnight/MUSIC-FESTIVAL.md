# Build "Music festival", a little evening concert at the Merrymead Bandshell in Thistlebrook (branch `village/music-festival`, worktree `/workspace/cel-town-wt/music-festival`).

OWNER: music-festival lane. Base: current `main`. Ashe, 1:12 PM ET, 18 Nov 2026: "Let's actually have a music festival. I think in the bottom left corner, you have like a auditorium type of thing or some outside external auditorium, put a band up there and have like a little music festival."

## Reference

The outdoor auditorium is the **Merrymead Bandshell** (`fair-band`) in Merrymead Park, the southwest / bottom-left corner of the map. Parcel centre `[-67, -44]`, box `[-76, -53]`–`[-59, -38]`, entry `[-74, -52]`. Hours and the venue record live in `src/compiler/astra-fair.js`. The fan-shaped shell, steps, two box speakers, "MERRYMEAD SESSIONS" sign and a three-piece placeholder band (primitive gold-ball instruments and a red disk for a drum) are built in `src/astra/fairground.js`. The Picnic Pantry sits next door; keep it. Do **not** use The Riverside Sessions bandstand at `[55, 26]` in the quay (`src/astra/districts.js`) — that is a different venue.

Existing stills to match cameras against: `shots/astra-fair/05-bandshell-and-pantry.png` (`{x:-62, z:-46, zoom:4}` at 18:00) and `06-saturday-evening.png`, plus `?view=fair`. Take fresh seed-831 befores from the same bandshell camera first, on cel.

| View | Aim | Files |
| --- | --- | --- |
| Before, late afternoon | The current shell, pantry and thin placeholder band / lawn, no festival dressing | `before-bandshell.png` |
| Weekend set, early evening | 4–5 piece band on the shell, crowd on the lawn facing the stage, stalls and a festival banner or entrance, cel materials | `after-concert-evening.png` |
| Night set | Stage wash and pulsing lights, note particles readable against the shell, crowd still facing the stage | `after-concert-night.png` |
| Off hours | Weekday mid-afternoon, or after 21:30: no performing band, no concert crowd on the boards or lawn slots, lights down or dim | `after-off-hours.png` |

Measurable features of the evening gold still: the existing shell silhouette still reads; the band fills the stage with distinct instruments; at least eight villagers stand or dance on the listening lawn and face the shell; two or more food stalls or carts and a festival banner or entrance are obvious in a wide shot, not a single hidden prop.

A related unbuilt brief, `docs/specs/overnight/FESTIVALS.md`, is a harvest / winter calendar. Reuse its habits (sidewalk access, stalls on the surface, no carriageway blockage, clock-driven hours, residents swapping a leisure block) but do not implement that seasonal event system here. This lane is the standing Merrymead concert.

## Details

A little music festival on the existing bandshell, clock-driven, with no sound.

- **The band.** A 4 or 5 piece — vocals, guitar, bass, drums, keys — on that stage during concert hours. Animate them with the existing Mixamo villager clips in `src/life/animation-plan.js` / `src/life/animation-clips.js` (Idle, Look Around, Work, Play, Wave and friends) and instrument props in hand or at the kit. If the library has no play-instrument clip, a lightweight Mixamo-65 procedural playing loop is allowed. Do not invent a second rig, and do not leave anyone in a T-pose.
- **Stage dressing.** Lights, banners and speaker stacks on the existing shell. Keep the shell and the Merrymead Sessions sign; replace the two primitive box speakers with proper stacks; add a stage wash that pulses with the "music".
- **Crowd and grounds.** Villagers gather into a crowd on the listening lawn that faces the stage and dances or cheers (Play, Wave, or a light procedural dance on the same rig). Some may sit on the existing lawn benches (TOWN-09). Add food stalls or carts near the lawn / pantry, and a festival banner or entrance at the approach. Fair visitors already prefer `fair-band` during a concert; also have town residents swap an evening leisure block to attend.
- **Evening lighting.** Driven by the clock. The top-right clock dropdown is the only time control (TOWN-16). Lights come up as evening starts, pulse during the set, and dim after. `?hour=` and `__astra.setHour` must show the same result, so shots and the dropdown agree.
- **Festival hours.** Keep the existing `fairSchedule` concert windows unless you document a small, tested tweak: weekends 16:00–21:30, weekdays 18:00–21:30, park closing at 22:00. The band and festival dressing are up during those hours and pack down after. Off hours: quiet stage, no leftover crowd on the boards.
- **No sound.** The game has none, so there is no audio API, no music file and no sound toggle. Show the music visually with note particles and light pulses only.

Do not fight ride hours, the Picnic Pantry or the duck pond. Out of scope: building interiors, the villager inspector, the minimap, The Riverside Sessions bandstand, new HUD panels, paid audio, fireworks, and the harvest / winter calendar in `FESTIVALS.md`.

**New town rule** (use **TOWN-20**, or the next free id if `village/railway-tunnels` has already landed TOWN-19 — do not collide): "Festival-goers face the stage and never stand on the stage or the roads." Quote it in `docs/TOWN-RULES.md` with Ashe's request and the date, and attach an automated check. Today's fair-band slots all face `Math.PI`, which can leave listeners looking the wrong way; fix the facing. During a concert at seed 831, every person in the fair-band parcel who is watching faces the stage (within a documented yaw tolerance, for example 40°), no one occupies the stage box except the band, and no one stands on a carriageway (TOWN-01 still holds). Injected faults — a listener on the boards, a listener facing away, a listener in a park road — must fail the new test and the road audit.

Follow all of `docs/TOWN-RULES.md`. Keep the UI uncluttered (TOWN-16): add no new panels.

## Tools

- Work only in `/workspace/cel-town-wt/music-festival`. Branch `village/music-festival` from `main`. Licensed assets are already symlinked at `public/licensed` → `/workspace/cel-town/public/licensed`. Never commit GLBs.
- Prefer already-owned ThreeJS Assets packs, re-tooned to cel, then fill gaps with code-built props in the cel palette.
  - **Fairground** (on disk): `entrance-banner`, `entrance-arch`, `cotton-candy-stall`, `popcorn-stall`, `hot-dog-cart`, `ice-cream-stand`, `balloon-cart`, `bunting-strand`, `string-light-strand`, `globe-lamppost`, `neon-marquee-sign`, `ticket-booth`, `park-bench`, `picnic-table`, `queue-stanchion`. Use the banner or arch for the festival entrance only if the lettering can read as Merrymead / the sessions; do not leave a pack's default "welcome" or a Halloween "HAUNTED HOUSE" arch as the gate.
  - **Cozy Village:** `market-stall-01`, `festival-bunting-01`, `string-lights-01`, `flower-cart-01`.
  - Optional cel-friendly extras, not a harvest takeover: Autumn `harvest-lantern`, `autumn-string-lights`, `harvest-bunting`.
  - **Gaps to code-build.** The catalog has no concert stage (keep the existing shell), no guitar, bass, keys, vocal microphone or drum kit (the Accessibility classroom `remote-mic-set-01` is a lanyard mic, not a stage mic; the Edo `taiko-drum` is the wrong culture for this stage — do not use it here), no PA stacks, and no crowd mesh. Build those instruments, stacks and lights in code.
- Prefer a pure plan file such as `src/astra/festival-plan.js` (hours, slot facings, stall boxes, stage bounds) plus additive hooks in `fairground.js`, `fair-life.js`, `astra-fair.js` and the life planner. Do not rewrite the walk graph.
- Tests: `node --test tests/*.mjs tools/life-routines.test.mjs`, `npm run test:checks`, `npm run audit:roads`, `npm run sim:collisions`, existing `tests/astra-fair.test.mjs` (keep it green or extend it), plus `tests/music-festival.test.mjs` (hours, band count, crowd facing and stay-off-stage / stay-off-road, off-hours pack-down, no new HUD, no audio).
- Shots and a short evening-set video in `shots/music-festival/`. Playwright and `/usr/bin/google-chrome` on a free port, not 5173 if it is taken.
- No push, no deploy, no force-push, no purchases. Do not print secrets.

## How to work

Autonomous, with no questions. Log hours, stage bounds, stall boxes, facing math and pack versus code-built choices in an append-only decisions log at `docs/specs/overnight/MUSIC-FESTIVAL-LOG.md`.

Measurable targets:

- Weekend 18:00, seed 831, bandshell camera: 4–5 band members on stage with distinct instruments, ≥ 8 villagers on the lawn facing the stage, ≥ 2 food stalls or carts, and a festival banner or entrance readable in frame.
- Weekday 19:00: concert on, evening lights pulsing, note particles visible against the shell.
- Weekday 15:00 (before the weekday set): no concert crowd on the lawn slots, band not performing.
- After 21:30, or once the park is closed: crowd gone, lights down or dim, no one on the stage boards.
- The new facing / stay-off-stage / stay-off-road check is green; the three injected faults fail. `audit:roads` 0 open, `sim:collisions` 0. `tests/ui-declutter.test.mjs` still passes. No audio code paths added.
- Record draw-call and frame-time delta at the bandshell camera; instance repeated bunting, lights and stalls.
- Blind critic loop on before / after stills in random order until the after is clearly a little music festival and still Thistlebrook. Revert anything that looks tacked on, blocks a path, or turns the shell into a different building. Ashe's rules override critics.

## Deliver

- Local milestone commits only on `village/music-festival`. Never push or deploy.
- Stills and a short video in `shots/music-festival/`.
- Tests and audits green. CHANGELOG entry under Unreleased. The new town rule, with a failing-fault check, in `docs/TOWN-RULES.md`.
