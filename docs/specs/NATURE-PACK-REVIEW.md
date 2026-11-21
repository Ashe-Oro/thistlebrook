# Nature pack review

Lane `village/nature-outdoors`, 20 Nov 2026. Brief: [OPUS-NATURE](OPUS-NATURE.md). Rule: TOWN-30.

## What was reviewed

The owned ThreeJS Assets **Nature** pack (`/workspace/threejs-assets/nature/bundle`) has 83 GLBs: 77 individual assets, 5 prebuilds and the combined `nature.glb` catalog. I read `README.md` and `palettes.json`. The `preview/` folder has no images; it holds `showroom.html`, which I opened headless (it loads three.js from a CDN). I measured every GLB with glTF-Transform for triangles, bounds and file size. Draco sizes come from the deploy compressor's own settings (`tools/compress-dist-glbs.mjs`, edgebreaker, 14-bit positions). I also rendered every GLB in the town's cel look (toon ramp plus ink hull), at scale 1, beside a villager at the 1.12 scale residents use, under the town's isometric angle.

- Contact sheets: `/workspace/scratch/opus-nature/nature-pack-sheet-1.png` and `-2.png`. Showroom: `pack-showroom.png`. Raw numbers: `pack-stats.json`.
- Re-run: `node tools/compress-dist-glbs.mjs <copy of glb/individual>` to fill the Draco cache, then `node tools/nature-pack-stats.mjs`, start a dev server (`npx vite --port 5291`) and run `node tools/shots-nature-pack.mjs`. GLBs are streamed to the page from the pack folder and never copied into `public/`.

## What the pack is

All assets are vertex-coloured, flat-shaded and authored at 1 unit = 1 m with a bottom-centre pivot. Each one is a single mesh and draw call, baked in the SPRING palette. The raw files are uncompressed: 135.8 MB for the 77 individual assets, and 8.9 MB after Draco. Everything in the pack is detail-first, so triangle counts are high next to the Cozy Village kit. A kit pine is 248 triangles; the Nature pine is 23,424. Every Nature model therefore has to justify its count. A tree is drawn three times (body, ink hull and shadow), so a hundred extra pines would add about 7 M triangles to a frame.

## Fit with Thistlebrook's cel look

- **Scale.** Trees and rocks sit well at 0.9–1.8 scale beside villagers. Kit trees are bigger than life, so Nature trees replacing them are height-matched (kit pine 6.97 m against Nature pine 8.69 m, kit oak 6.96 m against Nature oak 5.38 m). Wildlife and waterfowl read at 1.25–1.6.
- **Ink.** The town draws a 0.035 world-unit inverted-hull outline. On thin-bladed models (cattails, ferns and the existing tall grass) that hull swallows the blades, and the clumps read as black spikes. These three catalog entries now use a 0.012 `outline`. Every other model keeps the default.
- **Colour.** The spring palette sits close to Thistlebrook's greens. `maple_autumn` is baked orange-gold and is kept for an autumn look only. Opaque "effects" (`mist_layer`, `campfire_smoke`, `waterfall_spray`) read as solid white or grey shapes without transparency, so they are skipped.
- **Ground and water tiles.** The 4 m terrain and lake/stream tiles assume a tile grid. Thistlebrook's ground is one continuous slab, its trails are draped ribbons and its water is one hydrological plan, so every tile is skipped.

## Verdicts

**use**: placed in Thistlebrook, either by this lane or already. **keep**: good, but no spot today (noted where it could go). **skip**: does not fit, with the reason. Sizes are bounding boxes (W × H × D) at scale 1. Draco is the deploy size.

