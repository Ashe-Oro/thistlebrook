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
import { dropGift, animateGifts, summonRain, spawnMerchant, tickMerchant, startFestival, tickFestival } from './sim/god';
import type { Villager } from './sim/types';
import { makeAnvil } from './agents/props';

const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const app = document.getElementById('app')!;
const loading = document.createElement('div'); loading.className = 'loading'; loading.innerHTML = `<div class="lc"><div class="lg">🌿</div><h1>Thistlebrook</h1><p>a digital terrarium</p><div class="pb"><i></i></div><small>Waking the village…</small></div>`; document.body.appendChild(loading);
const setProg = (f: number, msg?: string) => { (loading.querySelector('.pb i') as HTMLElement).style.width = `${Math.round(f * 100)}%`; if (msg) loading.querySelector('small')!.textContent = msg; };

const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance', preserveDrawingBuffer: new URLSearchParams(location.search).has('capture') });
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
  for (const def of VILLAGERS) { const av = new Avatar(def, def.id.length * 977 + def.name.charCodeAt(0)); scene.add(av.root); sim.addVillager(def, av); await new Promise(r => setTimeout(r, 0)); }
  sim.initRelations();
  if (params.has('seed')) sim.rng = new (sim.rng.constructor as any)(+params.get('seed')!);
  setProg(1, 'Good morning, Thistlebrook.');
  start();
}

let speed = 1, mode: 'director' | 'free' = params.get('cam') === 'free' ? 'free' : 'director', selected: string | null = null; let acc = 0; let follow: string | null = null; let dirT = 0;
const director = new Director(sim);
const rt = new THREE.WebGLRenderTarget(192, 192, { colorSpace: THREE.SRGBColorSpace } as any); const pcam = new THREE.PerspectiveCamera(30, 1, .05, 40); const pbuf = new Uint8Array(192 * 192 * 4); const portraits = new Map<string, HTMLCanvasElement>(); const pTime = new Map<string, number>();
function portrait(id: string) {
  let c = portraits.get(id); if (!c) { c = document.createElement('canvas'); c.width = c.height = 192; c.className = 'portrait'; portraits.set(id, c); }
  const v = sim.byId.get(id)!; const now = performance.now(); if (v.inside && pTime.has(id)) return c; if (now - (pTime.get(id) ?? 0) < 300) return c; pTime.set(id, now);
  const head = new THREE.Vector3(); v.avatar.bones.Head.getWorldPosition(head); head.y += .12; const hd = v.avatar.root.rotation.y;
  const wasVis = v.avatar.root.visible, oldA = v.avatar.alpha; if (!wasVis) { v.avatar.root.visible = true; for (const m of v.avatar.mats) { m.opacity = 1; m.transparent = false; } }
  pcam.position.set(head.x + Math.sin(hd + .35) * 1.15, head.y + .08, head.z + Math.cos(hd + .35) * 1.15); pcam.lookAt(head.x, head.y - .02, head.z); pcam.updateMatrixWorld();
  const tags = ui ? null : null; void tags;
  renderer.setRenderTarget(rt); renderer.render(scene, pcam); renderer.readRenderTargetPixels(rt, 0, 0, 192, 192, pbuf); renderer.setRenderTarget(null);
  if (!wasVis) { v.avatar.root.visible = false; for (const m of v.avatar.mats) { m.opacity = oldA; m.transparent = true; } }
  const g = c.getContext('2d')!, img = g.createImageData(192, 192); for (let y = 0; y < 192; y++) img.data.set(pbuf.subarray((191 - y) * 768, (192 - y) * 768), y * 768); g.putImageData(img, 0, 0);
  return c;
}
const tmpV = new THREE.Vector3();
const api: AppApi = {
  sim, director, get speed() { return speed; }, setSpeed(s) { speed = s; }, get selected() { return selected; },
  select(id) { selected = id; follow = id; if (id) { const v = sim.byId.get(id)!; sound.play('pop'); if (mode === 'director') mode = 'free'; if (v) controls.autoRotate = false; } },
  portrait, get mode() { return mode; }, setMode(m) { mode = m; if (m === 'director') { selected = null; follow = null; } controls.autoRotate = false; },
  god(kind) { if (kind === 'gift') { const v = selected ? sim.byId.get(selected) : null; const g = dropGift(sim, v ? v.x + 3 : undefined, v ? v.z + 2 : undefined); focusPoint(g.x, g.z); } if (kind === 'rain') summonRain(sim); if (kind === 'merchant') { spawnMerchant(sim); focusPoint(-19, 5); } if (kind === 'festival') { startFestival(sim); focusPoint(-9, 5); } },
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
  av.targetAlpha = v.inside ? 0 : 1; av.sitH = v.anim === 'sit' && v.seat ? v.seat.y + .04 : .5;
  const tool = WORK_TOOLS[v.anim] ?? ''; if (av.toolKind !== tool && !(window as any).__noTool) av.setTool(tool);
  const busyHands = ['chop', 'mine', 'hammer', 'hoe', 'water', 'feed', 'sit', 'fight', 'dance', 'cheer', 'pickup'].includes(v.anim);
  av.setCarry(busyHands ? '' : sim.carryFor(v));
  const al = v.alliance ? sim.alliances.find(a => a.id === v.alliance) : null; av.setBanner(al ? al.color : '');
  av.setExpression(forced.get(v.id)?.expr ?? exprFor(v));
  av.update(dt, v.anim === 'run' ? 1 : .8);
}
const forced = new Map<string, { expr: string; until: number }>();

