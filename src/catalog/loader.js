// Runtime loader for catalog entries: imported GLBs (Draco) and code builders
// come back as the same thing — a pivot Group at the entry's local origin,
// already scaled into world units, front facing +Z, toon-shaded with outlines.
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createGLTFLoader } from '../gltf-loader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial, toonVertexColorMaterial, outlineMaterial } from '../toon.js';
import { FOLIAGE_CATEGORIES } from '../post/options.js';
import { BUILDERS } from './builders-registry.js';
import { resolveAll } from './resolve-all.js';
import BOUNDS from './bounds.json';

const BASE = import.meta.env.BASE_URL;

// Resolved (world-unit) catalog — same Map the compiler consumes, built here
// from the Vite-imported bounds.json (see resolve-all.js, shared with the CLI).
export const RESOLVED = resolveAll(BOUNDS);
export const getEntry = (id) => {
  const e = RESOLVED.get(id);
  if (!e) throw new Error(`[catalog] unknown entry ${id}`);
  return e;
};

// Draco decoder is vendored in public/draco/ (copied from three/examples) so
// it works offline and without a CDN; meshopt's decoder ships in the bundle.
const gltfLoader = createGLTFLoader();
const _gltf = new Map();
function loadGLTF(path, category) {
  if (!_gltf.has(path)) _gltf.set(path, gltfLoader.loadAsync(path.startsWith('/') ? path : BASE + path).then((g) => toonify(g.scene, category)));
  return _gltf.get(path);
}

// Smooth a crown's normals by position only, so tree/bush foliage shades as
// rounded three-tone bands instead of faceted low-poly. Colours stay per
// vertex (Cozy crowns vary colour per facet, so a position+colour weld never
// merged anything and the crowns stayed faceted).
function weldFoliage(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = g.attributes.position;
  const P = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i); }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  const key = (i) => `${Math.round(P[i * 3] * 1e3)},${Math.round(P[i * 3 + 1] * 1e3)},${Math.round(P[i * 3 + 2] * 1e3)}`;
  const acc = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    a.fromArray(P, t * 3); b.fromArray(P, t * 3 + 3); c.fromArray(P, t * 3 + 6);
    const n = c.sub(b).cross(a.sub(b)); // area-weighted face normal
    for (let k = 0; k < 3; k++) {
      const id = key(t + k);
      const v = acc.get(id) || acc.set(id, new THREE.Vector3()).get(id);
      v.add(n);
    }
  }
  const N = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = acc.get(key(i)).clone().normalize();
    N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  // Cozy crowns also bake a different shade into each facet, which fights the
  // toon bands. Flatten the leaf colours (green-dominant vertices) to their
  // mean so the three-tone ramp alone shapes the crown; trunks keep theirs.
  const col = g.attributes.color;
  if (col) {
    const C = new Float32Array(col.count * col.itemSize);
    const leaf = [];
    const m = [0, 0, 0];
    for (let i = 0; i < col.count; i++) {
      const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
      for (let k = 0; k < col.itemSize; k++) C[i * col.itemSize + k] = col.getComponent(i, k);
      if (gg > r * 1.05 && gg > b) { leaf.push(i); m[0] += r; m[1] += gg; m[2] += b; }
    }
    if (leaf.length) {
      for (const i of leaf) { C[i * col.itemSize] = m[0] / leaf.length; C[i * col.itemSize + 1] = m[1] / leaf.length; C[i * col.itemSize + 2] = m[2] / leaf.length; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(C, col.itemSize));
  }
  return g;
}

// Outline hull geometry: imported meshes are flat-shaded (split normals), so a
// hull pushed along those normals cracks open at every hard edge. Weld by
// position and recompute smooth normals for the hull only.
const _hull = new WeakMap();
function hullGeometry(geo, skinned = false) {
  if (_hull.has(geo)) return _hull.get(geo);
  const g = new THREE.BufferGeometry();
  // Copy positions into a plain attribute (glTF/Draco may hand us interleaved).
  const src = geo.attributes.position;
  const arr = new Float32Array(src.count * 3);
  for (let i = 0; i < src.count; i++) { arr[i * 3] = src.getX(i); arr[i * 3 + 1] = src.getY(i); arr[i * 3 + 2] = src.getZ(i); }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  if (geo.index) g.setIndex(geo.index);
  if (skinned) for (const name of ['skinIndex', 'skinWeight']) g.setAttribute(name, geo.attributes[name]);
  const welded = mergeVertices(g, 1e-3);
  welded.computeVertexNormals();
  _hull.set(geo, welded);
  return welded;
}

