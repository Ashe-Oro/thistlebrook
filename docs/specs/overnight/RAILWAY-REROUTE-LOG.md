# Railway Reroute decisions log (append-only)

Spec: `docs/specs/overnight/RAILWAY-REROUTE.md`. This log covers **Stage A (plan only)**. Nothing in the world, renderer or live line changes in Stage A. The superseded tunnels WIP (`c1de921`) edited `src/compiler/railway.js` and `tools/railway-map.mjs` on this branch. Both are restored to main here so the live line is the one on the site. `src/compiler/terrain.js` from that WIP is kept: it is pure (THREE maths only, no world effect), and the planner and validator use it to measure rock over a bore.

## 2026-11-18 · Root causes: why the audits passed each bug

All line numbers refer to main (`08033f5`).

| Bug screenshot | What is wrong on the site | Why `audit:roads` / `auditRailway` passed it | Gap the new checks close |
| --- | --- | --- | --- |
| `rail-into-mountain-no-tunnel.png` | The old Lantern Quay platform ([96, −43]) runs straight into Pinecrest peak 1 / the range with no portal. The trees there have no ink. | `auditRailway` only tests `town.landscape.hills` for `rail-blocked` (`tools/audit-town-rules.mjs:184`). The theme-park peaks (`PARK_MOUNTAINS`, drawn by `themepark.js`) are not a compiled layer at all. The `pinecrest` easement in `RAIL_RESERVED` is `overpass: true`, so its samples were exempt from `rail-reserved` too. | Terrain is sampled from every raised mesh (`src/compiler/terrain.js`: park peaks + boulders, landscape hills, Pinewood ridge) at every metre and at the ballast edges. Any rise over the bed outside a declared tunnel fails, and a bore needs ≥ 6.1 m crown and ≥ 4.6 m wall cover. The unshaded trees are a Stage B fix (TOWN-08 root cause in the renderer). |
| `skatepark-crossing-mountain.png` | crossing-1 at [72.4, −91] is a 0.14 m brown slab laid on the road (deck `Box(reach*2+.4, .14, 3.1)` at rail top −0.09, `src/astra/railway.js:195-223`). Gate booms hang at rail height. The track then runs into peak 0 ([87, −67], radius 18 reaches x 69). | The `rail-crossing` check is only "gated and within 2° of square" (`audit-town-rules.mjs:177`). Nothing measures deck height, slab thickness or where the gates stand. Peak 0 is invisible to the hills check (above). | Crossings must be flush (rail top = road level), straight over the whole deck, ≤ 10° off square, with gates on dry kerbs outside lots, buildings and plazas, and must not sit in a junction mouth or on a road curve. |
| `trees-through-rail.png` | Pines and broadleaf trees stand through the 3.6 m Stillwater viaduct ([109, 57] → [−57, 133]). | `nearRail` builds its index without samples with `clearance >= 3` (`src/compiler/railway.js:311-314`), so nothing under or through a viaduct is ever "near the rail". The corridor clearing in `addRailway` and the audit's tree list cover `town.trees` and `town.landscape.models` only. The 144 `town.outskirts.trees` (the ones in the shot) are never looked at. | Trees come from every source: `town.trees`, `landscape.models` (woods and meadow), `outskirts.trees`, `modelPlacements` trees, `supplemental`, and the Funfair lot `TREES`. Every tree whose crown reaches the ballast (trunk within 1.2 + 1.4 m) must be on the plan's cleared list. There are no viaducts, so nothing is exempt for height. |
| `floating-station-over-water.png` | The Coral Coast Beach platform ([303, 83]) and its track float over the sea on a trestle. | Wet samples pass if they are bridged and above 0.1 m (`audit-town-rules.mjs:169`). The `vice-beach` easement is `offshore: true`, so offshore bridged samples are exempt from `rail-reserved` (`:165`). TOWN-05 checks a platform's sign, lamps and walk link, never what it stands on. | Water of any kind is a hard ban, sampled across the full ballast width. The only exception is a short inland stream bridge with both abutments on land. Every platform cell (ramps included) must be on dry, open land. |
| `airport-crossing.png` | crossing-0 at [67.5, −181.3] puts the same brown slab on the airport landside street. The rails become thin lines over it because ballast and sleepers are skipped on the deck (`railway.js` `onDeck`). The track then cuts diagonally into the landside parking. | The landside street (68, −182, 5 × 18 local+offset), the parking stalls (x 76/81/86, z −180.5) and the planters are literals inside `src/astra/airport/index.js` (lines 47-51). They are not in `town.roads` or any compiled record, so the audit's road index (`roadSurfaces`) cannot see them. Worse, `airport/index.js:65` *deletes* any airport prop taller than 0.25 m that `boxOnRail` hits. That hides the conflict instead of reporting it. | A rendered-footprint harvest (`tools/railway-plan/harvest.mjs`) opens the real site and rasterises every static triangle top-down (19.2 M triangles, 0.5 m cells, tagged with registry ids). Rendered structures (> 0.3 m above the local terrain) and rendered paving (flat, 0.05–0.3 m) that no compiled road describes are hard bans. Stage B must also remove the `boxOnRail` drop in the airport renderer. |
| `track-over-road-station.png` | The Pinecrest Park platform ([184, 23]) and its track run along and over the harbor approach road. | `auditRailway`'s `surface` filter drops viaduct samples (`clearance >= 3`), so `rail-on-road` is never tested there (`:160`, `:173-176`). `findCrossings` also skips those samples (`railway.js:231`), so no crossing is registered either. | No viaducts. Wherever the ballast touches a carriageway (any kind: town streets, regional links with their 4.05 m fence lines, coast lanes, the Pinecrest mountain road ribbon) the stretch must be a registered square crossing. Within 3.5 m of a road edge the track may not run within 40° of the road's direction. |
| `track-through-parking-lot.png` | The elevated track crosses Funfair Parking above parked cars. | The `funfair-parking` easement is `overpass: true` (exempt at clearance ≥ 3). The lot itself (`src/astra/fair-lot-plan.js`: `LOT`, `AISLES`, `APRON`, `BAYS`) is not in any audited layer, and piers simply skip the lot polygon (`railway.js:296`). | Lots, aisles, aprons, bays (Funfair Parking, kerbside `PARKING_BAYS`, Maple Hollow driveways, civic aprons) and rendered paving are hard bans, at any height. |
| `lantern-room-patio-on-road.png` | Café patio sets and hedge planters stand on the road near The Lantern Room ([55.3, −6.7], `parcel-17`). | Its bar and patio are built inside `src/astra/downtown.js:148-170` from literals around the building. Kerbside furniture comes from `street-plan.js`. Neither is a compiled prop with a footprint. `auditTownLayout` checks props' ground offset, not footprint overlap with carriageways. | Not rail. Stage B adds TOWN-24: a general footprint-overlap audit over every placed object, compiled or rendered, using the same harvest. |

