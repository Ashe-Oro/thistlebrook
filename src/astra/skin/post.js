// OWNER: grok-skins lane (Grok). Reduced-resolution post chain used by any skin
// with a `post` block: scene -> MSAA HalfFloat target, separable blur at
// blurScale, one composite (wet reflections, tilt-shift, bloom, haze, LUT
// grade, vignette, grain). configure(skin.post) only writes uniforms and swaps
// the generated LUT, so live switching costs no recompile. From dd9fda7.
import * as THREE from 'three';
import { buildLutTexture, lutBlend, LUT_GLSL } from './lut.js';

export const QUALITY = {
 low:  { samples: 0, blurScale: .125, blurIters: 1 },
 med:  { samples: 4, blurScale: .25,  blurIters: 2 },
 high: { samples: 4, blurScale: .5,   blurIters: 2 },
};
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

export function createSkinPost(renderer, quality = 'med') {
 const Q = QUALITY[quality] || QUALITY.med;
 const size = new THREE.Vector2();
 const scene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Q.samples });
 const make = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
 const a = make(), b = make();
 const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
 const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
 const blur = new THREE.ShaderMaterial({ uniforms: { src: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: VERT,
  fragmentShader: `varying vec2 vUv; uniform sampler2D src; uniform vec2 dir;
  void main(){ vec4 c = texture2D(src,vUv)*.227;
   c += (texture2D(src,vUv+dir*1.384)+texture2D(src,vUv-dir*1.384))*.316;
   c += (texture2D(src,vUv+dir*3.231)+texture2D(src,vUv-dir*3.231))*.070;
   gl_FragColor = c; }` });
 const f = v => ({ value: v }), col = () => f(new THREE.Color());
 const U = {
  lut: f(null), lutA: f(0), lutB: f(0), lutT: f(0), sharp: f(null), soft: f(null), time: f(0), night: f(0),
  focusY: f(.47), band: f(.16), softW: f(.32), tiltMax: f(.68), bloomT: f(.5), bloomK: f(1.6), bloomN: f(1.2), bloomLift: f(.25),
  hazeStart: f(.5), haze: f(.07), hazeDay: col(), hazeNight: col(), wetTint: f(new THREE.Vector3()),
  reflStep: f(.009), reflT: f(.25), reflK: f(0), vignette: f(.34), grain: f(.006), ab: f(0),
 };
 const composite = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT,
  fragmentShader: `varying vec2 vUv; uniform sampler2D sharp, soft;
  uniform float reflStep, reflT, reflK, time, night, focusY, band, softW, tiltMax, bloomT, bloomK, bloomN, bloomLift, hazeStart, haze, vignette, grain, ab;
  uniform vec3 hazeDay, hazeNight, wetTint;
  ${LUT_GLSL}
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
  void main(){
   vec2 c = vUv - .5;
   vec2 ca = c*dot(c,c)*ab*40.;
   vec3 s = vec3(texture2D(sharp, vUv - ca).r, texture2D(sharp, vUv).g, texture2D(sharp, vUv + ca).b);
   vec3 bl = texture2D(soft, vUv).rgb;
   float wet = reflK > 0. ? clamp(1. - texture2D(sharp, vUv).a, 0., 1.) : 0.;
   if (wet > 0.) {
    vec3 rf = vec3(0.);
    for (int i = 1; i <= 8; i++) { float o = float(i) * reflStep; rf += max(texture2D(sharp, vUv + vec2(0., o)).rgb - vec3(reflT), 0.) * (1. - float(i)/9.); rf += max(texture2D(soft, vUv + vec2(0., o)).rgb - vec3(reflT*.6), 0.) * .5; }
    s = s * (1. - wet*.3) + wet * wetTint * (.4 + .6*night) + wet * rf * reflK * (.35 + .65*night);
   }
   float t = smoothstep(band, band + softW, abs(vUv.y - focusY)) * tiltMax;
   vec3 col = mix(s, bl, t);
   float lum = dot(bl, vec3(.2126,.7152,.0722));
   vec3 glow = max(bl - vec3(bloomT), 0.) * bloomK * (1. + bloomN*night);
   vec3 hz = mix(hazeDay, hazeNight, night);
   float hf = smoothstep(hazeStart, 1.15, vUv.y) * haze;
   col = mix(col, hz + glow*.5, hf);
   col = lutGrade(col);
   col += glow + bl * smoothstep(bloomT*.6, bloomT*1.4, lum) * bloomLift * night;
   col *= 1. - vignette * smoothstep(.35, .95, length(c*vec2(1.1,1.25)));
   col += (h(vUv*vec2(1733.,977.) + time) - .5) * grain * (.6 + .4*night);
   gl_FragColor = vec4(max(col, 0.), 1.);
   #include <colorspace_fragment>
  }` });
 const luts = new Map();
 let P = null;
 function configure(post) {
  P = post;
  if (!luts.has(post.lut)) luts.set(post.lut, buildLutTexture(post.lut));
  U.lut.value = luts.get(post.lut);
  U.focusY.value = post.tilt.focusY; U.band.value = post.tilt.band; U.softW.value = post.tilt.soft;
  U.bloomT.value = post.bloom.threshold; U.bloomK.value = post.bloom.gain; U.bloomN.value = post.bloom.night ?? 0; U.bloomLift.value = post.bloom.nightLift ?? 0;
  U.hazeStart.value = post.haze.start; U.hazeDay.value.set(post.haze.dayColor); U.hazeNight.value.set(post.haze.nightColor);
  const r = post.reflections; U.reflK.value = r ? r.gain : 0;
  if (r) { U.reflStep.value = r.step; U.reflT.value = r.threshold; U.wetTint.value.set(...(r.tint || [0, 0, 0])); }
  U.vignette.value = post.vignette ?? 0; U.grain.value = post.grain ?? 0; U.ab.value = post.aberration ?? 0;
 }
 const run = (material, target) => { quad.material = material; renderer.setRenderTarget(target); renderer.render(quad, cam); };
 function setSize(w, h) {
  scene.setSize(w, h);
  const bw = Math.max(1, Math.round(w * Q.blurScale)), bh = Math.max(1, Math.round(h * Q.blurScale));
  a.setSize(bw, bh); b.setSize(bw, bh);
 }
 function render(world, camera, { night = 0, time = 0, hour = 12 } = {}) {
  const pr = renderer.getPixelRatio();
  renderer.getSize(size);
  const w = Math.round(size.x * pr), hgt = Math.round(size.y * pr);
  if (scene.width !== w || scene.height !== hgt) setSize(w, hgt);
  renderer.setRenderTarget(scene); renderer.render(world, camera);
  for (let i = 0; i < Q.blurIters; i++) {
   const r = 1 + i;
   blur.uniforms.src.value = i ? a.texture : scene.texture; blur.uniforms.dir.value.set(r / a.width, 0); run(blur, b);
   blur.uniforms.src.value = b.texture; blur.uniforms.dir.value.set(0, r / a.height); run(blur, a);
  }
  const lb = lutBlend(P.lut, hour); U.lutA.value = lb.a; U.lutB.value = lb.b; U.lutT.value = lb.t;
  U.sharp.value = scene.texture; U.soft.value = a.texture; U.night.value = night; U.time.value = time % 97;
  U.haze.value = THREE.MathUtils.lerp(P.haze.day, P.haze.night, night);
  U.tiltMax.value = P.tilt.max * (1 - (camera.userData.streetTilt ?? 0));
  run(composite, null);
 }
 const draws = 2 * Q.blurIters + 1;
 return { render, configure, uniforms: U, quality: Q, draws };
}
