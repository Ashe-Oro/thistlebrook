import * as THREE from 'three';
import {outlineMaterial} from '../toon.js';
import {hullFor} from './themepark-assets.js';

/** Attach ink to procedural meshes, sharing the transform for instanced batches. */
export function inkMesh(mesh, thickness = .035) {
  const geometry = hullFor(mesh.geometry), material = outlineMaterial(thickness);
  const ink = mesh.isInstancedMesh
    ? new THREE.InstancedMesh(geometry, material, mesh.count)
    : new THREE.Mesh(geometry, material);
  if (mesh.isInstancedMesh) {
    ink.instanceMatrix = mesh.instanceMatrix;
    ink.frustumCulled = false;
  }
  ink.userData.outline = true;
  mesh.add(ink);
  return mesh;
}