The common root cause is that the audits sampled only what the compiler records, while each district renderer draws more (lots, aprons, paving, patio sets, mountains). The railway also exempted itself wherever it was high (viaducts) or offshore (trestles). The planner therefore builds its obstacle grid from three sources:
- the compiled world;
- the district plan modules the renderers read from (`fair-lot-plan`, `themepark-plan` `APPROACH`, `coast-plan` `shoreX`, `traffic-simulation` `PARKING_BAYS`);
- a harvest of what the site actually renders.

## 2026-11-18 · Planner design (Stage A)

- **Grid:** 0.5 m cells over x −262…402, z −292…402 (1328 × 1388). Each obstacle class has an exact distance field: point-to-shape distance over each shape's padded box, plus a chamfer transform for the rendered masks. Classes: sea (outside `MAINLAND`), Coral Coast surf (`shoreX`), rivers, streams, pools, lake, ponds, beach sand, carriageways, footpaths and trails, lots/aprons/bays, buildings, plazas/fields/parcels, props/furniture, trees, natural scatter, reserved land, Pinewood (soft), terrain heights, rendered structures and rendered paving.
- **Rail footprint:** ballast half-width 1.2 m (`RAIL.half`) plus 0.8 m clearance, so the centre line keeps 2.0 m from anything hard.
- **Planner:** hybrid A* over (x, z, heading) bins (1 m, 5°). It drives 2 m arcs of curvature 0, ±1/88, ±1/44 or ±1/22, closes onto the next platform with a Dubins shot, then shortcut-smooths with Dubins curves the rules accept. The heuristic is an obstacle-aware Dijkstra distance. Station sites and directions are chosen greedily by the real leg cost to each candidate (both directions) plus a look-ahead.
- **Motion rules, cell by cell:**
  - Road zone: straight and within 7° of square (planner margin; the validator allows 10°), with dry kerb cells for the gates both sides.
  - Junction mouths and road bends: no crossing where another road direction (> 12° different) is within 4 m.
  - Footpaths and trails: straight, within 35° of square.
  - Streams: straight, within 25° of square, deck ≤ 14 m.
  - Terrain: open → hood → bore → hood → open. The hood is straight and ≤ 8 m, a bore needs the cover above, and no cuttings are allowed.
  - Other parts of the loop: kept ≥ 7 m away (centre to centre).
