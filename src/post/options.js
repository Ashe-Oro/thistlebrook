// Single place that parses the Look / post-process query params, so stage.js,
// the pages and the post chain all read the same knobs. Inspired by
// jankeesvw/isometric-helenaveen (ideas only — original has no licence).
//
//   ?post=0        disable the whole chain (plain renderer.render, == baseline)
//   ?edges=0/1     depth/normal ink pass
//   ?normals=0/1   use a normal prepass for extra discontinuity edges
//   ?kuwahara=N    Kuwahara smoothing radius (0..7, 0 = off)
//   ?grade=0/1     colour grade (saturation / contrast / warm / vignette)
//   ?quant=0..1    palette quantisation strength (0 = off)
//   ?hull=0/1      inverted-hull outlines on/off
//   ?inkFade=0/1   perspective distance fade of the ink (screen-space edges
//                  and hull thickness): full at the town-core depth, ~35% at
//                  2x it (default on)
//   ?foliageMask=0/1  no normal-crease ink inside tree/bush crowns (silhouette
//                  depth ink stays; default on)
//   ?cam=iso       orthographic isometric camera (vs default perspective;
//                  ?cam=x,y,z numeric override still works via stage.js)

export const FOLIAGE_CATEGORIES = new Set(['tree', 'bush']);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Chosen defaults after screenshot tuning (see src/post/post.js header).
export const DEFAULTS = {
  post: true,
  edges: true,
  normals: true, // creases sharper than ~40deg (roof ridges, wall corners); ?normals=0 to drop
  kuwahara: 6, // radius in px (0..7)
  grade: true,
  quant: 0.3, // partial snap toward the shared palette (flatter, cleaner fills)
  hull: true, // keep inverted-hull silhouettes; post edges add creases + depth steps
  inkFade: true, // perspective: ink strength/width + hull thickness fall off with depth
  foliageMask: true, // suppress crease (normal) ink inside foliage crowns
};

const bool = (q, k, d) => {
  if (!q.has(k)) return d;
  const v = q.get(k);
  return !(v === '0' || v === 'false' || v === 'off' || v === 'no');
};

// `cam` is 'iso', a numeric x,y,z override, or absent. Numbers are for stage.js;
// here we only care whether it's the iso mode toggle.
export function parseCamMode(q) {
  const v = q.get('cam');
  if (v === 'iso') return 'iso';
  return 'persp';
}

export function parseOptions(search = location.search) {
  const q = new URLSearchParams(search);
  return {
    post: bool(q, 'post', DEFAULTS.post),
    edges: bool(q, 'edges', DEFAULTS.edges),
    normals: bool(q, 'normals', DEFAULTS.normals),
    kuwahara: q.has('kuwahara') ? clamp(Math.round(Number(q.get('kuwahara'))) || 0, 0, 7) : DEFAULTS.kuwahara,
    grade: bool(q, 'grade', DEFAULTS.grade),
    quant: q.has('quant') ? clamp(Number(q.get('quant')) || 0, 0, 1) : DEFAULTS.quant,
    hull: bool(q, 'hull', DEFAULTS.hull),
    inkFade: bool(q, 'inkFade', DEFAULTS.inkFade),
    foliageMask: bool(q, 'foliageMask', DEFAULTS.foliageMask),
    cam: parseCamMode(q),
    // Fine-tuning knobs for the ink pass (numbers; absent = shader default).
    ...Object.fromEntries(['inkMul', 'inkMix', 'inkWidth', 'normalWeight', 'depthThresh']
      .filter((k) => q.has(k)).map((k) => [k, Number(q.get(k))])),
  };
}
