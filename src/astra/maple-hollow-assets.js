// OWNER: opus-suburb lane. Suburban Neighborhood pack (ThreeJS Assets, Ashe's
// licence) for Maple Hollow. Models load at runtime from public/licensed (never
// copied into src/ or docs/) through the shared Draco/meshopt loader, and are
// drawn as one InstancedMesh per model plus an instanced ink hull, the same
// per-piece outline path as themepark-assets.js.
import * as THREE from 'three';
import { createGLTFLoader } from '../gltf-loader.js';
import { RAMP, outlineMaterial } from '../toon.js';
import { hullFor } from './themepark-assets.js';
import { LAMP_LOOK } from './lamp-look.js';

const BASE = import.meta.env?.BASE_URL ?? '/';
// Literal paths: tools/prepare-deploy-dist.mjs ships exactly the models named here.
export const SUBURB_MODELS = {
  bungalow_house: 'licensed/suburban-neighborhood/bungalow_house.glb',
  ranch_house: 'licensed/suburban-neighborhood/ranch_house.glb',
  split_level_house: 'licensed/suburban-neighborhood/split_level_house.glb',
  two_story_house: 'licensed/suburban-neighborhood/two_story_house.glb',
  modern_house: 'licensed/suburban-neighborhood/modern_house.glb',
  townhouse_duplex: 'licensed/suburban-neighborhood/townhouse_duplex.glb',
  garage: 'licensed/suburban-neighborhood/garage.glb',
  front_porch: 'licensed/suburban-neighborhood/front_porch.glb',
  backyard_deck: 'licensed/suburban-neighborhood/backyard_deck.glb',
  garden_shed: 'licensed/suburban-neighborhood/garden_shed.glb',
  kids_treehouse: 'licensed/suburban-neighborhood/kids_treehouse.glb',
  pergola: 'licensed/suburban-neighborhood/pergola.glb',
  stepping_stones: 'licensed/suburban-neighborhood/stepping_stones.glb',
  rockery_boulders: 'licensed/suburban-neighborhood/rockery_boulders.glb',
  basketball_hoop: 'licensed/suburban-neighborhood/basketball_hoop.glb',
  bbq_grill: 'licensed/suburban-neighborhood/bbq_grill.glb',
  hose_reel_sprinkler: 'licensed/suburban-neighborhood/hose_reel_sprinkler.glb',
  lawn_mower: 'licensed/suburban-neighborhood/lawn_mower.glb',
  mailbox: 'licensed/suburban-neighborhood/mailbox.glb',
  patio_table_chairs: 'licensed/suburban-neighborhood/patio_table_chairs.glb',
  picket_fence: 'licensed/suburban-neighborhood/picket_fence.glb',
  privacy_fence: 'licensed/suburban-neighborhood/privacy_fence.glb',
  swing_set: 'licensed/suburban-neighborhood/swing_set.glb',
  wheelie_bins: 'licensed/suburban-neighborhood/wheelie_bins.glb',
  family_pickup: 'licensed/suburban-neighborhood/family_pickup.glb',
  family_sedan: 'licensed/suburban-neighborhood/family_sedan.glb',
  school_bus: 'licensed/suburban-neighborhood/school_bus.glb',
  suv_minivan: 'licensed/suburban-neighborhood/suv_minivan.glb',
  lawn_tuft_scatter: 'licensed/suburban-neighborhood/lawn_tuft_scatter.glb',
  arborvitae_conifer: 'licensed/suburban-neighborhood/arborvitae_conifer.glb',
  boxwood_hedge: 'licensed/suburban-neighborhood/boxwood_hedge.glb',
  flower_bed: 'licensed/suburban-neighborhood/flower_bed.glb',
  flowering_tree: 'licensed/suburban-neighborhood/flowering_tree.glb',
  shade_tree: 'licensed/suburban-neighborhood/shade_tree.glb',
  pond_garden: 'licensed/suburban-neighborhood/pond_garden.glb',
  swimming_pool: 'licensed/suburban-neighborhood/swimming_pool.glb',
  address_plaque: 'licensed/suburban-neighborhood/address_plaque.glb',
  hoa_entrance_sign: 'licensed/suburban-neighborhood/hoa_entrance_sign.glb',
  street_stop_sign: 'licensed/suburban-neighborhood/street_stop_sign.glb',
  fire_hydrant: 'licensed/suburban-neighborhood/fire_hydrant.glb',
  for_sale_sign: 'licensed/suburban-neighborhood/for_sale_sign.glb',
  sprinkler_spray: 'licensed/suburban-neighborhood/sprinkler_spray.glb',
  streetlamp: 'licensed/suburban-neighborhood/streetlamp.glb',
};

