# Cel Town — build summary

A small, interactive, code-first cel-shaded village at `/workspace/cel-town`.
Vite + Three.js (vanilla JS). All visible art is authored in code (composed
primitives / procedural geometry + `MeshToonMaterial` + inverted-hull outlines).
`style-ref.jpg` was used for palette/layout/mood only — it is never mapped onto
any mesh.

## How to run

```bash
cd /workspace/cel-town
npm install
npm run dev     # Vite dev server, bound to 0.0.0.0:5173
```

Open `http://localhost:5173/`.

> Note: in the environment where this was authored, `npm`/`node` were blocked by
> a permission gate, so the install/dev commands could not be executed here. The
> source was verified by review; run the two commands above to start the scene.

## Controls

- Left-drag: orbit · Scroll/pinch: zoom · Right-drag: pan.
- Camera is a pulled-back high three-quarter view showing the whole hamlet;
  OrbitControls are damped with min/max distance and a clamped polar angle so the
  user can't clip underground or go first-person. No cinematic loop — it stays
  interactive.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Canvas host + small HUD with the controls hint. |
| `src/toon.js` | Palette, 3-band toon gradient ramp, toon-material factory, inverted-hull ink-outline helper (`toon()` returns mesh + outline). |
| `src/builders.js` | Procedural geometry: `makeHouse` (parametric, so each is distinct), `makeTree`, `makeBush`, `makeWell`, `makeFence`, `makeGround`, `makePath`, `makeHills`, `makeSky`, `makeCloud`. |
| `src/main.js` | Renderer, scene, directional sun + sky/ground fill + two-tone shadows, camera + OrbitControls, town layout, resize + render loop. |
| `vite.config.js` | Dev server bound to `0.0.0.0:5173`. |
| `package.json` | `three` + `vite`; `dev` / `build` / `preview` scripts. |
| `README.md` | Run instructions, controls, style notes. |
| `style-ref.jpg` | Reference image only (not used as a texture). |

## What's in the scene

- **4 distinct houses** around a central green, each facing the well. They vary
  in size, roof peak, wall shade, chimney side, and window count/layout
  (stone footing, gable roof with ridge cap + gable ends, porch with posts/steps/
  railing + shed roof, teal door/shutters, side window). Positioned with
  comfortable spacing; they do not overlap.
- **Central stone well** with a gable canopy, posts, crossbar, and bucket.
- **Dirt paths** radiating from each porch to the well, plus a couple of
  crossing paths over the green.
- **Rail fences** placed in the gaps between houses (off the paths and bodies).
- **Puffy trees + bushes** around the perimeter, deliberately off the roads.
- **Rolling hills** on the horizon, a **gradient sky dome**, and slowly
  **drifting clouds**.

## Cel-shading approach

- Lighting is quantized into flat bands by a tiny 3-step `DataTexture` gradient
  ramp used as the toon `gradientMap` → sharp two/three-tone shading, no soft
  falloff.
- Outlines are a back-faced copy of each mesh pushed outward along its normals in
  ink color (`src/toon.js` → `toon()`), which stays clean and stable under orbit.
- One `DirectionalLight` sun casts shadows; a low `HemisphereLight` +
  `AmbientLight` keep the dark band from going pure black.
