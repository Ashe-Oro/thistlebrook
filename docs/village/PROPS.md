# Interactive village props (M4)

Play `/?size=large&seed=1234&life=1`. E uses the nearest prop: rest on a bench,
stand again, draw water, buy stall produce, ring the village bell, or open a
civic door. WASD also leaves a seat. Inside, E at the exit closes the door and
returns through the existing fade. O is an alternate door action near the exit.
E beside the inn's left table enjoys soup and a warm mug.

`src/life/props-interact.js` owns runtime meshes, prompts and adapters. Its only
shared hooks are initialization after interiors and delegation at the beginning
of the existing interiors E action. Lanterns and counters keep their existing
behavior when no prop action applies. Nothing is added to compiled instances or
the world registry. The modest bell is attached to a reachable chapel entry,
or plaza / well entry if there is no chapel; its host registry ID resolves the
action. The inn has handled teal mugs, tea surfaces and soup bowls on its tables.
Doors have visible paneled leaves in the existing rooms.

## Tools and inspection

All actions call `executeTool(name, {target}, actor, world)` from the shared typed
tool registry. `registerPropsTools()` supplies `sit`, `drawWater`, `ringBell`,
`openDoor`, `closeDoor` plus fallback `buy`, `eat`, `walkTo` only when a definition
is absent. Existing definitions are preserved, so the routines worktree remains
the owner of canonical tools. Each fallback exposes args/results schemas and
checks target, kind, distance, stall hours and door transition availability.
`target` is a registry place ID, display name, type or PlaceQuery. There are no
prices, charges, persistence or model calls: water/produce and meals are counters.

`walkTo` resolves the place with `resolvePlace`, selects its registry entry node,
and returns an actual walk-graph route; the player adapter follows its waypoints
at 4m/s. WASD cancels the route. Other actors receive serializable action state,
inventory and route results; their simulation owner drives their meshes. NPC
callers should supply `{pos:[x,z], inventory:{}}` and use `__life.props.world`.
The world adapter handles scene effects and the existing interior transitions;
only the player enters a rendered room. Registry seats supply seat poses. Room
furniture uses the existing room-local coordinates rather than outdoor guesses.

In the browser:

```js
__life.props.inspect() // counters, candidates, door states, recent tool results
__life.props.run('walkTo', {type:'market'})
__life.props.run('buy', {type:'market'}) // rejected until nearby and open
__life.props.run('drawWater', {type:'well'}, npcContext)
```

`run`, `world`, `actor`, `doors`, `bell`, `meal`, `candidates()` and `history` are
also available for local evidence. `inspect()` returns JSON-safe data. Repeated
E actions are allowed; this is an intentionally simple interaction milestone.
The bell has a decaying swing and synthesized chime; muted browsers retain the
visual feedback. Bench rest bends a private copy of the rigid character geometry at the hips and
knees; shared resident assets remain untouched.

## Verification and evidence

Run `node --test tests/life-props.test.mjs`, `npm run test:checks`,
`npm run test:parity`, `npm run test:world-registry`, `npm run build`, then
`npm run shots:village-props` (or `-- --stills-only`). The harness uses local
Chrome, ANGLE/SwiftShader, real E key input, and post on for stills. It checks all
four civic door transitions, counter changes, remote/invalid action rejection,
registry walking and an inn meal. Captures are under `shots/village-props/`;
`evidence.json` records results and errors after each shot. Interrupted captures
can resume in batches with `-- --part=outdoor`, `-- --part=indoor`, or
`-- --part=video`. The optional recording is an
8-second, 6 fps well/bell montage. The `--part=video` batch uses 640×360 and
a 26m capture radius for SwiftShader; full-town stills stay at 1280×720. Its framing is staged from registry positions.

When integrating the routines worktree, preserve its registered canonical tools
and retain the props adapter for scene effects. Its richer actor/world contract
may need an adapter in this module; do not replace its tool implementations.
