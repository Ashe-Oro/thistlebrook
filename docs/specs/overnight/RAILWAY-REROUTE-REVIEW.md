# Railway Reroute: Stage A plan review (Opus, 2026-11-18)

Reviewed: `tools/railway-plan.png`, `tools/railway-plan/route.json` (from commit `f3c6f3f`), and `RAILWAY-REROUTE-LOG.md`. Ashe has approved scope: a northern-only line (Roadster Proving Ground and Maple Hollow) that does not need to loop the park. The 11 deferred stops are therefore not a finding.

Method: I read the plan, JSON and log. I sampled `terrainSurface(town).height − GROUND_TOP` along the centreline and to each side, and checked the timetable and siding code in `src/astra/railway-plan.js` and `src/compiler/railway.js`. The probe was read-only and ran from a scratch script outside the repo. I did not re-run the planner or validator. Locations are given as `s` (metres along `centreline`) plus world `[x, z]`. The `±` side is relative to the direction of travel: `+` is the right-hand side, which is north on the westbound return.

## Verdict

**Rules:** the hard rules hold as written:
- 0 m over water and 0 bridges.
- 0 road crossings. The line never touches a carriageway, lot, building, plaza or tree (0 trees cleared; 7 grass/flower scatter only).
- Both platforms (ramps included) sit on dry, flat land, with terrain 0.00 m under every platform cell.
- Each bore meets the 6.1 m crown and 4.6 m wall cover.
- Max grade is 1.5% and the loop is closed.

**Blockers:** the plan is not ready for Stage B because of three issues:
- T1 is a tunnel only on paper along the hill's north edge, and its east approach runs in a side-cut.
- Five of the eight portals stand on flat ground in front of the hills, not in a hill face.
- The plan has no berth or siding, so Stage B would auto-generate an unvalidated siding on the new line.

---

## Blockers

### B1. Tunnel-1 (hill-8) hugs the hill's north edge; east approach is a side-cut

- **Where:** s 327–351, `[-21,-240] → [-43,-230]`, T1 portal a at `[-23.15,-239.68]` (s 329.22).
- **Wall cover:** inside the bore at s 330–351, terrain over the centreline is 7–12 m, but 4 m to the north (`+4`) it is 0.0–3.3 m. The validator measures wall cover only at ±2.2 m (`boreWall`), and passes at exactly 4.61 m. So the hillside drops ≥ 4.6 m within 1.8 m of the bore wall, with zero margin for the stone lining. The lining will poke out of the north flank, or show through the coarser rendered hill mesh. That is the "track into a mountain that isn't a real tunnel" look Ashe flagged.
- **Side-cut:** at s 327–328, one metre outside portal a, terrain on the south side is:

  | Offset | Height above rail |
  | --- | --- |
  | 1.6 m | 2.07 m |
  | 2.0 m | 3.31 m |
  | 2.5 m | 4.12 m |

  That is hillside inside the 2.0 m corridor on open track, i.e. a one-sided cutting, which is banned. The validator only tests the ballast edge (1.2 m), so it misses it.
- **Fix:**
  1. Shift s 325–355 about 3–4 m south, into hill-8, and move portal a east until it sits in the slope (see B2). Re-run.
  2. In the planner and validator, require lateral cover outside the lining: for example, terrain ≥ 2 m above rail at ±4.5 m along every bore metre.
  3. Extend the open-track terrain check from the ballast edge to the full corridor (±2.0 m). This matches the spec ("any rail, ballast or car vertex below the terrain surface is a ban"). With that check, s 327–328 fails today.

### B2. Portals stand in the open in front of the hills, not in a hill face

