// OWNER: railway-loop lane. Renders the Thistlebrook Loop Line from the pure
// plan (src/compiler/railway.js) and timetable (src/astra/railway-plan.js):
// merged ballast and rails, instanced sleepers, platforms and their dressing,
// tunnel portals, gated level crossings, the steam set and its travellers.
// Railway pack models (private ThreeJS Assets licence) load at runtime from the
// local licensed mapping and are never copied into source or build output.
import * as THREE from 'three';
import {createGLTFLoader} from '../gltf-loader.js';
import {RAMP, outlineMaterial, toonMaterial, toonVertexColorMaterial} from '../toon.js';
import {hullFor} from './themepark-assets.js';
import {RAIL, railPose, crossingAt} from '../compiler/railway.js';
import {createRailwayService} from './railway-plan.js';
import {bridgeDeck} from '../compiler/water.js';
import {pedestrianGraph} from '../roads/pedestrian.js';
import {place} from '../catalog/loader.js';
import {TOWNSFOLK} from '../catalog/townsfolk.js';

const BASE = import.meta.env?.BASE_URL ?? '/';
// Literal paths so tools/prepare-deploy-dist.mjs ships exactly these models.
export const RAILWAY_MODELS = Object.freeze({
  steam_locomotive: 'licensed/railway/steam_locomotive.glb',
  loco_tender: 'licensed/railway/loco_tender.glb',
  passenger_coach: 'licensed/railway/passenger_coach.glb',
  guards_coach: 'licensed/railway/guards_coach.glb',
  mail_coach: 'licensed/railway/mail_coach.glb',
  freight_van: 'licensed/railway/freight_van.glb',
  open_coal_wagon: 'licensed/railway/open_coal_wagon.glb',
  container_flat_wagon: 'licensed/railway/container_flat_wagon.glb',
  platform_edge_module: 'licensed/railway/platform_edge_module.glb',
  platform_ramp_end: 'licensed/railway/platform_ramp_end.glb',
  station_nameboard: 'licensed/railway/station_nameboard.glb',
  platform_gas_lamp: 'licensed/railway/platform_gas_lamp.glb',
  waiting_shelter: 'licensed/railway/waiting_shelter.glb',
  platform_bench: 'licensed/railway/platform_bench.glb',
  ticket_machine: 'licensed/railway/ticket_machine.glb',
  station_clock: 'licensed/railway/station_clock.glb',
});
const BALLAST_TOP = .12, SLEEPER_TOP = .2, RAIL_TOP = .31, OUTLINE = .03;

export const railNight = {value: 0};
let material = null;
function railMaterial() {
  if (material) return material;
  material = new THREE.MeshToonMaterial({color: 0xffffff, vertexColors: true, gradientMap: RAMP});
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRailNight = railNight;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 glow;\nvarying vec3 vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRailNight;\nvarying vec3 vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * uRailNight;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vGlow * .45, uRailNight * step(.01, vGlow.r) * .5);');
  };
  material.customProgramCacheKey = () => 'thistlebrook-railway';
  return material;
}
// Lamp glass and coach / cab windows glow after dusk.
const GLOWS = [['#ffe6a0', [1, .8, .42], 1.8], ['#a8ccd8', [1, .74, .38], .7], ['#5c8494', [.9, .62, .3], .45]].map(([hex, rgb, k]) => ({c: new THREE.Color(hex), rgb, k}));
function addGlow(g) {
  const col = g.attributes.color, n = g.attributes.position.count, glow = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) { c.setRGB(col.getX(i), col.getY(i), col.getZ(i)); for (const q of GLOWS) if (Math.abs(c.r - q.c.r) + Math.abs(c.g - q.c.g) + Math.abs(c.b - q.c.b) < .04) { glow[i * 3] = q.rgb[0] * q.k; glow[i * 3 + 1] = q.rgb[1] * q.k; glow[i * 3 + 2] = q.rgb[2] * q.k; break; } }
  g.setAttribute('glow', new THREE.BufferAttribute(glow, 3));
  return g;
}

