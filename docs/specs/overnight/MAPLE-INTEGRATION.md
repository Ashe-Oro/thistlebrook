# Maple Hollow integration + rain/snow collision fixes

## Reference
- Local main adf3cb0 has railway-loop, vehicle-variety and weather merged. Maple Hollow (branch village/opus-suburb, f1762e7) could not merge cleanly.
- Saved merge attempt: /workspace/backups/opus-suburb-merge-attempt-20261118.diff; failing test log: /workspace/backups/opus-suburb-merge-attempt-test-20261118.txt.
- Lane logs: docs/specs/overnight/WEATHER-LOG.md, RAILWAY-LOOP-LOG.md, VEHICLE-STREET-VARIETY-LOG.md. Rules: docs/TOWN-RULES.md.

## Details
1. Weather regressions on main (fix first, commit): `npm run sim:collisions -- --weather rain` and `--weather snow` report vehicle–person contacts and unsafe crossings (stopped bus vs rail-traveller-10 near (-24.9,-14.8) ~hour 17.96; resident rafi vs the Civic Avenue cyclist near (-78.7,-36.1)). Fix the root cause (rail travellers' precomputed walk paths never yield to road traffic; crossing check misses cyclists turning onto the cycle strip). Clear, rain and snow full-day sims must all report zero. Add rain and snow sims to test:ci so this can't regress.
2. Merge village/opus-suburb into this branch (reuse the saved diff where it helps), then fix the 4 failures:
   - Maple Hollow's road meets the loop line with no gated crossing: add a perpendicular gated level crossing (or reroute) that obeys the rail TOWN rule.
   - parked-on-lot audit flags Maple driveway cars: driveway parking is legitimate; teach the audit a driveway bay type rather than suppressing the check.
   - tests/vehicle-variety.test.mjs: add parked-car plans for all Maple bays in traffic-fleet.js.
   - Keep the kids' treehouse/hoop/pool animation fixes from the merge attempt.
3. Do not overlap Maple Hollow with any other district.

## Tools
Existing test:ci, audit:roads, sim:collisions, shot tools in tools/. Licensed models fetched the way other lanes do; never commit them.

## How to work
Own worktree; commit locally at each milestone (weather fix, merge, each failure fixed). Never push or force-push. Any new rule goes into docs/TOWN-RULES.md with an automated check. Run tests serially (box is memory-tight).

## Deliver
- All tests, build, road audit and clear/rain/snow collision sims pass with zero issues.
- Shots: Maple Hollow level crossing, Maple driveways, rainy crossing near the Civic Avenue cycle strip, in shots/maple-integration/.
- CHANGELOG entry and a short log at docs/specs/overnight/MAPLE-INTEGRATION-LOG.md.