- **Costs:** per metre 1 + clearance pressure (within 3 m of the corridor edge) + 1.6 in Pinewood + 1.2 on beach sand + 0.6 within 6 m of the sea + 0.2 in a bore. Per event: 45 per level crossing, 6 per footpath crossing, 30 per stream bridge, 14 per portal. A tree whose crown overhangs the corridor costs about 2.6 per 0.5 m sample, so a typical tree costs about 25 m of extra track.

## 2026-11-18 · Assumptions and decisions

- **Reserved land.** The festival bandshell (music-festival lane, TOWN-20; fair-local `[-76,-53]…[-56.85,-36]` + fair offset) and the Roadster arena are hard. `pinewood`/`pinewood-fringe` were this lane's own easements around the woods; they are soft: allowed, priced at 1.6/m, with trees and trail crossings counted. The `funfair-parking`, `pinecrest`, `starbase`, `vice-beach` and `maple-hollow` easements are superseded by real layers (lot, park, shore, parcels).
- **Streams.** Inland river reaches no wider than 5.4 m (half-width ≤ 2.7 m: the spring cascade, Upper Willow, town Willow and the narrow meadow reach) may take a short bridge (≤ 14 m deck, abutments on land). The lake, the Stillwater Outflow (up to 12 m wide), the harbor, the inlet and the sea may not.
- **West Works yard.** The `work-station` and `work-depot` venue boxes are the railway's own yard. The existing works track runs inside them, so they are not plazas for the planner. Buildings and props inside them still are.
- **Union.** The existing Union platform sits on the West Works line, boxed in by the yard at both ends (the old loop escaped with 6 m curves). Union is re-sited like every other stop, within 60 m of the Union hall entrance. The works line stays as a yard siding: Stage B connects or retires it, with no orphan stub (`rail-stub`).
- **Walk measurement.** Walks are measured on the town's sidewalk graph with the old railway's access links removed. Each new station gets one straight footpath from the back of its platform to a sidewalk node: clear of buildings, roads, water and the track, and never back across the line.
- **Platform length.** A platform may be shortened where the land is tight, never below 29 m (the passenger section; Municipal Airport already uses 29 m).

## 2026-11-18 · Stops that cannot meet every rule (trade-offs for review)

