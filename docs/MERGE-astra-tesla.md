# Astra Tesla fleet and Roadster proving ground

Branch: `village/astra-tesla`. This revision supersedes the red Roadster's
36-second rooftop flight in commit `02b980e`. There is now exactly one **white
Roadster**, performing an 87-second show in its own northwest arena. The old
route above town and its chimney intersections have been removed.

Seven logo-free electric cars still drive downtown: two fastbacks, one
crossover, three Cybercabs and one wedge truck. The arena contains a separate,
stationary lineup: **Cybercab, Cybertruck, Tesla Semi, Model Y, Model 3**, in
that order. The Semi has a tall cab, six wheels and an exposed rear chassis.
All vehicles are original procedural toon geometry, without Tesla logos.

## Merge hooks

Vehicle and arena implementation stays within `src/astra/tesla/`. Shared
source hooks are in `src/astra/main.js`; the follow-up also adds a scoped clock
rule in `src/astra/style.css`.

```js
import { createTeslaTown } from './tesla/index.js';

// After world, residents and the sibling branch's general traffic exist:
const tesla = createTeslaTown(scene, town, { traffic, residents });

// After traffic.update() has synchronized its meshes, once per frame:
tesla.update(elapsed, night);
```

**Pass `{ traffic, residents }` when merging `village/astra-traffic`.** This
suppresses this branch's seven-car preview and replaces seven existing traffic
visuals. Do not separately install the adapter. Bus, van, cycle, routes,
yielding, dimensions, simulation IDs and traffic counts remain traffic-owned.
The adapter still matches `traffic.root`, `traffic.objects`, and
`traffic.simulation.vehicles`; its contract is unchanged from `02b980e`.
Call it after traffic's update because that update animates wheel references.

Without traffic, the preview follows the existing downtown avenue loop,
preserves spacing and yields to nearby residents. It checks the supplied
`town.roads` and throws if that loop is no longer supported by the map.

Keep these camera/UI hooks from `main.js`:

- `tesla.addWatchButton(ui.root, ...)` selects the static `roadster` view and
  closes the detail card. The button is labeled **Roadster arena ↗**.
- Add `roadster: tesla.demoView` to the view presets and URL allowlist.
  `?view=roadster` opens the arena directly.
- View destinations accept optional `y` and `elevation`; the arena uses y=2,
  zoom=2.65 and elevation=45. Other districts default to elevation=90.
  The lower arena view makes the inverted car visible beneath the ramp lip.
- Expand the pan clamp's minimum X from -79 to -89 for the annex.
- Expose `tesla` on `window.__astra`, and include `tesla.audit()` in the audit.

The old automatic Roadster-follow button is replaced by a stationary arena
view so the ramp, landing area and spectators remain understandable. Ordinary
resident following and district navigation retain their existing behavior.

## Files and ownership

| File | Responsibility |
| --- | --- |
| `models.js` | `createTeslaVehicle(kind, {color, scale})`; +Z forward, Y up, ground origin |
| `semi.js` | Tall six-wheel Semi tractor, included by the same factory |
| `adapter.js` | General traffic visual replacement and restoration |
| `motion.js` | Downtown preview/yield simulation; re-exports the Roadster pose API |
| `demo-motion.js` | Pure show timeline, quaternion poses, ramp and lineup dimensions |
| `arena.js` | Annex, curved ramp, parked lineup, grandstand, labels and cold-gas puffs |
| `index.js` | Scene ownership, clock updates, button, audit and disposal |

Factory kinds: `sedan`, `crossover`, `cybercab`, `cybertruck`, `semi`, `roadster`.
`userData.dimensions` publishes scaled dimensions; `animate({distance,
braking, night})` animates wheels and lights; `dispose()` releases owned
resources. The Semi has six wheel groups; the others have four. Traffic
replacements are uniformly scaled into the existing agent's collision box.

The arena clones sixteen of the already-loaded, owned Character Model
Basic/Wardrobe residents. Their meshes/materials remain shared; no licensed
GLBs are copied or committed, and arena disposal does not dispose these shared
resources. Pass `residents` to populate the stand. Spectators are local
attraction actors, not additional navigation agents. They turn toward the
Roadster, lean and bounce during holds and flips, and settle between stunts.
No dialogue or speech sprites are added.

## Layout reservation and chimney fix

