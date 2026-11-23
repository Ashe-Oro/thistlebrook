import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCameraHash, writeCameraHash, cameraBounds, STREET_ZOOM_MAX, ZOOM_LIMITS } from '../src/astra/camera.js';
import { isTownOpening, mapHalfHeight, townOpening } from '../src/astra/overview.js';

test('camera links round-trip map coordinates, zoom and quarter-turns; retain unrelated hash state', () => {
  const state = { x: -57.1234, z: -6.125, zoom: 3.75, rotation: 3 };
  const hash = writeCameraHash('#selection=bookshop', state);
  assert.equal(new URLSearchParams(hash.slice(1)).get('selection'), 'bookshop');
  assert.deepEqual(readCameraHash(hash), { ...state, x: -57.123 });
  assert.equal(writeCameraHash(hash, readCameraHash(hash)), hash);
});

test('a steeper view can be shared and a standard view clears its elevation', () => {
  const standard = { x: -126, z: -61.5, zoom: 3.7, rotation: 0 };
  const steep = { ...standard, elevation: 58 };
  const hash = writeCameraHash('', steep);
  assert.deepEqual(readCameraHash(hash), steep);
  assert.deepEqual(readCameraHash(writeCameraHash(hash, standard)), standard);
  assert.deepEqual(readCameraHash(hash.replace('58', '90')), standard);
});

test('bad or incomplete links do not put the camera in an invalid state', () => {
  for (const hash of ['', '#hello', '#x=1&y=2', '#x=&y=2&zoom=1', '#x=1&y=NaN&zoom=1', '#x=Infinity&y=2&zoom=1', '#x=1&y=2&zoom=0', '#x=1&y=2&zoom=-1']) assert.equal(readCameraHash(hash), null, hash);
  assert.deepEqual(readCameraHash('#x=-2&y=7&zoom=99&r=-1'), { x: -2, z: 7, zoom: STREET_ZOOM_MAX, rotation: 3 });
  assert.deepEqual(readCameraHash('#x=-2&y=7&zoom=.01&r=oops'), { x: -2, z: 7, zoom: ZOOM_LIMITS.min, rotation: 0 });
  assert.deepEqual(readCameraHash('#x=-2&y=7&zoom=15&yaw=2&pitch=1'), { x: -2, z: 7, zoom: ZOOM_LIMITS.max, rotation: 0 });
});

test('new district parcels and navigation nodes extend camera bounds automatically', () => {
  const bounds = cameraBounds({ nodes: [[0, 0], [300, -200]], buildings: [{ box: { min: [-100, -20], max: [-90, -10] } }], venues: [{ box: { min: [0, 0], max: [20, 75] } }] });
  assert.deepEqual(bounds, { minX: -124, maxX: 324, minZ: -224, maxZ: 99 });
});

test('phone and desktop opening share the market centre and frame it at different scales', () => {
  const town = { districts: [{ id: 'market', center: [1, 3] }] };
  const phone = townOpening(town, 390, 844);
  const desktop = townOpening(town, 1440, 900);
  assert.deepEqual([phone.x, phone.z], [desktop.x, desktop.z]);
  const groundWidth = (view, aspect) => 2 * mapHalfHeight(aspect) * aspect / view.zoom;
  assert(groundWidth(phone, 390 / 844) < groundWidth(desktop, 1440 / 900));
  for (const opening of [phone, desktop]) {
    const saved = readCameraHash(writeCameraHash('', { ...opening, rotation: 0 }));
    assert(isTownOpening(saved, opening), 'reloading the opening keeps its streaming budget');
    assert.deepEqual(readCameraHash('#x=88.74&y=18', opening.zoom), {
      x: 88.74, z: 18, zoom: opening.zoom, rotation: 0,
    });
    assert.equal(readCameraHash('#x=88.74&y=18&zoom=', opening.zoom), null);
  }
});