let loader = null;
const cache = new Map();
/** One merged geometry (position, normal, colour, glow) per pack model. */
export function loadRailGeometry(name) {
  if (!cache.has(name)) {
    loader ??= createGLTFLoader();
    cache.set(name, loader.loadAsync(BASE + RAILWAY_MODELS[name]).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const parts = [];
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (g.index) g = g.toNonIndexed();
        const n = g.attributes.position.count, out = new THREE.BufferGeometry();
        out.setAttribute('position', g.attributes.position);
        if (!g.attributes.normal) g.computeVertexNormals();
        out.setAttribute('normal', g.attributes.normal);
        const src = g.attributes.color, rgb = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { rgb[i * 3] = src ? src.getX(i) : 1; rgb[i * 3 + 1] = src ? src.getY(i) : 1; rgb[i * 3 + 2] = src ? src.getZ(i) : 1; }
        out.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
        parts.push(out);
      });
      const geometry = merge(parts); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      return addGlow(geometry);
    }));
  }
  return cache.get(name);
}
function merge(parts) {
  if (parts.length === 1) return parts[0];
  const total = parts.reduce((n, p) => n + p.attributes.position.count, 0), out = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'color']) { const a = new Float32Array(total * 3); let o = 0; for (const p of parts) { a.set(p.attributes[key].array, o); o += p.attributes[key].array.length; } out.setAttribute(key, new THREE.BufferAttribute(a, 3)); }
  return out;
}
function inked(mesh, geometry, scale) {
  const edge = mesh.isInstancedMesh ? new THREE.InstancedMesh(hullFor(geometry), outlineMaterial(OUTLINE / scale), mesh.count) : new THREE.Mesh(hullFor(geometry), outlineMaterial(OUTLINE / scale));
  if (mesh.isInstancedMesh) { edge.instanceMatrix = mesh.instanceMatrix; edge.frustumCulled = false; }
  edge.userData.outline = true; edge.castShadow = false; edge.receiveShadow = false;
  mesh.add(edge); return mesh;
}
async function modelMesh(name, scale = 1) {
  const g = await loadRailGeometry(name), m = new THREE.Mesh(g, railMaterial());
  m.scale.setScalar(scale); m.castShadow = true; m.receiveShadow = true; return inked(m, g, scale);
}
/** All placements of one model in one instanced draw (+ one ink draw). */
async function instanced(name, placements, root) {
  if (!placements.length) return null;
  const g = await loadRailGeometry(name), m = new THREE.InstancedMesh(g, railMaterial(), placements.length), o = new THREE.Object3D();
  placements.forEach((p, i) => { o.position.set(p.pos[0], p.y ?? 0, p.pos[1]); o.rotation.set(0, p.yaw ?? 0, 0); o.scale.set(...(p.scale3 ?? [p.scale ?? 1, p.scale ?? 1, p.scale ?? 1])); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.castShadow = true; m.receiveShadow = true; m.name = 'Railway · ' + name; m.frustumCulled = false;
  root.add(inked(m, g, placements[0].scale ?? 1)); return m;
}

/** A ribbon swept along a run of samples: `profile` = [[across, y], ...]. */
function sweep(runs, profile, color, {closed = false} = {}) {
  const pos = [], idx = [];
  for (const run of runs) {
    const base = pos.length / 3;
    for (const q of run) { const left = [-q.d[1], q.d[0]]; for (const [a, y] of profile) pos.push(q.p[0] + left[0] * a, (q.y ?? 0) + y, q.p[1] + left[1] * a); }
    const k = profile.length;
    for (let i = 0; i < run.length - 1; i++) for (let j = 0; j < k - 1 + (closed ? 1 : 0); j++) { const a = base + i * k + j, b = base + i * k + (j + 1) % k, c = a + k, d = b + k; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, toonMaterial(color)); m.receiveShadow = true; m.castShadow = false; return m;
}
function runsOf(samples, keep) {
  const runs = []; let run = null;
  for (let i = 0; i <= samples.length; i++) { const q = samples[i % samples.length], ok = keep(q); if (ok) { if (!run) { run = []; runs.push(run); } run.push(q); } else run = null; if (i === samples.length && run && runs.length > 1 && keep(samples[0])) { runs[0] = [...run, ...runs[0]]; runs.pop(); } }
  return runs;
}

// Name plates for the running-in boards (canvas text, unlit like painted enamel).
function namePlate(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = '#f2ede0'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#23302b'; x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 52, 480);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshBasicMaterial({map: t});
}

/** Procedural lifting barrier: post, striped boom (pivot at the post), twin lamps. */
function barrier(length) {
  const g = new THREE.Group(), post = new THREE.Mesh(new THREE.BoxGeometry(.22, 1.2, .22), toonMaterial('#e9e4d6')); post.position.y = .6; g.add(post);
  const boom = new THREE.Group(); boom.position.y = 1.05; g.add(boom);
  // One striped boom mesh (vertex colours) instead of a mesh per stripe.
  const n = Math.max(3, Math.round(length / .6)), parts = [], red = new THREE.Color('#c8402f'), white = new THREE.Color('#f4efe4');
  for (let i = 0; i < n; i++) { const b = new THREE.BoxGeometry(length / n, .11, .09).toNonIndexed(); b.translate((i + .5) * length / n + .1, 0, 0); const c = i % 2 ? white : red, col = new Float32Array(b.attributes.position.count * 3); for (let k = 0; k < col.length; k += 3) { col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; } b.setAttribute('color', new THREE.BufferAttribute(col, 3)); b.deleteAttribute('uv'); parts.push(b); }
  boom.add(new THREE.Mesh(merge(parts), toonVertexColorMaterial()));
  const lamps = [];
  for (const dx of [-.14, .14]) { const l = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({color: '#4a1b16'})); l.position.set(dx, 1.32, .13); g.add(l); lamps.push(l); }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.5, .2, .04), toonMaterial('#2b2b2b')); plate.position.set(0, 1.32, .1); g.add(plate);
  return {g, boom, lamps};
}