// Vertex roles. Swappable colours are stored divided by the model's own base
// colour and multiplied back per instance (mhSiding, mhRoof, mhAccent).
export const ROLE = {none: 0, siding: 1, roof: 2, accent: 3, glass: 4, lamp: 5};
// Base colours measured from the pack's day palette (sRGB, per model).
export const ROLE_BASE = {
  two_story_house: {siding: '#556a77', roof: '#443f38', accent: '#3f5a4a'},
  bungalow_house: {siding: '#536249', roof: '#4a362a', accent: '#3f5a4a'},
  ranch_house: {siding: '#9a8f77', roof: '#443f38', accent: '#3f5a4a'},
  split_level_house: {siding: '#9a8f77', roof: '#443f38', accent: '#3f5a4a'},
  modern_house: {siding: '#9a9489', roof: null, accent: null},
  townhouse_duplex: {siding: '#9b9078', roof: '#403b34', accent: '#3f5a4a'},
  garage: {siding: '#9b9078', roof: '#443f38', accent: null},
  front_porch: {siding: null, roof: '#443f38', accent: null},
  // Car bodies take a per-instance paint (accent).
  family_sedan: {accent: '#3b5570'}, suv_minivan: {accent: '#898e93'}, family_pickup: {accent: '#a23832'},
};
const GLASS = ['#c2d6e0', '#82a4b4', '#b4c8d4', '#9ec4e0'], LAMP = ['#ffd98a'];

/** Night factor for Maple Hollow windows (the world.js window hook reads `uAstraNight`). */
export const suburbNight = { value: 0 };
export const suburbLamps = { value: 0 };
let material = null;
export function suburbMaterial() {
  if (material) return material;
  material = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: RAMP });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uAstraNight = suburbNight;
    shader.uniforms.uMhLamps = suburbLamps;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float mhRole;
