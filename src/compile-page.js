import { createLife, lifeEnabled } from './life/index.js';
// Compile a town in the browser and render it with the toon stage using the
// suggested camera. Query params:
//   ?seed=N     seed (default: the spec's seed)
//   ?spec=path  spec to compile (default: the bundled specs/hamlet.json)
//   ?debug=1    turn the debug anchors on at load (checkbox reflects it)
//   ?cam=/?target=  honoured by stage.js, overriding the suggested camera
// Sets window.__ready once rendered (tools/shots.mjs waits on it).
import * as THREE from 'three';
import { createStage, townCoreBoxes } from './stage.js';
import { RESOLVED } from './catalog/loader.js';
import { compileTown, facingAngles } from './compiler/compile.js';
import { validateSpec } from './compiler/spec.js';
import { buildVillagerLineup, createVillagerAnimator } from './compiler/villager-runtime.js';
import { buildTown } from './compiler/runtime.js';
import { anchorGizmo, setLayers } from './catalog/debug.js';
import { createPost } from './post/post.js';
import { parseOptions } from './post/options.js';
import { createLookPanel } from './post/ui.js';
import { maybeMeasurePerf } from './post/perf.js';
import HAMLET from '../specs/hamlet.json';
import LARGE from '../specs/large.json';

const q = new URLSearchParams(location.search);
const seed = q.has('seed') ? Number(q.get('seed')) : (q.get('size') === 'medium' ? 1234 : (HAMLET.seed ?? 1));
const specPath = q.get('spec');

// Single source of truth: the bundled hamlet spec, unless ?spec points elsewhere
// (fetched from the served tree).
async function loadSpec() {
  if (q.get('size') === 'medium' && !specPath) return (await import('../specs/medium.json')).default; // WORKTREE-HOOK medium
  if (!specPath) return (q.get('size') === 'large' || (lifeEnabled(q) && !q.has('size')) || q.get('district') === 'edo') ? LARGE : HAMLET;
  if (specPath.endsWith('specs/large.json')) return LARGE;
  if (specPath.endsWith('specs/hamlet.json')) return HAMLET;
  try { return await (await fetch(`${import.meta.env.BASE_URL}${specPath}`)).json(); }
  catch { return HAMLET; }
}

