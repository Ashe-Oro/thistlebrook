# Astra — a little place to linger

The default page opens Downtown: a bakery, shoe shop, café, bookshop and other
local shops around a flowing fountain. The wider cel-shaded town includes
Willowbank’s homes, Astra High’s schoolyard, baseball and football stadium,
Lantern Quay’s evening music, Civic Green’s services and park, West Works’
railway and workplaces, Sunbeam Terrace’s homes, and the orchard across the river. Pan, zoom, click a neighbour to follow
their day, or watch the lights come on.

Run `npm run dev -- --port 5173 --strictPort` and open `/`. Use `npm run test:astra` for the compiler checks,
`npm run compile:astra -- --sweep 100` to audit seeds, and `npm run shots:astra:merged`
for the latest screenshots and browser checks. `npm run shots:astra` checks
the camera and input controls. Progress is in
[`shots/astra/`](shots/astra/README.md).

See [the four-branch merge and review notes](docs/ASTRA-MERGED.md).
Use `npm run film:astra:merged` to capture the tour.

See [Astra's layout rules, controls and private asset setup](docs/ASTRA.md).
Licensed models remain local and ignored; builds do not copy them.

The documentation below describes the earlier Cel Town experiments, available
with `?legacy=1`, explicit size/life flags, or `/compile.html`.

---

# Cel Town

A tiny, interactive **cel-shaded village** built with Vite + Three.js. A cozy
hamlet of four cream cottages with terracotta roofs and teal trim, gathered
around a village green with a stone well, dirt paths, rail fences, puffy trees,
rolling hills, and drifting clouds.

The original hand-placed hamlet uses procedural geometry. The seeded compiler
combines builders with licensed, vertex-coloured ThreeJS Assets, shaded with
`MeshToonMaterial` and inverted-hull ink outlines.

## Run it

```bash
cd /workspace/cel-town
npm install
npm run dev
```

Then open the printed URL (defaults to `http://localhost:5173/`). The dev server
binds to `0.0.0.0`, so it's reachable from outside the container too.

## Controls

- **Left-drag** — orbit the camera around the hamlet
- **Scroll / pinch** — zoom in and out (clamped so you can't clip underground)
- **Right-drag** — pan

The camera starts pulled back on a high three-quarter angle so the whole town is
visible at once, with the polar angle limited so you can't go underground or
first-person. The scene stays up and interactive — there's no cinematic loop.

## The look

- **Toon shading** via a 3-band gradient ramp → strict flat color fills with
  sharp shadow bands (no soft gradients, no grain).
- **Ink outlines** via a back-faced inverted hull pushed along vertex normals —
  stable and camera-independent.
- **One directional sun** + a low sky/ground fill, with two-tone cast shadows.
- Palette pulled from the reference: cream walls, terracotta roofs, teal trim,
  lime/forest foliage, warm dirt paths, blue sky.

## Files

- `index.html` — canvas host + a small HUD.
- `src/toon.js` — palette, toon gradient ramp, toon-material factory, and the
  inverted-hull outline helper.
- `src/builders.js` — all procedural geometry: houses, trees, bushes, well,
  fences, ground, dirt paths, hills, sky dome, clouds.
- `src/main.js` — scene, lighting, camera + OrbitControls, town layout, loop.
- `vite.config.js` — dev server bound to `0.0.0.0:5173`.

## Note

`style-ref.jpg` is a **mood/layout reference only** (palette, composition). It is
never texture-mapped or draped onto any mesh.

## Pipelines

The broader town and simulation pipelines (cel-shaded layers, WorldX, Village Ledger, and lessons from the pixel towns) live in [`/workspace/docs/PIPELINES.md`](../docs/PIPELINES.md).

## Kit + catalog (Nov 11, 2026)

- `/kit.html` — kit viewer: every catalog entry with toggleable anchors (keys 1–6, L labels).
- `src/catalog/` — schema, entries, computed bounds, loader, debug gizmos.
- `npm run catalog:bounds` after adding/changing an entry; `npm run build && npm run shots` for headless renders in `shots/`.
- Licensed Cozy Village, Countryside Farm Kit and Nature GLBs live only in
  `public/licensed/` (gitignored). `vite build` does **not** copy public assets.
  `npm run preview` serves the private library and Draco decoder directly from
  `public/`, alongside the built code in `dist/`. Other private hosts need the
  same URL mapping. The dev server already serves `public/`.

## Compiler v1

- `specs/hamlet.json` — town spec (format in `src/compiler/spec.js`).
- `/compile.html?seed=N` — compiles in the browser, renders, shows the check report, New seed button.
- `npm run compile -- --seed N` → `out/town-N.json`; `npm run compile -- --sweep 50` → pass rate; `npm run test:checks` → negative tests.
- `npm run test:parity` compares full town JSON from plain Node and Vite SSR
  using the browser's actual catalog loader, imported JSON and spec validation
  for seeds 1–30 plus 1234, then repeats in reverse order to catch shared-state
  mutation. It also simulates one-ulp native math differences across engines.
  Symmetric building slots use an explicit lower-angle-first tie break, and
  compiler geometry uses shared arithmetic implementations of trigonometry
  and vector lengths so native engine roundoff cannot change the town JSON
  or reorder slots and change RNG draws.
  This runs without opening a server port or launching a renderer; it does not
  replace a Chrome rendering check.

## Compiler v2

- Plaza ring (`makePlazaRing`), continuous gated fences, landmarks (`cv-bakery`, `cv-tavern`, `cv-chapel`, `cv-store`), `density` knobs.
- `/?seed=N` renders a compiled seed on the main page; `/compile.html?seed=N&debug=1` opens with anchors on.

## Post-process look (visual system v2)

A render-target chain in `src/post/`:

1. Scene.
2. Normal/depth prepass.
3. Hull ink layer.
4. Kuwahara (r=6).
5. Hull composite.
6. Depth and normal ink.
7. sRGB grade with a 0.3 palette snap.
8. Output.

Every stage can be toggled in the bottom-right Look panel or by query string:
`?post=0`, `edges`, `normals`, `kuwahara=0..7`, `grade`, `quant=0..1`,
`hull`, `inkWidth`, `inkMul`, `inkMix`, `normalWeight`, `depthThresh`.

`?cam=iso` gives a tight 2:1 orthographic camera.

`npm run shots:post` renders before/after pairs into `shots/post-*`, and
`?perf=1` sets `window.__perf`.

The ideas come from jankeesvw/isometric-helenaveen. That repo has no licence,
so none of its code is used.

## Compiler v3

- **Gates**: `makeGate` builder (catalog `b-gate`, category `gate`). Every fenced
  lot gets `{ id:'b-gate', kind:'gate', pos, rotY, scale:1, lot, edge:'front', width, open }`
  in its front gap, centred where the door path crosses the front fence line.
  Spec: `fences.gate { id, open }` (default open 0.55, lowered per lot so leaves
  clear the house). `gate: null` = no gates and no fenced lots; a gate id missing
  from the catalog or not category `gate` is a spec error.
- **Cobble ring**: `b-plaza-ring` now draws mortar, 4 rows of irregular cobbles
  and inner/outer kerbs as one vertex-coloured mesh (~11k tris). `params.style:'flat'`
  gives the old look.
- **Facing**: door yaws blend from plaza-facing toward the camera at the arc ends,
  capped by `houses.facing { maxCameraAngle:65, maxPlazaAngle:50, blend:0.8, maxPathBend:8 }`.
  Each house/landmark records `facing { cameraAngle, plazaAngle }` (degrees,
  against `town.camera.pos`). Door paths run straight out of the door onto the ring.
- **Ink**: `?inkFade=0` turns off the distance fade (edge ink and hull thickness
  fall to 35% at twice the core depth). `?foliageMask=0` brings back crease ink
  inside tree crowns. Both are also in the Look panel.
- **Framing**: `stage.setPerspectiveFit(townCoreBoxes(scene), { panelFrac, fill })`
  fits the built core with the real perspective camera (0.86 fill; right of a
  20% panel on `/compile.html`, centred on `/?seed=N`). `?cam=x,y,z` still wins.
- `npm run compile -- --stats N` prints worst facing angles, gate counts and alignment.

## Large preset

Open `/?size=large&seed=1234` or `/compile.html?size=large&seed=1234`.
The main page switches to the seeded compiler when `size=large` is present,
including without a seed. The compiler page also accepts `?spec=specs/large.json`.
With no size flag, the existing hamlet stays unchanged: the original catalog
pools are tagged `v3-kit`, and seed 1234 retains byte-identical compiled JSON.

```bash
npm run compile -- --size large --seed 1234 --out out/large/
npm run compile -- --spec specs/large.json --sweep 50 --out out/large/
npm run test:checks
npm run test:parity
```

`specs/large.json` requests 18–22 houses and 7 civic buildings, arranged around
a retained plaza core, two residential streets, a market street and a farm
track. Higher house density adds residential rows. Door paths join a connected
street graph leading to the plaza. Plaza lots retain their camera/plaza facing
caps; other buildings must face their assigned street. Fenced dwellings retain
the same gate, clearance and continuity checks.

New catalog entries include Cozy blacksmith/market hall/windmill, stalls,
carts, lamps and dressing; Farm dwellings, agricultural structures, crops,
animals and fences; and sparse Nature trees, rocks and flowers. Cozy uses
scale 1.6; Farm and Nature use native scale 1.0. Market stalls have their actual
-Z counter front normalised with a yaw offset. Farm structures without verified
doors are props and are never selected as dwellings.

Repeated meshes and gates are instanced with shared geometry/materials,
including their ink hulls. Debug pivots retain each `userData.inst`; raycasts
can look up `mesh.userData.instances[hit.instanceId]`. Ground radius and hills
grow with the compiled area. Nature pieces remain sparse to limit geometry.
`?perf=1` still enables later runtime measurements. Seed sweep, counts and
verification details are in `out/codex-large.md` and `out/large/sweep.json`.

## Living village (playable)

Open `/?size=large&seed=1234&life=1` (or `/?life=1&seed=1234`;
`village=1` is an alias). The existing large layout gains twelve cozy residents,
road and door-path schedules, third-person walking and a day/night cycle.
`/compile.html?size=large&seed=1234&life=1` exposes the same mode and compiler checks.

WASD moves; click the scene for mouse look. Escape releases the mouse while
staying in walk mode. Tab or M toggles the orbit overview. F advances three
hours. The Look panel remains available. Gates block the player; residents may
use the authored gate openings. Residents idle outdoors at home overnight.

Use `view=overview` for stills, or `view=walk` (the play default). Existing
`cam=x,y,z`, `target=x,y,z`, `cam=iso`, `prmax`, `shadowMap` and `post=0` flags
remain available. An explicit walk camera stays fixed until movement or mouse
look. `hour=14` or `hour=21.5` starts with time paused; add `timescale=60` to
advance one game hour per real second (a full day in 24 seconds). Default speed
is one game minute per real second. F and `window.__life.setHour(h)` seek the
clock and resident schedule; `setTimescale(s)`, `hour`, `timescale` and `mode`
are available to capture tools.

M2 adds nearby names/roles (or hover a resident), passing greetings, plaza chats,
market purchases, lunch outside the inn, and Pip’s bouncing ball. Add `labels=1`
to force up to two nearby tags for captures. Distant overview labels hide.
`window.__life.activities()` returns current `{type, ids, pos, target}` events.

Seed 1234 capture hours (seek with `setHour`, or use `hour=` to pause):

| Hour | Activity |
| --- | --- |
| 9.021 | Mabel and Bram greet outside the smithy (9–9.12) |
| 12.021 | Ada and Oswin chat at the plaza (11.579–13.5) |
| 12.021 | Rowan shops at a market stall (10.079–13) |
| 12.021 | Clover eats outside the tavern (12–13.5) |
| 12.021 | Pip plays by the plaza (11.079–18) |
| 21.5 | Moonlit grass, warm windows and lamps |

Chats trade short lines; pair greetings have a cooldown. Activity places are
reserved without locking road edges. Ordinary time walks between slots; seeking
places people at the current destination. Night returns everyone home. The sign
scale correction is visual only; nocturnal grass is exclusive to life mode.

Run `npm run build` then `npm run shots:village-m2` for social/name/night PNGs,
`evidence.json`, and a 12-second 1280×720, 12fps `village-life.mp4` under
`shots/village-m2/`. Retry the movie with `npm run shots:village-m2 -- --video-only`.
The movie frames include live plaza chat and play. Video disables post, hull outlines,
and shadow maps for SwiftShader throughput; stills retain the full post stack.

Run `npm run build` then `npm run shots:village-m1` for six PNGs and a 16-second
MP4 under `shots/village-m1/`. The script uses local Chrome with SwiftShader and
ffmpeg; its fixed recording clock makes the clip reproducible on slow renderers. The
video uses the supported `post=0` option for software-rendering throughput;
stills retain the full post stack.
Regenerate private character GLBs with `node tools/generate-townsfolk.mjs`, then
`npm run catalog:bounds`. Licensed packs and generated characters stay private
under the gitignored `public/licensed/` directory.

<!-- WORKTREE-HOOK art -->
Life mode adds seeded owned-pack flower carts, harvest baskets, planters and benches outside reserved paving and footprints, plus soft night lamp pools. The twelve residents have individual wardrobe palettes and silhouettes; regenerate their licensed GLBs with `node tools/generate-townsfolk.mjs`. Capture and audit with `npm run shots:village-art` after building.


### Interiors

Approach the bakery, inn, store or smithy doorway in `life=1` and press **E**.
A short fade enters a furnished room. WASD and click + mouse look work indoors.
Press **E** at the marked exit or walk through it to return to the safe doorstep;
return outdoors before using Tab/M for the overview.

Press **E** near a framed lantern to light/extinguish it, at a bakery/store
counter to use it, or beside an outdoor market stall to browse (no inventory).
Lantern states persist between room visits. `?interior=bakery` (also `inn`,
`store`, `smithy`) starts inside. `__life.interior` is `null` or `{id,name}`;
`__life.interiors` exposes rooms, door triggers, fixtures and `inspect()`.

Run `npm run build` then `npm run shots:village-m3` for six PNGs, interaction
and hash evidence, and a 12-second 1280×720 `village-interiors.mp4` under
`shots/village-m3/`. `--stills-only` / `--video-only` are supported. The movie
uses WASD/E with a fixed clock and disables post, hulls and shadows for SwiftShader.
Rooms combine timber furniture with existing toon-loaded village/farm props.
<!-- WORKTREE-HOOK building-variety -->
Opt-in owned house/farm/wardrobe looks: `/?size=large&seed=1234&life=1&variety=1`; capture with `npm run shots:village-buildings` after building. See [asset credits, regeneration and verification](docs/village/BUILDING-VARIETY.md).

<!-- WORKTREE-HOOK lighting -->
Village lighting (`/?size=large&seed=1234&life=1`) adds peach dawn, amber golden hour, blue night haze and soft lamp pools while preserving the toon ramp and hull outlines. `?hour=17.25` or `__life.setHour(17.25)` seeks the look; the existing Look → grade toggle (or `?grade=0`) controls the time-aware grade. `npm run build && npm run shots:village-light` captures four stills and a 12-second, post-enabled afternoon-to-night movie under `shots/village-light/`; `--stills-only` and `--video-only` update either set independently; interrupted `--video-only` runs resume saved frame checkpoints (use the full command after changing the look). Captures use the supported `kuwahara=3` and `shadowMap=1024` flags for SwiftShader; runtime defaults stay unchanged.

<!-- WORKTREE-HOOK medium -->
Recommended Willowmere play URL: `/?size=medium&seed=1234&life=1` (31 homes, chapel, farms and a bridged stream). Explicit `size=medium` also works on `compile.html` and with `npm run compile -- --size medium --life`; its seed defaults to 1234. Omitted size and `/?size=large&seed=1234&life=1` retain existing behavior. Run `npm run test:medium` and `npm run shots:village-medium`; add `-- --video` for a 10-second overview orbit.

<!-- WORKTREE-HOOK props -->
Village props: E uses nearby benches, well, bell, stalls and civic doors; E at the inn table serves a cozy meal. See [M4 controls, typed tools and evidence](docs/village/PROPS.md). Capture locally with `npm run build && npm run shots:village-props`.
