// Airfield kit (docs/specs/OPUS-AIRFIELD.md): the box-built Thistlebrook
// Municipal Airport is rebuilt from the owned Airfield pack. Structures sit
// inside the parcel and off the movement areas, apron vehicles never meet a
// runway slot, an aircraft, a building or a parked plane over a full day, and
// the edge lights follow the town's night factor through the landmark glow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {getBounds} from '@gltf-transform/functions';
import draco from 'draco3dgltf';
import {
  STRUCTURES, AIRSIDE, AIRFIELD_MODELS, PARKED_AIRCRAFT, CESSNA_SCALE, RUNWAY, RUNWAY_EDGE_LIGHTS, TAXIWAY_LIGHTS,
  airfieldPath, placedFootprint, footprintBox, structureFootprints, parkedFootprints, airfieldFixtures, AIRFIELD_REQUIRED_KINDS,
} from '../src/astra/airport/airfield-plan.js';
import {apronVehicles, fuelStatus} from '../src/astra/airport/ground-traffic.js';
import {AIRPORT, FLEET, PERIOD, sampleFlight, sampleHelicopter} from '../src/astra/airport/traffic.js';
import {FLEET_MODELS} from '../src/astra/traffic-fleet.js';
import {footprint, footprintsOverlap} from '../src/roads/collisions.js';
import {sampleLightCycle} from '../src/astra/light-cycle.js';
import {buildLandmarkGlow, setLandmarkNight, glowLevel} from '../src/astra/landmark-glow.js';

const src = (f) => readFileSync(new URL(`../src/astra/airport/${f}`, import.meta.url), 'utf8');
const box = (f) => ({c: f.centre, d: [Math.sin(f.yaw), Math.cos(f.yaw)], hl: f.half[1], hw: f.half[0]});
const nightAt = (hour) => { const s = sampleLightCycle(hour); return s.from[9] + (s.to[9] - s.from[9]) * s.blend; };
// Movement areas (airport frame): runway strip, the parallel taxi lane, both
// links, and the stand-to-taxiway corridor every aircraft uses (x >= 94).
const RUNWAY_STRIP = {c: [RUNWAY.x, (RUNWAY.z0 + RUNWAY.z1) / 2], d: [0, 1], hl: (RUNWAY.z1 - RUNWAY.z0) / 2, hw: RUNWAY.half};
const MOVEMENT = [RUNWAY_STRIP, {c: [109, -41], d: [0, 1], hl: 44, hw: 3}, {c: [113, -84], d: [1, 0], hl: 11.5, hw: 3.5}, {c: [117, 2], d: [1, 0], hl: 9.5, hw: 3.5}];
// Aircraft as oriented boxes: fuselage and wing for the airliner, the whole
// Cessna box (span x length) for the club planes, the rotor disc for AIR1.
function aircraftBoxes(t) {
  const out = [];
  for (const spec of FLEET) {
    const s = sampleFlight(spec, t);
    if (s.position.y > 3) continue;
    const d = [Math.sin(s.heading), Math.cos(s.heading)], c = [s.position.x, s.position.z];
    if (spec.kind === 'commercial') {
      out.push({id: spec.id, phase: s.phase, c, d, hl: 7.2, hw: 1.05});
      out.push({id: spec.id, phase: s.phase, c: [c[0] - d[0] * .65, c[1] - d[1] * .65], d, hl: 2.4, hw: 7.8});
    } else out.push({id: spec.id, phase: s.phase, c: [c[0] - d[0] * .26, c[1] - d[1] * .26], d, hl: 2.9, hw: 3.05});
  }
  const h = sampleHelicopter(t);
  if (h.position.y < 3) out.push({id: 'AIR1', c: [h.position.x, h.position.z], d: [0, 1], hl: 4.7, hw: 4.7});
  return out;
}

