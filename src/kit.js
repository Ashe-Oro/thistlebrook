// Kit viewer: every catalog entry in two rows (imported meshes / builders) with
// toggleable debug anchors. Open /kit.html. ?anchors=footprint,door,... preset.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createStage } from './stage.js';
import { PALETTE, toonMaterial } from './toon.js';
import { RESOLVED, place } from './catalog/loader.js';
import { anchorGizmo, setLayers, GIZMO_COLORS } from './catalog/debug.js';
import { createPost } from './post/post.js';
import { parseOptions } from './post/options.js';
import { createLookPanel } from './post/ui.js';

const ORDER = ['house', 'landmark', 'well', 'fence', 'gate', 'path', 'tree', 'bush', 'prop'];
const entries = [...RESOLVED.values()].sort((a, b) => ORDER.indexOf(a.tags.category) - ORDER.indexOf(b.tags.category));
const rows = [entries.filter((e) => e.source === 'mesh'), entries.filter((e) => e.source === 'builder')];

const GAP = 2.2;
const rowWidth = (r) => r.reduce((w, e) => w + (e.bounds.max[0] - e.bounds.min[0]) + GAP, -GAP);
const W = Math.max(...rows.map(rowWidth));
const ROW_Z = [0, -14];

const stage = createStage({
  camPos: [0, W * 0.6, W * 0.72], target: [0, 1.5, -7], minDistance: 8, maxDistance: 140, shadowSize: W / 2 + 10, fog: null,
  fitRadius: W * 0.6,
});
const { renderer, scene } = stage;
scene.background = new THREE.Color(PALETTE.skyHorizon);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, 50), toonMaterial(PALETTE.grass));
ground.rotation.x = -Math.PI / 2; ground.position.z = -7; ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(50, 25, 0x5c8a35, 0x7fb247);
grid.position.set(0, 0.01, -7);
scene.add(grid);

const labels = new CSS2DRenderer();
labels.setSize(window.innerWidth, window.innerHeight);
Object.assign(labels.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
document.body.appendChild(labels.domElement);
window.addEventListener('resize', () => labels.setSize(window.innerWidth, window.innerHeight));

const loads = [];
rows.forEach((row, ri) => {
  let x = -rowWidth(row) / 2;
  for (const e of row) {
    const px = x - e.bounds.min[0];
    x += e.bounds.max[0] - e.bounds.min[0] + GAP;
    loads.push(place(e.id, { x: px, z: ROW_Z[ri] }).then((obj) => {
      obj.add(anchorGizmo(e));
      const div = document.createElement('div');
      div.className = 'tag';
      div.innerHTML = `<b>${e.id}</b><span>${e.tags.category} · ${e.source} · ${e.tris} tris</span>`;
      const label = new CSS2DObject(div);
      label.position.set(0, e.bounds.max[1] + 0.8, 0);
      label.name = 'label';
      obj.add(label);
      scene.add(obj);
    }));
  }
});
document.getElementById('count').textContent = `${entries.length} entries (${rows[0].length} mesh · ${rows[1].length} builder)`;

const LAYERS = ['footprint', 'lot', 'bounds', 'roof', 'door', 'snaps'];
const params = new URLSearchParams(location.search);
const preset = params.has('anchors') ? params.get('anchors').split(',') : null;
const state = Object.fromEntries(LAYERS.map((l) => [l, preset ? preset.includes(l) : l !== 'bounds']));
let showLabels = new URLSearchParams(location.search).get('labels') !== '0';
const sw = { footprint: GIZMO_COLORS.footprint, lot: GIZMO_COLORS.lot, bounds: GIZMO_COLORS.bounds, roof: GIZMO_COLORS.roof, door: GIZMO_COLORS.door, snaps: GIZMO_COLORS.path };
const toggles = document.getElementById('toggles');
LAYERS.forEach((l, i) => {
  const lab = document.createElement('label');
  lab.innerHTML = `<input type="checkbox" ${state[l] ? 'checked' : ''}> ${i + 1} <i style="background:#${sw[l].toString(16).padStart(6, '0')}"></i>${l}${l === 'snaps' ? ' (yellow path · purple fence)' : ''}`;
  lab.querySelector('input').addEventListener('change', (ev) => { state[l] = ev.target.checked; apply(); });
  toggles.appendChild(lab);
});
function apply() {
  setLayers(scene, state);
  toggles.querySelectorAll('input').forEach((c, i) => { c.checked = state[LAYERS[i]]; });
  scene.traverse((o) => { if (o.name === 'label') o.visible = showLabels; });
}
window.addEventListener('keydown', (ev) => {
  const i = Number(ev.key) - 1;
  if (LAYERS[i]) { state[LAYERS[i]] = !state[LAYERS[i]]; apply(); }
  if (ev.key === 'l' || ev.key === 'L') { showLabels = !showLabels; apply(); }
});

const post = createPost(renderer, scene, stage.camera, parseOptions());
post.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => post.setSize(window.innerWidth, window.innerHeight));
createLookPanel({ post, stage });

window.__sceneReady = Promise.all(loads).then(() => { apply(); post.setHullVisible(post.options.hull); });

(function loop() {
  stage.controls.update();
  post.render(stage.camera);
  labels.render(scene, stage.camera);
  requestAnimationFrame(loop);
})();

window.__sceneReady.then(() => { window.__ready = true; });
