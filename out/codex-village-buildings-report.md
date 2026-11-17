# Living Village — Buildings report

Branch: `village/building-variety`. Work confined to `/workspace/cel-town-wt/buildings`; licensed derivatives written only under the authorized shared `public/licensed/` library.

## Result

Use `/?size=large&seed=1234&life=1&variety=1`. Four owned architecture looks cycle through fourteen residential lots on this seed. Seven civic/farm landmarks receive restrained palette variation. Twelve collision-checked harvest-yard props/structures from the otherwise unused Autumn catalog are added, including a cider press shed, garden shed and harvest pavilion. The Autumn farm cottage adds a distinct house mesh to the residential street. Twelve wardrobe variants retain the original townsfolk ids and runtime pivots, with skirts, overalls, varied hair, hats, boots and glasses. All assets pass through the established toon/hull loader. The default cast, compiler and life modules are untouched.

One marked hook each in catalog, package scripts and README. Browser-only opt-in runtime and sidecars contain the implementation. No default catalog pools are widened. Geometry-derived variant bounds live in a new sidecar; existing catalog geometry/bounds are reused for buildings and props.

## Validation

- `npm run test:checks`: PASS, including negative life and layout checks.
- `npm run test:parity`: PASS, including Vite SSR and one-ulp math perturbation (31 seeds, forward/reverse), plus large-town parity.
- `node tools/check-building-variety.mjs`: PASS. All six default life-off JSON hashes match the frozen fixture byte for byte. Twelve unique owned model exports and measured bounds checked.
- `npm run build`: PASS (existing large chunk size advisory).

Frozen SHA-256 evidence:

```json
{
  "hamlet1": "298ce18a20d64e3937782c459c02bacd743f8363aa892c0b224ab5d3eabf711c",
  "hamlet7": "6fa8e8ef35cb7bcc65bde159a68e820be7947ce925749063d1372a3255186670",
  "hamlet1234": "6b63379057bf8b8bd5b7c1e9b94df62a902177e89ec48e3ec2bc8bb9d60b1d5d",
  "large1": "af385e77f92655f40d9aea9356b4aecea7e72677488a3bbfb2c34f526716eac3",
  "large7": "2e34f0ef4bb8fea5d30f896519d3a8691b34fc88209d2bbcbb827c5ce191c719",
  "large1234": "884c24dcf270e07a2625995c74e587f602e2d299d7d6a4839cd2d5ef811bd6c2"
}
```

## Assets and limits

Reused installed ThreeJS Assets Cozy Village, Farm, Autumn, Character Model Basic 1.1.0 and Wardrobe 1.0.0 under the existing lifetime commercial license. No purchases or downloads, no Village Folk retry, no external API calls. Twelve new GLBs are in gitignored `public/licensed/characters/variety/`; licensed geometry is not committed. Run `node tools/generate-building-variety.mjs` to regenerate using the same installed owned source packs as the art exporter. The art-owned exporter is read and adapted in memory, never edited; default GLBs are never overwritten.

This is a runtime visual layer. It preserves original compiled architecture, entry nodes, collision and interior metadata; replacement appearance doors are not new registry entries. The layer finishes after normal town readiness: wait for `window.__variety.ready`, and inspect `window.__variety.error` on failure. Exact replacement door authoring would be needed before promoting these appearances into compiler-selected buildings.

Details and credits: `docs/village/BUILDING-VARIETY.md`. No other worktrees edited, merges, pushes, deployments, API keys, LLM calls, 4090 or Claude use.

## Captured evidence

`npm run shots:village-buildings`: PASS on large seed 1234 with `life=1&variety=1`, using local Chrome/SwiftShader. Browser opt-in and default life-on compiled JSON are identical, and the default page has no variety runtime marker. The capture confirms 14 changed residential appearances, 7 civic palette variations, 12 collision-checked harvest-yard additions, and 12 variant residents with measured grounded feet, MeshToonMaterial and outline hulls. No page errors or asset HTTP failures.

Artifacts in `shots/village-buildings/`: `houses.png`, `props.png`, `props-stock.png`, `harvest-yard.png`, `civic.png`, `villagers.png`, `evidence.json`, and `variety.mp4`. The clip is H.264, 640×360, 8 fps, exactly 8.000 seconds (ffprobe verified). Villagers are temporarily arranged in two rows by the capture tool for appearance inspection; gameplay positions and compiled instances are unchanged. Shadow-map rendering and post are disabled for these software-rendered captures; toon shading and outline hulls remain on. The final farm frames were refreshed with `npm run shots:village-buildings -- --props-only`, preserving the full capture's model and JSON parity evidence.

Licensed meshes and generated GLBs are excluded from the commit. The requested report is explicitly included despite the general `out/` ignore rule. Existing untracked launcher logs, PID and library/dependency symlinks were left alone.
