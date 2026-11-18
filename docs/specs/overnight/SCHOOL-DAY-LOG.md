# School day: decisions log

Append-only. Seed 831 unless noted. Times are America/New_York. Weekday 0 = Monday; the first simulated day is a Friday (`weekdayOf(day) = (4 + day) % 7`).

## 2026-11-18 · Setup and the Classroom pack

- Worktree `/workspace/cel-town-wt/school-day` on `village/school-day` from main `e72f06e`. `npm ci`, and `public/licensed` symlinked to `/workspace/cel-town-git/public/licensed`, the same as the other lanes. The spec was untracked in the main checkout, so it is copied into this branch beside this log.
- **The Classroom pack could not be downloaded.** This session had no threejsassets connector (`get_pack_details`, `get_product_download_link`), and the lane rules forbid inventing endpoints. The pack is not on disk either (`/workspace/threejs-assets`, `/workspace/threejs-packs`, `/workspace/asset-packs` and `public/licensed` were all searched). Nothing new was registered with `tools/inventory-library.mjs`.
- Stand-in: Room 4 is built from procedural cel geometry in `src/astra/school-interior.js`, using the toon material and ink hulls. It follows the pack's brief: snap-together walls, child-height desks and chairs, a chalkboard and a smartboard, cubbies and a reading corner. There is a hook for the pack: a private manifest at `public/licensed/classroom/school-day.json` (`{"roles": {"desk": "desk_kid.glb", "chair": …}}`) swaps the procedural piece of each role for the pack model, scaled to the planned footprint and set on the floor. **That path is untested**, because there was no pack to test it with. It only runs when the manifest exists, which keeps a missing pack from breaking the room.

## 2026-11-18 · Timetable (old → new)

Before: eight townsfolk rigs ("students") paced back and forth on the forecourt in front of the door from 07:00 to 18:00, every day. Three life residents (Pip, Kit, Rafi) and two staff (Elsie, June) "worked" at the school node from 08:00 to 15:00, weekends included, and stood on the steps as a crowd.

After (`src/astra/school-plan.js`, pure and clock-driven):

| Window | Session | Where the 12 pupils of Room 4 are |
|---|---|---|
| 07:45–08:30 | Morning arrival | 9 walk from Willowbank homes on the sidewalk graph. 3 Sunbeam Terrace pupils step off the parked school bus at the bay. Each goes in at the door, hangs up a coat, and walks to their own chair. |
| 08:30–10:00 | Period 1 · Reading & phonics | Seated at their desks. Ms Hart at the board, then walking the aisles. |
| 10:00–11:06 | Morning recess at Little Oak | They line out, walk the sidewalk graph to the playground (about 86 m) and play: a ring game, the sandpit, the slide, hopscotch, pushing a swing. Ms Hart is on yard duty at the gate. |
| 11:06–12:24 | Period 2 · Number work | Seated. |
| 12:24–13:06 | Packed lunch at desks | Seated eating (`Seated Eat`). Ms Hart eats at her desk. |
| 13:06–14:36 | Period 3 · Seeds & sunlight | Seated; three readers on beanbags in the Book Nook. |
| 14:36–15:00 | Home time | They pack up and walk home on the graph. Bus riders walk back to the bay and board. |
| 15:00–16:00 | Tidying | Room empty. Ms Hart wipes the board and tucks the chairs in. At 16:00 the lights go off and she walks home. |
| Sat–Sun | Closed | Room empty and dark. The grounds keep their usual weekend use (ballgame from 09:30). |

- Pace: town time runs at 90 sim s per game hour. The playground is 78 m from the door by the sidewalk graph, the only legal route (door → campus lane → avenue sidewalk → Little Oak gate). At true walking pace a recess would cost 40 minutes each way. So pupils hurry, as the existing after-school walk to the ballgame does (ballgame.js: about 2.7 m/s). Pace is 2.2 m/s between home and school and 3.0 m/s to and from recess, in sim seconds.
- The ballgame is unchanged: its kids still leave the school door at 15:00 on weekdays and 09:30 at weekends. Home time (14:36) ends before then, so the two events never overlap at the door. Recess uses only the playground. The tennis and basketball courts keep their adult games, so no kid and adult events share a court. No polish-lane priority rule has landed on main.
- Life planner (additive): `profiles.js` gives school pupils a 07:45–14:36 shift and staff 07:30–16:00 (`SCHOOL_SHIFT`). `planner.js` skips school work on Saturday and Sunday (`isSchoolDay(weekdayOf(day))`). `residents.js` hides anyone at the school place who is not walking, because they are indoors, so nobody stands as a crowd on the steps. Hidden residents can't be picked.

