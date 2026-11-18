# Build "Intelligent crosswalks and sidewalks", a layout, pathing and audit fix for Thistlebrook's pedestrian network (branch `village/sol-crosswalks`, worktree `/workspace/cel-town-wt/sol-crosswalks`).

OWNER: sol-crosswalks lane. Base: `98b5ce0` (main, already named Thistlebrook).

## Reference

- Ashe's screenshot is already in the worktree: `shots/sol-crosswalks/ashe-reference.png`. Ashe's words: "be more intelligent with your cross walks and sidewalks. For example this one doesn't make any sense." It shows zebra crossings forming a closed triangle at a road junction, running diagonally across lanes and not connecting sidewalk to sidewalk. The isometric camera makes a T look like a Y; a large tree sits in the foreground.
- This is systemic, not one bad junction. At seed 831 the walk graph currently has **18 three-crossing triangles** inside junction mouths and **11 clearly diagonal crossings**. The same triangles are visible around Founders Fountain in `shots/grok-roads/after-fountain.png`, including the T-junctions at about `(-66, -15)`, `(-48, -15)` and `(-47.8, 3.5)`. Ashe's crop is a tight zoom of one of those downtown T-junctions. Other current triangles include `(-80, -76)`, `(-114, -73)` and `(45.5, -14.7)`. The worst diagonals include `(-105, -77)`, `(-105, -52)` and `(46, -33)`.
- Root cause (fix the generator, not each junction by hand): in `src/roads/pedestrian.js` `buildPedestrianGraph`, every non-straight road point links adjacent corner kerbs to each other, so a 3-way junction paints a triangle in the asphalt. `src/astra/traffic.js` then draws zebra stripes along every `e.crossing` edge. Authored mid-block `CROSSWALKS` in `src/astra/traffic-simulation.js` may stay only if they already meet the rules below.
- Gold layout: a standard intersection. One zebra per leg that needs it, set back from the junction mouth, perpendicular to the road, straight curb to curb, each end on a sidewalk or curb ramp. Never a triangle in the junction, never a diagonal across lanes. Sidewalks run continuously along streets where people walk.

Take **before** shots first, then matching after shots, seed 831, hour 10.4, into `shots/sol-crosswalks/`. Reuse `tools/shots-grok-roads.mjs` (custom views are supported as `name={json}`) or a small sibling script. Suggested cameras; adjust the first until it matches `ashe-reference.png` (tree + triangle):

| View | Camera | Files |
| --- | --- | --- |
| Ashe's junction | try `{x:-48,z:-15,zoom:10}` and the neighbouring fountain T's until the crop matches | `before-ashe-junction.png` / `after-ashe-junction.png` |
| Second fountain T | e.g. `{x:-66,z:-15,zoom:9}` | `before-fountain-t.png` / `after-fountain-t.png` |
| A current diagonal | e.g. `{x:-105,z:-77,zoom:8}` | `before-diagonal.png` / `after-diagonal.png` |

## Details

Crosswalk and sidewalk rules for this fix:

- A crosswalk exists only where a sidewalk or footpath meets the road on both sides.
- It runs perpendicular to the road it crosses, straight from curb to curb, and is set back from the junction mouth (standard intersection layout: one per leg that needs it, never diagonal across lanes, never triangles).
- Each end lands on a curb ramp or sidewalk.
- Sidewalks are continuous along roads where people walk, with no dead ends into grass or road.
- Remove crossings that don't connect.
- Pedestrian pathing must use the new crossings, and villagers still never walk on the road except at crossings.

Keep `src/roads/*` pure (no THREE, no DOM); the renderer only mirrors the walk graph.

### Town design rules (persistent)

Ashe: "you need to incorporate my feedback like this into your town compiler."

Create a single persistent design-rules file, `docs/TOWN-RULES.md`, plus a machine-checked rules module that the compiler and/or `npm run audit:roads` (and the tests) read. Every rule has an **ID**, **Ashe's original words**, the **date** (America/New_York), and an **automated check** that fails `npm run audit:roads` or the tests when the rule is violated. Do not leave a rule as documentation-only. Reuse existing audit, sim or tests where they already cover a rule, and tag those checks with the rule ID; add new checks where they do not.

Seed the file with this past feedback, dated **2026-11-17** unless the CHANGELOG records an earlier date. Use Ashe's wording below as the quote:

1. Villagers never walk on the road, only on sidewalks, paths and crosswalks, stepping onto the road only to cross.
2. Crosswalks only connect sidewalk to sidewalk, perpendicular, curb to curb, never diagonal or triangular, never inside a junction.
3. Sidewalks are continuous, with no dead ends into grass or road.
4. No terrain pieces (ramps, tracks) below ground level, and props sit on the surface.
5. No orphan structures that connect to nothing (like the leftover rest stop near the Roadster lot).
6. Roads have no dead-end stubs; every road leads somewhere (lot, junction or district).
7. Houses aren't crammed together on raised pads; give lots breathing room and variety.
8. The cel look is the default; skins are swappable data files.

