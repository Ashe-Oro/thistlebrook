import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCameraHash, writeCameraHash, cameraBounds } from '../src/astra/camera.js';

test('camera links round-trip map coordinates, zoom and quarter-turns; retain unrelated hash state', () => {
  const state = { x: -57.1234, z: -6.125, zoom: 3.75, rotation: 3 };
  const hash = writeCameraHash('#selection=bookshop', state);
  assert.equal(new URLSearchParams(hash.slice(1)).get('selection'), 'bookshop');
  assert.deepEqual(readCameraHash(hash), { ...state, x: -57.123 });
  assert.equal(writeCameraHash(hash, readCameraHash(hash)), hash);
});

test('bad or incomplete links do not put the camera in an invalid state', () => {
  for (const hash of ['', '#hello', '#x=1&y=2', '#x=&y=2&zoom=1', '#x=1&y=NaN&zoom=1', '#x=Infinity&y=2&zoom=1', '#x=1&y=2&zoom=0', '#x=1&y=2&zoom=-1']) assert.equal(readCameraHash(hash), null, hash);
  assert.deepEqual(readCameraHash('#x=-2&y=7&zoom=99&r=-1'), { x: -2, z: 7, zoom: 5, rotation: 3 });
  assert.deepEqual(readCameraHash('#x=-2&y=7&zoom=.01&r=oops'), { x: -2, z: 7, zoom: .12, rotation: 0 });
});

test('new district parcels and navigation nodes extend camera bounds automatically', () => {
  const bounds = cameraBounds({ nodes: [[0, 0], [300, -200]], buildings: [{ box: { min: [-100, -20], max: [-90, -10] } }], venues: [{ box: { min: [0, 0], max: [20, 75] } }] });
  assert.deepEqual(bounds, { minX: -124, maxX: 324, minZ: -224, maxZ: 99 });
});
