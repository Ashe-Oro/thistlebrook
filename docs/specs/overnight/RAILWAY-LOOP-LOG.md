# Railway loop: decisions log

Append-only. Seed 831 unless noted. Times are America/New_York.

## 2026-11-17 · Route ("Loop Q")

- **The loop closes in a tunnel.** No at-grade closed loop fits through the town: south of Maple Hollow there is a 5 m gap, between the lane at x −42 and the timber yard there is 2.5 m, and a double crossing of the airport bend hits either the Maple Hollow corner or the bus-stop garden. The return leg runs underground, about 202 m of the 591 m loop. It leaves past Lantern Quay through a portal at x 30, z −57 and comes back up at x −126, z −151, north of the world-link road verge. Both portals sit in grassy mounds. Cars and people never see the hidden track, and the audit's reserved-land check covers the tunnel too.
- **The visible route, in travel order:** Union platform eastbound (z −166). North up a 2.5 m corridor at x −44.5 between the depot and Maple Hollow. East along z −187 behind Maple Hollow, crossing the airport road on a radius of its bend so the crossing is perpendicular (89.8°). South along x 72.4 on the landside strip between the airport road and the apron, crossing the skatepark link road at z −91 (90°). West along a pocket at z −57 between the Owls stadium and the basketball court, into the tunnel.
- **Stations (4):** Thistlebrook Union, the existing West Works platform, dressed with pack lamps, boards, benches and a clock. Municipal Airport is landside, on the strip west of the track at z −170..−140, and links to the airport road at z −154. Thistlebrook High · Owls Stadium is at z −128..−98 and links at z −110. Lantern Quay & Market Square is at x 36..66, z −55..−53 and links to the lane at z −33 (x 42). It stands in for the spec's "Downtown or Market Square", because no track can reach the market itself at grade. Each new station is a `station` venue with its own graph node and walk link.
- **Overnight berth: Union platform.** That is the documented siding. The train sits there from the end of service until 06:30.
- **The West Works line is part of the loop.** `town.workRail` (x −112..−47, z −166) lies on the loop. The old shuttle is hidden and its track is no longer drawn. `trainState` stays for its tests. Freight collections now fire when the loop train leaves Union (`works.setTrainSource`).

## 2026-11-17 · Timetable and stock

- Steam locomotive, tender and two passenger coaches from the Railway pack at 1.15× scale: 32.8 m.
- Service starts 06:30 with a 30 s dwell at every stop. The trapezoid speed profile uses a = 0.55 m/s², 7 m/s on the surface and 9 m/s on the mostly-tunnel leg. The legs take 42.0 s, 17.5 s, 23.2 s and 46.4 s.
- **Lap: 249.0 sim s (4.15 min at 1×, under the 12 min limit).** The last of 6 laps starts before 22:00 and ends at Union about 23:06. After that the train rests overnight.
- Barriers drop when the engine is 25 m from the deck, with an 8 m ramp. They rise once the last coach is 2 m clear. Regional cars and the Pinecrest shuttle stop at a stop line 3.4 m from the rail (`setStopLines` in `regional-traffic.js`). Residents hold at a closed crossing deck (`setRailGuard` in the life runtime).
- 18 rail travellers a day are precomputed. Each walks from a door or gate in the origin station's neighbourhood along the pedestrian graph to a spot on the platform, waits, disappears into the coach when it leaves, reappears when it arrives at the destination, and walks on. Each one waits at a closed crossing. Their routes never touch the rails except on crossing decks (checked in the test).

## 2026-11-17 · Corridor clearing and neighbours

- The plan drops landscape trees and models, and town trees, that stand in the ballast band or within a crown's width of a platform: 7 trees and 13 landscape models. No hills were in the way. The random stream is unchanged.
- Airport (render only): the Clover Flying Club hangar was 18 m wide and stood across the landside strip. With the railway present it is 11.5 m wide (x 75.5..87) and keeps its apron-side door. Landside props whose footprint touches the rail band are left out of the airport render.
- The airport curve was eased (R 16, east strip x 72.4) so the bus-stop garden's crate clears the ballast and the scene keeps its three members. An earlier attempt that dropped the crate broke the TOWN-05 rest-stop test.
- The Railway pack lives at /workspace/asset-packs/railway, outside /workspace/threejs-assets, because the catalog test inventories every GLB under that root. Only 13 models are linked into the gitignored `public/licensed/railway/`. Nothing licensed is committed.

## 2026-11-17 · TOWN-09 and checks

- New rule **TOWN-09 · Rails are not walkways** in docs/TOWN-RULES.md. `auditRailway` (tools/audit-town-rules.mjs) reports `walk-on-rail`, `rail-on-road`, `rail-crossing`, `rail-reserved`, `rail-on-parcel` and `rail-blocked` under TOWN-09. It reports `rail-off-surface` under TOWN-04, `station-orphan` under TOWN-05 and `rail-stub` under TOWN-06.
- tests/railway-loop.test.mjs injects five faults, and each one makes the audit fail: a walk edge across the track, a floating rail sample, a station whose walk link is removed, a gap in the loop, and an ungated crossing.
- sim:collisions now includes the train cars as vehicles (pairs within the same train are skipped), the rail travellers as walkers, and a `personOnRail` count. Full day: 0 / 0 / 0 / 0 / 0, 12 crossing closures (6 laps × 2).

## 2026-11-17 · Probe numbers and draw calls

Same camera on main (2c52827) and on this branch, 1600×1000, swiftshader:

| view | before | after | delta |
|---|---:|---:|---:|
| Union | 398 | 375 | −23 (shuttle and old track meshes gone) |
| Lantern Quay station | 378 | 433 | +55 |
| Airport-road crossing | 280 | 353 | +73 |
| Wide (whole loop) | 2925 | 3035 | +110 |

Track is four draws for the whole loop: one merged formation, two merged rails and one instanced sleeper mesh. Platform modules and dressing are one instanced draw (plus one ink draw) per model. Most of the remaining cost is per-object: barriers, name plates, smoke puffs, the four cars with their ink hulls, and visible travellers. Merging the name plates and smoke would be the next saving.

## 2026-11-17 · Review

- Before and after stills: shots/railway-loop/{before,after}-{union,station,crossing,wide}.png, plus after-airport, after-portal and after-night. Arrival clip: arrival-quay.mp4.
- No independent blind critic was available in this run, so I reviewed the stills myself. Fixes from those passes:
  - The ballast was invisible because of the triangle winding.
  - The hangar hid the airport platform.
  - Trees overhung the Quay platform.
  - The crate sat on the ballast.
  - The west portal mound pushed into the road verge.
- Open: the hangar still hides the coaches from the default camera at the airport stop. The crossing deck is a plain timber slab, not the pack's `level_crossing` set piece.

## 2026-11-18 · Merged to main as TOWN-10

main had already taken TOWN-09 for villager animations (villager-anims), so on merge the rail rule was renumbered **TOWN-10 · Rails are not walkways**. Entries above that say TOWN-09 refer to this rule.
