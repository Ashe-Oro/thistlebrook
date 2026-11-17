# World registry

`compileTown(spec, catalog, {seed, life:true})` for district towns and
`compileTown(spec, catalog, {seed, registry:true})` generate `town.registry`.
The default compile has no registry, new instance fields, or registry checks.
The compiler hook runs after life assignments, so existing home/workplace lot
assignments are available. Hamlet supports explicit `{registry:true}`. Its existing `life:true` no-op
behavior is preserved, as required by the parity suite; it does not spawn townsfolk.

The implementation is pure JavaScript and JSON serializable. It uses no renderer,
assets at runtime, API keys, or model calls. `src/catalog/places.js` supplies type
rules, hours, affordances, and the four canonical civic display names. New
placements and seeds automatically receive metadata; no per-seed tags exist.

## Records and defaults

`registry = {version:1, places, graph}` after graph connection. Each place has:

- `id`: unique placement ID, e.g. `place:house:lot:12`. Catalog IDs are reusable;
  use this placement ID for tools. Other objects use their source instance index.
- `catalogId`, `instanceIndex`, optional `lot` and `district`: source references.
- `type`, `building`, `name`, `pos`: semantic identity and world XZ position.
- `owner`: NPC ID or `null`; `occupants`: NPC IDs. The first assigned NPC is the
  default owner/contact. These are occupancy/contact defaults, not legal ownership.
  Vacant or unassigned places explicitly have `owner:null, occupants:[]`.
- `hours:{open,close}`: half-open game hours. `{open:0,close:24}` means all day;
  `{open:20,close:4}` crosses midnight. Queries normalize the hour modulo 24.
- `capabilities`: nonempty string array such as `buy`, `sell`, `work`, or `rest`.
- `points`: `{kind,pos,facing,node?}`. Positions and unit facing vectors are world
  XZ. Kinds include `entry`, `door`, `seat`, `counter`, `bed`, `workstation`, `stall`.
  Only entry points receive graph node IDs. Interior affordances are semantic
  anchors, not a generated interior navigation mesh or actual furniture meshes.

Every placed non-NPC instance receives a record, including infrastructure and
vegetation. House/landmark instances, catalog doors, and recognizable agricultural
outbuildings are buildings. Roads/rings/paving are zones; generic dressing uses
prop defaults. Existing district names are retained on places. NPCs remain in
`town.instances`, referenced by their IDs rather than duplicated as places.

Actual life home/workplace assignments match both catalog ID and lot. Without
those assignments, townsfolk catalog `work` defaults populate matching civic
places. Unassigned homes remain vacant; the registry does not invent NPCs.

Resolved catalog entries can supply an optional `place` object to override
`type`, `name`, `building`, `hours` (pair or object), `capabilities`, and `points`
(the list of generated interaction kinds). `place.interactionPoints` supplies
explicit `{kind,pos,facing}` anchors in resolved local units. Anchors replace all
generated points of their kind and support multiple seats/counters/etc. Instance
scale and yaw transform all anchors. Existing catalog files need no changes.

## Query API

All exports are in `src/world/registry.js`:

| Function | Result |
| --- | --- |
| `buildWorldRegistry(town, catalog)` | Metadata only; does not mutate town/catalog |
| `getPlace(registry, id)` | Stored place or `null` |
| `findPlace(registry, query={})` | Matching place copies, each with numeric `entryNode` |
| `interactionPoints(registry, placeId, kind?)` | Points of a kind, or all points; missing place returns `[]` |
| `nearestEntryNode(registry, graph, placeId)` | Connected entry closest to the place center, or `-1` |
| `resolvePlace(registry, target, query={})` | First match with `entryNode`, or `null` |
| `connectRegistryToGraph(registry, graph, town, catalog)` | Mutates entry nodes/graph, stores `registry.graph`, returns graph |
| `registryFailures(registry, graph, town?, catalog?)` | Failure objects with `msg` and optional `placeId` |
| `isOpen(hours, hour)` | Opening-hours predicate |

Queries combine `type`, `capability`, `ownerId`, `openAt`, `near`, and `name` with
AND. Name matching is case-insensitive substring matching. `ownerId` matches
`owner`, not every occupant. `near` accepts XZ or XYZ and sorts by distance from
place position, with placement ID as a tie-breaker. Without `near`, placement
order is preserved. `entryNode:-1` means the prop/zone has no navigable approach;
all buildings must have a navigable entry for the compile to pass.

String resolution tries unique placement ID, display name, then type. Object
resolution accepts a PlaceQuery. For tools:

```js
import { resolvePlace, nearestEntryNode } from '../world/registry.js';
import { nearestNode, route } from './graph.js';

const graph = town.life?.graph || town.registry.graph;
const place = resolvePlace(town.registry, 'market', { near: npc.pos });
const end = place ? nearestEntryNode(town.registry, graph, place.id) : -1;
if (end >= 0) {
  const path = route(graph, nearestNode(graph, npc.pos), end);
  // Tool layer checks/executes the path using its own action contract.
}
```

`resolvePlace(registry, {type:'bakery'})` and
`resolvePlace(registry, {name:'The Copper Kettle'})` use the same API.
NPC tools/planning are owned by the life worktree and are not implemented here.

## Graph integration and validation

The compiler owns one marked registry hook through
`src/life/registry-runtime.js`. It attaches metadata, connects to the existing
life graph (or builds a graph for registry-only mode), and appends the dedicated
`world-registry` report check. Failures set both `town.ok` and `town.report.ok` to
false. Default `validate()` is untouched.

One marked hook in `buildWalkGraph()` reconnects an attached registry after a
runtime rebuild. Entry approaches use catalog path snaps, offset outward by
0.10m for the walker's clearance. Assets without snaps use a footprint-front
approach 0.65m outside the footprint. Door anchors remain at the actual door.
Spurs anchor to the original connected roads/stall-front nodes, add bidirectional
edges with spacing at most 0.55m, and update `graph.connected`. Registry spurs do
not become anchors for further spurs, keeping reconnects idempotent.

Connections use exact segment intersection against footprints inflated by 0.30m,
including fences and agricultural outbuildings. If a straight building approach
is blocked, a visibility search around footprint corners can add bends. Building
approaches search original nodes within 64m; local detour corners are within
24m. Props/zones use direct approaches within 12m and can remain unresolved.
No fallback teleports a blocked entry onto a remote node. Unreachable buildings
fail validation, including buildings sealed behind fences.

The validator checks metadata, unique IDs, actual entry position/node agreement,
and edge reachability from the original connected component root. Passing `town`
also checks one record per source placement and required building classification.
The compiler also supplies `catalog` to include catalog-specific building overrides.
Vacant occupants are valid; missing occupant metadata is an error. The dedicated
validator can be rerun after graph or metadata changes without touching the default
compiler checks.

## Verification

Run `npm run test:world-registry`, `npm run test:checks`, and
`npm run test:parity`. The namespaced registry suite covers large seeds 1, 7,
1234, and 19 in both explicit-registry and life modes; hamlet opt-in/default
isolation; assigned occupants; queries; overnight hours; scaled/rotated future
assets; multiple anchors; graph rebuilding/idempotence; blocked entries; missing
metadata/records; and a disconnected graph whose connected-node list is stale.
The existing parity suite checks the six frozen default hashes plus browser/Node
compiler agreement.

`WORLD_REGISTRY_DUMP=1 npm run test:world-registry` writes the seed-1234 life
compile metadata and graph counts to `out/registry-1234.json`.