- **Pinecrest Adventure Park.** The park has one entrance, the midway gate ([220, −8]). It is boxed in by the midway fence, the Funfair lot and the curving mountain road. The only clear strip near the gate (x 172–209, z 4–9) is 33 m long and can only be entered or left across the mountain road where it bends. No ground-level line can pass through it square to the road at a runnable radius, and no site on an existing path is within 60 m. A relaxed search found the best existing-path site at a 109 m walk with two new zebras. **Proposal:** a rail gate in the midway's east fence (x 272.6, z −28) with a 17 m path to the park's easternmost plaza ("drop", [256, −28]). The station goes on the clear strip east of the park. The walk is measured from that new entrance. Through the park from the midway gate it is 73 m to the rail gate, plus the platform path. This needs Ashe's approval and the theme-park lane's fence change.
- **Coral Coast Beach.** The beach entrance ([274, 68]) faces a solid block of coast buildings and beach furniture. The only clear land within 60 m is the strip between Funfair Parking and the coast (z 36–43) and the strip east of the park (x 273–300). Both are a dead end: the coast highway can't be crossed square at its bend, and the beach is lined with umbrellas, courts and towers within 2 m of the surf. The stop moves inland onto the east strip. It is the nearest site a train can enter and leave, a 76.9 m walk on existing sidewalks, and it still serves Coral beach. The corner is served by a turning loop: down the east strip, round an 11 m radius curve, back up on a second track 7 m away. The old line ran 6 m curves at Union, so the train can run 11 m. Everywhere else the running line keeps ≥ 22 m.

## 2026-11-18 · Stage A finish

The selected northern loop serves **Roadster Proving Ground** and **Maple Hollow**. The eastern coastal corridor could not be closed in the attempted full-town routes. The reduced loop leaves eleven destinations for a later plan, including Coral Coast Beach. The JSON lists each deferred stop. The selected stations use 32 m and 30 m platforms, with walks of 29.93 m and 48.81 m from the existing entrances.

| Measure | Northern loop |
| --- | ---: |
| Length | 564.38 m (previous loop 2,447.05 m) |
| Tunnels | 4, totaling 128.08 m portal to portal |
| Crown and wall cover | At least 6.23 m at the crown and 4.61 m at the walls |
| Level crossings and bridges | 0 |
| Track over water and trees cleared | 0 m and 0 trees |
| Minimum radius and maximum grade | 10.98 m measured on the sampled line (11 m design) and 1.50% |
| Closest approach between separate parts of the loop | 8.1 m |
| Planner cost | 719.46 |
| Validator violations | **0** |

The final plan treats every water class and every tree footprint as a hard exclusion. The grid and validator use rotated crown bounds from the catalog and compiled placements, with a minimum fallback where an asset's bounds are unavailable. The validator samples the track footprint at quarter-metre intervals and raycasts the bores at metre intervals. Each tunnel has two mapped portals. The four bores use 6.1 m minimum crown and 4.6 m minimum wall requirements. The seven recorded ground-cover placements are grasses and flowers. Fault checks separately identified an offshore track sample, an offshore platform, a tree overlap, a Funfair Parking overlap, a missing crossing gate and a missing tunnel portal.

Run from the worktree root with the checked-in rendered footprint.

```sh
timeout 300s node tools/railway-plan.mjs
node tools/railway-plan-validate.mjs --json /tmp/railway-plan-audit.json
node tools/railway-plan-map.mjs --validation /tmp/railway-plan-audit.json
```

The review files are `tools/railway-plan.png` and `tools/railway-plan/route.json`. Stage B requires Ashe's review and approval.

## 2026-11-18 · Stage A review fixes

