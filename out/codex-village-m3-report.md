# Living Village — M3 interiors

Worktree: `/workspace/cel-town-m3` · branch: `village/m3-interiors`.
Play: `/?size=large&seed=1234&life=1`.

## Delivered

Four furnished spaces are reachable from their existing civic doors: bakery,
inn, general store and smithy workshop/back room. Press **E** at the exterior
prompt. A 0.6-second fade moves the player into the room. Press **E** at the
marked exit or walk through its opening to return to the saved exterior
position. Exterior architecture and gate collisions remain intact.

The bakery has a timber counter, bread shelves, jars, hearth, grain sacks,
barrel and a small table. The inn has laid tables, spindle chairs, mugs,
plates, a serving counter, shelves, bench and hearth. The store has a counter,
books, jar shelves, produce crates and barrels. The smithy has an anvil on a
stump, workbench and tools, forge, firewood, crates and storage.

Each room has a plank floor at player ground level, plaster walls, timber
framing, ceiling, windows, rug and a framed doorway. Furniture collides with
the player. Two supported, framed brass lanterns per room have switchable
lenses and actual point lights. Press **E** nearby to extinguish/light them;
states survive leaving and re-entering rooms. Bakery/store counters and
outdoor market stalls also respond to **E** without an inventory system.

## Implementation and merge surface

- `src/life/interiors.js`: runtime rooms, furniture, lanterns, interactions,
  indoor movement/collision, shoulder camera and fade.
- `src/life/doors.js`: pure runtime plans, safe exterior triggers and the
  namespaced `life-interiors` validation.
- One `// WORKTREE-HOOK interiors` block in `src/life/index.js` loads the module
  after the existing life API is created. The existing walk camera is imported
  by life and wrapped only at runtime; its file is untouched.
- Additive `life-interiors` negatives in `tools/check-negatives.mjs`; one package
  script; the README Interiors subsection; the independent M3 capture harness.

No compiler, social, people, schedule, camera, day/night, graph, town-instance
or existing capture files were edited. No new catalog entries were needed:
rooms use code-built timber furniture and already catalogued village/farm
props through the existing toon/hull loader. Catalog bounds are unchanged.
Modern kitchen appliances were excluded. No licensed GLBs were copied or added
to git. The live review tree and other worktrees were not edited.

`__ready` and the existing `__life` API remain available. `__life.interior` is
`null` outdoors or `{id,name}` indoors. `__life.interiors` exposes room and door
plans, the player, fixture state, `enter`, `exit`, `view` and `inspect()`.
`?interior=bakery|inn|store|smithy` starts immediately inside and returns to that
building's safe doorstep. The four-space requirement is checked on seed 1234;
other seeds create rooms for the civic buildings actually present.

## Verification

Final results and recording metadata are in `shots/village-m3/evidence.json`.

- `npm run test:checks`: passes, including missing-bakery and trigger-inside-wall
  negatives, safe triggers on additional seeds, and life-off exclusion.
- `npm run test:parity`: passes both Vite SSR and the one-ulp math perturbation,
  including existing frozen default-layout fixtures and life/Edo variants.
- `npm run build`: passes; existing large-bundle advisory remains.
- Browser: keyboard entry/exit for all four rooms; side-wall collision; solid
  bakery/store counters; outdoor wall collision; market-stall use; lantern
  off/on; direct `interior=store` URL; feet at y=0.
- Life-off SHA-256 values for hamlet/large seeds 1, 7, 19 and 1234 match the
  pre-change worktree snapshot in `out/codex-village-m3-baseline.json`.

During review, the indoor camera could be disrupted through the existing Look
mode buttons, and the shared exterior mouse-look handler also consumed indoor
mouse events. Both are guarded inside this module. Tab/M gives a return-to-door
hint indoors. A low crossbeam was raised to keep the exit camera readable.

## Evidence

`shots/village-m3/` contains `bakery.png`, `inn.png`, `store.png`, `smithy.png`,
`doorway.png`, `lantern.png`, `evidence.json`, and `village-interiors.mp4` with
start/transition/interior/lantern/end proof frames. The movie is a continuous 12-second
1280×720, 12fps H.264 recording with yuv420p pixels: street approach, E entry,
walking to the counter, lantern off/on and walking through the exit. The final
harness records the real fade and prompts along with the canvas. Stills retain
the full post stack; video disables post, hulls and shadows for SwiftShader.

## Scope and remaining limits

Rooms use separate runtime coordinates and a fade portal rather than carving
licensed single-mesh building GLBs. The doorway is a real opening in the room's
collision boundary. Existing outdoor wall and gate colliders stay solid.
Lanterns are player-operated and are session state. NPC routing into rooms,
stock/inventory and furnishing homes are outside M3. Overview mode is available
again after returning outdoors.

No purchase, push, deployment, external API, model service, or discrete GPU was
used. Work is committed locally on `village/m3-interiors`.
