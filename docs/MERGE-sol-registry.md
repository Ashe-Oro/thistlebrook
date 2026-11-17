# Merge notes: Astra world registry and pathfinding

Branch: `village/sol-registry`. Inventory first: [REGISTRY-INVENTORY.md](REGISTRY-INVENTORY.md) covers the GLBs, procedural assemblies, infrastructure, effects and actors in the actual Astra renderers. Its generated reference table enumerates 521 logical placements on seed 831. Seed 0 has 525, seed 99 has 520; accepted scatter varies. Components such as windows, net strands, flags, crops and water glints inherit their assembly identity. Every rendered mesh/line and every instance has an ID that joins to full metadata, including attached equipment and actors (actors inherit their home/venue identity; this is a place registry, not a second resident roster).

## Files and integration

- `src/astra/registry/index.js`: serializable registry builder, validator and graph-based query facade. `town.registry` has `{version:1, places:[]}` and survives JSON serialization/structured cloning. Query functions are created separately with `createWorldRegistry(town)`.
- `placements.js`: inventories the renderer-only kit placements and procedural logical assemblies. Fences, laundry, bank rocks, ducks, chickens, school benches and fountain benches now have compiler-visible records. World/civic renderers consume those kit records instead of maintaining independent placement loops. Existing rock randomization remains at its original point in the renderer RNG stream.
- `interaction-schema.js`: the version-1 validator and tool/activity/animation enums copied from `village/astra-life:src/astra/life/registry.js`. Read that branch's merge notes and code against `832eacf` during implementation. At integration, share the validator rather than letting the two copies diverge.
- `authored-activities.js`: baseball metadata matches the life branch's backstop approach, roles, slot anchors and game coordinates, derived from the compiled field parcel.
- `render-tags.js`: explicit component tags, validation before batching, per-instance ID preservation, and final scene coverage checks. There is no nearest-object fallback for untagged geometry: a new direct mesh without metadata fails the browser build check. Helper-created pieces inherit the currently authored assembly or tagged actor/asset parent.
- `src/compiler/astra.js`: build registry **after** the graph and catalog activity nodes exist; run registry coverage as part of `checkAstra`. No new streets, graph shortcuts or water crossings are introduced.
- `world.js`, `districts.js`, `civic.js`, `catalog-scenes.js`: preserve ID arrays alongside matrices when batching. Picking a batch instance uses `object.userData.registryIds[instanceId]`; an ordinary object uses `object.userData.registryId`. Look up that ID through the registry.
- `residents.js`: existing destination selection is retained; routing now resolves the destination's `registryId` through the registry. Resident models carry their home parcel ID. Prefer the life branch's planner/executor when resolving the resident merge, while preserving the registry and render tags.
- `main.js`: exposes the query facade as `window.__astra.registry`.
- `vite.config.js`: development and preview use **5192**, strict. `copyPublicDir:false` remains. No licensed source models are committed.
- `package.json`: three additive scripts below. Existing tests and old non-Astra world registry are preserved.

## Record and query contract

Every place has `id`, `type`, `kind`, human `name`, `district`, `owner`, `occupants`, `hours`, `capabilities`, `pos`, `node`, `entryPoints`, and `interactionPoints`. IDs are unique within a compiled town, repeat deterministically for a seed, and keep parcel/venue/scene identities; scatter ordinals can vary across seeds and should not be used as cross-seed save identities. Model IDs are in `asset`, separate from placement identity.

Owner/occupant data is authored town metadata, not information inferred from licensed geometry. Building occupants follow the existing 32-resident home assignment; known shopkeepers follow the current roles. Remaining public assets belong to Astra town or their owning parcel/assembly. Opening times are authored service policies; the query's `hour` filter is optional so inspection can find closed venues.

```js
import {createWorldRegistry} from './src/astra/registry/index.js';
const registry = createWorldRegistry(town);
const market = registry.findPlace('market'); // ID, or exact human name ignoring case
const baker = registry.findPlace('Flour & Fern');
const meal = registry.findNearest(actor.node, 'eat', {hour: 12});
const shops = registry.findAll({district: 'downtown', capability: 'buy', hour: 12});
const route = registry.walkTo('market', {fromNode: actor.node});
const seat = registry.places.find(p => p.interaction?.activity === 'sit');
const seatedRoute = registry.walkTo(seat.id, {
  fromNode: actor.node, slot: seat.interaction.slots[0].id, hour: 12
});
// Also: registry.resolvePath(actor.node, targetId, {slot, hour})
```

`findNearest` compares weighted graph path lengths plus local access paths, not straight-line distance. Routes return `{ok, place, entryNode, nodes, points, slot, distance}`. `points` contains the street nodes, common approach, slot approach and final slot position, in order; all are `[x,z]`. Failure returns `{ok:false,error,...}` for missing names, invalid start nodes, unavailable access, closed venues, invalid slots and disconnected entries. The supplied start must be the actor's **reached graph node**. There is no invented origin or nearest-node teleport. The route plan does not move or reserve an actor; the life executor owns that state.

