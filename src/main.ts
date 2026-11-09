import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { World } from './world/world';
import { Sky } from './world/sky';
import { Avatar } from './agents/avatar';
import { VILLAGERS } from './data/villagers';
import { Sim, MIN_PER_SEC } from './sim/sim';
import { UtilityBrain } from './sim/brain';
import { LLMBrain, type LLMConfig } from './sim/llm';
import { Director } from './sim/director';
import { UI, type AppApi } from './ui/ui';
import { Sound } from './ui/sound';
import { dropGift, animateGifts, summonRain, spawnTraveller, tickTraveller, startFestival, tickFestival } from './sim/god';
import type { Villager } from './sim/types';
import { makeAnvil } from './agents/props';

const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
function params0() { return new URLSearchParams(location.search); }
const app = document.getElementById('app')!;
const loading = document.createElement('div'); loading.className = 'loading'; loading.innerHTML = `<div class="lc"><div class="lg">🌿</div><h1>Thistlebrook</h1><p>a digital terrarium</p><div class="pb"><i></i></div><small>Waking the village…</small></div>`; document.body.appendChild(loading);
const setProg = (f: number, msg?: string) => { (loading.querySelector('.pb i') as HTMLElement).style.width = `${Math.round(f * 100)}%`; if (msg) loading.querySelector('small')!.textContent = msg; };

