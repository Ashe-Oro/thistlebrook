<!-- OWNER: opus-suburb prep (Grok executor). Derived numbers only; no licensed geometry. -->
# Suburban Neighborhood pack: model list and sizes

Pack: ThreeJS Assets "Suburban Neighborhood" (https://threejsassets.com/packs/suburban-neighborhood), 63 models + 5 prebuilds, covered by Ashe's lifetime All-Access licence. Files: `public/licensed/suburban-neighborhood/<name>.glb` (served at `/licensed/suburban-neighborhood/<name>.glb`), prebuilds in `prebuilds/`, palettes in `palettes.json`, vendor notes in `README.md`, official cover and prebuild renders in `reference/`. Licensed: never commit, never copy into `src/` or `docs/`.

Contact sheet: `docs/specs/suburb-assets.jpg`.

**The GLBs are already Draco-compressed** (6.0 MB for all 63). Load them through the shared Draco loader. Each model is one primitive with one material, so it instances cleanly per model.

## Scale against the town

Sizes below are raw pack units (metres, W = x, H = y, D = z, origin at ground centre unless noted). Town reference sizes:

| Town reference | Size (m) |
|---|---|
| Resident rig (townsfolk, placed at scale 1.12) | ~1.9 tall |
| Kids (ballgame, townsfolk at 0.64) | ~1.1 tall |
| Willowbank cottage `cv-home-cottage` | 3.2 x 3.6 x 3.1 |
| Timber home `cv-home-timber` | 3.7 x 4.9 x 3.5 |
| Larger house `b-house-b` | 6.2 x 6.1 x 7.0 |
| Traffic car (`traffic.js`, box-built) | 0.9 wide x 1.85 long |
| Traffic bus | 1.0 wide x 3.2 long |
| Road width (avenue / world-link) | 3 / 5.6 |

Starting point (tune with the critic loop): houses and yard props at **0.75** (two-storey becomes 5.5 x 6.0 x 4.7, next to `b-house-b`; a door then reads about right for a 1.9 m resident). Cars at about **0.6** so a sedan (1.9 m long) matches the traffic cars and fits the existing parking bays; the school bus at about **0.45** (3.6 m), matching the traffic bus. Street tiles are 4 m modules; the town builds its own road ribbons, so use pack street tiles only as visual reference or for driveways and aprons.

## Models

### houses

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `bungalow_house` | 5.96 x 5.09 x 5.52 | 4.47 x 3.82 x 4.14 | 1880 |  |
| `modern_house` | 11.62 x 6.26 x 9.03 | 8.71 x 4.70 x 6.77 | 2040 | origin off-centre (-1.53, 1.43); premium tier |
| `ranch_house` | 8.16 x 4.84 x 5.83 | 6.12 x 3.63 x 4.37 | 1626 |  |
| `split_level_house` | 9.06 x 6.94 x 6.49 | 6.79 x 5.21 x 4.87 | 1740 | premium tier |
| `townhouse_duplex` | 7.56 x 6.6 x 5.42 | 5.67 x 4.95 x 4.06 | 2878 | premium tier |
| `two_story_house` | 7.36 x 7.99 x 6.23 | 5.52 x 5.99 x 4.67 | 2408 |  |

### lot-structures

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `backyard_deck` | 4.4 x 1.58 x 4.31 | 3.30 x 1.19 x 3.23 | 1340 | origin off-centre (0, 0.46) |
| `front_porch` | 3.88 x 2.96 x 3.07 | 2.91 x 2.22 x 2.30 | 2074 | origin off-centre (0, 0.44) |
| `garage` | 6.56 x 3.7 x 6.42 | 4.92 x 2.78 x 4.81 | 1496 |  |
| `garden_shed` | 3.28 x 2.76 x 2.55 | 2.46 x 2.07 x 1.91 | 1136 |  |
| `kids_treehouse` | 3.86 x 5.84 x 3.95 | 2.90 x 4.38 x 2.96 | 1694 | premium tier |
| `pergola` | 3.5 x 3.12 x 3.44 | 2.62 x 2.34 x 2.58 | 900 | premium tier |

### garden-hardscape

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `retaining_wall_block` | 2.47 x 0.68 x 0.82 | 1.85 x 0.51 x 0.61 | 740 | premium tier |
| `rockery_boulders` | 2.1 x 0.75 x 2.1 | 1.58 x 0.56 x 1.58 | 648 | premium tier |
| `stepping_stones` | 1.14 x 0.2 x 4 | 0.85 x 0.15 x 3.00 | 456 |  |

### yard-street-props

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `basketball_hoop` | 1.45 x 3.81 x 1.53 | 1.09 x 2.86 x 1.15 | 906 | origin off-centre (0.03, 0.5) |
| `bbq_grill` | 0.96 x 1.64 x 0.91 | 0.72 x 1.23 x 0.68 | 1060 |  |
| `chainlink_fence` | 2 x 1.58 x 0.11 | 1.50 x 1.19 x 0.08 | 536 | premium tier |
| `hose_reel_sprinkler` | 1.91 x 1.06 x 1.21 | 1.43 x 0.80 x 0.91 | 733 | origin off-centre (0.74, 0.55); premium tier |
| `lawn_mower` | 0.7 x 1.19 x 2.74 | 0.52 x 0.89 x 2.06 | 860 | origin off-centre (0, -1.08) |
| `mailbox` | 0.31 x 1.58 x 0.58 | 0.23 x 1.19 x 0.43 | 758 |  |
| `patio_table_chairs` | 2.11 x 2.18 x 2.23 | 1.58 x 1.64 x 1.67 | 1794 |  |
| `picket_fence` | 2.06 x 1.17 x 0.17 | 1.54 x 0.88 x 0.13 | 488 |  |
| `privacy_fence` | 2.06 x 2.04 x 0.18 | 1.54 x 1.53 x 0.14 | 448 |  |
| `swing_set` | 3.85 x 2.15 x 2.14 | 2.89 x 1.61 x 1.60 | 1128 |  |
| `wheelie_bins` | 1.78 x 1.75 x 0.93 | 1.33 x 1.31 x 0.70 | 1432 |  |

### vehicles

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `family_pickup` | 1.48 x 1.12 x 3.51 | 1.11 x 0.84 x 2.63 | 2636 | premium tier |
| `family_sedan` | 1.39 x 0.96 x 3.12 | 1.04 x 0.72 x 2.34 | 2432 |  |
| `school_bus` | 2.3 x 2.39 x 8.07 | 1.72 x 1.79 x 6.05 | 3528 | premium tier |
| `suv_minivan` | 1.5 x 1.26 x 3.21 | 1.12 x 0.95 x 2.41 | 2464 |  |

### streets-driveways

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `driveway_apron_tile` | 4 x 0.39 x 3.98 | 3.00 x 0.29 x 2.98 | 496 |  |
| `road_crosswalk_tile` | 4 x 0.39 x 4 | 3.00 x 0.29 x 3.00 | 244 | premium tier |
| `road_culdesac` | 4 x 0.48 x 4.03 | 3.00 x 0.36 x 3.02 | 1472 |  |
| `sidewalk_tile` | 4 x 0.33 x 3.97 | 3.00 x 0.25 x 2.98 | 256 |  |
| `street_4way` | 4.03 x 0.48 x 4.03 | 3.02 x 0.36 x 3.02 | 1276 |  |
| `street_corner` | 4.03 x 0.46 x 4.03 | 3.02 x 0.35 x 3.02 | 996 |  |
| `street_straight` | 4 x 0.39 x 4 | 3.00 x 0.29 x 3.00 | 136 |  |
| `street_t` | 4.02 x 0.48 x 4.03 | 3.01 x 0.36 x 3.02 | 980 |  |

### terrain

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `front_lawn_tile` | 4 x 0.48 x 4 | 3.00 x 0.36 x 3.00 | 558 |  |
| `grass_verge_tile` | 4.01 x 0.48 x 4 | 3.01 x 0.36 x 3.00 | 516 |  |
| `mulch_bed_tile` | 4 x 0.66 x 4 | 3.00 x 0.49 x 3.00 | 552 |  |
| `park_lawn_tile` | 4 x 0.48 x 4 | 3.00 x 0.36 x 3.00 | 656 |  |
| `vacant_lot_tile` | 4 x 0.48 x 4 | 3.00 x 0.36 x 3.00 | 748 | premium tier |

### nature

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `arborvitae_conifer` | 1.65 x 3.33 x 1.86 | 1.24 x 2.50 x 1.40 | 595 |  |
| `boxwood_hedge` | 2.16 x 1.1 x 0.94 | 1.62 x 0.83 x 0.70 | 384 |  |
| `flower_bed` | 2.13 x 0.55 x 2.15 | 1.60 x 0.41 x 1.61 | 680 |  |
| `flowering_tree` | 2.93 x 4.36 x 3.18 | 2.20 x 3.27 x 2.39 | 476 |  |
| `lawn_tuft_scatter` | 1.65 x 0.18 x 1.52 | 1.24 x 0.14 x 1.14 | 460 |  |
| `shade_tree` | 4.88 x 7.09 x 5.31 | 3.66 x 5.32 x 3.98 | 576 |  |

### water

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `pond_garden` | 3.44 x 0.74 x 3.26 | 2.58 x 0.55 x 2.44 | 794 | premium tier |
| `swimming_pool` | 4.6 x 0.36 x 3.2 | 3.45 x 0.27 x 2.40 | 1164 |  |

### signage

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `address_plaque` | 0.52 x 0.79 x 0.12 | 0.39 x 0.59 x 0.09 | 356 |  |
| `hoa_entrance_sign` | 7.06 x 1.49 x 1.68 | 5.29 x 1.12 x 1.26 | 1256 | premium tier |
| `street_stop_sign` | 1.09 x 2.7 x 1.09 | 0.82 x 2.03 x 0.82 | 656 |  |

### suburban-signature

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `fire_hydrant` | 0.54 x 0.81 x 0.48 | 0.41 x 0.61 x 0.36 | 1018 |  |
| `for_sale_sign` | 1.08 x 1.94 x 0.23 | 0.81 x 1.46 x 0.17 | 392 | origin off-centre (0.46, 0.05) |
| `sprinkler_spray` | 2.52 x 0.96 x 1.59 | 1.89 x 0.72 x 1.19 | 1146 | origin off-centre (0, 0.72); premium tier |
| `streetlamp` | 1.05 x 4.55 x 0.32 | 0.79 x 3.41 x 0.24 | 420 | origin off-centre (0.37, 0) |

### sky

| Model | W x H x D (m) | at 0.75 (m) | Triangles | Notes |
|---|---|---|---|---|
| `sky_clear_day_dome` | 5.2 x 2.6 x 5.07 | 3.90 x 1.95 x 3.80 | 322 |  |
| `sky_golden_hour_dome` | 5.2 x 2.6 x 5.07 | 3.90 x 1.95 x 3.80 | 322 | premium tier |
| `sky_overcast_dome` | 5.2 x 2.6 x 5.26 | 3.90 x 1.95 x 3.94 | 434 | premium tier |
| `sky_starlit_dome` | 5.2 x 2.6 x 5.07 | 3.90 x 1.95 x 3.80 | 1186 | premium tier |
| `summer_clouds` | 2.22 x 0.85 x 1.34 | 1.67 x 0.64 x 1.01 | 400 |  |

## Prebuilds (vendor-dressed scenes, for reference and as layout gold)

| Prebuild | W x H x D (m) | Triangles | Primitives |
|---|---|---|---|
| `prebuilds/backyard_retreat` | 12.45 x 3.98 x 12 | 14094 | 11 |
| `prebuilds/cul_de_sac` | 25.4 x 8.28 x 17.26 | 24142 | 11 |
| `prebuilds/dressed_house_lot` | 16.68 x 7.48 x 16.84 | 19223 | 11 |
| `prebuilds/front_yard_porch` | 12.59 x 8.28 x 15.99 | 13319 | 9 |
| `prebuilds/neighborhood_park` | 18.64 x 7.48 x 14.77 | 13499 | 9 |

`prebuilds/_full_pack_scene.glb` is the vendor's whole-pack lineup (189 m wide); reference only.

Note: the four `sky_*_dome` models and `summer_clouds` are tiny props (5 m), not real skies; the town keeps its own sky and lighting.
