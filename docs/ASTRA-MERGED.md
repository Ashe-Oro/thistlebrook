# One living Astra

Local integration of four descendants of `832eacf`:

| Branch | Source commit | Retained contribution |
| --- | --- | --- |
| `village/astra-downtown` | `4fb0b8b` | Seven rooftop shop landmarks, daytime errands, Lantern Quay promenade and 222 extra game-night visitors |
| `village/astra-civic` | `226df7a` | Fire station, clinic, library, police post, park and service vignettes |
| `village/astra-work` | `e6eb342` | Union Station, market gardens, timber works, freight, six commuters and staffed production |
| `village/astra-homes` | `d42bb23` | Nine terrace buildings, eighteen homes, grocer, washhouse and eight named neighbours |

## Town plan

All three expansion plans originally occupied the same northwest notch. The
merged compiler owns one island outline and one river extent. Civic Green stays
beside downtown and the school; Sunbeam Terrace sits immediately west of Civic
Green; West Works occupies the northern edge, with the railway behind it.
Civic Avenue and the planted station walk connect the districts in a loop.
The river, its three bridges, original neighbourhood and playing fields stay in
place. There are nine districts, 35 building parcels, 17 public venues, and forty
named residents. Procedural civic service buildings are counted as venues.

`src/compiler/astra-placement.js` holds the district translations: West Works
moves 70 metres north; Sunbeam Terrace moves 65 metres west. Compilation applies
them to parcels, doors, roads, workstations and rail. `placed-district.js` applies
the same translations to authored geometry and animation, then maps selection
records back to the real world parcels. The two planners no longer replace each
other's island outline. The river retains its separate original bounds.

## Conflict and review fixes

- Combined all renderer update hooks, resident rosters, jobs, story cards and
  camera presets. Sunbeam story handling is restricted to Sunbeam homes, so
  clinic and workplace stories retain their proper district labels.
- Moved all three districts onto distinct reserved ground. The shared graph
  includes two routes out of the terrace, a station walk and a civic connection.
  Relocated workers start at real graph nodes and keep real home assignments.
- Used one river-bounds format; expanded camera pan and sun shadow bounds.
- Fit the whole-town camera to the island silhouette and building headroom,
  including viewport changes and quarter-turn rotations. Corrected the clock’s
  fractional-hour minute display, and made the phone work panel more compact.
- Restricted the work panel and civic happenings to their actual district
  extents. Added scrollable navigation for every district.
- Separated workplace ground selection from building-height boxes, so the
  invisible parcel volume cannot intercept clicks on workers. Relocated
  homes, workplaces, rooftop shop signs and residents remain selectable.
- Updated the branch-specific test assumptions to the merged positions and
  counts. The main compiler suite includes all three district test files.

The four source merge notes remain useful as historical implementation notes;
their original coordinates, district totals, and ports describe their separate
branches. Use **port 5173** and the commands below for this combined branch.

## Reproduce

```sh
npm run dev -- --port 5173 --strictPort
npm run test:astra
npm run build
npm run shots:astra:merged
npm run shots:astra
npm run film:astra:merged
```

`shots:astra:merged` verifies actual pointer selection, all district tabs,
workplace commutes, staffed production and freight, lunch downtown, homeward
travel, Sunbeam errands, civic visits, shared pause/resume, evening crowds and
mobile rendering. It records fresh photos 29–43 and `merged-evidence.json` in
`shots/astra/`. The tour is `44-one-living-town.mp4`. Intermediate frames are
ignored. Software WebGL is used for reproducible headless captures.

The compiler tests sweep 100 seeds, all destination pairs, collisions, doors,
land boundaries, bridge-only river crossings, service schedules and rail
continuity. Camera/input regression evidence lives in `shots/astra/regression/`.

All owned models are loaded from the existing ignored `public/licensed` mapping.
No licensed models are committed, and `copyPublicDir: false` excludes them from
the production build. The screenshots and tour are rendered outputs.

The work district's production and freight counters are session-local. Sports,
service vehicles and ambient crowds remain authored activity loops; this merge
does not add a full traffic solver, persistent economy or competitive sport.

Final evidence: 14 tests passed, including the 100-seed sweep. The built app
loaded all 60 private models on port 5173 with no page errors. Desktop and phone
overviews passed all four rotations; manual zoom survives rotation. The tour
contains 315 decoded H.264 frames at 1280 × 900, lasting 31.5 seconds.
