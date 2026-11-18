# Winter look

Dates use America/New_York. This is the TOWN-15 write-up: the winter skin was a flat white wash, and it needed contour and context.

## What was wrong

The winter skin painted almost every up-facing surface with a single near-white snow colour (`#e4ebf4`), a high shadow floor (0.52) and a pale day haze (0.14). There was no cool shadow hue, no worn ground, no lip at a roof edge and no tracks in the slush, so an isometric scroll looked like a sheet of paper.

## Research

Stylised and isometric snow is built from value and temperature, not from more white:

- Keep one light direction, and let form shadows and cast shadows describe the ground. [IBM Design Language, isometric light and shadow](https://www.ibm.com/design/language/illustration/isometric-style/design/).
- Snow is the lightest mass in the picture, but it is not paper white. Lit planes lean warm (cream); shadows lean blue or blue-violet from sky bounce. Save the brightest marks for a few sun-facing tops. [How to draw snow: light, form, colour, and falling flakes](https://skyryedesign.com/art/drawing/nature-plant/how-to-draw-snow/).
- Build shadows in temperature layers, not in dirty grey: a cool blue-violet pass, a pale warm bounce near walls or windows, and firmer cast-shadow edges. [Snow and Ice: The Light-First Winter Method](https://coloredcalm.com/how-to-color-snow-and-ice-with-colored-pencils-the-light-first-winter-method/).
- Keep even the deepest snow shadows relatively light, or the bank stops reading as snow. Avoid large areas of pure white so later grading still has room. [How to paint snow, Clip Studio Tips](https://tips.clip-studio.com/en-us/articles/10207).
- Add ambient occlusion where drifts meet walls, under eaves and in footprints. [Illustrating weather and its effects](https://tips.clip-studio.com/en-us/articles/6929).

Applied here: cool shadow / mid / warm highlight bands, slope-worn dirt and grass patches, crease AO, a snow lip where an up-facing plane drops away, slushy tyre-track streaks on roads, and only a light dusting on dark evergreens.

## Measurable targets

Shared with `src/astra/skin/winter-look.js` and `tests/winter-look.test.mjs`.

| Check | Target |
| --- | --- |
| Snow-pixel luminance spread (p90 − p10) | at least **0.22** |
| Distinct value bands in a top-down sample (8 luma bins, each ≥ 8% of snow pixels) | at least **3** |
| Snow pixels near pure white (luma > 0.96) | no more than **12%** |
| Winter skin: `highlight` luma minus `shadow` luma | at least **0.22** |
| Winter skin: highlight luma | at most **0.96** |
| Winter skin: wrap floor | at most **0.38** |
| Winter skin: day haze | at most **0.08** |

A “snow pixel” is luma ≥ 0.42 with chroma < 0.22, so sky and dark trunks are left out of the histogram.

## What this pass changes

- `src/skins/winter.js` carries three snow colours, lower wrap and haze, and `side.space: 'world'`.
- The shared skin shader (only when snow amount > 0) adds bands, exposure, AO, lips and road tracks.
- Weather-mode snow caps on the default cel skin get a mild cool-to-warm band so `?weather=snow` is not a single white mix either.

## Left for a later pass

These need meshes or maps, not just the skin shader:

- True ice on rivers and harbour water (a water-material tint and a thin edge).
- Modelled footprints and packed paths, and tyre tracks as decals rather than procedural streaks.
- Mesh-accurate snow lips on roof eaves, fence caps and window sills.
- Heavier evergreen treatment (sparse clumps on branch tops, dark interiors left clear).

Those can wait; the rule and the histogram already fail a flat-white regress.
