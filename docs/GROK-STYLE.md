# OWNER: grok-style lane (Grok). "Thistlebrook Neon" — look v2 style rules

> **Moved (grok-skins lane, 17 Nov 2026):** look v2 is now the `neon` skin. Its numbers live in `src/skins/neon.js` and the code in `src/astra/skin/` (`material.js`, `post.js`, `lut.js`, `index.js`); `src/astra/look-v2/` is gone. Open it with `?skin=neon` (`?look=v2` still works). The default look is unchanged. How skins work: `docs/SKINS.md`. File names below refer to the old layout.

A cyberpunk miniature-diorama look for our existing vertex-colour models, proven on **Downtown / the town square** and written so any district can adopt it. Open `/?look=v2` (add `&quality=low|med|high`); without the flag the old look runs unchanged. Code: `src/astra/look-v2/` (`palette.js` holds every number below). Decisions: `docs/GROK-STYLE-LOG.md`. Spec: `docs/specs/GROK-STYLE.md` (with the 10:48 AM cyberpunk change).

Papertrails (MIT since 3bced70) was used for **ideas only**: wrap light, rim, tilt-shift band, camera-fitted rig, gold-frame critic loop. No Papertrails code or assets were copied or adapted, so no third-party notice is needed. If a later pass copies code, add the source-file header and `THIRD_PARTY_NOTICES.md` with the MIT text.

