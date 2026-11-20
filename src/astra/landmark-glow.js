// OWNER: night-landmarks lane. Cheap, batched night glow for the Starbase and
// Roadster arena fixtures (night-landmarks.js). No PointLights or SpotLights:
// everything is additive cones, cards and halos, plus solid emissive lenses,
// strips and rings merged into one draw, plus instanced beacons. Materials are
// module-level and shared by both sites, so one setLandmarkNight(night, t) per
// update path drives every fixture (the streetlights pattern: setLampNight).
//
// Draws per buildLandmarkGlow() call: up to 8 (emitters, cones, beams, cards,
// halos, washes, beacons, beacon halos), whatever the fixture count.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {LANDMARK_LOOK, emitterLevel, beaconFlash, beaconLevel} from './landmark-look.js';

const uniforms = {night: {value: 0}};
const state = {night: 0, glow: 0, emitter: 0, beacon: 0, flash: 0, time: 0};
let shared = null;
const GLOW_KINDS = ['cone', 'beam', 'card', 'halo', 'wash'];

// Additive output, encoded like every other material (lamp-glow.js halos).
const FRAG_OUT = `gl_FragColor=vec4(vColor*a,a);
     #include <colorspace_fragment>`;

function additive(vertexShader, fragmentShader, strength, extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {night: uniforms.night, strength: {value: strength}, ...extra},
    vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    // Visible only at night: no fill cost by day.
    visible: false,
  });
}

// Light cone / sky beam: brightest at the apex, soft at the silhouette.
const CONE_VS = `
  varying vec3 vColor; varying float vAlong, vFace;
  void main(){
   vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);
   vec3 n=normalize(normalMatrix*mat3(instanceMatrix)*normal);
   vec3 v=projectionMatrix[2][3]==0.?vec3(0.,0.,1.):normalize(-mv.xyz);
   vFace=abs(dot(n,v));vAlong=uv.y;
   vColor=vec3(1.);
   #ifdef USE_INSTANCING_COLOR
    vColor=instanceColor;
   #endif
   gl_Position=projectionMatrix*mv;
  }`;
const coneFS = (falloff, core) => `
  uniform float night, strength; varying vec3 vColor; varying float vAlong, vFace;
  void main(){
   float a=pow(vAlong,${falloff.toFixed(2)})*pow(vFace,${core.toFixed(2)})*strength*night;
   ${FRAG_OUT}
  }`;

// Flat radial glow (ground pools, sign backlights).
const CARD_VS = `
  varying vec3 vColor; varying vec2 vUv;
  void main(){
   vUv=uv;vColor=vec3(1.);
   #ifdef USE_INSTANCING_COLOR
    vColor=instanceColor;
   #endif
   gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);
  }`;
const CARD_FS = `
  uniform float night, strength; varying vec3 vColor; varying vec2 vUv;
  void main(){
   float d=min(1.,length(vUv-.5)*2.);
   float a=(1.-smoothstep(.0,1.,d))*(.55+.45*(1.-d))*strength*night;
   ${FRAG_OUT}
  }`;

// Camera-facing halo; the instance scale sets its size.
const HALO_VS = `
  varying vec3 vColor; varying vec2 vUv;
  void main(){
   vUv=uv;vColor=vec3(1.);
   #ifdef USE_INSTANCING_COLOR
    vColor=instanceColor;
   #endif
   float s=length(instanceMatrix[0].xyz)*length(modelMatrix[0].xyz);
   vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy*s;
   gl_Position=projectionMatrix*p;
  }`;
const HALO_FS = `
  uniform float night, strength; varying vec3 vColor; varying vec2 vUv;
  void main(){
   float d=length(vUv-.5)*2.;
   float a=(pow(max(0.,1.-d),2.6)+.5*pow(max(0.,1.-d*2.2),2.))*strength*night;
   ${FRAG_OUT}
  }`;

// Rim-lit open cylinder: a wash brightest at the base and at the silhouette.
const WASH_FS = `
  uniform float night, strength; varying vec3 vColor; varying float vAlong, vFace;
  void main(){
   float rim=pow(1.-vFace,1.6);
   float a=(.18+.82*rim)*mix(.35,1.,pow(1.-vAlong,.8))*strength*night;
   ${FRAG_OUT}
  }`;

