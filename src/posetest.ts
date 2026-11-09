import * as THREE from 'three';
import { createDressedCharacter } from '@char/vanilla/dressed-character';
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(1400, 500); document.body.appendChild(r.domElement);
const s = new THREE.Scene(); s.background = new THREE.Color('#cfe3f0'); s.add(new THREE.HemisphereLight('#fff', '#667', 1.5)); const d = new THREE.DirectionalLight('#fff', 2); d.position.set(2, 5, 4); s.add(d);
const poses = (window as any).POSES || [{}]; const out: any[] = [];
poses.forEach((p: any, i: number) => {
  const h = createDressedCharacter({ styleId: 'hero', paletteId: 'alex' }, p.outfit || 'classic');
  h.group.position.x = (i - (poses.length - 1) / 2) * 1.3; h.group.rotation.y = (window as any).ROTY || 1.5708; s.add(h.group);
  const b = h.build.boneByShortName;
  for (const [bn, seq] of Object.entries(p.rot || {})) { const bone = b[bn]; for (const [ax, v] of seq as [string, number][]) bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0), v)); }
  if (p.expr) h.setExpression(p.expr); h.update(1); h.update(1);
});
const cam = new THREE.PerspectiveCamera(30, 1400 / 500, .1, 100); cam.position.set(0, 1.4, 9); cam.lookAt(0, 0.9, 0); r.render(s, cam);
(window as any).result = out;