const AA = params0().get('aa') !== '0' && !mobile;
const renderer = new THREE.WebGLRenderer({ antialias: AA, powerPreference: 'high-performance', preserveDrawingBuffer: new URLSearchParams(location.search).has('capture') });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .3, 420);
camera.position.set(-9 + 30, 34, 4 + 40);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(-6, 0, -2); controls.enableDamping = true; controls.dampingFactor = .08; controls.minDistance = 5; controls.maxDistance = 120; controls.maxPolarAngle = 1.32; controls.minPolarAngle = .35; controls.screenSpacePanning = false;
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE } as any; controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const world = new World(scene); const sky = new Sky(scene, mobile);
const sim = new Sim(world); const sound = new Sound();
const params = new URLSearchParams(location.search);
// ?seed=N makes a whole run reproducible (the sim's own RNG plus any Math.random flavour rolls).
if (params.has('seed')) { let a = (+params.get('seed')! || 1) >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let brain: UtilityBrain = new UtilityBrain();
const llmCfg = localStorage.getItem('terrarium.llm'); if (llmCfg && params.get('llm') !== '0') { try { brain = new LLMBrain(JSON.parse(llmCfg) as LLMConfig); } catch {} }
sim.brain = brain;

async function boot() {
  await world.build((n, t) => setProg(n / t * .8, `Building the village… ${n}/${t}`));
  const anvil = makeAnvil(); const sm = world.places.get('smithy')!; anvil.position.set(sm.x + 2.0, 0, sm.z + 1.6); scene.add(anvil); world.nav.circle(sm.x + 2.0, sm.z + 1.6, .35);
  setProg(.85, 'Dressing the villagers…');
  // Old Nell, the travelling storyteller (a visitor NPC, not a villager: she only appears with the Traveller god power)
  nell = new Avatar({ id: 'nell', name: 'Old Nell', job: 'postmistress', goal: 'liked', home: 'home-spare', age: '70s', traits: VILLAGERS[0].traits, bio: '', palette: 'autumn', skin: '#e3b590', hair: '#d8d8d8', height: 1.58,
    outfit: { fixed: { tops: 'tunic', bottoms: 'long-skirt', outerwear: 'satchel', headgear: 'feather-cap', hair: 'bun' }, pools: { shoes: ['boot'], accessories: ['glasses'] } }, catchphrases: [] } as any, 4242);
  nell.root.visible = false; scene.add(nell.root);
  for (const def of VILLAGERS) { const av = new Avatar(def, def.id.length * 977 + def.name.charCodeAt(0)); scene.add(av.root); sim.addVillager(def, av); await new Promise(r => setTimeout(r, 0)); }
  sim.initRelations();
  if (params.has('seed')) sim.rng = new (sim.rng.constructor as any)(+params.get('seed')!);
  setProg(1, 'Good morning, Thistlebrook.');
  start();
}

let speed = 1, mode: 'director' | 'free' = params.get('cam') === 'free' ? 'free' : 'director', selected: string | null = null; let acc = 0; let follow: string | null = null; let dirT = 0;
const director = new Director(sim);
const pcam = new THREE.PerspectiveCamera(15, 1, .3, 40); const portraits = new Map<string, HTMLCanvasElement>(); const pTime = new Map<string, number>();
// Portraits: the villager is lifted to a 'studio' spot high above the town for one render (lit by the real sun and sky,
// framed against the sky dome), so indoor, night-time or occluded villagers still get a clean headshot.
const pSave = new THREE.Vector3(); const PBG = new THREE.Color('#efe3c8');
const pKey = new THREE.DirectionalLight('#fff1dc', 0); scene.add(pKey, pKey.target);
function portrait(id: string) {
  let c = portraits.get(id); if (!c) { c = document.createElement('canvas'); c.width = c.height = 192; c.className = 'portrait'; portraits.set(id, c); }
  const v = sim.byId.get(id)!; const now = performance.now(); if (now - (pTime.get(id) ?? 0) < 400) return c; pTime.set(id, now);
  const r = v.avatar.root as THREE.Object3D, rotY = r.rotation.y, wasVis = r.visible, oldA = v.avatar.alpha; pSave.copy(r.position);
  const st = controls.target; r.position.set(st.x, 80, st.z); r.rotation.y = 0; r.visible = true; const tf = v.avatar.mats.map((m: THREE.Material) => [m.transparent, m.opacity, m.depthWrite] as const); if (oldA < 1) for (const m of v.avatar.mats) { m.opacity = 1; m.transparent = m.name === 'face'; m.depthWrite = m.name !== 'face'; } r.updateMatrixWorld(true);
  const head = new THREE.Vector3(); v.avatar.bones.Head.getWorldPosition(head); head.y += .12;
  pcam.position.set(head.x + Math.sin(.35) * 2.7, head.y + .14, head.z + Math.cos(.35) * 2.7); pcam.lookAt(head.x, head.y + .02, head.z); pcam.updateMatrixWorld();
  // drawn straight into a corner of the main canvas and copied out in the same task (the next main render paints over it);
  // render targets lose the face decal's blending, which left every portrait with a black face
  const pr = renderer.getPixelRatio(), cs = 192 / pr, H = renderer.domElement.height;
  renderer.setScissorTest(true); renderer.setScissor(0, 0, cs, cs); renderer.setViewport(0, 0, cs, cs); const ol = (r as any).getObjectByName('CharacterOutline'); if (ol) ol.visible = false; const bg = scene.background; scene.background = PBG; sky.dome.visible = false; sky.stars.visible = false; pKey.position.set(head.x + 1.6, head.y + 2.4, head.z + 2.6); pKey.target.position.copy(head); pKey.target.updateMatrixWorld(); pKey.intensity = 1.2 + sky.night * 1.6; renderer.render(scene, pcam); pKey.intensity = 0; scene.background = bg; sky.dome.visible = true; sky.stars.visible = sky.night > .01; if (ol) ol.visible = true;
  r.position.copy(pSave); r.rotation.y = rotY; r.visible = wasVis; v.avatar.mats.forEach((m: THREE.Material, i: number) => { m.transparent = tf[i][0]; m.opacity = tf[i][1]; m.depthWrite = tf[i][2]; }); r.updateMatrixWorld(true);
  c.getContext('2d')!.drawImage(renderer.domElement, 0, H - 192, 192, 192, 0, 0, 192, 192);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, renderer.domElement.width / pr, renderer.domElement.height / pr);
  return c;
}
const tmpV = new THREE.Vector3();
const api: AppApi = {
  sim, director, get speed() { return speed; }, setSpeed(s) { speed = s; }, get selected() { return selected; },
  select(id) { selected = id; follow = id; if (id) { const v = sim.byId.get(id)!; if (v && camera.position.distanceTo(controls.target) > 24) { const dir = camera.position.clone().sub(controls.target).normalize(); controls.target.set(v.x, 1, v.z); camera.position.copy(controls.target).addScaledVector(dir, 15); } sound.play('pop'); if (mode === 'director') mode = 'free'; if (v) controls.autoRotate = false; } },
  portrait, get mode() { return mode; }, setMode(m) { mode = m; if (m === 'director') { selected = null; follow = null; } controls.autoRotate = false; },
  god(kind) { if (kind === 'gift') { const v = selected ? sim.byId.get(selected) : null; const g = dropGift(sim, v ? v.x + 3 : undefined, v ? v.z + 2 : undefined); focusPoint(g.x, g.z); } if (kind === 'rain') summonRain(sim); if (kind === 'traveller' || kind === 'merchant') { spawnTraveller(sim); focusPoint(-19, 5); } if (kind === 'festival') { startFestival(sim); focusPoint(-9, 5); } },
  sound, project(x, y, z) { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x * .5 + .5) * innerWidth, y: (-tmpV.y * .5 + .5) * innerHeight, on: tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1 }; },
  camDist() { return camera.position.distanceTo(controls.target); },
};
let ui: UI;
let focusTarget: THREE.Vector3 | null = null, focusDist = 0;
function focusPoint(x: number, z: number, dist = 22) { focusTarget = new THREE.Vector3(x, 0, z); focusDist = dist; follow = null; }

