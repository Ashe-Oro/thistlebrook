import * as THREE from 'three';
import { createGLTFLoader } from '../gltf-loader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RAMP, outlineMaterial } from '../toon.js';

// Fairground & Amusement Park pack (private, ThreeJS Assets licence). Models
// are read from the local licensed mapping at runtime and never copied into
// source or build output; only measured metadata lives in the repository.
const BASE = import.meta.env?.BASE_URL ?? '/';
export const FAIRGROUND_DIR = 'licensed/fairground/';
export const fairgroundAsset = name => name.startsWith('prebuilds/') ? 'fairground/' + name.slice(10) + '@prebuilt' : 'fairground/' + name;

// Practical-light colours baked into the pack's day palette. Bulbs, lamp
// globes, neon tubes and lit glass glow after dusk; everything else stays toon.
const GLOW = [
 ['#ffe6a0', [1, .82, .45], 2.1], // lamp
 ['#e85aa0', [1, .33, .7], 2.2], // neon
 ['#4aa8e0', [.3, .72, 1], 2.2], // neonBlue
 ['#f06fb0', [1, .45, .76], 2.2], // neonPink
 ['#5fd07a', [.4, 1, .58], 2], // neonGreen
 ['#7fd8e0', [.45, .95, 1], 1.1], // fountainGlow
 ['#bcd7e0', [1, .78, .42], .55], // glass → warm windows
];
const GLOW_LINEAR = GLOW.map(([hex, glow, strength]) => ({ color: new THREE.Color(hex), glow, strength }));

/** Night factor shared by every fairground material (0 day … 1 night). */
export const parkNight = { value: 0 };
export const parkTime = { value: 0 };