## 2026-11-18 · Room 4 and the town renderers

- **The room.** Cutaway, 10 × 8 m, with the north and west walls standing and the south and east open towards the iso camera. It has 12 pupil desks (0.72 × 0.50 m, top at 0.55 m) in three rows of four with an aisle. Each desk has its own chair, a reserved, documented seat at 0.30 m. There are a teacher's desk and chair (0.46 m seat), a chalkboard, a smartboard, an alphabet frieze, a number line, a clock, the children's paintings, cubbies under the west windows with trays and bags, coat hooks, and a Book Nook with a bookshelf, rug, three beanbags (documented seats at 0.24 m) and a plant. The board, smartboard and clock follow the timetable.
- **People.** Pupils and Ms Hart use the rigged townsfolk with the villager mixer (TOWN-09). They sit with `Sit` or `Seated Eat` at a documented seat height, walk with distance-driven `Walk`, play with `Play` and teach with `Work`. Pupils are the child rig at 0.94 or adult rigs at 0.60 (about 1.03 m). No pupil wears an adult hat. Ms Hart is the elder rig at full adult height.
- **Enter and leave.** Click the school venue on a school day between 07:45 and 16:00. The campus camera eases towards the door (0.3 s), then the room settles (0.35 s): 0.65 s in all, instant with `prefers-reduced-motion`. Escape, or the button, returns to the `campus` view. The room, its rigs and any pack models are built on the first enter, not in the first town paint. `?classroom=1` enters on load for captures. The classroom always uses the cel default render, even when another skin is active; that is a known limitation.
- **Town.** `civic.js` draws the 13 timetabled people with rigs and mixers, in place of the eight forecourt pacers. Hopscotch squares are added beside the Little Oak sandpit.

## 2026-11-18 · Checks and probes

- `audit:roads`: 0 open. The school adds `school-walk` (TOWN-01: every pupil and teacher route sampled every 0.25 m off graph crossings), `school-furniture` (TOWN-04: base on the floor, inside the walls) and `school-seat` (TOWN-09: documented seats whose height matches the furniture, and child seats below half adult hip height).
- `sim:collisions`, full day: carCar 0, carPerson 0, personOnRoad 0, unsafeCrossing 0, personOnRail 0, boatClash 0, boatPerson 0. 13 school walkers were added, up to 13 out at once.
- `tests/school-day.test.mjs` covers:
  - 09:30 on a weekday: 12 of 12 seated, the teacher present, 0 outdoors.
  - 10:30: 0 in the room, 12 in the playground box, the teacher on yard duty.
  - Weekend 09:30: the room is empty and dark, and the ballgame's weekend game still has 9 or more kids.
  - Every route sample, and every outdoor pose every 15 game-seconds from 07:00 to 17:00, is off the carriageway or on a graph crossing.
  - Injected faults: a route down the avenue (z −33), a floating desk and an adult-height chair each fail.
  - No school work on Saturday.
- Draw calls (1600 × 1000, swiftshader, from the shot tool). Door view at 08:15: 606 before and 532 after; the eight static pacers are gone and pupils are indoors by then. Campus view: 1023 before and 951 after. Room 4 on its own: 615.

## 2026-11-18 · Review

- Before stills: `shots/school-day/before-{campus,door}.png`. After stills: `after-{campus,door,arrival,class,recess,dismissal,dismissal-room}.png` via `tools/school-day-shots.mjs`. Chrome needs a private D-Bus session on this box: `env -u DBUS_SESSION_BUS_ADDRESS XDG_RUNTIME_DIR=$(mktemp -d) dbus-run-session -- node tools/school-day-shots.mjs …`.
- Blind critic, round 1: the in-session still and the empty tidy-time room in random order. The critic picked the in-session still as reading as a lesson. Fixes from its notes:
  - Ms Hart is now shot while at the board.
  - Pupils are less cloned: fewer child rigs, more variety among the scaled ones.
  - The camera is tighter.
  - The status panel moved off the room.
  - Heavier ink on the furniture.
  - A chunky sans board hand.
- Blind critic, round 2: again it reads as a lesson. Its notes were that the blocky rigs look wide against the small desks, and that the teacher's dark head blends into the board. Pupils were made slightly smaller (0.60 and 0.94), desks widened to 0.72 m, the teacher changed to the grey-haired elder rig, and the framing tightened. Desk and seat heights were not changed: they stay child-scale, per the spec.
- Open: the Classroom pack itself (see Setup). The bus is the existing parked school bus; riders step off and board it, and it does not drive. No class-to-recess clip was made.
