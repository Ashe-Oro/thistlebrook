import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { World } from './world/world';
import { Sky } from './world/sky';
import { Avatar, type Anim } from './agents/avatar';
import { VILLAGERS } from './data/villagers';
import { Sim, MIN_PER_SEC } from './sim/sim';
import { UtilityBrain } from './sim/brain';
import { LLMBrain, type LLMConfig } from './sim/llm';
import { Director } from './sim/director';
import { UI, type AppApi } from './ui/ui';
import { Sound } from './ui/sound';
import { dropGift, animateGifts, summonRain, spawnTraveller, tickTraveller, startFestival, tickFestival, NELL } from './sim/god';
import type { Villager, SimEvent } from './sim/types';
import { makeAnvil } from './agents/props';
import { saveGame, loadGame, clearSave, peekSave } from './core/save';
import { arcs } from './sim/arcs';
import { Ambient } from './world/ambient';
import { fmtTime } from './core/util';
import { Extras } from './world/extras'; let extras: Extras | null = null;

const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
function params0() { return new URLSearchParams(location.search); }
const app = document.getElementById('app')!;
const loading = document.createElement('div'); loading.className = 'loading'; loading.innerHTML = `<div class="lc"><div class="lg">🌿</div><h1>Thistlebrook</h1><p>a digital terrarium</p><div class="pb"><i></i></div><small>Waking the village…</small></div>`; document.body.appendChild(loading);
const setProg = (f: number, msg?: string) => { (loading.querySelector('.pb i') as HTMLElement).style.width = `${Math.round(f * 100)}%`; if (msg) loading.querySelector('small')!.textContent = msg; };

// Quality tier: software rasterisers (SwiftShader/llvmpipe, i.e. no GPU) are fill-bound, so drop MSAA and allow a lower render scale there.
const SOFT = (() => { try { const gl = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null; if (!gl) return false; const ext = gl.getExtension('WEBGL_debug_renderer_info'); const r = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)); gl.getExtension('WEBGL_lose_context')?.loseContext(); return /swiftshader|llvmpipe|softpipe|software/i.test(r); } catch { return false; } })();
const AA = params0().get('aa') === '1' || (params0().get('aa') !== '0' && !mobile && (!SOFT || params0().has('capture')));
const renderer = new THREE.WebGLRenderer({ antialias: AA, powerPreference: 'high-performance', preserveDrawingBuffer: new URLSearchParams(location.search).has('capture') });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = new URLSearchParams(location.search).get('shadow') === 'pcf' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .3, 420);
camera.position.set(-9 + 30, 34, 4 + 40);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(-6, 0, -2); controls.enableDamping = true; controls.dampingFactor = .08; controls.minDistance = 4.5; controls.maxDistance = 72; controls.maxPolarAngle = 1.32; controls.minPolarAngle = .35; controls.screenSpacePanning = false;
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE } as any; controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const world = new World(scene); const sky = new Sky(scene, mobile || (SOFT && !params0().has('capture')));
const sim = new Sim(world); const sound = new Sound();
const params = new URLSearchParams(location.search);
// ?seed=N makes a whole run reproducible (the sim's own RNG plus any Math.random flavour rolls).
if (params.has('seed')) { let a = (+params.get('seed')! || 1) >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let brain: UtilityBrain = new UtilityBrain();
const llmCfg = localStorage.getItem('terrarium.llm'); if (llmCfg && params.get('llm') !== '0') { try { brain = new LLMBrain(JSON.parse(llmCfg) as LLMConfig); } catch {} }
sim.brain = brain;

async function boot() {
  await world.build((n, t) => setProg(n / t * .8, `Building the village… ${n}/${t}`));
  cacheOccluders();
  const anvil = makeAnvil(); const sm = world.places.get('smithy')!; anvil.position.set(sm.x + 2.0, 0, sm.z + 1.6); scene.add(anvil); world.nav.circle(sm.x + 2.0, sm.z + 1.6, .35);
  { const ponds = ['pond', 'rivpond'].map(id => world.places.get(id) as any).filter(Boolean).map(p => ({ x: p.cx ?? p.x, z: p.cz ?? p.z, r: 1.7 }));
    ambient = new Ambient(scene, ponds, world.fx);
    ambient.onRainbow = () => afterRain(); ambient.onSplash = (x, z) => sound.play('splash', Math.max(0, 1 - Math.hypot(x - controls.target.x, z - controls.target.z) / 25) * .5); }
  try { extras = new Extras(world, scene); await extras.init(); } catch (e) { console.warn('extras', e); extras = null; }
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

let ffing = false;
let ambient: Ambient | null = null; let lastSpeed = 1; let speed = 1, mode: 'director' | 'free' = params.get('cam') === 'free' ? 'free' : 'director', selected: string | null = null; let acc = 0; let follow: string | null = null; let dirT = 0;
const director = new Director(sim);
const pcam = new THREE.PerspectiveCamera(15, 1, .3, 40); const portraits = new Map<string, HTMLCanvasElement>(); const pTime = new Map<string, number>();
// Portraits: the villager is lifted to a 'studio' spot high above the town for one render (lit by the real sun and sky,
// framed against the sky dome), so indoor, night-time or occluded villagers still get a clean headshot.
const pSave = new THREE.Vector3(); const PBG = new THREE.Color('#efe3c8');
const pKey = new THREE.DirectionalLight('#fff1dc', 0); scene.add(pKey, pKey.target);
// at most two studio renders per frame: opening the Villagers or Relationships view queues the rest over the next frames instead of hitching
let pBudget = 2; const pQueue = new Set<string>();
function portrait(id: string) {
  let c = portraits.get(id); if (!c) { c = document.createElement('canvas'); c.width = c.height = 192; c.className = 'portrait'; portraits.set(id, c); }
  const v = sim.byId.get(id)!; const now = performance.now(); if (now - (pTime.get(id) ?? 0) < 400) return c;
  if (pBudget <= 0) { pQueue.add(id); return c; } pBudget--; pQueue.delete(id); pTime.set(id, now);
  const r = v.avatar.root as THREE.Object3D, rotY = r.rotation.y, wasVis = r.visible, oldA = v.avatar.alpha, body = v.avatar.body as THREE.Object3D, bodyVis = body.visible; body.visible = true; pSave.copy(r.position); // body: the perf governor may have culled it
  const st = controls.target; r.position.set(st.x, 80, st.z); r.rotation.y = 0; r.visible = true; const tf = v.avatar.mats.map((m: THREE.Material) => [m.transparent, m.opacity, m.depthWrite] as const); if (oldA < 1) for (const m of v.avatar.mats) { m.opacity = 1; m.transparent = m.name === 'face'; m.depthWrite = m.name !== 'face'; } r.updateMatrixWorld(true);
  const head = new THREE.Vector3(); v.avatar.bones.Head.getWorldPosition(head); head.y += .12;
  pcam.position.set(head.x + Math.sin(.35) * 2.7, head.y + .14, head.z + Math.cos(.35) * 2.7); pcam.lookAt(head.x, head.y + .02, head.z); pcam.updateMatrixWorld();
  // drawn straight into a corner of the main canvas and copied out in the same task (the next main render paints over it);
  // render targets lose the face decal's blending, which left every portrait with a black face
  const pr = renderer.getPixelRatio(), cs = 192 / pr, H = renderer.domElement.height;
  renderer.setScissorTest(true); renderer.setScissor(0, 0, cs, cs); renderer.setViewport(0, 0, cs, cs); const ol = (r as any).getObjectByName('CharacterOutline'); if (ol) ol.visible = false; const bg = scene.background; scene.background = PBG; sky.dome.visible = false; sky.stars.visible = false; pKey.position.set(head.x + 1.6, head.y + 2.4, head.z + 2.6); pKey.target.position.copy(head); pKey.target.updateMatrixWorld(); pKey.intensity = 1.2 + sky.night * 1.6; renderer.render(scene, pcam); pKey.intensity = 0; scene.background = bg; sky.dome.visible = true; sky.stars.visible = sky.night > .01; if (ol) ol.visible = true;
  r.position.copy(pSave); r.rotation.y = rotY; r.visible = wasVis; body.visible = bodyVis; v.avatar.mats.forEach((m: THREE.Material, i: number) => { m.transparent = tf[i][0]; m.opacity = tf[i][1]; m.depthWrite = tf[i][2]; }); r.updateMatrixWorld(true);
  c.getContext('2d')!.drawImage(renderer.domElement, 0, H - 192, 192, 192, 0, 0, 192, 192);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, renderer.domElement.width / pr, renderer.domElement.height / pr);
  return c;
}
const tmpV = new THREE.Vector3();
const api: AppApi = {
  sim, director, get speed() { return speed; }, setSpeed(s) { if (s === 0 && speed > 0) lastSpeed = speed; speed = s; }, togglePause() { api.setSpeed(speed ? 0 : lastSpeed || 1); }, get selected() { return selected; },
  select(id) { selected = id; follow = id; if (id && ui?.hint) { ui.hint.classList.add('gone'); try { localStorage.setItem('thistlebrook.hinted', '1'); } catch {} } if (id) { const v = sim.byId.get(id)!; if (v && camera.position.distanceTo(controls.target) > 24) { const dir = camera.position.clone().sub(controls.target).normalize(); controls.target.set(v.x, 1, v.z); camera.position.copy(controls.target).addScaledVector(dir, 15); } sound.play('pop'); if (mode === 'director') mode = 'free'; if (v) controls.autoRotate = false; } },
  portrait, get mode() { return mode; }, setMode(m) { mode = m; if (m === 'director') { selected = null; follow = null; } controls.autoRotate = false; },
  god(kind) {
    if (speed === 0) { ui.toast('⏸ Time is paused', 'Unpause to use god powers.'); return false; }
    if (kind === 'rain' && (sim.rain > .25 || sim.rainUntil > sim.clock)) { ui.toast('🌧️ Already raining', 'Wait for this storm to blow over.'); return false; }
    if (kind === 'gift') { const v = selected ? sim.byId.get(selected) : null; const g = dropGift(sim, v ? v.x + 3 : undefined, v ? v.z + 2 : undefined); focusPoint(g.x, g.z); } if (kind === 'rain') summonRain(sim); if (kind === 'traveller' || kind === 'merchant') { spawnTraveller(sim); focusPoint(NELL[0], NELL[1] + 2); } if (kind === 'festival') { startFestival(sim); focusPoint(-9, 5); } return true; },
  sound, project(x, y, z) { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x * .5 + .5) * innerWidth, y: (-tmpV.y * .5 + .5) * innerHeight, on: tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1 }; },
  camDist() { return camera.position.distanceTo(controls.target); },
  newVillage() { noSave = true; clearSave(); const q = new URLSearchParams(location.search); q.set('seed', String(1 + Math.floor(Math.random() * 1e6))); q.delete('resume'); location.search = q.toString(); },
};
// ---- save / resume -------------------------------------------------------------------------------
let noSave = params.has('nosave');
const seedParam = params.get('seed');
function autosave() { if (noSave || !ui) return; saveGame(sim, director, seedParam); }
function tryResume(): boolean {
  if (params.has('fresh') || params.has('new')) return false;
  const info = peekSave(); if (!info) return false;
  if (seedParam !== null && info.seed !== seedParam) return false; // asking for a specific seed starts that village fresh
  return loadGame(sim, director);
}
let ui: UI;
let focusTarget: THREE.Vector3 | null = null, focusDist = 0;
function focusPoint(x: number, z: number, dist = 22) { focusTarget = new THREE.Vector3(x, 0, z); focusDist = dist; follow = null; }