function materials() {
  if (shared) return shared;
  const L = LANDMARK_LOOK;
  const cone = additive(CONE_VS, coneFS(1.15, 1.25), L.cone);
  const beam = additive(CONE_VS, coneFS(.55, 1.6), L.beam);
  const card = additive(CARD_VS, CARD_FS, L.card);
  card.polygonOffset = true; card.polygonOffsetFactor = -2; card.polygonOffsetUnits = -2;
  const halo = additive(HALO_VS, HALO_FS, L.halo);
  const wash = additive(CONE_VS, WASH_FS, L.wash);
  const beaconHalo = additive(HALO_VS, HALO_FS, 0);
  beaconHalo.uniforms.night = {value: 1};
  for (const m of [cone, beam, wash]) m.side = THREE.DoubleSide;
  // Solid emitters: one vertex-coloured material (HDR colours bloom on skins).
  const emitter = new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, visible: false});
  // Beacon bulbs stay opaque and saturated; only their colour pulses.
  const beacon = new THREE.MeshBasicMaterial({color: '#ff2a16', visible: false});
  beacon.userData.dim = new THREE.Color('#5c0f0a'); beacon.userData.hot = new THREE.Color('#ff2a16').multiplyScalar(2.2);
  const geometry = {
    cone: new THREE.CylinderGeometry(L.coneApex, 1, 1, 22, 1, true).translate(0, -.5, 0),
    beam: new THREE.CylinderGeometry(L.beamApex, 1, 1, 18, 1, true).translate(0, -.5, 0),
    card: new THREE.PlaneGeometry(1, 1),
    halo: new THREE.PlaneGeometry(1, 1),
    wash: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, .5, 0),
    beacon: new THREE.IcosahedronGeometry(1, 1),
  };
  shared = {cone, beam, card, halo, wash, beacon, beaconHalo, emitter, geometry};
  return shared;
}

/** Shared materials (tests and the skin layer read these). */
export function landmarkMaterials() { return materials(); }

/** Current night state of every landmark fixture (a copy, for tests and audits). */
export function landmarkState() { return {...state}; }

/** Current solid-emitter level 0..1, allocation-free (per-frame callers). */
export function landmarkEmitterLevel() { return state.emitter; }

/** Night factor 0..1 (lighting LIGHT_KEYS[9], as setLampNight) and the town
 * clock in seconds for the beacon flash. Called from starbase / arena update. */
export function setLandmarkNight(night, time = state.time) {
  const m = materials(), n = Math.max(0, Math.min(1, night || 0));
  const e = emitterLevel(n), b = beaconLevel(time, n);
  // Plain field writes: this runs every frame and allocates nothing.
  state.night = state.glow = n; state.emitter = e; state.beacon = b; state.flash = beaconFlash(time); state.time = time;
  uniforms.night.value = n;
  for (const k of GLOW_KINDS) m[k].visible = n > 1e-3;
  m.emitter.opacity = e * LANDMARK_LOOK.emitter; m.emitter.visible = e > 1e-3;
  m.beacon.visible = e > 1e-3;
  m.beacon.color.copy(m.beacon.userData.dim).lerp(m.beacon.userData.hot, e > 0 ? b / e : 0);
  m.beaconHalo.uniforms.strength.value = b * LANDMARK_LOOK.beaconHalo;
  m.beaconHalo.visible = b > 1e-3;
  return state;
}

// ------------------------------------------------------------------ builder
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0), Z = new THREE.Vector3(0, 0, 1);
const v3 = (a) => new THREE.Vector3(...a);
const tint = (f) => new THREE.Color(f.color || '#ffffff').multiplyScalar(f.intensity ?? 1);

/** Local matrix of one fixture's primitive (in its frame, or its follow object's). */
export function fixtureMatrix(f) {
  const q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = v3(f.pos);
  if (f.prim === 'cone') {
    const d = v3(f.aim).sub(p).normalize(), r = f.length * f.spread;
    q.setFromUnitVectors(DOWN, d); s.set(r, f.length, r);
  } else if (f.prim === 'beam') {
    q.setFromUnitVectors(DOWN, v3(f.dir).normalize()); s.set(f.radius, f.length, f.radius);
  } else if (f.prim === 'card') {
    q.setFromUnitVectors(Z, v3(f.normal || [0, 1, 0]).normalize()); s.set(f.size[0], f.size[1], 1);
    // Ground cards: plane x -> world x, plane y -> world -z (size = [x, z]).
  } else if (f.prim === 'halo' || f.prim === 'beacon-halo') s.setScalar(f.size);
  else if (f.prim === 'wash') s.set(f.radius, f.height, f.radius);
  else if (f.prim === 'beacon') s.setScalar(f.radius);
  return new THREE.Matrix4().compose(p, q, s);
}

// One merged geometry for every static solid emitter (lens, bulb, strip, ring).
function emitterGeometry(f) {
  let g;
  if (f.prim === 'bulb') g = new THREE.IcosahedronGeometry(f.radius, 1).translate(...f.pos);
  else if (f.prim === 'lens') {
    g = new THREE.BoxGeometry(...f.size);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Z, v3(f.facing).normalize())).translate(...f.pos);
  } else if (f.prim === 'strip') {
    const a = v3(f.a), b = v3(f.b), d = b.clone().sub(a);
    g = new THREE.BoxGeometry(f.width, d.length(), f.width);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())).translate(...a.add(b).multiplyScalar(.5).toArray());
  } else if (f.prim === 'ring') g = new THREE.TorusGeometry(f.radius, f.tube, 5, Math.max(24, Math.round(f.radius * 18))).rotateX(Math.PI / 2).translate(...f.pos);
  else return null;
  const flat = g.index ? g.toNonIndexed() : g; if (flat !== g) g.dispose();
  for (const k of Object.keys(flat.attributes)) if (k !== 'position') flat.deleteAttribute(k);
  const c = tint(f), n = flat.attributes.position.count, colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return flat;
}

