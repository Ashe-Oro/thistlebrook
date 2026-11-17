# Asset lane merge notes

Based on local branch head `896450e` (extended 18-district registry). Development and browser verification use **5202 only**, with strict port selection. No licensed models, textures or private symlinks are included in this commit. Existing untracked `SOL.md` and `sol-out.txt` are left alone.

## Result and unused counts

At seed 831, **17 new small vignettes place 56 props**, bringing **55 previously unused individual models** into fitting exterior settings; the log bench is reused. Every new prop has an executable, exclusively reservable activity point. The town now contains **36 catalog scenes, 111 catalog props and 79 catalog slots**. Registry coverage is **726/726 placed models**, **1,599/1,599 logical placements**, and **1,828 total place records**. Scenery utilization grows from **81 to 136 distinct models**. Individual unused counts fall from **386/467 to 331/467** (14.2% fewer unused).

Counts compare the same seed and scenery metric at the baseline commit. Actors do not count as scenery, alternate exports are aliases, and the 94 authoring/prebuilt/whole-pack references remain excluded from individual candidates.

| Pack | Unused before | Unused after | Newly used |
| --- | ---: | ---: | ---: |
| autumn | 51 | 32 | 19 |
| character-model-basic | 3 | 3 | 0 |
| character-model-basic-wardrobe | 54 | 54 | 0 |
| cozy-village | 61 | 53 | 8 |
| edo-village | 70 | 56 | 14 |
| farm | 49 | 41 | 8 |
| free | 44 | 44 | 0 |
| nature | 54 | 48 | 6 |
| **Total** | **386** | **331** | **55** |

The actor packs and Free pack stay unchanged: residents and accessories need their actor/attachment controllers. Interiors require floors and door anchors; atmospheric variants need the weather system; water and terrain require shoreline/tile planners. They are not used as arbitrary ground decoration. The full remaining list is [REGISTRY-UNUSED-ASSETS.md](REGISTRY-UNUSED-ASSETS.md), and [utilization.json](../shots/sol-assets/utilization.json) records the exact newly used model IDs and baseline counts.

## Groupings and evidence

Clover Fields gains a pumpkin pantry, a pumpkin-growing corner and a harvest tool stop. The Hinterlands gain a hay delivery bay, tractor service bay, milk/feed supplies, watering stations and a woodcutters’ pause. Civic Green gains a community plant exchange, ornamental listening garden, stone/rake study, lantern preparations, a naturalists’ noticeboard and a meadow edge. Sunbeam gains a leaf-collecting corner. Signs, crops, tools and rocks retain their source tags and measured sizes, with four additional selectable scene families declaring the intended companions.

Each screenshot below shows the actual resident-owned runtime with private assets loaded. Coordinates are world X/Z at seed 831; use the normal camera/share-view controls to inspect them.

| Vignette / screenshot | District | Props / slots | Centre X, Z |
| --- | --- | ---: | --- |
| [Hay delivery nook](../shots/sol-assets/vignette-hay-delivery.png) | outskirts | 4 | 27.50, 71.50 |
| [The smallholding service bay](../shots/sol-assets/vignette-farm-service.png) | outskirts | 4 | 30.11, 42.25 |
| [The garden exchange](../shots/sol-assets/vignette-garden-exchange.png) | civic-green | 4 | -88.50, -47.50 |
| [The stone study](../shots/sol-assets/vignette-stone-study.png) | civic-green | 4 | -87.50, -43.50 |
| [Pumpkin growers’ corner](../shots/sol-assets/vignette-pumpkin-growers.png) | orchard | 3 | -7.50, 24.00 |
| [The listening garden](../shots/sol-assets/vignette-water-garden.png) | civic-green | 4 | -96.50, -45.50 |
| [The leaf collectors](../shots/sol-assets/vignette-leaf-corner.png) | sunbeam | 3 | -108.50, -45.50 |
| [Woodcutters’ pause](../shots/sol-assets/vignette-woodcutters.png) | outskirts | 4 | -15.50, 43.50 |
| [The last harvest](../shots/sol-assets/vignette-harvest-tools.png) | orchard | 4 | -6.50, 32.50 |
| [Lantern night preparations](../shots/sol-assets/vignette-lantern-supplies.png) | civic-green | 4 | -97.50, -38.50 |
| [Pumpkin pantry](../shots/sol-assets/vignette-pumpkin-pantry.png) | orchard | 4 | 2.50, 24.00 |
| [The morning milk round · supplies](../shots/sol-assets/vignette-milk-round-1.png) | outskirts | 2 | 9.50, 44.50 |
| [The morning milk round · garden edge](../shots/sol-assets/vignette-milk-round-2.png) | outskirts | 2 | 25.50, 62.50 |
| [Rain barrel allotment · garden edge](../shots/sol-assets/vignette-rain-garden-2.png) | outskirts | 2 | 41.93, 88.34 |
| [Naturalists’ notebook · supplies](../shots/sol-assets/vignette-trail-naturalist-1.png) | civic-green | 3 | -73.50, -72.50 |
| [Meadow nursery · garden edge](../shots/sol-assets/vignette-meadow-nursery-2.png) | civic-green | 3 | -84.50, -36.50 |
| [Rain barrel allotment · supplies](../shots/sol-assets/vignette-rain-garden-1.png) | outskirts | 2 | 15.50, 44.50 |