### Terrain

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `dirt_trail` | 4 m straight trail tile with ruts | 4 × 0.6 × 4 | 6.1k | 0.64 MB / 50 KB | Good colour, but rigid | **skip** | Woods trails are ribbons draped on the ridge and switchbacks; straight tiles cannot follow them. |
| `forest_floor` | 4 m shaded forest-floor tile with leaves and roots | 4 × 0.55 × 4 | 5.2k | 0.56 MB / 42 KB | Too dark and busy for the flat ground | **skip** | Same as grass_tile; Pinewood keeps its draped ridge mesh. |
| `grass_tile` | 4 m spring-meadow ground tile | 4 × 0.67 × 4 | 6.1k | 0.66 MB / 45 KB | Busy: mottled turf and blade clumps fight the flat cel ground | **skip** | The mainland is one continuous slab with flat cel colour; a 4 m tile grid would show seams and repeat. |
| `rocky_mountain` | 4 m stepped rocky hillside tile, 1.3 m rise | 4 × 1.73 × 4 | 4.4k | 0.44 MB / 43 KB | Good | **skip** | Too small for the ridge and hills, which are procedural meshes with railway tunnel cuts. |
| `snow_tile` | 4 m snow drift tile | 4 × 0.57 × 4 | 2.6k | 0.26 MB / 25 KB | Flat white crust | **skip** | Winter is a skin (TOWN-15); a baked snow tile would ignore it. |

### Water

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `lake_open_water` | Open-water lake tile | 4 × 0.32 × 4 | 1.0k | 0.08 MB / 6 KB | Good | **skip** | Same as lake_tile. |
| `lake_shore_corner_in` | Inside-corner lake-shore tile | 4 × 1.1 × 4 | 5.7k | 0.57 MB / 40 KB | Good | **skip** | As above. |
| `lake_shore_corner_out` | Outside-corner lake-shore tile | 4 × 1.18 × 4 | 3.9k | 0.37 MB / 27 KB | Good | **skip** | As above. |
| `lake_shore_straight` | Straight lake-shore tile | 4 × 1.11 × 4 | 5.6k | 0.55 MB / 38 KB | Good | **skip** | Stillwater Lake is an irregular ellipse, not a 4 m grid. |
| `lake_tile` | Whole small lake on one 4 m tile | 4 × 1 × 4 | 6.5k | 0.66 MB / 53 KB | Good | **skip** | All water is the one hydrological plan in water.js; tiles would sit at their own levels. |
| `pond` | 3 m round woodland pond with reeds and lilies | 3 × 0.82 × 3 | 5.3k | 0.58 MB / 45 KB | Good | **keep** | A garden or yard pond somewhere small. Pinewood Pond is a planned 10 m ellipse that hikers route around. |
| `river_stream` | Creek tile between turf banks | 4 × 1.08 × 4 | 7.4k | 0.74 MB / 55 KB | Good | **skip** | The Willow River is a smoothed ribbon; tiles cannot bend with it. |
| `waterfall` | Three-step cascade into a plunge pool (5.3 m) | 3.9 × 5.25 × 3.93 | 37.4k | 4.41 MB / 312 KB | Good, the pack hero | **keep** | Candidate for Willow Spring Falls, but the cascade is draped on the Mountain Pass mesh. Swapping it is a design call (see decisions). |

### Paths

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `creek_stepping_stones` | Six stepping stones in a curve | 3.71 × 0.3 × 1.1 | 10.0k | 1.14 MB / 80 KB | Good | **keep** | Catalogued. Every Thistlebrook crossing is a registered bridge that walkers path over, so stones would read as a crossing nobody uses. |
| `log_bridge` | Log footbridge, 3.7 m | 1.27 × 1.04 × 3.66 | 43.4k | 4.89 MB / 210 KB | Good | **keep** | Could replace the procedural trail footbridge on the Willow River trail, but that span is about 8 m and 43k tris. |
| `rope_bridge` | Rope suspension bridge | 1.32 × 1.31 × 3.5 | 39.3k | 4.67 MB / 185 KB | Good | **skip** | No gorge in the terrain. |

