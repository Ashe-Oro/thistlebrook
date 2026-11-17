import { createLife, lifeEnabled } from './life/index.js';
import { createVillagerAnimator } from './compiler/villager-runtime.js';
import * as THREE from 'three';
import { createStage, townCoreBoxes } from './stage.js';
import { place, getEntry, RESOLVED } from './catalog/loader.js';
import { toWorld } from './catalog/schema.js';
import { compileTown } from './compiler/compile.js';
import { validateSpec } from './compiler/spec.js';
import { buildTown } from './compiler/runtime.js';
import { createPost } from './post/post.js';
import { parseOptions } from './post/options.js';
import { createLookPanel } from './post/ui.js';
import { maybeMeasurePerf } from './post/perf.js';
import HAMLET from '../specs/hamlet.json';
import LARGE from '../specs/large.json';
import MEDIUM_SPEC from '../specs/medium.json';
import {
  makeHouse,
  makeTree,
  makeBush,
  makeWell,
  makeFence,
  makeGround,
  makePath,
  makeHills,
  makeSky,
  makeCloud,
} from './builders.js';

// Main page. Default: the hand-placed hamlet. With `/?seed=N`: compile + render
// that seed through the compiler runtime (same layout engine as compile.html)
// behind the plain HUD. Both paths set window.__ready for headless screenshots.
const q = new URLSearchParams(location.search);
const MEDIUM = q.get('size') === 'medium' ? MEDIUM_SPEC : null; // WORKTREE-HOOK medium size selector
if (!q.has('legacy') && !q.has('size') && !q.has('district') && !lifeEnabled(q)) import('./astra/main.js');
else if (lifeEnabled(q) || q.get('district') === 'edo' || q.has('seed') || (q.get('size') === 'large' || MEDIUM)) runCompiled(q.has('seed') ? Number(q.get('seed')) : undefined);
else runHamlet();

// --- compiled seed through the runtime -------------------------------------
async function runCompiled(seed) {
  const spec = validateSpec(MEDIUM || ((q.get('size') === 'large' || q.get('district') === 'edo' || (lifeEnabled(q) && !q.has('size'))) ? LARGE : HAMLET), RESOLVED);
  const town = compileTown(spec, RESOLVED, { seed: Number.isFinite(seed) ? seed : undefined, district: q.get('district'), season: q.get('season'), life: lifeEnabled(q) });
  const cam = town.camera;
  const stage = createStage({
    camPos: cam.pos, target: cam.target, minDistance: 8, maxDistance: 220, shadowSize: 48, fog: q.get('district') === 'edo' ? [260, 540] : [120, 320],
    fitRadius: cam.radius + 4,
  });
  const { renderer, scene } = stage;
  window.__stage = stage; window.__town = town;
  await buildTown(town, scene);
  // No left panel here: frame the built core centred and tight.
  const coreBoxes = townCoreBoxes(scene);
  stage.setIsoFit(coreBoxes, { panelFrac: 0.0 });
  stage.setPerspectiveFit(coreBoxes, { panelFrac: 0.0, fill: 0.86 });

  const hud = document.getElementById('hud');
  if (hud) {
    hud.innerHTML = `<b>Cel&nbsp;Town</b> &nbsp;·&nbsp; <span>seed ${town.seed} · `
      + `${town.ok ? 'OK' : 'best'} · ${town.report.stats.houses}h ${town.report.stats.landmarks}L · drag to orbit</span>`;
  }

  const post = createPost(renderer, scene, stage.camera, parseOptions());
  window.__post = post; window.__scene = scene; window.__THREE = THREE;
  post.setSize(window.innerWidth, window.innerHeight);
  post.setHullVisible(post.options.hull);
  window.addEventListener('resize', () => post.setSize(window.innerWidth, window.innerHeight));
  createLookPanel({ post, stage });

  const life = await createLife(stage, town, q);
  const animateVillagers = createVillagerAnimator(scene);
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
}