- The new return moves roughly 2.5–7.5 m south across the reviewed T1 stretch to keep the lining inside hill-5 and hill-8. The east portal moves east into the face. The loop takes the fallback south of hill-15 and keeps three bores, including hill-11 and hill-21.
- All six portal faces are in rock. The lowest face is 6.10 m above rail and the lowest wing measurement is 3.34 m at a 3 m offset. The tunnel records give the faces and outer approach limits separately. The short hoods call for earth berms that blend into the hills.
- The planner and validator sample the full 2.0 m open-track corridor on both sides. The bore checks require 6.1 m at the crown, 4.6 m at the walls, and 2 m on both flanks at 4.5 m from the centreline. The minimum measured bore covers are 6.10, 4.95 and 2.11 m respectively.
- The plan specifies `berth: roadster` and no siding. The single train berths at the Roadster platform.
- The west turnback now has a 15.03 m minimum design radius and a 10.74 m tangent between opposing curves. The east still needs an 11 m design radius and a 4.5 m tangent in the checked alignment. Searches for a 15 m east curve or a 10 m east tangent did not produce a valid fit. Curves below 15 m have 2.5 m of inside clearance, and the mainline summary reports the measured 11 m minimum.

The regenerated 590.50 m loop has 85.16 m of tunnel between the stone faces, 8.0 m minimum separation, and a 1.50% maximum grade. It has no crossings, bridges, track over water, or tree clearing. The planner regenerates the surveyed tangents and arcs against the compiled world and took about 18 seconds under the 300-second cap. The independent validator reports **0 violations**. The earlier plan fails the new terrain checks, and moving a portal out to the approach or assigning a different berth with a siding is rejected.

## 2026-11-18 · Stage B implementation

- The game imports the centreline and heights from the reviewed `route.json` at `457ac18`. The 590.50 m alignment, six portal locations and two platform polygons are unchanged. The service loops around the clock with 24-second station dwells. Whole laps fit the game clock by adjusting cruise speed, so the train stays continuous across midnight. The seven trailing coaches and wagons remain in service.
- The four surveyed hills anchor the bore geometry across seeds. The landscape renderer cuts actual mesh triangles for the approaches and bores, with masonry vaults inside, stone portals from the owned railway pack, and earth berms at the mouths. Terrain draws through the shared toon ramp and ink hulls. Instanced vegetation keeps its source ink shader and footprint identity.
- Roadster's surveyed accessible footway stays in place and connects to its relocated platform. Maple's platform connects to the north sidewalk. The Roadster travel direction reverses the direction used to author its platform polygon, so the platform side comes from the polygon. The station walk audit measures live sidewalk paths from both landmarks.
- The Northern Loop crosses zero roads and zero water and clears the parcels along the alignment. The compiler clears vegetation using catalog dimensions, and the audit checks tree crowns at rail level. The platform and track checks use the same citywide feature inventory as the survey. An added footprint check tests placed objects against carriageways and the Lantern Room's rendered terrace pieces use the compiled terrace footprint. The west patio row moved 0.9 m further behind the kerb. The airport renderer restores its ordinary landside layout.
- The eight before and after pairs use the same reconstructed local cameras at the bug locations. The original supplied screenshots are in `shots/railway-reroute/bugs/`. The overview, six portal close-ups, two station views and smokebox-mounted ride are in `shots/railway-tunnels/`.

A fresh harvest of the implemented browser scene covered 19,124,484 static triangles. The plan validator returned zero violations against that footprint. Re-running the planner reproduced the reviewed centreline, crossing and bridge arrays, and the portal data exactly.

| Capture | Before draw calls | After draw calls | Change |
| --- | ---: | ---: | ---: |
| overview | 2407 | 2453 | +46 |
| portal-1-a | 301 | 336 | +35 |
| portal-1-b | 255 | 299 | +44 |
| portal-2-a | 261 | 300 | +39 |
| portal-2-b | 244 | 279 | +35 |
| portal-3-a | 230 | 272 | +42 |
| portal-3-b | 229 | 271 | +42 |

All 258 tests passed across four bounded batches. The focused railway tests also passed after the final tunnel-floor render change. The production build and `test:checks` passed. The town-rules audit had zero open findings. Full-day collision simulations recorded zero incidents in clear weather, rain and snow.