### Nature

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `axe_chopping_stump` | Felled stump with an axe in it | 1.16 × 1.14 × 1.05 | 2.2k | 0.21 MB / 16 KB | Good | **use** | Fern Hollow picnic glade. |
| `berry_bush` | Currant bush with berries | 0.92 × 0.66 × 0.8 | 47.2k | 5.65 MB / 377 KB | Good | **skip** | 47k tris for a 0.9 m bush. Kept only in its existing catalog scene. |
| `birch` | Three-stemmed white birch, 5.2 m | 3.61 × 5.2 × 3.18 | 40.3k | 4.83 MB / 330 KB | Good, the white bark reads at every zoom | **use** | A stand on the sunny side of Pinewood Pond and birch pairs in the Merrymead hedgerow (already in Birch Hollow). |
| `bracken_thicket` | 2 m bracken and bramble patch | 2.28 × 0.91 × 2.27 | 69.2k | 8.26 MB / 597 KB | Good | **skip** | 69k tris, the heaviest per square metre in the pack. |
| `bush` | Broadleaf shrub, 0.9 m | 0.93 × 0.71 × 0.85 | 29.5k | 3.54 MB / 354 KB | Good | **skip** | 29.5k tris for a knee-high shrub. The kit round bush reads the same at town zoom, and 170 of them would cost about 5 M tris. |
| `cattails` | Bulrush stand | 0.67 × 1.16 × 0.66 | 4.1k | 0.46 MB / 39 KB | Good with a finer ink line | **use** | River banks and the Stillwater shore, replacing the procedural box reeds; existing at Pinewood Pond. |
| `fallen_log_mossy` | 3.5 m mossy fallen log | 3.54 × 0.59 × 1.13 | 4.0k | 0.36 MB / 28 KB | Good | **use** | Already in Pinewood understory and Stillwater. |
| `fern` | Lady fern clump | 0.84 × 0.55 × 0.87 | 21.5k | 2.42 MB / 155 KB | Good with a finer ink line; solid ink at the default weight | **use** | Fern Hollow and under Birch Hollow's birches. Outline reduced to 0.012. |
| `lily_pad_patch` | Floating lily-pad raft | 1.26 × 0.2 × 1.08 | 4.3k | 0.49 MB / 31 KB | Good | **use** | Pinewood Pond and Stillwater Lake. |
| `maple_autumn` | Autumn maple, orange-gold dome | 5.45 × 5.82 × 4.94 | 18.7k | 2.13 MB / 149 KB | Baked autumn colour clashes with the spring cel palette | **keep** | Good for an autumn skin swap or one accent tree. Not placed in the default spring look. |
| `mushroom_cluster` | Mossy log with toadstools | 1.6 × 0.63 × 0.83 | 15.1k | 1.50 MB / 112 KB | Good | **use** | Pinewood Pond forest floor. |
| `oak` | Broad old oak, 5.4 m | 6.03 × 5.38 × 5.77 | 11.7k | 1.32 MB / 99 KB | Good, crown keeps its satellites | **use** | Pinewood meadow edges (Foxglove, Bluebell, Fern Hollow) and the Merrymead hedgerow, height-matched to the kit oaks they replace. |
| `pine` | Tall ragged pine, 8.7 m | 3.27 × 8.69 × 2.99 | 23.4k | 2.81 MB / 217 KB | Good | **use** | Old-growth ring round the Pinewood Lookout and a stand west of Birch Hollow at Stillwater. |
| `pine_sapling_staked` | Staked young pine | 0.7 × 1.46 × 0.74 | 4.2k | 0.47 MB / 38 KB | Good | **use** | Regrowth at the lookout, Foxglove meadow and trailhead clearing edges. |
| `silver_snag` | Dead leaning snag, 4.1 m | 1.82 × 4.14 × 1.66 | 2.3k | 0.24 MB / 17 KB | Good and cheap (2.3k tris) | **use** | Weathered dead pines on the exposed upper Pinewood Ridge. |
| `tall_grass` | Meadow tussock | 0.84 × 0.85 × 0.75 | 9.3k | 1.05 MB / 87 KB | Read as black spikes at the default ink weight | **use** | Already the meadow grass. Outline reduced to 0.012 so it reads green. |
| `wildflower` | Lupine, daisy, poppy, buttercup patch | 0.58 × 0.55 × 0.59 | 17.0k | 1.90 MB / 125 KB | Good | **use** | Meadow (existing) and the Merrymead hedgerow. |
| `willow` | Weeping willow, 5 m | 4.13 × 4.96 × 4.28 | 33.9k | 4.07 MB / 296 KB | Good | **use** | Set back along the Willow River meadow reach, the upper river and the Stillwater Outflow. |

