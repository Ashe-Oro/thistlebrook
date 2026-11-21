import * as THREE from 'three';
import { flatToonRamp, isOutlineMaterial, outlineMaterial, toonVertexColorMaterial } from '../toon.js';
import { hasMeshDetail, inheritMeshDetail } from './model-detail.js';

// Keep the upload of a merged buffer bounded and keep dense repeated models
// instanced. A single dense model only needs one copy of its geometry.
const MAX_BATCH_VERTICES = 96000;
const MAX_REPEATED_VERTICES = 18000;
const mergeAttributes = new Set(['position', 'normal', 'color', 'uv', 'glow']);
let mergedInk;

function inkMaterial() {
  if (mergedInk) return mergedInk;
  const source = outlineMaterial(0);
  mergedInk = source.clone();
  mergedInk.vertexShader = source.vertexShader
    .replace('uniform float uThickness, uFadeDist, uFadeMin;', 'uniform float uFadeDist, uFadeMin; attribute vec3 inkOffset;')
    .replace('normalize(normal) * uThickness * k', 'inkOffset * k');
  return mergedInk;
}

function format(source, preserveOutlineGeometry) {
  const { geometry, material } = source;
  if (hasMeshDetail(source) || !material.visible || material.transparent || material.wireframe ||
      material.alphaTest || source.customDepthMaterial || source.customDistanceMaterial ||
      Object.keys(geometry.morphAttributes).length || geometry.drawRange.start !== 0 ||
      geometry.drawRange.count !== Infinity || !geometry.attributes.normal) return null;

  if (isOutlineMaterial(material) && !preserveOutlineGeometry) {
    return { material: inkMaterial(), keys: ['position', 'inkOffset'], ink: true };
  }
  if (!material.isMeshToonMaterial) return null;
  const ramp = flatToonRamp(material);
  if (ramp && material.side === THREE.FrontSide && !material.map && material.opacity === 1 && !material.emissive.getHex()) {
    return { material: toonVertexColorMaterial({ ramp }), keys: ['position', 'normal', 'color'], flat: true };
  }
  // UVs from models without textures are unused by the town's toon shaders.
  const keys = Object.keys(geometry.attributes).filter(key => key !== 'uv' || material.map || material.alphaMap).sort();
  if (keys.some(key => !mergeAttributes.has(key) || geometry.attributes[key].isInstancedBufferAttribute)) return null;
  return { material, keys };
}

export function batchStaticLines(root, parent) {
  const groups = new Map();
  const point = new THREE.Vector3();
  root.traverseVisible(source => {
    if (!source.isLine) return;
    const { material, geometry } = source;
    if (source.isLineSegments || source.isLineLoop || !material.isLineBasicMaterial || material.transparent ||
        material.vertexColors || material.map || geometry.index || geometry.drawRange.start !== 0 ||
        geometry.drawRange.count !== Infinity) {
      const copy = source.clone();
      copy.matrixAutoUpdate = false;
      copy.matrix.copy(source.matrixWorld);
      parent.add(copy);
      return;
    }
    const key = [material.color.toArray().join(','), material.depthTest, material.depthWrite,
      material.toneMapped, source.renderOrder, source.layers.mask].join('|');
    if (!groups.has(key)) groups.set(key, { material, source, positions: [], ids: new Set() });
    const { positions, ids } = groups.get(key);
    const attribute = geometry.attributes.position;
    for (let i = 0; i < attribute.count; i++) {
      point.fromBufferAttribute(attribute, i).applyMatrix4(source.matrixWorld);
      if (i > 0) positions.push(point.x, point.y, point.z);
      if (i < attribute.count - 1) positions.push(point.x, point.y, point.z);
    }
    ids.add(source.userData.registryId);
  });
  for (const { material, source, positions, ids } of groups.values()) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const line = new THREE.LineSegments(geometry, material);
    line.userData.registryIds = [...ids];
    copyRenderProperties(source, line);
    parent.add(line);
  }
}

function instance(batch) {
  const { source, items } = batch;
  const mesh = new THREE.InstancedMesh(source.geometry, source.material, items.length);
  inheritMeshDetail(source, mesh);
  items.forEach(({ matrix }, index) => mesh.setMatrixAt(index, matrix));
  mesh.userData.registryIds = items.map(({ id }) => id);
  copyRenderProperties(source, mesh);
  return mesh;
}

function copyRenderProperties(source, target) {
  target.castShadow = source.castShadow;
  target.receiveShadow = source.receiveShadow;
  target.renderOrder = source.renderOrder;
  target.layers.mask = source.layers.mask;
  target.customDepthMaterial = source.customDepthMaterial;
  target.customDistanceMaterial = source.customDistanceMaterial;
  if (source.userData.outline) target.userData.outline = true;
  if (source.userData.foliage) target.userData.foliage = true;
}

