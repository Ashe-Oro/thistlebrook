# Astra

Current integration: [18 connected districts](ASTRA-ROUND3.md). Registry coverage and prop activities: [registry merge notes](MERGE-sol-registry2.md). Latest polish integration and fixes: [integration notes](MERGE-sol-integrate.md).

A small, living town with eighteen connected districts. The default `/` route opens
the whole town; `?view=village` opens the entire town, and `?view=campus` opens the school; `?seed=831` is the screenshot seed. Earlier experiments remain available
with `?legacy=1`, `?size=medium&life=1`, and `/compile.html`.

| District | Purpose and activity |
| --- | --- |
| Willowbank | Homes, gardens, bakery, workshop, chapel, and the mill |
| Sunbeam Terrace | Eighteen homes in dense pastel terraces, a corner grocer, shared laundry and a lively pedestrian court |
| Market Square | Well, produce stalls, flowers, bunting and neighbours meeting |
| Astra High Campus | A clock-tower school, bus bay, tennis, basketball, playground, baseball diamond and football stadium |
| Old Town Centre | Bakery, shoe shop, bookshop, café, florist, post office and town hall around a flowing fountain |
| Lantern Quay | The Nightjar, Lantern Room, gelateria, dining terraces and evening music |
| Clover Fields | Orchard, farm buildings, chickens, and river ducks |
| West Works | Union Station, market gardens, timber yard, freight and six commuting workers |
| Civic Green | Fire station, clinic, public library, neighbourhood police and Willow Park |
| Saltwind Harbor | Fish market, boatworks, fishing pier, lighthouse and Shell Cove |
| Merrymead Park | Fairground rides, food stalls, picnic lawn and band shell |
| Stillwater & the Hinterlands | Cabins, lake trails, camping, ranger hut and working fields |
| Astra Municipal Airport | Public terminal, scheduled air traffic and apron services |
| Switchyard Skate & Bike Park | Bowl, street course, BMX track and spectator stops |
| Pinecrest Adventure Park | Mountain approach, coasters, rides and picnic gardens |
| Coral Coast | Ocean Drive dining, rooftop terraces, beach and volleyball |
| Roadster Proving Ground | Stunt arena, vehicle lineup and public viewing area |
| Starbase Texas | Launch and recovery demonstrations viewed from the visitor garden |

There are 26 kit buildings, nine terrace buildings, seventeen public venue parcels,
and three river crossings. Forty named residents use context-driven jobs, errands,
needs and prop activities. The eight terrace neighbours retain their own homes;
six Works employees produce goods only while physically working at their stations.
Named residents reserve seats, play chess and assemble for baseball practice.
Sports crowds, civic services and local courtyard vignettes add ambient activity.
Conversations are disabled.

Two bus circuits, cars, delivery vans and cyclists follow the town roads and yield
to pedestrians. Thirty-eight measured catalog scenes provide eighty-one exclusive activity
slots across all eighteen districts, including nine supply and rest stops,
Merrymead’s picnic garden and rhythm corner, and seventeen
[asset vignettes](MERGE-sol-assets.md) in the fields, civic gardens,
Hinterlands and Sunbeam Terrace. The registry also describes fair visitor slots, coast dining
seats and district furniture; each activity has one reservation controller. The day cycle changes the sky, sun, shadows,
window light and lanterns continuously.

## Run and check

```sh
npm run dev -- --port 5201 --strictPort
npm run compile:astra -- --seed 831
npm run compile:astra -- --sweep 100
npm run test:astra
npm run inventory:astra:registry -- --write-doc
ASTRA_URL=http://localhost:5201 npm run test:astra:registry:browser  # private assets
npm run build
npm run test:astra:integration  # production browser input and shared-system checks
npm run shots:astra:round2     # whole town, districts, mobile; port 5173
npm run film:astra:round2      # 24-second tour; requires ffmpeg
```

