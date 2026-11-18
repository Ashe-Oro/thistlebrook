import {TOWN_RULE} from '../src/compiler/town-rules.js';
// OWNER: grok-skins lane (Grok). Skin contract tests (docs/SKINS.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import * as THREE from 'three';
import { SKINS, DEFAULT_SKIN, getSkin, skinFromQuery } from '../src/skins/index.js';
import { LIGHT_KEYS, sampleLightCycle } from '../src/astra/light-cycle.js';
import { lutBlend, lutAtlasData, gradeFn, LUT_SIZE, LUT_MAX } from '../src/astra/skin/lut.js';
import { createSkinRuntime } from '../src/astra/skin/index.js';
import { SKIN_UNIFORMS, applySkinMaterial, patchSkinShader } from '../src/astra/skin/material.js';

const HEX = /^#[0-9a-f]{6}$/i;
const hexes = o => JSON.stringify(o).match(/"#[^"]*"/g)?.map(s => s.slice(1, -1)) || [];

test(`${TOWN_RULE.skins} registry: unique ids, cel first and the default`, () => {
 assert.equal(DEFAULT_SKIN, 'cel'); assert.equal(SKINS[0].id, 'cel');
 assert.equal(new Set(SKINS.map(s => s.id)).size, SKINS.length);
 assert.ok(SKINS.length >= 4);
 for (const s of SKINS) { assert.ok(s.label && s.swatch.length === 3); for (const h of hexes(s)) assert.match(h, HEX, `${s.id}: ${h}`); }
});

test('default skin is all-null so the original path runs untouched', () => {
 const cel = getSkin('cel');
 for (const k of ['keys', 'shade', 'material', 'practicals', 'post']) assert.equal(cel[k], null, k);
 assert.deepEqual(cel.halos, { visible: true, color: null });
});

test('?skin= picks a skin, ?look=v2 aliases neon, unknown falls back to cel', () => {
 assert.equal(skinFromQuery(new URLSearchParams('')), 'cel');
 assert.equal(skinFromQuery(new URLSearchParams('skin=winter')), 'winter');
 assert.equal(skinFromQuery(new URLSearchParams('skin=cyberpunk')), 'neon');
 assert.equal(skinFromQuery(new URLSearchParams('look=v2')), 'neon');
 assert.equal(skinFromQuery(new URLSearchParams('skin=nope')), 'cel');
});

test('light keys of every skin share the light-cycle layout and wrap at midnight', () => {
 for (const s of SKINS.filter(s => s.keys)) {
  assert.equal(s.keys[0][0], 0); assert.equal(s.keys.at(-1)[0], 24);
  for (const k of s.keys) { assert.equal(k.length, LIGHT_KEYS[0].length, s.id); for (const c of k.slice(1, 7)) assert.match(c, HEX); }
  for (let i = 1; i < s.keys.length; i++) assert.ok(s.keys[i][0] > s.keys[i - 1][0], s.id);
  assert.deepEqual(s.keys.at(-1).slice(1), s.keys[0].slice(1), `${s.id} midnight wraps`);
  assert.equal(sampleLightCycle(22, s.keys).from[9], 1, `${s.id} night practicals on`);
 }
});

test('material and post blocks are complete and in range', () => {
 for (const s of SKINS.filter(s => s.material)) {
  const m = s.material;
  for (const k of ['ramp', 'chroma', 'tint', 'wrap', 'side', 'windows']) assert.ok(m[k], `${s.id}.material.${k}`);
  assert.ok(m.chroma.every(v => v >= 0 && v <= 1)); assert.ok(m.wrap.lo < m.wrap.hi);
  assert.equal(m.windows.colors.length, 3);
 }
 for (const s of SKINS.filter(s => s.post)) {
  const p = s.post;
  assert.ok(p.tilt.max <= 1 && p.tilt.band > 0 && p.grain < .02 && p.vignette < .6, s.id);
  const names = Object.keys(p.lut.grades);
  assert.ok(names.length >= 1 && names.length <= LUT_MAX, s.id);
  for (const [, n] of p.lut.schedule) assert.ok(names.includes(n), `${s.id} schedule uses ${n}`);
  assert.equal(p.lut.schedule[0][0], 0); assert.equal(p.lut.schedule.at(-1)[0], 24);
  for (let h = 0; h < 24; h += .25) { const b = lutBlend(p.lut, h); assert.ok(b.a >= 0 && b.b >= 0 && b.t >= 0 && b.t <= 1, `${s.id} ${h}`); }
 }
});

