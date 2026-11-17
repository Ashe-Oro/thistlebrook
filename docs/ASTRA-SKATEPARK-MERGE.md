# Switchyard Skate & Bike Park

Branch: `village/astra-skatepark`. Open `http://localhost:5195/?view=skatepark&hour=15.5&seed=831` or use the **Skate & Bike** view button.

The new park sits east of the basketball court, south of the stadium. It has a raised teal bowl with coping and entry steps, a quarter pipe, flat grind rail and manual pad, a terracotta BMX pump loop with six rollers, spectator benches, a water tap, lights, parking rack and an entrance sign. Three helmeted skaters and two BMX riders use the equipment; six owned-kit spectators watch. Normal town residents can choose the park and walk through its gate.

## Merge surface

Most work is isolated in three new modules:

- `src/astra/skatepark-layout.js`: dependency-free venue declaration and camera preset. Bounds are **x 40.5–63.5, z −67–−35.5**, centre `[52, -51]`. Entry `[46, -37]` connects to `[46, -33]` on the existing campus lane. Reserve this parcel before scattering trees; do not place another expansion here.
- `src/astra/skatepark-motion.js`: pure time-based bowl, street and bike routes, plus surface heights used by the renderer and tests.
- `src/astra/skatepark.js`: local-space geometry, furniture, owned asset references, articulated riders, animation and audit. `buildSkatepark(scene, town)` returns `update(t, hour, night)` and `audit()`. Missing venue is a no-op. The static geometry is instanced; all animations follow the existing town clock.

Small shared-file hooks to preserve when resolving parallel merges:

1. `src/compiler/astra.js`: import `SKATEPARK` and add `structuredClone(SKATEPARK)` to `town.venues` before reservations and graph generation. No bounds, island, road topology or existing district changes.
2. `src/astra/world.js`: import/build the park; expose it as `world.skatepark`; call `skatepark.update(t, hour, night)` from the existing world update. District venue picking automatically includes the new parcel.
3. `src/astra/main.js`: import the camera preset, register `skatepark` in views and the query allowlist, and add the venue's description.
4. `src/astra/ui.js`: add the **Skate & Bike** navigation button.
5. `tests/astra.test.mjs`: venue count changes from eight to nine. Reconcile this count with other merged venue additions.

The park does not change the shared resident roster or resident AI. Dedicated local sports actors use authored activity loops, consistent with existing town sports; they are not full rigid-body simulations or interchangeable members of the global roster. Global residents arrive at the entrance rather than taking over rider rigs. Bowl turns are exclusive, BMX riders are half a lap apart, and the street line has one rider. Park activity is visible 06:00–22:00. There is no NPC dialogue.

## Assets

Reuses licensed `cv-bicycle`, `cv-bench` and existing `townsfolk-*` models through the catalog loader. The source bicycle is in the owned Cozy Village library under `/workspace/threejs-assets`. Ramps, bowl, dirt course, BMX rigs, boards and articulated helmeted riders are procedural toon geometry. No licensed GLBs or raw asset files are committed.

## Verification and evidence

```sh
npm run dev -- --port 5195 --strictPort
npm run test:astra
node --test tests/skatepark.test.mjs
npm run build
node tools/shots-astra-skatepark.mjs
node tools/film-astra-skatepark.mjs
```

- Existing map suite: all five tests pass, including 100 seeds and paths between every pair of buildings and venues.
- Park tests: entry is inside the parcel and reachable from every home; trees remain outside; 132 seconds sampled every 25ms stay within the parcel, have continuous positions, no rider collisions, all expected activities, bowl surface contact and exclusive bowl turns.
- Browser: no runtime/asset errors; view navigation, pointer picking, pause/resume, 3× speed, closing time, mobile and evening render verified. Fern, Pip, Bea, Ada and Theo actually reached the park through normal resident routing.
- Production build passes with existing large-bundle/dynamic-import warnings. Builds do not copy the licensed public library.
- `shots/astra-skatepark/` contains the first build, final daytime action, details, whole-town context, evening, mobile, machine-readable evidence and a 16-second H.264 MP4.
- A first film attempt closed its capture browser after reloading a fully exercised scene. The standalone film runner starts a fresh browser and avoids that extra scene load.

The pre-existing working-tree changes to root `ASTRA.md` and untracked `astra-out.txt` belong to the orchestration context and are excluded from this commit.
