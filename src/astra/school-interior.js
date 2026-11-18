// Room 4 at Thistlebrook High (school-day lane): a cutaway classroom shown
// when the school is clicked during lessons or just after. Escape returns to
// the campus camera.
//
// Small API so a later generic interiors hook can adopt it:
//   const school = createSchoolEntry({renderer, controls, root, plan});
//   school.canEnter(hour, weekday) / enter() / leave() / update(dt, hour, weekday)
//   school.drawing → true while the classroom (not the town) should be drawn
//   school.render() / school.resize()
//
// Nothing here loads at first paint. The room, its rigs and any Classroom-pack
// models are built on the first enter.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonMaterial, outlineMaterial } from '../toon.js';
import { place } from '../catalog/loader.js';
import { createVillagerMixer } from '../life/villager-mixer.js';
import { ROOM, CHILD, schoolState, canEnterClassroom, sessionAt, ENTER_EASE, CAMPUS_VIEW } from './school-plan.js';
export { ENTER_EASE };

const DOOR_VIEW = { x: -2, z: -57.5, zoom: 4.2 };
const HEADING = Math.PI / 4;

/** Optional Classroom pack (threejsassets `classroom`): if a private manifest
 * public/licensed/classroom/school-day.json maps roles to GLBs, those models
 * replace the procedural pieces of the same role. Never committed. */