test('the airport is built from at least six distinct Airfield-pack structures, terminal at <= 1.3', () => {
  const models = new Set(STRUCTURES.map((s) => s.model));
  assert(models.size >= 6, `${models.size} distinct structures`);
  for (const need of ['terminal_fbo', 'control_tower', 'hangar', 'fire_rescue_station', 'fuel_farm', 'flight_club_office', 'apron_canopy'])
    assert(models.has(need), need);
  assert(STRUCTURES.find((s) => s.model === 'terminal_fbo').scale <= 1.3);
  // Terminal, club office and canopy cluster on the public side.
  const at = (id) => STRUCTURES.find((s) => s.id === id).pos;
  for (const id of ['club-office', 'canopy']) assert(Math.hypot(at(id)[0] - at('terminal')[0], at(id)[1] - at('terminal')[1]) < 14, id);
});

test('no box-built buildings remain in the airport renderer', () => {
  const code = src('index.js');
  // Every remaining toon box is a surface, marking, kerb, planter or post: none stands taller than 2 units.
  const calls = [...code.matchAll(/\bbox\(([-\d.+*a-zA-Z]+),([-\d.]+),([-\d.+*a-zA-Z]+),([-\d.a-zA-Z]+),([-\d.]+),/g)];
  assert(calls.length > 10);
  for (const [, , y, , , h] of calls) if (+y >= 0) assert(+h <= 2, `box of height ${h}`);
  assert(!/radar|ASTRA MUNICIPAL|CLOVER FLYING CLUB/.test(code), 'old box terminal / tower / hangar dressing');
  assert(/makeCessna/.test(code) && /light_aircraft_cessna/.test(src('aircraft.js')), 'club planes use the pack Cessna');
});

test('pack GLB bounds match the plan', {skip: !existsSync(new URL('../public/' + airfieldPath('hangar'), import.meta.url).pathname) && 'licensed models not on this machine'}, async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder': await draco.createDecoderModule()});
  for (const [model, {min, max}] of Object.entries(AIRFIELD_MODELS)) {
    const b = getBounds((await io.read(new URL('../public/' + airfieldPath(model), import.meta.url).pathname)).getRoot().listScenes()[0]);
    for (let k = 0; k < 3; k++) assert(Math.abs(b.min[k] - min[k]) < .02 && Math.abs(b.max[k] - max[k]) < .02, `${model} axis ${k}`);
  }
});

test('structures stay inside the parcel, apart, and off every movement area', () => {
  const {minX, maxX} = AIRPORT.bounds, minZ = -113, maxZ = 14;
  const placed = [...structureFootprints(), ...parkedFootprints(), ...AIRSIDE.map((a) => ({id: a.id, ...placedFootprint(a)}))];
  for (const f of placed) {
    const [x0, x1, z0, z1] = footprintBox(f);
    assert(x0 > minX && x1 < maxX && z0 > minZ && z1 < maxZ, `${f.id} outside the parcel`);
    for (const m of MOVEMENT) assert(!footprintsOverlap(box(f), m), `${f.id} on a movement area`);
  }
  const big = [...structureFootprints(), ...parkedFootprints()];
  for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) {
    if (big[i].id === 'canopy' && big[j].id === 'terminal' || big[j].id === 'canopy' && big[i].id === 'terminal') continue;
    assert(!footprintsOverlap(box(big[i]), box(big[j])), `${big[i].id} overlaps ${big[j].id}`);
  }
  // Helipad (17 x 17 at 80,-102) stays clear for AIR1.
  for (const f of placed) assert(!footprintsOverlap(box(f), {c: [80, -102], d: [0, 1], hl: 8.5, hw: 8.5}), `${f.id} on the helipad`);
});

test('aircraft never touch a building or a parked plane over a full timetable', () => {
  const fixed = [...structureFootprints(), ...parkedFootprints()];
  for (let t = 0; t < PERIOD; t += .25) for (const a of aircraftBoxes(t)) for (const f of fixed)
    assert(!footprintsOverlap(a, box(f)), `${a.id} (${a.phase}) hits ${f.id} at ${t}`);
});