let last = performance.now(), fpsAvg = 60, simMsAvg = 0;
function start() {
  ui = new UI(api, document.body);
  sim.on('sound', (k: string, x: number, z: number) => sound.play(k, Math.max(0, 1 - Math.hypot(x - controls.target.x, z - controls.target.z) / 40)));
  sim.on('dawn', () => { const p = director.papers[director.papers.length - 1]; if (p && ui.autoPaper && !params.has('nopaper')) { ui.showPaper(p); setTimeout(() => { if (ui.modal.querySelector('.paper')) ui.closeModal(); }, 9000); } });
  loading.classList.add('done'); setTimeout(() => loading.remove(), 900);
  requestAnimationFrame(frame);
}
function stepSim(dtWorld: number) { const n = Math.min(400, Math.ceil(dtWorld / (1 / 30))); const h = dtWorld / n; for (let i = 0; i < n; i++) { sim.step(h); } tickMerchant(sim); tickFestival(sim); }
function frame(now: number) {
  requestAnimationFrame(frame);
  let dt = Math.min(.1, (now - last) / 1000); last = now; fpsAvg = fpsAvg * .95 + (1 / Math.max(dt, 1e-3)) * .05;
  const t0 = performance.now(); if (speed > 0) stepSim(dt * speed); simMsAvg = simMsAvg * .9 + (performance.now() - t0) * .1;
  const adt = speed === 0 ? dt * .25 : dt * Math.min(speed, 2.5);
  for (const v of sim.villagers) syncAvatar(v, speed === 0 ? 0 : adt);
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
  renderer.render(scene, camera);
}

// ---- hooks for headless verification & power users -------------------------------------------------
(window as any).terrarium = {
  sim, director, world, camera, controls, renderer, get fps() { return fpsAvg; }, get simMs() { return simMsAvg; },
  setSpeed: (s: number) => (speed = s), select: (id: string | null) => api.select(id), setMode: (m: any) => api.setMode(m), god: (k: string) => api.god(k), ui: () => ui,
  fastForward(minutes: number) { ui.quiet = true; stepSim(minutes / MIN_PER_SEC); ui.quiet = false; for (const v of sim.villagers) syncAvatar(v, .016); },
  look(x: number, z: number, dist = 30, yaw = .6, pitch = .9) { follow = null; focusTarget = null; mode = 'free'; controls.target.set(x, 0, z); camera.position.set(x + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, z + Math.cos(yaw) * Math.cos(pitch) * dist); controls.update(); },
  closeUp(id: string, dist = 3.2, side = .3) { const v = sim.byId.get(id)!; follow = null; focusTarget = null; mode = 'free'; const hd = v.avatar.heading; const hy = v.avatar.height * .8; controls.target.set(v.x, hy, v.z); camera.position.set(v.x + Math.sin(hd + side) * dist, hy + .5, v.z + Math.cos(hd + side) * dist); controls.update(); },
  forceExpr(id: string, expr: string) { forced.set(id, { expr, until: 0 }); }, clearExpr() { forced.clear(); },
  enableLLM(cfg: LLMConfig) { localStorage.setItem('terrarium.llm', JSON.stringify(cfg)); sim.brain = new LLMBrain(cfg); console.info('LLM brain enabled (plans + reflections).'); },
  disableLLM() { localStorage.removeItem('terrarium.llm'); sim.brain = new UtilityBrain(); },
  summary() { return { day: sim.day, clock: sim.clock, events: sim.events.length, villagers: sim.villagers.map(v => ({ id: v.id, x: +v.x.toFixed(1), z: +v.z.toFixed(1), doing: v.doing, coins: v.inv.coins, food: Math.round(v.needs.food), energy: Math.round(v.needs.energy), opinions: { ...v.opinion }, alliance: v.alliance, expr: v.avatar.expr })), alliances: sim.alliances.map(a => a.name + ':' + a.members.join(',')), parties: sim.parties.map(p => `${p.title}@${p.place} invited ${p.invited.size} came ${p.attendees.size}`), kinds: sim.events.reduce((m: any, e) => (m[e.kind] = (m[e.kind] ?? 0) + 1, m), {}) }; },
};
boot().catch(e => { console.error(e); loading.querySelector('small')!.textContent = 'Something went wrong: ' + e.message; });