export async function buildRailway(scene, town, {works = null, landscape = null} = {}) {
  const rail = town.railway, root = new THREE.Group(); root.name = 'Thistlebrook Grand Loop'; scene.add(root);
  const graph = pedestrianGraph(town), service = createRailwayService(town, graph);
  const onDeck = (q) => Boolean(crossingAt(rail, q.p, .15));
  const runs = runsOf(rail.samples, (q) => !q.tunnel);
  const ballast = [[-1.75, .005], [-1.35, BALLAST_TOP], [1.35, BALLAST_TOP], [1.75, .005]];
  root.add(sweep(runsOf(rail.samples, (q) => !q.tunnel && !onDeck(q)), ballast, '#80786b'));
  if (rail.siding) {
    const siding = [rail.siding.samples];
    runs.push(...siding);
    root.add(sweep(siding, ballast, '#80786b'));
  }
  root.add(sweep(runsOf(rail.samples, (q) => q.bridge), [[-1.75, -.48], [-1.75, .05], [1.75, .05], [1.75, -.48]], '#9e8d7a', {closed: true}));
  const piers = rail.piers;
  const supports = new THREE.InstancedMesh(new THREE.BoxGeometry(1.35, 1, 1.1), toonMaterial('#ac9b84'), piers.length);
  const pier = new THREE.Object3D();
  piers.forEach((q, i) => {
    const base = q.wet ? -1.5 : q.ground;
    pier.position.set(q.p[0], (q.y + base) / 2, q.p[1]);
    pier.scale.y = q.y - base;
    pier.rotation.y = Math.atan2(q.d[0], q.d[1]);
    pier.updateMatrix();
    supports.setMatrixAt(i, pier.matrix);
  });
  supports.receiveShadow = true;
  root.add(supports);
  const railProfile = (s) => [[s - .045, SLEEPER_TOP], [s - .045, RAIL_TOP], [s + .045, RAIL_TOP], [s + .045, SLEEPER_TOP]];
  for (const side of [-.5, .5]) { const m = sweep(runs, railProfile(side), '#7d8189'); m.castShadow = true; m.name = 'Railway · rail'; root.add(m); }
  {
    const sleepers = [];
    for (let s = 0; s < rail.length; s += .72) {
      const pose = railPose(rail, s);
      if (!onDeck(pose)) sleepers.push(pose);
    }
    for (const q of rail.siding?.samples ?? []) sleepers.push(q);
    const g = new THREE.BoxGeometry(1.9, SLEEPER_TOP - BALLAST_TOP + .02, .26), m = new THREE.InstancedMesh(g, toonMaterial('#6b5643'), sleepers.length), o = new THREE.Object3D();
    sleepers.forEach((p, i) => { o.position.set(p.p[0], p.y + (BALLAST_TOP + SLEEPER_TOP) / 2, p.p[1]); o.rotation.set(0, Math.atan2(p.d[0], p.d[1]), 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.receiveShadow = true; m.name = 'Railway · sleepers'; root.add(m);
  }
  // Level crossings: timber deck between the kerbs, barriers on each approach lane, warning signs.
  const crossings = [];
  for (const c of rail.crossings) {
    const roadYaw = Math.atan2(c.roadDir[0], c.roadDir[1]);
    const verge = [c.roadDir[1], -c.roadDir[0]];
    const surface = railPose(rail, c.s).y + RAIL_TOP;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(c.reach * 2 + .4, .14, 3.1), toonMaterial('#7a6a58'));
    deck.position.set(c.pos[0], surface - .09, c.pos[1]);
    deck.rotation.y = roadYaw + Math.PI / 2;
    deck.receiveShadow = true;
    root.add(deck);
    const arms = [];
    for (const direction of [-1, 1]) {
      const off = direction * (RAIL.half + 2.2);
      const stop = c.pos.map((x, i) => x + c.roadDir[i] * off);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(c.hw * 2, .025, .18), toonMaterial('#f2efe6'));
      strip.position.set(stop[0], .1, stop[1]);
      strip.rotation.y = roadYaw + Math.PI / 2;
      root.add(strip);
      const side = -direction;
      const base = stop.map((x, i) => x + verge[i] * side * (c.hw + .45));
      const b = barrier(c.hw + .4);
      b.g.position.set(base[0], 0, base[1]);
      b.g.rotation.y = Math.atan2(verge[1] * side, -verge[0] * side);
      root.add(b.g);
      arms.push(b);
    }
    crossings.push({c, arms});
  }
  // Stations: platforms (new stations), walk links, dressing.
  const dressing = new Map(), ramps = [];
  for (const st of rail.stations) {
    const yaw = Math.atan2(st.along[0], st.along[1]);
    if (!st.existing) {
      const n = 8, step = st.length / n, mods = [];
      for (let i = 0; i < n; i++) { const a = -st.length / 2 + (i + .5) * step, c = [st.centre[0] + st.along[0] * a, st.centre[1] + st.along[1] * a]; mods.push({pos: c, y: st.y, yaw: yaw + Math.PI / 2 + (st.side > 0 ? Math.PI : 0), scale3: [step / 4, 1, (st.far - st.near) / 2.83]}); }
      const modules = dressing.get('platform_edge_module') ?? [];
      modules.push(...mods);
      dressing.set('platform_edge_module', modules);
      const links = town.roads.filter((r) => r.station === st.id);
      for (const [i, road] of links.entries()) {
        // The path graph shares a join on the road axis. Draw only as far as
        // the kerb, where the sidewalk graph takes over.
        const link = accessAtKerb(road, graph.index);
        const dx = link.b[0] - link.a[0], dz = link.b[1] - link.a[1], flat = Math.hypot(dx, dz);
        if (flat < .05) continue;
        const y0 = i === 0 ? st.y + .66 : .09;
        const y1 = .09;
        if (i === 0) ramps.push({...link, y0, y1});
        const m = new THREE.Mesh(new THREE.BoxGeometry(link.width, .12, Math.hypot(flat, y1 - y0)), toonMaterial('#d9c9a4'));
        m.position.set((link.a[0] + link.b[0]) / 2, (y0 + y1) / 2 - .06, (link.a[1] + link.b[1]) / 2);
        m.rotation.set(-Math.atan2(y1 - y0, flat), Math.atan2(dx, dz), 0, 'YXZ');
        m.receiveShadow = true;
        root.add(m);
      }
    }
    for (const f of st.furniture) { const key = f.asset; if (!dressing.has(key)) dressing.set(key, []); dressing.get(key).push({...f, y: (st.existing ? 0 : st.y) + .66, yaw: f.flip ? f.yaw + Math.PI : f.yaw, scale: f.asset === 'waiting_shelter' ? .9 : 1}); }
  }
  for (const [key, list] of dressing) await instanced(key.split(':')[0], list, root);
  // Group each platform's enamel faces by its unique sign texture.
  const plateGeometry = new THREE.PlaneGeometry(2.7, .5);
  const platePose = new THREE.Object3D();
  for (const st of rail.stations) {
    const boards = st.furniture.filter((f) => f.sign);
    const plates = new THREE.InstancedMesh(plateGeometry, namePlate(st.short), boards.length * 2);
    let i = 0;
    for (const f of boards) for (const side of [1, -1]) {
      platePose.position.set(f.pos[0] + Math.sin(f.yaw) * .27 * side, (st.existing ? 0 : st.y) + 2.28, f.pos[1] + Math.cos(f.yaw) * .27 * side);
      platePose.rotation.y = f.yaw + (side < 0 ? Math.PI : 0);
      platePose.updateMatrix();
      plates.setMatrixAt(i++, platePose.matrix);
    }
    root.add(plates);
  }
  // Lamp glows (night only).
  const glows = new THREE.InstancedMesh(new THREE.SphereGeometry(.2, 8, 6), new THREE.MeshBasicMaterial({color: '#ffd987', transparent: true, opacity: .85}), rail.stations.flatMap((s) => s.furniture.filter((f) => f.light)).length);
  { const o = new THREE.Object3D(); let i = 0; for (const st of rail.stations) for (const f of st.furniture.filter((f) => f.light)) { o.position.set(f.pos[0], (st.existing ? 0 : st.y) + .66 + 2.75, f.pos[1]); o.updateMatrix(); glows.setMatrixAt(i++, o.matrix); } glows.visible = false; root.add(glows); }
  // Mixed steam service. All stock shares the same toon shader and ink hull.
  const moving = new THREE.Group(); moving.name = 'Grand Loop train'; root.add(moving);
  const cars = [];
  for (const c of service.cars) {
    const g = new THREE.Group(), body = await modelMesh(c.asset, RAIL.stock);
    // The pack locomotive leads with its smokebox on the negative Z end.
    const reverse = c.asset === 'steam_locomotive';
    body.rotation.y = reverse ? Math.PI : 0;
    body.position.z = (reverse ? c.centre : -c.centre) * RAIL.stock;
    g.add(body);
    g.name = 'Railway · ' + c.asset;
    moving.add(g);
    cars.push(g);
  }
  const smoke = []; for (let n = 0; n < 6; n++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 6), new THREE.MeshBasicMaterial({color: '#eceae4', transparent: true, opacity: .4, depthWrite: false})); moving.add(m); smoke.push(m); }
  // Travellers: townsfolk models walking to and from the platforms.
  const people = [];
  for (const tr of service.travellers) { const model = TOWNSFOLK[tr.model % TOWNSFOLK.length], o = await place(model.id, {scale: 1.12}); o.visible = false; o.name = 'Rail traveller · ' + tr.id; root.add(o); people.push({tr, o}); }
  // Regional cars stop at closed barriers. The Pinecrest shuttle passes beneath the viaduct.
  landscape?.traffic?.setStopLines?.(() => rail.crossings.map((c, i) => ({point: c.pos, stop: RAIL.half + 2.2, closed: service.crossings[i].closed})));
  // West Works freight now rides on Union departures of the loop train.
  works?.setTrainSource?.(() => { const t = service.train; return {x: -91, phase: t.phase, open: t.phase !== 'rest', atPlatform: t.station === 'union' && t.phase === 'dwell', departed: !(t.station === 'union' && t.phase !== 'run') && t.phase !== 'rest', direction: 1}; });

  function update(t, hour, night = 0) {
    if (service.hour !== hour) service.update(hour);
    railNight.value = night; glows.visible = night > .2;
    service.cars.forEach((c, i) => { const g = cars[i]; g.visible = !c.hidden; g.position.set(c.pos[0], c.y + RAIL_TOP, c.pos[1]); g.rotation.set(-c.pitch, c.yaw, 0, 'YXZ'); });
    const loco = service.cars[0], running = service.train.phase !== 'rest';
    smoke.forEach((m, n) => { const phase = (t * .45 + n / smoke.length) % 1, chimney = loco.y + RAIL_TOP + 1.95 * RAIL.stock; m.visible = running && !loco.hidden; m.position.set(loco.pos[0] + loco.dir[0] * (3.2 - phase * 2.5 * Math.min(1, service.train.speed / 4 + .2)), chimney + phase * 2.4, loco.pos[1] + loco.dir[1] * (3.2 - phase * 2.5 * Math.min(1, service.train.speed / 4 + .2))); m.scale.setScalar(.5 + phase * 1.3); m.material.opacity = (1 - phase) * .45; });
    crossings.forEach(({arms}, i) => { const s = service.crossings[i], blink = s.closed && Math.floor(t * 2.4) % 2; for (const a of arms) { a.boom.rotation.z = (1 - s.lower) * Math.PI * .47; a.lamps[0].material.color.set(s.closed && blink ? '#ff4a35' : night > .25 && !s.closed ? '#ffbd68' : '#4a1b16'); a.lamps[1].material.color.set(s.closed && !blink ? '#ff4a35' : night > .25 && !s.closed ? '#ffbd68' : '#4a1b16'); } });
    for (const p of people) { const pose = service.travellerPose(p.tr); p.o.visible = !!pose; if (!pose) continue; p.o.position.set(pose.pos[0], travellerHeight(town, ramps, pose.pos) + (pose.moving ? Math.abs(Math.sin(t * 8 + p.tr.model)) * .05 : 0), pose.pos[1]); if (pose.moving) p.o.rotation.y = pose.facing; else if (pose.phase === 'waiting') { const st = rail.stations.find((s) => s.id === p.tr.from); p.o.rotation.y = Math.atan2(-st.out[0], -st.out[1]); } }
  }
  service.update(10);
  update(0, 10, 0);
  return {root, moving, service, update, people, audit() { return {train: {...service.train}, crossings: service.crossings.map((c) => ({...c})), travellers: people.filter((p) => p.o.visible).length, cars: service.cars.map((c) => ({pos: c.pos, hidden: c.hidden}))}; }};
}
function inPlatform(st, p) { const v = [p[0] - st.centre[0], p[1] - st.centre[1]], a = v[0] * st.along[0] + v[1] * st.along[1], o = v[0] * st.out[0] + v[1] * st.out[1]; return Math.abs(a) <= st.length / 2 && Math.abs(o) <= (st.far - st.near) / 2 + .1; }

function accessAtKerb(road, index) {
  if (!index.inside(road.b)) return road;
  const dx = road.b[0] - road.a[0], dz = road.b[1] - road.a[1];
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .1));
  for (let i = steps - 1; i > 0; i--) {
    const b = [road.a[0] + i / steps * dx, road.a[1] + i / steps * dz];
    if (!index.inside(b, -.1)) return {...road, b};
  }
  return {...road, b: road.a};
}

function travellerHeight(town, ramps, pos) {
  const st = town.railway.stations.find((station) => inPlatform(station, pos));
  if (st) return (st.existing ? 0 : st.y) + .66;
  for (const r of ramps) {
    const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1];
    const x = pos[0] - r.a[0], z = pos[1] - r.a[1], length = Math.hypot(dx, dz);
    const t = (x * dx + z * dz) / (length * length);
    if (t >= 0 && t <= 1 && Math.abs(x * dz - z * dx) / length < r.width / 2) {
      return r.y0 + t * (r.y1 - r.y0);
    }
  }
  return bridgeDeck(town, pos) ?? .15;
}
