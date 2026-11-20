// Night landmarks (docs/specs/NIGHT-LANDMARKS.md, TOWN-28): Starbase Texas and
// the Roadster proving ground light up after dark. Tower floods and sky beams,
// a glowing tank farm, red aviation beacons, lit hulls, pads, LZ rings and an
// apron necklace at Starbase; stadium masts and cones, grandstand and sign
// light, LED track edges and bright head / tail lamps with beams at the arena.
// Fixtures follow the existing night factor (LIGHT_KEYS[9], as setLampNight):
// off by day, fading in through golden hour, fully on at dusk and moonlight.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import {sampleLightCycle} from '../src/astra/light-cycle.js';
import {starbaseFixtures, arenaFixtures, landmarkFixtures, REQUIRED_KINDS, ARENA_MASTS, CAR_LAMPS, PERIMETER_KEEP_OUT, LANDMARK_LOOK, STARBASE_SITE, beaconLevel} from '../src/astra/night-landmarks.js';
import {buildStarbaseLights} from '../src/astra/starbase-lights.js';
import {glowLevel, landmarkMaterials, landmarkState} from '../src/astra/landmark-glow.js';
import {createTeslaVehicle} from '../src/astra/tesla/models.js';
import {createTeslaTown} from '../src/astra/tesla/index.js';
import {DEMO, LINEUP} from '../src/astra/tesla/demo-motion.js';
import {compileAstra} from '../src/compiler/astra.js';
import {resolveAll} from '../src/catalog/resolve-all.js';

const town = compileAstra(resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url)))), 831);
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const nightAt = (hour) => { const s = sampleLightCycle(hour); return s.from[9] + (s.to[9] - s.from[9]) * s.blend; };
const FOLLOW = ['ship', 'booster', 'f9', 'upper', 'side0', 'side1', 'strongback'];
const starbase = () => buildStarbaseLights(new THREE.Group(), {follow: Object.fromEntries(FOLLOW.map((k) => [k, new THREE.Object3D()]))});
const glowMeshes = (lights) => lights.glow.meshList;
const by = (list, kind) => list.filter((f) => f.kind === kind);
const roles = (list, kind) => new Set(by(list, kind).map((f) => f.role));
const prims = (list, kind) => new Set(by(list, kind).map((f) => f.prim));

