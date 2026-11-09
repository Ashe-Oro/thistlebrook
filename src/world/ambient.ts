// Little living-world moments that need no sim state: a flock of birds wheeling over the village by day, fish leaping
// in the ponds (splash + ripple ring), and a rainbow when a daytime shower clears. Presentation only: own RNG, no sim reads
// beyond what main.ts passes in, so watching never changes the story.
import * as THREE from 'three';

type Ring = { m: THREE.Mesh; t: number; on: boolean };
type Fish = { m: THREE.Mesh; t: number; on: boolean; x: number; z: number; dx: number; dz: number };
export class Ambient {
  private seed = 987654321; private rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  birds: THREE.InstancedMesh; private bird: { a: number; r: number; h: number; w: number; ph: number; off: number }[] = [];
  private flockC = new THREE.Vector3(-8, 0, 2); private flockT = new THREE.Vector3(-8, 0, 2); private flockTimer = 0;
  private rings: Ring[] = []; private fish: Fish[] = []; private fishT = 2;
  rainbow: THREE.Mesh; private rbMat: THREE.ShaderMaterial; rbAlpha = 0; private rbUntil = 0; private wetPeak = 0;
  onRainbow: (() => void) | null = null; onSplash: ((x: number, z: number) => void) | null = null;
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  constructor(public scene: THREE.Scene, public ponds: { x: number; z: number; r: number }[], private fx: { water(x: number, y: number, z: number, dx: number, dz: number): void }) {
    // birds: a two-triangle "M" silhouette; flapping is a per-instance Y scale of the wing tips
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .12, -.55, .18, -.05, 0, 0, -.12, 0, 0, .12, 0, 0, -.12, .55, .18, -.05], 3)); g.computeVertexNormals();
    const N = 16; this.birds = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#4a423b', side: THREE.DoubleSide, fog: true }), N); this.birds.frustumCulled = false;
    for (let i = 0; i < N; i++) this.bird.push({ a: this.rnd() * 6.28, r: 7 + this.rnd() * 7, h: 9 + this.rnd() * 5, w: (.22 + this.rnd() * .12) * (this.rnd() < .5 ? 1 : 1), ph: this.rnd() * 6.28, off: this.rnd() * 3 });
    scene.add(this.birds);
    // ripple rings + leaping fish (small pools, reused)
    const rg = new THREE.RingGeometry(.82, 1, 28); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: '#eaf6ff', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; scene.add(m); this.rings.push({ m, t: 0, on: false }); }
    const fg = new THREE.CapsuleGeometry(.05, .18, 3, 6); fg.rotateX(Math.PI / 2);
    for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: i ? '#d9822b' : '#b8c4cc', roughness: .35, metalness: .3 })); m.visible = false; m.castShadow = false; scene.add(m); this.fish.push({ m, t: 0, on: false, x: 0, z: 0, dx: 0, dz: 0 }); }
    // rainbow: a big half-torus with radial colour bands, additive and faded at the feet
    this.rbMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { a: { value: 0 } },
      vertexShader: 'varying float vT; varying float vY; void main(){ vT = (length(position.xy) - 36.) / 5.; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform float a; varying float vT; varying float vY;
        vec3 band(float t){ return clamp(vec3(abs(t*6.-3.)-1., 2.-abs(t*6.-2.), 2.-abs(t*6.-4.)), 0., 1.); }
        void main(){ float t = clamp(vT, 0., 1.); float edge = smoothstep(0., .18, t) * smoothstep(1., .82, t); float feet = smoothstep(0., 10., vY);
          gl_FragColor = vec4(band(1. - t) * edge * feet * a * .55, 1.); }` });
    const tg = new THREE.RingGeometry(36, 41, 96, 1, 0, Math.PI); this.rainbow = new THREE.Mesh(tg, this.rbMat); this.rainbow.visible = false; this.rainbow.renderOrder = 2; scene.add(this.rainbow);
  }
  private ring(x: number, z: number) { const r = this.rings.find(r => !r.on) ?? this.rings[0]; r.on = true; r.t = 0; r.m.position.set(x, .24, z); r.m.visible = true; }
  /** dt real seconds; gdt game minutes; hour 0..24; rain 0..1; night 0..1; focus = camera target; camPos for the rainbow's facing */
  update(dt: number, gdt: number, hour: number, rain: number, night: number, focus: THREE.Vector3, camPos: THREE.Vector3) {
    const day = night < .4 && rain < .5;
    // ---- birds: the flock drifts between points over the village, each bird circling its own radius
    this.birds.visible = day; if (day) {
      this.flockTimer -= dt; if (this.flockTimer <= 0) { this.flockTimer = 14 + this.rnd() * 12; this.flockT.set(-30 + this.rnd() * 50, 0, -20 + this.rnd() * 45); }
      this.flockC.lerp(this.flockT, 1 - Math.pow(.92, dt));
      const t = performance.now() / 1000;
      this.bird.forEach((b, i) => {
        b.a += dt * b.w * (1 + gdt * 0); const x = this.flockC.x + Math.cos(b.a) * b.r, z = this.flockC.z + Math.sin(b.a) * b.r, y = b.h + Math.sin(t * .7 + b.off) * 1.2;
        const flap = .35 + Math.abs(Math.sin(t * 7 + b.ph)) * 1.3; const glide = Math.sin(t * .5 + b.off) > .55 ? .25 : 1;
        this.e.set(0, -b.a, .35); this.q.setFromEuler(this.e); this.s.set(1.4, 1.4 * (1 + (flap - 1) * glide), 1.4); this.m4.compose(this.v.set(x, y, z), this.q, this.s); this.birds.setMatrixAt(i, this.m4);
      });
      this.birds.instanceMatrix.needsUpdate = true;
    }
    // ---- fish: every few seconds one leaps in a pond near the camera
    this.fishT -= dt; if (this.fishT <= 0 && night < .7) {
      this.fishT = 3 + this.rnd() * 5; const near = this.ponds.filter(p => Math.hypot(p.x - focus.x, p.z - focus.z) < 45);
      const f = this.fish.find(f => !f.on); if (near.length && f) { const p = near[Math.floor(this.rnd() * near.length)]; const a = this.rnd() * 6.28, rr = this.rnd() * p.r * .55;
        f.on = true; f.t = 0; f.x = p.x + Math.cos(a) * rr; f.z = p.z + Math.sin(a) * rr; const d = this.rnd() * 6.28; f.dx = Math.cos(d) * .55; f.dz = Math.sin(d) * .55; f.m.visible = true; this.ring(f.x, f.z); this.fx.water(f.x, .3, f.z, 0, 0); }
    }
    for (const f of this.fish) if (f.on) {
      f.t += dt; const u = f.t / .75; if (u >= 1) { f.on = false; f.m.visible = false; const ex = f.x + f.dx, ez = f.z + f.dz; this.ring(ex, ez); this.fx.water(ex, .3, ez, 0, 0); this.onSplash?.(ex, ez); continue; }
      f.m.position.set(f.x + f.dx * u, .2 + Math.sin(u * Math.PI) * .75, f.z + f.dz * u); f.m.lookAt(f.x + f.dx * (u + .05), .2 + Math.sin((u + .05) * Math.PI) * .75, f.z + f.dz * (u + .05));
    }
    for (const r of this.rings) if (r.on) { r.t += dt; const u = r.t / 1.6; if (u >= 1) { r.on = false; r.m.visible = false; continue; } const s = .15 + u * .9; r.m.scale.set(s, 1, s); (r.m.material as THREE.MeshBasicMaterial).opacity = (1 - u) * .55; }
    // ---- rainbow: a real shower (rain > .45) that clears in daylight leaves one behind for a while
    this.wetPeak = Math.max(this.wetPeak * Math.pow(.999, gdt), rain);
    const nowH = hour; const daylight = hour > 7 && hour < 18.5;
    if (this.wetPeak > .45 && rain < .12 && daylight && this.rbUntil <= 0) { this.rbUntil = 70; this.wetPeak = 0; this.place(focus, camPos); this.onRainbow?.(); }
    if (this.rbUntil > 0) this.rbUntil -= gdt; if (!daylight || rain > .3) this.rbUntil = Math.min(this.rbUntil, 0);
    const want = this.rbUntil > 0 ? 1 : 0; this.rbAlpha += (want - this.rbAlpha) * (1 - Math.pow(.6, dt)); this.rbMat.uniforms.a.value = this.rbAlpha; this.rainbow.visible = this.rbAlpha > .01; void nowH;
  }
  /** plant the rainbow behind the village as seen from the camera */
  place(focus: THREE.Vector3, camPos: THREE.Vector3) {
    const dx = focus.x - camPos.x, dz = focus.z - camPos.z, L = Math.hypot(dx, dz) || 1; const ux = dx / L, uz = dz / L;
    this.rainbow.position.set(focus.x + ux * 100, -5, focus.z + uz * 100); this.rainbow.rotation.set(0, Math.atan2(ux, uz), 0);
  }
  /** force one now (verification, the "after the rain" beat) */
  force(focus: THREE.Vector3, camPos: THREE.Vector3) { this.rbUntil = 70; this.place(focus, camPos); }
}
