// OWNER: streetlights lane. Cheap night glow for lamp posts that have no glow
// of their own: one InstancedMesh each for lantern heads, ground pools and
// billboard halos, per caller. No PointLights. Materials are shared, so one
// setLampNight() call (world.update) and one setLampHaloSkin() call
// (lighting.setSkin) drive every lamp in the town.
import * as THREE from 'three';
import {glowLayout} from './lamp-posts.js';
import {LAMP_LOOK} from './lamp-look.js';

// Radial pool texture without a canvas: the same falloff as world.js's
// glowTexture (.8 centre, .35 at 40%, 0 at the rim).
function poolTexture() {
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.min(1, Math.hypot(x + .5 - n / 2, y + .5 - n / 2) / (n / 2));
    const a = d < .4 ? .8 - (.8 - .35) * d / .4 : .35 * (1 - (d - .4) / .6);
    data.set([255, 217, 125, Math.round(a * 255)], (y * n + x) * 4);
  }
  const t = new THREE.DataTexture(data, n, n); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}

const night = {value: 0};
let shared = null;
function materials() {
  if (shared) return shared;
  const head = new THREE.MeshBasicMaterial({color: '#ffe4a6'});
  const pool = new THREE.MeshBasicMaterial({map: poolTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1});
  // Same additive lantern halo as lighting.js, billboarded per instance.
  const halo = new THREE.ShaderMaterial({
    uniforms: {night, haloColor: {value: new THREE.Vector3(1, .63, .24)}, strength: {value: LAMP_LOOK.halo}},
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `
     varying vec2 vUv;
     uniform float night, strength;
     uniform vec3 haloColor;
     void main(){
      float d=length(vUv-.5)*2.;
      gl_FragColor=vec4(haloColor,pow(max(0.,1.-d),3.)*strength*night);
      #include <colorspace_fragment>
     }`,
  });
  shared = {head, pool, halo, geometry: {head: new THREE.IcosahedronGeometry(.17, 1), pool: new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), halo: new THREE.PlaneGeometry(1.6, 1.6)}};
  return shared;
}

/** Glow for `posts` (lampPosts entries). `offset` converts world posts into
 * the caller's frame (placed districts and expansion frames). */
export function buildLampGlow(posts, {name = 'lamp glow', offset = [0, 0]} = {}) {
  const m = materials(), layout = glowLayout(posts, {offset}), group = new THREE.Group(), o = new THREE.Object3D();
  group.name = `Streetlights • ${name}`;
  const batch = (geometry, material, list, place, label) => {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((it, i) => { place(it); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    mesh.name = `${group.name} ${label}`; mesh.castShadow = mesh.receiveShadow = false;
    mesh.userData.lampKeys = list.map((it) => it.key);
    group.add(mesh); return mesh;
  };
  const heads = batch(m.geometry.head, m.head, layout.filter((l) => l.head), (l) => { o.position.set(...l.head); o.scale.setScalar(1); }, 'heads');
  const pools = batch(m.geometry.pool, m.pool, layout, (l) => { o.position.set(...l.pool.center); o.scale.set(l.pool.radius, 1, l.pool.radius); }, 'pools');
  // Halos are billboards: their bounds are the head points plus the quad.
  const halos = batch(m.geometry.halo, m.halo, layout, (l) => { o.position.set(...l.halo); o.scale.setScalar(1); }, 'halos');
  if (pools) pools.renderOrder = 1;
  if (halos) { halos.renderOrder = 2; halos.frustumCulled = false; }
  return {group, layout, heads, pools, halos};
}

/** Night factor 0..1 for every shared lamp glow. */
export function setLampNight(value) {
  const m = materials();
  night.value = value;
  m.pool.opacity = value * LAMP_LOOK.pool;
  m.head.visible = value > LAMP_LOOK.headOn;
}

/** Skin hook: lighting.setSkin passes the skin's halo block through. */
export function setLampHaloSkin(halos = {}) {
  const m = materials();
  m.halo.visible = halos.visible ?? true;
  if (halos.color) m.halo.uniforms.haloColor.value.set(...new THREE.Color(halos.color).toArray());
  else m.halo.uniforms.haloColor.value.set(1, .63, .24);
}
