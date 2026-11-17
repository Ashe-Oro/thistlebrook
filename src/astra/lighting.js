import * as THREE from 'three';
import { LIGHT_KEYS, sampleLightCycle, lightPeriod } from './light-cycle.js';
import { patchSkinShader } from './skin/material.js';

// Astra-only lighting. No shared catalog/toon factory, district, asset or
// compiler changes. Call register(root) for districts added after startup.
export function createAstraLighting({ scene, camera, controls, renderer, town }) {
 // Skins (grok-skins lane): setSkin() swaps keys, shade, halos and the
 // material variant. With the default skin every value below is the original.
 let KEYS = LIGHT_KEYS, styled = false;
 let colors = KEYS.map(k => k.slice(1, 7).map(c => new THREE.Color(c)));
 const fill = new THREE.HemisphereLight();
 const key = new THREE.DirectionalLight();
 fill.name = 'Thistlebrook • sky and reflected light';
 key.name = 'Thistlebrook • sun / moon';
 key.castShadow = true;
 key.shadow.mapSize.set(2048, 2048);
 key.shadow.normalBias = .055;
 key.shadow.bias = -.00015;
 key.shadow.radius = 1.2;
 Object.assign(key.shadow.camera, { near: 1, far: 1800 });
 scene.add(fill, key, key.target);
 const uniforms = {
  uAstraShade: { value: new THREE.Color('#b5bbdb') },
  uAstraNight: { value: 0 },
 };
 const ink = new THREE.Color();
 const DEFAULT_SHADE = ['#d1c8e5', '#a8bce7'];
 const dayShade = new THREE.Color(DEFAULT_SHADE[0]), nightShade = new THREE.Color(DEFAULT_SHADE[1]);
 const shadowFloors = [];
 const materials = new Set(), inks = new Set();

 function register(root = scene) {
  root.traverse(object => {
   for (const material of [object.material].flat().filter(Boolean)) {
    // Batched imported hulls don't preserve userData.outline; their uniforms do.
    if (material.uniforms?.uInk) inks.add(material);
    if (material.isShadowMaterial && !shadowFloors.includes(material)) { material.opacity = .035; shadowFloors.push(material); }
    if (!material.isMeshToonMaterial || materials.has(material)) continue;
    materials.add(material);
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, webgl) => {
     // Preserve the existing building-window emission hook.
     previous.call(material, shader, webgl);
     shader.uniforms.uAstraShade = uniforms.uAstraShade;
     shader.fragmentShader = 'uniform vec3 uAstraShade;\n' + shader.fragmentShader;
     // Analytic three-band ramp: crisp, with only a derivative-wide edge to
     // avoid flickering as normals cross a band. Retain the darker leaf ramp.
     const foliage = material.gradientMap?.image?.data?.[0] < 60;
     if (styled) { patchSkinShader(shader, { foliage }); return; }
     shader.fragmentShader = shader.fragmentShader.replace('#include <gradientmap_pars_fragment>', `
      vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
       float n = dot(normal, lightDirection) * .5 + .5;
       float aa = max(fwidth(n) * .65, .001);
       float mid = smoothstep(.38-aa, .38+aa, n);
       float lit = smoothstep(.64-aa, .64+aa, n);
       float band = mix(${foliage ? '.18' : '.28'}, .59, mid);
       band = mix(band, 1.0, lit);
       return band * mix(uAstraShade, vec3(1.0), lit);
      }`);
    };
    material.customProgramCacheKey = () => `${previousKey}|astra-light-v1${styled ? '|skin-styled' : ''}`;
    material.needsUpdate = true;
   }
  });
 }
 register();

 // A screen-space backdrop behind the diorama: colour is output in the same
 // colour space as the town. No fog, bloom or full-scene postprocessing blur.
 const backdropUniforms = {
  top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
  night: { value: 0 }, resolution: { value: new THREE.Vector2() },
 };
 const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: backdropUniforms, depthWrite: false, depthTest: false,
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}`,
  fragmentShader: `
   varying vec2 vUv;
   uniform vec3 top, bottom;
   uniform float night;
   uniform vec2 resolution;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   void main(){
    vec3 sky=mix(bottom,top,smoothstep(0.0,1.0,vUv.y));
    vec2 cells=vUv*vec2(resolution.x/resolution.y,1.0)*38.0;
    vec2 cell=floor(cells);
    vec2 offset=vec2(hash(cell),hash(cell+19.0))*.7+.15;
    float d=length(fract(cells)-offset);
    float star=(1.0-smoothstep(.012,.045,d))*step(.967,hash(cell+47.0));
    sky+=vec3(.48,.56,.72)*star*night*smoothstep(.25,.8,vUv.y);
    gl_FragColor=vec4(sky,1.0);
    #include <colorspace_fragment>
   }`,
 }));
 backdrop.name = 'Thistlebrook • evening sky';
 backdrop.frustumCulled = false;backdrop.userData.registryExempt=true;
 backdrop.renderOrder = -1000;
 scene.add(backdrop);

 // Soft pools remain cheap decals; these small lantern halos make their
 // sources readable without adding a point light for every street fixture.
 const lanterns = new THREE.Group();
 lanterns.name = 'Thistlebrook • lantern halos';
 const haloMaterial = new THREE.ShaderMaterial({
  uniforms: { night: uniforms.uAstraNight, haloColor: { value: new THREE.Vector3(1, .63, .24) } }, transparent: true,
  depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy;gl_Position=projectionMatrix*p;}`,
  fragmentShader: `
   varying vec2 vUv;
   uniform float night;
   uniform vec3 haloColor;
   void main(){
    float d=length(vUv-.5)*2.;
    float a=pow(max(0.,1.-d),3.)*.27*night;
    gl_FragColor=vec4(haloColor,a);
    #include <colorspace_fragment>
   }`,
 });
 const haloGeometry = new THREE.PlaneGeometry(1.6, 1.6);
 for (const prop of town.props.filter(p => p.id === 'cv-streetlamp')) {
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.position.set(prop.pos[0], 2.55, prop.pos[1]);
  halo.userData.registryId=prop.registryId;
  lanterns.add(halo);
 }
 scene.add(lanterns);

 const direction = new THREE.Vector3();
 const state = { hour: 10.4, night: 0, period: 'Daylight', shadowSpan: 0 };
 function update(hour) {
  const { hour: h, index, from, to, blend } = sampleLightCycle(hour, KEYS);
  const lerp = i => THREE.MathUtils.lerp(from[i], to[i], blend);
  const color = (target, i) => target.copy(colors[index][i]).lerp(colors[index + 1][i], blend);
  color(backdropUniforms.top.value, 0); color(backdropUniforms.bottom.value, 1);
  color(fill.color, 2); color(fill.groundColor, 3); color(key.color, 4); color(ink, 5);
  fill.intensity = lerp(7); key.intensity = lerp(8);
  state.hour = h; state.night = lerp(9); state.period = lightPeriod(h);
  uniforms.uAstraNight.value = state.night;
  uniforms.uAstraShade.value.copy(dayShade).lerp(nightShade, state.night);
  backdropUniforms.night.value = THREE.MathUtils.smoothstep(state.night, .65, 1);
  renderer.getSize(backdropUniforms.resolution.value);
  for (const material of inks) material.uniforms.uInk.value.copy(ink);

  // Fit the shadow map to the viewed area instead of spreading 2048 texels
  // over the entire town at close zoom. Snap its anchor to texels when panning.
  const span = Math.max(46, Math.min(520, Math.max(camera.right-camera.left, camera.top-camera.bottom)/camera.zoom*.65+12));
  const texel = span*2/key.shadow.mapSize.x;
  key.target.position.set(Math.round(controls.target.x/texel)*texel, 0, Math.round(controls.target.z/texel)*texel);
  direction.set(lerp(10), lerp(11), lerp(12)).normalize().multiplyScalar(900);
  key.position.copy(key.target.position).add(direction);
  const shadowCamera = key.shadow.camera;
  if (Math.abs(state.shadowSpan-span)>.01) {
   Object.assign(shadowCamera,{left:-span,right:span,top:span,bottom:-span});
   shadowCamera.updateProjectionMatrix(); state.shadowSpan=span;
  }
  return state.night;
 }
 // Apply a skin's lighting blocks (src/skins/*.js). null -> original values.
 function setSkin(skin) {
  KEYS = skin.keys || LIGHT_KEYS;
  colors = KEYS.map(k => k.slice(1, 7).map(c => new THREE.Color(c)));
  dayShade.set(skin.shade?.day || DEFAULT_SHADE[0]); nightShade.set(skin.shade?.night || DEFAULT_SHADE[1]);
  lanterns.visible = skin.halos?.visible ?? true;
  if (skin.halos?.color) haloMaterial.uniforms.haloColor.value.set(...new THREE.Color(skin.halos.color).toArray());
  else haloMaterial.uniforms.haloColor.value.set(1, .63, .24);
  const nextStyled = !!skin.material;
  if (nextStyled !== styled) { styled = nextStyled; for (const m of materials) m.needsUpdate = true; }
  state.skin = skin.id;
 }
 return { update, register, setSkin, state, key, fill, get styled(){return styled;}, get materialCount(){return materials.size;} };
}
