# Build "School day", a Classroom-pack day at Thistlebrook High (branch `village/school-day`, worktree `/workspace/cel-town-wt/school-day`).

OWNER: school-day lane. Base: current `main`.

## Reference

Thistlebrook High already has brick classroom wings, a clock tower, lockers, a flag, a bus bay, and paths to tennis, basketball, Little Oak playground, the Owls baseball field and the football stadium (`src/astra/civic.js`, view `?view=campus`). Kids already walk to the ballgame after school on the sidewalk graph. The exterior is the gold envelope: do not rebuild the school shell.

Owned pack: [Classroom Kit](https://threejsassets.com/packs/classroom) (slug `classroom`, 58 assets). Snap-together walls, child-height desks and chairs, chalkboards and a smartboard, cubbies, a reading corner. Demo: https://threejsassets.com/packs/classroom/demo. Re-toon to the cel skin. If `village/interiors` has already landed a generic enter-building hook, use it; otherwise this lane may add a school-only enter camera in `src/astra/school-interior.js`.

Gold stills, seed 831, a weekday. Take before shots of the campus and school door first.

| View | Aim | Files |
| --- | --- | --- |
| Morning arrival | Students and a bus or walkers at the bay and door, 08:00–08:30 | `after-arrival.png` |
| Classroom in session | Child-height desks, a teacher at the board, students seated, cel materials, room fills the frame | `after-class.png` |
| Recess | Students on the playground or courts, classroom empty or mostly empty | `after-recess.png` |
| After school | Ballgame or walks home; classroom lights off or cleaning | `after-dismissal.png` |

Desks should read at child scale (seat height clearly below adult hip height). The teacher is an adult townsfolk rig. Students use the child or scaled townsfolk rigs already in town.

## Details

A weekday timetable, clock-driven, that the life planner can honour additively:

- Morning arrival at the school door and bus bay (document the window, for example 07:45–08:30).
- At least two class periods and one recess or lunch, all on weekdays. Weekends the school is quiet (grounds may still be used).
- During class, ≥ 8 students are seated in the dressed classroom and a teacher is at the board or circulating. They do not remain as a crowd outside the door.
- Recess uses existing campus venues (playground, courts) on the sidewalk graph. The ballgame keeps its current after-school and weekend hours; do not overlap adult or kid events in a way the polish lane is already fixing. If polish has landed a priority rule, honour it.
- Dismissal walks home or to after-school activities on the sidewalk graph only (TOWN-01).

Dress at least one full classroom with the pack (desks, chairs, board, cubbies or reading corner). Furniture sits on the floor (TOWN-04). Clicking the school enters that classroom when lessons are in or just after; Escape returns to the campus camera. Load classroom GLBs on enter, not in the first town paint.

Out of scope: rebuilding the school exterior, a second school, Maple Hollow children unless they already exist on main, interiors for shops (interiors lane), and branded stationery.

## Tools

- Work only in `/workspace/cel-town-wt/school-day`. Branch `village/school-day` from `main`. Worktree from main, `npm install`, `public/licensed` symlink to `/workspace/cel-town-git/public/licensed`.
- Download the Classroom pack through the threejsassets connector. Register with `tools/inventory-library.mjs`. Never commit GLBs.
- Pure timetable and room plan: `src/astra/school-plan.js`. Render: `src/astra/school-interior.js` and additive hooks in `civic.js`, the life planner and, if needed, selection/camera. Prefer not to fight `village/interiors`; keep the school enter hook behind a small API.
- Tests: `node --test tests/*.mjs tools/life-routines.test.mjs`, `npm run test:checks`, `npm run audit:roads`, `npm run sim:collisions`, existing `tests/ballgame.test.mjs`, plus `tests/school-day.test.mjs` (weekday vs weekend, seated counts, arrival/dismissal on the graph, no road walking).
- Shots in `shots/school-day/`. A short class-to-recess clip is welcome. Playwright and `/usr/bin/google-chrome` on a free port, not 5173 if it is taken.
- No push, no deploy, no force-push. Do not print secrets.

## How to work

Autonomous, with no questions. Log the timetable (old "kids exist near campus" to new period times) in an append-only decisions log.

Measurable targets:

- Weekday 09:30 at seed 831: ≥ 8 students seated in the classroom, 1 teacher present, 0 students standing in the carriageway.
- Recess: classroom occupancy drops by at least 75%, and ≥ 6 students are at playground or courts.
- Weekend 09:30: classroom empty or used only for a documented exception; ballgame still meets its current test if it is a ballgame weekend window.
- Enter and leave the classroom in under 1 second of camera ease (instant with `prefers-reduced-motion`). Interior GLBs are not required for the first town frame.
- `audit:roads` 0 open, `sim:collisions` 0. Injected "student path down the middle of the avenue" fails.
- Blind critic loop on the classroom still vs an empty or boxy room, in random order, until the after reads as a real lesson in this school. Revert anything adult-scaled or off-style. Ashe's rules override critics.

## Deliver

- Local commits only on `village/school-day`. Never push or deploy.
- Stills in `shots/school-day/`.
- Tests and audits green. CHANGELOG entry under Unreleased.