const OUTLINE_WORLD = 0.035; // matches the builders' typical ink weight

function toonify(root, category) {
  const foliage = FOLIAGE_CATEGORIES.has(category);
  const ramp = foliage ? 'foliage' : 'default';
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) {
    const hasVC = !!m.geometry.attributes.color;
    if (foliage) m.geometry = weldFoliage(m.geometry); // smooth crown normals
    m.material = hasVC ? toonVertexColorMaterial({ ramp }) : toonMaterial(m.material.color ?? 0xffffff, { ramp });
    m.castShadow = true;
    m.receiveShadow = true;
    if (foliage) m.userData.foliage = true; // post prepass: no crease ink in crowns
    const hull = hullGeometry(m.geometry, m.isSkinnedMesh);
    const edge = m.isSkinnedMesh ? new THREE.SkinnedMesh(hull, null) : new THREE.Mesh(hull, null);
    if (m.isSkinnedMesh) {
      edge.bind(m.skeleton, m.bindMatrix);
      edge.boundingSphere = m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2);
    }
    edge.userData.outline = true;
    edge.castShadow = false;
    m.add(edge);
  }
  return root;
}

/**
 * Build one instance of a catalog entry. Always async (meshes load).
 * `params` overrides a builder entry's params (e.g. a path's length); `scale`
 * applies an extra uniform multiplier on top of the entry's world scale.
 */
export async function instantiate(id, { params, scale = 1, animated = false, modelPath } = {}) {
  const e = getEntry(id);
  const pivot = new THREE.Group();
  pivot.name = id;
  pivot.userData.entry = e;
  let content;
  if (e.source === 'mesh') {
    if (animated && e.tags.style.includes('villager')) {
      const riggedPath = e.path.replace('characters/', 'characters/rigged/');
      const rigged = await loadGLTF(riggedPath, e.tags.category).catch(() => null);
      if (rigged) content = cloneSkeleton(rigged);
    }
    content ??= (await loadGLTF(modelPath || e.path, e.tags.category)).clone(true);
    content.scale.setScalar(e.scale);
    content.position.y = (e.yOffset || 0) * e.scale;
    if (e.yawOffset) content.rotation.y = e.yawOffset; // align door to +Z (dormant: all 0)
    // Outline thickness is applied in object space, so undo the kit scale.
    // Thin-bladed Nature foliage (reeds, ferns, grass) sets a finer `outline`
    // so its blades read green rather than solid ink.
    const mat = outlineMaterial((e.outline ?? (e.tags.style.includes('villager') ? 0.008 : OUTLINE_WORLD)) / e.scale);
    content.traverse((o) => {
      if (!o.userData.outline) return;
      o.material = mat;
      // SkeletonUtils clones every skinned mesh independently. The ink hull
      // can use its cloned body's bone texture and pose update.
      if (o.isSkinnedMesh) o.bind(o.parent.skeleton, o.parent.bindMatrix);
    });
  } else {
    content = BUILDERS[e.builder]({ ...(e.params || {}), ...(params || {}) });
    if (e.scale !== 1) content.scale.setScalar(e.scale);
    if (e.yawOffset) content.rotation.y = e.yawOffset; // dormant: all 0
  }
  // Visual-only correction: keep frozen compiled placement and catalog bounds.
  // This A-frame export is much too large beside a 1.7m resident.
  if(id==='cv-aframe-chalkboard'){
    const factor=.85/(e.bounds.max[1]-e.bounds.min[1]);
    content.scale.multiplyScalar(factor);content.position.y*=factor;
  }
  pivot.add(content);
  if (scale !== 1) pivot.scale.setScalar(scale);
  return pivot;
}

/** Instantiate and place at {x, z, rotY}, with optional params/scale override. */
export async function place(id, { x = 0, z = 0, rotY = 0, params, scale = 1, animated = false, modelPath } = {}) {
  const obj = await instantiate(id, { params, scale, animated, modelPath });
  obj.position.set(x, 0, z);
  obj.rotation.y = rotY;
  return obj;
}
