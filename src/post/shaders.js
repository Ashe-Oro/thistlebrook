// GLSL for the post chain. Each export returns a THREE.ShaderMaterial for a
// fullscreen pass. Written from scratch; the Kuwahara + depth-ink + multiply-
// darken ideas are inspired by jankeesvw/isometric-helenaveen (no licence in
// that repo, so none of its code is used).
import * as THREE from 'three';
import { PALETTE } from '../toon.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Linear-light sRGB encode (matches renderer.outputColorSpace = SRGB so the
// post output isn't darker/washed vs the plain renderer.render path).
const SRGB = /* glsl */ `
  vec3 lin2srgb(vec3 c){
    c = max(c, vec3(0.0));
    return mix(1.055*pow(c, vec3(1.0/2.4))-0.055, c*12.92, step(c, vec3(0.0031308)));
  }
  vec3 srgb2lin(vec3 c){
    c = clamp(c, 0.0, 1.0);
    return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, step(c, vec3(0.04045)));
  }
`;

// --- Kuwahara: painterly mean-of-lowest-variance-quadrant ------------------
export function kuwaharaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uRadius: { value: 2 },
      uStride: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      #define MAXR 7
      uniform sampler2D tDiffuse;
      uniform vec2 uTexel;
      uniform int uRadius;
      uniform float uStride; // sparse taps for big radii (r6 at stride 2 = 64 taps, not 196)
      varying vec2 vUv;
      void main() {
        vec4 c0 = texture2D(tDiffuse, vUv);
        if (uRadius <= 0) { gl_FragColor = c0; return; }
        // Ink protection: inverted-hull outlines are thin dark lines that a
        // plain Kuwahara erases (they never win the low-variance quadrant).
        // Keep ink pixels as they are and leave ink out of every quadrant.
        const float INK = 0.035; // linear luminance; PALETTE.ink is ~0.016
        if (dot(c0.rgb, vec3(0.2126, 0.7152, 0.0722)) < INK) { gl_FragColor = c0; return; }
        vec3 best = c0.rgb; float bestVar = 1e9;
        for (int q = 0; q < 4; q++) {
          vec2 sgn = vec2((q == 0 || q == 3) ? 1.0 : -1.0, (q == 0 || q == 1) ? 1.0 : -1.0);
          vec3 sum = vec3(0.0); vec3 sum2 = vec3(0.0); float cnt = 0.0;
          for (int j = 0; j <= MAXR; j++) {
            float fj = float(j) * uStride;
            if (fj > float(uRadius)) break;
            for (int i = 0; i <= MAXR; i++) {
              float fi = float(i) * uStride;
              if (fi > float(uRadius)) break;
              vec3 c = texture2D(tDiffuse, vUv + vec2(fi * sgn.x, fj * sgn.y) * uTexel).rgb;
              if (dot(c, vec3(0.2126, 0.7152, 0.0722)) < INK) continue;
              sum += c; sum2 += c * c; cnt += 1.0;
            }
          }
          if (cnt < 1.0) continue;
          vec3 mean = sum / cnt;
          vec3 var = abs(sum2 / cnt - mean * mean);
          float v = var.r + var.g + var.b;
          if (v < bestVar) { bestVar = v; best = mean; }
        }
        gl_FragColor = vec4(best, 1.0);
      }
    `,
  });
}

// --- Hull composite: lay the inverted-hull ink layer over the (filtered) image
export function hullCompositeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, tHull: { value: null } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse, tHull;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec4 h = texture2D(tHull, vUv);
        gl_FragColor = vec4(mix(c, h.rgb / max(h.a, 1e-4), h.a), 1.0);
      }
    `,
  });
}