// click to select a villager (screen-space pick)
renderer.domElement.addEventListener('pointerdown', e => { (renderer.domElement as any)._down = [e.clientX, e.clientY]; if (mode === 'director') { mode = 'free'; } focusTarget = null; });
renderer.domElement.addEventListener('pointerup', e => {
  const d = (renderer.domElement as any)._down; if (!d || Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 6) return;
  let best: Villager | null = null, bd = 46; for (const v of sim.villagers) { if (v.inside) continue; for (const yy of [.5, 1.1, 1.7]) { const p = api.project(v.x, yy, v.z); const dd = Math.hypot(p.x - e.clientX, p.y - e.clientY); if (p.on && dd < bd) { bd = dd; best = v; } } }
  api.select(best ? best.id : null);
});

function exprFor(v: Villager): string {
  if ((sim.dizzy.get(v.id) ?? 0) > sim.clock) return 'dizzy';
  if (v.act?.type === 'fight') return 'angry'; if (v.act?.type === 'flee') return 'scared'; if (v.act?.type === 'chase') return 'angry';
  const e = v.emotions, c: [number, string][] = [[e.love, 'love'], [e.anger, 'angry'], [e.fear, 'scared'], [e.surprise * 1.1, 'surprised'], [e.sadness, 'sad'], [e.joy * .9, e.joy > .7 ? 'grin' : 'happy']];
  c.sort((a, b) => b[0] - a[0]); if (c[0][0] > .38) return c[0][1];
  if (v.needs.energy < 18) return 'sleepy'; if (v.act?.type === 'steal') return 'smirk'; if (v.act?.type === 'work' && ['chop', 'mine', 'forge', 'plant'].includes(v.act.kind)) return 'determined';
  if (v.anim === 'talk' || v.anim === 'cheer' || v.anim === 'dance') return 'happy'; if (v.anim === 'sad') return 'sad';
  return c[0][0] > .2 ? c[0][1] : 'neutral';
}
const WORK_TOOLS: Record<string, string> = { chop: 'axe', mine: 'pickaxe', hammer: 'hammer', hoe: 'hoe', water: 'can', feed: 'basket', drink: 'mug' };
function syncAvatar(v: Villager, dt: number) {
  const av = v.avatar; av.root.position.set(v.x, 0, v.z); av.targetHeading = v.heading; av.anim = v.anim as any;
  av.targetAlpha = v.inside ? 0 : 1; av.seated = !!v.seat && v.anim !== 'walk' && v.anim !== 'run' && Math.hypot(v.x - v.seat.x, v.z - v.seat.z) < .35; av.sitH = (v.anim === 'sit' || av.seated) && v.seat ? v.seat.y + .04 : .5;
  const tool = WORK_TOOLS[v.anim] ?? ''; if (av.toolKind !== tool && !(window as any).__noTool) av.setTool(tool);
  const busyHands = ['chop', 'mine', 'hammer', 'hoe', 'water', 'feed', 'sit', 'fight', 'dance', 'cheer', 'pickup'].includes(v.anim);
  av.setCarry(busyHands ? '' : sim.carryFor(v));
  const al = v.alliance ? sim.alliances.find(a => a.id === v.alliance) : null; av.setBanner(al ? al.color : '');
  av.setExpression(forced.get(v.id)?.expr ?? exprFor(v));
  av.update(dt, v.anim === 'run' ? 1 : .8);
}
const forced = new Map<string, { expr: string; until: number }>();