test('neon skin keeps the look v2 numbers (dd9fda7)', () => {
 const n = getSkin('neon');
 assert.equal(n.practicals.bulbs[0], '#ff2fa8'); assert.equal(n.material.windows.colors[0], '#20e6ff');
 assert.deepEqual(n.post.tilt, { focusY: .47, band: .16, soft: .32, max: .68 });
 assert.equal(n.post.reflections.gain, 2.6); assert.equal(n.halos.visible, false);
 const b = lutBlend(n.post.lut, 18.5); assert.ok(b.a === 2 && b.b === 3 && b.t > 0 && b.t < 1);
});

test('LUT atlas is generated (no download) and neutral grades stay neutral', () => {
 for (const s of SKINS.filter(s => s.post)) {
  const { data, names } = lutAtlasData(s.post.lut);
  assert.equal(data.length, LUT_SIZE ** 3 * 4 * LUT_MAX); assert.equal(names.length, Object.keys(s.post.lut.grades).length);
 }
 const id = gradeFn({ sat: 1, contrast: 1, shadow: '#000000', shadowAmt: 0, high: '#ffffff', highAmt: 0 });
 const o = id(.3, .5, .7); [.3, .5, .7].forEach((v, i) => assert.ok(Math.abs(o[i] - v) < 1e-6));
});

test(`${TOWN_RULE.skins} skins are tiny data (< 8 KB each, no assets)`, () => {
 for (const s of SKINS) {
  const bytes = statSync(new URL(`../src/skins/${s.id}.js`, import.meta.url)).size;
  assert.ok(bytes < 8192, `${s.id} is ${bytes} B`);
  assert.doesNotMatch(readFileSync(new URL(`../src/skins/${s.id}.js`, import.meta.url), 'utf8'), /\.(png|jpe?g|glb|ktx2|webp|mp3)\b|fetch\(|import\(/);
 }
});

test('styled shader patch injects every hook it needs', () => {
 const frag = THREE.ShaderLib.toon.fragmentShader, vert = THREE.ShaderLib.toon.vertexShader;
 const shader = { uniforms: {}, vertexShader: vert, fragmentShader: 'uniform vec3 uAstraShade;\n' + frag };
 patchSkinShader(shader, { foliage: true });
 assert.match(shader.fragmentShader, /skinWindow/); assert.match(shader.fragmentShader, /uSkinWrap\.w/);
 assert.match(shader.fragmentShader, /gl_FragColor\.a = 1\. - skinWetMask/);
 assert.match(shader.vertexShader, /vSkinW = /);
 for (const k of Object.keys(SKIN_UNIFORMS)) assert.ok(shader.uniforms[k], k);
 applySkinMaterial(getSkin('winter').material); assert.ok(SKIN_UNIFORMS.uSkinSnow.value.x > .5);
 applySkinMaterial(getSkin('neon').material); assert.equal(SKIN_UNIFORMS.uSkinSnow.value.x, 0);
});

// A tiny world with one of each practical, rendered through a stub renderer.
function fixture() {
 const scene = new THREE.Scene();
 const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .8, .4) });
 const bulb = new THREE.Mesh(new THREE.SphereGeometry(.2), bulbMat); bulb.position.set(3, 2, 1);
 const signMat = new THREE.MeshBasicMaterial({ map: new THREE.Texture(), color: new THREE.Color(.9, .9, .9) });
 const sign = new THREE.Mesh(new THREE.PlaneGeometry(1, .4), signMat);
 const poolMat = new THREE.MeshBasicMaterial({ map: new THREE.Texture(), transparent: true });
 const pool = new THREE.Mesh(new THREE.CircleGeometry(2), poolMat);
 const building = new THREE.Group(); building.position.set(10, 0, 4);
 const hullGeo = new THREE.BoxGeometry(2, 2, 2);
 const hullMat = new THREE.ShaderMaterial({ uniforms: { uInk: { value: new THREE.Color() } }, vertexShader: 'void main() { gl_Position = vec4(0.); }', fragmentShader: 'uniform vec3 uInk; void main() { gl_FragColor = vec4(uInk, 1.0); }' });
 const outline = new THREE.Mesh(hullGeo, hullMat); outline.userData.outline = true; building.add(outline);
 const hulls = new THREE.InstancedMesh(hullGeo, hullMat, 1);
 scene.add(bulb, sign, pool, building, hulls); scene.updateMatrixWorld(true);
 const world = { selectables: [{ type: 'building', object: building, bounds: new THREE.Box3().setFromObject(building) }] };
 const calls = [];
 const renderer = { render: (s, c) => calls.push(s === scene ? 'scene' : 'post'), setRenderTarget() {}, getPixelRatio: () => 1, getSize: v => v.set(64, 40) };
 const lit = []; const lighting = { setSkin: s => lit.push(s.id) };
 const camera = new THREE.OrthographicCamera();
 return { scene, world, renderer, lighting, camera, calls, lit, bulb, bulbMat, signMat, pool, poolMat, hulls, hullMat };
}

