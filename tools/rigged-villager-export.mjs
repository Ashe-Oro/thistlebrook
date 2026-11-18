import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { draco, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

export function riggedFigure(character, props, role) {
  const { mesh, skeleton, boneByShortName, boneIndex } = character;
  const body = mesh.geometry.clone();
  const colors = new Float32Array(body.attributes.position.count * 3);
  for (const group of body.groups) {
    for (let j = group.start; j < group.start + group.count; j++) {
      const vertex = body.index ? body.index.getX(j) : j;
      mesh.material[group.materialIndex].color.toArray(colors, vertex * 3);
    }
  }
  body.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  body.clearGroups();
  const strips = [];
  const append = (geometry) => {
    for (const name of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'color', 'skinIndex', 'skinWeight'].includes(name)) geometry.deleteAttribute(name);
    }
    strips.push(geometry.index ? geometry.toNonIndexed() : geometry);
  };
  append(body);
  props.updateMatrixWorld(true);
  const inversePose = new THREE.Matrix4();
  props.traverse((part) => {
    if (!part.isMesh) return;
    const name = part.userData.face ? 'Head'
      : ['baker', 'innkeeper', 'hostess'].includes(role) ? 'Spine2'
      : ['porter', 'samurai', 'ronin', 'miko'].includes(role) ? 'Spine'
      : 'LeftHand';
    const index = boneIndex[name];
    inversePose.multiplyMatrices(boneByShortName[name].matrixWorld, skeleton.boneInverses[index]).invert();
    const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld).applyMatrix4(inversePose);
    const count = geometry.attributes.position.count;
    const color = new Float32Array(count * 3), joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
    const tint = part.material.color;
    const vertexColor = geometry.attributes.color;
    for (let i = 0; i < count; i++) {
      tint.toArray(color, i * 3);
      if (vertexColor) for (let k = 0; k < 3; k++) color[i * 3 + k] *= vertexColor.getComponent(i, k);
      joints[i * 4] = index;
      weights[i * 4] = 1;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(joints, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));
    append(geometry);
  });
  // Reuse the original bind matrices and restore the T-pose before export.
  for (const bone of skeleton.bones) bone.quaternion.identity();
  const geometry = mergeVertices(mergeGeometries(strips), 1e-5);
  const dressed = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true }));
  dressed.name = 'CharacterMesh';
  dressed.bind(skeleton, mesh.bindMatrix);
  character.group.remove(mesh);
  character.group.add(dressed);
  character.group.name = props.name;
  return character.group;
}

export async function writeRiggedGlb(path, data) {
  const doc = await io.readBinary(new Uint8Array(data));
  const [skin] = doc.getRoot().listSkins();
  const joints = skin?.listJoints() ?? [];
  if (joints.length !== 65 || joints.some(bone => !bone.getName().startsWith('mixamorig:'))) {
    throw new Error(`Invalid Mixamo skin in ${path}`);
  }
  await doc.transform(weld(), draco({ method: 'edgebreaker' }));
  await io.write(path, doc);
}
