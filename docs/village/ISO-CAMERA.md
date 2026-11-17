# Willowmere isometric camera

Play `/?size=medium&seed=1234&life=1` for the recommended 31-home village. `size=large` remains supported. Life mode always uses one orthographic camera: elevation `atan(1/sqrt(2))`, azimuth 45° plus its snapped heading. There is no player figure, pointer lock, walking controller, or walk/overview toggle. Non-life kit and compile views retain their original camera controls.

Wheel or pinch zoom toward the pointer / pinch midpoint. Drag empty ground, right-drag, Space-drag, or touch-drag to pan. Q/E ease through 90° heading changes. F advances three hours. Click a resident to follow them and see their current social action or schedule activity; click a building to inspect it. Click empty ground, drag ground, press Escape, or use the card’s close button to release inspection. A building or resident under the pointer gets a name tooltip. The Look panel appears only with `debug=1`.

The hash is `#x,z,zoom,h0`, for example `#12.50,-8.00,2.7500,h90`. Coordinates are the ground target in world units; zoom 1 is the whole-core fit, 2 halves the visible world span. Limits are 0.85–8. Heading values are 0, 90, 180, 270 (added to the 45° base azimuth). Finite out-of-range coordinates/zoom clamp to village bounds/zoom limits; malformed hashes fall back to the overview. Startup and later hash changes apply camera state without changing the query. Movement saves through debounced `history.replaceState`. Life ignores perspective camera requests; non-life `cam`/`target` behavior is untouched.

Bakery, inn, store, and smithy clicks reuse `interiors.js`’s existing room builder through its single iso hook. These rooms appear as roofless diorama peeks, with their near-side shell removed. The same orthographic camera views the room; no player or perspective interior camera is constructed. Closing returns to the previous village view. Room storage coordinates never enter the share hash. Other buildings ease into a closer exterior view. Names come from `town.registry` where present; resident names come from the existing roster. The life update continues schedules, social events, atmosphere, and time-aware lighting.

Runtime controls for QA and capture:

```js
__iso.state                         // { x, z, zoom, heading }
__iso.bounds                        // minX, maxX, minZ, maxZ
__iso.setView({ x: 0, z: 0, zoom: 3, heading: 90 })
__iso.setView({ zoom: 1 }, { immediate: true })
__iso.zoomAt(1.2, 640, 360)         // CSS viewport pixels
__iso.rotate(1)                     // clockwise quarter-turn
__iso.ground(640, 360)              // ground world Vector3
__iso.pick(640, 360)                // resident/building hit record or null
__iso.select(hitRecord)             // same path as pointer click
__iso.cancel()
__life.camera === __iso
__life.step(1 / 60)                 // deterministic capture update
__life.interiors.enter('bakery')
__life.interiors.exit()
__post.render(__stage.camera)
```

The shared renderer, material ramp, lighting, and post stack remain intact. Life defaults to Kuwahara radius 2, crease weight 0.35, ink width 1.2, and no palette quantization to preserve small details; explicit query values override these choices. Inverted-hull thickness is capped at roughly 0.85 drawing-buffer pixels as zoom changes, accounting for imported model scales; existing authored widths are retained below that cap. Screen-space ink preserves overview edges. The single post hook scales the absolute orthographic depth threshold by world units per pixel, so a continuous ground slope does not become solid ink at overview. No DOF is added. `post=0`, `prmax`, `shadowMap`, and all existing debug globals still work.

Run `npm run build`, then `npm run shots:village-iso` (or `-- --stills-only` / `-- --video-only`). The harness uses local Chrome and SwiftShader, drives the iso API, checks camera invariants and input controls, and writes PNGs plus a 24-second 1280×720 H.264/yuv420p film to `shots/village-iso/` (96 post-processed keyframes, interpolated from 4 to 24 fps with ffmpeg). Stills and film use the post stack. The film advances the simulation at timescale 12 with an eased overview-to-street pan and zoom. `--video-only` can resume encoding from a complete PNG set; movement evidence is checkpointed before encoding. `evidence.json` records checks, view states, options, and the video probe. `node --test tests/life-iso.test.mjs` covers hash validation, normalization, clamp, the true iso angle, distance-fog rejection, and shadow coverage across pans, zooms, and rotations.

Iso uses a soil-sided island with subtly varied meadow colour and a plain background. The sky dome and backdrop hills are hidden. Distance fog is explicitly rejected by one marked hook in `fog.js`. Shadows fit the visible ground and a 20-unit caster envelope each frame. Garden beds, laundry, short fences, path edging, clustered forest edges, and twelve ambient neighbours are runtime additions; the original twelve inspectable residents retain their schedules and interactions. Decorative woodland outliers do not inflate framing; dressing outside the island and field furniture far from buildings are hidden in runtime batch matrices.

Only runtime life code and single-line life/interiors/post/fog hooks change behavior. The single added package script is the capture hook. Compiler, registry, catalog, schedules, resident simulation, and lighting-polish internals are unchanged.