test('every required fixture kind is present at both sites, with a sensible count', () => {
  for (const [site, list] of [['starbase', starbaseFixtures()], ['arena', arenaFixtures()]]) {
    for (const [kind, min] of Object.entries(REQUIRED_KINDS[site])) assert(by(list, kind).length >= min, `${site} ${kind}: ${by(list, kind).length} < ${min}`);
    for (const f of list) {
      assert.equal(f.site, site);
      for (const k of ['pos', 'a', 'b', 'aim', 'dir']) if (f[k]) assert(f[k].length === 3 && f[k].every(Number.isFinite), `${f.key} ${k}`);
    }
  }
  const all = landmarkFixtures();
  assert.equal(new Set(all.map((f) => f.key)).size, all.length, 'fixture keys are unique');
  // Starbase: floods on the top platform and a mid deck, each with a visible cone.
  const sb = starbaseFixtures();
  for (const r of ['top-platform', 'mid-deck']) assert(by(sb, 'tower-flood').some((f) => f.role === r && f.prim === 'cone'), `flood cone on ${r}`);
  const beams = sb.filter((f) => f.prim === 'beam');
  assert(beams.length >= 2 && beams.length <= 4, 'two to four sky beams');
  for (const b of beams) {
    const tilt = Math.acos(b.dir[1]) * 180 / Math.PI;
    assert(tilt > 3 && tilt < 16, `sky beam ${b.key} leans ${tilt.toFixed(1)}° off vertical`);
    assert(b.length >= 100 && b.radius <= 6, 'tall and slender');
  }
  assert.equal(by(sb, 'tower-uplight').filter((f) => f.prim === 'cone').length, 4, 'one uplight per lattice column');
  for (const p of ['ring', 'wash', 'card', 'strip']) assert(prims(sb, 'tank-glow').has(p), `tank farm ${p}`);
  assert.equal(by(sb, 'tank-glow').filter((f) => f.role === 'hoop').length, STARBASE_SITE.tanks.length * 2, 'two hoops on all six vertical tanks');
  for (const r of ['tower-cap', 'mid-tower', 'strongback', 'pole', 'rocket', 'garden-rocket']) assert(roles(sb, 'beacon').has(r), `beacon on ${r}`);
  assert.equal(by(sb, 'beacon').filter((f) => f.role === 'pole').length, STARBASE_SITE.poles.length);
  for (const r of ['olp-1', 'lc-2', 'hull']) assert(roles(sb, 'rocket-uplight').has(r), `rocket uplight ${r}`);
  for (const r of ['olp-1', 'lc-2', 'trench-edge']) assert(roles(sb, 'pad-glow').has(r), `pad glow ${r}`);
  assert.equal(by(sb, 'lz-light').filter((f) => f.prim === 'bulb').length, 24, 'all 24 LZ gold orbs light');
  for (const r of ['olp-1', 'lc-2']) assert(by(sb, 'perimeter').filter((f) => f.role === r && f.prim === 'bulb').length >= 8, `${r} necklace`);
  // Arena: masts with cones, grandstand, LEDs, sign and the car lamps.
  const ar = arenaFixtures();
  assert.equal(by(ar, 'mast').length, ARENA_MASTS.length);
  assert(by(ar, 'mast-cone').filter((f) => f.prim === 'cone').length >= 4);
  for (const r of ['seat-rail', 'downlight', 'stand-pool']) assert(roles(ar, 'grandstand').has(r), `grandstand ${r}`);
  for (const r of ['front', 'back']) assert(by(ar, 'sign-glow').some((f) => f.role === r && f.prim === 'card'), `${r} sign backlight`);
  for (const r of ['ramp-edge', 'kerb', 'row-axis', 'takeoff', 'touchdown', 'hover-ring']) assert(roles(ar, 'track-led').has(r), `LED ${r}`);
  for (const v of [...LINEUP.map((l) => l.kind), 'roadster']) {
    assert.equal(by(ar, 'car-head').filter((f) => f.role === v).length, 2, `${v} head lamps`);
    assert.equal(by(ar, 'car-tail').filter((f) => f.role === v).length, 2, `${v} tail lamps`);
    assert(by(ar, 'car-beam').filter((f) => f.role === v && f.prim === 'cone').length === 2, `${v} headlight beams`);
  }
});

test('fixtures sit where they belong and are not lamp posts', () => {
  for (const f of ['astra/night-landmarks.js', 'astra/landmark-glow.js', 'astra/starbase-lights.js', 'astra/tesla/arena-lights.js']) assert(!/from '[./]+lamp-(posts|glow)\.js'/.test(src(f)), `${f} does not register lamp posts`);
  // Apron lights stay off roads, trench, tower, tanks, pipes, poles and labels.
  for (const f of by(starbaseFixtures(), 'perimeter')) {
    const keep = PERIMETER_KEEP_OUT[f.role === 'olp-1' ? 'olp' : 'lc2'];
    assert(!keep.some(([x0, x1, z0, z1]) => f.pos[0] >= x0 && f.pos[0] <= x1 && f.pos[2] >= z0 && f.pos[2] <= z1), `${f.key} on a keep-out`);
  }
  // Masts stand on the verge, outside the kerbs and clear of the grandstand.
  const scene = new THREE.Scene(), tesla = createTeslaTown(scene, town), stand = tesla.arena.grandstandBounds;
  for (const m of ARENA_MASTS) {
    assert(Math.abs(m.x) > 21.65 + .4 && Math.abs(m.x) < 23 && Math.abs(m.z) < 21, `${m.role} outside the side kerb`);
    assert(m.x < stand.min.x - 1 || m.x > stand.max.x + .5 || m.z < stand.min.z - 1 || m.z > stand.max.z + 1, `${m.role} clear of the grandstand`);
  }
  // Grandstand fixtures land on the actual stand.
  for (const f of arenaFixtures().filter((f) => ['grandstand', 'sign-glow'].includes(f.kind))) {
    const p = f.pos || f.a;
    assert(p[0] >= stand.min.x - 1 && p[0] <= stand.max.x + 1 && p[2] >= stand.min.z - 1 && p[2] <= stand.max.z + 1, `${f.key} on the stand`);
  }
  tesla.dispose();
  // Car lamp glows sit on the real lamp meshes of each parked car.
  for (const v of LINEUP) {
    const car = createTeslaVehicle(v.kind, {color: v.color, scale: DEMO.carScale}); car.position.set(v.x, DEMO.ground, v.z); car.updateMatrixWorld(true);
    const lamp = {}; car.traverse((o) => { if (o.userData.lamp) lamp[o.userData.lamp] = new THREE.Box3().setFromObject(o).expandByScalar(.2); });
    for (const [kind, which] of [['car-head', 'head'], ['car-tail', 'tail']])
      for (const f of arenaFixtures().filter((f) => f.kind === kind && f.role === v.kind && f.prim === 'halo'))
        assert(lamp[which].containsPoint(new THREE.Vector3(...f.pos)), `${f.key} on the ${which} lamp of ${v.kind}`);
    car.userData.dispose();
  }
  assert.deepEqual(Object.keys(CAR_LAMPS).sort(), [...LINEUP.map((l) => l.kind), 'roadster'].sort());
});

