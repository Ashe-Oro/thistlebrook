// OWNER: grok-skins lane (Grok). Skin runtime: applies a skin data file
// (src/skins/<id>.js, format in docs/SKINS.md) to the running world, like
// swapping a stylesheet. Nothing is rebuilt or reloaded:
//  - light keys, shade, halo colour and the toon/styled material variant go
//    through lighting.setSkin (one recompile only when crossing default<->styled)
//  - material numbers are shared uniforms (material.js)
//  - practicals (bulbs, lamp pools, signs, building hulls, spill pools) are
//    swapped in place and restored exactly when a skin leaves them null
//  - post is created lazily and only runs for skins with a `post` block.
// The default skin (all blocks null) takes the original code path untouched.
import * as THREE from 'three';
import { SKINS, getSkin } from '../../skins/index.js';
import { SKIN_UNIFORMS, applySkinMaterial } from './material.js';
import { createSkinPost } from './post.js';

export function createSkinRuntime({ renderer, scene, camera, world, lighting, quality = 'med', initial = 'cel' }) {
 let skin = getSkin('cel'), post = null, P = null, signCols = [];
 const v3 = new THREE.Vector3();
 const hashPos = (o, a, b, n) => { const p = o.getWorldPosition(v3); return Math.abs(Math.floor(p.x * a) * 7 + Math.floor(p.z * b) * 3) % n; };

 // ---- practicals: scanned once, on the first skin that styles them ----
 let scanned = false;
 const bulbs = [], lampPools = [], signs = [], hulls = [];
 const bulbMats = new Map(), poolMats = new Map(), tubes = new Map();
 const tubeU = { uTubeK: { value: .3 }, uTubeA: { value: new THREE.Color() }, uTubeB: { value: new THREE.Color() }, uTubeC: { value: new THREE.Color() }, uTubeSplit: { value: new THREE.Vector2(.45, .85) } };
 let pools = null;
 const poolU = { uPoolK: { value: .3 } };
 function scan() {
  if (scanned) return; scanned = true;
  scene.traverse(o => {
   if (!o.isMesh) return;
   const m = o.material;
   if (m?.isMeshBasicMaterial && !(m.transparent && !m.map)) {
    const r = (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)).radius;
    if (!m.map && r < .6 && m.color.r > .75 && m.color.g > .5 && m.color.r >= m.color.b) bulbs.push({ o, m, k: hashPos(o, .37, .53, 4) });
    else if (m.map && m.transparent && o.geometry?.type === 'CircleGeometry') lampPools.push({ o, m, k: hashPos(o, .37, .53, 4) });
   }
   if (m?.isMeshBasicMaterial && m.map && !m.transparent && o.geometry?.type === 'PlaneGeometry') {
    const p = o.getWorldPosition(v3);
    if (!m.userData.skinBase) { m.userData.skinBase = m.color.clone(); m.userData.skinK = Math.abs(Math.floor(p.x * .31) + Math.floor(p.z * .23)) % 2; signs.push(m); }
   }
  });
  const hullGeos = new Set();
  for (const s of world?.selectables || []) if (s.type === 'building') s.object?.traverse(o => { if (o.userData.outline) hullGeos.add(o.geometry.uuid); });
  scene.traverse(o => { if (o.isInstancedMesh && o.material?.uniforms?.uInk && hullGeos.has(o.geometry.uuid)) hulls.push({ o, m: o.material }); });
  for (const { m } of hulls) if (!tubes.has(m)) {
   const t = m.clone(); Object.assign(t.uniforms, tubeU);
   t.vertexShader = t.vertexShader.replace('void main() {', `varying float vTube;
      void main() {
        #ifdef USE_INSTANCING
          vec2 tp = floor(instanceMatrix[3].xz * vec2(.29, .41));
          vTube = fract(sin(dot(tp, vec2(12.9898, 78.233))) * 43758.5453);
        #else
          vTube = 0.;
        #endif`);
   t.fragmentShader = 'uniform float uTubeK; uniform vec3 uTubeA, uTubeB, uTubeC; uniform vec2 uTubeSplit; varying float vTube;\n' + t.fragmentShader.replace('gl_FragColor = vec4(uInk, 1.0);',
    'gl_FragColor = vec4((vTube < uTubeSplit.x ? uTubeA : vTube < uTubeSplit.y ? uTubeB : uTubeC) * uTubeK, 1.0);');
   t.userData.skinTube = true; tubes.set(m, t);
  }
  const blds = (world?.selectables || []).filter(s => s.type === 'building');
  pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
   uniforms: poolU, transparent: true, depthWrite: false, blending: THREE.CustomBlending,
   blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
   vertexShader: 'varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }',
   fragmentShader: 'uniform float uPoolK; varying vec2 vUv; varying vec3 vC; void main(){ float d = length(vUv - .5) * 2.; float a = pow(max(0., 1. - d), 2.2) * uPoolK; gl_FragColor = vec4(vC * a, 0.); }',
  }), Math.max(1, blds.length));
  pools.name = 'skin • spill pools'; pools.frustumCulled = false; pools.renderOrder = 2; pools.userData.registryExempt = true; pools.visible = false;
  const tmp = new THREE.Object3D(), size = new THREE.Vector3(), centre = new THREE.Vector3();
  pools.userData.keys = blds.map((s, i) => {
   s.bounds.getSize(size); s.bounds.getCenter(centre);
   const r = Math.max(size.x, size.z) * 1.9 + 3;
   tmp.position.set(centre.x, .06, centre.z); tmp.scale.set(r, 1, r); tmp.updateMatrix(); pools.setMatrixAt(i, tmp.matrix);
   pools.setColorAt(i, new THREE.Color());
   return Math.abs(Math.floor(centre.x * .29) * 5 + Math.floor(centre.z * .41) * 3) % 4;
  });
  pools.count = blds.length;
  scene.add(pools);
 }
 const cached = (map, key, make) => { if (!map.has(key)) map.set(key, make()); return map.get(key); };
 function applyPracticals(pr) {
  if (pr) scan();
  if (!scanned) return;
  const list = c => c.map(h => new THREE.Color(h));
  // bulbs
  if (pr?.bulbs) { const cs = list(pr.bulbs); bulbs.forEach(b => { b.o.material = cached(bulbMats, `${b.k % cs.length}|${pr.bulbs}|${pr.bulbGain}`, () => new THREE.MeshBasicMaterial({ color: cs[b.k % cs.length].clone().multiplyScalar(pr.bulbGain ?? 1) })); }); }
  else bulbs.forEach(b => { b.o.material = b.m; });
  // lamp ground pools
  if (pr?.lampPools) { const cs = list(pr.lampPools); lampPools.forEach(l => { const mat = cached(poolMats, l.o, () => { const c = l.m.clone(); c.blending = THREE.AdditiveBlending; return c; }); mat.color.copy(cs[l.k % cs.length]).multiplyScalar(pr.lampPoolGain ?? 1); l.o.material = mat; }); }
  else lampPools.forEach(l => { l.o.material = l.m; });
  // signs: colour is driven per frame in update(); restore the original when unstyled
  if (!pr?.signs) for (const m of signs) m.color.copy(m.userData.skinBase);
  // building hulls -> coloured tubes
  if (pr?.hulls) { tubeU.uTubeA.value.set(pr.hulls.colors[0]); tubeU.uTubeB.value.set(pr.hulls.colors[1 % pr.hulls.colors.length]); tubeU.uTubeC.value.set(pr.hulls.colors[2 % pr.hulls.colors.length]); tubeU.uTubeSplit.value.set(...(pr.hulls.split || [.45, .85])); hulls.forEach(h => { h.o.material = tubes.get(h.m); }); }
  else hulls.forEach(h => { h.o.material = h.m; });
  // spill pools
  if (pr?.spill) { const cs = list(pr.spill.colors); pools.userData.keys.forEach((k, i) => pools.setColorAt(i, cs[k % cs.length])); pools.instanceColor.needsUpdate = true; pools.visible = true; }
  else pools.visible = false;
 }

 function setSkin(id) {
  const next = getSkin(id);
  skin = next;
  lighting.setSkin(next);
  if (next.material) applySkinMaterial(next.material);
  applyPracticals(next.practicals);
  signCols = (next.practicals?.signs?.colors || []).map(h => new THREE.Color(h));
  P = next.post;
  if (P) { post ||= createSkinPost(renderer, quality); post.configure(P); }
  state.skin = next.id; state.post = !!P; state.bulbs = bulbs.length; state.signs = signs.length; state.hulls = hulls.length;
  for (const fn of listeners) fn(next);
  return next;
 }

 function update(night) {
  if (skin.material) {
   camera.updateMatrixWorld();
   SKIN_UNIFORMS.uSkinViewInv.value.copy(camera.matrixWorld);
   SKIN_UNIFORMS.uSkinNight.value = night;
   SKIN_UNIFORMS.uSkinLevel.value = Math.max(skin.material.windows.dayFloor ?? 0, night);
  }
  const pr = skin.practicals;
  if (pr?.signs) { for (const m of signs) m.color.setScalar(1).lerp(signCols[m.userData.skinK % signCols.length], pr.signs.amount).multiplyScalar(pr.signs.gain[0] + pr.signs.gain[1] * night); }
  if (pr?.hulls) tubeU.uTubeK.value = pr.hulls.k[0] + pr.hulls.k[1] * night;
  if (pr?.spill) poolU.uPoolK.value = pr.spill.k[0] + pr.spill.k[1] * night;
 }
 /** Draw the frame: default skin is exactly renderer.render(scene, camera). */
 function render(night, time, hour) {
  update(night);
  if (P) post.render(scene, camera, { night, time, hour });
  else renderer.render(scene, camera);
 }
 const listeners = new Set();
 const state = { skin: 'cel', post: false };
 setSkin(initial);
 return {
  render, update, setSkin, state,
  refresh() {
   if (!scanned) return;
   applyPracticals(null);
   pools?.removeFromParent();
   pools?.dispose();
   pools?.geometry.dispose();
   pools?.material.dispose();
   bulbs.length = lampPools.length = signs.length = hulls.length = 0;
   scanned = false;
   if (skin.practicals) setSkin(skin.id);
  },
  get skin() { return skin; },
  list: () => SKINS.map(s => ({ id: s.id, label: s.label, swatch: s.swatch })),
  next(step = 1) { const i = SKINS.findIndex(s => s.id === skin.id); return setSkin(SKINS[(i + step + SKINS.length) % SKINS.length].id); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
 };
}
