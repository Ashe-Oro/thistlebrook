import * as THREE from 'three';

// Ground markers avoid changing instanced kit materials or district geometry.
export function createSelection(scene) {
  const material = new THREE.MeshBasicMaterial({ color: '#f9e6a4', depthWrite: false, depthTest: false, transparent: true, opacity: .9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.95, 1.12, 48), material);
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 20; ring.visible = false;
  const corners = new THREE.Group(); corners.visible = false;
  const geometry = new THREE.BoxGeometry(1, .025, 1);
  for (let i = 0; i < 8; i++) { const line = new THREE.Mesh(geometry, material); line.renderOrder = 20; corners.add(line); }
  ring.userData.registryExempt=true;corners.traverse(o=>o.userData.registryExempt=true);scene.add(ring, corners);
  let selected = null;
  return {
    select(hit) {
      selected = hit;
      ring.visible = hit?.type === 'person';
      corners.visible = Boolean(hit?.bounds && hit.type !== 'person');
      if (!corners.visible) return;
      const { min, max } = hit.bounds;
      const length = Math.min(2, (max.x - min.x) / 3, (max.z - min.z) / 3);
      let i = 0;
      for (const [x, dx] of [[min.x - .3, 1], [max.x + .3, -1]]) for (const [z, dz] of [[min.z - .3, 1], [max.z + .3, -1]]) {
        const a = corners.children[i++], b = corners.children[i++];
        a.position.set(x + dx * length / 2, .24, z); a.scale.set(length, 1, .12);
        b.position.set(x, .24, z + dz * length / 2); b.scale.set(.12, 1, length);
      }
    },
    update() { if(selected?.type==='traffic'){selected.bounds.setFromObject(selected.object);this.select(selected);} if (ring.visible) { selected.person.object.getWorldPosition(ring.position); ring.position.y += .08; } },
  };
}
