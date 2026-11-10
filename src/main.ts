import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { World } from './world/world';
import { Sky } from './world/sky';
import { Avatar, type Anim } from './agents/avatar';
import { VILLAGERS } from './data/villagers';
import { Sim, MIN_PER_SEC } from './sim/sim';
import { UtilityBrain } from './sim/brain';
import { llm, type LLMConfig } from './sim/llm';
import { Director } from './sim/director';
import { storylines, findStory, storySubject } from './ui/storylines';
import { UI, type AppApi } from './ui/ui';
import { Sound } from './ui/sound';
import { dropGift, animateGifts, summonRain, spawnTraveller, tickTraveller, startFestival, tickFestival, NELL } from './sim/god';
import type { Villager, SimEvent } from './sim/types';
import { makeAnvil } from './agents/props';
import { saveGame, loadGame, clearSave, peekSave } from './core/save';
import { arcs } from './sim/arcs';
import { Ambient } from './world/ambient';
import { fmtTime } from './core/util';
import { shortLine } from './ui/bubbletext';
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
// Presentation lighting only: a broad, shadow-free camera-side key keeps dark faces readable.
const cineKey = new THREE.DirectionalLight('#c4d7ff', 0);
cineKey.visible = false; scene.add(cineKey, cineKey.target);
let cineLightFade = 0;
const cineSide = new THREE.Vector3(), cineNightTint = new THREE.Color('#abcaff');
function cinematicLight(dt: number) {
  const on = !!(beat || montage || intro);
  cineLightFade = Math.max(0, Math.min(1, cineLightFade + (on ? 1 : -1) * dt / .4));
  const darkness = Math.max(sky.night, Math.max(0, 1 - sky.sun.intensity / 1.8));
  // no extra light: adding/removing one changes every lit shader's light count (a full recompile hitch per beat),
  // so lift the existing hemisphere fill instead, cooler at night
  if (cineLightFade > 0) { sky.hemi.intensity += cineLightFade * (.1 + darkness * 1.1); sky.hemi.color.lerp(cineNightTint, cineLightFade * sky.night * .3); }
  if (false) {
    cineSide.copy(camera.position).sub(controls.target).setY(0).normalize();
    cineSide.applyAxisAngle(THREE.Object3D.DEFAULT_UP, .3).multiplyScalar(8);
    cineKey.position.copy(controls.target).add(cineSide); cineKey.position.y = controls.target.y + 7;
    cineKey.target.position.copy(controls.target);
    cineKey.color.set('#eef2ff').lerp(cineNightTint, sky.night * .75);
  }
  renderer.toneMappingExposure *= 1 + cineLightFade * darkness * .24;
}
const sim = new Sim(world); const sound = new Sound(); let musicState: import('./audio/music').MusicState = { night: 0, plaza: 0, rain: 0, winter: 0, festival: false, finale: false };
const params = new URLSearchParams(location.search);
// ?seed=N makes a whole run reproducible (the sim's own RNG plus any Math.random flavour rolls).
if (params.has('seed')) { let a = (+params.get('seed')! || 1) >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
sim.brain = new UtilityBrain();
try {
  const endpoint = params.get('llm');
  if (endpoint && endpoint !== '0') llm.configure({ endpoint, model: params.get('llmModel') ?? 'Qwen3-8B', apiKey: params.get('llmKey') ?? undefined });
  else if (endpoint !== '0') { const saved = localStorage.getItem('terrarium.llm'); if (saved) llm.configure(JSON.parse(saved) as LLMConfig); }
} catch { /* Invalid or inaccessible browser config leaves rewrites off. */ }

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

let ffing = false; let petWasMissing = false;
let pinnedStory: string | null = null;
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
const tmpV = new THREE.Vector3(), bubP = new THREE.Vector3(); let occSolid: THREE.Object3D[] = [], occSolidAt = 0;
const api: AppApi = {
  sim, director, get speed() { return speed; }, setSpeed(s) { if (s === 0 && speed > 0) lastSpeed = speed; speed = s; }, togglePause() { api.setSpeed(speed ? 0 : lastSpeed || 1); }, get selected() { return selected; },
  pinStory, get pinnedStory() { return pinnedStory; },
  select(id) { if (pinnedStory) pinStory(null); selected = id; follow = id; if (id && ui?.hint) { ui.hint.classList.add('gone'); try { localStorage.setItem('thistlebrook.hinted', '1'); } catch {} } if (id) { const v = sim.byId.get(id)!; if (v && camera.position.distanceTo(controls.target) > 24) { const dir = camera.position.clone().sub(controls.target).normalize(); controls.target.set(v.x, 1, v.z); camera.position.copy(controls.target).addScaledVector(dir, 15); } sound.play('pop'); if (mode === 'director') mode = 'free'; if (v) controls.autoRotate = false; } },
  portrait, get mode() { return mode; }, setMode(m) { if (pinnedStory) pinStory(null); mode = m; if (m === 'director') { selected = null; follow = null; } controls.autoRotate = false; },
  god(kind) {
    if (speed === 0) { ui.toast('⏸ Time is paused', 'Unpause to use god powers.'); return false; }
    if (kind === 'rain' && (sim.rain > .25 || sim.rainUntil > sim.clock)) { ui.toast('🌧️ Already raining', 'Wait for this storm to blow over.'); return false; }
    if (kind === 'gift') { const v = selected ? sim.byId.get(selected) : null; const g = dropGift(sim, v ? v.x + 3 : undefined, v ? v.z + 2 : undefined); focusPoint(g.x, g.z); } if (kind === 'rain') summonRain(sim); if (kind === 'traveller' || kind === 'merchant') { spawnTraveller(sim); focusPoint(NELL[0], NELL[1] + 2); } if (kind === 'festival') { startFestival(sim); focusPoint(-9, 5); } return true; },
  sound, project(x, y, z) { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x * .5 + .5) * innerWidth, y: (-tmpV.y * .5 + .5) * innerHeight, on: tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1 }; },
  camDist() { return camera.position.distanceTo(controls.target); },
  get hovered() { return hovered; }, get focus() { return follow; },
  camPos() { return camera.position; },
  // is a point hidden behind solid scenery (roofs, walls, trees) from the live camera? Presentation-only.
  occluded(x, y, z) {
    if (!occluders.length) return false;
    bubP.set(x, y, z); rDir.copy(bubP).sub(camera.position); const L = rDir.length(); if (L < 1) return false;
    rc.set(camera.position, rDir.divideScalar(L)); rc.near = .05; rc.far = L - .6;
    const now = performance.now(); if (now - occSolidAt > 1000) { occSolidAt = now; occSolid = occluders.filter(visibleObject); }
    rayHits.length = 0; rc.intersectObjects(occSolid, false, rayHits); return rayHits.length > 0;
  },
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
function pinStory(id: string | null): boolean {
  const s = id ? findStory(sim, id) : null; if (id && (!s || s.resolved)) return false;
  if (intro) endIntro(); if (montage) endMontage(); if (beat) endBeat();
  pinnedStory = id; selected = null; mode = 'director'; focusTarget = null;
  follow = s ? storySubject(sim, s, null) ?? s.actors[0] ?? null : null; dirT = 0; careT = 0;
  ui?.renderStorylines(); return true;
}
function storyEvent(e: SimEvent): boolean {
  if (!pinnedStory) return true; const s = findStory(sim, pinnedStory); if (!s) return false;
  const hit = arcs(sim).arcForEvent(e.id); if (s.arcId) return hit?.arc.id === s.arcId;
  const kinds: Record<string, string[]> = { wedding: ['wedding', 'romance'], search: ['search'], meeting: ['meeting'], showdown: ['showdown', 'contest'], crush: ['romance'], couple: ['romance'], alliance: ['ally'] };
  return (kinds[s.kind] ?? []).includes(e.kind) && e.actors.some(id => s.actors.includes(id));
}
function focusPoint(x: number, z: number, dist = 22) { focusTarget = new THREE.Vector3(x, 0, z); focusDist = dist; follow = null; }

