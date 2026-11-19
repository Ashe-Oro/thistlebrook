# Railway reroute: finish Stage A fast (Sol, Nov 18 2026 3:35 PM ET)

## Goal
Produce the top-down railway plan image plus route JSON in under 45 minutes, reusing the planner Opus already wrote. NO game/build changes (Stage B is gated on Ashe seeing the plan).

## Context
- Spec: docs/specs/overnight/RAILWAY-REROUTE.md (Stage A only). Opus notes: docs/specs/overnight/RAILWAY-REROUTE-LOG.md.
- Existing code (untracked): tools/railway-plan.mjs, tools/railway-plan/{build,grid,harvest,layers,costmap,astar,dubins,route,stations,describe}.mjs, rendered-footprint.json.
- Last run log /tmp/rr/plan5.log: legs fair->roadster->union->maple->airport solved; airport->coral (east coast corridor) fails. A heuristic bug was fixed (9k vs 288k expansions).

## Rules (hard, from Ashe; audit must fail any violation)
Never over water; never on roads except gated perpendicular level crossings; never on parking lots, buildings, plazas, trees; no stations on water; mountains only via real tunnels (portals on both sides).

## Do
1. Keep it rules-based and simple: grid A* on the cost map; if a leg has no path, allow a tunnel through mountain cells, drop or move that stop, or skip that district rather than tuning for hours. A loop that serves fewer districts but passes the audit beats a perfect one that doesn't exist.
2. Each planner run must be time-capped (timeout 300 s).
3. Output: tools/railway-plan.png (top-down, legible: water, roads, buildings, mountains, track, tunnels, crossings, stations labeled) and tools/railway-plan/route.json; print the audit (0 overlaps) and a stats line (length, tunnels, crossings, stations).
4. Commit the planner code + PNG + JSON locally on this branch (no push). Append a short summary to RAILWAY-REROUTE-LOG.md.

## Done when
PNG + JSON exist, audit shows 0 violations, committed. Stop there.
