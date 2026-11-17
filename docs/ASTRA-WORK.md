# West Works

The northwest extension adds Astra Union Station, Sunward Market Gardens,
Rowan & Co. Timber Works, and the West Freight Exchange. Open
`http://localhost:5182/?view=works&seed=831`, or choose **West Works** in the
view tabs. The activity panel links to each workplace; clicking its parcel
opens its story. Ordinary residents remain selectable and followable.

The owned Cozy Village and Farm models supply the greenhouse, barns, smithy,
silo, equipment, trees and character meshes. Station, railway, train, growing
beds and workshop fixtures are authored geometry with the existing toon
materials. No licensed models are committed or copied into the build.

## Work and transport

Six existing residents have assigned workplaces: Clover and Tilly garden,
Rowan and Bram work timber, Hazel handles freight, and Hugh tends the station.
Each has a real residential home and an individual workplace standing node.
They walk the shared graph, work from 07:00 to 17:00, visit the downtown fountain
for lunch from 12:00 to 13:00, and return home after the shift. Two begin near
the work district so there is activity shortly after opening; the others
commute from town. Clock changes redirect commuters at the next graph node.

While a worker is actually at their workstation during a shift, gardens
produce one crate per 12 simulation seconds per worker and the timber yard
produces one load per 18 seconds. Staffed machinery animates with the same
simulation clock. Each train departure collects up to eight available loads
when Hazel is at the exchange, alternating produce and timber. The panel shows
remaining goods, total dispatched goods and current staffing. These are
session counters, not persistent storage or a complete town economy.

The branch-line train operates from 06:00 to 21:00 on a 100-second loop,
including a 24-second platform stop. It stays on its separate rail corridor.
The five platform passengers are decorative animated figures; residents
commute on foot and do not board the train. Pause freezes train motion,
machinery and production; the existing speed control accelerates them.

## Merge boundaries

- `src/compiler/astra-work.js`: expansion outline, four reserved venues,
  access roads, workstation nodes, assignments, shift and train timing.
- `src/astra/work-district.js`: geometry, kit instances, machinery and goods.
- `src/astra/work-ui.js` and `work.css`: view presets and activity panel.
- Compiler integration runs before reservations and graph splitting, then
  assigns workstation nodes. Rendering is integrated through `world.js`.
- Small hooks in `residents.js` choose work destinations and redirect at shift
  boundaries. `main.js` adds cameras, bounds-aware panning, parcel stories,
  the activity panel and audit output. `ui.js` derives the district count.

When combining other expansions, reconcile the island outline in
`addWorkingDistrict` and the town overview camera. The existing river still
spans its original west/east limits; the new northwest land must not extend
its water ribbon beyond the southwest island edge.

## Verification

Use port **5182** only:

```sh
npm run dev -- --port 5182 --strictPort
node --test tests/astra.test.mjs tests/astra-work.test.mjs
node tools/shots-astra-work.mjs
npm run build
```

Screenshots and `evidence.json` are in `shots/astra-work/`. The browser check
records six actual workplace arrivals, productive shifts and collections,
four clickable workplace stories, lunch and home arrivals, pause/resume,
overnight closure and mobile rendering. Compiler tests sweep 100 seeds and
check every pair of public destinations, collision rejection, separate rail
and pedestrian corridors, shift boundaries and shuttle continuity.
