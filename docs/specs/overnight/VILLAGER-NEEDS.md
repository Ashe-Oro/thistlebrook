# Build "Villager needs", daily-life depth so Thistlebrook people eat, work, shop, socialise and sleep for reasons (branch `village/life-needs`, worktree `/workspace/cel-town-wt/life-needs`).

OWNER: life-needs lane. Base: current `main`.

## Reference

The life types already declare `needs: { energy, hunger, recreation }`, tools `walkTo`, `talkTo`, `work`, `buy`, `sell`, `payBill`, `rest`, `eat`, `visit`, plus bills, money, relationships and a `Brain` planner (`src/astra/life/types.d.ts`, `planner.js`, `runtime.js`, `profiles.js`). This lane makes those needs actually drive visible days, without replacing the scripted town events (ballgame, fair, harbor, school bell).

Gold is a readable day-in-the-life, not a Sims UI. Capture one named resident at seed 831:

| Moment | Aim | Files |
| --- | --- | --- |
| Morning leave | They leave home after a sleep block, on the sidewalk, heading to work or school | `after-morning.png` |
| Midday meal | They eat at a shop, home, or a lunch place; hunger drops | `after-lunch.png` |
| Errand or social | A shop visit or a talk with a neighbour, not a teleport | `after-errand.png` |
| Evening home | They are home and then asleep in the sleep window | `after-evening.png` |

If the inspector lane is not merged yet, a debug overlay or `?debug=needs` panel is enough to show name, needs, current action and destination. Prefer hooking the existing life panel (`src/astra/life/panel.js`) additively.

## Details

Each simulated resident (the astra life roster, not decorative venue actors) has hunger, energy and recreation on a 0–100 scale. They tick with time and activity: work and walking spend energy, meals restore hunger, sleep restores energy, play/visit/talk restore recreation. When a need crosses a threshold, the planner chooses an action that uses an existing tool and an existing place (bakery, home, work, park bench, quay table, market stall).

Behaviour that must be visible and tested:

- People go home and sleep in a documented night window. Streets are quieter after 22:30, not empty of night-shift exceptions you document (harbor, fair close-down, late quay).
- People eat at least twice in a simulated day, at places that can serve food, or at home.
- Workers attend their shift. They do not stand in the road or skip across carriageways (TOWN-01).
- Shopping uses `buy` at a shop that is open. Money and inventory already exist; keep them consistent (a purchase decreases money, stock appears in inventory).
- Socialise: when two residents share a place and recreation or sociability is high, they can `talkTo` or share a bench/table slot.
- Needs never freeze. A resident who is stuck (no path, closed shop) logs a fallback and picks another legal place; they do not stand in a wall or on asphalt.

Keep this additive. Do not rebase or rewrite `planner.js` in a way that drops authored activities from `registry.js` (chess, picnic, ballgame, rides). Those remain higher priority when in season and hours, as the polish lane may already be teaching. If `village/grok-polish` or `village/opus-suburb` changed the planner on main by the time you start, rebase onto main and extend what is there.

Out of scope: a full economy sim, player-controlled avatars, dialogue trees, Maple Hollow-only residents (include them only if they already exist on main), and weather-specific branches (weather lane owns those hooks; expose a `context.weather` if it is easy, but do not require weather to ship).

## Tools

- Work only in `/workspace/cel-town-wt/life-needs`. Branch `village/life-needs` from `main`.
- Prefer pure changes in `src/astra/life/planner.js`, `runtime.js`, `profiles.js` and a new `src/astra/life/needs.js`. Keep the renderer in `visuals.js` small (eat/sleep/talk poses).
- Tests: the full suite, especially `tools/life-routines.test.mjs`, plus `tests/life-needs.test.mjs` that runs a whole day at seeds 831 and 42 with no renderer. Audits and `sim:collisions` must stay clean with the new destinations.
- Shots in `shots/life-needs/`. A one-minute time-lapse of one resident's day is welcome.
- No push, no deploy, no force-push.

## How to work

Autonomous, with no questions. Log assumptions in an append-only decisions log, including every threshold you pick (old → new, and why).

Write the day sim tests first: a resident with hunger 10 at 12:00 should go eat; energy 10 at 23:00 should go home and rest; a closed bakery should not be chosen. Then hook visuals.

Measurable targets:

- In a full-day sim at seed 831, ≥ 90% of life-roster residents: sleep ≥ 6 simulated hours, eat ≥ 2 times, and (if they have a job) attend ≥ 90% of their shift.
- Hunger, energy and recreation stay in 0–100; no NaN. After a meal, hunger is at least 30 points higher, or a documented cap.
- 0 walkers on the carriageway except crossings, all day (`sim:collisions` 0, TOWN-01).
- Authored events still fire: the Owls ballgame still has ≥ 9 kids on the field in its hours when the weather is clear (or whatever the current main test asserts).
- A debug or panel view can show one resident's needs and current action.
- Injected case: all nearby food places closed → resident goes home to eat, or the test records a legal fallback, never a standstill on the road.
- Blind critic loop on the four stills: the after day should read as people with somewhere to be, not as looping wander. Revert anything worse.

## Deliver

- Local commits only on `village/life-needs`. Never push or deploy.
- Stills in `shots/life-needs/`. Day-sim counts in the log.
- Tests and audits green. CHANGELOG entry under Unreleased.
