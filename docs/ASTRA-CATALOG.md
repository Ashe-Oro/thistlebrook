> Asset lane update: [seventeen new vignettes](MERGE-sol-assets.md) add 56 placed props, 55 previously unused models and 56 resident activity points at seed 831. The town now has 36 catalog scenes and 79 slots; unused individual models fall from 386 to 331. The initial gallery implementation below is retained as historical context.

> Registry update: [18-district prop coverage](MERGE-sol-registry2.md) adds nine compiler-planned supply/rest scenes, nine selectable families, model identities through batching, and an [unused asset report](REGISTRY-UNUSED-ASSETS.md). The current town has nineteen catalog scenes and twenty-three catalog slots.

> Integration update: [Round 2](ASTRA-ROUND2.md) extends this catalog to ten town scenes and fourteen slots across nine districts. The town uses named resident reservations; the separate gallery performers described below are only used by the catalog demonstration.

# Astra asset compiler catalog

The owned library is now compiler data. `src/catalog/library/assets.json` inventories every loose GLB under `/workspace/threejs-assets`; model files and textures remain on private disk. `catalog.html` is a searchable visual atlas. In the town, **Harvest**, **Camp**, and **Tea court** jump to three compiled examples.

## What is accounted for

| Pack | Measured GLBs |
| --- | ---: |
| autumn | 64 |
| character-model-basic | 3 |
| character-model-basic-wardrobe | 54 |
| cozy-village | 92 |
| edo-village | 82 |
| farm | 139 |
| free | 44 |
| nature | 83 |
| **Total** | **561** |

These are **467 individual models**, **21 prebuilt scenes**, **7 whole-pack scenes**, and **66 authoring copies**. The free pack also contains **43 OBJ and 43 FBX alternate exports**, recorded as 86 aliases of their GLB counterparts. Thus all **647 loose model files** are accounted for. Archives and generated component source are not additional loose models. Alternate-format dimensions refer to the canonical GLB; OBJ/FBX files are not independently decoded. Authoring GLBs, in contrast, are measured independently and link to their runtime counterparts.

Every record belongs to one of 25 scene families. The atlas captures every record across 37 contact sheets, including clearly labelled measured envelopes for reference scenes and atmosphere assets. Large references are not downloaded into the atlas. The 467 atomic assets include 28 atmospheric models; their bounds are represented by envelopes too.

## Data contract

`assets.json` is generated metadata, `semantics.json` contains classification rules, activity definitions and explicit per-model overrides, and `scenes.json` contains family compatibility, distances, recipes and placements. `validate.js` validates the contract without Three.js or disk access. Semantic defaults are name-based and editable; they are not claims that a classifier can discover a doorway or chair seat from a bounding box.

Each asset includes:

- Stable `pack/name` identity, source-relative path, content SHA-256, external dependencies, license reference, kind and optional canonical counterpart.
- Category, searchable tags, scene-family memberships, surface and mount requirements. Character and accessory models are distinguished from ground props; authoring copies and whole scenes cannot enter prop selection.
- Decoded geometry bounds, ground bounds, full XZ convex footprint, triangle count and town-scale dimensions. Mesh node world transforms are applied, including every instance of a mesh. Skin measurements describe the bind pose, not a swept animation volume.
- A normalization transform: **town-local point = (source point − origin) × scale**. Origin is the source AABB's XZ center and lowest Y. The legacy pack scale is retained for Cozy/Farm (1.6), Autumn (1.1), Edo (1.25); Nature and characters use 1. Scale choices are authored, not inferred units.
- Embedded animation clip names and procedural activity animation identifiers. Missing embedded clips are represented by an empty array.
- Interaction slots with local position, standing approach, facing yaw, capacity, clearance and provenance. All slots are exclusive and dialogue is explicitly disabled.

Measurements come from actual decompressed vertex positions, not filenames or declared accessor bounds. The full footprint includes canopy and roof overhang. `geometry.ground` samples vertices in the lowest 12% of height, clamped to 0.03–0.35 source units. Values are rounded to 0.00001 source units; AABB minima/maxima round outward. The compiler conservatively collides rotated full AABBs; the convex polygons remain available for a future tighter solver. Terrain, skins, water, hanging pieces and attachment sockets need their specialized planners.