### Rocks

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `cliff_face` | Towering cliff face, 5 m | 3.86 × 5.05 × 2 | 94.3k | 11.32 MB / 907 KB | Good | **skip** | 94k tris and 11 MB raw; the terrain has no cliff. |
| `granite_rock_cluster` | Four leaning stones | 2.33 × 0.95 × 1.71 | 14.0k | 1.60 MB / 128 KB | Good | **use** | Already at Stillwater. |
| `lichen_granite_boulder` | Weathered granite boulder | 1.85 × 1.3 × 1.92 | 6.6k | 0.76 MB / 51 KB | Good | **use** | Pinewood heights near trails, the open meadow (replacing every kit boulder) and the hedgerow. |
| `moss_cushion_rock` | Moss-blanketed round stone | 1.62 × 1.35 × 1.52 | 8.4k | 0.96 MB / 80 KB | Good | **use** | Damp Pinewood lowland near trails and the pond, and the hedgerow. |
| `river_stones` | Nine water-rounded stones in gravel | 1.71 × 0.25 × 1.66 | 7.8k | 0.89 MB / 87 KB | Good | **use** | Stone bars on inner river bends and the lake shore. |
| `scree_pile` | Scree fan | 3.24 × 0.94 × 3.08 | 30.0k | 3.61 MB / 350 KB | Good | **skip** | 30k tris and it needs a cliff foot. |
| `shore_rock_shelf` | Low granite shelf at the water edge | 2.9 × 0.54 × 2.06 | 9.7k | 1.11 MB / 80 KB | Good | **use** | Outer river bends and the lake shore, tilted to the water. |
| `standing_stone` | Leaning standing stone | 0.93 × 2.12 × 1.01 | 5.9k | 0.67 MB / 51 KB | Good | **keep** | Could mark the South Knob cairn; the cairn is authored stones today. |
| `stone_arch` | Natural rock arch | 3.61 × 3.51 × 1.5 | 17.3k | 1.97 MB / 153 KB | Good | **keep** | A future ridge landmark; it needs a trail feature to justify it. |

### Rustic

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `log_cabin` | Lakeside log cabin | 4.04 × 3.53 × 3.48 | 104.5k | 12.32 MB / 689 KB | Good | **use** | Already Stillwater's two cabins. |
| `lookout_tower` | Fire lookout tower, 6.4 m | 2.41 × 6.44 × 2.57 | 16.2k | 1.76 MB / 93 KB | Good | **keep** | Fits Pinewood Lookout, but the deck there is authored and hikers rest on it. Ashe's call. |
| `ranger_hut` | Ranger hut on stilts | 2.66 × 3.19 × 2.66 | 8.0k | 0.73 MB / 48 KB | Good | **use** | Already Stillwater. |

### Outdoor

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `camp_tent` | Canvas ridge tent | 2.69 × 1.43 × 3.45 | 6.5k | 0.65 MB / 41 KB | Good | **use** | Already the Stillwater campground. |
| `dock_jetty` | Plank jetty | 1.51 × 1.36 × 3.87 | 8.1k | 0.73 MB / 43 KB | Good | **use** | Already Stillwater Landing. |
| `lean_to` | Bushcraft lean-to | 2.45 × 1.72 × 1.97 | 36.8k | 4.36 MB / 263 KB | Good | **keep** | 36.8k tris; a Fern Hollow shelter candidate. |
| `woodland_privy` | Woodland outhouse | 1.89 × 2.82 × 1.6 | 11.1k | 1.15 MB / 69 KB | Good | **use** | Already the campground. |