The catalog authors 20 candidate groups. At the reference seed, the basket delivery, bracken/sign nursery pair and mushroom/boulder naturalist pair have no clear public parcel and are deliberately omitted. They remain candidates for other seeds; `town.unplacedVignettes` reports rejection explicitly. Existing trees, buildings and district models are not moved to force a higher count.

## Placement and integration

- `src/catalog/library/scenes.json` adds grounded atomic recipes and four family/companion declarations. Source geometry metadata is unchanged. Each new member supplies a specific exterior browse or tending task; the existing measured log-bench seat remains a seat.
- `src/compiler/asset-vignettes.js` plans after the existing expansion stops and before graph/registry construction. It considers larger reservations first, then deterministically ranks roadside candidates in authored public district zones. Quiet exterior sites are selected without entering the airport, Roadster or Starbase districts or their world-link corridors.
- Whole scene pads reserve the 0.9m aisle and 2.8m front setback. Pair distances continue through `compileScene`/`checkScene`; companion edge gaps are 0.65m. Existing parcels, kit props, full tree bounds including legacy pivot offsets, fields, gardens, furniture, district landmarks, expansion models and all other scene pads are obstacles. Member footprints clear roads by 0.25m. Connectors clear obstacles with a 0.45m half-width and are sampled for land, river and lake support.
- `library-scenes.js` adds recipe-authored standing tasks outside the full measured envelopes: standing 0.7m in front, approach 1.2m in front, 0.38m actor clearance. Only exterior browsing/tending can use this override. Inferred seats, doors, indoor surfaces and vehicle boarding poses stay disabled. Approaches and aisle landings enter the existing shared graph.
- Registry physical props expose their interaction points; each child `activity:vignette-…` place owns the exclusive lease. This avoids two reservation controllers on one point. Residents use ordinary `walkTo` and `visit` requests; tending uses the existing work pose, ornamental stops use an idle observation pose, and the bench uses the existing sitting pose. These are procedural activities, without new production, rigid prop animation or dialogue.
- `registry/coverage.js` and the inventory command now expose per-pack individual counts. Inventory regeneration updates both tracked registry reports. The original 18-district model manifest and licensed asset mapping are unchanged.

## Validation and reproduction

`npm run test:astra` passes **94 tests**, including the existing layout/path sweeps and the new measured-clearance, family, interaction and seed checks. The new tests sweep seeds 0, 17, 99, 831 and 9999; optional vignette rejection preserves safe layouts as scatter changes. The production build passes with the existing mixed-import/large-chunk warnings.

[Browser evidence](../shots/sol-assets/evidence.json) verifies every placed vignette model is actually rendered, every activity routes from node 0, and no metadata or render identities are rejected. Mabel walks about 121m to the garden exchange, Bram about 88m to the woodcutters’ stump and Finn about 105m to the hay bay. Movement is checked against their individual walking paces; none are teleported. Each obtains a real lease and completes a browse/tending cycle. These three directed journeys make verification reproducible; everyday residents continue to choose these places through the existing scheduler. The browser records no page or HTTP errors.

`shots/sol-assets/` contains all 17 vignette screenshots, browser evidence and the exact utilization comparison. To reproduce with the private library available:

```sh
npm run dev -- --host 0.0.0.0 --port 5202 --strictPort
npm run inventory:astra:registry -- --write-doc
npm run test:astra
node tools/verify-asset-vignettes.mjs
npm run build
```

No dependency or package-script changes are needed. Merge the compiler additions, recipe data, registry affordance/coverage updates, tests, inventory tool, documentation and rendered evidence together. Keep the existing district-model manifests and private assets as they are.