## The rules in five lines
1. **Palette is locked**: every surface is graded onto a deep blue-violet ramp (#191433 / #4a4880 / #c9c4ea), keeping 30% of its own colour by day and 22% at night. Colour accents come only from neon: magenta #ff2fa8, cyan #20e6ff, and acid #c6ff3a used sparingly.
2. **Light is soft and two-sided**: a soft wrap key (no hard toon bands), a violet fill, and camera-fixed neon side lights (cyan from screen-left, magenta from screen-right), with a thin cut-edge rim.
3. **Emission tells the story**: windows, signs, lamp bulbs and building silhouettes glow neon. They are on even by day (at least 55% strength) and run at full strength at night, with ground spill pools under every building.
4. **Ground is wet**: low-chroma ground (roads, paving) carries a wet mask. Post adds streak reflections of the bright neon above it, plus crisp puddle breakup.
5. **Read as a miniature**: tilt-shift band through the focus, haze toward the far edge, bloom on neon, one LUT grade per time of day, light vignette and grain, all post at reduced resolution.

## Palette
| role | hex |
|---|---|
| base shadow / mid / high | #191433 / #4a4880 / #c9c4ea |
| neon magenta / cyan / acid | #ff2fa8 / #20e6ff / #c6ff3a |
| haze day / night | #a7a3c8 / #3a2468 |
| shade tint day / night | #8f86c4 / #5a4fa8 |
| ink (night hull) | #07040f |

Light keys (`NEON_KEYS`, same columns as `light-cycle.js`): night sky #0b0a1f to #2a1446, fill #5040a8 at .9, key #7f8cff at .45. Day sky #5f5f8c to #a9a3c9, fill #b9b2e6 at 1.05, key #e2dcff at 1.15. Golden hour (17.4 h): key #ff8fbe at .85, fill .9, practicals .62.

## Material (patch on the existing MeshToon hook, `material.js`)
- **Re-theme**: `ramp(sqrt(luma))`, then `mix(ramp, vc*(.84,.82,1.10), chroma)`, with chroma .30 by day and .22 at night.
- **Tooth**: two-octave world-space value noise, albedo × (.95 + .10·n).
- **Wrap key**: `smoothstep(.30,.74, N·L*.5+.5)`. Shadow floor is .40 (.30 for foliage), tinted by the shade colour.
- **Side neon**: `cyan*max(0,-n.x)^1.6 + magenta*max(0,n.x)^1.6`, times albedo × .9 × (.3 + .7·night), using view-space normals.
- **Rim**: `(1-|n.z|)^5 * .12`, in cyan on the left and magenta on the right.
- **Windows**: the existing bluish-window detector. Each 2.3 m cell gets neon by hash (45% cyan, 40% magenta, 15% acid), with emission × level × (1.4 + 2.4·night).
- **Wet**: on up-facing ground below 0.7 m with low chroma, wet = .6 + .4·puddle, where puddle is `smoothstep(.5,.56, noise(xz*.9))`. Puddles darken to ×.55. The wet mask is written into scene alpha for post.
- **Building hulls**: these are the instanced ink hulls of buildings, recoloured per instance by a position hash. K is .18 + .32·night, with 0 extra draws.
- **Practicals**: warm bulbs (MeshBasic, radius < .6) become neon. Lamp ground pools become additive neon. Signs are tinted 55% toward cyan or magenta at ×(1.1 + 1.1·night). Screen lantern halos are off, because bloom replaces them.
- **Spill**: one instanced additive pool per building (radius 1.9 × footprint + 3), strength .06 + .34·night. It is colour-only blending, so the wet mask survives.

## Post (`post.js`, one MSAA HalfFloat scene target and 5 cheap passes)
| quality | MSAA | blur res | blur iters | draws |
|---|---|---|---|---|
| low | 0 | 1/8 | 1 | 3 |
| med (default) | 4 | 1/4 | 2 | 5 |
| high | 4 | 1/2 | 2 | 5 |

The composite, in order:
1. **Wet reflections**: 8 taps upward (step .009) of sharp and blurred colour above threshold .25, gain 2.6, plus a wet tint #090812-ish.
2. **Tilt-shift**: focusY .47, band .16, soft .32, max .68.
3. **Bloom**: threshold .5, gain 1.6 × (1 + 1.2·night).
4. **Haze**: from y .5 upward, .07 by day and .14 at night.
5. **LUT grade**.
6. **Bloom added after the grade**, so neon stays neon.
7. **Vignette** .34 and **grain** .006, with chromatic aberration off because the critic called it cheap.

### LUT grade (Ashe's tip, `lut.js`)
There are four 16³ LUTs (day, smog, dusk, night). They're generated at boot from the rules below, so they cost 0 bytes on the wire. They're packed in a 256×64 strip and blended by hour inside the composite, so they need no extra pass.

Schedule:
- 0–5 night
- 6.5 dusk
- 8.5–13 day
- 15.5 smog
- 17.6 dusk
- 19.8+ night

| LUT | sat | contrast | shadows toward | highlights toward | neon hue boost |
|---|---|---|---|---|---|
| day | .86 | 1.06 | #2c2a48 (.30) | #e6e2ff (.10) | 1.15 |
| smog | .74 | .98 | #353150 (.38) | #f0d8ea (.16) | 1.15 |
| dusk | 1.08 | 1.08 | #24183f (.42) | #ff9ccc (.18) | 1.30 |
| night | 1.12 | 1.14 | #140f2e (.55) | #9feaff (.12) | 1.45 (magenta h≈.90, cyan h≈.52) |

## Applying it town-wide
- The material, hulls, bulbs, signs and spill all key off generic things: MeshToon materials, the `userData.outline` hulls of building selectables, small warm MeshBasic bulbs, and sign planes. So every district picks the look up through `lighting.register()` and `createLookV2()`.
- Districts that build their own window materials should keep the warm-window snippet, so the neon replace still matches. Districts with their own glow shaders should read `NEON` from `palette.js`.
- To retune, edit `palette.js` or `lut.js` and log `old -> new (reason, measured)` in `docs/GROK-STYLE-LOG.md`.

## Gold frames and critic
- **Gold frames:** `shots/grok-style/gold/gold-{day,sunset,night}.jpg`. Gold metrics are in the log.
- **Critic:** `tools/grok-style-critic.py`. Each view is judged in a separate blind call, with the A/B order randomised. Each cell reads `winner v2–old score / closeToGold`:

| round | wide-day | wide-sunset | wide-night | close-night |
|---|---|---|---|---|
| r1 | v2 6-2 / 7 | v2 6-2 / 6 | v2 6-2 / 6 | v2 6-2 / 6 |
| r2 | v2 6-2 / 6 | v2 6-2 / 6 | v2 7-2 / 7 | v2 6-2 / 6 |
| r3 | v2 6-2 / 6 | v2 6-3 / 6 | v2 6-2 / 6 | v2 6-2 / 6 |
| r4 | v2 6-2 / 6 | v2 6-2 / 6 | v2 7-2 / 7 | v2 6-2 / 7 |
| r5 | v2 6-2 / 6 | v2 6-2 / 6 | v2 7-2 / 7 | v2 7-2 / 7 |
| r6 | v2 7-2 / 7 | v2 7-3 / 7 | v2 6-2 / 6 | v2 6-2 / 6 |
| r7 | v2 6-2 / 6 | v2 6-2 / 6 | v2 6-2 / 6 | v2 6-2 / 6 |
| r8 | v2 6-2 / 6 | v2 7-2 / 7 | v2 7-2 / 7 | v2 6-2 / 6 |
| r9 (LUT) | v2 7-2 / 7 | v2 6-2 / 6 | v2 7-2 / 7 | v2 6-2 / 6 |

v2 won 36 of 36 blind comparisons, and the critic scored it 6–7 out of 10 for closeness to gold. It plateaued there. Its recurring asks were the same each round: stronger and sharper wet reflections, diegetic signs instead of floating nameplates, and more tactile micro-detail.

## Probe (SwiftShader, 1280×800, wide downtown camera, same session for old/v2 r8–r9)
| metric | old | v2 (final, r9) |
|---|---|---|
| GL draw calls / frame, day | 2227 | 2227 |
| GL draw calls / frame, night | 2283 | 2283 |
| triangles / frame | 19,440,241 | 19,440,329 |
| ms / frame, day | 4271.8 (r0: 4695.4) | 4605.8 (r8: 4282.6) |
| ms / frame, night | 5257.7 (r0: 5453.2) | 5325.5 (r8: 5318.7) |
| bytes until ready | 262,778,832 | 262,778,835 (+3) |

SwiftShader frames take 4–5 s, and the same build swings ±400 ms between runs. So the +3 ms frame-time target can't be resolved on this machine. The v2 numbers sit inside the old build's run-to-run spread, and the post chain is 5 extra full-screen draws, offset by turning off the lantern halos. A real-GPU check is still needed.