The browser runners use Chrome at `/usr/bin/google-chrome`. Round 2 screenshots,
video and JSON evidence live in `shots/astra/`; older runners and captures retain
the historical Round 1 behavior. The five-branch integration and next-merge
interfaces are documented in [ASTRA-ROUND2.md](ASTRA-ROUND2.md).

## Map compiler and placement rules

`src/compiler/astra.js` is pure JavaScript, shared by Node and the browser.
District locations, the stepped island outline and main street topology are authored; the seed varies
home selection, parcel offsets and landscape placement. Compilation does not
require WebGL or loading GLBs.

1. Declare district spines, crossings, public venue parcels and their entrances.
2. Place buildings from measured catalog bounds, including their orientation.
3. Transform each real doorway and add a reserved approach to its street.
4. Compile measured catalog scenes, reserve exclusive activity slots and connect
   their approaches. Place other furniture outside those reservations and streets.
5. Reserve dining terraces and gardens before placing trees. Check the canopy,
   rather than only the trunk, against roads, venues and occupied parcels.
6. Split all road intersections, T junctions and landings into one weighted
   navigation graph. Every building door and public venue gets a graph node.
7. Reject disconnected nodes, unreachable entrances, overlapping parcels,
   buildings inside public venues, overlapping venue parcels, and streets
   crossing unrelated buildings or playing fields. Only a venue’s authored
   entrance may cross its boundary. Tree bounds must remain inside the island.

The tests sweep 100 seeds, find paths between every pair of buildings and public destinations, verify
river crossings lie on bridges, check deterministic output and catalog
immutability, and deliberately inject invalid layouts to verify rejection.
`compile:astra` writes regenerable JSON under ignored `out/astra/`.

## Rendering and controls

`src/astra/world.js` builds the island, river, private kit instances and daytime
animation. `sunbeam.js` renders the second residential district and its six courtyard neighbours; `sunbeam-layout.js` adds its footprints, routes and resident roster. See [Sunbeam integration notes](SUNBEAM.md).
`districts.js` supplies the original sports and evening
venues; `civic.js` supplies the school, stadium, baseball field and downtown
fountain, shop fronts and activity. Static kit geometry shares instanced draws; the people remain separate
for movement and picking. Three-band toon materials and ink hulls preserve the
cel-shaded look. Blue window vertices gain warm emission after dark; lamps and
stage lights illuminate the night district.

Drag to pan, scroll/pinch to zoom, Q/E to rotate by 90°, Space to pause and H to
fit the town. **Share view** copies the camera coordinates, zoom and rotation.
The clock dropdown offers dawn, daylight, golden hour, dusk and moonlight.
View tabs jump between districts. Click buildings or courts for their stories;
click a resident and choose **Follow their day**. The sun, **3pm** and moon controls change
the time; speed cycles between 1×, 3× and 8×. Optional sound synthesizes quiet
bird calls in the browser after the sound button is pressed.

## Private assets

The runtime uses the owned Cozy Village, Farm and generated Character Model
Basic/Wardrobe GLBs already mapped into `public/licensed/`. The source library
is `/workspace/threejs-assets`. Do not commit or publish that directory or its
raw models. Both the directory and its local symlink are ignored; Vite builds
use `copyPublicDir: false`. The existing private preview middleware serves the
library from disk. A deployment must provide the same private asset mapping.
The screenshots and video are rendered evidence, not copies of the raw models.

## Civic Green expansion

The northwest civic district adds four service buildings and a large park, with
18 local people, fire response, deliveries, police patrols and afternoon stories.
Open `?view=civic` or the **Civic Green** tab. See [ASTRA-CIVIC.md](ASTRA-CIVIC.md)
for its isolated modules, merge points, schedules and screenshot evidence.

West Works uses real resident arrivals to staff its session production counters.
The [work implementation notes](ASTRA-WORK.md) describe the railway and schedules.
The [downtown notes](ASTRA-DOWNTOWN.md) describe shop landmarks, the lantern
promenade, and the added Friday-night crowd.