test('apron vehicles never use the runway, meet an aircraft, a building or each other over 24 h (seed 831)', () => {
  const kinds = new Set(apronVehicles(0).map((v) => v.model));
  assert(kinds.size >= 4 && [...kinds].every((m) => FLEET_MODELS[m]?.pack === 'airfield'), 'four Airfield pack vehicle models');
  const fixed = [...structureFootprints(), ...parkedFootprints()].map(box);
  const statuses = new Set();
  // 24 town hours at 90 s each, sampled every quarter second.
  for (let t = 0; t <= 24 * 90; t += .25) {
    const atStand = sampleFlight(FLEET[0], t).phase === 'At stand';
    const vehicles = apronVehicles(t).filter((v) => !v.stand || atStand).map((v) => ({v, f: footprint(v)}));
    const reserved = FLEET.some((spec) => sampleFlight(spec, t).runway);
    const planes = aircraftBoxes(t);
    statuses.add(fuelStatus(t));
    for (const [i, {v, f}] of vehicles.entries()) {
      assert(!footprintsOverlap(f, RUNWAY_STRIP, 1), `${v.id} on the runway${reserved ? ' during a reserved slot' : ''} at ${t}`);
      for (const m of MOVEMENT) assert(!footprintsOverlap(f, m), `${v.id} on a movement area at ${t}`);
      for (const p of planes) assert(!footprintsOverlap(f, p, .3), `${v.id} meets ${p.id} (${p.phase}) at ${t}`);
      for (const b of fixed) assert(!footprintsOverlap(f, b, .2), `${v.id} hits a structure at ${t}`);
      for (const {v: w, f: g} of vehicles.slice(i + 1)) if (!(v.id === 'apron-tug' && w.id === 'apron-carts')) assert(!footprintsOverlap(f, g), `${v.id} meets ${w.id} at ${t}`);
    }
  }
  assert.deepEqual([...statuses].sort(), ['Driving', 'Filling at the fuel farm', 'Refuelling G-THBK']);
});

test('edge, taxiway and PAPI lights are on 19:00-06:00 and off at noon', () => {
  const fixtures = airfieldFixtures(), by = (k) => fixtures.filter((f) => f.kind === k);
  for (const [kind, min] of Object.entries(AIRFIELD_REQUIRED_KINDS)) assert(by(kind).length >= min, `${kind}: ${by(kind).length}`);
  assert.equal(by('runway-edge').length, RUNWAY_EDGE_LIGHTS.length);
  assert.equal(by('taxiway-edge').length, TAXIWAY_LIGHTS.length);
  for (const f of fixtures) for (const k of ['pos', 'aim', 'dir']) if (f[k]) assert(f[k].length === 3 && f[k].every(Number.isFinite), f.key);
  // Lights sit on the edges, never on the runway or taxiway surface.
  for (const {pos: [x]} of RUNWAY_EDGE_LIGHTS) assert(Math.abs(x - RUNWAY.x) > RUNWAY.half);
  const beaconHead = new THREE.Object3D();
  const glow = buildLandmarkGlow(fixtures, {name: 'Airfield', follow: {beaconHead}});
  const halos = glow.meshes.halos, emitters = glow.meshes.beacons;
  assert(halos && emitters, 'halo and beacon batches');
  assert(glow.draws <= 8, `${glow.draws} draws`);
  for (const hour of [19, 19.5, 20, 21.5, 23, 0, 2, 4, 5, 6]) {
    setLandmarkNight(nightAt(hour), 0);
    assert(glowLevel(halos) > 0, `lights off at ${hour}`);
  }
  for (const hour of [10.4, 12, 14]) { setLandmarkNight(nightAt(hour), 0); assert.equal(glowLevel(halos), 0, `lights on at ${hour}`); }
  assert(!/PointLight|SpotLight/.test(src('index.js') + src('airfield-plan.js')), 'no new scene lights');
});
