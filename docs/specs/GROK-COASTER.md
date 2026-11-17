# GROK-COASTER: make Copperhead read as one clean coaster

## Reference
- Gold still: Ashe's screenshot `/workspace/refs/roads/ashe-coaster.png` (the
  camelback run of Copperhead beside the north fence of Pinecrest, deployed
  build 7c6d639). Same camera in this worktree: `{x:202, z:-96, zoom:6}` at noon
  (`shots/grok-coaster/before-ashe.png`).
- Measurable defects in the still: 4 dark ladder-like "tie" shapes crossing the
  track at the wrong pitch, one at each slope-start/slope-end piece of the
  camelback; the rail ribbon looks doubled where they cross.
- Target: zero stray pieces; a single rail ribbon per piece; every support
  centred under the rail (within 0.25 m) and spanning ground to piece base.

## Details
- Track: 30 kit pieces from `layCoaster` (`src/astra/themepark-coaster.js`),
  placed in `src/astra/themepark-rides.js`. Mirrored pieces (D0, D, D1 down
  slopes; station) use baked mirrored geometry from
  `loadFairgroundGeometry(name, mirror)` in `src/astra/themepark-assets.js`.
- Every pack mesh gets an ink hull (`fairgroundMesh`), cached per geometry.
- Other track rides in Pinecrest: Little Racers (kiddie loop) and the Pinecrest
  Express tram. Neither uses mirrored or kit geometry; checked in the same pass.
- Out of scope: road and pedestrian files (lane village/grok-roads).

## Tools
- Port 5216 dev server; `node tools/shots-grok-coaster.mjs --tag before|after`
  and `--film` for the ride clip (headless Chrome, SwiftShader).
- Raycast probe in the browser to name the mesh behind a stray pixel.
- `node --test tests/astra-themepark.test.mjs tests/themepark-coaster.test.mjs`,
  the full `node --test tests/`, and `npm run test:checks`.

## How to work
- Decisions log (below), probe before fixing, fix at the source, prove with a
  test that fails on the old code.
- Draw calls and triangles must not grow (the fix changes which hull a mesh
  uses, not how many).
- Decisions:
  1. Raycast showed the stray "ties" are ink-hull triangles of
     `coaster_track_slope_start/_end`, not track pieces.
  2. three r169 `BufferGeometry.copy` shares `userData` by reference, so the
     mirrored clone and the source share `userData.hull`; whichever is built
     first is reused for both. Unmirrored up-slopes got the hull of the
     mirrored down-slope (or the reverse): a dark outline sloping the wrong way.
  3. Fix: hulls live in a `WeakMap` keyed by geometry, and mirrored clones get
     their own `userData`. Support placement moves into the pure coaster module
     so a test can check it against the centreline.

## Deliver
- Before/after PNGs at Ashe's angle and an ~8 s ride clip in
  `shots/grok-coaster/` (screenshots only, committed like other lanes' shots;
  no GLBs or derived model files).
- Tests: supports under the rail and reaching the ground; pieces joined end to
  end with continuous heading; mirrored geometry gets a mirrored hull.
- CHANGELOG entry; local commit on `village/grok-coaster`; no push, no deploy.
