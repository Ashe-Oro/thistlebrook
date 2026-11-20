import * as THREE from 'three';
import { createGLTFLoader } from '../../gltf-loader.js';
import { outlineMaterial, RAMP, toonMaterial } from '../../toon.js';
import manifest from './models.json' with { type: 'json' };

const outlines = { semi: .016, starship: .18, falcon9: .18 };
const loads = new Map();

export function hy3dTemplateFromGeometry(slug, geometry, { map = null } = {}) {
  const entry = manifest.models[slug];
  if (entry.yaw) geometry = geometry.clone().rotateY(THREE.MathUtils.degToRad(entry.yaw));
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const { x: width, y: height, z: length } = geometry.boundingBox.getSize(new THREE.Vector3());
  if (!(width > 0 && height > 0 && length > 0)) throw new Error('Expected a three-dimensional mesh');
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  const material = entry.look === 'tex'
    ? new THREE.MeshToonMaterial({ color: 0xffffff, map, gradientMap: RAMP })
    : toonMaterial(entry.color);
  return { geometry, material, outline: outlineMaterial(outlines[slug] ?? .011), dims: { width, height, length }, slug };
}

function groundOffset(bounds) {
  const center = bounds.getCenter(new THREE.Vector3());
  return [-center.x, -bounds.min.y, -center.z];
}

// Offset is in source units, applied before the uniform scale. Without
// bounds the source is assumed to be centered on X/Z and grounded on Y.
export function fitToFootprint(dims, target, bounds) {
  const scale = Math.min(target.length / dims.length, target.width / dims.width, target.height / dims.height);
  return { scale, offset: bounds ? groundOffset(bounds) : [0, 0, 0] };
}

export function createHy3dBody(template, scale, offset = groundOffset(template.geometry.boundingBox)) {
  const { geometry, material, outline, slug } = template;
  const body = new THREE.Group();
  body.name = slug;
  body.scale.setScalar(scale);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...offset);
  mesh.castShadow = mesh.receiveShadow = true;
  const hull = new THREE.Mesh(geometry, outline);
  hull.position.set(...offset);
  hull.userData.outline = true;
  body.add(mesh, hull);
  return body;
}

export function loadHy3dModels({ base = import.meta.env?.BASE_URL ?? '/' } = {}) {
  if (!loads.has(base)) loads.set(base, load(base));
  return loads.get(base);
}

async function load(base) {
  if (typeof document === 'undefined' || typeof fetch !== 'function') return new Map();
  const loader = createGLTFLoader();
  const assetRoot = base.endsWith('/') ? base : base + '/';
  const entries = await Promise.all(Object.keys(manifest.models).map(async slug => {
    try {
      const gltf = await loader.loadAsync(assetRoot + manifest.dir + slug + '.glb');
      let mesh;
      gltf.scene.traverse(object => { if (object.isMesh) mesh = object; });
      if (!mesh) throw new Error('Expected a mesh');
      if (manifest.models[slug].look === 'tex' && !mesh.material.map) throw new Error('Expected a base-color texture');
      return [slug, hy3dTemplateFromGeometry(slug, mesh.geometry, { map: mesh.material.map })];
    } catch (error) {
      console.warn(`HY3D model ${slug} is unavailable`, error);
      return null;
    }
  }));
  return new Map(entries.filter(Boolean));
}