The new annex occupies **world X [-88,-42], Z [-83,-41]**, the previously
empty northwest cutout of the L-shaped island. It has its own slab, asphalt,
curbs and a visible pedestrian connection to the campus path at Z=-69.
This rendering annex does not mutate the shared compiler or navigation graph.
Reserve these bounds when merging other expansions. The short connection
extends east from X=-42 to -36; keep that campus walk clear.

Arena-local origin is world `[-65,-62]`. The ramp base is local `[-13,-6]`,
with radius 5.5, width 3.4 and a **185-degree** arc: it curls past vertical.
Cars park at local X=-4,0,4,8,12 and Z=1.5. The hover pad is [-4,15], on the separate front-left apron.
The two-tier, sixteen-person grandstand occupies approximately
X=[14.8,21.3], Z=[-19.5,-4.5], on the eastern sideline.
It faces toward the display cars and never lies under the flight corridor.

The Roadster's entire trajectory is inside this annex, west of X=-43.
It never crosses the town's roofs, chimneys, school tower or traffic lanes.
Tests transform the actual Roadster mesh through the loop and reject
intersections with all five parked vehicle boxes or the grandstand region.
The sampled minimum vertical gap over a parked car is more than 6
world units. Tiny tire/surface overlap of less than 0.04 units is allowed on
the curved ramp, representing the toy tires' contact compression.

## Show timeline

| Simulation seconds | Action |
| --- | --- |
| 0–5 | Wait, then approach the ramp |
| 5–11 | Suction climb and two-second inverted hold at 165 degrees |
| 11–18 | Reverse down the ramp and back up on the apron |
| 18–27 | Second approach, climb and inverted hold |
| 27–34 | Drive beyond vertical off the lip, barrel roll, thruster landing |
| 34–44 | Drive around to the lineup and take a rolling start |
| 44–54 | Broad 14-unit-high arc over all five vehicles; roll over the middle three; land beyond Model 3 |
| 54–64 | Drive to the separate front-left hover pad and stop |
| 64–72 | Standing-start flip, thruster descent, touchdown pause |
| 72–87 | Drive back to the ramp, wait, repeat |

The car rotates about its centre of mass; its road-going root stays unrotated
and the model's inner pivot receives `roadsterPose(time).orientation`.
Quaternion poses, clouds and crowd reactions use the same absolute simulation
clock. Pause and speed apply to the entire attraction. `roadsterPose` is pure
and periodic; it can also be sampled deterministically for capture.

Cold-gas clouds are pooled, short-lived pale puffs from the car's sides and
underside. The old blue lift cones and town-spanning contrail are not shown.
The visible underbody includes two suction fan housings. This is authored,
playful choreography, not a physical vehicle or aerodynamic simulation.

## Reference