// --- hand-placed hamlet (the default view) ---------------------------------
function runHamlet() {
  const stage = createStage({ fitRadius: 34 });
  const { renderer, scene } = stage;

  scene.add(makeSky());
  scene.add(makeHills());
  scene.add(makeGround());

  // Central well
  scene.add(makeWell());

  // Four houses around the green, facing the well. Three are imported Cozy
  // Village meshes, one is a code builder — all placed through the catalog, and
  // each path runs from the well to the house's resolved path snap point.
  const houses = [
    { id: 'cv-home-cottage', pos: [-14, -9] },
    { id: 'cv-home-timber', pos: [14, -10] },
    { id: 'cv-home-thatched', pos: [-15, 9] },
    { id: 'b-house-b', pos: [15, 10] },
  ];

  const loads = [];
  for (const { id, pos } of houses) {
    const [x, z] = pos;
    const rotY = Math.atan2(-x, -z); // local +Z (door) faces the well at the origin
    loads.push(place(id, { x, z, rotY }).then((house) => scene.add(house)));

    const snap = toWorld(getEntry(id).pathSnaps[0].pos, { x, z, rotY });
    const len = Math.hypot(x, z);
    scene.add(makePath((x / len) * 2.4, (z / len) * 2.4, snap[0], snap[2], 2.3));
  }

  // A few imported props/dressing mixed with builder trees.
  for (const [id, x, z, r] of [
    ['cv-barrel', -12.0, -4.6, 0.4], ['cv-barrel', -11.2, -4.0, 1.3],
    ['cv-tree-oak', 18, -16, 0.7], ['cv-tree-oak', -21, 14, 2.1],
    ['cv-bush-round', 10.5, -13.5, 0], ['cv-bush-round', -19, 4.5, 1],
  ]) loads.push(place(id, { x, z, rotY: r }).then((o) => scene.add(o)));

  // A ring-ish of connecting paths across the green for a lived-in feel.
  scene.add(makePath(-9, -3, 9, 4, 1.9));
  scene.add(makePath(-7, 7, 8, -6, 1.7));

  // Fences in the gaps between houses (kept off paths and bodies).
  scene.add(makeFence(-22, -4, -22, 6));
  scene.add(makeFence(22, -3, 22, 7));
  scene.add(makeFence(-8, 18, 9, 18));
  scene.add(makeFence(-9, -19, 8, -19));

  // Trees around the perimeter — deliberately off the roads.
  const treeSpots = [
    [-24, -16, 1.15, 1], [24, -18, 1.25, 2], [-26, 6, 1.0, 3], [26, 4, 1.1, 4],
    [-10, -22, 1.2, 5], [9, -23, 1.05, 6], [-20, 18, 1.15, 7], [20, 19, 1.2, 8],
    [0, 22, 1.1, 9], [-30, -2, 0.95, 10], [30, -4, 1.0, 11], [-3, -14, 0.9, 12],
  ];
  for (const [x, z, s, seed] of treeSpots) {
    const tree = makeTree(s, seed);
    tree.position.set(x, 0, z);
    scene.add(tree);
  }

  // Scattered bushes near the green edges.
  for (const [x, z, s] of [
    [-6, -6, 1], [7, -5, 0.9], [-5, 7, 1.1], [6, 6, 0.9], [3, -9, 0.8], [-9, 2, 1.0],
  ]) {
    const bush = makeBush(s);
    bush.position.set(x, 0, z);
    scene.add(bush);
  }

  // Clouds drifting in the sky.
  const clouds = [];
  for (const [x, y, z, s] of [
    [-30, 34, -40, 2.0], [25, 40, -30, 1.6], [0, 46, -55, 2.4], [40, 36, 10, 1.5], [-45, 38, 0, 1.8],
  ]) {
    const cloud = makeCloud(s);
    cloud.position.set(x, y, z);
    scene.add(cloud);
    clouds.push({ obj: cloud, speed: 0.4 + Math.random() * 0.4 });
  }

  const post = createPost(renderer, scene, stage.camera, parseOptions());
  post.setSize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', () => post.setSize(window.innerWidth, window.innerHeight));
  createLookPanel({ post, stage });

  // Headless screenshots wait on this (set after the first post-processed frame).
  window.__sceneReady = Promise.all(loads).then(() => {
    post.setHullVisible(post.options.hull);
  });

  const clock = new THREE.Clock();
  (function animate() {
    const dt = clock.getDelta();
    for (const c of clouds) {
      c.obj.position.x += c.speed * dt;
      if (c.obj.position.x > 60) c.obj.position.x = -60;
    }
    stage.controls.update();
    post.render(stage.camera);
    requestAnimationFrame(animate);
  })();

  // __ready flips after loads resolve; the animate loop has already drawn
  // post-processed frames by then.
  window.__sceneReady.then(() => {
    window.__ready = true;
    maybeMeasurePerf(renderer, post, () => stage.camera);
  });
}