// click to select a villager (screen-space pick)
renderer.domElement.addEventListener('pointerdown', e => { if (intro) { endIntro(); return; } if (montage) { endMontage(); return; } (renderer.domElement as any)._down = [e.clientX, e.clientY]; if (mode === 'director') { mode = 'free'; } focusTarget = null; });
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
  const av = v.avatar;
  const o = montage ? montageOverride.get(v.id) : null;
  if (o) { // flashback ghost: a montage actor restaged at the recorded event spot, render layer only — sim fields untouched
    av.root.position.set(o.x, 0, o.z); av.targetHeading = o.heading; av.anim = o.anim;
    av.targetAlpha = 1; av.seated = false; av.sitH = .5;
    if (av.toolKind) av.setTool(''); if (av.carryKind) av.setCarry('');
    av.setExpression(o.expr); av.update(dt, .8); return;
  }
  av.root.position.set(v.x, 0, v.z); av.targetHeading = v.heading; av.anim = v.anim as any;
  av.targetAlpha = v.inside || (montage && montageHidden.has(v.id)) ? 0 : 1; av.seated = !!v.seat && v.anim !== 'walk' && v.anim !== 'run' && Math.hypot(v.x - v.seat.x, v.z - v.seat.z) < .35; av.sitH = (v.anim === 'sit' || av.seated) && v.seat ? v.seat.y + .04 : .5;
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
// shadow map refreshed every other frame, then dynamic resolution between 0.65x (0.5x on software rasterisers) and the device ratio.
const perf = (() => {
  const q = params0(), dynRes = q.get('dynres') !== '0', maxPR = Math.min(devicePixelRatio, mobile ? 1.25 : 1.75), minPR = Math.min(maxPR, SOFT && !q.has('capture') ? .5 : mobile ? .6 : .65);
  let pr = maxPR, frames = 0, t0 = performance.now(), fps = 60, n = 0, lastAdjust = 0;
  const frus = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere(), tmp = new THREE.Vector3();
  const shadowEvery = q.get('shadowEvery') ? +q.get('shadowEvery')! : 2; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  const blobG = new THREE.CircleGeometry(.42, 18).rotateX(-Math.PI / 2), blobM = new THREE.MeshBasicMaterial({ color: '#1d1a12', transparent: true, opacity: .32, depthWrite: false });
  const blobs = new Map<any, THREE.Mesh>();
  return {
    get fps() { return fps; }, get pr() { return pr; },
    tick(now: number) { frames++; if (now - t0 >= 1000) { fps = frames * 1000 / (now - t0); frames = 0; t0 = now;
        if (dynRes && now - lastAdjust > 1000) { const want = fps < 30 ? pr - .2 : fps < 50 ? pr - .1 : fps > 58 ? pr + .05 : pr; const np = Math.max(minPR, Math.min(maxPR, want)); if (Math.abs(np - pr) > .01) { pr = np; renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); lastAdjust = now; } } } },
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

// ---- director camera care -----------------------------------------------------------------------
// Twice a second: if the followed villager went indoors (or everyone is asleep), cut to a lit outdoor spot instead of
// staring at a wall; otherwise re-run the shared frameShot helper on the subject and ease toward its
// clear framing (yaw via yawFix, distance/height nudged a third of the way per tick) so the camera
// never sits behind a roof, a wall or a foreground villager for long.
let careT = 0, yawFix = 0; const careT0 = new THREE.Vector3(), careHead = new THREE.Vector3();
function directorCare(dt: number) {
  if (yawFix) { const step = Math.sign(yawFix) * Math.min(Math.abs(yawFix), dt * 1.6); yawFix -= step; const off = camera.position.clone().sub(controls.target); off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, step); camera.position.copy(controls.target).add(off); if (Math.abs(yawFix) < 1e-3) yawFix = 0; }
  careT -= dt; if (careT > 0) return; careT = .5;
  const fv = follow ? sim.byId.get(follow) : null;
  if (fv && fv.inside) { // pick someone outdoors; nobody? frame the plaza lamps / campfire
    const out = sim.villagers.filter(v => !v.inside); if (out.length) { const c = out.sort((a, b) => Math.hypot(a.x - fv.x, a.z - fv.z) - Math.hypot(b.x - fv.x, b.z - fv.z))[0]; follow = c.id; director.focus = { id: c.id, until: sim.clock + 25, reason: c.doing }; }
    else { const spot = world.places.get(sky.night > .5 ? 'campfire' : 'plaza') ?? world.places.get('plaza'); if (spot) focusPoint(spot.x, spot.z, 26); }
    return;
  }
  if (!fv && !focusTarget) { const out = sim.villagers.filter(v => !v.inside); if (out.length) follow = out[0].id; }
  if (!fv || yawFix) return;
  careT0.set(fv.x, 1.2, fv.z); if (careT0.distanceTo(controls.target) > 3) return; // still travelling to the subject
  const off = camera.position.clone().sub(controls.target); const dist = Math.hypot(off.x, off.z), yaw = Math.atan2(off.x, off.z);
  careHead.set(fv.x, fv.avatar.height + .3, fv.z); const h0 = Math.max(2.4, camera.position.y);
  const f = frameShot(careT0, [careHead], yaw, dist, dist * 1.25, [h0, h0 + 1.4], new Set([fv.id]));
  const nd = dist + (f.dist - dist) * .35, nh = camera.position.y + (f.h - camera.position.y) * .35; // ease, never snap
  camera.position.set(careT0.x + Math.sin(yaw) * nd, nh, careT0.z + Math.cos(yaw) * nd);
  const dy = Math.atan2(Math.sin(f.yaw - yaw), Math.cos(f.yaw - yaw));
  if (Math.abs(dy) > .03) { yawFix = dy; controls.autoRotate = false; }
}
// phones: with the villager card up as a bottom sheet, shift the picture up so the villager sits in the open space above it
let vOff = false;
function mobileFrame() {
  const want = !!(selected && innerWidth <= 700 && ui && !ui.card.classList.contains('hidden'));
  if (want === vOff) return; vOff = want;
  if (want) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * .26, innerWidth, innerHeight); else camera.clearViewOffset();
}
addEventListener('resize', () => { vOff = !vOff; mobileFrame(); });