### Props

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `bear_food_locker` | Steel bear locker | 1.5 × 0.87 × 1 | 6.0k | 0.41 MB / 22 KB | Good | **use** | Already the campground. |
| `camp_tripod_kettle` | Cooking tripod over a fire | 1.15 × 1.54 × 1.01 | 8.5k | 0.82 MB / 53 KB | Good | **use** | Already the campfire. |
| `campsite_picnic_table` | Campground picnic table | 1.51 × 0.84 × 1.4 | 2.5k | 0.22 MB / 15 KB | Good | **use** | Already Stillwater. |
| `lantern` | Red hurricane lantern | 0.22 × 0.36 × 0.17 | 3.0k | 0.27 MB / 17 KB | Good | **keep** | Catalogued and used in catalog scenes; too small for open edges. |
| `log_bench` | Split-log bench | 1.12 × 0.51 × 0.37 | 3.6k | 0.34 MB / 21 KB | Good | **use** | Already Pinewood and Stillwater. |
| `split_firewood_pile` | Cribbed firewood | 1.18 × 0.74 × 0.88 | 10.0k | 0.96 MB / 57 KB | Good | **use** | Already Stillwater. |
| `stone_ring_campfire` | Stone-ring campfire | 1.26 × 0.65 × 1.26 | 8.7k | 0.97 MB / 57 KB | Good | **use** | Already the campground and catalog scenes. |

### Wildlife

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `deer` | White-tailed buck | 0.53 × 1.62 × 1.77 | 7.9k | 0.90 MB / 48 KB | Good | **use** | Foxglove meadow (existing pair at Birch Hollow). |
| `fox` | Stalking red fox | 0.26 × 0.58 × 1.36 | 6.0k | 0.68 MB / 36 KB | Good | **use** | Foxglove meadow and Birch Hollow. |
| `grey_heron` | Heron on one leg in the shallows | 0.4 × 1 × 0.69 | 4.1k | 0.46 MB / 24 KB | Good | **use** | Pinewood Pond, the lake shallows and one per river reach. |
| `mallard_duck` | Floating mallard drake | 0.24 × 0.28 × 0.57 | 2.8k | 0.32 MB / 18 KB | Good | **use** | Pinewood Pond, Stillwater Lake and the river. |
| `rabbit` | Sitting cottontail | 0.26 × 0.39 × 0.39 | 4.1k | 0.46 MB / 26 KB | Good, small | **use** | Bluebell meadow, Fern Hollow, Birch Hollow and the Merrymead edge. |

### Theme

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `campfire_smoke` | Static smoke plume | 0.99 × 1.9 × 0.75 | 7.8k | 0.89 MB / 87 KB | Opaque, would read frozen | **skip** | The town animates its chimney smoke. |
| `meadow_fireflies` | Firefly swarm | 1.77 × 1.5 × 1.51 | 11.9k | 0.87 MB / 67 KB | Dark beetles by day, glow colour only at night | **keep** | Catalogued. Stillwater already animates its own fireflies. |
| `mist_layer` | Ground mist wisps | 4.7 × 0.11 × 2.71 | 3.4k | 0.34 MB / 20 KB | Opaque white slabs without transparency | **skip** | Reads as white sheets on the water. |
| `waterfall_spray` | Waterfall foam and spray | 1.44 × 1.56 × 1.41 | 19.7k | 2.10 MB / 202 KB | Static foam | **skip** | Only belongs with the waterfall. |

### Signage

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `park_info_board` | Trail-map kiosk | 2.07 × 1.9 × 0.9 | 9.8k | 0.81 MB / 52 KB | Good | **use** | Pinewood Trailhead clearing. |
| `trail_marker_post` | Waymark post with blazes | 0.55 × 1.06 × 0.35 | 2.0k | 0.16 MB / 13 KB | Good and cheap | **use** | A post beside every Pinewood trail junction and trail end (already on Stillwater trails). |
| `trailhead_sign` | Trailhead fingerpost | 2.16 × 2.26 × 0.51 | 16.0k | 0.90 MB / 43 KB | Good | **use** | Already Stillwater Trailhead. |

### Vehicles

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `canoe` | Red canvas canoe | 0.89 × 0.58 × 3.32 | 10.6k | 1.15 MB / 59 KB | Good | **use** | Already Stillwater and the water traffic plan. |
| `canoe_paddle_rack` | Paddle rack with life vest | 1.38 × 1.7 × 0.62 | 6.2k | 0.63 MB / 33 KB | Good | **use** | Already Stillwater Landing. |
| `kayak` | Yellow touring kayak | 2.6 × 0.4 × 3.23 | 7.6k | 0.81 MB / 36 KB | Good | **use** | Already water traffic. |
| `rowboat` | Clinker rowboat | 2.77 × 0.86 × 3.04 | 14.1k | 1.31 MB / 72 KB | Good | **use** | Already Shell Cove. |

