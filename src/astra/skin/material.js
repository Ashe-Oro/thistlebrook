// OWNER: grok-skins lane (Grok). One "styled" MeshToon patch shared by every
// skin that sets `material`. All skin numbers are uniforms, so switching
// between styled skins is a uniform write (no recompile). The default skin
// (material: null) never uses this patch: lighting.js keeps its original ramp.
// Grown from the grok-style neon patch (dd9fda7); no third-party code.
import * as THREE from 'three';

const c = () => ({ value: new THREE.Color() });
export const SKIN_UNIFORMS = {
 uSkinViewInv: { value: new THREE.Matrix4() },
 uSkinNight: { value: 0 }, uSkinLevel: { value: 0 },
 uSkinShadow: c(), uSkinMid: c(), uSkinHigh: c(),
 uSkinChroma: { value: new THREE.Vector2(1, 1) }, uSkinTint: { value: new THREE.Vector3(1, 1, 1) }, uSkinTooth: { value: 0 },
 uSkinWrap: { value: new THREE.Vector4(.3, .74, .4, .3) },
 uSkinSideL: c(), uSkinSideR: c(), uSkinSide: { value: new THREE.Vector2(0, 1) }, uSkinRim: { value: 0 },
 uSkinWin0: c(), uSkinWin1: c(), uSkinWin2: c(), uSkinWinSplit: { value: new THREE.Vector2(.45, .85) },
 uSkinWinEmit: { value: new THREE.Vector3(1.4, 2.4, .55) },
 uSkinWet: { value: new THREE.Vector2(0, .55) },
 uSkinLeaf0: c(), uSkinLeaf1: c(), uSkinLeaf2: c(), uSkinLeafGround: c(), uSkinLeaf: { value: new THREE.Vector2(0, 0) },
 uSkinSnowColor: c(), uSkinSlush: c(), uSkinSnow: { value: new THREE.Vector2(0, 0) },
};

/** Write a skin's `material` block into the shared uniforms. */
export function applySkinMaterial(m) {
 const U = SKIN_UNIFORMS, set = (u, hex) => U[u].value.set(hex);
 set('uSkinShadow', m.ramp.shadow); set('uSkinMid', m.ramp.mid); set('uSkinHigh', m.ramp.high);
 U.uSkinChroma.value.set(...m.chroma); U.uSkinTint.value.set(...m.tint); U.uSkinTooth.value = m.tooth ?? 0;
 U.uSkinWrap.value.set(m.wrap.lo, m.wrap.hi, m.wrap.floor, m.wrap.foliageFloor);
 set('uSkinSideL', m.side.left); set('uSkinSideR', m.side.right); U.uSkinSide.value.set(m.side.strength, m.side.day ?? .3); U.uSkinRim.value = m.rim ?? 0;
 const w = m.windows; [0, 1, 2].forEach(i => set('uSkinWin' + i, w.colors[i % w.colors.length]));
 U.uSkinWinSplit.value.set(...w.split); U.uSkinWinEmit.value.set(w.emit[0], w.emit[1], w.albedo);
 U.uSkinWet.value.set(m.wet?.amount ?? 0, m.wet?.darken ?? 1);
 const l = m.leaves; [0, 1, 2].forEach(i => set('uSkinLeaf' + i, l ? l.colors[i % l.colors.length] : '#000'));
 set('uSkinLeafGround', l?.groundColor || '#000'); U.uSkinLeaf.value.set(l?.amount ?? 0, l?.ground ?? 0);
 const s = m.snow; set('uSkinSnowColor', s?.color || '#fff'); set('uSkinSlush', s?.slush || '#888'); U.uSkinSnow.value.set(s?.amount ?? 0, s?.road ?? 0);
}

const COMMON = /* glsl */`
uniform mat4 uSkinViewInv; uniform float uSkinNight, uSkinLevel, uSkinTooth, uSkinRim;
uniform vec3 uSkinShadow, uSkinMid, uSkinHigh, uSkinTint, uSkinSideL, uSkinSideR, uSkinWin0, uSkinWin1, uSkinWin2, uSkinWinEmit;
uniform vec3 uSkinLeaf0, uSkinLeaf1, uSkinLeaf2, uSkinLeafGround, uSkinSnowColor, uSkinSlush;
uniform vec2 uSkinChroma, uSkinSide, uSkinWinSplit, uSkinWet, uSkinLeaf, uSkinSnow; uniform vec4 uSkinWrap;
varying vec3 vSkinW;
float skinHash(vec2 p){ p = fract(p*vec2(233.34, 851.73)); p += dot(p, p+23.45); return fract(p.x*p.y); }
float skinNoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
 return mix(mix(skinHash(i),skinHash(i+vec2(1,0)),f.x), mix(skinHash(i+vec2(0,1)),skinHash(i+vec2(1,1)),f.x), f.y); }
vec3 skinWindow(){ vec2 cell = floor(vSkinW.xz/2.3) + floor(vSkinW.y/1.6)*7.;
 float h = skinHash(cell);
 return h < uSkinWinSplit.x ? uSkinWin0 : h < uSkinWinSplit.y ? uSkinWin1 : uSkinWin2; }
`;