test(`${TOWN_RULE.skins} live switching restores every practical exactly and the default skips post`, () => {
 const f = fixture();
 const rt = createSkinRuntime({ ...f, initial: 'cel' });
 rt.render(0, 0, 11); assert.deepEqual(f.calls, ['scene']);
 const before = f.signMat.color.clone();
 for (const id of ['neon', 'autumn', 'winter', 'neon']) {
  rt.setSkin(id); f.calls.length = 0; rt.render(1, 0, 22);
  assert.equal(f.calls[0], 'scene'); assert.equal(f.calls.length, getSkin(id).post ? 6 : 1, id);
 }
 assert.notEqual(f.bulb.material, f.bulbMat); assert.notEqual(f.hulls.material, f.hullMat); assert.notEqual(f.pool.material, f.poolMat);
 assert.ok(!f.signMat.color.equals(before));
 const pools = f.scene.getObjectByName('skin • spill pools'); assert.ok(pools.visible);
 rt.setSkin('cel'); f.calls.length = 0; rt.render(1, 0, 22);
 assert.deepEqual(f.calls, ['scene']);
 assert.equal(f.bulb.material, f.bulbMat); assert.equal(f.hulls.material, f.hullMat); assert.equal(f.pool.material, f.poolMat);
 assert.ok(f.signMat.color.equals(before)); assert.equal(pools.visible, false);
 assert.deepEqual(f.lit, ['cel', 'neon', 'autumn', 'winter', 'neon', 'cel']);
 assert.equal(rt.next().id, 'neon'); assert.equal(rt.next(-1).id, 'cel');
});

test('main renders through the skin runtime; default path is renderer.render', () => {
 const main = readFileSync(new URL('../src/astra/main.js', import.meta.url), 'utf8');
 assert.match(main, /createSkinRuntime\(/); assert.match(main, /if\(render\)skins\.render\(night,elapsed,hour\);/);
 assert.match(main, /mountSkinPicker\(ui\.root,skins\)/); assert.match(main, /setSkin:id=>skins\.setSkin\(id\)\.id/);
 const rt = readFileSync(new URL('../src/astra/skin/index.js', import.meta.url), 'utf8');
 assert.match(rt, /if \(P\) post\.render\(scene, camera, \{ night, time, hour \}\);\n  else renderer\.render\(scene, camera\);/);
 const lighting = readFileSync(new URL('../src/astra/lighting.js', import.meta.url), 'utf8');
 assert.match(lighting, /astra-light-v1\$\{styled \? '\|skin-styled' : ''\}/);
});