test('fixtures are off by day, fade in with the night factor, and are on at dusk and night', () => {
  const sb = starbase(), scene = new THREE.Scene(), tesla = createTeslaTown(scene, town);
  const levels = (night, hour) => {
    sb.update(12, night); tesla.update(12, night);
    return [...glowMeshes(sb), ...glowMeshes(tesla.arena.lights)].map((m) => [m.name, glowLevel(m), m.material.visible]);
  };
  assert.equal(nightAt(10.4), 0); assert(nightAt(21) > .99); assert(Math.abs(nightAt(19.3) - .86) < 1e-9);
  for (const [name, level, visible] of levels(nightAt(10.4), 10.4)) { assert(level < 1e-6, `${name} dark by day (${level})`); assert.equal(visible, false, `${name} hidden by day`); }
  const full = levels(nightAt(21), 21);
  for (const [name, level, visible] of full) { assert(visible, `${name} visible at night`); assert(level > .1, `${name} clearly on at night (${level})`); }
  for (const [name, level] of levels(nightAt(19.3), 19.3)) assert(level > .1, `${name} on at dusk (${level})`);
  // Additive glow tracks the factor; solid emitters are fully on past headOn.
  const half = levels(.5, 18.6), mid = levels(.12, 18);
  for (const [i, [name, level]] of half.entries()) if (!/emitters|beacon/.test(name)) assert(level > 1e-3 && level < full[i][1] - 1e-3, `${name} fades (${level} vs ${full[i][1]})`);
  const emitter = (rows) => rows.find(([n]) => /Starbase emitters/.test(n))[1];
  assert(emitter(mid) > 0 && emitter(mid) < 1, 'emitters ramp in below headOn');
  assert.equal(emitter(levels(LANDMARK_LOOK.headOn + .01, 18.5)), 1, 'emitters fully on past headOn');
  assert.equal(emitter(levels(nightAt(6.3), 6.3)), 1, 'still on at the dawn preset');
  // The parked Teslas: bright HDR lamps on stage; braking tint and traffic lamps unchanged.
  tesla.update(12, 1);
  const lampColor = (o, which) => { let c; o.traverse((m) => { if (m.userData.lamp === which) c = m.material.color.clone(); }); return c; };
  for (const car of tesla.arena.lineup) {
    assert(Math.max(...lampColor(car, 'head').toArray()) > 2.5, `${car.userData.kind} headlamps bright at night`);
    assert(lampColor(car, 'tail').r > 1.5, `${car.userData.kind} taillamps bright at night`);
  }
  assert(Math.max(...lampColor(tesla.roadster.object, 'head').toArray()) > 2.5, 'performing Roadster headlamps');
  tesla.update(12, 0);
  for (const car of tesla.arena.lineup) assert(Math.max(...lampColor(car, 'head').toArray()) <= 1, 'day lamps are plain');
  const traffic = createTeslaVehicle('sedan');
  traffic.userData.animate({night: 1}); assert.equal(lampColor(traffic, 'head').getHexString(), 'fffde1', 'traffic Teslas keep their lamp colour');
  traffic.userData.animate({night: 1, braking: true, stage: true});
  const brake = lampColor(traffic, 'tail'), ref = new THREE.Color('#ffb58d');
  assert(Math.abs(brake.g / brake.r - ref.g / ref.r) < 1e-6 && brake.r > 1.5, 'braking keeps its tint, brighter on stage');
  traffic.userData.dispose(); tesla.dispose();
});