The implementation follows Ashe's supplied sequence and the Tesla-supplied
ramp/airborne stills reproduced in the [demo reference article](https://www.drohnen.de/93385/tesla-roadster-flying-car-en/).
The [official replay](https://www.youtube.com/watch?v=qt5p-_tE8d0) was located,
but playback was unavailable in this environment; the stills were inspected
visually. No claim is made that the full video was watched. Reference images
remain outside the repository. Ramp scale and vehicle proportions are adapted
to Astra's toon style.

## Verification and evidence

```sh
npm run dev -- --port 5194 --strictPort
node --test tests/astra-tesla.test.mjs
npm run test:astra
npm run build
node tools/shots-astra-tesla.mjs
node tools/film-astra-tesla.mjs
```

Port **5194** is the only development port used. Capture tools default to it;
`ASTRA_URL` can override the capture target. Chrome and ffmpeg are required.

Ten focused tests cover complete-loop continuity/periodicity, both ramp
holds, upside-down flips and level landings, actual vehicle clearance,
downtown road footprints, pedestrian yielding/following distance, factory
bounds including the Semi, traffic restoration and scene lifecycle.
The five existing Astra tests also pass, including the 100-seed map sweep.
The build passes with the pre-existing large-chunk and `iso-interact.js`
static/dynamic import warnings.

Browser checks cover the real Roadster button, seven road cars, five parked
models, one white Roadster, sixteen reacting spectators, pause/resume,
8x speed, desktop/mobile framing, night lighting and return to downtown.
No browser console or asset-response errors were recorded.

Current evidence in `shots/astra-tesla/`:

- `12-roadster-arena.png` through `21-arena-mobile.png`: arena, climb, inverted
  hold, ramp roll, parked lineup, lineup kickflip, grandstand, standing flip,
  evening and mobile views. `23-lineup-touchdown.png` shows the entire
  Roadster on the pavement beyond the final parked car.
  `24-lineup-plan-view.png` is an actual overhead render at the apex.
- `22-roadster-ramp-and-lineup.mp4`: 32-second H.264 film at 12 fps. Ramp and hover chapters play at 2x;
  the full lineup vault plays at 1x from an isometric view.
- `demo-evidence.json`, `demo-film-evidence.json`: browser and film checks.

Earlier `01`–`11` captures and the old evidence JSON remain historical evidence
of `02b980e`; they show the superseded red Roadster rooftop flight. The capture
tools now generate only the new arena evidence. Capture closeups use zoom up
to 8; runtime's default arena view remains 2.65 with ordinary pan/zoom controls.

## Follow-up to 96b18ec: full-lineup vault and clock

The lineup jump now lasts ten simulation seconds (44–54), peaks at fourteen
units above pavement, and has a broad arc instead of the former brief low
peak. Its centre stays at local Z=1.5 while crossing every parked vehicle.
The barrel roll is limited to local X=-1 through 9, centered above the Semi;
the car is level before it passes the Model 3. Touchdown is at X=18, with the
entire Roadster past the last car and the new painted landing stripe.

The standing-flip pad moved from [13,10] to [-4,15]. This separates it from the
Semi/Model Y gap in physical space and in the default diagonal camera's
horizontal projection. The approach and return paths were updated together.

`#astra-clock` now uses a local monospace font at 14px/600 weight with ligatures
disabled, so the digits and ASCII colon remain distinct in the recording.
The browser check explicitly verifies `11:05 am` and the monospace style.
No shared UI JavaScript changed.

The new clearance regression requires over ten units of altitude directly
over **each** named vehicle, more than three seconds above twelve units, the
inverted portion over the middle cars, a level landing past the final bay,
and complete separation of the standing flip's horizontal projection.
The existing actual-mesh test now requires over six units of clearance above
parked roofs throughout the overlapping part of the vault.

## Follow-up to c00351b: one axis and rendered plan-view proof

The parked lineup, painted runway, straight run-up and vault now share
`ROW_AXIS.z=1.5` (world Z=-60.5). The takeoff mark moved to local X=-7.4,
immediately before the Cybercab; touchdown remains X=18. The asymmetric high
arc reaches its exact apex at **local X=4, Z=1.5**, directly over the Semi,
and the roll reaches its inverted midpoint there. `lineupApexTime()` supplies
the exact capture/test time instead of an approximate timestamp.

The sixteen-person grandstand is physically relocated and rotated onto the
eastern sideline, compacted to approximately 6.5 × 15 units and facing the
row. Its geometry-derived bounds are exposed by `arena.grandstandBounds`.
The old stand behind the row could visually overlap the elevated car in the
previous frontal shot; that placement and frontal recording angle are removed.

A new test instantiates the actual scene system and transforms the rendered
vehicle meshes into world space. Across 1,201 samples of the run-up, vault and
touchdown, it checks the car's center and entire mesh footprint against real
model boxes, rather than relying on authored center coordinates alone:

- Constant world Z=-60.5 from run-up through touchdown.
- The complete flying mesh stays inside the common Z footprint of the row.
- The center passes inside Cybercab, Cybertruck, Semi, Model Y and Model 3
  bounding boxes, in that order.
- Neither its center nor its complete X/Z footprint overlaps the actual
  grandstand bounds.
- The apex coincides with the Semi; takeoff precedes the Cybercab and the
  complete landed car is beyond Model 3.

The screenshot runner independently compares the loaded browser scene's
Roadster and Semi world coordinates at the apex, and records those values in
`demo-evidence.json`. The overhead image is a real camera change, with no
repositioning of vehicles. The film and `17-lineup-kickflip.png` now use a
45-degree isometric azimuth with an elevated camera, showing the row and the
arc together without the audience behind the airborne car.

The final encoded MP4 was decoded and visually inspected at 18.5s (approach),
21.23s (roll over the middle of the row), and 26.5s (touchdown), in addition to
the exact-apex overhead and isometric PNGs. Ten Tesla tests, the browser capture
checks, and the production build pass.
