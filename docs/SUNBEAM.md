# Sunbeam Terrace

A second residential neighbourhood with a denser, urban character: nine narrow
three-storey buildings, representing eighteen homes, face a shared pedestrian
court. Nell’s Corner and The Washhouse have flats upstairs. Slate roofs,
pastel plaster, shutters, iron balconies, window boxes and rear pocket gardens
contrast with Willowbank’s detached cottages.

Eight named, selectable residents live here: Nell, Otis, Cleo, Rafi, Mae, Sol,
Zara and Emil. They use the town’s normal navigation, greetings, following and
nighttime home routine. Their errands include the grocer, laundry, school and
bookshop. Six additional courtyard figures chat, tend plants and play chalk
games; these are authored animation loops. Washing flutters, a pinwheel turns,
and windows and streetlamps light up at dusk. Pause and simulation speed apply
to all courtyard animation. Household capacity is descriptive, not an economic
or occupancy simulation.

## Preview and evidence

Use port **5183** on this worktree:

```sh
npm run dev -- --port 5183 --strictPort
# http://localhost:5183/?view=sunbeam&seed=831
node --test tests/astra.test.mjs tests/sunbeam.test.mjs
node tools/shots-astra-homes.mjs
npm run build
```

The Sunbeam Terrace tab, `?view=sunbeam` and `__astra.view('sunbeam')` open the
neighbourhood. The phone camera frames it more closely. Click a home to read
its story; click a named resident to follow their day.

Screenshots and the browser audit live in `shots/astra-homes/`. The runner checks
actual pointer selection, the view tab, pause/resume, each resident reaching the
wider town and returning home, following Nell, rotation and mobile rendering.
The existing campus/downtown capture runner now accepts `ASTRA_SHOTS_DIR` so
regression evidence can be captured without overwriting other branches’ shots.

## Merge boundaries

- `src/astra/sunbeam-layout.js` owns the footprint, road additions, roster and
  camera preset. Its compiler hook runs **before** furnishing, foliage and graph
  construction. The courtyard reservation prevents seeded trees growing into it.
- `src/astra/sunbeam.js` owns geometry, licensed furnishings, animation and
  selection bounds. It batches static meshes and shares toon materials.
- The district occupies **x −79 to −43, z −69 to −34**. It lifts the northwest
  notch from z −35 to −70, preserving the rest of the existing island outline.
  If another expansion replaces those notch vertices, include this rectangle
  in the merged outline. No river crossing or existing parcel is moved.
- The main court runs from `[-77,-52]` to `[-40,-52]`. Exits at x −61 and x −40
  reach z −33 and join the existing campus approach at `[-34,-33]`.
- Nine `custom: true` buildings use stable keys `sunbeam-0` through `sunbeam-8`.
  The world’s kit loader and chimney pass skip custom buildings; this renderer
  owns them. Ordinary residents can visit them through the shared graph.
- Small hooks in `main.js`, `ui.js`, `world.js`, `residents.js` and the compiler
  register the district. The UI district count is derived from compiled data.
  Existing regression counts are minimums so additive districts can coexist.

Private Cozy Village furnishings and generated Character Model Basic/Wardrobe
people load through the existing licensed mapping to `/workspace/threejs-assets`.
No raw licensed models are committed or copied into the production build.
