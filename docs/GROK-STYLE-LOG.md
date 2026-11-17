# OWNER: grok-style lane (Grok). Append-only decisions log for look v2 ("Thistlebrook Neon").

Format: `ID — decision (old -> new, reason, measured)`. Times are America/New_York.

## Assumptions
- A1. District: **Downtown / town square** (`view=downtown`, cameras wide {x:-57,z:-6,zoom:3.1} and close {x:-60,z:-4,zoom:5.6}). Scouted market, neighbourhood, downtown, quay, orchard, civic at 11:00; downtown has the densest mix of shops, signs, fountain, river and traffic in one frame.
- A2. Hours: day 11:00, sunset 17:6 (17.6 h), night 21:30 (21.5 h).
- A3. Gold frames: OpenAI Images (`gpt-image-1`) is not available on this key (model list has no image model), so gold frames were made with Grok Bot's image tool, using `r0-old-wide-day.png` as the layout reference. Files: `shots/grok-style/gold/gold-{day,sunset,night}.jpg`.
- A4. Critic: a separate blind model call per view (`tools/grok-style-critic.py`, OpenAI `gpt-5.2` vision), no builder context, randomised A/B, gold as image 1.
- A5. SwiftShader frame times are ~5 s/frame (19 M tris); +-3 ms is below run-to-run noise, so frame time is reported as measured with that caveat.
- A6. 10:48 AM — Ashe's CHANGE: cyberpunk aesthetic overrides the warm palette. No warm gold frames had been made yet; all gold frames are cyberpunk.

## Gold-frame measurements (tools/grok-style-metrics.py)
| frame | meanLuma | meanSat | neonMagenta | violetShare | tiltShift (edge/centre energy) | corner/centre |
|---|---|---|---|---|---|---|
| gold-day | .330 | .363 | .0022 | .938 | .571 | .947 |
| gold-sunset | .220 | .456 | .0159 | .813 | .433 | .860 |
| gold-night | .169 | .671 | .0256 | .898 | .504 | .460 |
Gold palette (night): #1c1847 #2a2460 #0f1439 #3f3077 #67539d #311752 + neon #ff2fa8 / #20e6ff / #c6ff3a.

## Decisions
- D1 — Style lives behind `?look=v2` (`src/astra/look-v2/`); old path byte-identical in behaviour. Lighting keys swap to `NEON_KEYS`, MeshToon patch swaps to `patchNeonShader`.
- D2 — Re-theme cozy vertex colours through a locked 3-stop violet ramp (#191433 / #4a4880 / #c9c4ea) by perceptual luma, keeping 30% (day) / 22% (night) of the original chroma. Reason: no new assets; palette hexes land on the gold ramp.
- D3 — Hard 3-band toon ramp -> soft wrap (smoothstep .30-.74), shadow floor .40 (.30 foliage), shade tint #8f86c4 day / #5a4fa8 night.
- D4 — Camera-fixed side lights: cyan from screen-left, magenta from screen-right (view-space normal.x), x(.3+.7 night). Rim pow(1-|n.z|,5)*.12.
- D5 — Window hook (world.js warm windows) -> neon windows hashed per 2.3 m cell: 45% cyan / 40% magenta / 15% acid; lit at >= .55 by day.
- D6 — Building ink hulls -> neon tubes per instance (hash of instance position), same materials count +2 clones, 0 extra draws.
- D7 — Post: MSAA HalfFloat scene target, quarter-res downsample + 2x separable 5-tap blur, one composite (tilt-shift, bloom, haze, grade, vignette, grain). +6 draws.
- t1 -> t2 — puddles covered grass (blotchy magenta/cyan); restricted to low-chroma ground (roads/paving) via `neonWet`. grain .045 -> .018, aberration .0016 -> .0005, haze day .16 -> .07 (day frame read washed: luma .415 vs gold .33, violetShare .41 vs .94).
- t2 -> t3 — first neon-tube attempt patched selectables (not in scene: statics are instanced); moved to instanced hull materials by geometry (30 building hull instances, 2 materials).
- t3 -> r1 — tiltMax .6 -> .45 (edge energy .36 vs gold .57: too blurry), bloom threshold .62 -> .5, gain 1.35 -> 1.6, night fill 1.15 -> 1.0, puddle noise scale .42 -> .9.
- r1 -> r2 — scene alpha now carries a wet mask; composite adds upward streak reflections of bright neon. Window emission x(1.2 + 1.6 night). Signs tinted. Grain .018 -> .01, aberration -> 0 (critic: "cheap RGB split").
- r2 -> r3 — puddles crisp (smoothstep .58-.64, scale .9), less in-material colour; reflections read sharp texture. Tilt .45 -> .55.
- r3 -> r4 — critic (all views): neon "feels like outlines", "milky purple wash", no spill. Added one instanced additive spill pool per building (colour-only blend; +1 draw). Tube K .22+.5n -> .18+.32n. Shadow lift .35 -> .12 and haze floor removed. Night fill 1.0 -> .82. Windows x(1.4 + 2.4 night).
- r4 -> r5 — removed reflection jitter (read as noise), gamma 1.18 -> 1.08 at night (black crush), night fill .82 -> .9, tooth .14 -> .10.
- r5 -> r6 — reflections gain 1.7 -> 2.6, threshold .32 -> .25, wet tint; tilt .55 -> .68. Lantern screen halos hidden in v2 (bloom replaces them). Draw calls: 2234 -> 2228 (baseline 2227).
- r6 -> r7 — merged the downsample into the first blur (post = 5 draws): draw calls 2228 -> 2227 = baseline. Also tried softer reflections (1.8/.32): scores fell 7,7,6,6 -> 6,6,6,6, so reverted (regression rule).
- r7 -> r8 — reflections back to r6 values, grain .01 -> .006. r8: 6,7,7,6.
- 11:41 AM — Ashe's tip: LUT grading. r8 -> r9 replaces the hand grade (shadow tint .12, saturation 1+.15n, gamma 1+.08n, cyan/magenta split-tone .10) with four generated 16^3 LUTs (day/smog/dusk/night) blended by hour inside the composite (0 extra passes, 0 bytes). Bloom now added after the grade. Before -> after (wide): day luma .339 -> .343, sat .347 -> .322; sunset luma .230 -> .222, sat .488 -> .533; night luma .169 -> .143, sat .660 -> .749, neon magenta share .0100 -> .0116 (gold .0256). Critic r8 -> r9: 6,7,7,6 -> 7,6,7,6 (same total; kept per Ashe's direction).
- Stop: 9 rounds; v2 preferred 36/36, closeness 6-7/10 and flat since r4. Remaining gaps the critic repeats: sharper wet reflections (needs SSR/planar), diegetic signs instead of floating nameplates, micro-detail/edge wear.
- 11:15 AM — box restore: /workspace was re-synced mid-run; worktree files survived but /workspace/cel-town/node_modules was missing, so `npm ci` was run there (same lockfile) to bring vite/playwright back. `out/` in this worktree went missing (55 tracked files); not part of this lane's commit.
