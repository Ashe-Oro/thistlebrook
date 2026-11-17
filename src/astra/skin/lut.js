// OWNER: grok-skins lane (Grok). Time-of-day colour grades for a skin's post
// block: one 16^3 LUT per named grade (up to 4), generated at switch time from
// the skin's numbers (0 bytes on the wire), packed into one strip atlas and
// blended by hour inside the composite pass. From the grok-style LUT (dd9fda7).
import * as THREE from 'three';

export const LUT_SIZE = 16, LUT_MAX = 4;
const hex = h => new THREE.Color(h).convertLinearToSRGB(); // display-space anchors
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hueDist = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

/** Returns a display-space rgb -> rgb function for one grade. */
export function gradeFn(G, protect = []) {
 const P = { ...G, shadow: hex(G.shadow), high: hex(G.high) };
 const c = new THREE.Color(), hsl = {};
 return (r, g, b) => {
  c.setRGB(r, g, b); c.getHSL(hsl);
  const keep = protect.reduce((k, [h, w]) => Math.max(k, 1 - Math.min(1, hueDist(hsl.h, h) / w)), 0);
  hsl.s = Math.min(1, hsl.s * mix(P.sat, P.boost ?? P.sat, keep));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  let o = [c.r, c.g, c.b].map(v => Math.min(1, Math.max(0, (v - .5) * P.contrast + .5)));
  const l = .2126 * o[0] + .7152 * o[1] + .0722 * o[2];
  const sw = (1 - smooth(0, .45, l)) * P.shadowAmt, hw = smooth(.55, 1, l) * P.highAmt;
  const sh = [P.shadow.r, P.shadow.g, P.shadow.b], hi = [P.high.r, P.high.g, P.high.b];
  return o.map((v, i) => { const s1 = mix(v, v * .6 + sh[i] * .8, sw); return mix(s1, s1 * hi[i] * 1.08, hw); });
 };
}

/** Pure data: Uint8Array RGBA atlas, width N*N, height N*LUT_MAX. */
export function lutAtlasData(lut) {
 const names = Object.keys(lut.grades).slice(0, LUT_MAX), N = LUT_SIZE;
 const data = new Uint8Array(N * N * N * 4 * LUT_MAX);
 names.forEach((name, li) => {
  const f = gradeFn(lut.grades[name], lut.protect);
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
   const o = f(r / (N - 1), g / (N - 1), b / (N - 1));
   const k = ((li * N + g) * N * N + b * N + r) * 4;
   for (let j = 0; j < 3; j++) data[k + j] = Math.round(Math.min(1, Math.max(0, o[j])) * 255);
   data[k + 3] = 255;
  }
 });
 return { data, names };
}

export function buildLutTexture(lut) {
 const { data, names } = lutAtlasData(lut), N = LUT_SIZE;
 const tex = new THREE.DataTexture(data, N * N, N * LUT_MAX, THREE.RGBAFormat);
 tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
 tex.userData.names = names;
 return tex;
}

/** Which two grades to blend at `hour`, and how far. */
export function lutBlend(lut, hour) {
 const names = Object.keys(lut.grades), S = lut.schedule;
 hour = ((hour % 24) + 24) % 24;
 const i = S.findIndex((k, n) => n < S.length - 1 && hour < S[n + 1][0]);
 const [h0, a] = S[i], [h1, b] = S[i + 1];
 const t = (hour - h0) / (h1 - h0);
 return { a: names.indexOf(a), b: names.indexOf(b), t: t * t * (3 - 2 * t) };
}

export const LUT_GLSL = /* glsl */`
uniform sampler2D lut; uniform float lutA, lutB, lutT;
vec3 lutSample(vec3 c, float li){
 const float N = ${LUT_SIZE}.;
 c = clamp(c, 0., 1.) * (N - 1.);
 float b0 = floor(c.b), b1 = min(b0 + 1., N - 1.), f = c.b - b0;
 vec2 px = vec2(1. / (N*N), 1. / (N*${LUT_MAX}.));
 vec2 uv0 = vec2((b0*N + c.r + .5) * px.x, (li*N + c.g + .5) * px.y);
 vec2 uv1 = vec2((b1*N + c.r + .5) * px.x, (li*N + c.g + .5) * px.y);
 return mix(texture2D(lut, uv0).rgb, texture2D(lut, uv1).rgb, f);
}
vec3 lutGrade(vec3 linearCol){
 vec3 d = pow(clamp(linearCol, 0., 1.), vec3(1./2.2));
 vec3 g = mix(lutSample(d, lutA), lutSample(d, lutB), lutT);
 return pow(g, vec3(2.2)) + max(linearCol - 1., 0.); // keep HDR overflow for bloom
}`;
