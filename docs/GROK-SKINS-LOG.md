# Grok skins: decisions log (append-only)

- 12:20 ET. Worktree `village/grok-skins` from 7c6d639 (deployed compressed build), merged dd9fda7 (look v2) with `--no-ff`, then refactored it into skin data. `src/astra/look-v2/` was removed; its numbers moved into `src/skins/neon.js` and its code into `src/astra/skin/`. `?look=v2` stays as an alias.
- The default skin is all-null and runs the original code path (original light keys, toon ramp, `renderer.render`). I chose this over "styled shader with neutral uniforms" so the default stays exactly identical, not just close.
- Styled skins share one shader variant whose numbers are all uniforms. Styled to styled switching is uniforms only. Default to styled recompiles once, via `material.needsUpdate` and a program cache key of `|astra-light-v1` or `|astra-light-v1|skin-styled`.
- The lantern halo colour became a uniform (vec3 1,.63,.24 by default, the same value as the old literal).
- The LUT GLSL row count was baked to `LUT_SIZE x LUT_MAX` (4), so a skin can have 1 to 4 grades without recompiling. Neon keeps day/smog/dusk/night. Autumn and winter use day/dusk/night.
- Practicals (bulbs, lamp pools, signs, building hulls, spill pools) are scanned on the first styled skin and restored by reference when a skin leaves them null. A unit test proves the restore is exact.
- Draw budget: post at medium quality is 5 draws, and spill pools are 1 instanced draw. Halo sprites are hidden in every post skin, because bloom replaces them. Measured on the wide camera, every skin is at or below the default (see CHANGELOG).
- Autumn tuning, after round 1 stills:
  - ground leaf shift .45 -> .22 and groundColor #c7a24a -> #a99a4e. The ground read as flat mustard.
  - Dark conifers now keep about 70% of their green (`mix(.3, 1, smoothstep(.05, .14, lum))`). They had turned brown.
- Winter tuning, after round 1 (day was blown out):
  - day key intensity 1.6-1.65 -> 1.35-1.4, and fill 1.2 -> 1.0.
  - snow #f4f8ff -> #e4ebf4.
  - day LUT: sat .84 -> .9, contrast 1.04 -> 1.08, highAmt .10 -> .06.
- No separate blind critic model was run for the new skins. Review was self-review of fixed-camera stills only. Ashe's instruction (keep the current look as the default) needs no critic.
