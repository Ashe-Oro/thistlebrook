import * as THREE from 'three';

// The social scene is rendered after clearDepth. Test its anchors against the
// visible world before overlap culling so hidden text cannot claim screen space.
const ray = new THREE.Raycaster();
const direction = new THREE.Vector3();
export function filterSocialText(stage, text) {
 const meshes = [];
 stage.scene.updateMatrixWorld(true);
 stage.camera.updateMatrixWorld();
 stage.scene.traverse(o => {
  if (!o.isMesh || o.userData.outline) return;
  for (let p = o; p; p = p.parent) {
   if (!p.visible || p.userData.inst?.kind === 'villager') return;
  }
  const materials = Array.isArray(o.material) ? o.material : [o.material];
  if (materials.some(m => m?.visible && (!m.transparent || m.opacity >= .95))) meshes.push(o);
 });
 const blocked = point => {
  direction.copy(point).sub(stage.camera.position);
  ray.far = direction.length() - .12;
  if (ray.far <= 0) return false;
  if (stage.camera.isOrthographicCamera) {
   ray.setFromCamera(point.clone().project(stage.camera), stage.camera);
   ray.far = direction.copy(point).sub(ray.ray.origin).dot(ray.ray.direction) - .12;
  } else ray.set(stage.camera.position, direction.normalize());
  return ray.intersectObjects(meshes, false).length > 0;
 };
 for (const label of text) {
  if (!label.visible) continue;
  // Also test the resident's head: a label above a low wall must not reveal
  // someone whose body is hidden on the other side.
  const head = label.position.clone();
  head.y -= label.userData.kind === 'bubble' ? 1.45 : .65;
  if (blocked(label.position) || blocked(head)) label.visible = false;
 }
 // Keep nearby names readable when a speech bubble competes for the same area.
 // Positions stay anchored; the existing pass still suppresses actual overlap.
 text.sort((a, b) => (a.userData.kind === 'bubble') - (b.userData.kind === 'bubble') ||
  a.position.distanceToSquared(stage.camera.position) - b.position.distanceToSquared(stage.camera.position));
}