District routes end at an existing public graph node near the district centre. Buildings end at their real measured door nodes; public venues use their compiled entrances. Decorative props have `node:null`, empty access/capability arrays, and disabled activity metadata with a reason. Their centres are never falsely exposed as traversable ground. In particular, school/fountain benches and quay seats are inventoried even when no safe access has been authored.

## NPC-life merge

The existing `buildLifeRegistry(town)` on `village/astra-life` already imports valid `town.registry.places[].interaction`. Verified the **unmodified branch adapter** accepts all supplied interactions without rejections across 100 seeds, preserving unique place IDs.

Enabled interactions use exactly:

```js
interaction: {
  version: 1, activity, label, tools, duration, minParticipants,
  entryNode, approach: [[x,z]], hours: [open,close],
  slots: [{id, kind, position: [x,z], facing, animation, approach: [[x,z]],
           seatHeight /* seats only */, role /* baseball roles */}],
  game // baseball only: bases, mound, field
}
```

- Existing street benches get two rotated seat slots only if the graph spur, common access and both local approaches clear measured model AABBs, reserved venue/scene/terrace parcels, town bounds and water. Native props receive matching `key` and `interaction` fields so the life adapter skips its inferred bench fallback and merges the same ID rather than creating duplicate seat pools. Seed 831 has three enabled benches / six seats.
- All other benches retain candidate seat poses; sixteen procedural quay chairs, court/baseball/stadium bleachers and the two swings retain seat poses and heights. These have `activity.enabled:false`, never an executable `interaction`. A later district author can supply verified circulation paths and promote them. Unknown access fails closed.
- Seven catalog slots become seven independent interaction places, named `activity:<catalog-slot-id>`, owned by their actual model placement. Their `entryNode` is the compiler's existing approach node. The two-point slot pose becomes `[x,z]` plus `seatHeight` for seats, as required by life. Parent model entries are discoverable separately.
- Catalog `sit`, `browse`, and `eat` map to life `sit`, `browse`, and `picnic` respectively; sorting, warming hands and music map to the allowed `work` activity/animation, preserving the original name in `activity.catalogActivity`. The separate catalog demo renderer retains its richer procedural poses. Extend life enums and visuals together to support richer actions later.
- Baseball includes exactly three player slots, `batter`/`pitcher`/`fielder`, corresponding animations, `minParticipants:3`, the life drill duration and full game geometry. The incoming `baseball` ID replaces the life adapter's default record. Keep the life branch's suppression of the old baseball demo loop when life owns those actors.
- No imaginary chess or picnic furniture is added here. The life branch retains responsibility for drawing and registering its own two furnishings. No dialogue or `talkTo` capability is introduced.
- The life adapter currently imports only interaction-bearing incoming places. To adopt the authored ownership, shop capabilities and opening hours for **all** buildings/areas, merge its base place creation with canonical registry records by ID. Preserve `kind` (`home`, `school`, etc.) separately from registry `type` (`building`, `area`, etc.) where profile logic needs it; its current interaction import maps `type` to `kind`.
- Catalog demo performers already use these seven physical slots independently. At full integration, disable `buildCatalogScenes`' demo performers when the life reservation system owns the slots; keep its static model/pad loading and tags. Otherwise two independent activity systems could occupy the same physical slot. This branch supplies routes/metadata, not a second seat scheduler.

## Validation and inventory regeneration

```sh
npm run registry:inventory -- --write-doc  # reference table + ignored JSON, seed 831
npm run registry:inventory -- --seed=17   # out/astra/registry-17.json
npm run test:registry                    # coverage and all accessible pairs, seeds 0..99
npm run test:astra                       # existing 100-seed layout/route suite
npm run test:catalog
npm run test:world-registry               # legacy registry regression tests
npm run build
npm run dev -- --port 5192 --strictPort
npm run test:registry:browser             # actual private assets, seeds 831/0/99
```

Registry tests check complete metadata, unique IDs, all-pairs graph reachability, exact slot route tails, opening hours including midnight, service filters, graph-distance nearest selection, unknown/inaccessible targets, malformed/overlapping slots, missing coverage and lost per-instance IDs. The browser check validates every rendered mesh/line/instance and verifies every declared model/procedural assembly has rendered metadata (reservation-only terrace areas are explicitly marked), resolves all interaction slots, exercises normal resident navigation for ten simulated minutes and sees all 32 residents make further visits on each seed, with no page errors. The build retains the pre-existing large chunk and mixed dynamic/static import warnings.

The path layer is the existing weighted pedestrian graph plus authored/local access polylines. It is not a general crowd solver or a free-space navmesh. Disabled furniture needs explicit local navigation authoring before NPC use. Runtime assets remain private under the ignored library mapping. Existing untracked `SOL.md` and `sol-out.txt` are excluded from the commit.