/**
 * Batched glow for `fixtures` (night-landmarks.js entries). `follow` maps the
 * names used by moving fixtures to objects whose `.matrix` is their transform
 * in this glow's parent frame; `update()` re-places those instances.
 */
export function buildLandmarkGlow(fixtures, {name = 'landmarks', follow = {}} = {}) {
  const m = materials(), group = new THREE.Group(), meshes = {}, dynamic = [];
  group.name = `Night landmarks • ${name}`;
  const statics = fixtures.filter((f) => !f.follow), parts = statics.map(emitterGeometry).filter(Boolean);
  if (parts.length) {
    const mesh = new THREE.Mesh(mergeGeometries(parts), m.emitter);
    parts.forEach((p) => p.dispose());
    mesh.name = `${group.name} emitters`; mesh.renderOrder = 4;
    mesh.userData.fixtureKeys = statics.filter((f) => ['bulb', 'lens', 'strip', 'ring'].includes(f.prim)).map((f) => f.key);
    group.add(mesh); meshes.emitters = mesh;
  }
  const batch = (key, prim, geometry, material, list, order) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((f, i) => {
      mesh.setMatrixAt(i, fixtureMatrix({...f, prim}));
      mesh.setColorAt(i, prim === 'beacon' ? new THREE.Color(1, 1, 1) : tint(f));
      if (f.follow) {
        const object = follow[f.follow];
        if (!object) throw Error(`night landmarks: no follow object "${f.follow}" for ${f.key}`);
        dynamic.push({mesh, i, f, object, local: fixtureMatrix({...f, prim}), base: tint(f)});
      }
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    if (dynamic.some((d) => d.mesh === mesh)) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; }
    else mesh.computeBoundingSphere();
    // Billboards and long beams: their bounds are not the unit geometry.
    if (prim === 'halo' || prim === 'beacon-halo' || prim === 'beam') mesh.frustumCulled = false;
    mesh.name = `${group.name} ${key}`; mesh.renderOrder = order; mesh.castShadow = mesh.receiveShadow = false;
    mesh.userData.fixtureKeys = list.map((f) => f.key);
    group.add(mesh); meshes[key] = mesh;
  };
  const of = (prim) => fixtures.filter((f) => f.prim === prim);
  batch('cards', 'card', m.geometry.card, m.card, of('card'), 1);
  batch('washes', 'wash', m.geometry.wash, m.wash, of('wash'), 2);
  batch('cones', 'cone', m.geometry.cone, m.cone, of('cone'), 3);
  batch('beams', 'beam', m.geometry.beam, m.beam, of('beam'), 3);
  batch('beacons', 'beacon', m.geometry.beacon, m.beacon, of('beacon'), 4);
  batch('halos', 'halo', m.geometry.halo, m.halo, of('halo'), 5);
  batch('beaconHalos', 'beacon-halo', m.geometry.halo, m.beaconHalo, of('beacon').map((f) => ({...f, size: f.halo})), 5);
  const mat = new THREE.Matrix4(), col = new THREE.Color(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function update() {
    for (const d of dynamic) {
      const o = d.object;
      if (o.matrixAutoUpdate) o.updateMatrix();
      let k = 1;
      if (d.f.fade) k = Math.max(0, Math.min(1, 1 - Math.max(0, o.position.y - d.f.fade.restY) / d.f.fade.span));
      if (!o.visible || k <= 0) d.mesh.setMatrixAt(d.i, zero);
      else d.mesh.setMatrixAt(d.i, mat.multiplyMatrices(o.matrix, d.local));
      d.mesh.instanceMatrix.needsUpdate = true;
      if (d.f.fade) { d.mesh.setColorAt(d.i, col.copy(d.base).multiplyScalar(k)); d.mesh.instanceColor.needsUpdate = true; }
    }
  }
  update();
  const meshList = Object.values(meshes);
  return {group, meshes, meshList, fixtures, dynamic, update, draws: meshList.length};
}

/** Emitted strength of a landmark mesh right now (0 = dark). For tests and audits. */
export function glowLevel(mesh) {
  const mat = mesh.material;
  if (!mat.visible) return 0;
  if (mat.uniforms?.strength) return mat.uniforms.strength.value * mat.uniforms.night.value;
  if (mat.vertexColors) return mat.opacity;
  const c = mat.color; return Math.max(c.r, c.g, c.b);
}