Add a short `CONTRIBUTING.md` and a one-line pointer in the README: new feedback from Ashe is added as a rule plus a check, not only as a one-off code fix.

This lane's crosswalk and sidewalk work must satisfy rules 1–3 (the new audit categories below are those checks). Rules 4–8 must still be filed and machine-checked in this same change.

## Tools

- Work only in `/workspace/cel-town-wt/sol-crosswalks`. Do not touch other worktrees.
- Tests: `node --test tests/*.mjs tools/life-routines.test.mjs` and `npm run test:checks`. Also `npm run test:grok-roads`.
- Audit and sim: `npm run audit:roads`, `npm run sim:collisions`. Extend `tools/audit-roads.mjs` (or add a focused module it imports) and tests like `tests/grok-roads.test.mjs`, which already shows how to inject a fault and expect a failure.
- Shots: Playwright + `/usr/bin/google-chrome` as in `tools/shots-grok-roads.mjs`. Pick a free dev port; do not bind 5173 if it is taken.
- `public/licensed` is a symlink to the shared licensed models. Never commit licensed or derived model binaries.
- No push, no deploy, no force-push. Do not use Fast mode or Astra.

## How to work

Autonomous, with no questions. Log assumptions in an append-only decisions log at the bottom of this spec.

Study the reference and take before shots first. Fix the pedestrian-graph generator and the zebra/sidewalk renderer so the painted stripes match the walk graph residents use. Then extend the audit.

Measurable targets:

- 0 open findings in the new categories: diagonal crosswalks, unconnected crosswalks, junction-interior / triangle crosswalks, and sidewalk dead ends.
- `npm run audit:roads` reports 0 open (existing justified exceptions may remain only with a written reason).
- `npm run sim:collisions` reports 0 events.
- All tests pass: `node --test tests/*.mjs tools/life-routines.test.mjs`, `npm run test:checks`.
- A test injects a diagonal, a triangle or an unconnected crossing and the audit fails, the same way the existing stub and duplicate tests work.
- Every seeded town rule has an ID, quote, date and a check that fails when it is violated.
- Blind critic loop on the before/after shots of the worst junctions, compared side by side in random order: keep going until the after is clearly the sensible layout and the before is the one that "doesn't make any sense." Revert anything that makes it worse. Ashe's wording overrides the critic.

## Deliver

- Local commits on `village/sol-crosswalks` only; no push, no deploy.
- `docs/TOWN-RULES.md`, the machine-checked rules module, `CONTRIBUTING.md` and a README pointer.
- Extended audit and tests.
- Shots in `shots/sol-crosswalks/` (Ashe's reference, before/after of this junction plus two others, critic notes).
- A CHANGELOG entry under Unreleased.
- This spec, with the decisions log filled in.

### Decisions log

- 2026-11-17: The 18 triangles come from linking adjacent junction-corner kerbs in `buildPedestrianGraph`; counted at seed 831 before any fix. Ashe's reference shot is stored as `shots/sol-crosswalks/ashe-reference.png`.
- 2026-11-17: A tight Playwright capture on this worktree's dev server (port 5258) timed out after 300s waiting for `window.__ready`. Existing `shots/grok-roads/after-fountain.png` already shows the downtown triangles clearly. If you start a dev server, reuse 5258 if it is still serving this tree, and raise the ready timeout if the first load is slow.
- 2026-11-17: The tree, fences, and lane dashes place Ashe’s crop at the regional T at `(-174, -139)` on the Roadster approach. The two downtown cameras with similar crossing angles showed different foreground trees and street furniture. The fountain comparison stays at the High Street T near `(-66, -16)`.
- 2026-11-17: Captured the baseline before changing the street renderer and kept a local build of `98b5ce0` for matching the tighter cameras. The capture script sets the evidence zoom directly because the interactive camera clamps it to 5.
- 2026-11-17: Crossing candidates follow the actual carriageway axis beyond the mouth, including when a regional arm spans several short centerline samples. Sidewalks wrap rounded ends and connect to clipped footpaths. The short West Civic gap needed a local sidewalk detour that clears both pieces of asphalt.
- 2026-11-17: Ashe’s eight quotes have checks tagged with their rule IDs. The collision simulation uses the painted crossing band from the walk graph and no longer counts a junction interior as a legal crossing. The 14 inherited road audit exceptions retain their written reasons.
- 2026-11-17: The shuffled photo review chose the new layout in all three pairs. The exact camera views and results are recorded in [critic notes](../../shots/sol-crosswalks/critic-notes.md).
