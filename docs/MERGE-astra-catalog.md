# Merge notes: asset catalog / map compiler

This branch adds the owned-library metadata, grouping and scene compiler described in [ASTRA-CATALOG.md](ASTRA-CATALOG.md). No owned model, texture, generated character GLB, or commercial source is committed. Rendered screenshots are evidence.

## Main additions

- `src/catalog/library/`: measured inventory, editable semantic and scene data, shared pure accessors/validator, private browser loader, atlas, and private-disk Vite middleware.
- `src/compiler/library-scenes.js`: deterministic recipe and family assembly, measured spacing, approach checks, world transforms and graph connectors.
- `src/astra/catalog-scenes.js`: 14 props / seven independent rigged activity performers in three compiled scenes.
- `tools/inventory-library.mjs`: repeatable inventory and geometry measurement; hash-based reuse or `--fresh`.
- `tests/astra-catalog.test.mjs`, capture tools, `catalog.html` and package scripts.

## Shared-file integration points

1. **`src/compiler/astra.js`** imports the new compiler; builds and reserves scenes after building parcels and before props/trees; adds activity approaches to the existing graph; includes scene checks and report counts. Keep this ordering when merging placement changes. The orchard promenade runs from (−76,20.5) to (−22,20.5). Scene coordinates are data in `scenes.json`, not renderer constants.
2. **`src/astra/world.js`** builds the compiled scenes and calls `catalogActivities.update(t)` from the common simulation clock. Its returned `catalogActivities.audit()` is used by capture checks.
3. **`src/astra/main.js` / `ui.js`** add Harvest, Camp and Tea court views. The three names also work as `?view=` values. The UI hint now describes following a neighbour.
4. **`src/astra/residents.js`** removes greeting interruption logic and speech sprites. Existing roster, destination choices and movement remain. Do not restore dialogue bubbles when merging resident work. Local scene performers are independent of the 32 original residents; route planners can use `town.interactions[].node` and the slot contract next.
5. **`vite.config.js`** adds `catalog.html` to build inputs and private library middleware for dev/preview. Port is 5187 with `strictPort: true`, as requested for this branch. A shared integration branch may choose its own explicit port without changing asset data. Preserve `copyPublicDir: false`.
6. **`package.json`** adds `catalog:inventory`, `test:catalog`, `shots:catalog`, `shots:catalog:groups`; preserve the other instances' scripts.

## Evidence and limits

The metadata accounts for 561 GLBs plus 86 format aliases. Contact-sheet coverage includes every GLB; reference scenes and atmospheric assets use labelled measured envelopes to avoid loading giant scenes into every card. OBJ/FBX files are aliases of GLBs, not independently measured meshes. No archive extraction is needed.

Most semantic slots are bounds-inferred and disabled pending inspection. The enabled demo slots have authored approaches; two bench types have sampled seat heights. Animation uses procedural bone poses, with no authored motion clips invented. AABBs are conservative and include overhang, while the measured convex footprints are retained for later use. Specialty surface and attachment planners remain explicit extension points.

Validation: complete on-disk inventory coverage, schema rejection checks, deterministic family selection, rotated footprint/slot checks, minimum/maximum spacing rejection, blocked-approach rejection, graph reachability, tree reservations, existing 100-seed Astra suite, production build, three rendered scenes, seven complete activity cycles, pause freezing, atlas metadata dialogs and browser-console checks. Capture scripts use port 5187 only.

Existing user changes in root `ASTRA.md` and untracked `astra-out.txt` are intentionally excluded from this commit.
