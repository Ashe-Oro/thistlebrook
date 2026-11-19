# Railway northern loop: fix review blockers (Sol, Nov 18 2026)
Ashe approved the northern-only loop (Roadster + Maple). Read docs/specs/overnight/RAILWAY-REROUTE-REVIEW.md.
Do in the PLAN only (tools/railway-plan*, route.json, validator); no game/build changes:
1. Fix B1, B2, B3 exactly as the review proposes (shift T1 south, move portals inward to >=5 m face, add berth=roadster with no siding; drop T2 per fallback if needed). Add the new validator checks (lateral bore cover, full-corridor open-track terrain check, portal face height).
2. Fix N1 reverse curves if it can be done by raising min radius / adding tangents without breaking rules; otherwise note it.
3. Every planner run capped at 300 s. Rules unchanged: rivers only on real bridges, roads only at gated perpendicular crossings, never on lots/buildings/plazas/trees, mountains only via real tunnels.
4. Regenerate tools/railway-plan.png and route.json, validator 0 violations, append a summary to RAILWAY-REROUTE-LOG.md, commit locally. Stop. Target under 40 minutes.

## Update from Ashe (6:17 PM ET)
The train runs 24/7: no berth, no siding, no overnight shunt. Set the plan's service to continuous looping, and remove the union berth literal and the siding projection logic from the plan contract.

## Update from Ashe (6:18 PM ET): build it
Once the plan validates, go straight on to Stage B in docs/specs/overnight/RAILWAY-REROUTE.md. Build the northern loop in the game from route.json (24/7 service, no siding, cel shading on all new assets, and a real stone portal set into each hill face with an earth berm). Run the tests and the town-rules audit, and take shots of the 3/4 overview, each tunnel portal and both stations, plus a short ride video. Update the CHANGELOG and commit locally. Don't publish.
