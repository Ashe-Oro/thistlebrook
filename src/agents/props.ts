import * as THREE from 'three';
// Small hand-built low-poly props (only where the packs have nothing suitable): tools and carried goods.
const M = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const wood = M('#8b5a2b'), iron = M('#9aa3ad'), dark = M('#4b4f56');
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; return b; }
export function makeTool(kind: string): THREE.Object3D {
  const g = new THREE.Group(); // handle along +Y, grip at origin
  if (kind === 'axe') { g.add(box(.05, .75, .05, wood, 0, .3, 0)); g.add(box(.04, .18, .2, iron, 0, .62, .09)); }
  else if (kind === 'pickaxe') { g.add(box(.05, .75, .05, wood, 0, .3, 0)); const h = box(.05, .06, .55, iron, 0, .66, 0); h.rotation.x = .15; g.add(h); }
  else if (kind === 'hammer') { g.add(box(.045, .45, .045, wood, 0, .18, 0)); g.add(box(.1, .11, .2, dark, 0, .42, 0)); }
  else if (kind === 'hoe') { g.add(box(.045, 1.0, .045, wood, 0, .38, 0)); g.add(box(.05, .2, .14, iron, 0, .86, .07)); }
  else if (kind === 'can') { const c = new THREE.Mesh(new THREE.CylinderGeometry(.11, .12, .22, 8), M('#5c8fb0')); c.position.set(0, -.08, .1); g.add(c); const sp = box(.03, .03, .28, M('#5c8fb0'), 0, -.02, .3); sp.rotation.x = -.5; g.add(sp); }
  else if (kind === 'mug') { const c = new THREE.Mesh(new THREE.CylinderGeometry(.07, .065, .16, 8), M('#c8a165')); c.position.set(0, -.02, .06); g.add(c); const f = new THREE.Mesh(new THREE.CylinderGeometry(.066, .066, .02, 8), M('#fff6dc')); f.position.set(0, .07, .06); g.add(f); }
  else if (kind === 'basket') { const c = new THREE.Mesh(new THREE.CylinderGeometry(.18, .13, .16, 8, 1, true), M('#b38b4d')); (c.material as THREE.Material).side = THREE.DoubleSide; c.position.set(0, -.18, .05); g.add(c); for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 5), M('#fff5e6')); e.position.set(Math.cos(i * 1.6) * .08, -.12, .05 + Math.sin(i * 1.6) * .08); g.add(e); } }
  else if (kind === 'sword') { g.add(box(.05, .18, .05, wood, 0, .05, 0)); g.add(box(.18, .03, .05, dark, 0, .15, 0)); g.add(box(.05, .6, .02, iron, 0, .46, 0)); }
  return g;
}
export function makeCarry(kind: string): THREE.Object3D {
  const g = new THREE.Group();
  if (kind === 'wood') for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .9, 7), M(i % 2 ? '#7a4f2a' : '#8b5e34')); l.rotation.z = Math.PI / 2; l.position.set(0, (i === 2 ? .15 : 0), (i - .5) * .17 * (i === 2 ? 0 : 1)); l.castShadow = true; g.add(l); }
  else if (kind === 'ore') { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(.2, 0), M('#7d8590')); s.castShadow = true; g.add(s); const s2 = new THREE.Mesh(new THREE.DodecahedronGeometry(.13, 0), M('#c98b4e')); s2.position.set(.12, .12, .05); g.add(s2); }
  else if (kind === 'wheat') for (let i = 0; i < 7; i++) { const st = box(.025, .7, .025, M('#e2c25b'), (i - 3) * .03, 0, (i % 2) * .03); st.rotation.z = (i - 3) * .06; g.add(st); const hd = box(.05, .14, .05, M('#d8a93a'), (i - 3) * .05, .38, (i % 2) * .03); g.add(hd); }
  else if (kind === 'bread') { const b = new THREE.Mesh(new THREE.CapsuleGeometry(.09, .2, 4, 8), M('#c8823a')); b.rotation.z = Math.PI / 2; b.castShadow = true; g.add(b); const b2 = b.clone(); b2.position.set(0, .1, .06); g.add(b2); }
  else if (kind === 'tools') { const t = makeTool('hammer'); t.rotation.z = Math.PI / 2; g.add(t); }
  else if (kind === 'apples' || kind === 'eggs') { const c = new THREE.Mesh(new THREE.CylinderGeometry(.2, .15, .18, 8), M('#b38b4d')); g.add(c); for (let i = 0; i < 5; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 5), M(kind === 'apples' ? '#d7263d' : '#fff5e6')); e.position.set(Math.cos(i * 1.3) * .1, .1, Math.sin(i * 1.3) * .1); g.add(e); } }
  else if (kind === 'coins') { const s = new THREE.Mesh(new THREE.SphereGeometry(.17, 7, 6), M('#a77b48')); g.add(s); const k = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .02, 8), M('#f5c542')); k.position.set(0, .18, 0); g.add(k); }
  else if (kind === 'gift') { g.add(box(.3, .25, .3, M('#d64f6b'))); g.add(box(.32, .05, .06, M('#ffe08a'), 0, .13, 0)); g.add(box(.06, .05, .32, M('#ffe08a'), 0, .13, 0)); }
  return g;
}
export function makeBanner(color: string) {
  const g = new THREE.Group(); g.add(box(.03, .9, .03, wood, 0, .45, 0));
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(.36, -.12); shape.lineTo(0, -.24);
  const f = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })); f.position.set(.015, .88, 0); f.rotation.y = Math.PI / 2; g.add(f); (g as any).flag = f; return g;
}
export function makeAnvil() {
  const g = new THREE.Group(), iron = new THREE.MeshLambertMaterial({ color: 0x3d3f45, flatShading: true }), wood = new THREE.MeshLambertMaterial({ color: 0x7a5233, flatShading: true });
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(.3, .36, .5, 8), wood); stump.position.y = .25; g.add(stump);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.5, .18, .24), iron); body.position.y = .62; g.add(body);
  const waist = new THREE.Mesh(new THREE.BoxGeometry(.24, .12, .18), iron); waist.position.y = .5; g.add(waist);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(.09, .3, 6), iron); horn.rotation.z = Math.PI / 2; horn.position.set(.38, .64, 0); g.add(horn);
  g.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return g;
}