test('red aviation beacons blink at night and stay dark by day', () => {
  const sb = starbase(), {beacons, beaconHalos} = sb.glow.meshes;
  assert(beacons.count >= 12 && beaconHalos.count === beacons.count);
  const at = (t, night) => { sb.update(t, night); return [glowLevel(beacons), glowLevel(beaconHalos)]; };
  const flash = at(.3, 1), dark = at(1.2, 1);
  assert(flash[0] > dark[0] * 2 && flash[1] > dark[1] * 2, `beacons pulse: ${flash} vs ${dark}`);
  assert(flash[0] > 1.5, 'saturated, bright red at the peak');
  const c = landmarkMaterials().beacon.color; assert(c.r > 5 * c.g && c.r > 5 * c.b, 'beacons are red');
  for (const t of [.3, 1.2, 7.7]) assert.deepEqual(at(t, 0), [0, 0], `dark by day at ${t}`);
  // A full period samples a real flash, then a dim floor (period 1–2 s).
  const p = LANDMARK_LOOK.beaconPeriod; assert(p >= 1 && p <= 2);
  const samples = Array.from({length: 40}, (_, i) => beaconLevel(i * p / 40, 1));
  assert(Math.max(...samples) > .95 && Math.min(...samples) <= LANDMARK_LOOK.beaconFloor + 1e-9);
  // Blinking pulses materials; it never adds or removes meshes.
  const before = sb.group.children.length; at(.3, 1); at(1.2, 1); assert.equal(sb.group.children.length, before);
});

test('moving fixtures ride their rocket, strongback and Roadster', () => {
  const follow = Object.fromEntries(FOLLOW.map((k) => [k, new THREE.Object3D()])), sb = buildStarbaseLights(new THREE.Group(), {follow});
  const {washes, beacons} = sb.glow.meshes, m = new THREE.Matrix4(), p = new THREE.Vector3(), c = new THREE.Color();
  const find = (mesh, pred) => sb.glow.dynamic.find((d) => d.mesh === mesh && pred(d.f));
  const shipBeacon = find(beacons, (f) => f.follow === 'ship'), shipWash = find(washes, (f) => f.follow === 'ship');
  follow.ship.position.set(20, 21.4, -24); sb.update(5, 1);
  beacons.getMatrixAt(shipBeacon.i, m); p.setFromMatrixPosition(m);
  assert(Math.abs(p.y - (21.4 + STARBASE_SITE.rockets.ship.top + .15)) < 1e-6 && Math.abs(p.x - 20) < 1e-6, 'beacon on the ship nose');
  washes.getColorAt(shipWash.i, c); assert(c.r > .3 && Math.abs(c.r - shipWash.base.r) < 1e-6, 'hull wash full on at the pad');
  follow.ship.position.y = 90; sb.update(6, 1); washes.getColorAt(shipWash.i, c); assert.equal(c.r, 0, 'wash fades as the ship climbs');
  follow.ship.visible = false; sb.update(7, 1); beacons.getMatrixAt(shipBeacon.i, m); assert.equal(new THREE.Vector3().setFromMatrixScale(m).length(), 0, 'hidden with its rocket');
  follow.strongback.position.set(48, .7, 9.5); follow.strongback.rotation.x = -.42; sb.update(8, 1);
  beacons.getMatrixAt(find(beacons, (f) => f.follow === 'strongback').i, m); p.setFromMatrixPosition(m);
  assert(p.y > 16 && p.z < 9.5, 'strongback beacon tilts with the strongback');
  const scene = new THREE.Scene(), tesla = createTeslaTown(scene, town), lights = tesla.arena.lights;
  tesla.update(10, 1); // inverted hold, high on the ramp
  const head = lights.glow.dynamic.find((d) => d.f.kind === 'car-head');
  head.mesh.getMatrixAt(head.i, m); p.setFromMatrixPosition(m);
  assert(p.y > 8 && Math.abs(p.x - (tesla.roadster.object.position.x - DEMO.x)) < 1.5, 'Roadster lamps ride the car up the ramp');
  tesla.dispose();
});