// hover a villager to see their name tag (mouse only; throttled screen-space pick)
let hovered: string | null = null, hoverAt = 0;
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return; const now = performance.now(); if (now - hoverAt < 80) return; hoverAt = now;
  let best: Villager | null = null, bd = 34; for (const v of sim.villagers) { if (v.inside) continue; for (const yy of [.6, 1.3]) { const p = api.project(v.x, yy, v.z); const dd = Math.hypot(p.x - e.clientX, p.y - e.clientY); if (p.on && dd < bd) { bd = dd; best = v; } } }
  hovered = best ? best.id : null; renderer.domElement.style.cursor = best ? 'pointer' : '';
});
renderer.domElement.addEventListener('pointerleave', () => { hovered = null; });
// click to select a villager (screen-space pick)
renderer.domElement.addEventListener('pointerdown', e => { if (intro) { endIntro(); return; } if (montage) { endMontage(); return; } (renderer.domElement as any)._down = [e.clientX, e.clientY]; if (pinnedStory) pinStory(null); if (mode === 'director') { mode = 'free'; } focusTarget = null; });
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
    if (av.alpha < .999) av.snapAlpha(1); av.seated = false; av.sitH = .5;
    if (av.toolKind) av.setTool(''); if (av.carryKind) av.setCarry('');
    av.setExpression(o.expr); av.update(dt, .8); return;
  }
  av.root.position.set(v.x, 0, v.z); av.targetHeading = v.heading; av.anim = v.anim as any;
  if (beat && !v.inside && (beat.ids.includes(v.id) || beat.fixed) && av.alpha < .999) av.snapAlpha(1);
  av.targetAlpha = v.inside || (montage && montageHidden.has(v.id)) ? 0 : 1; av.seated = !!v.seat && v.anim !== 'walk' && v.anim !== 'run' && Math.hypot(v.x - v.seat.x, v.z - v.seat.z) < .35; av.sitH = (v.anim === 'sit' || av.seated) && v.seat ? v.seat.y + .04 : .5;
  const tool = WORK_TOOLS[v.anim] ?? ''; if (av.toolKind !== tool && !(window as any).__noTool) av.setTool(tool);
  const busyHands = ['chop', 'mine', 'hammer', 'hoe', 'water', 'feed', 'sit', 'fight', 'dance', 'cheer', 'pickup'].includes(v.anim);
  av.setCarry(busyHands ? '' : sim.carryFor(v));
  const al = v.alliance ? sim.alliances.find(a => a.id === v.alliance) : null; av.setBanner(al ? al.color : '');
  av.setExpression(forced.get(v.id)?.expr ?? exprFor(v));
  av.updateVisible(dt, v.anim === 'run' ? 1 : .8, camera);
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
      n++;
      camera.updateMatrixWorld(); pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frus.setFromProjectionMatrix(pm);
      const actors = sim.villagers.map(v => ({ avatar: v.avatar as Avatar, proxy: undefined as THREE.Mesh | undefined }));
      if (nell) actors.push({ avatar: nell, proxy: undefined });
      actors.push(...(extras?.renderActors() ?? []));
      let visibleCount = 0, nearCount = 0;
      const views = actors.map(({ avatar: av, proxy }) => {
        const r = av.root; sph.center.set(r.position.x, r.position.y + av.height * .5, r.position.z); sph.radius = av.height * .85;
        const onScreen = r.visible && frus.intersectsSphere(sph), d = tmp.copy(sph.center).distanceTo(camera.position);
        if (onScreen) { visibleCount++; if (d < 26) nearCount++; }
        return { av, proxy, onScreen, d };
      });
      /* Keep isolated actors detailed; dense views use the same opaque silhouette in one draw. */
      const farDistance = visibleCount > 10 ? 22 : 40, crowd = visibleCount > 10;
      if (n % (crowd ? Math.max(3, shadowEvery) : shadowEvery) === 0) renderer.shadowMap.needsUpdate = true;
      sky.setShadowSpan(camera.position.distanceTo(controls.target), crowd);
      for (const { av, proxy, onScreen, d } of views) {
        const r = av.root, proxyFar = !!proxy && d > Math.min(28, farDistance);
        if (proxy) proxy.visible = onScreen && proxyFar;
        av.body.visible = onScreen && !proxyFar;
        av.setCrowdQuality(d, farDistance, nearCount);
        let b = blobs.get(av); if (!b) { b = new THREE.Mesh(blobG, blobM); b.renderOrder = 1; scene.add(b); blobs.set(av, b); }
        b.visible = onScreen && (d >= 16 || proxyFar); b.position.set(r.position.x, .03, r.position.z);
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
  if (pinnedStory && (!fv || fv.inside)) return;
  if (!selected && !sim.villagers.some(v => !v.inside)) {
    const spot = world.places.get('plaza');
    if (spot) { follow = null; focusTarget = null; careT0.set(spot.x, 1, spot.z); const off = camera.position.clone().sub(careT0); const f = frameShot(careT0, [], Math.atan2(off.x, off.z) + .025, 22, 26, [12, 15]); controls.target.copy(careT0); camera.position.set(spot.x + Math.sin(f.yaw) * f.dist, f.h, spot.z + Math.cos(f.yaw) * f.dist); yawFix = 0; }
    return;
  }
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
  const group = sim.villagers.filter(v => !v.inside && Math.hypot(v.x - fv.x, v.z - fv.z) < 3);
  const cast = pinnedStory ? findStory(sim, pinnedStory)?.actors.map(id => sim.byId.get(id)!).filter(v => v && !v.inside && Math.hypot(v.x - fv.x, v.z - fv.z) < 15) ?? group : group;
  const f = frameShot(careT0, cast.map(v => new THREE.Vector3(v.x, v.avatar.height + .3, v.z)), yaw, Math.max(9, dist), Math.max(12, dist * 1.4), [h0, h0 + 1.4], new Set(cast.map(v => v.id)));
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
  if (kind === 'wedding') return icon === '💢' ? { anim: 'point', expr: 'angry' } : { anim: i < 2 ? 'talk' : 'cheer', expr: 'love' };
  if (kind === 'showdown') return { anim: i === 0 ? 'cheer' : 'sad', expr: i === 0 ? 'happy' : 'sad' };
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
  const place = (yaw0: number) => {
    const px = Math.sin(yaw0 + Math.PI / 2), pz = Math.cos(yaw0 + Math.PI / 2);
    const sp: { x: number; z: number }[] = n === 2
      ? [{ x: sh.x + px * sep * .5, z: sh.z + pz * sep * .5 }, { x: sh.x - px * sep * .5, z: sh.z - pz * sep * .5 }]
      : n === 3 ? [0, 1, 2].map(k => { const a = yaw0 + Math.PI / 2 + k * Math.PI * 2 / 3; return { x: sh.x + Math.sin(a) * .85, z: sh.z + Math.cos(a) * .85 }; })
      : [{ x: sh.x, z: sh.z }];
    for (const q of sp) if (!world.nav.isFree(q.x, q.z)) [q.x, q.z] = world.nav.nearestFree(q.x, q.z);
    return sp;
  };
  let spots = place(prefYaw);
  let cx = spots.reduce((a, s) => a + s.x, 0) / spots.length, cz = spots.reduce((a, s) => a + s.z, 0) / spots.length;
  for (const v of sim.villagers) if (!cast.includes(v) && !v.inside && Math.hypot(v.x - cx, v.z - cz) < 11) montageHidden.add(v.id); // keep extras out of the memory
  let heads = spots.map(s => new THREE.Vector3(s.x, 1.6, s.z));
  let f = frameShot(new THREE.Vector3(cx, 1.1, cz), heads, prefYaw, 4.2, 9.5, [3.3, 4.4, 5.5], new Set(cast.map(v => v.id)));
  // the memory is ours to restage: if the clear angle is not the one we staged for, turn the cast to face the lens side-on
  if (n >= 2 && Math.abs(Math.atan2(Math.sin(f.yaw - prefYaw), Math.cos(f.yaw - prefYaw))) > .3) {
    spots = place(f.yaw); cx = spots.reduce((a, s) => a + s.x, 0) / spots.length; cz = spots.reduce((a, s) => a + s.z, 0) / spots.length;
    heads = spots.map(s => new THREE.Vector3(s.x, 1.6, s.z)); f = frameShot(new THREE.Vector3(cx, 1.1, cz), heads, f.yaw, 4.2, 9.5, [3.3, 4.4, 5.5], new Set(cast.map(v => v.id)));
  }
  cast.forEach((v, i) => {
    const s = spots[i], pose = flashbackPose(sh.kind, sh.icon, i);
    let heading = n >= 2 ? Math.atan2((n === 2 ? spots[1 - i].x : cx) - s.x, (n === 2 ? spots[1 - i].z : cz) - s.z) : f.yaw + .4;
    if (n >= 2) { const dYaw = Math.atan2(Math.sin(f.yaw - heading), Math.cos(f.yaw - heading)); heading += Math.sign(dYaw) * Math.min(Math.abs(dYaw), .65); } // stage cheat: open up to the lens
    montageOverride.set(v.id, { x: s.x, z: s.z, heading, ...pose });
    v.avatar.heading = heading; v.avatar.snapAlpha(1); // cuts must never expose a fading body
    syncAvatar(v, 0); // stageShot runs after the normal avatar pass: place this cut immediately
  });
  sh.target = new THREE.Vector3(cx, 1.1, cz); sh.frame = f;
}
function startMontage(day: number, then: (() => void) | null = null): boolean {
  if (pinnedStory) return false;
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
  if (idx !== m.i) { m.i = idx; m.yaw += 1.9; (cine.querySelector('em') as HTMLElement).textContent = sh.icon; (cine.querySelector('span') as HTMLElement).textContent = `Yesterday, ${fmtTime(sh.t)}: ${shortLine(sh.text, 9)}`; cine.classList.remove('cut'); void cine.offsetWidth; cine.classList.add('cut'); sound.play('pop', .25); stageShot(sh, m.yaw); }
  const f = sh.frame!, yaw = f.yaw, dist = f.dist; // preserve the cached clearance across the cut
  controls.target.copy(sh.target!); camera.position.set(sh.target!.x + Math.sin(yaw) * dist, f.h, sh.target!.z + Math.cos(yaw) * dist); camera.lookAt(controls.target);
}

