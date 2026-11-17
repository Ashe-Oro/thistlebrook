# NPC tools

`src/life/tools.js` exports `NPC_TOOLS`, `registerTool`, `getTool`, `listTools`, `precheck`, and `executeTool`. Every definition contains `name`, JSON `argsSchema` / `resultSchema`, `precheck(args, context, world)` and `execute(args, context, world)`. Use `executeTool` rather than calling a definition directly: failures return `{ok:false,error}` without mutation.

| Tool | Arguments | Preconditions / effects |
| --- | --- | --- |
| walkTo | place: string or {id, name, type} | Resolve reachable entry and graph route; install movement goal |
| talkTo | target, text, optional activity | Known neighbour within four metres, arrived; speech and relationship interaction count |
| work | optional activity, item | Arrived; work activity |
| buy / sell | optional activity, item | Arrived; increment matching economy counter |
| payBill | optional activity, item | Arrived, bill exists; increment counter only |
| rest | optional activity, item | Arrived; restore energy |
| eat | optional activity, item | Arrived; reduce hunger |
| visit | optional activity, item | Arrived; visit/play activity |

Every success returns `{ok:true,action:{tool,args,hour}}`. Unknown names, missing required arguments, wrong primitive types and extra arguments fail. Preconditions remain authoritative for a future external planner. `__life.tools()` provides serializable schemas; `__life.history()` exposes the latest 180 successful planned calls.

`destinations.js` calls `getPlace`, `findPlace`, `nearestEntryNode`, then checks graph connectivity and routes. There are no world coordinates in tools. **TODO(rebase-registry)**: the supplied registry is empty. Only while empty, symbolic destinations resolve to existing reachable schedule nodes. `buildRoutines` creates aliases for home, work, tavern, market, plaza, and reserved meeting slots. Remove that fallback after registry integration and bind symbolic owned-home/work and reserved participant slots to registry place/interaction-point IDs. This branch deliberately does not merge or edit the registry workstream.

The single index hook installs the runtime before ticking. Movement and animation continue using the existing people renderer; only successful tools install its current goal/activity. Explicit `setHour` reconstructs positions rather than animating a day of travel. The single social hook supplies action dialogue and suppresses autonomous transient greetings from rendering.
