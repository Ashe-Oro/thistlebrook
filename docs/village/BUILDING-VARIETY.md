# Opt-in building and wardrobe variety

Open `/?size=large&seed=1234&life=1&variety=1`. Omit `variety=1` for the original rendering. `window.__variety.ready` is the completion signal; `error` records loading failures. Life is needed for the resident cast, but houses and farmyard additions also work without it.

The single marked catalog import starts a browser-only runtime after the existing town is ready. It never alters CATALOG, compiler pools, compiled instances, registry, schedules or navigation. No flag means no runtime import or variant GLB requests. `window.__variety` lists appearances and extra prop positions for inspection.

Four owned house meshes cycle through residential lots: farmhand cottage, Autumn farm cottage, farmhouse and townhouse. Each visual fits inside its original XZ envelope, retaining the original pivot and front edge. Seven civic/farm landmarks receive gentle alternating warm, sage and lilac tints. Twelve additional measured Autumn catalog meshes make an eastern harvest yard: cider press shed, garden shed, harvest pavilion, root cellar, bushel basket, apple crate, cornucopia, garden cart, potted mums, orchard signpost, farm stand sign and harvest lantern. These bring previously unused non-default architecture and props into the town without enabling the whole autumn season. A deterministic grid search rejects overlapping full prop envelopes against the frozen town's paths/footprints and earlier additions. Buildings remain visual substitutions; navigation and interiors continue to use original architectural metadata. The four looks reuse owned architecture rather than claiming newly imported building models.

The twelve original townsfolk ids keep their names, roles, schedules, proportions and navigation pivots. Their visual children change to new Character Model Basic + Wardrobe exports: braids, ringlets, curly bobs, different hats, long skirts, overalls, boots and elder glasses. No Edo characters are used. Variants have separate runtime-only catalog ids (`variety-*`), `source: 'mesh'`, `licensed/...` paths, commercial credits, and geometry-derived bounds in `src/catalog/building-variety-bounds.json`. They go through the existing MeshToonMaterial and inverted-hull loader. Their source/foot bounds never replace default cast bounds.

## Owned asset credits / regeneration

ThreeJS Assets lifetime commercial library: Cozy Village, Farm, Autumn, Character Model Basic 1.1.0 and Character Model Basic Wardrobe 1.0.0. Existing meshes under `public/licensed/cozy-village/`, `public/licensed/farm/` and `public/licensed/autumn/` were reused. No purchases, downloads, signed links or Village Folk retries were needed.

Run `node tools/generate-building-variety.mjs` to reproduce the twelve GLBs under gitignored `public/licensed/characters/variety/` and their derived sidecar bounds. The script reads and adapts the existing art-owned exporter in memory so its relaxed pose, facial marks and trade tools stay consistent; it never edits or regenerates default character files. It expects the installed owned source packs at the same paths as the established generator. Do not commit or distribute the licensed GLBs.

## Verification and capture

- `npm run test:checks`
- `npm run test:parity`
- `node tools/check-building-variety.mjs` checks the six frozen life-off hashes and the twelve owned variants. Hash evidence is in `out/building-variety-hashes.json`.
- `npm run build && npm run shots:village-buildings` uses the M2 local Chrome / SwiftShader harness. It checks opt-in versus default compiled life JSON, model count, feet grounding, toon materials and hulls. Shadow-map rendering is disabled in captures to keep software rendering practical. It writes houses, props, props-stock, harvest-yard, civic and villagers PNGs plus an eight-second MP4 in `shots/village-buildings/`.

The villagers still and video temporarily arrange the live residents in two rows for appearance inspection; this exists only in the capture tool. Normal gameplay keeps their scheduled positions. The runtime is asynchronous and intentionally does not redefine the shared `__ready`; consumers should additionally wait for `__variety.ready`. The opt-in runtime changes visuals, so default collision/navigation footprints and interior transitions retain their existing semantics. A future architecture-authoring integration should supply exact replacement door/entry metadata before making these compiler-selected buildings.

Use `npm run shots:village-buildings -- --props-only` to refresh farm framing after a full capture, preserving its other evidence and clip.
