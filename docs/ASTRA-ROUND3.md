# Astra: one connected world

Round 3 integrates the ten finished lanes on top of round 2 (`0457716`). Every lane was merged separately, preserving its history. The original nine districts now belong to an 18-district world with 69 public venues, 35 main parcels and 584 connected pedestrian nodes.

## Merged lanes

| Lane | Integrated head | Place in the world |
| --- | --- | --- |
| `village/astra-harbor` | `abc71f9` | Saltwind Harbor, east of town |
| `village/astra-fair` | `f317168` | Merrymead Park, west of Sunbeam Terrace |
| `village/astra-outskirts` | `3d3a4ec` | Stillwater Lake, cabins and farms south of the original town |
| `village/astra-airport` | `a6a8bbc` | Municipal airport north of the eastern approach |
| `village/astra-skatepark` | `d72ee3a` | Switchyard, beside the airport approach |
| `village/sol-registry` | `a95c8b4` | Shared placement identities and graph-resolved resident activities |
| `village/astra-themepark` | `84ec04f` | Pinecrest beyond the mountain pass |
| `village/astra-coast` | `be2e413` | Coral Coast beyond Saltwind Harbor |
| `village/astra-tesla` | `3bdb940` | Proving ground northwest of West Works; seven electric vehicles in town traffic |
| `village/astra-starbase` | `4071cf5` | Starbase Texas beyond the coastal highway |

The Tesla lane advanced during final review. Its last vault-alignment and sideline-grandstand correction was merged separately in `46ba17c`.

## Compiler and routes

`src/compiler/world-plan.js` composes the existing core compiler with the new layouts. The base nine-district compiler remains available for its existing focused tests. Extensions are built in explicit coordinate frames; their nodes, entries, parcels and roads are translated together. The renderer uses the same frames, including world-space inspection bounds for moving objects.

The final pedestrian graph splits roads at intersections and T junctions while retaining existing node indices. Every public venue gets an actual entry and connected approach. The Pinecrest approach follows the sampled mountain-pass curve; the coastal trunk skirts the fish market and boatworks. Switchyard moved north of the mountain terrain instead of overlapping it. Long connectors have their own ground foundations.

The canonical registry contains model placements, districts, procedural assemblies, catalog members, work spots and activity slots. Named residents resolve destinations and reserved slots through `createWorldRegistry().resolvePath()`, including the authored final approach. There is one registry identity per activity, rather than duplicate catalog adapters. Props without verified access remain decorative.

Rendered base models retain per-placement IDs through instancing. Newer district assemblies retain explicit district ownership, preserving more specific IDs when present. Sky and selection graphics are explicitly exempt; physical geometry and streetlamp halos are checked by `renderCoverage()` at runtime.

The 40 town residents retain their shared routines and use the global graph. Harbor and countryside residents, fair visitors, riders, park crowds, aircraft and launch operations retain their authored local activity systems. These are connected public destinations, not a claim that every background actor shares one household simulation. The core road traffic retains its validated circuits; regional shuttles and aircraft use their own authored routes. Seven cars on the real traffic circuits use the electric fleet adapter, including pedestrian yielding.

## Review fixes

- A grouped, scrollable district menu replaces the clipped horizontal tab strip. All 30 destinations fit desktop and mobile navigation.
- Cards use the selected place's own story, exact name and actual district. Changing views clears the previous inspection. Stadium copy is confined to the school district.
- District totals come from the compiled world. Work status reports actual workers, commuters, breaks and shift hours instead of a permanent “0 of 6” label.
- The fair's speech bubbles and dialogue behavior are removed. Residents act through paths and props.
- Local residents have distinct names for inspection and following.
- Late-night venues are filtered by opening hours; the planner does not send a bartender to a closed shift or ask a seat to perform an unsupported eating activity.
- The airliner holds above Pinecrest’s ridge before descending toward the runway; a sampled clearance test checks the relocated flight against the shared mountain envelope.
- Introductory copy stays out of district close-ups. Day-cycle lighting and camera bounds cover the entire enlarged world.

## Run and verify

Use port 5173. The existing private library mapping serves owned models from `/workspace/threejs-assets`; `public/licensed/` remains ignored and Vite does not copy it into builds. Supplemental local links can be prepared with `node tools/link-astra-harbor-assets.mjs` and `node tools/prepare-astra-outskirts.mjs`.

```sh
npm run build
npm run preview -- --port 5173 --strictPort
npm run test:astra
npm run test:astra:round3
npm run shots:astra:round3
npm run film:astra:round3
```

The world integration tests check five seeds, all home-to-venue routes, placement metadata and occupied homes, physically continuous walks to nine regional entrances, and card identity. The complete suite also checks individual district layouts, road traffic, aircraft/launch/stunt trajectories, prop activities, camera and lighting.

Validation passed: all 89 tests, the production build, and six integrated browser checks. No runtime/network errors or unregistered rendered geometry were reported.

The browser runner exercises the actual menu, building picking, exact stories, card dismissal, rotation, copied-view reload, simulation motion/pause and mobile navigation. It asserts an empty rendered-registry error list and records runtime/network errors. Evidence is in `shots/astra/round3-browser-evidence.json`.

Final stills are `shots/astra/70-world-day.png` through `93-world-original-angle.png`; they include day, golden hour, night and every district. `94-astra-connected-world-tour.mp4` tours the whole world in 30 seconds. Capture and tour evidence JSON describe the camera, time and route. Intermediate frames stay ignored under `shots/astra/.frames/`.

No licensed model files are committed. Captures are rendered evidence only.
