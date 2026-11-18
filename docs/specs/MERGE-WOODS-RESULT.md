# Merge woods result

`village/grok-woods` (8a0e0e0) merged into `village/merge-woods` at main `2c52827`, `--no-ff`.

## Conflicts

Four files conflicted. Both sides' features were kept: Pinewood, curb-to-curb crosswalks with TOWN-RULES checks, Funfair Parking, and the Thistlebrook naming.

- **CHANGELOG.md.** Kept every entry from both sides, newest first. The Unreleased block is now Crosswalks, Pinewood, Renamed the town to Thistlebrook, Funfair Parking, then the rest of main's notes.
- **package.json.** Union of scripts. Main's `test:ci` stays; woods adds `test:woods`, `shots:woods` and `film:woods`.
- **src/astra/world.js.** Kept woods: `buildWoods` import, `await buildWoods(scene,town)`, and `woods` / `woods.update(t,hour,day)` on the returned world object, alongside main's expansions, districts and later update hooks.
- **tools/sim-collisions.mjs.** Kept woods hikers as pedestrians and Funfair Parking's lot cars, visitors and `lot.audit()`. People passed to traffic, regional and the lot include walkers, errands, hikers and visitors. Crossing checks stay on main's TOWN-01 graph corridors (`crossingNear` from `graph.crossings` and `ZEBRA_HALF_WIDTH`), not the older woods `junctionBox` / `CROSSWALKS` fallback. The sim still exits non-zero if any collision count is above zero.

No other files needed a manual edit. Licensed model binaries were not committed. `out/` logs were left out.

## Gates

Run in `/workspace/cel-town-wt/merge-woods` after resolving, logs in `/tmp/mw-*.log`:

| Gate | Result |
| --- | --- |
| `node --test tests/*.mjs tools/life-routines.test.mjs` | 187/187 pass, 0 fail, 187730 ms |
| `npm run test:checks` | pass (breaks caught; medium 1/7/1234 OK; browser/Node parity OK) |
| `npm run audit:roads` | 0 open, 14 justified |
| `npm run sim:collisions` | 0 / 0 / 0 / 0 over 5400 samples; 75 vehicles, 40 residents |
| `npm run build` | pass, 3.39s |

## Leftovers

The merge spec also asked for three comparison shots in `shots/merge-woods/` (west woods wide, trailhead near town, downtown crosswalk). Those stills were not taken, so they are not in this commit. Existing grok-woods before/after stills remain in `shots/grok-woods/`.