let nell: Avatar; let nellT = 0;
let last = performance.now(), simMsAvg = 0;
// ---- performance governor ---------------------------------------------------------------------------
// fps = frames actually drawn per wall-clock second (the old EMA of 1/dt overstated it badly).
// Levers, cheapest first: villager LOD (no ink outline / real shadow when far, culled off-screen, blob shadow instead),
// shadow map refreshed every other frame, then dynamic resolution between 0.6x and the device ratio.
const perf = (() => {
  const q = params0(), dynRes = q.get('dynres') !== '0', maxPR = Math.min(devicePixelRatio, mobile ? 1.25 : 1.75), minPR = Math.min(maxPR, mobile ? .6 : .65);
  let pr = maxPR, frames = 0, t0 = performance.now(), fps = 60, n = 0, lastAdjust = 0;
  const frus = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere(), tmp = new THREE.Vector3();
  const shadowEvery = q.get('shadowEvery') ? +q.get('shadowEvery')! : 2; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  const blobG = new THREE.CircleGeometry(.42, 18).rotateX(-Math.PI / 2), blobM = new THREE.MeshBasicMaterial({ color: '#1d1a12', transparent: true, opacity: .32, depthWrite: false });
  const blobs = new Map<any, THREE.Mesh>();
  return {
    get fps() { return fps; }, get pr() { return pr; },
    tick(now: number) { frames++; if (now - t0 >= 1000) { fps = frames * 1000 / (now - t0); frames = 0; t0 = now;
        if (dynRes && now - lastAdjust > 1500) { const want = fps < 50 ? pr - .1 : fps > 58 ? pr + .05 : pr; const np = Math.max(minPR, Math.min(maxPR, want)); if (Math.abs(np - pr) > .01) { pr = np; renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); lastAdjust = now; } } } },
    beforeRender() {
      n++; if (n % shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
      camera.updateMatrixWorld(); pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frus.setFromProjectionMatrix(pm);
      const avs: any[] = sim.villagers.map(v => v.avatar); if (nell) avs.push(nell);
      for (const av of avs) {
        const r = av.root as THREE.Object3D; sph.center.set(r.position.x, r.position.y + av.height * .5, r.position.z); sph.radius = av.height * .75;
        const onScreen = frus.intersectsSphere(sph); av.body.visible = onScreen;
        const d = tmp.copy(sph.center).distanceTo(camera.position), near = d < 26;
        if (av._lod !== near) { av._lod = near; av.body.traverse((m: any) => { if (m.isMesh) { if (m.name === 'CharacterOutline') m.visible = d < 34 || near; m.castShadow = near; } }); }
        const ol = av._ol ??= av.body.getObjectByName('CharacterOutline'); if (ol) ol.visible = d < 34;
        let b = blobs.get(av); if (!b) { b = new THREE.Mesh(blobG, blobM); b.renderOrder = 1; scene.add(b); blobs.set(av, b); }
        b.visible = r.visible && onScreen && !near; b.position.set(r.position.x, .03, r.position.z);
      }
    },
  };
})();
function start() {
  ui = new UI(api, document.body);
  sim.on('sound', (k: string, x: number, z: number) => sound.play(k, Math.max(0, 1 - Math.hypot(x - controls.target.x, z - controls.target.z) / 40)));
  sim.on('dawn', () => { const p = director.papers[director.papers.length - 1]; if (p && ui.autoPaper && !params.has('nopaper')) { ui.showPaper(p); setTimeout(() => { if (ui.modal.querySelector('.paper')) ui.closeModal(); }, 20000); } });
  loading.classList.add('done'); setTimeout(() => loading.remove(), 900);
  requestAnimationFrame(frame);
}
function stepSim(dtWorld: number) { const n = Math.min(400, Math.ceil(dtWorld / (1 / 30))); const h = dtWorld / n; for (let i = 0; i < n; i++) { sim.step(h); } tickTraveller(sim); tickFestival(sim); }
function frame(now: number) {
  requestAnimationFrame(frame);
  let dt = Math.min(.1, (now - last) / 1000); last = now; perf.tick(now);
  const t0 = performance.now(); if (speed > 0) stepSim(dt * speed); simMsAvg = simMsAvg * .9 + (performance.now() - t0) * .1;
  const adt = speed === 0 ? dt * .25 : dt * Math.min(speed, 2.5);
  for (const v of sim.villagers) syncAvatar(v, speed === 0 ? 0 : adt);
  if (nell) { const on = sim.visitorUntil > sim.clock; nell.targetAlpha = on ? 1 : 0; if (on || nell.alpha > .05) { nellT += adt; nell.root.position.set(-18.9, 0, 2.2); nell.targetHeading = Math.PI / 2 + Math.sin(nellT * .4) * .5; const k = Math.floor(nellT / 2.5) % 4; nell.anim = (['talk', 'wave', 'talk', 'cheer'] as any)[k]; nell.setExpression(k === 3 ? 'grin' : 'happy'); nell.update(speed === 0 ? 0 : adt, .8); } }
  animateGifts(sim, dt);
  world.update(adt, dt * speed * MIN_PER_SEC, sim.clock, sky.night);
  // camera
  if (mode === 'director' && !selected) { dirT -= dt; if (dirT <= 0) { dirT = 1; const pick = director.pick(sim.clock, follow); if (pick && pick.id !== follow) { follow = pick.id; } } controls.autoRotate = true; controls.autoRotateSpeed = .35; }
  else controls.autoRotate = false;
  const want = follow ? sim.byId.get(follow)!.avatar.root.position : focusTarget;
  if (want) { const k = 1 - Math.pow(.04, dt), dx = (want.x - controls.target.x) * k, dz = (want.z - controls.target.z) * k, dy = ((follow ? 1 : 0) - controls.target.y) * k; controls.target.x += dx; controls.target.z += dz; controls.target.y += dy; camera.position.x += dx; camera.position.z += dz; camera.position.y += dy;
    const wantDist = mode === 'director' ? 17 + Math.sin(now / 9000) * 4 : (focusTarget && !follow ? focusDist : 0); if (wantDist) { const off = camera.position.clone().sub(controls.target); const d = off.length(); off.multiplyScalar(1 + (wantDist / d - 1) * k * .5); camera.position.copy(controls.target).add(off); } }
  controls.update();
  sky.update(sim.hour, sim.rain, controls.target); world.fx.setRain(sim.rain > .35); world.fx.update(dt, controls.target);
  sound.ambient(sky.night, sim.rain, dt);
  ui.frame(dt);
  perf.beforeRender();
  renderer.render(scene, camera);
}

