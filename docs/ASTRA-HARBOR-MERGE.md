# Saltwind Harbor — merge notes

This branch adds a working waterfront southeast of Lantern Quay: Shell Cove,
changing huts and a boardwalk, Saltwind Fish Market, two boathouses, Gullwatch
Fishing Pier, two fishing cutters, two owned rowboats, and Saltwind Light.

Open `http://localhost:5188/?view=harbor`. The **Saltwind Harbor** tab and **6am**
control expose the district and dawn fishing. `?view=beach` and `?view=pier`
provide closer views. The default Downtown view stays the same.

## Integration surface

Only two existing source files change: `src/astra/main.js` and
`src/astra/world.js`. All district code is in `src/astra/harbor*`.

1. After `compileAstra(...)`, call `addHarbor(town)` from `harbor-layout.js`.
   It appends one district, five venues and seventeen navigation nodes, retains
   all existing node IDs, and validates the combined graph with `checkAstra`.
   It is idempotent. The original compiler remains unchanged, so compiler-only
   tests/CLI still describe the original six districts.
2. `buildHarbor(scene,town)` adds scenery and ten named local residents. Call
   `harbor.update(elapsed,hour,night)` from the world's update and expose the
   result on `world.harbor`. Its simulation uses elapsed time, so shared pause
   and speed controls work. Existing `buildDistricts` creates selection records
   for the appended venues without modification.
3. Main merges `HARBOR_VIEWS`, accepts `harbor`, `beach` and `pier` query views,
   extends camera clamps to x=110/z=90, and slightly widens the whole-town view.
   Mobile Harbor uses zoom 3.2. Merge these bounds with the other districts'
   camera bounds rather than replacing their additions.
4. Main compares `world.harbor.pick(ray)` with the existing resident pick, then
   uses the existing person card/follow behavior. Harbor venue cards use each
   venue's `story`. The pier/beach pick boxes have low heights so they do not
   intercept clicks on people.
5. `installHarborUI(ui,actions,town)` appends the view tab and dawn control,
   scrolls the active tab into the mobile strip, updates the district count,
   and supplies camera-local harbor happenings. Its CSS only adjusts tab/control
   spacing. The base `ui.js`, `style.css`, `residents.js`, `districts.js` and
   `civic.js` are untouched.

The local baseline runtime reports **7 districts, 13 venues, 26 original kit
building parcels, 148 connected nodes**. Harbor's procedural market, boathouses
and lighthouse are venue parcels, not additional entries in `town.buildings`.
There are still 32 original roaming residents plus 10 harbor people; other
district activity actors are separate as before. Any old browser audit with
hardcoded six-district/eight-venue counts needs the combined totals after merge.

## Space and navigation

The extension joins the exact existing node **[46,30]**, south of Lantern Quay.
The promenade runs x=27…91 at z=43; the pier runs x=70 to z=69. The market is
centered at [57,38], boathouses at [81,36], beach at [35,56], and lighthouse at
[91,51]. The sea shelf spans x=16…111/z=27…91. Reserve this southeast footprint
when combining other districts.

The original `town.outline` and `town.bounds` stay unchanged so the existing
river renderer is not stretched through new districts. Harbor renders its own
adjoining land and water, and exposes its extent as `town.harbor.bounds`.
`pointInTown` therefore remains a predicate for the original island. A lead
consolidating district boundaries should include the new coastline explicitly.

Harbor venues are on the public graph and are eligible for the original
residents' ordinary daytime venue choices. Harbor workers use shortest paths
on that same graph. Swimmers get a private extension at the beach entrance;
town pedestrians cannot accidentally choose its water nodes.

## Activity

- **05:00–09:00:** Maren and Ivo fish from the two pier arms, with moving rods
  and lines reaching the water.
- **09:00–12:00:** fishers repeatedly walk catch crates from pier to market,
  pause to unload, then return. The fishmonger works 07:00–16:00.
- **Daytime:** the boatwright checks the loft, landing and pier; two walkers
  visit the beach, market and light. Three swimmers enter the cove 10:00–18:00,
  swim a buoyed loop, and return through the shallows/changing huts. Speeds and
  pauses differ so the swimmers do not remain stacked together.
- **Night:** swimmers physically return ashore, fishing ends, the keeper makes
  rounds, boardwalk lamps illuminate, and the lighthouse lantern glows with a
  rotating beam. Boats bob at their moorings; they do not perform offshore trips.

These are visible activity schedules, not a fishing economy or inventory model.
No NPC dialogue was added.

## Private assets

Existing owned character, Cozy Village and Nature assets are served through
`public/licensed`. One new private mapping is needed on a fresh checkout:

```sh
node tools/link-astra-harbor-assets.mjs
```

This links `public/licensed/nature/rowboat.glb` to
`/workspace/threejs-assets/nature/bundle/glb/individual/rowboat.glb`.
The link and all raw GLBs remain ignored. No licensed models are included in
this commit or production build. Boats, buildings and other procedural harbor
details are ordinary authored Three.js geometry. The owned rowboat uses the
existing local Draco decoder and toon materials.

## Validation and evidence

```sh
npm run dev -- --port 5188 --strictPort
node --test tests/astra-harbor.test.mjs
npm run test:astra
npm run build
node tools/shots-astra-harbor.mjs
```

The new tests sweep 100 seeds, check paths from every original building to all
five harbor destinations, verify node ID preservation/idempotence, follow
actual catch deliveries, reject schedule teleports, verify walkers remain on
compiled paths, and exercise swimmers' entry/exit plus frozen time. All eight
tests across the harbor and original Astra suites pass. The build passes with
the pre-existing bundle-size and mixed dynamic/static import warnings.

The browser capture script checks real venue clicks, selecting/following Maren,
actual fish-market arrivals, swimmers in the cove, night return to shore,
lighthouse activation, pause/resume, and mobile layout with no browser errors.
Rendered screenshots and its audit are in `shots/astra-harbor/`; the initial
progress image is retained alongside the finished dawn/day/night views.

`ASTRA.md` and `astra-out.txt` were already modified/untracked at task start and
are intentionally outside this commit.
