# Coral Coast — merge notes

Eastern expansion by the `village/astra-coast` branch. Open
`http://localhost:5197/?view=coast&seed=831`; `?view=beach` and `?view=strip`
open the closer beach and Ocean Drive views. The existing default stays Downtown.

## What is here

A roughly 120-unit coastline, pale sand, wet sand, turquoise shallows, four rolling
foam fronts, buoy ropes, twelve striped umbrellas, towels, two staffed lifeguard
towers, rescue boards, showers and two volleyball courts. A broad palm promenade
runs between the beach and Ocean Drive. The river still exits at the old eastern
edge, south of the new land, into the same ocean.

Fourteen tightly spaced Art Deco buildings form two rows: seven restaurants and
rooftop bars face the beach; seven narrow venues and upstairs flats face Ocean
Lane. The fronts include striped awnings, recessed windows, illuminated signs,
vertical neon fins, patio tables, festoon lights, planters, rooftop counters,
umbrellas and open exterior stairs. The windows, signs and pavement light pools
respond to the existing day/night lighting.

84 visitors navigate an explicit 3D graph, use crossings, enter patios, visit
back-street bars, walk onto the sand and climb continuous stair routes. They dwell
at their destinations and yield to slower followers; a small lane offset separates
opposing traffic. Evening destination choices favour bars, patios and roofs.
There are also 24 reclining sunbathers, 12 animated swimmers, eight volleyball
players, two lifeguards and 28 seated diners. These 74 beach/restaurant actors use
authored activity loops; they are not additional named household residents.
Swimming and sunbathing are daytime activities (7am–7pm). The volley ball is an
authored rally, not a physics or scored sports simulation. No dialogue was added.

## Isolated files and shared hooks

- `src/astra/coast-plan.js`: locations, parcels, terrain extension, shared street
  connections and view presets. Occupies approximately x=67…138, z=-112…8.
  The ocean extends to x=194. Two connections join the old town at (46,-33)
  and the eastern campus walk at (60,-69). Keep these corridors clear.
- `src/astra/coast.js`: geometry, instanced furnishings, surf, selection bounds,
  night lighting and the coastline life integration.
- `src/astra/coast-life-plan.js`: pure 3D path graph, shortest paths, visitor
  destinations, waiting, arrivals and movement. No browser dependency.
- `src/astra/coast-life.js`: owned instanced character meshes for walkers;
  instanced articulated swimsuit characters and seated patrons for beach life.
- `src/astra/coast-ui.js`: Coral Coast tab, three coastal camera buttons and
  context-appropriate moment text. Styles are scoped to the coastal navigation.

The small shared edits are:

1. `src/compiler/astra.js`: import/call `addCoastLayout(town)` before the shared
   venue connectors and reservations. The plan extends `town.outline` at its
   (65,-104) corner and expands the camera bounds eastward. If another expansion
   changes this corner, combine those outline edits explicitly.
2. `src/astra/world.js`: build the coast, register its selectable venues once, expose it,
   and call `coast.update(t,night,hour)` from the existing world update.
3. `src/astra/main.js`: include coastal camera presets and query views, mount and
   update the isolated UI, label coastal venue cards, and expose the coast audit.
4. `tests/astra.test.mjs`: district count becomes 10; venue count is
   `17 + COAST_VENUE_COUNT` (34). Buildings remain 35 and named residents remain 40.
   Older merged screenshot scripts also hard-code 9 districts/17 venues: update
   those aggregate expectations when combining all parallel branches.

All owned models reuse the existing private catalog and `public/licensed` mapping.
No licensed meshes or library files are included in this commit. The new Miami
buildings, palms, beach furnishings and beach poses are procedural toon geometry.

## Check and capture

```sh
npm run dev -- --port 5197 --strictPort
node --test tests/astra-coast.test.mjs
npm run test:astra
npm run build
node tools/shots-astra-coast.mjs
node tools/verify-astra-coast.mjs
node tools/film-astra-coast.mjs
```

Both capture tools use **only port 5197**, Chrome and software WebGL. Film frames
are temporary files outside the repository and are removed after encoding.
Final screenshots, browser evidence and the H.264 MP4 are in `shots/astra-coast/`.
The screenshot runner checks asset errors, real visitor and rooftop arrivals,
daytime swimmers/sunbathers, pause stability and mobile horizontal overflow.
The pure tests check town connectivity, parcels on land, all coastal destination
pairs, continuous walkable stair routes, avoidance of building interiors, real
arrivals, yielding and motion continuity across the evening schedule.

Validated on this branch: all 14 existing Astra tests (including the 100-seed
all-destination sweep), all three coastal tests, and the production build pass.
The browser activity audit observed 245 completed visits and 18 visitors who
had reached rooftop destinations. Browser and asset-error arrays are empty.
The additional interaction check clicks Café Cubano, verifies its card, uses
wheel zoom and the beach view button, and checks a freshly rendered mobile page.

The completed film is `08-coral-coast-life.mp4`: 16.5 seconds, 1120×800,
H.264 at 10 fps, showing the beach, daytime patios, the neon strip and a final
coastline view. See `film-evidence.json` for the shot list.