async function loadPackManifest(base) {
  try {
    const res = await fetch(base + 'licensed/classroom/school-day.json');
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

function buildRoom() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9dfcc');
  scene.name = 'Thistlebrook High • Room 4';
  const root = new THREE.Group(); scene.add(root);
  const geos = new Map(), hulls = new Map();
  const ink = outlineMaterial(.02);
  const geometry = (w, h, d) => { const k = [w, h, d].map((v) => v.toFixed(3)).join(); if (!geos.has(k)) geos.set(k, new THREE.BoxGeometry(w, h, d)); return geos.get(k); };
  const hull = (g) => { if (!hulls.has(g)) { const p = new THREE.BufferGeometry(); p.setAttribute('position', g.attributes.position.clone()); p.setIndex(g.index); const m = mergeVertices(p, 1e-4); m.computeVertexNormals(); hulls.set(g, m); } return hulls.get(g); };
  const box = (x, y, z, w, h, d, color, { parent = root, outline = true, role } = {}) => {
    const g = geometry(w, h, d), m = new THREE.Mesh(g, toonMaterial(color));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; if (role) m.userData.role = role;
    if (outline) { const e = new THREE.Mesh(hull(g), ink); e.userData.outline = true; m.add(e); }
    parent.add(m); return m;
  };
  const cyl = (x, y, z, r, h, color, { parent = root, segments = 18, outline = true } = {}) => {
    const g = new THREE.CylinderGeometry(r, r, h, segments), m = new THREE.Mesh(g, toonMaterial(color));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
    if (outline) { const e = new THREE.Mesh(hull(g), ink); e.userData.outline = true; m.add(e); }
    parent.add(m); return m;
  };
  const blob = (x, y, z, sx, sy, sz, color, parent = root) => {
    const g = new THREE.SphereGeometry(1, 16, 10), m = new THREE.Mesh(g, toonMaterial(color));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = m.receiveShadow = true;
    const e = new THREE.Mesh(hull(g), outlineMaterial(.014 / Math.min(sx, sy, sz))); e.userData.outline = true; m.add(e);
    parent.add(m); return m;
  };
  const canvasPlane = (w, h, px, draw, { x = 0, y = 0, z = 0, ry = 0, parent = root } = {}) => {
    const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
    const redraw = (...args) => { const ctx = c.getContext('2d'); draw(ctx, c.width, c.height, ...args); tex.needsUpdate = true; };
    redraw(); return { mesh: m, redraw };
  };
  const { min, max } = ROOM.bounds, H = ROOM.height;
  // Floor: warm boards with a skirting, and a lino strip by the door.
  for (let k = 0; k < 20; k++) box(0, -.03, min[1] + .2 + k * .4, ROOM.width, .06, .4, k % 2 ? '#c99c6e' : '#d3a878', { outline: false });
  box(0, -.08, 0, ROOM.width + .3, .06, ROOM.depth + .3, '#8c6c50');
  // The two standing walls (north z = −4, west x = −5), with a dado rail.
  box(0, H / 2, min[1] - .06, ROOM.width + .12, H, .12, '#efe1c4');
  box(min[0] - .06, H / 2, 0, .12, H, ROOM.depth, '#e9dbbb');
  box(0, .5, min[1] + .01, ROOM.width, 1, .03, '#9fb79d', { outline: false });
  box(min[0] + .01, .5, 0, .03, 1, ROOM.depth, '#9fb79d', { outline: false });
  box(0, 1.02, min[1] + .03, ROOM.width, .05, .05, '#7d6248');
  box(min[0] + .03, 1.02, 0, .05, .05, ROOM.depth, '#7d6248');
  box(0, .06, min[1] + .04, ROOM.width, .12, .06, '#7d6248'); box(min[0] + .04, .06, 0, .06, .12, ROOM.depth, '#7d6248');
  // Cut edges show the wall thickness in a darker brick tone.
  box(max[0] + .02, H / 2, min[1] - .06, .04, H, .14, '#b98a6e'); box(min[0] - .06, H / 2, max[1] + .02, .14, H, .04, '#b98a6e');
  // Windows on the west wall: sky, frames, a sill with a plant.
  for (const w of ROOM.windows) {
    const cy = (w.bottom + w.top) / 2, h = w.top - w.bottom;
    box(min[0] + .02, cy, w.z, .04, h, w.width, '#a9d4e4', { outline: false });
    box(min[0] + .05, cy, w.z, .05, h + .12, .07, '#f4ecd8'); box(min[0] + .05, cy, w.z - w.width / 2, .06, h + .12, .07, '#f4ecd8'); box(min[0] + .05, cy, w.z + w.width / 2, .06, h + .12, .07, '#f4ecd8');
    box(min[0] + .05, cy, w.z, .05, .06, w.width, '#f4ecd8'); box(min[0] + .1, w.bottom - .04, w.z, .16, .06, w.width + .2, '#f4ecd8');
    box(min[0] + .08, w.top + .06, w.z, .05, .1, w.width + .14, '#f4ecd8');
  }
  // Classroom door, north wall right.
  box(ROOM.door[0], 1.05, min[1] + .02, 1, 2.1, .06, '#5f8a7c'); box(ROOM.door[0], 1.05, min[1] + .01, 1.12, 2.2, .04, '#f4ecd8');
  box(ROOM.door[0] + .32, 1, min[1] + .07, .06, .06, .06, '#e2c786'); box(ROOM.door[0] - .1, 1.6, min[1] + .055, .45, .3, .02, '#b8d8e2', { outline: false });
  // Chalkboard with a wooden frame and chalk ledge.
  const B = ROOM.board, bw = B.width, bh = B.top - B.bottom, by = (B.top + B.bottom) / 2;
  box(B.center[0], by, min[1] + .02, bw + .14, bh + .14, .04, '#8b6848');
  const board = canvasPlane(bw, bh, 1024, (ctx, w, h, text = '', label = '') => {
    ctx.fillStyle = '#3d5f52'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % w, (i * 53) % h, 60, 6);
    ctx.fillStyle = '#f2efe2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 60px "Trebuchet MS", "Verdana", sans-serif'; ctx.fillText(text, w / 2, h * .36);
    ctx.font = 'bold 36px "Trebuchet MS", "Verdana", sans-serif'; ctx.fillStyle = '#f2d98a'; ctx.fillText(label, w / 2, h * .66);
    ctx.fillStyle = '#f2efe2'; ctx.font = 'bold 26px "Trebuchet MS", sans-serif'; ctx.textAlign = 'left'; ctx.fillText('Room 4 · the Owls', 24, h - 26);
  }, { x: B.center[0], y: by, z: min[1] + .045 });
  box(B.center[0], B.bottom - .05, min[1] + .08, bw, .04, .1, '#8b6848');
  for (let k = 0; k < 4; k++) box(B.center[0] - .8 + k * .18, B.bottom - .02, min[1] + .09, .08, .02, .02, ['#f6f1e2', '#f2c9c9', '#f2e2a0', '#bfe0f2'][k], { outline: false });
  // Smartboard: a dark screen with a bright lesson picture.
  const S = ROOM.smartboard, sw = S.width, sh = S.top - S.bottom, sy = (S.top + S.bottom) / 2;
  box(S.center[0], sy, min[1] + .02, sw + .1, sh + .1, .05, '#3a4146');
  const smart = canvasPlane(sw, sh, 512, (ctx, w, h, subject = 'reading') => {
    ctx.fillStyle = '#f7f3e6'; ctx.fillRect(0, 0, w, h);
    if (subject === 'maths') { ctx.font = 'bold 90px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for (const [t, x, c] of [['7', .2, '#d0715a'], ['+', .38, '#41605a'], ['5', .54, '#5b84b1'], ['=', .7, '#41605a'], ['12', .86, '#c7963c']]) { ctx.fillStyle = c; ctx.fillText(t, w * x, h * .45); } for (let i = 0; i < 12; i++) { ctx.fillStyle = i < 7 ? '#d0715a' : '#5b84b1'; ctx.beginPath(); ctx.arc(w * (.12 + i * .068), h * .82, 13, 0, 7); ctx.fill(); } }
    else if (subject === 'science') { ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(w * .2, h * .25, 40, 0, 7); ctx.fill(); ctx.fillStyle = '#8d6a4a'; ctx.fillRect(0, h * .75, w, h * .25); ctx.fillStyle = '#6da55a'; ctx.fillRect(w * .58, h * .4, 10, h * .36); ctx.beginPath(); ctx.ellipse(w * .54, h * .45, 34, 16, -.5, 0, 7); ctx.ellipse(w * .66, h * .4, 34, 16, .5, 0, 7); ctx.fill(); ctx.fillStyle = '#5b84b1'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(w * (.78 + (i % 2) * .06), h * (.12 + i * .1), 6, 11, 0, 0, 7); ctx.fill(); } }
    else if (subject === 'lunch') { ctx.fillStyle = '#d0715a'; ctx.beginPath(); ctx.arc(w * .3, h * .5, 60, 0, 7); ctx.fill(); ctx.fillStyle = '#e8c66a'; ctx.fillRect(w * .5, h * .35, 150, 90); ctx.fillStyle = '#41605a'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Lunch time', w / 2, h * .9); }
    else { ctx.fillStyle = '#7a9a62'; ctx.beginPath(); ctx.arc(w * .68, h * .4, 80, 0, 7); ctx.fill(); ctx.fillStyle = '#7a5a3c'; ctx.fillRect(w * .66, h * .45, 22, h * .45); ctx.fillStyle = '#b48d62'; ctx.beginPath(); ctx.ellipse(w * .3, h * .55, 52, 64, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f7f3e6'; for (const dx of [-20, 20]) { ctx.beginPath(); ctx.arc(w * .3 + dx, h * .45, 15, 0, 7); ctx.fill(); } ctx.fillStyle = '#2c2c2c'; for (const dx of [-20, 20]) { ctx.beginPath(); ctx.arc(w * .3 + dx, h * .45, 6, 0, 7); ctx.fill(); } ctx.fillStyle = '#41605a'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('The Owl and the Oak', w / 2, h * .94); }
  }, { x: S.center[0], y: sy, z: min[1] + .05 });
  // Alphabet frieze, number line, a clock and the children's paintings.
  canvasPlane(9.2, .32, 2048, (ctx, w, h) => { const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', c = ['#d0715a', '#e8b04f', '#7a9a62', '#5b84b1', '#a3739b']; for (let i = 0; i < 26; i++) { ctx.fillStyle = i % 2 ? '#fbf6e8' : '#f3ead2'; ctx.fillRect(i * w / 26, 0, w / 26, h); ctx.fillStyle = c[i % 5]; ctx.font = `bold ${h * .7}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(L[i] + L[i].toLowerCase(), (i + .5) * w / 26, h * .55); } }, { x: 0, y: 2.82, z: min[1] + .02 });
  canvasPlane(3.6, .26, 1024, (ctx, w, h) => { ctx.fillStyle = '#fbf6e8'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#41605a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(20, h * .3); ctx.lineTo(w - 20, h * .3); ctx.stroke(); ctx.fillStyle = '#41605a'; ctx.font = `bold ${h * .45}px sans-serif`; ctx.textAlign = 'center'; for (let i = 0; i <= 20; i++) { const x = 30 + i * (w - 60) / 20; ctx.fillRect(x - 2, h * .18, 4, h * .24); ctx.fillText(String(i), x, h * .78); } }, { x: B.center[0], y: 2.38, z: min[1] + .02 });
  const clock = canvasPlane(.5, .5, 256, (ctx, w, h, hour = 9) => { ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#4e685d'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, 7); ctx.fill(); ctx.fillStyle = '#fbf3dc'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .44, 0, 7); ctx.fill(); ctx.fillStyle = '#4e685d'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillRect(w / 2 + Math.sin(a) * w * .36 - 4, h / 2 - Math.cos(a) * h * .36 - 4, 8, 8); } const hand = (a, l, t) => { ctx.lineWidth = t; ctx.lineCap = 'round'; ctx.strokeStyle = '#2f3b36'; ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + Math.sin(a) * l, h / 2 - Math.cos(a) * l); ctx.stroke(); }; hand((hour % 12) / 12 * Math.PI * 2, w * .22, 12); hand((hour % 1) * Math.PI * 2, w * .34, 7); }, { x: -3.6, y: 2.25, z: min[1] + .03 });
  clock.mesh.material.transparent = true;
  const art = [['#d0715a', '#f2c14e'], ['#5b84b1', '#7a9a62'], ['#a3739b', '#e8b04f'], ['#7a9a62', '#d0715a']];
  art.forEach(([a, b], i) => canvasPlane(.5, .4, 128, (ctx, w, h) => { ctx.fillStyle = '#fbf6e8'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = b; ctx.fillRect(0, h * .7, w, h * .3); ctx.fillStyle = a; ctx.beginPath(); ctx.arc(w * (.3 + i * .12), h * .38, h * .2, 0, 7); ctx.fill(); ctx.strokeStyle = '#41605a'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, w - 4, h - 4); }, { x: min[0] + .03, y: 2.0 + (i % 2) * .08, z: 1.7 + i * .55, ry: Math.PI / 2 }));
  canvasPlane(1.1, .28, 512, (ctx, w, h) => { ctx.fillStyle = '#7a9a62'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fbf6e8'; ctx.font = `bold ${h * .6}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Book Nook', w / 2, h * .55); }, { x: min[0] + .03, y: 1.38, z: 2.65, ry: Math.PI / 2 });
  // Teacher's desk and chair (adult height).
  const T = ROOM.teacherDesk;
  box(T.pos[0], T.size[1] - .02, T.pos[1], T.size[0], .04, T.size[2], '#9b7653');
  for (const dx of [-1, 1]) box(T.pos[0] + dx * (T.size[0] / 2 - .2), (T.size[1] - .04) / 2, T.pos[1], .36, T.size[1] - .04, T.size[2] - .06, '#86654a');
  box(T.pos[0] - .35, T.size[1] + .04, T.pos[1] - .1, .3, .05, .22, '#d0715a'); box(T.pos[0] + .3, T.size[1] + .09, T.pos[1] - .12, .08, .14, .08, '#e8b04f'); blob(T.pos[0] + .45, T.size[1] + .08, T.pos[1] + .12, .09, .08, .09, '#d55c4a');
  chair(box, ROOM.teacherSeat, .46, .44, '#6f8a7a');
  // Pupils' desks: child height, each with its own chair, book and pencil pot.
  const tops = ['#e3c58f', '#dcbc85'], bookColors = ['#d0715a', '#5b84b1', '#7a9a62', '#e8b04f', '#a3739b'];
  for (const d of ROOM.desks) {
    const [x, z] = d.pos, [w, h, dd] = d.size;
    const role = 'desk';
    box(x, h - .015, z, w, .03, dd, tops[(d.row + d.col) % 2], { role });
    box(x, h - .09, z - .02, w - .06, .1, dd - .08, '#b88f62', { role });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(x + sx * (w / 2 - .04), (h - .03) / 2, z + sz * (dd / 2 - .04), .035, h - .03, .035, '#7b8f8a', { role });
    const book = box(x - .1, h + .012, z + .02, .2, .022, .15, bookColors[(d.row * 4 + d.col) % 5]); book.rotation.y = (d.col - 1.5) * .12;
    box(x + .19, h + .045, z - .12, .06, .09, .06, '#5f8a7c', { outline: false });
  }
  for (const [i, s] of ROOM.seats.entries()) chair(box, s, .34, .34, ['#d0715a', '#5b84b1', '#7a9a62', '#e8b04f'][i % 4]);
  // Cubbies under the windows: coloured trays, backpacks and lunch boxes.
  const C = ROOM.cubbies, cw = (C.to - C.from) / C.columns, ch = C.height / C.rows;
  box(C.x, C.height / 2, (C.from + C.to) / 2, C.depth, C.height, C.to - C.from, '#c8a274');
  box(C.x, C.height + .015, (C.from + C.to) / 2, C.depth + .04, .03, C.to - C.from + .04, '#b08a5e');
  const trays = ['#d0715a', '#e8b04f', '#7a9a62', '#5b84b1', '#a3739b', '#e39a7a'];
  for (let col = 0; col < C.columns; col++) for (let row = 0; row < C.rows; row++) {
    const z = C.from + (col + .5) * cw, y = (row + .5) * ch;
    box(C.x + .06, y, z, C.depth - .1, ch - .06, cw - .06, '#8d6c4d', { outline: false });
    if (row < 2) box(C.x + .1, y - .02, z, C.depth - .12, ch * .55, cw - .14, trays[(col + row * 2) % 6]);
    else blob(C.x + .1, y + .02, z, .1, .12, cw * .38, trays[(col + 3) % 6]);
  }
  // Coat hooks above the cubbies.
  for (let k = 0; k < 6; k++) { box(min[0] + .05, 1.55, C.from + (k + .5) * cw, .06, .06, .06, '#7d6248'); if (k % 2 === 0) blob(min[0] + .12, 1.38, C.from + (k + .5) * cw, .06, .2, .14, trays[k]); }
  // Book Nook: low bookshelf, a round rug, beanbags and a plant.
  const K = ROOM.bookshelf;
  box(K.x, K.height / 2, (K.from + K.to) / 2, K.depth, K.height, K.to - K.from, '#a57d56');
  for (const y of [.27, .54]) box(K.x + .02, y, (K.from + K.to) / 2, K.depth - .02, .025, K.to - K.from - .06, '#8d6a48');
  for (let shelf = 0; shelf < 3; shelf++) for (let k = 0; k < 9; k++) { const hgt = .16 + ((k * 7 + shelf * 3) % 5) * .018; box(K.x + .04, shelf * .27 + .02 + hgt / 2, K.from + .14 + k * .21, .2, hgt, .09, bookColors[(k + shelf) % 5], { outline: false }); }
  const rug = new THREE.Mesh(new THREE.CircleGeometry(ROOM.rug.radius, 40), toonMaterial('#d7a07c')); rug.rotation.x = -Math.PI / 2; rug.position.set(ROOM.rug.center[0], .01, ROOM.rug.center[1]); rug.receiveShadow = true; root.add(rug);
  const ring = new THREE.Mesh(new THREE.RingGeometry(ROOM.rug.radius * .62, ROOM.rug.radius * .76, 40), toonMaterial('#efd2a6')); ring.rotation.x = -Math.PI / 2; ring.position.set(ROOM.rug.center[0], .015, ROOM.rug.center[1]); root.add(ring);
  for (const [i, b] of ROOM.beanbags.entries()) blob(b.position[0], b.seatHeight / 2 + .02, b.position[1], .36, b.seatHeight / 2 + .02, .36, ['#7a9a62', '#e8b04f', '#5b84b1'][i]);
  cyl(-4.5, .2, 3.75, .17, .4, '#c2724f'); blob(-4.5, .62, 3.75, .3, .34, .3, '#6f9a58'); blob(-4.38, .86, 3.68, .18, .2, .18, '#7fae62');
  // Window-sill plants and a globe on the cubby top.
  for (const w of ROOM.windows.slice(0, 2)) { cyl(min[0] + .14, w.bottom + .07, w.z + .3, .07, .14, '#c2724f'); blob(min[0] + .14, w.bottom + .22, w.z + .3, .1, .12, .1, '#6f9a58'); }
  cyl(C.x + .05, C.height + .08, -1.7, .07, .12, '#7d6248'); blob(C.x + .05, C.height + .3, -1.7, .16, .16, .16, '#6f9fc4');
  // Lights: daylight through the west windows, ceiling panels and night blue.
  const fill = new THREE.HemisphereLight('#f5efe0', '#c7ae8c', 1.2);
  const sun = new THREE.DirectionalLight('#fff2d6', 1.7); sun.position.set(-14, 9, -3); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  const panels = [[-2, -1], [2, -1], [-2, 2.2], [2, 2.2]].map(([x, z]) => { const l = new THREE.PointLight('#ffe9c2', 0, 7, 1.4); l.position.set(x, 2.9, z); scene.add(l); return l; });
  scene.add(fill, sun, sun.target);
  return { scene, root, board, smart, clock, fill, sun, panels, box, blob };
}

function chair(box, seat, w, d, color) {
  const [x, z] = seat.position, h = seat.seatHeight, back = seat.facing === Math.PI ? 1 : -1, role = 'chair';
  box(x, h - .02, z, w, .04, d, color, { role });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(x + sx * (w / 2 - .03), (h - .04) / 2, z + sz * (d / 2 - .03), .03, h - .04, .03, '#6d7b78', { role });
  box(x, h + .2, z + back * (d / 2 - .02), w, .26, .035, color, { role });
}

/** Interior camera: the town's isometric angle, framed on the room. */
function makeCamera() {
  const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, .1, 200);
  const target = new THREE.Vector3(-.25, .6, -.15);
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(HEADING) * 40, 40 / Math.sqrt(2), Math.cos(HEADING) * 40));
  camera.lookAt(target); camera.updateMatrixWorld();
  return camera;
}

export function createSchoolEntry({ renderer, controls, root: uiRoot, plan, liveState, base = (import.meta.env?.BASE_URL ?? '/') }) {
  const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  let room = null, building = null, camera = null, actors = [], mode = 'town', timer = 0, last = null, lastBoard = '', lastClock = -1;
  const panel = document.createElement('div');
  panel.className = 'school-room glass'; panel.hidden = true; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Room 4 classroom');
  panel.innerHTML = '<div><strong>Room 4 · the Owls</strong><span class="school-session"></span><span class="school-count"></span></div><button type="button" class="school-back">Back to campus <kbd>Esc</kbd></button>';
  uiRoot?.append(panel);
  panel.querySelector('.school-back').onclick = () => api.leave();

  async function build() {
    if (building) return building;
    building = (async () => {
      room = buildRoom(); camera = makeCamera(); resize();
      const manifest = await loadPackManifest(base);
      if (manifest) await dressFromPack(room, manifest, base);
      const people = [...plan.students, plan.teacher];
      actors = await Promise.all(people.map(async (p, n) => {
        const o = await place('townsfolk-' + p.look, { scale: p.scale, animated: true });
        o.visible = false; room.scene.add(o);
        return { id: p.id, o, mixer: createVillagerMixer(o, n), last: null };
      }));
    })();
    return building;
  }

  function resize() {
    if (!camera) return;
    const size = renderer.getSize(new THREE.Vector2()), aspect = size.x / Math.max(1, size.y);
    const half = Math.max(3.85, 6.2 / aspect);
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.updateProjectionMatrix();
  }

  function sync(dt, hour, weekday) {
    const current = liveState?.();
    const state = current?.hour === hour && current.weekday === weekday ? current : schoolState(plan, hour, weekday);
    last = state;
    const people = [...state.students, state.teacher];
    for (const a of actors) {
      const p = people.find((q) => q.id === a.id), inside = p?.where === 'room';
      a.o.visible = inside; if (!inside) { a.last = null; continue; }
      const moved = a.last ? Math.hypot(p.room[0] - a.last[0], p.room[1] - a.last[1]) : 0; a.last = p.room;
      a.o.position.set(p.room[0], 0, p.room[1]); a.o.rotation.y = p.heading;
      const plan = p.seated ? { clip: p.clip, seatHeight: p.seat.seatHeight } : { clip: p.moving ? 'Walk' : p.clip, locomotion: p.moving };
      a.mixer?.update(plan, { dt, distance: p.moving ? Math.min(moved, .4) : 0, facing: p.heading, immediate: moved > 1.5 });
    }
    const text = state.board, label = state.session.label;
    if (text + label !== lastBoard) { lastBoard = text + label; room.board.redraw(text, label); room.smart.redraw(state.session.subject || 'reading'); }
    const minute = Math.floor(hour * 60);
    if (minute !== lastClock) { lastClock = minute; room.clock.redraw(hour); }
    const on = state.lights !== 'off';
    room.panels.forEach((l) => { l.intensity = on ? 2.2 : 0; });
    room.fill.intensity = on ? 1.2 : .45; room.fill.color.set(on ? '#f5efe0' : '#9fb0d0');
    room.sun.intensity = hour > 7 && hour < 18 ? 1.7 : .15;
    room.scene.background.set(on ? '#e9dfcc' : '#7d879a');
    panel.querySelector('.school-session').textContent = state.lights === 'off' ? 'Lights off' : state.session.label;
    panel.querySelector('.school-count').textContent = `${state.occupancy.seated} seated · ${state.occupancy.room} in the room`;
  }

  const api = {
    get active() { return mode !== 'town'; },
    get drawing() { return mode === 'room' || mode === 'settle'; },
    get mode() { return mode; },
    get camera() { return camera; },
    get scene() { return room?.scene; },
    canEnter: canEnterClassroom,
    state: () => last,
    /** Ease the campus camera to the door, then show the room. */
    async enter(hour, weekday) {
      if (mode !== 'town') return true;
      if (!canEnterClassroom(hour, weekday)) return false;
      mode = 'loading'; const instant = reduced.matches;
      if (!instant) controls.view(DOOR_VIEW);
      const started = performance.now();
      await build();
      sync(0, hour, weekday);
      const wait = instant ? 0 : Math.max(0, ENTER_EASE.town * 1000 - (performance.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (mode !== 'loading') return false;
      mode = instant ? 'room' : 'settle'; timer = 0; camera.zoom = instant ? 1 : .82; camera.updateProjectionMatrix();
      panel.hidden = false; uiRoot?.classList.add('in-classroom'); panel.querySelector('.school-back').focus({ preventScroll: true });
      return true;
    },
    leave() {
      if (mode === 'town') return false;
      mode = 'town'; panel.hidden = true; uiRoot?.classList.remove('in-classroom');
      controls.view(CAMPUS_VIEW, reduced.matches);
      return true;
    },
    update(dt, hour, weekday) {
      if (!room || mode === 'town' || mode === 'loading') return;
      if (mode === 'settle') { timer += dt; const u = Math.min(1, timer / ENTER_EASE.room); camera.zoom = .82 + .18 * (1 - (1 - u) ** 3); camera.updateProjectionMatrix(); if (u >= 1) mode = 'room'; }
      sync(dt, hour, weekday);
      if (!canEnterClassroom(hour, weekday) && sessionAt(hour, weekday).id !== 'tidy') panel.querySelector('.school-session').textContent = 'School is closed: press Esc for the campus';
    },
    render() { if (room && camera) renderer.render(room.scene, camera); },
    resize,
    /** Test/capture helper: furniture and seat heights as drawn. */
    audit() {
      if (!room) return null;
      const seated = actors.filter((a) => a.o.visible).map((a) => ({ id: a.id, clip: a.o.userData.animationClip, sample: a.mixer?.sample?.() }));
      return { mode, seated, seatHeight: CHILD.seatHeight, deskHeight: CHILD.deskHeight, occupancy: last?.occupancy };
    },
  };
  return api;
}

// Classroom pack dressing: each manifest role ("desk", "chair", "board",
// "cubby", "bookshelf", "beanbag", "rug") names a GLB under licensed/classroom/.
// Procedural pieces tagged with that role are hidden and the model is placed
// at each of their spots, scaled to the planned footprint, on the floor.
async function dressFromPack(room, manifest, base) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  for (const [role, file] of Object.entries(manifest.roles || {})) {
    const spots = ROOM.furniture.filter((f) => f.kind === role);
    if (!spots.length) continue;
    try {
      const gltf = await loader.loadAsync(base + 'licensed/classroom/' + file);
      const proto = gltf.scene; proto.traverse((m) => { if (m.isMesh) { m.material = toonMaterial(m.material?.color ?? '#ffffff'); m.castShadow = m.receiveShadow = true; } });
      const bounds = new THREE.Box3().setFromObject(proto), size = bounds.getSize(new THREE.Vector3());
      for (const f of spots) {
        const o = proto.clone(true), k = Math.min(f.size[0] / size.x, f.size[2] / size.z);
        o.scale.setScalar(k); o.position.set(f.pos[0], -bounds.min.y * k, f.pos[1]); room.scene.add(o);
      }
      room.root.traverse((m) => { if (m.userData.role === role) m.visible = false; });
    } catch (error) { console.warn('[school-day] Classroom pack model failed', role, error); }
  }
}
