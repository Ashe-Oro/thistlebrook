# Railway mountain tunnels (Thistlebrook Grand Loop, v2)

> **Superseded (18 Nov 2026) by `RAILWAY-REROUTE.md`.** Its tunnel goals are folded into that spec. Work in progress kept at commit c1de921. Do not run this spec.

Ashe, 11:41–11:42 AM ET, 18 Nov 2026: asked why the grand loop runs out over the water on trestles, then: "I'm okay with tunnels. I think tunnels are cool. It should tunnel through some of the mountains."

## Reference
- Current line: the Grand Loop (merged on main). Plan `src/compiler/railway.js`, timetable `src/astra/railway-plan.js`, render `src/astra/railway.js`. Decisions and probe numbers: `docs/specs/overnight/RAILWAY-GRAND-LOOP-LOG.md` (2,447 m, 0 m in tunnel, 12 named stops plus the Maple Hollow stop, 7 trailing cars, trestle piers over the outer Coral Coast shore, around Starbase and past Saltwind Harbor).
- Terrain: landscape and backdrop mountains (`src/compiler/landscape.js`, `src/astra/landscape.js`), Pinecrest peaks and the mountain pass (`src/astra/themepark*.js`), woods ridge (`src/compiler/woods.js`), autumn world-locked scenery (TOWN-14, `tests/town-scenery.test.mjs`).
- The previous loop had a 202 m tunnel with portals by Lantern Quay and north of the West Works; see the railway-loop entry in `CHANGELOG.md` for how portals were drawn.
- Rules: `docs/TOWN-RULES.md` (TOWN-09, TOWN-10, TOWN-17 line circles the town, TOWN-18 stop within 60 m of every point of interest). Rule ids live in `src/compiler/town-rules.js`.
- Ashe likes tunnels. The grand-loop spec's "use a tunnel only where the surface truly has no room" and "tunnel share far below" wording is superseded by this spec; update that spec and the log to say so.

## Details
- Reroute the Grand Loop so it tunnels through some of the town's real mountains and hills (backdrop and landscape mountains, autumn peaks, Pinecrest peaks, the mountain pass) instead of avoiding tunnels.
- Where practical, pull the coastal trestle stretch inland behind the beach, the harbor and Starbase, so less of the line runs over water.
- Keep: every stop (12, or 13 with Maple Hollow) within 60 m walking of its point of interest; the loop circling the town (TOWN-17); 7 or more cars; gated, perpendicular level crossings; TOWN-09 and TOWN-10.
- Tunnels: visible stone portals in the cel style (ink outline, toon shading, skins can restyle them as data); dark interiors with a lit portal glow at each mouth; the mountain or hill mesh visibly encloses the bore, with no rail, ballast or train poking through the terrain surface.
- New rule **TOWN-19 · Railway tunnels pass through real terrain**: "the bore is enclosed by a mountain or hill mesh along its whole length, with a portal at each end." Add it to `docs/TOWN-RULES.md` (with Ashe's words and the date) and `TOWN_RULE` (tests/grok-roads.test.mjs keeps the two in sync).

## Tools
- Repo worktree `/workspace/cel-town-wt/railway-tunnels` on `village/railway-tunnels`. node 24 / npm; `public/licensed` symlink for the owned models (never commit them).
- Checks, one at a time (15 GB box, other jobs running): `node --test --test-concurrency=2 tests/*.mjs tools/life-routines.test.mjs`, `npm run test:checks`, `npm run audit:roads`, `npm run sim:collisions` (and `-- --weather rain`, `-- --weather snow`), `npm run build`.
- Headless Chrome (`/usr/bin/google-chrome`, playwright-core) for shots and the clip; ffmpeg for the mp4. Existing shot tools under `tools/` (e.g. the grand-loop capture script) are good starting points.
- Never pkill broadly; other agents run node on this box.

## How to work
- Measurable targets:
  - At least 2 tunnels, each through actual mountain or hill geometry (sample the terrain height above the bore centreline every 1 m; every sample must be at least the bore clearance plus a cover margin, e.g. 1.5 m).
  - Automated TOWN-19 check: fails if any bore sample is uncovered, if a portal is missing at either end, or if any rail/ballast/train-car vertex outside a bore lies below the terrain surface (no rail poking through). Include fault-injection tests (remove a portal, lower a hill, shift a bore) that make the check fail.
  - Over-water trestle length strictly lower than today's (measure today's first and record both numbers in the log).
  - All existing stop-distance, loop-enclosure, rake and crossing checks still pass; sim:collisions 0 events of every category in clear, rain and snow; audit:roads 0 open.
  - Draw-call budget: report before/after at the wide view and at each portal; keep the increase modest (instance portals, merge geometry).
- Blind critic loop: after each milestone, review your own shots and clip as a critic who has not seen the code: does the train clearly enter and leave a mountain? Is any rail visible through a hillside? Do the portals read as stone in the cel look and at night? Fix and re-shoot.
- Commit locally at each milestone (never push, never force-push).

## Deliver
- Code, the TOWN-19 rule and check, updated tests.
- Shots in `shots/railway-tunnels/`: each portal by day, one at night (portal glow), a wide aerial showing the inland reroute, and a before/after of the old coastal trestle stretch.
- A clip `shots/railway-tunnels/through-the-mountain.mp4` where the train clearly enters and exits a tunnel.
- `docs/specs/overnight/RAILWAY-MOUNTAIN-TUNNELS-LOG.md` with probe numbers (loop length, tunnel count and length, trestle-over-water before/after, stop distances, draw calls).
- CHANGELOG entry under Unreleased.