// ---- after the rain: a rainbow, a few villagers point it out, and (if the director has the camera) a low shot up at it ----
function afterRain() {
  if (ffing) return;
  const out = sim.villagers.filter(v => !v.inside); const lines = ['Look, a rainbow!', 'Would you look at that!', 'A rainbow! Make a wish.', 'Oh, how lovely.'];
  out.slice(0, 3).forEach((v, i) => setTimeout(() => ui?.bubble(v.id, lines[i % lines.length], '🌈', 4), 400 + i * 700));
  const cineShot = mode === 'director' && !selected && !beat && !intro && !montage && ui && !ui.quiet;
  if (ui && !ui.quiet && !cineShot) ui.captionText('🌈 The rain has cleared, and a rainbow arches over Thistlebrook.');
  if (cineShot) {
    const cx = controls.target.x, cz = controls.target.z, dx = cx - camera.position.x, dz = cz - camera.position.z;
    const e: any = { id: -1, t: sim.clock, text: 'The rain has cleared, and a rainbow arches over Thistlebrook.', imp: 5, actors: [], x: cx, z: cz, kind: 'rainbow', icon: '🌈', yaw: Math.atan2(-dx, -dz) };
    if (startBeat(e, true) && beat) { (beat as Beat).dur = 7; }
  }
}
// ---- dawn montage: "Previously in Thistlebrook…" — quick sepia cuts to yesterday's biggest moments, then the paper ----
// Each shot is a true flashback: the event's actors (up to 3) are restaged at the recorded x,z in a
// kind-appropriate pose even if the real villager is now asleep indoors, and bystanders who would
// wander through the frame are faded out. All of it lives in the render layer: syncAvatar consults
// montageOverride / montageHidden and resumes normal control the moment the shot changes or the
// montage ends (including a click-to-skip). No villager sim fields are touched and no sim RNG runs.
interface MontageShot { x: number; z: number; actors: string[]; kind: string; icon: string; text: string; t: number; target?: THREE.Vector3; frame?: Framing }
let montage: { shots: MontageShot[]; i: number; t: number; per: number; yaw: number; then: (() => void) | null } | null = null;
const montageOverride = new Map<string, { x: number; z: number; heading: number; anim: Anim; expr: string }>();
const montageHidden = new Set<string>();
function pickShots(day: number): MontageShot[] {
  const evs = (sim.dayStats[day] ?? []).filter(e => e.imp >= 5 && !['headline', 'weather', 'reflect', 'work'].includes(e.kind) && !/Nobody knows/i.test(e.text) && Number.isFinite(e.x) && Number.isFinite(e.z)).sort((a, b) => b.imp - a.imp);
  const at = arcs(sim), used = new Set<string>(), picked: SimEvent[] = [];
  for (const e of evs) { const a = at.arcForEvent(e.id)?.arc.id ?? `${e.kind}:${e.actors.slice().sort().join()}`; if (used.has(a)) continue; if (picked.some(p => Math.hypot(p.x - e.x, p.z - e.z) < 4 && p.kind === e.kind)) continue; used.add(a); picked.push(e); if (picked.length >= 4) break; }
  return picked.sort((a, b) => a.t - b.t).map(e => ({ x: e.x, z: e.z, actors: [...e.actors], kind: e.kind, icon: e.icon, t: e.t, text: e.text.includes("(It isn't true.)") ? e.text.replace(/\s*\(It isn't true\.\)/gi, '') + ' (a false rumour)' : e.text }));
}
// kind → how each restaged actor plays the memory (index 0 is the event's protagonist)
function flashbackPose(kind: string, icon: string, i: number): { anim: Anim; expr: string } {
  if (kind === 'fight') return { anim: 'fight', expr: 'angry' };
  if (kind === 'theft') return i === 0 ? { anim: 'pickup', expr: 'smirk' } : { anim: 'point', expr: 'surprised' };
  if (kind === 'romance') return icon === '💔' ? { anim: 'sad', expr: 'sad' } : { anim: i === 0 ? 'talk' : 'cheer', expr: 'love' };
  if (kind === 'party' || kind === 'festival') return { anim: 'dance', expr: 'grin' };
  if (kind === 'argue' || kind === 'accuse') return { anim: 'talk', expr: 'angry' };
  if (kind === 'gossip' || kind === 'rumor') return { anim: 'talk', expr: i === 0 ? 'smirk' : 'surprised' };
  if (kind === 'ally' || kind === 'reconcile') return { anim: 'cheer', expr: 'happy' };
  return { anim: 'talk', expr: 'happy' };
}
// Restage a montage shot: place the cast around the recorded spot facing each other, hide bystanders,
// then frame the group with a low, close two/three-shot. Cached on the shot; cleared with the montage.
function stageShot(sh: MontageShot, prefYaw: number) {
  montageOverride.clear(); montageHidden.clear();
  const cast = sh.actors.map(id => sim.byId.get(id)).filter((v): v is Villager => !!v).slice(0, 3);
  const n = cast.length, sep = sh.kind === 'fight' ? .95 : 1.3;
  const px = Math.sin(prefYaw + Math.PI / 2), pz = Math.cos(prefYaw + Math.PI / 2);
  const spots: { x: number; z: number }[] = n === 2
    ? [{ x: sh.x + px * sep * .5, z: sh.z + pz * sep * .5 }, { x: sh.x - px * sep * .5, z: sh.z - pz * sep * .5 }]
    : n === 3 ? [0, 1, 2].map(k => { const a = prefYaw + Math.PI / 2 + k * Math.PI * 2 / 3; return { x: sh.x + Math.sin(a) * .85, z: sh.z + Math.cos(a) * .85 }; })
    : [{ x: sh.x, z: sh.z }];
  for (const s of spots) if (!world.nav.isFree(s.x, s.z)) [s.x, s.z] = world.nav.nearestFree(s.x, s.z);
  const cx = spots.reduce((a, s) => a + s.x, 0) / spots.length, cz = spots.reduce((a, s) => a + s.z, 0) / spots.length;
  for (const v of sim.villagers) if (!cast.includes(v) && !v.inside && Math.hypot(v.x - cx, v.z - cz) < 11) montageHidden.add(v.id); // keep extras out of the memory
  const heads = spots.map(s => new THREE.Vector3(s.x, 1.6, s.z));
  const f = frameShot(new THREE.Vector3(cx, 1.1, cz), heads, prefYaw, 4.2, 9.5, [2.4, 3.3, 4.4], new Set(cast.map(v => v.id)));
  cast.forEach((v, i) => {
    const s = spots[i], pose = flashbackPose(sh.kind, sh.icon, i);
    const heading = n >= 2 ? Math.atan2((n === 2 ? spots[1 - i].x : cx) - s.x, (n === 2 ? spots[1 - i].z : cz) - s.z) : f.yaw + .4;
    montageOverride.set(v.id, { x: s.x, z: s.z, heading, ...pose });
    v.avatar.heading = heading; // snap the turn; the alpha fade covers the cut
  });
  sh.target = new THREE.Vector3(cx, 1.1, cz); sh.frame = f;
}
function startMontage(day: number, then: (() => void) | null = null): boolean {
  if (ffing) return false;
  const shots = pickShots(day); if (shots.length < 2) return false;
  if (beat) endBeat();
  montage = { shots, i: -1, t: 0, per: 3.4, yaw: Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z), then };
  (cine.querySelector('b') as HTMLElement).textContent = 'Previously in Thistlebrook…'; cine.classList.add('on'); document.body.classList.add('montage');
  follow = null; focusTarget = null; return true;
}
function endMontage() { if (!montage) return; const then = montage.then; montage = null; montageOverride.clear(); montageHidden.clear(); cine.classList.remove('on'); document.body.classList.remove('montage'); if (mode === 'director') dirT = 0; then?.(); }
function montageCamera(dt: number) {
  const m = montage!; m.t += dt; const idx = Math.floor(m.t / m.per);
  if (idx >= m.shots.length) { endMontage(); return; }
  const sh = m.shots[idx], u = (m.t % m.per) / m.per;
  if (idx !== m.i) { m.i = idx; m.yaw += 1.9; (cine.querySelector('em') as HTMLElement).textContent = sh.icon; (cine.querySelector('span') as HTMLElement).textContent = `Yesterday, ${fmtTime(sh.t)}: ${sh.text}`; cine.classList.remove('cut'); void cine.offsetWidth; cine.classList.add('cut'); sound.play('pop', .25); stageShot(sh, m.yaw); }
  const f = sh.frame!, yaw = f.yaw + u * .06, dist = f.dist * (1 - u * .07); // slow drift and push-in across the cut
  controls.target.copy(sh.target!); camera.position.set(sh.target!.x + Math.sin(yaw) * dist, f.h, sh.target!.z + Math.cos(yaw) * dist); camera.lookAt(controls.target);
}

// ---- cinematic beats ---------------------------------------------------------------------------------
// When something big happens while the director has the camera, cut to a framed, letterboxed shot of it:
// a low two-shot across the action line (or a three-quarter on one subject), a slow push-in, a title card,
// a touch of slow motion for brawls and a punch of camera shake on every hit. Then hand back to the director.
interface Beat { e: SimEvent; title: string; icon: string; t: number; dur: number; ids: string[]; slow: number; side: number; clear?: Framing; fixed?: [number, number, number, number]; from: { p: THREE.Vector3; t: THREE.Vector3 } }
let beat: Beat | null = null, beatCool = 0, shake = 0, beatLast = 0;
const cine = document.createElement('div'); cine.className = 'cine'; cine.innerHTML = '<i class="bar t"></i><i class="bar b"></i><div class="ct"><em></em><b></b><span></span></div>'; document.body.appendChild(cine);
function beatTitle(e: SimEvent): string | null {
  if (e.kind === 'fight' && e.icon === '💥') return 'The Brawl';
  if (e.kind === 'romance' && e.icon === '💞') return 'Sweethearts';
  if (e.kind === 'romance' && e.icon === '💔' && e.imp >= 8) return 'Heartbreak';
  if (e.kind === 'theft' && e.imp >= 7) return e.icon === '🫳' ? 'Caught Red-Handed' : 'Thief in the Night';
  if (e.kind === 'party' && e.imp >= 7) return 'Party of the Season';
  if (e.kind === 'festival') return 'Festival!';
  if (e.kind === 'rainbow') return 'After the Rain';
  if (e.kind === 'theft' && e.imp >= 5) return 'Light Fingers';
  if ((e.kind === 'accuse' || /accused/.test(e.text)) && e.imp >= 5 && e.actors.length >= 2) return 'The Accusation';
  if (e.kind === 'argue' && e.imp >= 5 && e.actors.length >= 2) return 'Words Are Exchanged';
  if (e.kind === 'reconcile' && e.actors.length >= 2) return 'Making Up';
  if (e.kind === 'ally' && e.imp >= 6) return 'An Alliance';
  if (e.kind === 'traveller' && (e.icon === '🧳' || (e.icon === '📜' && e.imp >= 8))) return e.icon === '🧳' ? 'The Storyteller' : 'The Ballad';
  return null;
}
function startBeat(e: SimEvent, force = false) {
  if (ffing) return false;
  const title = beatTitle(e); if (!title && !force) return false;
  const nowR = performance.now(); if (!force && (beat || montage || nowR < beatCool)) return false;
  const ids = e.actors.filter(id => { const v = sim.byId.get(id); return v && !v.inside && Math.hypot(v.x - e.x, v.z - e.z) < 10; }).slice(0, 2);
  const fixed: Beat['fixed'] = e.kind === 'rainbow' ? [e.x, e.z, 9, (e as any).yaw] : e.kind === 'traveller' ? [NELL[0], NELL[1] + 1.2, 1.1, .45] : e.kind === 'festival' || (e.kind === 'party' && !ids.length) ? [e.x, e.z, 1.2, -.6] : undefined;
  if (!ids.length && !fixed) return false;
  const off = camera.position.clone().sub(controls.target);
  beat = { e, title: title ?? e.kind, icon: e.icon, t: 0, dur: e.kind === 'fight' ? 7.5 : 5.5, ids, slow: e.kind === 'fight' ? .45 : .8, side: 0, fixed, from: { p: camera.position.clone(), t: controls.target.clone() } };
  beat.side = Math.atan2(off.x, off.z);
  (cine.querySelector('em') as HTMLElement).textContent = e.icon; (cine.querySelector('b') as HTMLElement).textContent = beat.title;
  (cine.querySelector('span') as HTMLElement).textContent = e.text.replace(/\s*\(It isn't true\.\)/gi, '').replace(/\s+/g, ' ');
  cine.classList.add('on'); follow = null; focusTarget = null; controls.autoRotate = false;
  return true;
}
function endBeat() { if (!beat) return; const b = beat; beat = null; cine.classList.remove('on'); beatCool = performance.now() + 6000; if (mode === 'director') { follow = b.ids[0] ?? null; if (b.fixed) focusPoint(b.fixed[0], b.fixed[1], 16); director.focus = { id: b.ids[0] ?? null, until: sim.clock + 30, reason: b.e.text }; } }
const bT = new THREE.Vector3(), bP = new THREE.Vector3(), rc = new THREE.Raycaster(), rDir = new THREE.Vector3();
const occluders: THREE.Object3D[] = [], rayHits: THREE.Intersection[] = [];
// Capture solid world scenery after build, before avatars, ambient animals and effects are added.
function cacheOccluders() {
  occluders.length = 0; scene.updateMatrixWorld(true);
  const excluded = new Set<THREE.Object3D>([...world.animals.map(a => a.obj), ...world.ducks.map(a => a.obj), ...(world.dog ? [world.dog.obj] : [])]);
  scene.traverse(o => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (excluded.has(p)) return; const m = o as THREE.Mesh; if (!m.isMesh || (m as any).isSkinnedMesh || !m.castShadow || /ground|water|sky|border-plants/i.test(m.name)) return; const mats = Array.isArray(m.material) ? m.material : [m.material]; if (mats.every(v => v.transparent && v.opacity < .8)) return; occluders.push(m); });
}
function visibleObject(o: THREE.Object3D) { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; }
function shotTarget(x: number, z: number, ids: string[]) {
  const vs = ids.map(id => sim.byId.get(id)).filter((v): v is Villager => !!v && !v.inside && Math.hypot(v.x - x, v.z - z) < 10);
  if (vs.length) { x = vs.reduce((n, v) => n + v.x, 0) / vs.length; z = vs.reduce((n, v) => n + v.z, 0) / vs.length; }
  if (!world.nav.isFree(x, z)) { const p = [...world.places.values()].filter(p => p.enterable).sort((a, b) => Math.hypot(a.cx - x, a.cz - z) - Math.hypot(b.cx - x, b.cz - z))[0]; [x, z] = p && Math.hypot(p.cx - x, p.cz - z) < 7 ? world.nav.nearestFree(p.x, p.z) : world.nav.nearestFree(x, z); }
  return new THREE.Vector3(x, 1.1, z);
}
// ---- shared framing system -----------------------------------------------------------------------
// frameShot() picks the camera for every presentation shot (beats, montage flashbacks, director care):
//  1. fit — from the subjects' spread and the live camera fov/aspect, derive the distance at which
//     every subject sits inside the frustum with a margin (clamped to the shot's min/max distance);
//  2. candidates — a short ladder of yaw offsets around the preferred bearing (the action-line side /
//     the previous camera side, for continuity), two distances and the caller's height rungs;
//  3. score — raycast each subject's head to the candidate camera against the cached solid-scenery
//     occluders (roofs, walls, trees), count other avatars within ~1.5 m of the camera→subject
//     segment on the near-camera half (foreground blockers), reject low camera spots whose ground
//     cell fails world.nav.isFree (inside a building footprint), and charge a small preference cost
//     for straying from the preferred yaw/distance/height.
// Iteration order is preference order, so the first fully clear candidate wins outright (keeping the
// raycast budget tiny); otherwise the least-bad one, and as a last resort the camera pulls in and
// rises above the clutter. Callers cache the result per shot, or re-run it every 0.5 s when following.
// Presentation-only: reads sim state, never writes it, never touches sim RNG.
interface Framing { yaw: number; dist: number; h: number }
const fsCam = new THREE.Vector3(), fsSeg = new THREE.Vector3(), fsTmp = new THREE.Vector3();
function frameShot(target: THREE.Vector3, subjects: THREE.Vector3[], prefYaw: number, minDist: number, maxDist: number, heights: number[], subjectIds?: Set<string>): Framing {
  scene.updateMatrixWorld(true);
  const solid = occluders.filter(visibleObject);
  const halfV = camera.fov * Math.PI / 360, halfF = Math.min(halfV, Math.atan(Math.tan(halfV) * camera.aspect));
  let spread = .4; for (const s of subjects) spread = Math.max(spread, Math.hypot(s.x - target.x, s.z - target.z) + .45);
  const base = Math.min(maxDist, Math.max(minDist, spread / Math.tan(halfF * .72)));
  let best: Framing = { yaw: prefYaw, dist: base * .65, h: heights[heights.length - 1] + 2.5 }, bestScore = Infinity;
  for (const off of [0, .45, -.45, .9, -.9, 1.4, -1.4, Math.PI]) for (const d of [base, Math.min(maxDist * 1.2, base * 1.3)]) for (const y of heights) {
    const yaw = prefYaw + off; fsCam.set(target.x + Math.sin(yaw) * d, y, target.z + Math.cos(yaw) * d);
    let hard = 0;
    if (fsCam.y < 3.2 && !world.nav.isFree(fsCam.x, fsCam.z)) hard += 9; // camera standing inside a wall or prop
    for (const s of subjects) { // clear line of sight from each subject's head
      rDir.copy(fsCam).sub(s); const L = rDir.length(); rDir.divideScalar(L);
      rc.set(s, rDir); rc.near = .5; rc.far = L; rayHits.length = 0; rc.intersectObjects(solid, false, rayHits);
      if (rayHits.length) { hard += 4; break; }
    }
    for (const v of sim.villagers) { // foreground blockers loitering between camera and subjects
      if (subjectIds?.has(v.id) || v.inside || montageHidden.has(v.id) || montageOverride.has(v.id)) continue;
      const p = v.avatar.root.position;
      for (const s of subjects) {
        fsSeg.copy(s).sub(fsCam); const L2 = fsSeg.lengthSq(); if (!L2) continue;
        const t = Math.min(.5, Math.max(0, fsTmp.set(p.x - fsCam.x, 1 - fsCam.y, p.z - fsCam.z).dot(fsSeg) / L2));
        const dx = fsCam.x + fsSeg.x * t - p.x, dy = fsCam.y + fsSeg.y * t - 1, dz = fsCam.z + fsSeg.z * t - p.z;
        if (dx * dx + dy * dy + dz * dz < 2.25) { hard += 2; break; }
      }
      if (hard >= 8) break;
    }
    const score = hard + Math.abs(off) * .5 + (d - base) * .04 + Math.abs(y - heights[0]) * .1;
    if (score < bestScore) { bestScore = score; best = { yaw, dist: d, h: y }; if (!hard) return best; } // first clear candidate = most preferred clear one
  }
  return best;
}
function beatCamera(dt: number) {
  if (!beat) return; const b = beat; b.t += dt; if (b.t >= b.dur || mode !== 'director' || selected) { endBeat(); return; }
  const vs = b.ids.map(id => sim.byId.get(id)!).filter(v => v && !v.inside && Math.hypot(v.x - b.e.x, v.z - b.e.z) < 10);
  let yaw: number, dist: number, h: number;
  if (b.fixed) { bT.set(b.fixed[0], b.fixed[2], b.fixed[1]); yaw = b.fixed[3] + Math.sin(b.t * .25) * .15; dist = 10 - b.t * .45; h = b.e.kind === 'rainbow' ? 7.6 : 3.2; if (b.e.kind === 'rainbow') { yaw = b.fixed[3] + b.t * .015; dist = 16 + b.t * .5; } }
  else if (vs.length >= 2) { const [a, c] = vs; bT.set((a.x + c.x) / 2, 1.15, (a.z + c.z) / 2); const line = Math.atan2(c.x - a.x, c.z - a.z); let p = line + Math.PI / 2; if (Math.cos(p - b.side) < 0) p += Math.PI; yaw = p + .25 + b.t * .03; dist = Math.min(9, Math.max(7, Math.hypot(c.x - a.x, c.z - a.z) * 1.5 + 5.4)); h = 3.8; }
  else if (vs.length) { const a = vs[0]; bT.set(a.x, 1.2, a.z); yaw = a.avatar.heading + .55 + b.t * .04; dist = 7.5; h = 3.8; }
  else { bT.copy(shotTarget(b.e.x, b.e.z, [])); yaw = b.side; dist = 8; h = 4.2; }
  if (!b.fixed) bT.copy(shotTarget(b.e.x, b.e.z, b.ids));
  if (!b.clear) { // framed once per beat: subjects' heads, action-line side as the preferred bearing
    const heads = vs.length ? vs.map(v => new THREE.Vector3(v.x, v.avatar.height + .25, v.z)) : [new THREE.Vector3(bT.x, bT.y + .5, bT.z)];
    b.clear = frameShot(bT, heads, yaw, Math.max(4.5, dist * .8), Math.max(dist, 10), [h, h + 1.2], new Set(b.ids));
  }
  yaw = b.clear.yaw + b.t * .02; dist = b.clear.dist; h = b.clear.h;
  if (b.e.kind === 'rainbow') dist += b.t * .5;
  bP.set(bT.x + Math.sin(yaw) * dist, h, bT.z + Math.cos(yaw) * dist);
  const k = Math.min(1, b.t / .9), e = k * k * (3 - 2 * k); // ease in from where the camera was
  controls.target.lerpVectors(b.from.t, bT, e); camera.position.lerpVectors(b.from.p, bP, e);
  if (shake > 0) { camera.position.x += Math.sin(b.t * 91) * shake * .09; camera.position.y += Math.sin(b.t * 127) * shake * .06; shake = Math.max(0, shake - dt * 3.5); }
  camera.lookAt(controls.target);
}

// Establishing shot on first load: a slow crane over the village before the director takes over (any click skips it).
let intro: { t: number; dur: number } | null = null;
const iA = new THREE.Vector3(), iB = new THREE.Vector3();
function startIntro() {
  intro = { t: 0, dur: 11 }; (cine.querySelector('em') as HTMLElement).textContent = '🌿'; (cine.querySelector('b') as HTMLElement).textContent = 'Thistlebrook';
  (cine.querySelector('span') as HTMLElement).textContent = `${sim.villagers.length} villagers, ${world.places.size} places, and every one of them has an opinion. Click anywhere to take over.`; cine.classList.add('on'); document.body.classList.add('intro');
}
function endIntro() { if (!intro) return; intro = null; cine.classList.remove('on'); document.body.classList.remove('intro'); }
function introCamera(dt: number) {
  if (!intro) return; intro.t += dt; const u = Math.min(1, intro.t / intro.dur), e = u * u * (3 - 2 * u);
  const ang = 2.6 - e * 1.9, r = 78 - e * 50, hgt = 48 - e * 30;
  iA.set(-9 + Math.sin(ang) * r, hgt, 2 + Math.cos(ang) * r); iB.set(-9 + (1 - e) * 4, 0, 2 - (1 - e) * 6);
  camera.position.copy(iA); controls.target.copy(iB); camera.lookAt(iB); if (u >= 1) endIntro();
}
function start() {
  const resumed = tryResume();
  ui = new UI(api, document.body);
  if (resumed) { // rebuild the story threads and the visible chronicle from the restored events
    const at = arcs(sim); for (const e of sim.events) at.ingest(e);
    ui.quiet = true; for (const e of sim.events.slice(-80)) ui.addFeed(e); ui.quiet = false;
    for (const v of sim.villagers) syncAvatar(v, .016);
    setTimeout(() => ui.toast('📂 Welcome back', `Resumed Day ${sim.day}, ${fmtTime(sim.clock)}. 🌱 starts a new village.`), 1200);
  }
  setInterval(autosave, 20000); addEventListener('pagehide', autosave); document.addEventListener('visibilitychange', () => { if (document.hidden) autosave(); });
  sim.on('dawn', () => setTimeout(autosave, 50));
  sim.on('sound', (k: string, x: number, z: number) => sound.play(k, Math.max(0, 1 - Math.hypot(x - controls.target.x, z - controls.target.z) / 40)));
  sim.on('dawn', (day: number) => { if (ffing) return; const p = director.papers[director.papers.length - 1]; if (p && ui.autoPaper && !params.has('nopaper')) { const show = () => { ui.showPaper(p); setTimeout(() => { if (ui.modal.querySelector('.paper')) ui.closeModal(); }, 20000); }; if (!(mode === 'director' && !selected && !intro && !params.has('nomontage') && speed > 0 && speed <= 4 && startMontage(day, show))) show(); } });
  sim.on('event', (e: SimEvent) => { if (mode === 'director' && !selected && !intro && !ui.quiet && !params.has('nobeats')) startBeat(e); });
  sim.on('hit', () => { if (beat) shake = 1; sound.play('scuffle', .5); });
  sky.onThunder = d => setTimeout(() => sound.play('thunder', .9), d * 1000);
  if (params.has('intro') || (!navigator.webdriver && !params.has('capture') && !params.has('nointro'))) startIntro();
  loading.classList.add('done'); setTimeout(() => loading.remove(), 900);
  requestAnimationFrame(frame);
}
// Real time runs the sim in fixed 1/30 s world steps from an accumulator, so a seed plays out the same story whatever the
// frame rate (under heavy load the excess is dropped: time slows, the sequence of steps doesn't change).
const SIM_H = 1 / 30; let simAcc = 0;
function stepSim(dtWorld: number) { simAcc += dtWorld; let n = Math.floor(simAcc / SIM_H + 1e-9); simAcc -= n * SIM_H; if (n > 240) n = 240; for (let i = 0; i < n; i++) { sim.step(SIM_H); tickTraveller(sim); tickFestival(sim); } }
// fastForward(min, true): the old coarse stepping (big steps; quick but thins out the social life)
function stepSimCoarse(dtWorld: number) { const n = Math.min(400, Math.ceil(dtWorld / SIM_H)); const h = dtWorld / n; for (let i = 0; i < n; i++) { sim.step(h); } tickTraveller(sim); tickFestival(sim); }
let cpuMsAvg = 0; // JS cost of a frame (sim + UI + draw submission) — what bounds fps on a real GPU
function frame(now: number) {
  requestAnimationFrame(frame);
  const cpu0 = performance.now(); let dt = Math.min(.1, (now - last) / 1000); last = now; perf.tick(now);
  const slow = montage ? .25 : beat && beat.t < 3.2 ? beat.slow : 1;
  const t0 = performance.now(); if (speed > 0) stepSim(dt * speed * slow); simMsAvg = simMsAvg * .9 + (performance.now() - t0) * .1;
  const adt = speed === 0 ? dt * .25 : dt * Math.min(speed, 2.5) * slow;
  for (const v of sim.villagers) syncAvatar(v, montage ? dt : speed === 0 ? 0 : adt); // flashback ghosts play/fade at wall-clock rate

  if (nell) { const on = sim.visitorUntil > sim.clock; nell.targetAlpha = on ? 1 : 0; if (on || nell.alpha > .05) { nellT += adt; nell.root.position.set(NELL[0], 0, NELL[1]); nell.targetHeading = Math.sin(nellT * .4) * .5; const k = Math.floor(nellT / 2.5) % 4; nell.anim = (['talk', 'wave', 'talk', 'cheer'] as any)[k]; nell.setExpression(k === 3 ? 'grin' : 'happy'); nell.update(speed === 0 ? 0 : adt, .8); } }
  animateGifts(sim, dt);
  world.update(adt, dt * speed * MIN_PER_SEC, sim.clock, sky.night);
  extras?.update(adt, sim.hour, sim.rain, controls.target);
  // camera
  if (beat || montage) { controls.autoRotate = false; }
  else if (mode === 'director' && !selected) { dirT -= dt; if (dirT <= 0) { dirT = 1; const pick = director.pick(sim.clock, follow); if (pick && pick.id !== follow) { follow = pick.id; } } controls.autoRotate = true; controls.autoRotateSpeed = .35; }
  else controls.autoRotate = false;
  const want = beat || intro || montage ? null : follow ? sim.byId.get(follow)!.avatar.root.position : focusTarget;
  if (want) { const k = 1 - Math.pow(.04, dt), dx = (want.x - controls.target.x) * k, dz = (want.z - controls.target.z) * k, dy = ((follow ? 1 : 0) - controls.target.y) * k; controls.target.x += dx; controls.target.z += dz; controls.target.y += dy; camera.position.x += dx; camera.position.z += dz; camera.position.y += dy;
    const wantDist = mode === 'director' ? (follow ? (mobile ? 13 : 11.5) + Math.sin(now / 9000) * 1.5 : focusDist || 24) : (focusTarget && !follow ? focusDist : 0); if (wantDist) { const off = camera.position.clone().sub(controls.target); const d = off.length(); off.multiplyScalar(1 + (wantDist / d - 1) * k * .5); camera.position.copy(controls.target).add(off); } }
  if (mode === 'director' && !beat && !intro && !montage && !selected) directorCare(dt);
  mobileFrame();
  if (montage) { montageCamera(Math.min(.25, dt)); }
  else if (intro) { introCamera(Math.min(.25, (now - (beatLast || now)) / 1000)); beatLast = now; }
  else if (!beat) controls.update(); else beatCamera(Math.min(.25, (now - (beatLast || now)) / 1000)); beatLast = now;
  sky.setShadowSpan(camera.position.distanceTo(controls.target)); sky.update(sim.hour, sim.rain, controls.target, dt * Math.max(speed, .0001)); renderer.toneMappingExposure = 1.05 + sky.golden * .1 + sky.flash * .45; world.fx.setRain(sim.rain > .12); world.fx.update(dt, controls.target);
  ambient?.update(dt, dt * speed * slow * MIN_PER_SEC, sim.hour, sim.rain, sky.night, controls.target, camera.position);
  sound.ambient(sky.night, sim.rain, dt);
  document.body.classList.toggle('cinematic', cine.classList.contains('on') || !!intro || !!montage);
  ui.frame(dt);
  pBudget = 2; for (const id of [...pQueue].sort((a, b) => (b === selected ? 1 : 0) - (a === selected ? 1 : 0)).slice(0, 2)) portrait(id); pBudget = 2;
  perf.beforeRender();
  renderer.render(scene, camera); cpuMsAvg += ((performance.now() - cpu0) - cpuMsAvg) * .1;
}

// ---- hooks for headless verification & power users -------------------------------------------------
(window as any).terrarium = {
  sim, director, world, camera, controls, renderer, scene, get fps() { return perf.fps; }, get pixelRatio() { return perf.pr; }, quality: { soft: SOFT, aa: AA }, get simMs() { return simMsAvg; }, get cpuMs() { return cpuMsAvg; },
  setSpeed: (s: number) => (speed = s), select: (id: string | null) => api.select(id), setMode: (m: any) => api.setMode(m), god: (k: string) => api.god(k), ui: () => ui,
  fastForward(minutes: number, coarse = false) { if (!Number.isFinite(minutes) || minutes <= 0) return; const quiet = ui.quiet, wasFfing = ffing; ffing = true; ui.quiet = true; try { if (coarse) stepSimCoarse(minutes / MIN_PER_SEC); else { const n = Math.max(1, Math.ceil(minutes / MIN_PER_SEC / SIM_H - 1e-6)); for (let i = 0; i < n; i++) { sim.step(SIM_H); tickTraveller(sim); tickFestival(sim); } } } finally { ffing = wasFfing; ui.quiet = quiet; } for (const v of sim.villagers) syncAvatar(v, .016); },
  cineState() { camera.updateMatrixWorld(); const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); return { beat: !!beat, montage: !!montage, target: { x: controls.target.x, y: controls.target.y, z: controls.target.z }, visible: sim.villagers.filter(v => !v.inside && visibleObject(v.avatar.root) && f.containsPoint(new THREE.Vector3(v.x, 1.1, v.z))).map(v => v.id) }; },
  look(x: number, z: number, dist = 30, yaw = .6, pitch = .9) { endIntro(); follow = null; focusTarget = null; mode = 'free'; controls.target.set(x, 0, z); camera.position.set(x + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, z + Math.cos(yaw) * Math.cos(pitch) * dist); controls.update(); },
  closeUp(id: string, dist = 3.2, side = .3) { const v = sim.byId.get(id)!; follow = null; focusTarget = null; mode = 'free'; const hd = v.avatar.heading; const hy = v.avatar.height * .8; controls.target.set(v.x, hy, v.z); camera.position.set(v.x + Math.sin(hd + side) * dist, hy + .5, v.z + Math.cos(hd + side) * dist); controls.update(); },
  beat(id?: number) { const e = id === undefined ? [...sim.events].reverse().find(x => beatTitle(x)) : sim.events.find(x => x.id === id); mode = 'director'; selected = null; return e ? startBeat(e, true) : false; }, get beatOn() { return !!beat; }, montage: (day?: number) => startMontage(day ?? Math.max(1, sim.day - 1)), get montageOn() { return !!montage; }, endMontage: () => endMontage(), rainbow: () => { ambient?.force(controls.target, camera.position); afterRain(); }, ambient: () => ambient, strike: () => sky.strike(),
  forceExpr(id: string, expr: string) { forced.set(id, { expr, until: 0 }); }, clearExpr() { forced.clear(); },
  enableLLM(cfg: LLMConfig) { localStorage.setItem('terrarium.llm', JSON.stringify(cfg)); sim.brain = new LLMBrain(cfg); console.info('LLM brain enabled (plans + reflections).'); },
  disableLLM() { localStorage.removeItem('terrarium.llm'); sim.brain = new UtilityBrain(); },
  summary() { return { day: sim.day, clock: sim.clock, events: sim.events.length, villagers: sim.villagers.map(v => ({ id: v.id, x: +v.x.toFixed(1), z: +v.z.toFixed(1), doing: v.doing, crush: v.crush, partner: v.partner, holding: sim.holding(v).map(k => k.id), food: Math.round(v.needs.food), energy: Math.round(v.needs.energy), opinions: { ...v.opinion }, alliance: v.alliance, expr: v.avatar.expr })), alliances: sim.alliances.map(a => a.name + ':' + a.members.join(',')), parties: sim.parties.map(p => `${p.title}@${p.place} invited ${p.invited.size} came ${p.attendees.size}`), kinds: sim.events.reduce((m: any, e) => (m[e.kind] = (m[e.kind] ?? 0) + 1, m), {}) }; },
};
boot().catch(e => { console.error(e); loading.querySelector('small')!.textContent = 'Something went wrong: ' + e.message; });