let material = null;
function fairgroundMaterial() {
 if (material) return material;
 material = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: RAMP });
 material.onBeforeCompile = shader => {
  shader.uniforms.uParkNight = parkNight;
  shader.uniforms.uParkTime = parkTime;
  shader.vertexShader = shader.vertexShader
   .replace('#include <common>', '#include <common>\nattribute vec4 glow;\nvarying vec4 vGlow;')
   .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
  shader.fragmentShader = shader.fragmentShader
   .replace('#include <common>', '#include <common>\nuniform float uParkNight;\nuniform float uParkTime;\nvarying vec4 vGlow;')
   .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
   if (vGlow.a > 0.0) {
     // Bulbs chase gently; neon holds steady. Strength rides the night factor.
     float chase = 0.82 + 0.18 * sin(uParkTime * 3.0 + vGlow.a * 40.0);
     totalEmissiveRadiance += vGlow.rgb * uParkNight * chase;
     diffuseColor.rgb = mix(diffuseColor.rgb, vGlow.rgb * 0.6, uParkNight * 0.5);
   }`);
 };
 material.customProgramCacheKey = () => 'pinecrest-fairground';
 return material;
}

// Day-palette vertex colours → per-vertex glow (rgb = emission, a = phase).
function addGlow(geometry) {
 const color = geometry.attributes.color, count = geometry.attributes.position.count;
 const glow = new Float32Array(count * 4), c = new THREE.Color();
 let lit = 0;
 if (color) for (let i = 0; i < count; i++) {
  c.setRGB(color.getX(i), color.getY(i), color.getZ(i));
  for (const g of GLOW_LINEAR) {
   if (Math.abs(c.r - g.color.r) + Math.abs(c.g - g.color.g) + Math.abs(c.b - g.color.b) < .045) {
    glow[i * 4] = g.glow[0] * g.strength; glow[i * 4 + 1] = g.glow[1] * g.strength; glow[i * 4 + 2] = g.glow[2] * g.strength;
    glow[i * 4 + 3] = .05 + (i % 97) / 97; lit++; break;
   }
  }
 }
 geometry.setAttribute('glow', new THREE.BufferAttribute(glow, 4));
 geometry.userData.glowVertices = lit;
 return geometry;
}

const OUTLINE = .03;
function hull(geometry) {
 const g = new THREE.BufferGeometry();
 g.setAttribute('position', geometry.attributes.position.clone());
 if (geometry.index) g.setIndex(geometry.index.clone());
 const welded = mergeVertices(g, 1e-3); welded.computeVertexNormals();
 return welded;
}
/** One toon mesh and its ink hull. Outline thickness compensates the model's scale. */
// Hulls are keyed by the geometry object itself. They used to live on
// `geometry.userData`, but BufferGeometry.clone() shares userData by reference,
// so a mirrored clone reused its source's (unmirrored) hull and drew a dark
// outline sloping the wrong way across Copperhead's slope pieces.
const hulls = new WeakMap();
export function hullFor(geometry) {
 let h = hulls.get(geometry);
 if (!h) { h = hull(geometry); hulls.set(geometry, h); }
 return h;
}
export function fairgroundMesh(geometry, scale = 1) {
 const mesh = new THREE.Mesh(geometry, fairgroundMaterial());
 mesh.castShadow = true; mesh.receiveShadow = true;
 const edge = new THREE.Mesh(hullFor(geometry), outlineMaterial(OUTLINE / scale));
 edge.userData.outline = true; edge.castShadow = false; edge.receiveShadow = false;
 mesh.add(edge);
 return mesh;
}

let loader = null;
const cache = new Map();
/** Merged source geometry of one pack model (all primitives, node transforms applied). */
export function loadFairgroundGeometry(name, mirror = '') {
 // Mirrored variants are baked (flipped positions/normals, reversed winding):
 // negative instance scales would turn batched meshes and ink hulls inside out.
 if (mirror) {
  const key = name + '|' + mirror;
  if (!cache.has(key)) cache.set(key, loadFairgroundGeometry(name).then(source => mirrorGeometry(source, mirror)));
  return cache.get(key);
 }
 if (!cache.has(name)) {
  loader ??= createGLTFLoader();
  cache.set(name, loader.loadAsync(BASE + FAIRGROUND_DIR + name + '.glb').then(gltf => {
   gltf.scene.updateMatrixWorld(true);
   const parts = [];
   gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(key)) g.deleteAttribute(key);
    if (!g.attributes.color) { const n = g.attributes.position.count; g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); }
    if (g.attributes.color.itemSize === 4) { const src = g.attributes.color, rgb = new Float32Array(src.count * 3); for (let i = 0; i < src.count; i++) { rgb[i * 3] = src.getX(i); rgb[i * 3 + 1] = src.getY(i); rgb[i * 3 + 2] = src.getZ(i); } g.setAttribute('color', new THREE.BufferAttribute(rgb, 3)); }
    parts.push(g.index ? g : indexed(g));
   });
   const geometry = parts.length === 1 ? parts[0] : mergeIndexed(parts);
   geometry.computeBoundingBox();
   return addGlow(geometry);
  }));
 }
 return cache.get(name);
}
/** Bake a mirrored copy (flipped positions/normals, reversed winding when an odd number of axes flip). */
export function mirrorGeometry(source, mirror) {
 const g = source.clone(), axes = [...mirror].map(a => 'xyz'.indexOf(a));
 g.userData = { ...source.userData }; // clone() shares userData by reference
 for (const attr of [g.attributes.position, g.attributes.normal]) if (attr) for (let i = 0; i < attr.count; i++) for (const k of axes) attr.setComponent(i, k, -attr.getComponent(i, k));
 if (axes.length % 2 && g.index) { const index = g.index.array; for (let t = 0; t < index.length; t += 3) { const v = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = v; } }
 g.computeBoundingBox(); g.computeBoundingSphere();
 return g;
}
function indexed(g) { const n = g.attributes.position.count; g.setIndex(Array.from({ length: n }, (_, i) => i)); return g; }
function mergeIndexed(parts) {
 let vertices = 0, indices = 0;
 for (const p of parts) { vertices += p.attributes.position.count; indices += p.index.count; }
 const out = new THREE.BufferGeometry(), index = new Uint32Array(indices);
 for (const key of ['position', 'normal', 'color']) {
  const array = new Float32Array(vertices * 3); let offset = 0;
  for (const p of parts) { const a = p.attributes[key]; for (let i = 0; i < a.count; i++) { array[(offset + i) * 3] = a.getX(i); array[(offset + i) * 3 + 1] = a.getY(i); array[(offset + i) * 3 + 2] = a.getZ(i); } offset += a.count; }
  out.setAttribute(key, new THREE.BufferAttribute(array, 3));
 }
 let v = 0, k = 0;
 for (const p of parts) { const src = p.index.array; for (let i = 0; i < src.length; i++) index[k++] = src[i] + v; v += p.attributes.position.count; }
 out.setIndex(new THREE.BufferAttribute(index, 1));
 return out;
}

/**
 * Split a merged model into rigid parts using welded triangle connectivity.
 * `classify(component)` returns a group key (or null = static body). Each part
 * geometry is translated so `pivots[key]` (source units) becomes its origin.
 */
export function splitFairground(geometry, classify, pivots = {}) {
 const position = geometry.attributes.position, index = geometry.index.array, count = position.count;
 const weld = new Map(), id = new Int32Array(count);
 for (let i = 0; i < count; i++) {
  const key = Math.round(position.getX(i) * 1e4) + ',' + Math.round(position.getY(i) * 1e4) + ',' + Math.round(position.getZ(i) * 1e4);
  let w = weld.get(key); if (w === undefined) { w = weld.size; weld.set(key, w); } id[i] = w;
 }
 const parent = new Int32Array(weld.size).map((_, i) => i);
 const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
 for (let t = 0; t < index.length; t += 3) { const a = find(id[index[t]]), b = find(id[index[t + 1]]), c = find(id[index[t + 2]]); if (b !== a) parent[b] = a; if (c !== a && find(c) !== a) parent[find(c)] = a; }
 const components = new Map();
 for (let i = 0; i < count; i++) {
  const r = find(id[i]); let c = components.get(r);
  if (!c) { c = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], n: 0 }; components.set(r, c); }
  c.n++; const p = [position.getX(i), position.getY(i), position.getZ(i)];
  for (let k = 0; k < 3; k++) { c.min[k] = Math.min(c.min[k], p[k]); c.max[k] = Math.max(c.max[k], p[k]); }
 }
 for (const c of components.values()) { c.center = c.min.map((v, k) => (v + c.max[k]) / 2); c.size = c.max.map((v, k) => v - c.min[k]); c.key = classify(c) ?? 'static'; }
 const groups = new Map();
 for (let t = 0; t < index.length; t += 3) {
  const key = components.get(find(id[index[t]])).key;
  if (key === 'drop') continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(index[t], index[t + 1], index[t + 2]);
 }
 const result = {};
 for (const [key, triangles] of groups) {
  const remap = new Map(), pos = [], nor = [], col = [], glo = [], idx = [];
  const pivot = pivots[key] || [0, 0, 0], { normal, color, glow } = geometry.attributes;
  for (const v of triangles) {
   let n = remap.get(v);
   if (n === undefined) {
    n = remap.size; remap.set(v, n);
    pos.push(position.getX(v) - pivot[0], position.getY(v) - pivot[1], position.getZ(v) - pivot[2]);
    nor.push(normal.getX(v), normal.getY(v), normal.getZ(v));
    col.push(color.getX(v), color.getY(v), color.getZ(v));
    glo.push(glow.getX(v), glow.getY(v), glow.getZ(v), glow.getW(v));
   }
   idx.push(n);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('glow', new THREE.Float32BufferAttribute(glo, 4));
  g.setIndex(idx); g.computeBoundingBox(); g.computeBoundingSphere();
  result[key] = g;
 }
 return result;
}

/**
 * A registered pack model: an Object3D whose identity (`ownedAsset`) and
 * measured transform are captured by the district model registry.
 */
export async function fairgroundModel(name, { x = 0, y = 0, z = 0, rot = 0, scale = 1, ordinal } = {}) {
 const scales = Array.isArray(scale) ? scale : [scale, scale, scale];
 const mirror = scales.map((v, k) => v < 0 ? 'xyz'[k] : '').join('');
 const geometry = await loadFairgroundGeometry(name, mirror);
 scale = scales.map(Math.abs);
 const object = new THREE.Group();
 object.name = 'fairground/' + name;
 object.userData.ownedAsset = fairgroundAsset(name);
 object.userData.ownedPath = 'fairground/' + name + '.glb';
 object.userData.fairground = name;
 if (ordinal !== undefined) object.userData.placementOrdinal = ordinal;
 object.add(fairgroundMesh(geometry, Math.abs(Array.isArray(scale) ? scale[0] : scale)));
 object.position.set(x, y, z); object.rotation.y = rot;
 if (Array.isArray(scale)) object.scale.set(...scale); else object.scale.setScalar(scale);
 return object;
}
