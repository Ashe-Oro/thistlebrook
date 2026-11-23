import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMapCamera, readCameraHash, writeCameraHash, STREET_ZOOM_MAX, ZOOM_LIMITS } from '../src/astra/camera.js';
import { terrainY } from '../src/compiler/woods.js';
import { STREET_EYE_HEIGHT, STREET_LOOK_TILT } from '../src/astra/street-camera.js';

const bounds = { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
const mapZoom = ZOOM_LIMITS.max;
const nearStreetZoom = mapZoom * (STREET_ZOOM_MAX / mapZoom) ** .8;
const close = (a, b, tolerance = 1e-8) => assert(Math.abs(a - b) < tolerance, `${a} vs ${b}`);
const wall = { box: { min: [2, -8], max: [4, 8] }, height: 8 };
const rect = { left: 10, top: 20, width: 900, height: 600 };

function fixture(t, { reduced = false, buildings = [], venues = [], groundHeight } = {}) {
  const eventWindow = new EventTarget();
  t.mock.method(globalThis, 'setTimeout', () => null);
  for (const [key, value] of Object.entries({
    matchMedia: () => ({ matches: reduced }),
    location: { hash: '' },
    history: { replaceState() {} },
    window: eventWindow,
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  const captures = new Set();
  const element = Object.assign(new EventTarget(), {
    style: {}, getBoundingClientRect: () => rect, setAttribute() {},
    setPointerCapture: id => captures.add(id), releasePointerCapture: id => captures.delete(id),
    hasPointerCapture: id => captures.has(id),
  });
  const camera = new THREE.OrthographicCamera(-105, 105, 70, -70, .1, 3000);
  const controls = createMapCamera(camera, element, { bounds, town: { buildings, venues }, streetTerrain: () => ({ groundHeight }) });
  t.after(controls.dispose);
  const event = (name, fields, target = element) => target.dispatchEvent(Object.assign(new Event(name), fields));
  const pointer = (action, x, y, pointerType = 'mouse', button = 0, pointerId = 1) =>
    event('pointer' + action, { clientX: x, clientY: y, pointerType, button, pointerId });
  const drag = (from, to, type, button) => {
    pointer('down', ...from, type, button);
    pointer('move', ...to, type, button);
    pointer('up', ...to, type, button);
    controls.update();
  };
  const key = key => {
    const e = new Event('keydown');
    Object.defineProperties(e, { key: { value: key }, target: { value: { closest: () => null } } });
    eventWindow.dispatchEvent(e);
  };
  return { camera, controls, pointer, drag, key, settle: () => { for (let i = 0; i < 120; i++) controls.update(1 / 60); } };
}

test('zoom lowers the camera continuously, reverses to the exact map projection, and exposes a horizon', t => {
  const { camera, controls, settle } = fixture(t);
  const opening = { x: -126, z: -51, zoom: mapZoom, elevation: 58, rotation: 0 };
  controls.view(opening, true);
  const matrix = camera.projectionMatrix.clone();
  const pose = camera.matrixWorld.clone();
  const mark = new THREE.Vector3(-125, 0, -53);
  const onMap = mark.clone().project(camera);
  controls.view({ ...opening, zoom: 15.000001 }, true);
  assert(mark.clone().project(camera).distanceTo(onMap) < .00001);
  controls.view(opening, true);
  controls.zoom(STREET_ZOOM_MAX / mapZoom);
  let prior = camera.position.y;
  for (let i = 0; i < 12; i++) {
    controls.update(1 / 60);
    assert(camera.position.y < prior);
    assert(camera.position.y >= STREET_EYE_HEIGHT);
    prior = camera.position.y;
  }
  settle();
  assert.equal(controls.state().tilt, 1);
  assert.equal(camera.position.y, STREET_EYE_HEIGHT);
  assert(camera.isPerspectiveCamera);
  assert.equal(controls.groundAt(460, 50), null);
  const ground = controls.groundAt(460, 510);
  assert(ground && Math.abs(ground.y) < 1e-9);
  controls.zoom(mapZoom / STREET_ZOOM_MAX);
  controls.update(1 / 60);
  assert(controls.state().tilt > 0 && controls.state().tilt < 1);
  settle();
  assert.deepEqual(controls.state(), opening);
  assert(camera.projectionMatrix.equals(matrix));
  assert(camera.matrixWorld.equals(pose));
});

test('map pose, pointer zoom anchor, right pan and two-finger pan retain their overhead behavior', t => {
  const { camera, controls, drag, pointer, settle } = fixture(t);
  controls.view({ x: -3, z: 4, zoom: 4, rotation: 2 }, true);
  close(camera.position.x, -3 - 800 / Math.sqrt(2));
  close(camera.position.y, 800 / Math.sqrt(2));
  const p = { x: 650, y: 350 };
  const ground = controls.groundAt(p.x, p.y);
  controls.zoom(2, p);
  settle();
  assert(ground.distanceTo(controls.groundAt(p.x, p.y)) < 1e-8);
  const before = controls.state();
  drag([300, 300], [340, 310], 'mouse', 2);
  assert.notEqual(controls.state().x, before.x);
  assert.equal(controls.state().lookYaw, undefined);
  const beforeTouch = controls.state();
  pointer('down', 300, 300, 'touch', 0, 1);
  pointer('down', 500, 300, 'touch', 0, 2);
  pointer('move', 325, 310, 'touch', 0, 1);
  pointer('move', 525, 310, 'touch', 0, 2);
  pointer('up', 325, 310, 'touch', 0, 1);
  pointer('up', 525, 310, 'touch', 0, 2);
  assert.notEqual(controls.state().x, beforeTouch.x);
  close(controls.state().zoom, beforeTouch.zoom);
});

test('mouse and touch walk or look according to gesture, with pinch reserved for tilt', t => {
  const { camera, controls, drag, key, pointer } = fixture(t);
  controls.view({ x: 0, z: 0, zoom: STREET_ZOOM_MAX, lookYaw: 0 }, true);
  drag([400, 300], [400, 350], 'mouse', 0);
  assert(controls.state().z < -1);
  const beforeArrow = controls.state().z;
  key('ArrowUp');
  assert(controls.state().z < beforeArrow);
  drag([400, 300], [400, 350], 'touch', 0);
  assert(controls.state().z < beforeArrow - 2);
  const before = camera.position.clone();
  drag([400, 300], [460, 330], 'mouse', 2);
  assert(camera.position.equals(before));
  assert(controls.state().lookYaw < 0);
  assert(controls.state().lookPitch > 0);
  controls.view({ x: 0, z: 0, zoom: nearStreetZoom, lookYaw: 0 }, true);
  const initial = controls.state();
  assert(initial.tilt > STREET_LOOK_TILT);
  pointer('down', 300, 300, 'touch', 0, 1);
  pointer('down', 500, 300, 'touch', 0, 2);
  pointer('move', 330, 315, 'touch', 0, 1);
  pointer('move', 530, 315, 'touch', 0, 2);
  controls.update();
  const looked = controls.state();
  close(looked.zoom, initial.zoom);
  assert.equal(looked.x, initial.x);
  assert.notEqual(looked.lookYaw, initial.lookYaw);
  assert.notEqual(looked.lookPitch, initial.lookPitch);
  pointer('move', 313, 315, 'touch', 0, 1);
  pointer('move', 547, 315, 'touch', 0, 2);
  controls.update();
  assert(controls.state().zoom > looked.zoom);
  assert.equal(controls.state().lookYaw, looked.lookYaw);
  assert.equal(controls.state().lookPitch, looked.lookPitch);
});

test('eye and look point stay clear of a facade, including landing and swept wall sliding', t => {
  const { camera, controls, drag } = fixture(t, {
    buildings: [wall], venues: [{ box: { min: [3, -6], max: [6, 6] }, height: 6 }],
  });
  controls.view({ x: 3.1, z: 0, zoom: STREET_ZOOM_MAX, lookYaw: Math.PI / 2 }, true);
  assert(camera.position.x < 2);
  assert(controls.lookTarget.x < 2);
  controls.view({ x: 0, z: 0, zoom: STREET_ZOOM_MAX, lookYaw: 0 }, true);
  drag([800, 300], [0, 380], 'mouse', 0);
  assert(camera.position.x > 1 && camera.position.x < 2);
  assert(camera.position.z < -2);
  const before = camera.position.clone();
  drag([400, 300], [400 - Math.PI * 100, -800], 'mouse', 2);
  assert(camera.position.equals(before));
  assert(controls.lookTarget.x < 2);
  assert(controls.lookTarget.y > 0);
  assert(controls.state().lookPitch > -Math.PI / 6);
  assert.equal(camera.position.y, STREET_EYE_HEIGHT);
});

test('street links preserve look pose and reduced-motion jumps across the same zoom range', t => {
  const { controls } = fixture(t, { reduced: true });
  const street = { x: 31, z: -63, zoom: STREET_ZOOM_MAX, rotation: 3, lookYaw: .6, lookPitch: -.3, elevation: 58 };
  const hash = writeCameraHash('#other=1', street);
  const saved = readCameraHash(hash);
  close(saved.lookYaw, street.lookYaw);
  assert.deepEqual({ ...saved, lookYaw: .6 }, street);
  assert.equal(writeCameraHash('#other=1', saved), hash);
  controls.view(saved);
  assert.equal(controls.state().tilt, 1);
  assert.equal(controls.state().eyeHeight, STREET_EYE_HEIGHT);
  controls.zoom(.3);
  assert.equal(controls.state().zoom, 13.5);
  const overhead = writeCameraHash(hash, controls.state());
  assert.equal(overhead, '#other=1&x=31&y=-63&zoom=13.5&r=3&elevation=58');
});

test('raised terrain maintains the street eye clearance above the ridge', t => {
  const { camera, controls, key } = fixture(t, { groundHeight: terrainY });
  controls.view({ x: -158, z: 28, zoom: STREET_ZOOM_MAX, lookYaw: 0 }, true);
  for (let i = 0; i < 4; i++) {
    const { x, y, z } = camera.position;
    const floor = terrainY(x, z);
    assert(floor > 8);
    close(y - floor, STREET_EYE_HEIGHT);
    close(controls.state().eyeHeight, STREET_EYE_HEIGHT);
    key('ArrowUp');
  }
});

test('the inverse projection follows ground picking through tilt and viewport changes', t => {
  const { camera, controls } = fixture(t);
  const x = 600, y = 535;
  for (const zoom of [15, 18, 25, 33, STREET_ZOOM_MAX]) {
    controls.view({ x: 4, z: 3, zoom }, true);
    const hit = controls.groundAt(x, y);
    assert(hit);
    const projected = hit.project(camera);
    close(projected.x, 2 * (x - rect.left) / rect.width - 1);
    close(projected.y, 1 - 2 * (y - rect.top) / rect.height);
  }
  const position = camera.position.clone();
  const width = camera.projectionMatrix.elements[0];
  camera.right *= .5;
  camera.left *= .5;
  controls.resize();
  assert(camera.position.equals(position));
  assert(camera.projectionMatrix.elements[0] > width);
  assert(camera.isPerspectiveCamera);
});
