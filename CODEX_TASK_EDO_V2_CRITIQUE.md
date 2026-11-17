# Apply Claude Opus placement notes to Edo neighborhood v2

Work only in `/workspace/cel-town`. No purchases, no git push, no commit, no deploy, no API keys, no `npm install`, no 4090 / OK-COMPUTER, no Farm/city neighborhood, no new PixelLab characters. Do not drop render hooks in `src/main.js` / `src/stage.js`. Do not change default hamlet or default-large (no edo) compiled JSON (seeds 1, 1234, 7 must stay byte-identical). Hills are runtime decoration, not compiled instances — do not break default-large hill look if lots do not intersect them. Do not write files under `/workspace/celtown-render` (the render script will be updated afterwards).

You may run catalog:bounds (only if you catalog something, which you should not need to), compile, `npm run test:checks`, `npm run test:parity`, and `npm run build`. No screenshots.

Read `out/claude-edo-v2-critique.md` and `out/codex-edo-v2.md`. Apply the notes below. Leave skipped notes alone.

## Must apply

**1. Clear backdrop hills off the Edo footprint.** This is the root cause of the failed shrine-through-torii still. In `src/compiler/runtime.js`, `buildTown` calls `makeHills(groundRadius / 70)`. Edo uses area radius 150, so the scale is ~2.36. Hill #3 at `[0,-10,-70,30]` then has its ground-level toe around z≈-112 and buries the shrine [12,-139], great torii [12,-123], approach paving, and andon posts. The camera at [12,1.8,-115] looks into a grass slope; only the lintel of the torii and the chozuya roof poking out of the hill are visible.

Preferred fix (Claude): exclude hills from the town's occupied bounding box. Push each hill outward along its bearing until its ground-level circle clears every lot / instance footprint plus a **10m margin**. Implement this in `makeHills` / `buildTown` (pass occupied bounds or instance positions from the compiled town). When no lots intersect a hill (default hamlet and default large), the hill should stay where it is today so those views do not change.

Do not "fix" this by moving the shrine precinct into the lantern lane. After the hills are clear, the existing precinct layout should sit on flat ground.

If you can add a simple hard check that no Edo instance footprint falls inside a hill's ground-level circle with surface y > 0.05, do so, with a negative. If that is awkward because hills are runtime-only, document the clearance math in the report instead of a flaky check.

**3. Free-standing noren on the lawn.** In the lane-eye stills, a soba noren stands alone on grass off the tea-court paving, with a basket bench, and no building behind it. Snap every `edo-noren-curtain` to a door threshold, offset about 0.15m outward from the facade so it hangs in the opening. Move the produce baskets to the matching shop's street side, ~0.8m from the facade, parallel to it. Tighten or add a check: noren instances must be within 0.3m of an Edo door anchor. Prove with a negative (a noren on open lawn must fail).

## Worth applying (do these too)

**8. Paving seams.** The lantern lane is filled with overlapping `edo-road-stone-4way` tiles every 4m, which shows a repeating transverse seam and bulging kerb "bollards". Use **straight** tiles for the long runs and reserve 4-way / T / corner tiles for real junctions only (approach/lane, tea-court/lane, shrine/lane, shrine/precinct). Keep the stone bed high enough that dirt is not the dominant surface (the yOffset -0.13 bed fix should stay). Re-check `edo-street-paving` still passes (continuous centerline coverage on the three main streets).

**9. Tea-court spur.** It currently renders as a wide stone plaza that dies in the lawn. Pave it only one tile wide (true 2m walk). Give it a visible destination at the north end (about [-29,-86]): a small torii or a stone-lantern pair facing the garden walk, so the spur is clearly the way toward the teahouse.

**10. Lane east terminus.** The 98m lane fades into an empty hill. Place a modest closer at the east end, about [50,-100], facing west: a small torii, a kura, or similar already-catalogued piece that fits checks and does not block the walk. Do not relocate the pagoda out of the precinct.

**11. Garden grouping (keep the camera-clear pocket and `edo-bridge-over-water`).** The garden reads like a showroom of isolated props. Regroup, without putting trees/bamboo/large bushes in `EDO_CAMERA_POCKET`:
- Nodate tea spot: do not plant a stone lantern against the red bench. Move the lantern ~1.5m west; move parasol + bench so they face the pond across the path, around [-79,-92].
- Teahouse entrance: put the tsukubai next to the teahouse entrance (~[-70,-97]) with one stone lantern beside it.
- Move iris clumps onto the pond/stream edges, not open lawn.
- Pair the standing stone with a nearby iris or bonsai so it is not alone.
Keep recommended teahouse camera subjects (teahouse + pond + bridge) visible and the pocket tree-free. Keep the bridge spanning the stream channel.

**12. Water tiles as raised slabs.** Lower koi pond, stream, and any other water/garden ground tiles so the rim is flush with the grass (yOffset ≈ −slab thickness + 0.02), and ring visible edges with existing garden rocks if needed. If there is a stray third square tile in the lower-right of the teahouse shot that is not serving the stream/pond, remove or join it so water reads as one channel: waterfall → under the bridge → pond. Do not break `edo-bridge-over-water` (the span must still cross the measured channel with both abutments on the banks).

**7. Apron (if it fits cleanly).** The 2.4–2.6m frontage strip is still bright green lawn, so shops still feel set back. If you can do it without breaking the walk graph or paving checks, run a packed-earth or dirt apron from the stone walk to each lantern-lane facade (both sides, roughly x=-48 to 48) so stalls, signs and barrels sit on earth, not grass. If this fights existing systems, skip and say so.

## Do not apply (skip / later)

- A second, closer Edo overview camera (render-script only; leave it).
- Changing edo fog away from 260/540.
- Emissive shoji / interior teahouse light.
- Building-mesh chōchin materials (if that lantern is authored into a shop GLB, leave it; do not invent a new shader pass).
- Night point-light color, intensity, range, and stone-lantern glow height (those are in the render script, updated separately).
- Shrine camera vector (render script; after hills are clear it will be [12, 2.2, -111] → [12, 2.6, -139], FOV 50°).

## Tests and report

`npm run test:checks` and `npm run test:parity` must pass. Compile seeds 1/1234/7 with and without edo; no-edo JSON remains byte-identical. Edo seed 1234 should stay town.ok with the expanded 6/12 layout (counts may shift slightly if you add a kura at the lane end — document the new counts).

Write `out/codex-edo-v2-critique-applied.md`: what you applied and how (especially hill clearance math), what you skipped and why, updated coordinates for any moved pieces, any new/updated checks, compile stats for seed 1234 + edo, remaining issues.
