import * as THREE from 'three';
import { flatToonRamp, isOutlineMaterial } from '../toon.js';
import { hasMeshDetail } from './model-detail.js';

// Multi-draw is optional. The authored meshes remain the rendering path on
// WebGL implementations without it.
let multiDraw = false;
const colorMaterials = new Map();
const basicMaterials = new Map();
const motionAttributes = new Set(['position', 'normal', 'color', 'uv', 'glow']);
const participants = new WeakSet();
export function configureRigidBatches(supported) {
  multiDraw = supported;
}

function layout(source, includeInstances) {
  const { material, geometry } = source;
  if (participants.has(source) || source.isSkinnedMesh || source.isBatchedMesh || Array.isArray(material) ||
      source.isInstancedMesh && (!includeInstances || source.instanceColor || source.instanceMatrix.usage !== THREE.StaticDrawUsage) ||
      !material.visible || material.transparent || material.wireframe || material.alphaTest ||
      source.customDepthMaterial || source.customDistanceMaterial || source.layers.mask !== 1 ||
      !includeInstances && hasMeshDetail(source) || Object.keys(geometry.morphAttributes).length ||
      geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return null;

  if (isOutlineMaterial(material)) return { material, keys: ['position', 'normal'] };
  if (material.isMeshBasicMaterial && !material.map && !material.envMap && !material.vertexColors &&
      !material.polygonOffset && material.opacity === 1 &&
      material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile) {
    const { side, depthTest, depthWrite, toneMapped, fog } = material;
    const key = [side, depthTest, depthWrite, toneMapped, fog].join('|');
    if (!basicMaterials.has(key)) basicMaterials.set(key,
      new THREE.MeshBasicMaterial({ side, depthTest, depthWrite, toneMapped, fog }));
    return { material: basicMaterials.get(key), keys: ['position'], color: true };
  }
  if (!material.isMeshToonMaterial || !geometry.attributes.normal) return null;
  const ramp = flatToonRamp(material);
  if (ramp && material.side === THREE.FrontSide && !material.map && !material.emissive.getHex()) {
    if (!colorMaterials.has(ramp)) colorMaterials.set(ramp, new THREE.MeshToonMaterial({ gradientMap: material.gradientMap }));
    return { material: colorMaterials.get(ramp), keys: ['position', 'normal'], color: true };
  }
  const keys = Object.keys(geometry.attributes).filter(key => key !== 'uv' || material.map || material.alphaMap).sort();
  if (keys.some(key => !motionAttributes.has(key) || geometry.attributes[key].isInstancedBufferAttribute)) return null;
  return { material, keys };
}

function geometryFor(source, keys) {
  const geometry = new THREE.BufferGeometry();
  for (const key of keys) geometry.setAttribute(key, source.attributes[key]);
  // Use a common indexed layout so indexed and non-indexed models can share
  // a material batch. Three copies each unique source one time.
  geometry.setIndex(source.index ?? new THREE.BufferAttribute(
    Uint32Array.from({ length: source.attributes.position.count }, (_, i) => i), 1));
  return geometry;
}

function visibleWithin(source, root) {
  for (let object = source; object !== root; object = object.parent) {
    if (!object?.visible) return false;
  }
  return true;
}

// Keep texture and vertex-buffer allocations bounded. Dense single models
// keep their normal draws, while adjacent compatible parts still batch.
function partition(sources) {
  const batches = [];
  let group = { sources: [], geometries: new Map(), vertices: 0, indices: 0 };
  for (const source of sources) {
    const geometry = source.geometry, size = geometry.attributes.position.count;
    if (size > 200000) continue;
    if (!group.geometries.has(geometry)) {
      if (group.vertices + size > 200000) {
        batches.push(group);
        group = { sources: [], geometries: new Map(), vertices: 0, indices: 0 };
      }
      group.geometries.set(geometry, -1);
      group.vertices += size;
      group.indices += geometry.index?.count ?? size;
    }
    group.sources.push(source);
  }
  batches.push(group);
  return batches;
}

/** Batch the opaque, rigid pieces of an animated assembly. Its own pose
 * objects continue to handle animation, selection and registry metadata. */
export function createRigidBatches(root, { includeInstances = false } = {}) {
  const noBatches = { update() {}, setActive() {}, newMeshes: [] };
  if (!multiDraw) return noBatches;
  const layouts = new Map(), batches = [];
  root.updateWorldMatrix(true, true);
  root.traverse(source => {
    if (!source.isMesh) return;
    const props = layout(source, includeInstances);
    if (!props || source.matrixWorld.determinant() <= 0) return;
    const formats = props.keys.map(key => {
      const a = source.geometry.attributes[key];
      return [key, a.itemSize, a.normalized, (a.array || a.data.array).constructor.name].join(':');
    }).join(',');
    const key = [props.material.id, formats, source.castShadow, source.receiveShadow, source.renderOrder,
      !!source.userData.outline, !!source.userData.foliage].join('|');
    if (!layouts.has(key)) layouts.set(key, { props, sources: [] });
    layouts.get(key).sources.push(source);
  });
  for (const { props, sources: matching } of layouts.values()) for (const { sources, geometries, vertices, indices } of partition(matching)) {
    if (sources.length < 2) continue;
    const count = sources.reduce((sum, source) => sum + (source.isInstancedMesh ? source.instanceMatrix.count : 1), 0);
    if (!count) continue;
    const batch = new THREE.BatchedMesh(count, vertices, indices, props.material);
    batch.name = 'Rigid parts';
    batch.sortObjects = false;
    batch.frustumCulled = false;
    const first = sources[0];
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder;
    batch.userData.registryExempt = true;
    batch.userData.outline = first.userData.outline;
    batch.userData.foliage = first.userData.foliage;
    for (const geometry of geometries.keys()) geometries.set(geometry, batch.addGeometry(geometryFor(geometry, props.keys)));
    const parts = sources.map(source => {
      const ids = Array.from({ length: source.isInstancedMesh ? source.instanceMatrix.count : 1 }, () => {
        const index = batch.addInstance(geometries.get(source.geometry));
        if (props.color) batch.setColorAt(index, source.material.color);
        return index;
      });
      participants.add(source);
      source.layers.disableAll();
      return { source, ids, material: source.material, geometry: source.geometry, previous: null,
        color: props.color ? source.material.color.clone() : null };
    });
    root.add(batch);
    batches.push({ batch, parts });
  }
  if (!batches.length) return noBatches;

  const matrix = new THREE.Matrix4(), local = new THREE.Matrix4(), inverse = new THREE.Matrix4();
  let active = true;
  function update() {
    if (!active || !root.visible) return;
    root.updateWorldMatrix(true, true);
    inverse.copy(root.matrixWorld).invert();
    for (const { batch, parts } of batches) {
      for (const part of parts) {
        const { source, ids, material, geometry, previous, color } = part;
        const unchanged = source.material === material && source.geometry === geometry;
        // Geometry or material replacement remains on the original object.
        source.layers.mask = unchanged ? 0 : 1;
        const liveCount = unchanged && material.visible && visibleWithin(source, root)
          ? source.isInstancedMesh ? source.count : 1 : 0;
        if (liveCount !== part.liveCount) {
          ids.forEach((index, i) => batch.setVisibleAt(index, i < liveCount));
          part.liveCount = liveCount;
        }
        if (!liveCount) continue;
        if (color && !color.equals(material.color)) {
          color.copy(material.color);
          for (const index of ids) batch.setColorAt(index, color);
        }
        matrix.multiplyMatrices(inverse, source.matrixWorld);
        const matrixVersion = source.instanceMatrix?.version;
        if (matrixVersion === part.matrixVersion && previous?.equals(matrix)) continue;
        if (source.isInstancedMesh) {
          ids.forEach((index, i) => {
            source.getMatrixAt(i, local);
            batch.setMatrixAt(index, local.premultiply(matrix));
          });
        } else batch.setMatrixAt(ids[0], matrix);
        (part.previous ??= new THREE.Matrix4()).copy(matrix);
        part.matrixVersion = matrixVersion;
      }
    }
  }
  function setActive(next) {
    if (next === active) return;
    active = next;
    for (const { batch, parts } of batches) {
      batch.visible = active;
      if (!active) for (const { source } of parts) source.layers.mask = 1;
    }
    if (active) update();
  }
  update();
  return { update, setActive, newMeshes: batches.map(({ batch }) => batch) };
}