// ---- cinematic beats ---------------------------------------------------------------------------------
// When something big happens while the director has the camera, cut to a framed, letterboxed shot of it:
// a low two-shot across the action line (or a three-quarter on one subject), a slow push-in, a title card,
// a touch of slow motion for brawls and a punch of camera shake on every hit. Then hand back to the director.
interface Beat { e: SimEvent; title: string; icon: string; t: number; dur: number; ids: string[]; slow: number; side: number; clear?: Framing; solveAt?: number; fixed?: [number, number, number, number]; aisle?: { x: number; z: number }; from: { p: THREE.Vector3; t: THREE.Vector3 } }
let beat: Beat | null = null, beatCool = 0, shake = 0, beatLast = 0;
const cine = document.createElement('div'); cine.className = 'cine'; cine.innerHTML = '<i class="bar t"></i><i class="bar b"></i><div class="ct"><em></em><b></b><span></span></div>'; document.body.appendChild(cine);
function beatTitle(e: SimEvent): string | null {
  if (e.finale) return e.finale;
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
  if (e.kind === 'romance' && e.icon === '💍') return 'The Proposal';
  if (e.kind === 'wedding' && e.imp >= 8) return e.icon === '💢' ? 'An Objection!' : 'The Wedding';
  if (e.kind === 'showdown') return e.icon === '🏆' ? 'The Showdown Settled' : 'Showdown!';
  if (e.kind === 'search' && (e.icon === '🐕' || e.icon === '🐶')) return 'Found!';
  if (e.kind === 'search' && e.icon === '🐾' && e.imp >= 6) return 'The Search Party';
  if (e.kind === 'meeting' && e.icon === '🗳️') return 'The Vote';
  return null;
}
function startBeat(e: SimEvent, force = false) {
  if (ffing) return false;
  if (!storyEvent(e)) return false;
  const title = beatTitle(e); if (!title && !force) return false;
  const vows = e.kind === 'wedding' && title === 'The Wedding', vip = e.finale || vows; /* the vows and the finale outrank any beat in progress */
  const nowR = performance.now(); if (vip && beat && !montage) endBeat(); if (!force && (beat || montage || (!vip && nowR < beatCool))) return false;
  const ids = (vows ? e.actors.slice(0, 2) : e.actors).filter(id => { const v = sim.byId.get(id); return v && !v.inside; }).slice(0, 3);
  const fixed: Beat['fixed'] = e.finale ? [e.x, e.z, e.icon === '🎆' ? 10 : 2, -.6] : e.kind === 'rainbow' ? [e.x, e.z, 9, (e as any).yaw] : e.kind === 'traveller' ? [NELL[0], NELL[1] + 1.2, 1.1, .45] : undefined;
  if (!ids.length && !fixed) return false;
  /* Historical summaries whose cast has dispersed have no live scene to frame. */
  if (ids.some(id => { const v = sim.byId.get(id)!; const a = sim.byId.get(ids[0])!; return Math.hypot(v.x - a.x, v.z - a.z) > 18; })) return false;
  const off = camera.position.clone().sub(controls.target);
  beat = { e, title: title ?? e.kind, icon: e.icon, t: 0, dur: e.kind === 'fight' ? 7.5 : 5.5, ids, slow: e.kind === 'fight' ? .45 : .8, side: 0, fixed, from: { p: camera.position.clone(), t: controls.target.clone() } };
  beat.side = Math.atan2(off.x, off.z);
  // the wedding gets a straight-down-the-aisle shot, computed directly from the arch (e.x,e.z), held through the kiss
  if (e.kind === 'wedding' && title === 'The Wedding') { beat.aisle = { x: e.x, z: e.z }; beat.dur = 7; }
  (cine.querySelector('em') as HTMLElement).textContent = e.icon; (cine.querySelector('b') as HTMLElement).textContent = beat.title;
  (cine.querySelector('span') as HTMLElement).textContent = shortLine(e.text, 9); // one brief line; the chronicle keeps the full text
  cine.classList.add('on'); follow = null; focusTarget = null; controls.autoRotate = false;
  if (vows) sound.cue('wedding'); else if (beat.title === 'Found!') sound.cue('flourish'); else if (e.kind === 'fight' || e.kind === 'showdown') sound.cue('sting');
  return true;
}
function endBeat() { if (!beat) return; const b = beat; beat = null; cine.classList.remove('on'); beatCool = performance.now() + 6000; if (mode === 'director') { follow = b.ids[0] ?? null; if (b.fixed) focusPoint(b.fixed[0], b.fixed[1], 16); director.focus = { id: b.ids[0] ?? null, until: sim.clock + 30, reason: b.e.text }; } }
const bT = new THREE.Vector3(), bP = new THREE.Vector3(), rc = new THREE.Raycaster(), rDir = new THREE.Vector3();
const occluders: THREE.Object3D[] = [], rayHits: THREE.Intersection[] = [];
// Capture solid world scenery after build, before avatars, ambient animals and effects are added.
function cacheOccluders() {
  occluders.length = 0; scene.updateMatrixWorld(true);
  const excluded = new Set<THREE.Object3D>([...world.animals.map(a => a.obj), ...world.ducks.map(a => a.obj), ...(world.dog ? [world.dog.obj] : [])]);
  scene.traverse(o => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (excluded.has(p)) return; const m = o as THREE.Mesh; if (!m.isMesh || (m as any).isSkinnedMesh || /ground|water|sky/i.test(m.name)) return; const mats = Array.isArray(m.material) ? m.material : [m.material]; if (mats.every(v => v.transparent && v.opacity < .8)) return; occluders.push(m); });
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
//  3. score — raycast from the candidate lens to heads and shoulders against cached solid-scenery
//     occluders (roofs, walls, trees), count other avatars within ~1.5 m of the camera→subject
//     segment on the near-camera half (foreground blockers), reject low camera spots whose ground
//     cell fails world.nav.isFree (inside a building footprint), and charge a small preference cost
//     for straying from the preferred yaw/distance/height.
// Cheap clearance ranking selects six diverse candidates, including higher alternatives;
// Full-body bounds respect cinematic bars; wedding fans also probe elevated front-facing alternatives.
// Callers cache the result or re-run it every 0.5 s when following.
// Presentation-only: reads sim state, never writes it, never touches sim RNG.
interface Framing { yaw: number; dist: number; h: number; visible?: boolean }
interface ShotBox { x: number; z: number; height: number; radius: number; bottom?: number }
const fsCam = new THREE.Vector3(), fsSeg = new THREE.Vector3(), fsTmp = new THREE.Vector3();
function frameShot(target: THREE.Vector3, subjects: THREE.Vector3[], prefYaw: number, minDist: number, maxDist: number, heights: number[], subjectIds?: Set<string>, boxes: ShotBox[] = [], yawOffsets = [0, .45, -.45, .9, -.9, 1.4, -1.4, Math.PI]): Framing {
  scene.updateMatrixWorld(true);
  const solid = occluders.filter(visibleObject);
  const halfV = camera.fov * Math.PI / 360, halfF = Math.min(halfV, Math.atan(Math.tan(halfV) * camera.aspect));
  let spread = .4; for (const s of subjects) spread = Math.max(spread, Math.hypot(s.x - target.x, s.z - target.z) + .45);
  const base = Math.max(minDist, spread / Math.tan(halfF * .72));
  /* Fit every body corner in camera coordinates, including feet and the 11% cinematic bars. */
  const bounds: ShotBox[] = [...subjects.map(s => ({ x: s.x, z: s.z, height: s.y + .15, radius: .45 })), ...boxes];
  const corners = bounds.flatMap(b => [-1, 1].flatMap(dx => [-1, 1].flatMap(dz => [b.bottom ?? .05, b.height].map(y => new THREE.Vector3(b.x + dx * b.radius, y, b.z + dz * b.radius)))));
  const fitV = Math.tan(halfV) * .68, fitH = Math.tan(halfV) * camera.aspect * .86;
  const fitCamera = new THREE.PerspectiveCamera(camera.fov, camera.aspect, .1, 1000);
  // Rank cheaply before testing scenery rays; wedding fans retain all front-facing bearings.
  const candidates: { frame: Framing; penalty: number }[] = [];
  const rungs = [...new Set([...heights, 5.5])];
  for (const off of yawOffsets) for (const initial of [base, Math.max(base, maxDist)]) for (const y of rungs) {
    const yaw = prefYaw + off; let d = initial;
    for (let step = 0; step < 40; step++) {
      fitCamera.position.set(target.x + Math.sin(yaw) * d, y, target.z + Math.cos(yaw) * d); fitCamera.lookAt(target); fitCamera.updateMatrixWorld(true);
      if (corners.every(p => { const q = p.clone().applyMatrix4(fitCamera.matrixWorldInverse); return q.z < -.1 && Math.abs(q.x) < -q.z * fitH && Math.abs(q.y) < -q.z * fitV; })) break;
      d *= 1.08;
    }
    const x = target.x + Math.sin(yaw) * d, z = target.z + Math.cos(yaw) * d;
    let penalty = Math.abs(off) * .2 + (d - base) * .04 + Math.abs(y - heights[0]) * .04;
    if (y < 7) {
      // Exact cell-box clearance, including diagonal wall corners, rather than eight sparse samples.
      const nav = world.nav, radius = y <= 5.5 ? 1.6 : .8;
      for (let j = nav.iz(z - radius); j <= nav.iz(z + radius); j++) for (let i = nav.ix(x - radius); i <= nav.ix(x + radius); i++) {
        if (nav.inside(i, j) && !nav.blocked[j * nav.w + i]) continue;
        const dx = Math.max(0, Math.abs(nav.wx(i) - x) - nav.cell / 2), dz = Math.max(0, Math.abs(nav.wz(j) - z) - nav.cell / 2);
        if (dx * dx + dz * dz < radius * radius) penalty += 10;
      }
    }
    candidates.push({ frame: { yaw, dist: d, h: y }, penalty });
  }
  candidates.sort((a, b) => a.penalty - b.penalty);
  // Spread bearings/heights so a wall at the preferred angle cannot consume the whole budget.
  const shortlist = candidates.filter((c, i, all) => all.findIndex(q => Math.abs(q.frame.yaw - c.frame.yaw) < .01 && q.frame.h === c.frame.h) === i);
  const chosen = yawOffsets.length === 5 ? shortlist.filter(c => c.frame.h === heights[0] || c.frame.h === 7.5) : [shortlist[0]];
  for (const c of shortlist) {
    if (chosen.length >= 3) break;
    if (!chosen.some(q => Math.abs(q.frame.yaw - c.frame.yaw) < .4)) chosen.push(c);
  }
  for (const q of [...chosen]) {
    const high = shortlist.find(c => Math.abs(c.frame.yaw - q.frame.yaw) < .01 && c.frame.h >= 5.5 && c !== q);
    if (high && chosen.length < 6) chosen.push(high);
  }
  if (chosen.length < 6) for (const c of shortlist) { if (!chosen.includes(c)) chosen.push(c); if (chosen.length === 6) break; }
  let best = chosen[0].frame, bestScore = Infinity;
  for (const c of chosen) {
    const { yaw, dist: d, h: y } = c.frame;
    fsCam.set(target.x + Math.sin(yaw) * d, y, target.z + Math.cos(yaw) * d);
    let hard = c.penalty, visible = c.penalty < 10;
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    // Head rays protect faces; shoulder, midpoint and frame-center rays catch thin trunks/poles.
    const probes = subjects.slice(0, 3).map(s => s.clone());
    for (const s of subjects.slice(0, 2)) for (const side of [-1, 1]) probes.push(s.clone().addScaledVector(right, side * .4).add(new THREE.Vector3(0, -.4, 0)));
    probes.push(target.clone());
    if (subjects.length > 1) probes.push(subjects[0].clone().add(subjects[1]).multiplyScalar(.5));
    for (const side of [-1, 1]) probes.push(target.clone().addScaledVector(right, side * d * Math.tan(halfF) * .7));
    for (const box of boxes) probes.unshift(new THREE.Vector3(box.x, (box.height + (box.bottom ?? 0)) / 2, box.z));
    for (const [i, point] of probes.entries()) {
      rDir.copy(point).sub(fsCam); const L = rDir.length(); if (L < .01) continue;
      rc.set(fsCam, rDir.divideScalar(L)); rc.near = .05; rc.far = Math.max(.05, L - .35);
      rayHits.length = 0; rc.intersectObjects(solid, false, rayHits); // native InstancedMesh.raycast preserves instance transforms
      if (rayHits.length) { hard += rayHits[0].distance < L * .6 ? 12 : i < subjects.length + boxes.length ? 8 : 2; if (i < subjects.length + boxes.length) visible = false; }
    }
    for (let i = 0; i < subjects.length; i++) for (let j = i + 1; j < subjects.length; j++) { // subjects hiding behind each other
      const ai = Math.atan2(subjects[i].x - fsCam.x, subjects[i].z - fsCam.z), aj = Math.atan2(subjects[j].x - fsCam.x, subjects[j].z - fsCam.z);
      if (Math.abs(Math.atan2(Math.sin(ai - aj), Math.cos(ai - aj))) < .16) hard += 6;
    }
    for (const v of sim.villagers) {
      if (subjectIds?.has(v.id) || v.inside || montageHidden.has(v.id) || montageOverride.has(v.id)) continue;
      const p = v.avatar.root.position;
      fsSeg.copy(target).sub(fsCam); const L2 = fsSeg.lengthSq(); if (!L2) continue;
      const t = Math.max(0, Math.min(.6, fsTmp.set(p.x - fsCam.x, 1 - fsCam.y, p.z - fsCam.z).dot(fsSeg) / L2));
      if (fsTmp.copy(fsCam).addScaledVector(fsSeg, t).distanceToSquared(new THREE.Vector3(p.x, 1, p.z)) < 2.25) hard += 4;
    }
    if (!visible) hard += 1000;
    if (hard < bestScore) { bestScore = hard; best = { ...c.frame, visible }; }
  }
  return best;
}
function beatCamera(dt: number) {
  if (!beat) return; const b = beat; b.t += dt; if (b.t >= b.dur || mode !== 'director' || selected) { endBeat(); return; }
  const vs = b.ids.map(id => sim.byId.get(id)!).filter(v => v && !v.inside);
  if (!b.fixed && vs.length !== b.ids.length) { endBeat(); return; }
  const boxes: ShotBox[] = [];
  if (b.title === 'Found!' && sim.pet && world.dog) { const p = world.dog.obj.position; boxes.push({ x: p.x, z: p.z, height: .7, radius: .5 }); }
  const cast = b.title === 'Found!' ? vs.slice(0, 1) : vs; /* Found!: the finder and the dog, close; the owner may be across the village */
  const heads = cast.map(v => new THREE.Vector3(v.x, v.avatar.height + .25, v.z));
  let yaw = b.side, dist = b.title === 'Found!' ? 6 : 9, h = b.title === 'Found!' ? 3 : 4.2;
  if (b.fixed) { bT.set(b.fixed[0], b.fixed[2], b.fixed[1]); yaw = b.fixed[3]; dist = 16; h = 7.6; }
  else {
    const points = [...heads, ...boxes.map(p => new THREE.Vector3(p.x, .35, p.z))];
    if (!points.length) { endBeat(); return; }
    bT.set(points.reduce((n, p) => n + p.x, 0) / points.length, 1.1, points.reduce((n, p) => n + p.z, 0) / points.length);
    if (cast.length >= 2) { const [a, c] = cast; yaw = Math.atan2(c.x - a.x, c.z - a.z) + Math.PI / 2; if (Math.cos(yaw - b.side) < 0) yaw += Math.PI; }
  }
  if (b.aisle) {
    yaw = 0; dist = 12; h = 7.5; /* raised so the shot clears the eaves either side of the chapel lane */
    boxes.push({ x: b.aisle.x, z: b.aisle.z, height: 2.9, radius: 1.4 });
    /* Guests and officiant belong in the wedding composition as well. */
    for (const v of sim.villagers) if (!v.inside && !b.ids.includes(v.id) && Math.hypot(v.x - b.aisle.x, v.z - b.aisle.z) < 5) boxes.push({ x: v.x, z: v.z, height: v.avatar.height + .2, radius: .4 });
  }
  if (b.e.finale) { dist = 22; h = 13; } /* season finale: wide over the plaza */
  if (!b.clear || b.t >= (b.solveAt ?? 0)) {
    b.clear = frameShot(bT, heads, yaw, dist, b.e.finale ? 26 : 14, b.e.finale ? [13, 16, 19] : b.aisle ? [h, 9.5, 11.5] : [h, 5.5, 7.5], new Set(b.ids), boxes, b.aisle ? [0, .3, -.3, .61, -.61] : undefined);
    b.solveAt = b.t + .5;
    if (!b.fixed && !b.aisle && b.title !== 'Found!' && !b.clear.visible) { endBeat(); return; } /* a dog found in the woods is worth a slightly leafy frame */
  }
  yaw = b.clear.yaw; dist = b.clear.dist; h = b.clear.h;
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
  (cine.querySelector('span') as HTMLElement).textContent = `${sim.villagers.length} villagers, each with a story. Click anywhere to look around.`; cine.classList.add('on'); document.body.classList.add('intro');
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
  sim.on('letterRead', (l, v) => { if (!ffing && (selected === v.id || follow === v.id || Math.hypot(camera.position.x - v.x, camera.position.z - v.z) < 24)) ui.showLetter(l, true); });
  sim.on('sound', (k: string, x: number, z: number) => sound.play(k, Math.max(0, 1 - Math.hypot(x - controls.target.x, z - controls.target.z) / 40)));
  sim.on('dawn', (day: number) => { if (ffing || pinnedStory) return; const p = director.papers[director.papers.length - 1]; if (p && ui.autoPaper && !params.has('nopaper')) { const show = () => { ui.showPaper(p); setTimeout(() => { if (ui.modal.querySelector('.paper')) ui.closeModal(); }, 20000); }; if (!(mode === 'director' && !selected && !intro && !params.has('nomontage') && speed > 0 && speed <= 4 && startMontage(day, show))) show(); } });
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
const phases = { sim: 0, avatars: 0, world: 0, ui: 0, culling: 0, render: 0 }; let phaseFrames = 0;
const phaseRolling = { ...phases }, phasePrevious = { ...phases };
const phaseKeys = Object.keys(phases) as (keyof typeof phases)[];
const phaseWindow = { ...phases }; let phaseWindowFrames = 0;
function perfStats(reset = false) {
  const n = phaseFrames - phaseWindowFrames;
  const ms = Object.fromEntries(Object.entries(phases).map(([k, v]) => [k, n ? +( (v - phaseWindow[k as keyof typeof phases]) / n).toFixed(3) : 0]));
  if (reset) { Object.assign(phaseWindow, phases); phaseWindowFrames = phaseFrames; }
  return { frames: n, ms: { ...phaseRolling }, intervalMs: ms, /* CPU submission timings; GPU/compositor work is reflected in fps. */ fps: perf.fps };
}
let cpuMsAvg = 0; // JS cost of a frame (sim + UI + draw submission) — what bounds fps on a real GPU
function frame(now: number) {
  requestAnimationFrame(frame);
  const cpu0 = performance.now(); let phaseStart = cpu0; let dt = Math.min(.1, (now - last) / 1000); last = now; perf.tick(now);
  const slow = montage ? .25 : beat && beat.t < 3.2 ? beat.slow : 1;
  const t0 = performance.now(); if (speed > 0) stepSim(dt * speed * slow); simMsAvg = simMsAvg * .9 + (performance.now() - t0) * .1;
  phases.sim += performance.now() - phaseStart; phaseStart = performance.now();
  camera.updateMatrixWorld();
  const adt = speed === 0 ? dt * .25 : dt * Math.min(speed, 2.5) * slow;
  for (const v of sim.villagers) syncAvatar(v, montage ? dt : speed === 0 ? 0 : adt); // flashback ghosts play/fade at wall-clock rate

  if (nell) { const on = sim.visitorUntil > sim.clock; nell.targetAlpha = on ? 1 : 0; if (on || nell.alpha > .05) { nellT += adt; nell.root.position.set(NELL[0], 0, NELL[1]); nell.targetHeading = Math.sin(nellT * .4) * .5; const k = Math.floor(nellT / 2.5) % 4; nell.anim = (['talk', 'wave', 'talk', 'cheer'] as any)[k]; nell.setExpression(k === 3 ? 'grin' : 'happy'); nell.update(speed === 0 ? 0 : adt, .8); } }
  phases.avatars += performance.now() - phaseStart; phaseStart = performance.now();
  animateGifts(sim, dt);
  world.update(adt, dt * speed * MIN_PER_SEC, sim.clock, sky.night, sim.day, sim.rain);
  if ((world as any).dog?.obj && sim.pet) { const dg = (world as any).dog, missing = sim.pet.state === 'missing'; dg.obj.visible = !missing; if (petWasMissing && !missing) { dg.x = dg.tx = sim.pet.x; dg.z = dg.tz = sim.pet.z; } petWasMissing = missing; } // reappear right where the finder is
  { const wp = sim.parties.find(p => p.wedding && !p.done && sim.clock >= p.at - 300); world.setWeddingArch(wp ? sim.place(wp.place) : null); } // arch up on the wedding-day morning, struck when the party ends
  const extraStart = performance.now(); extras?.update(adt, sim.hour, sim.rain, controls.target, camera.position, camera); const extraMs = performance.now() - extraStart; phases.avatars += extraMs;
  // camera
  if (beat || montage) { controls.autoRotate = false; }
  else if (mode === 'director' && !selected) { dirT -= dt; if (dirT <= 0) { dirT = 1; const story = pinnedStory ? findStory(sim, pinnedStory) : null;
      if (pinnedStory && (!story || story.resolved)) { const title = story?.title ?? 'The chapter has closed'; pinStory(null); ui.toast('📺 Storyline resolved', title); sound.cue('flourish'); }
      const subject = story && !story.resolved ? storySubject(sim, story, follow) : null;
      const pick = pinnedStory ? (subject ? { id: subject } : null) : director.pick(sim.clock, follow); if (pick && pick.id !== follow) { follow = pick.id; } } controls.autoRotate = true; controls.autoRotateSpeed = .35; }
  else controls.autoRotate = false;
  const want = beat || intro || montage ? null : follow ? sim.byId.get(follow)!.avatar.root.position : focusTarget;
  if (want) { const k = 1 - Math.pow(.04, dt), dx = (want.x - controls.target.x) * k, dz = (want.z - controls.target.z) * k, dy = ((follow ? 1 : 0) - controls.target.y) * k; controls.target.x += dx; controls.target.z += dz; controls.target.y += dy; camera.position.x += dx; camera.position.z += dz; camera.position.y += dy;
    const wantDist = mode === 'director' ? (follow ? (mobile ? 13 : 11.5) + Math.sin(now / 9000) * 1.5 : focusDist || 24) : (focusTarget && !follow ? focusDist : 0); if (wantDist) { const off = camera.position.clone().sub(controls.target); const d = off.length(); off.multiplyScalar(1 + (wantDist / d - 1) * k * .5); camera.position.copy(controls.target).add(off); } }
  if ((mode === 'director' || selected) && !beat && !intro && !montage) directorCare(dt);
  mobileFrame();
  if (montage) { montageCamera(Math.min(.25, dt)); }
  else if (intro) { introCamera(Math.min(.25, (now - (beatLast || now)) / 1000)); beatLast = now; }
  else if (!beat) controls.update(); else beatCamera(Math.min(.25, (now - (beatLast || now)) / 1000)); beatLast = now;
  world.setFinale(sim.finaleUntil > sim.clock);
  const plaza = sim.place('plaza'); world.fx.setFireworks(sim.fireworksUntil > sim.clock, dt, plaza.cx, plaza.cz); sky.festivalGlow = world.fx.fireworksLight;
  sky.update(sim.hour, sim.rain, controls.target, dt * Math.max(speed, .0001), world.season); renderer.toneMappingExposure = 1.05 + sky.golden * .1 + sky.flash * .45; cinematicLight(dt); world.fx.setRain(sim.rain > .12 && world.season.snow < .5); world.fx.update(dt, controls.target);
  world.fx.winter.update(dt, controls.target, world.season.snow, sim.rain);
  for (const v of sim.villagers) world.fx.winter.breath(dt, v.avatar, !v.inside);
  ambient?.update(dt, dt * speed * slow * MIN_PER_SEC, sim.hour, sim.rain, sky.night, controls.target, camera.position);
  { const pz = sim.place('plaza'), dPlaza = Math.hypot(controls.target.x - pz.cx, controls.target.z - pz.cz);
    musicState = { night: sky.night, plaza: Math.max(0, Math.min(1, 1 - (dPlaza - 12) / 22)), rain: sim.rain, winter: world.season.snow, festival: sim.festivalUntil > sim.clock, finale: sim.finaleUntil > sim.clock };
    sound.update(musicState); }
  document.body.classList.toggle('cinematic', cine.classList.contains('on') || !!intro || !!montage);
  phases.world += performance.now() - phaseStart - extraMs; phaseStart = performance.now();
  ui.frame(dt);
  pBudget = 2; for (const id of [...pQueue].sort((a, b) => (b === selected ? 1 : 0) - (a === selected ? 1 : 0)).slice(0, 2)) portrait(id); pBudget = 2;
  phases.ui += performance.now() - phaseStart; phaseStart = performance.now();
  perf.beforeRender();
  phases.culling += performance.now() - phaseStart; phaseStart = performance.now();
  renderer.render(scene, camera); phases.render += performance.now() - phaseStart; phaseFrames++;
  for (const k of phaseKeys) { const sample = phases[k] - phasePrevious[k]; phasePrevious[k] = phases[k]; phaseRolling[k] += (sample - phaseRolling[k]) * (phaseFrames === 1 ? 1 : .1); }
  cpuMsAvg += ((performance.now() - cpu0) - cpuMsAvg) * .1;
}

// ---- hooks for headless verification & power users -------------------------------------------------
(window as any).terrarium = {
  letters: () => sim.letterArchive.map(l => ({ ...l, readers: [...l.readers] })),
  season: () => ({ name: world.season.name, snow: world.season.snow, day: sim.day }),
  sim, director, world, camera, controls, renderer, scene, perfStats,
  characterTriangles: () => sim.villagers.map(v => ({ id: v.id, ...v.avatar.triangleCounts() })), get fps() { return perf.fps; }, get pixelRatio() { return perf.pr; }, quality: { soft: SOFT, aa: AA }, get simMs() { return simMsAvg; }, get cpuMs() { return cpuMsAvg; },
  storylines: () => storylines(sim), pinStory, musicState: () => ({ ...musicState }),
  setSpeed: (s: number) => (speed = s), select: (id: string | null) => api.select(id), setMode: (m: any) => api.setMode(m), god: (k: string) => api.god(k), ui: () => ui,
  fastForward(minutes: number, coarse = false) { if (!Number.isFinite(minutes) || minutes <= 0) return; const quiet = ui.quiet, wasFfing = ffing; ffing = true; ui.quiet = true; try { if (coarse) stepSimCoarse(minutes / MIN_PER_SEC); else { const n = Math.max(1, Math.ceil(minutes / MIN_PER_SEC / SIM_H - 1e-6)); for (let i = 0; i < n; i++) { sim.step(SIM_H); tickTraveller(sim); tickFestival(sim); } } } finally { ffing = wasFfing; ui.quiet = quiet; } for (const v of sim.villagers) syncAvatar(v, .016); },
  cineState() { camera.updateMatrixWorld(); const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); return { beat: !!beat, montage: !!montage, target: { x: controls.target.x, y: controls.target.y, z: controls.target.z }, visible: sim.villagers.filter(v => !v.inside && visibleObject(v.avatar.root) && f.containsPoint(new THREE.Vector3(v.x, 1.1, v.z))).map(v => v.id) }; },
  look(x: number, z: number, dist = 30, yaw = .6, pitch = .9) { if (pinnedStory) pinStory(null); endIntro(); follow = null; focusTarget = null; mode = 'free'; controls.target.set(x, 0, z); camera.position.set(x + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, z + Math.cos(yaw) * Math.cos(pitch) * dist); controls.update(); },
  closeUp(id: string, dist = 3.2, side = .3) { if (pinnedStory) pinStory(null); const v = sim.byId.get(id)!; follow = null; focusTarget = null; mode = 'free'; const hd = v.avatar.heading; const hy = v.avatar.height * .8; controls.target.set(v.x, hy, v.z); camera.position.set(v.x + Math.sin(hd + side) * dist, hy + .5, v.z + Math.cos(hd + side) * dist); controls.update(); },
  beat(id?: number) { const e = id === undefined ? [...sim.events].reverse().find(x => beatTitle(x)) : sim.events.find(x => x.id === id); mode = 'director'; selected = null; return e ? startBeat(e, true) : false; }, get beatOn() { return !!beat; }, montage: (day?: number) => startMontage(day ?? Math.max(1, sim.day - 1)), get montageOn() { return !!montage; }, endMontage: () => endMontage(), rainbow: () => { ambient?.force(controls.target, camera.position); afterRain(); }, ambient: () => ambient, strike: () => sky.strike(),
  forceExpr(id: string, expr: string) { forced.set(id, { expr, until: 0 }); }, clearExpr() { forced.clear(); },
  enableLLM(cfg: LLMConfig) { llm.configure(cfg); try { localStorage.setItem('terrarium.llm', JSON.stringify(cfg)); } catch {} },
  disableLLM() { llm.configure(null); try { localStorage.removeItem('terrarium.llm'); } catch {} },
  llmStatus() { return llm.status(); },
  summary() { return { day: sim.day, clock: sim.clock, events: sim.events.length, villagers: sim.villagers.map(v => ({ id: v.id, x: +v.x.toFixed(1), z: +v.z.toFixed(1), doing: v.doing, crush: v.crush, partner: v.partner, holding: sim.holding(v).map(k => k.id), food: Math.round(v.needs.food), energy: Math.round(v.needs.energy), opinions: { ...v.opinion }, alliance: v.alliance, expr: v.avatar.expr })), alliances: sim.alliances.map(a => a.name + ':' + a.members.join(',')), parties: sim.parties.map(p => `${p.title}@${p.place} invited ${p.invited.size} came ${p.attendees.size}`), kinds: sim.events.reduce((m: any, e) => (m[e.kind] = (m[e.kind] ?? 0) + 1, m), {}) }; },
};
boot().catch(e => { console.error(e); loading.querySelector('small')!.textContent = 'Something went wrong: ' + e.message; });