export function patchSkinShader(shader, { foliage = false } = {}) {
 Object.assign(shader.uniforms, SKIN_UNIFORMS);
 shader.vertexShader = 'uniform mat4 uSkinViewInv;\nvarying vec3 vSkinW;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vSkinW = (uSkinViewInv * mvPosition).xyz;');
 let f = shader.fragmentShader;
 // Existing warm-window hook (world.js) -> skin window colours and emission.
 f = f.replace('vec3(1.0,.48,.09)*uAstraNight*.9;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.4,.1),uAstraNight);',
  'skinWindow()*uSkinLevel*(uSkinWinEmit.x+uSkinWinEmit.y*uSkinNight);diffuseColor.rgb=mix(diffuseColor.rgb,skinWindow()*uSkinWinEmit.z,uSkinLevel);');
 f = f.replace('#include <color_fragment>', `#include <color_fragment>
 float skinWetMask = 0.;
 vec3 skinFlatN = normalize(cross(dFdx(vSkinW), dFdy(vSkinW)));
 float skinUp = smoothstep(.55, .85, abs(skinFlatN.y));
 float skinLow = 1. - smoothstep(.25, .7, vSkinW.y);
 float skinGrey = 1. - smoothstep(.04, .14, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b)));
 { // leaves: green-dominant colour -> per-tree autumn hue (ground gets a gentler harvest tone)
   float green = smoothstep(.015, .09, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
   float lum = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
   float lh = skinHash(floor(vSkinW.xz/3.7));
   vec3 leaf = lh < .4 ? uSkinLeaf0 : lh < .78 ? uSkinLeaf1 : uSkinLeaf2;
   float ground = skinUp * skinLow;
   vec3 target = mix(leaf, uSkinLeafGround, ground) * (lum * 2.6 + .08);
   diffuseColor.rgb = mix(diffuseColor.rgb, target, green * mix(uSkinLeaf.x, uSkinLeaf.y, ground) * mix(.3, 1., smoothstep(.05, .14, lum))); } // dark conifers mostly keep their green
 { // locked palette: grade onto the skin ramp, keep some of the model's own colour; tooth
   float nL = sqrt(max(dot(diffuseColor.rgb, vec3(.2126,.7152,.0722)), 0.));
   vec3 ramp = nL < .5 ? mix(uSkinShadow, uSkinMid, nL*2.) : mix(uSkinMid, uSkinHigh, nL*2.-1.);
   diffuseColor.rgb = mix(ramp, diffuseColor.rgb*uSkinTint, mix(uSkinChroma.x, uSkinChroma.y, uSkinNight));
   float tooth = skinNoise(vSkinW.xz*3.1 + vSkinW.y*1.7)*.6 + skinNoise(vSkinW.xz*13. + vSkinW.y*11.)*.4;
   diffuseColor.rgb *= 1. - uSkinTooth*.5 + tooth*uSkinTooth; }
 { // snow on up-facing surfaces, slush on grey roads
   float drift = smoothstep(.25, .6, skinNoise(vSkinW.xz*.7) * .6 + skinNoise(vSkinW.xz*4.1) * .4 + skinUp * .35);
   float road = skinGrey * skinLow;
   float snow = skinUp * uSkinSnow.x * drift * mix(1., uSkinSnow.y, road);
   diffuseColor.rgb = mix(diffuseColor.rgb, mix(uSkinSnowColor, uSkinSlush, road * (1. - drift * .5)), snow); }`);
 // Soft wrap key instead of hard toon bands.
 f = f.replace('#include <gradientmap_pars_fragment>', `
 vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
  float n = dot(normal, lightDirection)*.5 + .5;
  float lit = smoothstep(uSkinWrap.x, uSkinWrap.y, n);
  float band = mix(${foliage ? 'uSkinWrap.w' : 'uSkinWrap.z'}, 1.0, lit);
  return band * mix(uAstraShade, vec3(1.0), lit);
 }`);
 // Camera-fixed side lights, cut-edge rim, wet sheen on low grey ground.
 f = f.replace('#include <opaque_fragment>', `
 { vec3 nN = normalize(normal);
   vec3 nW = normalize((uSkinViewInv * vec4(nN, 0.)).xyz);
   float nightK = uSkinSide.y + (1. - uSkinSide.y)*uSkinNight;
   vec3 side = uSkinSideL*pow(max(0., -nN.x), 1.6) + uSkinSideR*pow(max(0., nN.x), 1.6);
   outgoingLight += side * diffuseColor.rgb * uSkinSide.x * nightK;
   float rim = pow(1. - abs(nN.z), 5.);
   outgoingLight += rim * mix(uSkinSideL, uSkinSideR, step(0., nN.x)) * uSkinRim * nightK;
   float up = smoothstep(.85, .97, nW.y) * skinLow * uSkinWet.x;
   float puddle = smoothstep(.5, .56, skinNoise(vSkinW.xz*.9)) * skinGrey;
   float streak = .5 + .5*sin(vSkinW.x*.8 + vSkinW.z*.33);
   vec3 refl = mix(uSkinSideR, uSkinSideL, streak);
   outgoingLight = mix(outgoingLight, outgoingLight*uSkinWet.y + refl*.05*nightK, up*puddle*.7);
   outgoingLight += up * skinGrey * refl * .025 * nightK;
   skinWetMask = up * skinGrey * (.6 + .4*puddle);
 }
 #include <opaque_fragment>
 #ifdef OPAQUE
 gl_FragColor.a = 1. - skinWetMask; // wet mask for the post reflection pass
 #endif`);
 shader.fragmentShader = COMMON + f;
}