#ifdef USE_INSTANCING
attribute vec3 mhSiding; attribute vec3 mhRoof; attribute vec3 mhAccent; attribute float mhLit;
#endif
varying float vMhGlass; varying float vMhLamp;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
 vMhGlass = 0.0; vMhLamp = 0.0;
 #if defined(USE_INSTANCING) && defined(USE_COLOR)
  if (mhRole > .5 && mhRole < 1.5 && mhSiding.r + mhSiding.g + mhSiding.b > 0.0) vColor.rgb *= mhSiding;
  if (mhRole > 1.5 && mhRole < 2.5 && mhRoof.r + mhRoof.g + mhRoof.b > 0.0) vColor.rgb *= mhRoof;
  if (mhRole > 2.5 && mhRole < 3.5 && mhAccent.r + mhAccent.g + mhAccent.b > 0.0) vColor.rgb *= mhAccent;
  if (mhRole > 3.5 && mhRole < 4.5) vMhGlass = mhLit;
  if (mhRole > 4.5) vMhLamp = mhLit;
 #endif`);
    // Same window hook string as world.js, so every skin restyles these windows too.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uAstraNight;\nuniform float uMhLamps;\nvarying float vMhGlass; varying float vMhLamp;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 if(vMhGlass>.5){totalEmissiveRadiance+=vec3(1.0,.48,.09)*uAstraNight*.9;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.4,.1),uAstraNight);}
 if(vMhLamp>.5){totalEmissiveRadiance+=vec3(1.0,.78,.42)*uMhLamps*${LAMP_LOOK.suburbGlass.toFixed(2)};diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0,.86,.55),uMhLamps*.7);}`);
  };
  material.customProgramCacheKey = () => 'maple-hollow-suburb';
  return material;
}

const near = (c, list, tol) => list.some((h) => { const k = new THREE.Color(h).convertLinearToSRGB(); return Math.abs(c.r - k.r) < tol && Math.abs(c.g - k.g) < tol && Math.abs(c.b - k.b) < tol; });
// Compare in sRGB, where the measured palette lives.
const srgb = new THREE.Color();
function roles(name, geometry) {
  const color = geometry.attributes.color, n = geometry.attributes.position.count, role = new Float32Array(n), base = ROLE_BASE[name] || {};
  const bases = Object.fromEntries(Object.entries(base).filter(([, v]) => v).map(([k, v]) => [k, new THREE.Color(v)]));
  const counts = {siding: 0, roof: 0, accent: 0, glass: 0, lamp: 0};
  for (let i = 0; i < n; i++) {
    srgb.setRGB(color.getX(i), color.getY(i), color.getZ(i)).convertLinearToSRGB();
    let r = 0;
    if (near(srgb, GLASS, .02)) r = ROLE.glass;
    else if (near(srgb, LAMP, .03)) r = ROLE.lamp;
    else for (const key of ['siding', 'roof', 'accent']) if (bases[key] && near(srgb, [base[key]], key === 'roof' ? .055 : .045)) { r = ROLE[key]; break; }
    role[i] = r;
    if (r >= 1 && r <= 3) {
      const key = ['', 'siding', 'roof', 'accent'][r], b = bases[key]; counts[key]++;
      // Store the ratio to the base (linear) so shading and baked variation survive a recolour.
      // Flatten the pack's baked wood grain and shingle noise to three tones (the village look).
      const lum = (color.getX(i) * .2126 + color.getY(i) * .7152 + color.getZ(i) * .0722) / Math.max(1e-3, b.r * .2126 + b.g * .7152 + b.b * .0722);
      const k = lum < .8 ? .8 : lum > 1.18 ? 1.15 : 1;
      color.setXYZ(i, k, k, k);
    } else if (r) counts[r === ROLE.glass ? 'glass' : 'lamp']++;
  }
  geometry.setAttribute('mhRole', new THREE.BufferAttribute(role, 1));
  geometry.userData.roles = counts;
  return geometry;
}

let loader = null;
const cache = new Map();
/** Merged geometry (position, normal, colour, role) of one pack model. */
export function loadSuburbGeometry(name) {
  if (!SUBURB_MODELS[name]) throw Error('Unknown suburban model: ' + name);
  if (!cache.has(name)) {
    loader ??= createGLTFLoader();
    cache.set(name, loader.loadAsync(BASE + SUBURB_MODELS[name]).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const parts = [];
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(key)) g.deleteAttribute(key);
        if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
        if (g.attributes.color.itemSize === 4) { const src = g.attributes.color, rgb = new Float32Array(src.count * 3); for (let i = 0; i < src.count; i++) { rgb[i * 3] = src.getX(i); rgb[i * 3 + 1] = src.getY(i); rgb[i * 3 + 2] = src.getZ(i); } g.setAttribute('color', new THREE.BufferAttribute(rgb, 3)); }
        if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
        parts.push(g);
      });
      let geometry = parts[0];
      if (parts.length > 1) {
        let v = 0, k = 0; const total = parts.reduce((s, p) => s + p.attributes.position.count, 0), indices = parts.reduce((s, p) => s + p.index.count, 0);
        geometry = new THREE.BufferGeometry(); const index = new Uint32Array(indices);
        for (const key of ['position', 'normal', 'color']) { const array = new Float32Array(total * 3); let o = 0; for (const p of parts) { array.set(p.attributes[key].array.subarray(0, p.attributes[key].count * 3), o * 3); o += p.attributes[key].count; } geometry.setAttribute(key, new THREE.BufferAttribute(array, 3)); }
        for (const p of parts) { for (const i of p.index.array) index[k++] = i + v; v += p.attributes.position.count; }
        geometry.setIndex(new THREE.BufferAttribute(index, 1));
      }
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      return roles(name, geometry);
    }));
  }
  return cache.get(name);
}

const OUTLINE = .042; // world metres; a touch heavier than the fairground's .03 to match the village ink
/**
 * One model, many placements: a toon InstancedMesh and its instanced ink hull.
 * `items` are {matrix, ids?, siding?, roof?, accent?, lit?}. Returns {mesh, hull, set(i, matrix)}.
 */
export async function suburbBatch(name, items, { scale = 1, castShadow = false, ids, attributes = false, dynamic = false } = {}) {
  const geometry = (await loadSuburbGeometry(name)).clone();
  const count = Math.max(1, items.length);
  if (attributes) {
    for (const [key, size] of [['mhSiding', 3], ['mhRoof', 3], ['mhAccent', 3], ['mhLit', 1]]) {
      const array = new Float32Array(count * size);
      items.forEach((it, i) => { const v = it[key]; if (v === undefined) return; if (size === 1) array[i] = v; else array.set([v.r, v.g, v.b], i * 3); });
      geometry.setAttribute(key, new THREE.InstancedBufferAttribute(array, size));
    }
  }
  const mesh = new THREE.InstancedMesh(geometry, suburbMaterial(), count);
  const hull = new THREE.InstancedMesh(hullFor(await loadSuburbGeometry(name)), outlineMaterial(OUTLINE / scale), count);
  hull.userData.outline = true;
  mesh.name = 'Maple Hollow • ' + name; hull.name = mesh.name + ' ink';
  mesh.castShadow = castShadow; mesh.receiveShadow = true; hull.castShadow = false; hull.receiveShadow = false;
  items.forEach((it, i) => { mesh.setMatrixAt(i, it.matrix); hull.setMatrixAt(i, it.matrix); });
  if (!items.length) { mesh.count = 0; hull.count = 0; }
  if (dynamic) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); hull.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; hull.frustumCulled = false; }
  mesh.computeBoundingSphere(); hull.computeBoundingSphere();
  const tagIds = ids || items.map((it) => it.id);
  mesh.userData.registryIds = [...tagIds]; hull.userData.registryIds = [...tagIds];
  return { mesh, hull, geometry, set(i, matrix) { mesh.setMatrixAt(i, matrix); hull.setMatrixAt(i, matrix); }, commit() { mesh.instanceMatrix.needsUpdate = true; hull.instanceMatrix.needsUpdate = true; } };
}