// --- Edge ink on depth steps + optional normal discontinuities -------------
export function edgeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      tNormal: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uNear: { value: 0.1 },
      uFar: { value: 1000 },
      uIsOrtho: { value: false },
      uDepthThresh: { value: 0.01 }, // relative (persp): inks steps > ~1% of eye depth
      uDepthThreshOrtho: { value: 0.25 }, // absolute world-unit step for ortho
      uNormalThresh: { value: 0.5 },
      uUseNormal: { value: true },
      uWidth: { value: 2.0 },
      uInkMul: { value: 0.22 },
      uInk: { value: new THREE.Color(PALETTE.ink) },
      uInkMix: { value: 0.7 },
      uNormalWeight: { value: 0.75 },
      uFadeDist: { value: 0 }, // town-core view depth; 0 = no distance fade
      uFadeMin: { value: 0.35 }, // ink strength/width factor at 2x uFadeDist
      uFoliageMask: { value: true }, // normal-target alpha < 0.75 = foliage
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse, tDepth, tNormal;
      uniform vec2 uTexel;
      uniform float uNear, uFar, uDepthThresh, uDepthThreshOrtho, uNormalThresh, uWidth, uInkMul, uInkMix, uNormalWeight, uFadeDist, uFadeMin;
      uniform bool uIsOrtho, uUseNormal, uFoliageMask;
      uniform vec3 uInk;
      varying vec2 vUv;
      float linDepth(vec2 uv){
        float d = texture2D(tDepth, uv).x;
        if (uIsOrtho) return uNear + d * (uFar - uNear);
        float z = d * 2.0 - 1.0;
        return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
      }
      // Normal agreement with a neighbour; 1.0 (no crease) when both the
      // centre and the neighbour are foliage, so crowns get no inner creases.
      float ndot(vec3 nc, bool fc, vec2 uv){
        vec4 t = texture2D(tNormal, uv);
        if (fc && t.a < 0.75) return 1.0;
        return dot(nc, t.xyz * 2.0 - 1.0);
      }
      void main() {
        vec3 color = texture2D(tDiffuse, vUv).rgb;
        float dc = linDepth(vUv);
        // Distance fade (perspective): full ink up to the core depth, falling
        // linearly to uFadeMin at 2x it — strength and width both.
        // Off (ortho, ?inkFade=0): width and strength exactly as requested,
        // as before v3. On: the faded width keeps a floor of min(uWidth, 1px),
        // which never exceeds the requested width (0 / subpixel stay as asked).
        float fade = 1.0;
        float w = uWidth;
        if (!uIsOrtho && uFadeDist > 0.0) {
          fade = mix(1.0, uFadeMin, clamp((dc - uFadeDist) / uFadeDist, 0.0, 1.0));
          w = max(uWidth * fade, min(uWidth, 1.0));
        }
        vec2 o = uTexel * w;
        float dl = linDepth(vUv + vec2(-o.x, 0.0));
        float dr = linDepth(vUv + vec2(o.x, 0.0));
        float dd = linDepth(vUv + vec2(0.0, -o.y));
        float du = linDepth(vUv + vec2(0.0, o.y));
        float step = max(max(dl, dr), max(dd, du)) - dc; // neighbours farther => near side
        float thr = uIsOrtho ? uDepthThreshOrtho : uDepthThresh * dc;
        float depthEdge = smoothstep(thr, thr * 2.0, step);

        float normEdge = 0.0;
        if (uUseNormal) {
          vec4 tc = texture2D(tNormal, vUv);
          vec3 nc = tc.xyz * 2.0 - 1.0;
          bool fc = uFoliageMask && tc.a < 0.75;
          float md = 1.0;
          md = min(md, ndot(nc, fc, vUv + vec2(-o.x, 0.0)));
          md = min(md, ndot(nc, fc, vUv + vec2(o.x, 0.0)));
          md = min(md, ndot(nc, fc, vUv + vec2(0.0, -o.y)));
          md = min(md, ndot(nc, fc, vUv + vec2(0.0, o.y)));
          normEdge = smoothstep(uNormalThresh, uNormalThresh - 0.25, md);
        }
        // Silhouettes (depth steps) are full-strength ink; creases are lighter.
        float edge = max(depthEdge, normEdge * uNormalWeight) * fade;
        vec3 inked = mix(color * uInkMul, uInk, uInkMix);
        gl_FragColor = vec4(mix(color, inked, edge), 1.0);
      }
    `,
  });
}

// --- Grade: palette quantisation + saturation / contrast / warm / vignette --
export function gradeMaterial() {
  // A compact palette of the main surface colours, in linear light.
  const names = ['grass', 'grassDark', 'dirt', 'dirtDark', 'wall', 'roof', 'trim', 'wood', 'stone', 'leafDark', 'leafMid', 'leafLight', 'skyHorizon'];
  const pal = names.map((n) => new THREE.Color(PALETTE[n]).convertSRGBToLinear());
  return new THREE.ShaderMaterial({
    defines: { PN: pal.length },
    uniforms: {
      tDiffuse: { value: null },
      uSat: { value: 1.12 },
      uContrast: { value: 1.06 },
      uWarm: { value: 0.03 },
      uVignette: { value: 0.18 },
      uQuant: { value: 0.0 },
      uPalette: { value: pal },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uSat, uContrast, uWarm, uVignette, uQuant;
      uniform vec3 uPalette[PN];
      varying vec2 vUv;
      ${SRGB}
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        if (uQuant > 0.0) {
          vec3 best = c; float bd = 1e9;
          for (int i = 0; i < PN; i++) {
            vec3 d = c - uPalette[i];
            float dist = dot(d, d);
            if (dist < bd) { bd = dist; best = uPalette[i]; }
          }
          c = mix(c, best, uQuant);
        }
        // Grade in display (sRGB) space: in linear light a +0.03 "warm lift"
        // or a contrast pivot at 0.5 is far too strong and turns grass neon.
        c = lin2srgb(c);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSat);                       // saturation
        c = (c - 0.5) * uContrast + 0.5;                 // contrast
        c += uWarm * vec3(1.0, 0.6, -0.4) * (1.0 - l);   // warm lift in shadows
        float r = distance(vUv, vec2(0.5));
        c *= 1.0 - uVignette * smoothstep(0.45, 0.95, r); // vignette
        gl_FragColor = vec4(srgb2lin(c), 1.0);
      }
    `,
  });
}

// --- Output: linear -> sRGB for the screen ---------------------------------
export function outputMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      ${SRGB}
      void main() { gl_FragColor = vec4(lin2srgb(texture2D(tDiffuse, vUv).rgb), 1.0); }
    `,
  });
}
