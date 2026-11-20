import * as THREE from 'three';
import { createHy3dBody } from '../hy3d/index.js';
import { DEMO } from './demo-motion.js';
import { createTeslaVehicle } from './models.js';

const SCALE = .49 * DEMO.carScale;

export function buildChargingBay(root, hy3d, { box, label }) {
  const objects = [], instances = [], cars = [];
  const bounds = {};
  const record = (key, object) => {
    object.updateMatrixWorld(true);
    // Called during assembly, with the annex matrix still in its local frame.
    const { min, max } = new THREE.Box3().setFromObject(object, true);
    (bounds[key] ??= []).push({ min: min.toArray(), max: max.toArray() });
  };

  // North apron, between the suction ramp and the eastern grandstand.
  const xMin = -9.6, xMax = 10, zMin = -19.2, zMax = -6.5;
  const paint = '#eae0c5', y = DEMO.ground;
  bounds.bay = [{ min: [xMin, y, zMin], max: [xMax, y, zMax] }];
  box((xMin + xMax) / 2, y + .003, (zMin + zMax) / 2, xMax - xMin, .006, zMax - zMin, '#53676b');
  const chargerXs = [-6.6, -2.2, 2.2, 6.6], chargerZ = -12.4;
  for (let i = 0; i <= chargerXs.length; i++) box(-8.8 + i * 4.4, y + .014, -9.6, .06, .012, 5.2, paint);
  box(0, y + .014, -12.18, 17.6, .012, .06, paint);
  label('SUPERCHARGERS', 0, y + .025, -6.95, 7, .65, { flat: true });

  for (const [kind, x] of [['model-s', -2.2], ['model-x', 2.2]]) {
    const car = createTeslaVehicle(kind, { scale: DEMO.carScale, hy3d });
    car.position.set(x, y, -10.2); car.rotation.y = Math.PI;
    record(kind, car);
    root.add(car); cars.push(car);
  }

  function place(slug, x, z, { yaw = 0, lift = 0 } = {}) {
    const template = hy3d?.get(slug);
    if (!template) return;
    const object = createHy3dBody(template, SCALE);
    object.position.set(x, y + lift, z); object.rotation.y = yaw;
    record(slug, object);
    return object;
  }
  const chargers = chargerXs.map(x => place('supercharger', x, chargerZ)).filter(Boolean);
  if (chargers.length) {
    // One body draw and one hull draw for all four stalls.
    for (const [index, prototype] of chargers[0].children.entries()) {
      const mesh = new THREE.InstancedMesh(prototype.geometry, prototype.material, chargers.length);
      chargers.forEach((charger, i) => mesh.setMatrixAt(i, charger.children[index].matrixWorld));
      mesh.userData.outline = prototype.userData.outline;
      mesh.castShadow = prototype.castShadow; mesh.receiveShadow = prototype.receiveShadow;
      mesh.name = 'Superchargers';
      root.add(mesh); instances.push(mesh);
    }
  }
  const megapack = place('megapack', -4.8, -16.8);
  if (megapack) objects.push(megapack);
  if (hy3d?.has('powerwall')) {
    box(7.7, y + .6, -15.3, 1.3, 1.2, .18, '#a1ada8');
    bounds.wall = [{ min: [7.05, y, -15.39], max: [8.35, y + 1.2, -15.21] }];
    const powerwall = hy3d.get('powerwall');
    objects.push(place('powerwall', 7.7, -15.21 + powerwall.dims.length * SCALE / 2, { lift: .3 }));
  }
  for (const [x, z] of [[9.1, -9.4], [9.5, -8.1]]) {
    const robot = place('optimus', x, z, { yaw: Math.atan2(-x, 1.5 - z) });
    if (robot) objects.push(robot);
  }
  objects.forEach(object => root.add(object));

  return {
    cars, bounds,
    update(night) { cars.forEach(car => car.userData.animate({ night, stage: true })); },
    dispose() {
      cars.forEach(car => car.userData.dispose());
      instances.forEach(mesh => { mesh.dispose(); mesh.removeFromParent(); });
      objects.forEach(object => object.removeFromParent());
    },
  };
}