// ---- hooks for headless verification & power users -------------------------------------------------
(window as any).terrarium = {
  sim, director, world, camera, controls, renderer, get fps() { return perf.fps; }, get pixelRatio() { return perf.pr; }, get simMs() { return simMsAvg; },
  setSpeed: (s: number) => (speed = s), select: (id: string | null) => api.select(id), setMode: (m: any) => api.setMode(m), god: (k: string) => api.god(k), ui: () => ui,
  fastForward(minutes: number) { ui.quiet = true; stepSim(minutes / MIN_PER_SEC); ui.quiet = false; for (const v of sim.villagers) syncAvatar(v, .016); },
  look(x: number, z: number, dist = 30, yaw = .6, pitch = .9) { follow = null; focusTarget = null; mode = 'free'; controls.target.set(x, 0, z); camera.position.set(x + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, z + Math.cos(yaw) * Math.cos(pitch) * dist); controls.update(); },
  closeUp(id: string, dist = 3.2, side = .3) { const v = sim.byId.get(id)!; follow = null; focusTarget = null; mode = 'free'; const hd = v.avatar.heading; const hy = v.avatar.height * .8; controls.target.set(v.x, hy, v.z); camera.position.set(v.x + Math.sin(hd + side) * dist, hy + .5, v.z + Math.cos(hd + side) * dist); controls.update(); },
  forceExpr(id: string, expr: string) { forced.set(id, { expr, until: 0 }); }, clearExpr() { forced.clear(); },
  enableLLM(cfg: LLMConfig) { localStorage.setItem('terrarium.llm', JSON.stringify(cfg)); sim.brain = new LLMBrain(cfg); console.info('LLM brain enabled (plans + reflections).'); },
  disableLLM() { localStorage.removeItem('terrarium.llm'); sim.brain = new UtilityBrain(); },
  summary() { return { day: sim.day, clock: sim.clock, events: sim.events.length, villagers: sim.villagers.map(v => ({ id: v.id, x: +v.x.toFixed(1), z: +v.z.toFixed(1), doing: v.doing, crush: v.crush, partner: v.partner, holding: sim.holding(v).map(k => k.id), food: Math.round(v.needs.food), energy: Math.round(v.needs.energy), opinions: { ...v.opinion }, alliance: v.alliance, expr: v.avatar.expr })), alliances: sim.alliances.map(a => a.name + ':' + a.members.join(',')), parties: sim.parties.map(p => `${p.title}@${p.place} invited ${p.invited.size} came ${p.attendees.size}`), kinds: sim.events.reduce((m: any, e) => (m[e.kind] = (m[e.kind] ?? 0) + 1, m), {}) }; },
};
boot().catch(e => { console.error(e); loading.querySelector('small')!.textContent = 'Something went wrong: ' + e.message; });