- **Where:** terrain at the portal face and 2 m inside, with the 4.6 m clearance arch (about 5.5 m with the portal's parapet):

  | Portal | Position | s | Face height | 2 m in | Hood |
  | --- | --- | --- | --- | --- | --- |
  | T0 b | `[11.87,-234.23]` | 292.2 | 0.00 m | 7.2 m | 3 m |
  | T1 a | `[-23.15,-239.68]` | 329.22 | 0.00 m | 3.1 m | 7 m |
  | T1 b | `[-74.07,-220.73]` | 385.26 | 0.00 m | 2.2 m | 8 m |
  | T2 a | `[-93.47,-225.00]` | 405.27 | 0.30 m | 2.6 m | 7 m |
  | T2 b | `[-122.34,-227.48]` | 435.29 | 0.00 m | 2.5 m | 8 m |

  T0 a (4.25 m face) and both T3 portals (2.9 / 2.6 m) are marginal but acceptable.
- **Problem:** a 5.5 m portal with a 7–8 m hood in front of a 2–3 m slope reads as a free-standing shed parked against a hill, not a bore into the mountain. On T2, half of the 30 m "tunnel" is hood (15 m bore). The plan's portal-face position is what Stage B will build, so this has to be fixed in the plan.
- **Fix:** move each portal inward until the centreline terrain at the face is ≥ 5 m. From the centreline samples, the targets are:

  | Portal | Move from s | Move to s |
  | --- | --- | --- |
  | T0 b | 292.2 | ~289 |
  | T1 a | 329.22 | ~332.5 |
  | T1 b | 385.26 | ~380 |
  | T2 a | 405.27 | ~410 |
  | T2 b | 435.29 | ~430 |

  Then add a planner or validator rule: face terrain ≥ portal height (5.5 m) at the centreline, and ≥ 3 m at ±3 m (wing walls). Where a hood is still needed, Stage B must bury it under a cel-shaded earth berm that blends into the hill, not leave a bare box.
- **Fallback for T2:** if hill-15 (only ~7 m over the line) cannot host a 5.5 m face with 6.1 m crown cover, drop T2 and route around hill-15's south toe. Three good tunnels still meet "≥ 2 tunnels".

### B3. No berth or siding in the plan; the service code will invent one

- **Where:** `SERVICE.berth = 'union'` (`src/compiler/railway.js:100`) and the siding at `src/compiler/railway.js:300-304`. The siding projects `[-130,-166]` and `[-50,-166]` onto whatever line exists and offsets 4.6 m to the left (`sidingPosition`, :171).
- **Problem:** Union is not in this plan. On the new centreline those projections land on the outbound leg, s ≈ 85–165 (`[-128,-186]` → `[-58,-189]`). Stage B would therefore get an 80 m siding 4.6 m north of the running line that the planner and validator never saw: trees, scatter, hill-side terrain and the 7 m separation rule are all unchecked. `timetable()` also gets `findIndex(... 'union') === -1` and silently makes Maple the berth.
- **Fix:**
  - **Plan side:** add a `berth` field to `route.json`. Recommended: `roadster`, with no siding. It is a single-train line, so the train can rest at the Roadster platform overnight. The shunt then becomes a no-op.
  - **Alternative:** plan a real siding as a validated segment with its own corridor. It must be ≥ 56 m to hold the 55.5 m consist.
  - **Stage B:** either way, remove the `[-130,-166]..[-50,-166]` projection and the `'union'` berth literal.

---

## Nice-to-haves (strongly recommended items first)

### N1. Both turnbacks are R 11 reverse curves with sub-coach tangents

- **Where:**
  - **East S-bend after Maple:** s 224–272, `[-1,-199] → [26,-220]`. It turns right ~19° at R ≈ 17 (s 224–232), runs a ~2–4 m tangent, then turns left ~136° at R 11–20, with R 11.0 at s 240 `[14,-196]` and s 264 `[28,-213]`.
  - **West teardrop:** s 496–564. It turns right ~51° at R 11–12.5 (s 500–512, min R 10.98 at `[-193.35,-212.00]`), runs a ~4 m tangent (s 514–518), then turns left ~227° at R 11 (s 520–562).
- **Problems:**
  - The renderer places each car on the chord between its ends (`trainCars`, `src/astra/railway-plan.js:106-113`). A 9.75 m coach on R 11 therefore sits 1.08 m inside the rail centre, and its inner body edge reaches ~1.94 m: off the ballast, with only 6 cm inside the 2.0 m cleared corridor. From the default camera the coaches will look like they are sliding off the rails at both ends.
  - A tangent shorter than one coach between reverse curves makes the cars visibly snake.
  - The log promised "everywhere else the running line keeps ≥ 22 m" (11 m was for the Coral Coast turning loop only). `summary.minRadiusMainline: 22` is wrong, because both R 11 bends are on the running line.
- **Fix:**
  - Re-run with `RminTight` 15 and a minimum 10 m tangent between opposite-hand curves.
  - **East:** the S exists because hill-11's south toe is 1.9 m high 3 m north of s 227–233. Start the left turn from a single right-hand lead-in, or let the bend take more of the open ground east of x 28.
  - **West:** widen the teardrop toward x −225 if the beach margin allows.
  - If R 11 is truly forced, keep it but correct the summary field. Also widen the cleared corridor on the inside of R < 15 curves to ≥ 2.5 m.

### N2. No curve speed limit; the train will take R 11 at ~10–13 m/s

- **Where:** `leg()` and the trapezoid speed profile in `src/astra/railway-plan.js:30-43`.
- **Problem:** the profile has no curve limit. On the Maple→Roadster leg (37% tunnel, so `cruise` 13 m/s), the train reaches ~10 m/s in the east S-bend and ~12.6 m/s entering the west teardrop. That is ~14 m/s² lateral, which looks like a toy flung around the bend.
- **Fix:** in Stage B, cap speed to `v ≤ sqrt(1.5·R)` (~4 m/s at R 11, ~5.7 m/s at R 22), using the plan's curvature, and recompute leg times.

### N3. Portal orientation versus the default camera; return leg partly hidden

- **Camera:** the default camera is orthographic from offset `(90, 90, 110)` (`src/astra/main.js:40`), looking north-west at ~32° elevation.
- **Portals:** the east portals face it (T0 a outward `(0.46, 0.89)`, T2 a, T3 a, and T1 a partly), so those are the ones players will see. All four west portals face away.
- **Hidden stretch:** the open stretch s 293–329 (`[12,-234] → [-22,-240]`) runs north of the 15–17 m crests of hill-11 and hill-8. At 32° elevation a 17 m crest hides about 27 m of ground behind it. So from the default view, almost the whole return leg will read as hills with no line, apart from the two turnbacks and s 386–405 and 436–454.
- **Fix:**
  - Give the plan a `railway` camera view framed on the line's bounding box (about `[-221,-242]..[28,-173]`, centre `[-96,-208]`).
  - The current `WORLD_VIEWS.railway` (`x:38, z:78, zoom:.245`) and the `overview(…, 3π/4)` override frame the old park-wide loop.
  - In Stage B, take shots from both default rotations to confirm each portal is seen at least once.

### N4. The Maple access path crosses the old line; Stage B order matters

- **Where:** the new footpath from `[-20,-195.10]` (platform back) to `[-0.61,-181.07]` passes 0.32 m from the old line's centre.
- **Fix:** Stage B must remove the old line before building this path. If it doesn't, there is an ungated track crossing.
- **Same pass:** Stage B should also remove the old line's 13 platforms, crossings, viaducts and trestles, and retire the West Works yard track. With Union gone it is an orphan stub (`rail-stub`), and the log's "connect or retire" choice is now retire.

### N5. The Roadster walk relies on the old platform's access link

- **Where:** `walkPath` for Roadster goes `[-181.5,-185] → [-184,-199.25]`. Those are the old Roadster station's access waypoints (`src/compiler/railway.js:79`, old stop `[-184,-203]`). The plan's "new access" is only the last 5.51 m, `[-184,-199.25] → [-189.51,-199.28]`.
- **Fix:** when Stage B removes the old station, keep or rebuild the 14.5 m `[-181.5,-185] → [-184,-199.25]` path as a plain footpath. List it in `access` as part of the new link (≈ 20 m) so it isn't deleted with the old railway.

### N6. Consist overhang at platforms (fine, but say so)

- **Facts:** the train is 55.5 m (9 vehicles, from `CONSIST` × `RAIL.stock` 1.15 plus couplings). The platforms are 32 m and 30 m, and the train stops centred on `station.s`.
- **Coverage:** the passenger section (coach 1 front at +14.8 m to guard's coach rear at −9.9 m) fits both platforms. At Maple, the 30 m platform leaves 0.2 m spare at the front.
- **Overhang while dwelling:**
  - At Roadster the engine is on the R 44 curve (s 37–47), and the last three freight wagons sit on the R 11 teardrop (s 555–564).
  - At Maple the engine is in the S-bend.
- **Fix:**
  - Record "freight tail beyond platform by design" in the plan.
  - Prefer a 33 m Maple platform. Ramps can extend to x −2 before the curve at s 224.

### N7. Small grade hump on the outbound leg

- **Where:** s 108–136, `[-110,-175] → [-83,-175]`. The rail rises from −0.09 to −0.02 and back, giving the 1.5% maximum grade at `[-84.85,-174.51]`. It is otherwise dead level.
- **Fix:** hold the bed at −0.09 if the 7 cm ground bump allows (it is within `open` 0.05 plus ballast). Otherwise leave it, since it is harmless.

### N8. Map legibility

- **Bug insets:** the eight old-bug insets dominate the lower half of `railway-plan.png` but show nothing of the new line. Shrink them, or move them to a second sheet.
- **Profile:** add a portal-face height and hood column to the tunnel table, and draw a small profile (terrain over the rail, at the centreline and at ±4 m) for each tunnel. B1 and B2 would have been visible at a glance.

---

## Checks that passed

- **Water:** no track or platform over water of any class, and no bridges are needed.
- **Roads:** no level crossings, no running alongside a road, and no lots, buildings, plazas or props in the corridor.
- **Trees and scatter:** 0 trees cleared. The 7 scatter items cleared are grass and wildflowers.
- **Bore cover:** every bore meets the minimum cover, at crown and walls, as defined (6.23 m crown and 4.61 m walls minimum, on T2 and T1).
- **Stations:** both platforms are straight over their full length plus ramps (Roadster heading −7/−8°, Maple 0°). They sit on the walk side, so no passenger crosses the track: 29.93 m and 48.81 m walks, within 60 m. The closest approach of the return track (8.08 m, at the Roadster platform, s 23 versus s 501) clears the 7 m rule. The platform is on the far side from it.
- **Profile:** the line is closed, and the profile is effectively level throughout.
