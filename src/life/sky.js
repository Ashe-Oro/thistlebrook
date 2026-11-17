import * as THREE from 'three';

// Reuse the town's sky dome: the toon ramp and all geometry stay intact.
export function createSkyLook(scene) {
  const skies = [];
  scene.traverse(o => {
    if (o.material?.uniforms?.top && o.material.uniforms.bottom) skies.push(o.material);
  });
  const top = new THREE.Color(), horizon = new THREE.Color();
  const dayTop = new THREE.Color('#78b9da'), dayHorizon = new THREE.Color('#e0e9d6');
  const duskTop = new THREE.Color('#77608f'), dawnTop = new THREE.Color('#a995bb');
  const duskHorizon = new THREE.Color('#f3ae78'), dawnHorizon = new THREE.Color('#f6c7a5');
  return ({ daylight, twilight, evening }) => {
    top.set('#101d38').lerp(dayTop, daylight)
      .lerp(evening ? duskTop : dawnTop, twilight * .65);
    horizon.set('#334766').lerp(dayHorizon, daylight)
      .lerp(evening ? duskHorizon : dawnHorizon, twilight * .85);
    for (const m of skies) {
      m.uniforms.top.value.copy(top);
      m.uniforms.bottom.value.copy(horizon);
    }
    return horizon;
  };
}
