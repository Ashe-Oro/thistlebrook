# Astra lighting pass — merge notes

Branch: `village/astra-light`.

This pass gives Astra five distinct lighting moods: peach dawn, soft daylight,
honey-coloured golden hour, lilac dusk and cool blue moonlight. It retains warm
window emission, street pools, district lights and all existing town activity.
The clock's new chevron opens five presets and a keyboard-accessible time slider.

## Integration surface

Only **`src/astra/main.js`** changes among existing runtime files. The additions
are `light-cycle.js`, `lighting.js`, `light-controls.js` and `light-controls.css`
in `src/astra/`. No compiler, placement, district, resident, catalog, shared toon,
base UI, dependency or Vite configuration files changed.

If `main.js` conflicts with another district branch, preserve these changes:

1. Import `createAstraLighting` and `createLightControls`.
2. Remove the old hemisphere/sun construction and `updateLighting` closure.
3. After **all** world and resident loading, construct
   `createAstraLighting({scene,camera,controls,renderer,town})`.
4. After `createUI`, construct `createLightControls(ui.root,h=>{hour=h;})`.
5. In `step`, after camera/controls updates, use
   `night=lighting.update(hour)` before `world.update(elapsed,night,hour)`.
   Run `lightControls.update(hour)` immediately after `ui.clock(hour)`.
6. Include `lighting` in `window.__astra` for inspection and capture checks.

Keep the lead branch's new views, bounds, district stories and UI additions.
The lighting modules don't need to know any district names or coordinates.
For content added **after startup**, call `lighting.register(newRoot)` after it
is attached to the scene. Startup content is registered automatically, including
instanced meshes and animated people. Existing material `onBeforeCompile` hooks
are chained, so the vertex-colour window emission in `world.js` survives.

The clock extension expects `.clock`, `.weather` and `#astra-clock` inside the
existing UI root. If a UI branch restructures those, update the selectors in
`light-controls.js`. It doesn't replace the original morning/3pm/evening buttons.
The time picker changes simulation time with the same semantics as those buttons;
it respects the existing pause/speed controls.

## Rendering decisions

- Linear-colour interpolation between 14 authored keys, with smooth boundaries
  and matching midnight endpoints. Time lookup is independent of frame rate;
  preset/query-hour captures don't require waiting for a fade to settle.
- One moving directional key and one hemisphere fill. The key becomes moonlight
  at night, so there is still only one directional shadow map.
- Existing 2048 shadow map fits the visible camera area and uses a texel-snapped
  anchor. Close views get clearer shadows without increasing texture memory.
- Analytic three-band toon response with derivative-width antialiasing, a darker
  foliage band, coloured shade and time-dependent ink. No full-scene blur/bloom.
- A single screen-space gradient backdrop with restrained static evening stars;
  cheap additive lantern halos at the existing streetlamp positions. No new
  point lights. Existing ground shadows are reduced to 3.5% opacity.
- The public API is `lighting.update(hour)` → practical-light intensity `[0,1]`,
  `lighting.register(root)`, and `lighting.state` for diagnostics.
- Palette/preset tuning lives entirely in `light-cycle.js`. The positional key
  fields are directions relative to the camera's target, not district locations.

## Evidence and checks

Run locally with the licensed asset mapping already supplied by this workspace:

```sh
npm run dev -- --port 5185 --strictPort
node --test tests/astra-light.test.mjs
npm run test:astra
node tools/shots-astra-light.mjs
npm run build
```

The capture runner defaults to **5185**; `ASTRA_URL` can override it. It writes
only `shots/astra-light/`, so it doesn't overwrite another branch's evidence.
All images are rendered screenshots, not copies of licensed assets.

- `00`–`01`: baseline daytime/night.
- `02`–`05`: first lighting iteration, retained as progress evidence.
- `10`–`14`: final matching downtown views, dawn through moonlight.
- `15`–`18`: overview, quay and campus lighting.
- `19`: desktop time picker; `20`–`21`: mobile night and picker.
- `evidence.json`: actual rendered pixel samples, draw/program counts, full-day
  sampling, UI input checks and browser/network errors.

Verification covers all five preset buttons, the minute slider and Home/End,
Escape/focus return, existing morning/3pm/evening controls, live clock boundaries,
pause/resume, the full cycle without shader recompilation, compiled window and
toon shader composition, and a 390px mobile viewport. Pure tests cover every
minute's valid light state and continuity at every key, including midnight.
The existing Astra suite validates 100 seeds and the connected map topology.

At the matching downtown daytime view, draw calls are 399 versus the baseline's
392; the extra work is the backdrop and visible lantern halos. No new shadow
maps or postprocessing targets. This is software-WebGL correctness evidence,
not a hardware frame-rate benchmark.

The production build passes with the repository's existing large-chunk and
mixed static/dynamic-import warnings. Owned GLBs and local library symlinks
remain ignored and are not committed. `ASTRA.md` and `astra-out.txt` were already
modified/untracked on arrival and are not part of this commit.
