import * as THREE from 'three';
import { createSkyLook } from './sky.js';
import { updateLightingFog } from './fog.js';
import { LAMP_LOOK } from '../astra/lamp-look.js';

const smooth = THREE.MathUtils.smoothstep;
export function lightingWeights(hour) {
  const elevation = Math.sin((hour - 6) / 24 * Math.PI * 2);
  return {
    elevation,
    daylight: smooth(elevation, -.20, .42),
    twilight: (1 - smooth(Math.abs(elevation), .03, .48)),
    night: 1 - smooth(elevation, -.12, .22),
    evening: hour >= 12,
  };
}

// A wrapper keeps the shared day/night implementation and its window/grass
// ownership intact. Only createLife calls this factory; life-off is untouched.
export function withLightingPolish(createBase) {
  return function createDayNight(stage, town) {
    const base = createBase(stage, town);
    const sky = createSkyLook(stage.scene);
    const hemis = [], ambient = [];
    stage.scene.traverse(o => {
      if (o.isHemisphereLight) hemis.push(o);
      if (o.isAmbientLight) ambient.push(o);
    });
    // Soft ground accents use vertex alpha rather than another light/shadow map.
    const geometry = new THREE.CircleGeometry(2.5, 32);
    const alpha = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) alpha.push(i === 0 ? .42 : 0);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(alpha.flatMap(a => [1, .63, .23, a]), 4));
    const pools = base.lamps.map(({ light }) => {
      const material = new THREE.MeshBasicMaterial({ color: '#ffc780', vertexColors: true, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'life-lamp-pool';
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(light.position.x, .045, light.position.z);
      stage.scene.add(mesh);
      return mesh;
    });
    const state = stage.scene.userData.lightingPolish = {
      hour: 9,
      grade(uniforms, options) {
        if (!options.grade) return;
        const w = lightingWeights(state.hour);
        uniforms.uWarm.value = .012 + w.twilight * w.daylight * .075 - w.night * .028;
        uniforms.uSat.value = 1.08 - w.night * .18;
        uniforms.uContrast.value = 1.07;
        uniforms.uVignette.value = .16 + w.night * .08;
      },
    };
    const moon = new THREE.Color('#9fbaf2'), noon = new THREE.Color('#fff1d4'), gold = new THREE.Color('#ffb166');
    return { ...base, update(hour) {
      base.update(hour);
      state.hour = hour;
      const w = lightingWeights(hour), angle = (hour - 6) / 24 * Math.PI * 2;
      const sun = stage.sun;
      sun.position.set(Math.cos(angle) * 75, 8 + Math.abs(w.elevation) * 74, 12);
      sun.color.copy(moon).lerp(noon, w.daylight).lerp(gold, w.twilight * w.daylight * .9);
      sun.intensity = .27 + w.daylight * 1.45;
      for (const h of hemis) h.intensity = .32 + w.daylight * .36;
      for (const a of ambient) a.intensity = .21 + w.daylight * .20;
      const horizon = sky(w);
      updateLightingFog(stage, horizon, w);
      base.windows.forEach(m => { m.opacity = w.night * .95; });
      base.lamps.forEach(({ light, lens }) => { light.intensity = w.night * LAMP_LOOK.lifeLight; lens.material.opacity = w.night; });
      pools.forEach(p => { p.material.opacity = w.night * LAMP_LOOK.lifePool; });
    } };
  };
}