There are 119 inferred or authored interaction slots, nine enabled. Seven enabled slots occur in the three town examples; the other two are the Cozy bench. Generic bounds-inferred slots stay **disabled**. Geometry-sampled seats and manually authored demo approaches are separate provenance classes. Seat surfaces were sampled at Cozy Y=0.475 and Nature Y=0.470 (Nature's source minimum −0.030 makes its normalized seat height 0.500). Authoring a slot does not turn a rigid model into an animation rig.

## Compilation and placement

`compileScene(recipe, center, yaw)` resolves metadata and returns member transforms, conservative boxes, a reserved front aisle, world-space interaction slots and their aisle landings. All assets in a recipe are grounded atomic props. Fronts align along a common aisle, and the whole scene can rotate. The initial three recipes use explicit model choices to make inspection reproducible.

`compileGroupScene(groupId, { seed, pack, limit, center, yaw, surface })` selects an anchor from the family's pool and additional members from the same family or declared companions. It honors pack filters, required surfaces, mount types, radius and pair-distance rules. It is deterministic, never changes the catalog, and refuses sky/reference/shoreline/tile families without their specialized anchors. Interior families require an interior floor explicitly.

Distances are **edge-to-edge town metres**, not center radii. Current constraints include fire/building ≥2.2m; fire/seat 1.5–4m; market/storage 0.45–3m; table/seat 0.45–1.4m; tree/building ≥1.2m; instrument/market 1–5m. Maximum distance applies to a declared companion relationship. Minimum clearance applies to every member pair. The aisle is 0.9m wide with 2.8m front setback. Actor approach clearance is 0.38m per side. Group radii bound generated scenes.

`compileTownScenes()` runs after buildings and before props/trees. It reserves all three complete scenes, including their aisles, against later placement. A southern promenade connects Camp and Harvest to the existing orchard bridge. Tea connects to the east spine. No extra river crossing is introduced. Aisles and standing approaches participate in the existing graph split; each slot has a reachable `node` in `town.interactions`. The checker rejects blocked approaches, spacing failures, props in roads or river, off-island scenes, and overlapping scene reservations.

## Visible behavior

Three scenes contain **14 props and seven rigged visitors**:

| Scene | Props and activities |
| --- | --- |
| Cider & Harvest | Autumn stand, apple crate, basket, mums and lantern; browse and sort |
| Willow Camp | Nature tent, fire ring, log bench and berry bush; warm hands and sit |
| Lantern Tea Court | Edo food stall, taiko drum, tea table, bonsai and stone lantern; browse, drum and eat |

`src/astra/catalog-scenes.js` renders the compiler output and gives each visitor an exclusive slot lease. Visitors perform a procedural bone pose, leave through the approach, walk to the aisle, release the slot, and return after a pause. The simulation clock controls movement and animation, so pause freezes both. Actual source wardrobe rigs are cloned with independent skeletons; source colors and embedded/external textures are retained under toon shading.

These seven are local scene performers, separate from the existing 32 resident routines. The existing residents still use their destination graph. Their greeting pauses and speech-bubble rendering were removed; no NPC conversation system is added. The compiled slot/node contract is available for the resident/scheduling instance to adopt. Procedural activities demonstrate affordances; they are not inventory transactions or a full occupation simulation.

## Reproduce and inspect

```sh
npm run dev -- --port 5187       # strictPort; no fallback port
npm run catalog:inventory       # reuses measurements only for identical SHA-256
npm run catalog:inventory -- --fresh  # decode every GLB again
npm run test:catalog
npm run test:astra              # includes the existing 100-seed/path sweep
npm run build
npm run shots:catalog
npm run shots:catalog:groups
```

Set `ASTRA_ASSET_ROOT` to relocate the private library. Vite's private mapping serves GLBs and their image dependencies under `/owned-assets/`; it serves no source archives, OBJ/FBX exports, or arbitrary paths. Both dev and preview use this mapping. Builds have `copyPublicDir: false`: licensed geometry and textures never enter the public build output. The new atlas is included as a Vite entry point.

Open `http://localhost:5187/catalog.html`, `/?view=harvest`, `/?view=camp`, or `/?view=tea`. Evidence lives under `shots/astra-catalog/`: town views and `evidence.json` demonstrate completed activity cycles and pause behavior; `groups/coverage.json` records all 561 inspected atlas records and zero browser errors. Reference envelopes are inspection aids, not rendered whole-pack scenes.
