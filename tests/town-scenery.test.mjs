import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import autumn from '../src/skins/autumn.js';
import winter from '../src/skins/winter.js';
import neon from '../src/skins/neon.js';
import {sideContribution, yawViewMatrix} from '../src/astra/skin/winter-look.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test(`${TOWN_RULE.scenery}: autumn and winter side lights are world-locked`, () => {
  assert.equal(autumn.material.side.space, 'world');
  assert.equal(winter.material.side.space, 'world');
  assert.notEqual(neon.material.side.space, 'world');
});

test(`${TOWN_RULE.scenery}: the shader uses world normals when the skin or the mesh is locked`, () => {
  const src = read('src/astra/skin/material.js');
  assert.match(src, /uSkinSideSpace/);
  assert.match(src, /uSkinScenery/);
  assert.match(src, /sideSpace = max\(uSkinSideSpace, uSkinScenery\)/);
  assert.match(src, /sideAxis = mix\(nN\.x, nW\.x, sideSpace\)/);
  const lighting = read('src/astra/lighting.js');
  assert.match(lighting, /scenery: !!material\.userData\.scenery|scenery = !!material\.userData\.scenery/);
});

test(`${TOWN_RULE.scenery}: backdrop hills, landscape mountains and theme-park peaks are tagged scenery`, () => {
  for (const [file, hint] of [
    ['src/builders.js', 'makeHills'],
    ['src/astra/landscape.js', 'plan.hills'],
    ['src/astra/themepark.js', 'PARK_MOUNTAINS'],
  ]) {
    const src = read(file);
    assert.match(src, /userData\.scenery/, `${file} (${hint}) tags scenery`);
  }
});

test(`${TOWN_RULE.scenery}: a world-locked side light stays put across three camera yaws`, () => {
  const normal = [0.72, 0.28, 0.63];
  const world = [0, Math.PI / 2, Math.PI].map((yaw) => sideContribution(normal, yawViewMatrix(yaw), {space: 'world'}));
  assert(world.every((v) => Math.abs(v - world[0]) < 1e-9), `world-locked drifted: ${world}`);
  const view = [0, Math.PI / 2, Math.PI].map((yaw) => sideContribution(normal, yawViewMatrix(yaw), {space: 'view'}));
  assert(Math.max(...view) - Math.min(...view) > 0.3, `view-space should shift, got ${view}`);
});
