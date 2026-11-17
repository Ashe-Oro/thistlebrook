# Art polish review — P0–P3

**APPROVED with P3 leftovers. No P0, P1, or P2 remains.**

Reviewed `f7eb6ba` against `docs/village/BRIEF-art.md` and `out/codex-village-art-report.md` in `/workspace/cel-town-art`, branch `village/art-polish`, on 2026-11-16. Browser capture used `/?size=large&seed=1234&life=1` with explicit hour/camera and software-rendering parameters.

## Findings and disposition

| Severity | Finding | Disposition |
| --- | --- | --- |
| P2 | The original studio lineup omitted Willowmere and was weak village evidence. | **Fixed.** Replaced `shots/village-art/townsfolk-lineup.png` with the twelve real residents posed in two readable rows at the village well. Buildings, paths, grass, dressing, and lighting remain visible. No synthetic floor or hidden village. |
| P3 | The new lineup's foreground bench partly covers the herbalist's shoes; a thin foreground pole crosses the carpenter's left side. | Open, cosmetic. All twelve faces, outfits, and silhouettes remain individually readable; nobody is buried in props. Grounding is separately measured. A higher camera could improve a future portfolio capture. |
| P3 | Video movement is visibly stepped at 8 fps. | Open, optional polish. The 12-second clip meets the duration/movement requirement. Higher-rate capture would improve presentation. |

No broken characters, obstructing new dressing, modern/out-of-style additions, or P0/P1 defects were found in this review.

## Visual and implementation review

- `market-dressed.png` and `yards.png`: denser baskets, crates, flowers, carts, benches, firewood, and fences retain the same cozy/toon family. Reviewed existing stills without redoing them. No visible new dressing/building/path/fence intersections were identified.
- `night-atmosphere.png`: grass stays dark blue-green, with warm localized lamp pools and lit windows. Night illumination has not reverted to daytime grass.
- Runtime dressing is gated by life mode and uses a derived seed. It creates separate scene batches without appending to compiled instances. Placement reserves architecture bounds, fence footprints, paving, existing props, and navigation strips; accepted props are tested against one another. The audit is geometry-based, not a guarantee about every possible seed.
- Capture reran seeds 1/7/19/1234: 259/246/260/255 additions, deterministic repeats, zero reserved/dressing violations, no compiled-town mutation. Each seed rejected injected building, path, and duplicate-prop collisions.
- Browser audit: toon materials and ink hulls present, twelve resident meshes, no browser/asset errors. New lineup feet range is 0.0265–0.0295 m above ground, within the existing 0.12 m allowance. Distinct palettes, hats, hair, skirts/overalls, footwear, stature, and tools remain readable.
- Compared resident identity fields against `1bb91a2`: all twelve IDs, roles, names, and workplaces match. All twelve on-disk GLBs match the recorded character SHA-256 manifest. No regeneration or download was needed.
- Inspected first/middle/last video frames and decoded frame hashes: actual orbit through the dressed market, H.264, 1280×720, 12.000 seconds, 96 frames, 96 distinct decoded frames. SHA-256 remains `582542a1d5a3c488d043bfbf3683b5bb4ad4ba5f355b8e78ac051426ba7920ee`.
- Post is documented correctly in the original report and capture code: stills use normal post; video retains toon/hulls but disables screen-space post and shadow maps for SwiftShader capture. Video is presentation evidence with that limitation.

## Changes and verification

Only `tools/shots-village-art.mjs`, `shots/village-art/townsfolk-lineup.png`, capture evidence, and review outputs changed. The script now preserves each resident's grounded Y, poses them in the actual plaza, restores their poses/camera afterward, and supports `--lineup-only` to retain the existing stills/video. The original report's studio-portrait description is superseded by this review.

Reproduction: `npm run build && npm run shots:village-art -- --lineup-only`.

Passed after the capture-code change:

- `npm run build` (existing large-bundle advisory only).
- `npm run test:checks` (negative checks, batching, runtime geometry).
- `npm run test:parity` (31 hamlet seeds, four large seeds, variants, forward/reverse and one-ulp math perturbation).
- Capture audit and browser assertions; all eight hamlet/large life-off full-JSON hashes at seeds 1/7/19/1234 match the before baseline.
- `node --check tools/shots-village-art.mjs` and `git diff --check`.

Logs: `out/codex-village-art-review-{build,checks,parity,shots}.log`. Machine-readable summary and artifact hashes: `out/codex-village-art-review-evidence.json`. Full capture data: `shots/village-art/evidence.json`. Video sample contact sheet: `out/codex-village-art-review-video.png`.

No runtime art changes were needed, so the unaffected market/yard/night captures and video were retained byte-for-byte. Compiled default JSON, `districts.js`, and other milestone runtime files were not edited. No purchases, forbidden download retries, external model services, pushes, deployments, merges, or local commits. Pre-existing untracked files/symlinks were left alone.
