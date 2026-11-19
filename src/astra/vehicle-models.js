// OWNER: vehicle-variety lane. Renders owned pack vehicles, boats and street
// furniture under the cel toon look: one merged vertex-coloured geometry per
// GLB, an ink hull, per-variant body retint on a CLONED geometry (palettes.json
// cannot recolour these flattened vertex-coloured files), and instanced
// batches for repeated furniture.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createGLTFLoader } from '../gltf-loader.js';
import { toonVertexColorMaterial, outlineMaterial } from '../toon.js';
import { FLEET_MODELS, LIVERY } from './traffic-fleet.js';

const BASE = import.meta.env?.BASE_URL ?? '/';
const OUTLINE_WORLD = .035;
const loader = createGLTFLoader();
const cache = new Map(), variants = new Map(), hulls = new WeakMap();

/** One merged, non-indexed-safe geometry per GLB (positions in model space). */
export function loadPackGeometry(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(BASE + path).then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const parts = [];
    gltf.scene.traverse((o) => { if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 3); const rgb = o.material.color?.toArray() ?? [.8,.8,.8]; for (let i = 0; i < c.length; i += 3) c.set(rgb, i); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); } if (g.attributes.color.itemSize === 4 || g.attributes.color.normalized || !(g.attributes.color.array instanceof Float32Array)) { const src = g.attributes.color, c = new Float32Array(src.count * 3); for (let i = 0; i < src.count; i++) { c[i * 3] = src.getX(i); c[i * 3 + 1] = src.getY(i); c[i * 3 + 2] = src.getZ(i); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); } parts.push(g.index ? g.toNonIndexed() : g); });
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
  }));
  return cache.get(path);
}
function hullOf(geometry) {
  if (hulls.has(geometry)) return hulls.get(geometry);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', geometry.attributes.position.clone());
  const welded = mergeVertices(g, 1e-3); welded.computeVertexNormals(); hulls.set(geometry, welded); return welded;
}
const hsv = (r, g, b) => { const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; let h = 0; if (d > 1e-6) { if (M === r) h = ((g - b) / d) % 6; else if (M === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, M ? d / M : 0, M]; };
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
/** Body retint: vertices inside the model's measured hue window take the
 * target colour, keeping their relative brightness (tint noise survives). */
export function retintGeometry(geometry, retint, hex) {
  const key = geometry.uuid + hex;
  if (variants.has(key)) return variants.get(key);
  const g = geometry.clone(), col = g.attributes.color, target = new THREE.Color(hex), match = [];
  let ref = 0;
  const [minS,maxS]=retint.saturation??[.3,1], [minV,maxV]=retint.value??[.02,1];
  for (let i = 0; i < col.count; i++) {
    const [h,s,v]=hsv(col.getX(i),col.getY(i),col.getZ(i));
    if(s>=minS&&s<=maxS&&v>=minV&&v<=maxV&&hueGap(h,retint.hue)<=retint.width){
      match.push([i,v]);ref+=v;
    }
  }
  ref = match.length ? ref / match.length : 1;
  for (const [i, v] of match) { const k = Math.min(1.6, v / ref); col.setXYZ(i, Math.min(1, target.r * k), Math.min(1, target.g * k), Math.min(1, target.b * k)); }
  col.needsUpdate = true; variants.set(key, g); return g;
}
/** A toon mesh + ink hull for one geometry, scaled and seated. */
export function toonModel(geometry, {scale = 1, offset = [0, 0, 0]} = {}) {
  const group = new THREE.Group(), body = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, toonVertexColorMaterial());
  mesh.castShadow = true; mesh.receiveShadow = true;
  const ink = new THREE.Mesh(hullOf(geometry), outlineMaterial(OUTLINE_WORLD / scale)); ink.userData.outline = true; ink.castShadow = false;
  body.add(mesh, ink); body.scale.setScalar(scale); body.position.set(...offset); group.add(body);
  return group;
}
/** Instanced furniture: `items` carry pos [x,z], yaw, optional y; one draw
 * batch for the body and one for the ink, whatever the count. */
export async function instancedModel(path, items, {scale = 1, y = 0, name = path} = {}) {
  const geometry = await loadPackGeometry(path), box = geometry.boundingBox, group = new THREE.Group();
  group.name = `batch:${name}`;
  const mats = [toonVertexColorMaterial(), outlineMaterial(OUTLINE_WORLD / scale)], geos = [geometry, hullOf(geometry)];
  const o = new THREE.Object3D();
  geos.forEach((geo, k) => {
    const m = new THREE.InstancedMesh(geo, mats[k], items.length);
    items.forEach((it, i) => { o.position.set(it.pos[0], (it.y ?? y) - box.min.y * scale, it.pos[1]); o.rotation.set(0, it.yaw || 0, 0); o.scale.setScalar(scale); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingBox(); m.computeBoundingSphere();
    if (k) { m.userData.outline = true; m.castShadow = false; } else { m.castShadow = true; m.receiveShadow = true; m.userData.instances = items; }
    m.name = k ? 'ink-batch' : name; group.add(m);
  });
  return group;
}

/** Render the same fitted model that supplies the simulation footprint. */
export async function packVehicle({model, colour, fit}) {
  const {path, pack, retint} = FLEET_MODELS[model];
  const base = await loadPackGeometry(path);
  const geometry = retint && colour && colour !== LIVERY ? retintGeometry(base, retint, colour) : base;
  const object = toonModel(geometry, fit);
  object.userData.fleet = {model, colour, pack, size: fit.size};
  return object;
}
