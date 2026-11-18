# Build "Tesla lineup", recognizable stylized Teslas for the Roadster stunt lot jump lineup in the cel village (Three.js).

## Reference
- Ashe's ask: the cars the white Roadster kickflips over should look like a Tesla Cybercab, Tesla Semi, Model Y, Model 3 and Cybertruck.
- Collect real reference photos for each (side, front 3/4, top silhouettes) into docs/specs/tesla-refs/ via web search (reference only, never ship photos or logos).
- Gold stills: one per vehicle, a 3/4 front photo. Measurable silhouette traits to hit: Cybertruck = flat-panel trapezoid wedge with single roof apex, light bar front; Cybercab = two-door compact teardrop with sloped rear and no rear window, full-width light bar; Semi = tall cab-over with wraparound windshield and center seat, no trailer unless one is already in the lineup; Model Y = tall fastback crossover; Model 3 = low sedan with smooth nose and no grille. Approx real length ratios: Model 3 4.7 m, Model Y 4.75 m, Cybertruck 5.7 m, Cybercab ~4.2 m, Semi cab ~6–7 m (scale everything by the town's existing vehicle scale factor).
- Second fix, reference /workspace/refs/roads/ashe-roadster-reststop.png: a leftover rest stop near the Roadster arena (a bench, crate and barrel on a sand pad, an L-shaped footpath running onto the road, and a pale slab lying over the crosswalk and asphalt). Remove it.

## Details
- Vehicles live in src/astra/tesla/models.js (and arena.js / demo-motion.js for the lineup placement and jump). Rebuild the five lineup vehicles as procedural low-poly meshes (or better versions of the existing ones) in the cel look: flat colours, toon shading, ink outlines matching the town, crisp silhouettes, glass in dark tint, light bars emissive. Colours: Cybertruck stainless grey, Cybercab gold/champagne, Semi white, Model Y and Model 3 in Tesla-like paint (e.g. pearl white, deep blue, red). No Tesla logos/wordmarks (brand assets), but shapes should be instantly recognizable.
- Keep the jump working: the Roadster must still clear every car; adjust ramp/arc only if needed. Keep the same cars also usable as town traffic variants if the code already shares them.
- Remove the rest stop in the screenshot entirely (bench, crate, barrel, pad, footpath stub, slab) wherever it's generated (likely rest-stop / decoration placement near the Roadster lot or a regional-road rest stop), without breaking other rest stops. Make sure nothing else is left floating over the road there.

## Tools
Three.js, existing repo toon/outline pipeline, the project's shot tools. No licensed models needed; never commit licensed binaries. No spending. Claude Opus does the work.

## How to work
Autonomous, no questions; keep an append-only decisions log at docs/specs/OPUS-TESLA-LOG.md. Checklist with targets: each vehicle's silhouette matches its gold still (blind critic: shown the reference photo and the render side by side, critic must identify all five models correctly from renders alone with no labels); added draw calls <= 25; triangles per vehicle <= 3,000; Roadster clears the lineup (test); `npm run audit:roads` 0 open; `npm run sim:collisions` all zero; full suite `node --test tests/*.mjs tools/life-routines.test.mjs` and `npm run test:checks` pass. Loop: render each vehicle in a turntable/3/4 view next to its reference, have a harsh blind critic (a separate subagent) name each vehicle and list fixes, tune, repeat until all five are identified and look great in the cel style. Revert anything worse.

## Deliver
Commits on village/opus-tesla (local, don't push). shots/opus-tesla/: lineup-before.png and lineup-after.png from the arena camera, per-vehicle 3/4 renders, a reststop-before/after.png at Ashe's camera, and a short jump clip lineup-jump.mp4. CHANGELOG entry. Final summary with the critic result, draw calls and tests.