### Sky

| Model | What it is | Size (m) | Tris | Raw / Draco | Cel fit | Verdict | Where, or why not |
|---|---|---|---:|---|---|---|---|
| `fair_weather_cloud_trio` | Three cumulus clouds | 5.04 × 1.06 × 2.74 | 14.9k | 1.70 MB / 180 KB | Good | **keep** | Possible weather clouds; the weather system draws its own. |
| `sky_day` | Spring sky dome | 5.2 × 2.6 × 5.2 | 29.2k | 3.25 MB / 70 KB | Unit-scale dome; the hull renders as ink from outside | **skip** | The town has its own sky (SKYDOME-REVIEW). |
| `sky_golden` | Golden-hour dome | 5.2 × 2.6 × 5.2 | 28.4k | 3.14 MB / 69 KB | As sky_day | **skip** | As sky_day. |
| `sky_night_aurora` | Night aurora dome | 5.2 × 2.6 × 5.2 | 29.8k | 3.34 MB / 90 KB | As sky_day | **skip** | As sky_day. |

### Prebuilds and the catalog

| Model | What it is | Size (m) | Tris | File | Cel fit | Verdict | Why not |
|---|---|---|---:|---|---|---|---|
| `prebuilds/forest_clearing` | Clearing with fallen log, ferns, deer and two pines on a forest-floor base | 8.96 × 8.85 × 8.97 | 216.5k | 1.51 MB (Draco) | Good, but each sits on its own tile ground | **skip** | One joined set-piece of 90 to 230k tris. Its decor nodes are individual GLBs, which are placed directly and instanced. |
| `prebuilds/lakeside_cabin` | Cabin, dock and shore on lake tiles | 8 × 3.86 × 8 | 175.5k | 0.95 MB (Draco) | Good, but each sits on its own tile ground | **skip** | One joined set-piece of 90 to 230k tris. Its decor nodes are individual GLBs, which are placed directly and instanced. |
| `prebuilds/lakeside_campsite` | Tent, fire and canoe on a shore base | 8.29 × 1.75 × 8 | 90.6k | 0.52 MB (Draco) | Good, but each sits on its own tile ground | **skip** | One joined set-piece of 90 to 230k tris. Its decor nodes are individual GLBs, which are placed directly and instanced. |
| `prebuilds/trailhead` | Trail, log bridge, kiosk and marker on a stream base | 8.08 × 2.62 × 12 | 156.1k | 0.93 MB (Draco) | Good, but each sits on its own tile ground | **skip** | One joined set-piece of 90 to 230k tris. Its decor nodes are individual GLBs, which are placed directly and instanced. |
| `prebuilds/waterfall_grotto` | Waterfall grotto with mist and spray | 12 × 6.19 × 10.45 | 229.8k | 1.62 MB (Draco) | Good, but each sits on its own tile ground | **skip** | One joined set-piece of 90 to 230k tris. Its decor nodes are individual GLBs, which are placed directly and instanced. |
| `nature.glb` | All 77 assets in a row as one joined mesh | 230.7 × 8.7 × 5.87 | 1211.7k | 4.83 MB (Draco) | n/a | **skip** | A lookbook; not addressable per asset. |

## Summary

- 83 GLBs reviewed: 42 **use**, 12 **keep**, 29 **skip** (including the 5 prebuilds and the catalog).
- This lane places 24 Nature models: 9 new to the catalog (`silver_snag`, `axe_chopping_stump`, `fern`, `lily_pad_patch`, `shore_rock_shelf`, `grey_heron`, `mallard_duck`, `trail_marker_post`, `park_info_board`), 9 that were catalogued but unused in the town (`pine`, `oak`, `lichen_granite_boulder`, `moss_cushion_rock`, `mushroom_cluster`, `river_stones`, `pine_sapling_staked`, `fox`, `rabbit`), and 6 already in use (`birch`, `willow`, `cattails`, `wildflower`, `deer`, `fallen_log_mossy`). Only the 9 new GLBs were copied into `public/licensed/nature/`.
- Placements and the before/after numbers are in [OPUS-NATURE](OPUS-NATURE.md#outcome).