function merge(batches, layout, vertexCount) {
  const source = batches[0].source;
  const sizes = layout.keys.map(key => key === 'inkOffset' || layout.flat && key === 'color' ? 3 : source.geometry.attributes[key].itemSize);
  const arrays = sizes.map(size => new Float32Array(vertexCount * size));
  const indexCount = batches.reduce((sum, { source, items }) =>
    sum + (source.geometry.index?.count || source.geometry.attributes.position.count) * items.length, 0);
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  const position = new THREE.Vector3(), normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3(), linear = new THREE.Matrix3();
  const ids = new Set();
  let indexOffset = 0, offset = 0;
  for (const { source, items } of batches) {
    const { geometry, material } = source;
    const vertices = geometry.attributes.position.count, indicesIn = geometry.index;
    for (const { matrix, id } of items) {
      ids.add(id);
      normalMatrix.getNormalMatrix(matrix);
      linear.setFromMatrix4(matrix);
      for (const [k, name] of layout.keys.entries()) {
        const n = sizes[k], output = arrays[k], attr = geometry.attributes[name];
        if (name === 'position') {
          for (let i = 0; i < vertices; i++) {
            position.fromBufferAttribute(attr, i).applyMatrix4(matrix).toArray(output, (offset + i) * n);
          }
        } else if (name === 'normal') {
          for (let i = 0; i < vertices; i++) {
            normal.fromBufferAttribute(attr, i).applyNormalMatrix(normalMatrix).toArray(output, (offset + i) * n);
          }
        } else if (name === 'inkOffset') {
          const normalAttr = geometry.attributes.normal, thickness = material.uniforms.uThickness.value;
          for (let i = 0; i < vertices; i++) {
            normal.fromBufferAttribute(normalAttr, i).normalize().multiplyScalar(thickness).applyMatrix3(linear).toArray(output, (offset + i) * n);
          }
        } else if (name === 'color' && layout.flat) {
          for (let i = 0; i < vertices; i++) material.color.toArray(output, (offset + i) * n);
        } else {
          for (let i = 0; i < vertices; i++) {
            for (let j = 0; j < n; j++) output[(offset + i) * n + j] = attr.getComponent(i, j);
          }
        }
      }
      if (indicesIn) {
        for (let i = 0; i < indicesIn.count; i++) indices[indexOffset++] = offset + indicesIn.getX(i);
      } else {
        for (let i = 0; i < vertices; i++) indices[indexOffset++] = offset + i;
      }
      offset += vertices;
    }
  }
  const geometry = new THREE.BufferGeometry();
  layout.keys.forEach((key, i) => geometry.setAttribute(key, new THREE.BufferAttribute(arrays[i], sizes[i])));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, layout.material);
  mesh.userData.registryIds = [...ids];
  copyRenderProperties(source, mesh);
  return mesh;
}

/** Bake an authored static assembly in the receiving district's local frame. */
export function batchStaticMeshes(root, parent, { cellSize = 72, preserveOutlineGeometry = false, preserveIds } = {}) {
  root.updateMatrixWorld(true);
  const batches = new Map();
  const assembly = new THREE.Group();
  assembly.name = root.name || 'Static scenery';
  parent.add(assembly);
  root.traverseVisible(source => {
    if (!source.isMesh) return;
    const { geometry, material } = source;
    const key = geometry.id + ':' + (Array.isArray(material) ? material.map(m => m.id).join(',') : material.id);
    if (!batches.has(key)) batches.set(key, { source, items: [] });
    batches.get(key).items.push({ matrix: source.matrixWorld.clone(), id: source.userData.registryId });
  });
  const groups = new Map();
  for (const batch of batches.values()) {
    const { source, items } = batch;
    const vertices = source.geometry.attributes.position.count * items.length;
    const layout = !Array.isArray(source.material) && !source.isSkinnedMesh &&
      vertices <= (items.length > 1 ? MAX_REPEATED_VERTICES : MAX_BATCH_VERTICES) &&
      format(source, preserveOutlineGeometry);
    // Keep old instancing for meshes with live geometry bindings and custom
    // attributes. Their per-model transforms remain available to the skin.
    if (!layout || items.some(({ matrix, id }) => matrix.determinant() <= 0 || preserveIds?.has(id))) {
      assembly.add(instance(batch));
      continue;
    }
    const shape = source.geometry;
    shape.boundingBox ?? shape.computeBoundingBox();
    const center = shape.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(items[0].matrix);
    const cell = Math.floor(center.x / cellSize) + ':' + Math.floor(center.z / cellSize);
    const attributes = layout.keys.map(key => key + (layout.flat || layout.ink ? '' : shape.attributes[key].itemSize)).join(',');
    const key = [cell, layout.material.id, attributes, source.castShadow, source.receiveShadow,
      source.renderOrder, source.layers.mask, !!source.userData.outline, !!source.userData.foliage].join('|');
    let group = groups.get(key);
    if (group && group.vertices + vertices > MAX_BATCH_VERTICES) {
      emit(group);
      group = null;
    }
    if (!group) {
      group = { layout, members: [], vertices: 0 };
      groups.set(key, group);
    }
    group.vertices += vertices;
    group.members.push(batch);
  }
  for (const group of groups.values()) emit(group);
  return assembly;

  function emit({ members, layout, vertices }) {
    assembly.add(members.length > 1 ? merge(members, layout, vertices) : instance(members[0]));
  }
}