test('performance contract: no real lights, no shadows, a handful of draws', () => {
  const sb = starbase(), scene = new THREE.Scene(), tesla = createTeslaTown(scene, town);
  for (const group of [sb.group, tesla.arena.lights.group]) {
    const lights = [], meshes = [];
    group.traverse((o) => { if (o.isLight) lights.push(o); if (o.isMesh) meshes.push(o); });
    assert.equal(lights.filter((l) => l.isPointLight || l.isSpotLight).length, 0, 'no point or spot lights');
    assert.equal(lights.filter((l) => l.isDirectionalLight).length, 0, 'no extra directional light');
    assert(lights.every((l) => !l.castShadow));
    assert(meshes.length <= 12, `${group.name}: ${meshes.length} draws`);
  }
  for (const m of [...glowMeshes(sb), ...glowMeshes(tesla.arena.lights)]) {
    assert.equal(m.castShadow, false, `${m.name} casts no shadow`);
    assert.equal(m.material.depthWrite, m.material === landmarkMaterials().beacon, `${m.name} depthWrite`);
    if (m.material.uniforms || m.material.vertexColors) assert.equal(m.material.blending, THREE.AdditiveBlending, `${m.name} additive`);
  }
  // Shared materials: both sites draw with the same set.
  const mats = new Set([...glowMeshes(sb), ...glowMeshes(tesla.arena.lights)].map((m) => m.material));
  assert(mats.size <= Object.keys(landmarkMaterials()).length - 1);
  // No new post-process pass or composer.
  for (const f of ['astra/landmark-glow.js', 'astra/starbase-lights.js', 'astra/tesla/arena-lights.js']) assert(!/EffectComposer|WebGLRenderTarget|new THREE\.(PointLight|SpotLight|DirectionalLight)/.test(src(f)), f);
  tesla.dispose();
});

test(`${TOWN_RULE.nightLandmarks} rule hook and wiring`, () => {
  assert.equal(TOWN_RULE.nightLandmarks, 'TOWN-28');
  const rules = readFileSync(new URL('../docs/TOWN-RULES.md', import.meta.url), 'utf8');
  const heading = [...rules.matchAll(/^## (TOWN-\d+) .+\n\n(\d{4}-\d{2}-\d{2})\n\n> (.+)\n\n[\s\S]+?(?=\n## |$)/gm)].find(([, id]) => id === 'TOWN-28');
  assert(heading, 'TOWN-28 heading'); assert.equal(heading[2], '2026-11-19'); assert(heading[0].includes('tests/night-landmarks.test.mjs'));
  // Starbase: lights built after batchStatic, outside the batches, and driven by update's night.
  const sbSrc = src('astra/starbase.js');
  assert(sbSrc.indexOf('batchStatic(statics,root);') < sbSrc.indexOf('buildStarbaseLights(root'), 'lights built after batching');
  assert(/update\(t,night=0,hour=10\)\{[\s\S]*lights\.update\(t,night\)/.test(sbSrc), 'starbase.update drives the landmark night');
  assert(/update\(t, night = 0\) \{ setLandmarkNight\(night, t\)/.test(src('astra/starbase-lights.js')));
  // Arena: lights built after the toon batches, driven from arena.update(time,pose,night).
  const arSrc = src('astra/tesla/arena.js');
  assert(arSrc.indexOf('mergeGeometries(flat)') < arSrc.indexOf('buildArenaLights(root'), 'arena lights after the toon batches');
  assert(/function update\(time,pose,night=0\)\{[\s\S]*lights\.update\(time,pose,night\)/.test(arSrc), 'arena.update drives the landmark night');
  assert(/setLandmarkNight\(night, time\)/.test(src('astra/tesla/arena-lights.js')));
  assert(/tesla\.update\(elapsed,night\)/.test(src('astra/main.js')) && /starbase\.update\(t,night,hour\)/.test(src('astra/expansions.js')), 'the town feeds both sites its night factor');
  // Runtime: the Tesla town's own update switches the arena on and off.
  const scene = new THREE.Scene(), tesla = createTeslaTown(scene, town);
  tesla.update(3, 1); assert.equal(landmarkState().night, 1); assert(glowMeshes(tesla.arena.lights).every((m) => glowLevel(m) > .1));
  tesla.update(3, 0); assert(glowMeshes(tesla.arena.lights).every((m) => glowLevel(m) === 0));
  tesla.dispose();
});