(async () => {
  const rawSpec = await loadSpec();
  const spec = validateSpec(rawSpec, RESOLVED);
  const town = compileTown(spec, RESOLVED, { seed, district: q.get('district'), season: q.get('season'), life: lifeEnabled(q) });
  const lineup = q.get('lineup') === 'villagers';
  const cam = lineup ? {pos:[0,9,40],target:[0,1,0],radius:24} : town.camera;

  const stage = createStage({
    camPos: cam.pos, target: cam.target, minDistance: 8, maxDistance: 220, shadowSize: 48, fog: q.get('district') === 'edo' ? [260, 540] : [120, 320],
    fitRadius: cam.radius + 4,
  });
  const { renderer, scene } = stage;
  window.__stage = stage; window.__town = town; window.__scene = scene; window.__THREE = THREE;

  // Debug anchors: an anchorGizmo + lot OBB outline per instance. On at load
  // when ?debug=1 (the checkbox reflects the initial state).
  const debugOn = q.get('debug') === '1' || q.get('debug') === 'true';
  const gizmos = new THREE.Group();
  gizmos.visible = debugOn;
  scene.add(gizmos);

  if (lineup) await buildVillagerLineup(town, scene);
  else await buildTown(town, scene);
  const animateVillagers = createVillagerAnimator(scene);
  // Frame the built core tightly right of the panel (~20% of the width), in
  // both camera modes (the persp fit keeps the suggested view direction).
  const coreBoxes = townCoreBoxes(scene);
  stage.setIsoFit(coreBoxes, { panelFrac: 0.2 });
  stage.setPerspectiveFit(coreBoxes, { panelFrac: 0.2, fill: 0.86 });

  // Build gizmos after instances exist, reading each placed pivot's transform.
  scene.traverse((o) => {
    const inst = o.userData.inst;
    if (!inst || !o.userData.entry) return;
    const g = anchorGizmo(o.userData.entry);
    g.position.copy(o.position);
    g.rotation.copy(o.rotation);
    g.scale.copy(o.scale);
    gizmos.add(g);
    if ((inst.kind === 'house' || inst.kind === 'landmark') && o.userData.entry.lot) gizmos.add(lotOutline(o.userData.entry, inst));
  });
  setLayers(gizmos, { footprint: true, lot: true, bounds: false, roof: true, door: true, snaps: true });

  // --- panel ---------------------------------------------------------------
  const r = town.report;
  byId('spec').textContent = (town.name || 'spec');
  byId('seed').textContent = String(town.seed);
  byId('attempt').textContent = `${town.attempt}${town.ok ? '' : ' (best)'}`;
  const verdict = byId('verdict');
  verdict.textContent = town.ok ? 'OK' : 'FAIL';
  verdict.style.color = town.ok ? '#2e7d32' : '#c0392b';
  const checks = byId('checks');
  for (const c of r.checks) {
    const row = document.createElement('div');
    row.className = 'chk ' + (c.warn && !c.ok ? 'warn' : c.ok ? 'ok' : 'bad');
    row.innerHTML = `<span>${c.name}${c.warn ? ' *' : ''}</span><span>${c.ok ? '✓' : c.failures.length}</span>`;
    checks.appendChild(row);
  }
  // The compiler certifies facing against town.camera; the page renders with
  // the runtime perspective fit (or a ?cam/?target override), whose eye can
  // differ. Re-measure against the camera actually rendered and flag overruns
  // honestly (warn only; the compiler's own report is left untouched).
  if (stage.camera.isPerspectiveCamera) {
    const cp = stage.camera.position;
    let worst = null;
    for (const i of town.instances) {
      if (!i.facing) continue;
      const a = facingAngles(i.pos, i.rotY, [cp.x, cp.z]).cameraAngle;
      if (!worst || a > worst.angle) worst = { angle: a, id: i.id };
    }
    const cap = spec.houses.facing.maxCameraAngle;
    window.__renderedFacing = worst ? { worstCameraAngle: worst.angle, id: worst.id, cap, ok: worst.angle <= cap } : null;
    if (worst && worst.angle > cap) {
      const row = document.createElement('div');
      row.className = 'chk warn';
      row.title = `${worst.id}: ${worst.angle.toFixed(1)} deg off the rendered camera (cap ${cap})`;
      row.innerHTML = `<span>facing (rendered camera) *</span><span>${worst.angle.toFixed(1)}°</span>`;
      checks.appendChild(row);
    }
  }
  const stat = document.createElement('div');
  stat.className = 'muted';
  stat.style.marginTop = '4px';
  stat.textContent = `${r.stats.houses}h ${r.stats.paths}p ${r.stats.fences}f ${r.stats.trees}t ${r.stats.bushes}b ${r.stats.props}pr`;
  checks.appendChild(stat);

  byId('new').addEventListener('click', () => {
    const next = Math.floor(Math.random() * 1e6);
    q.set('seed', next);
    location.search = q.toString();
  });
  const anchors = byId('anchors');
  anchors.checked = debugOn;
  anchors.addEventListener('change', (e) => { gizmos.visible = e.target.checked; });

  // --- post chain + Look panel --------------------------------------------
  const post = createPost(renderer, scene, stage.camera, parseOptions());
  window.__post = post;
  post.setSize(window.innerWidth, window.innerHeight);
  post.setHullVisible(post.options.hull);
  window.addEventListener('resize', () => post.setSize(window.innerWidth, window.innerHeight));
  createLookPanel({ post, stage });

  const life = await createLife(stage, town, q);
  let ready = false;
  (function loop() {
    animateVillagers(performance.now() / 1000);
    life?.update();
    if (!life || window.__life.mode === 'overview') stage.controls.update();
    post.render(stage.camera);
    life?.render();
    if (!ready) { ready = true; window.__ready = true; maybeMeasurePerf(renderer, post, () => stage.camera); }
    requestAnimationFrame(loop);
  })();
})();

function lotOutline(entry, inst) {
  const pts = [[entry.lot.min[0], entry.lot.min[1]], [entry.lot.max[0], entry.lot.min[1]], [entry.lot.max[0], entry.lot.max[1]], [entry.lot.min[0], entry.lot.max[1]]]
    .map(([x, z]) => new THREE.Vector3(x, 0.08, z));
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3ddc84, depthTest: false, transparent: true }));
  line.renderOrder = 997;
  line.position.set(inst.pos[0], 0, inst.pos[1]);
  line.rotation.y = inst.rotY;
  line.userData.layer = 'lot';
  return line;
}

function byId(id) { return document.getElementById(id); }
