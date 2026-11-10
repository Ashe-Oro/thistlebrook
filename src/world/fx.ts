import * as THREE from 'three';
import { WinterWeather } from './winter';
// Pooled GPU particles (smoke, dust, chips, sparks, flames, leaves, fireflies), coin pops and rain.
const VS = `attribute float size; attribute vec4 col; varying vec4 vCol; uniform float uScale;
void main(){ vCol = col; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const FS = `varying vec4 vCol; uniform float uSoft; void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); if (d > .5) discard; float a = mix(1.0, smoothstep(.5, .0, d), uSoft); gl_FragColor = vec4(vCol.rgb, vCol.a * a); }`;

interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grow: number; r: number; g: number; b: number; a: number; grav: number; drag: number; wobble: number; fade: number }
class Pool {
  ps: P[] = []; private free: P[] = []; private cursor = 0; geo = new THREE.BufferGeometry(); pos: Float32Array; col: Float32Array; size: Float32Array; points: THREE.Points; max: number;
  constructor(scene: THREE.Scene, max: number, additive: boolean, soft: number) {
    this.max = max; this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('col', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 400 }, uSoft: { value: soft } } });
    this.points = new THREE.Points(this.geo, mat); this.points.frustumCulled = false; this.points.visible = false; this.geo.setDrawRange(0, 0); this.points.renderOrder = additive ? 3 : 2; scene.add(this.points);
  }
  emit(p: Partial<P> & { x: number; y: number; z: number }) {
    const recycled = this.ps.length >= this.max ? this.ps[this.cursor++ % this.max] : this.free.pop();
    const particle = Object.assign(recycled ?? {} as P, { vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: .3, grow: 0, r: 1, g: 1, b: 1, a: 1, grav: 0, drag: 0, wobble: 0, fade: 1 }, p);
    if (this.ps.length < this.max) this.ps.push(particle);
  }
  update(dt: number, t: number) {
    if (!this.ps.length) return;
    let n = 0;
    for (let k = 0; k < this.ps.length; k++) {
      const p = this.ps[k]; p.life += dt; if (p.life >= p.max) { this.free.push(p); continue; }
      p.vy -= p.grav * dt; const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += (p.vx + (p.wobble ? Math.sin(t * 2 + k) * p.wobble : 0)) * dt; p.y += p.vy * dt; p.z += (p.vz + (p.wobble ? Math.cos(t * 1.7 + k) * p.wobble : 0)) * dt;
      if (p.y < 0.02 && p.grav > 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      this.ps[n++] = p; const u = p.life / p.max;
      this.pos[n * 3 - 3] = p.x; this.pos[n * 3 - 2] = p.y; this.pos[n * 3 - 1] = p.z;
      this.col[n * 4 - 4] = p.r; this.col[n * 4 - 3] = p.g; this.col[n * 4 - 2] = p.b;
      this.col[n * 4 - 1] = p.a * (p.fade ? (u < .15 ? u / .15 : 1 - Math.max(0, (u - .5) / .5)) : 1);
      this.size[n - 1] = p.size * (1 + p.grow * u);
    }
    this.ps.length = n; this.points.visible = n > 0; this.geo.setDrawRange(0, n);
    for (const a of ['position', 'col', 'size']) (this.geo.attributes[a] as THREE.BufferAttribute).needsUpdate = true;
  }
}

export class FX {
  winter: WinterWeather;
  normal: Pool; glow: Pool; coins: THREE.InstancedMesh; coinState: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; spin: number }[] = [];
  rain: THREE.Mesh; private splashes: THREE.Mesh;
  private weather = { time: { value: 0 }, strength: { value: 0 } }; rainOn = 0; rainTarget = 0; t = 0; dummy = new THREE.Object3D();
  constructor(public scene: THREE.Scene) {
    this.winter = new WinterWeather(scene);
    this.normal = new Pool(scene, 2500, false, 0.6); this.glow = new Pool(scene, 1500, true, 1);
    const cg = new THREE.CylinderGeometry(.09, .09, .025, 10); cg.rotateX(Math.PI / 2);
    this.coins = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: '#f5c542', emissive: '#7a5300' }), 120); this.coins.count = 0; this.coins.frustumCulled = false; scene.add(this.coins);
    // Two instanced draws, with motion and ripple lifetimes evaluated on the GPU.
    const geometry = (count: number) => {
      const g = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(1, 1);
      g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
      const seeds = new Float32Array(count * 3);
      for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
      g.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 3)); g.instanceCount = count;
      return g;
    };
    const material = (splash: boolean) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: this.weather,
      vertexShader: `attribute vec3 seed; uniform float time; uniform float strength; varying vec2 vUv; varying float fade;
      void main(){
        vUv = uv;
        float age = fract(seed.y + time * ${splash ? '1.8' : '.85'});
        vec3 center = vec3((seed.x-.5)*${splash ? '40.' : '64.'}, ${splash ? '.035' : '(1.-age)*24.'}, (seed.z-.5)*${splash ? '40.' : '64.'});
        ${splash ? 'float radius = .08 + age * .38; center.xz += position.xy * radius * 2.; fade = (1.-age)*(1.-age); gl_Position = projectionMatrix * modelViewMatrix * vec4(center,1.);' : `center.x += (1.-age)*2.4;
        vec4 mv = modelViewMatrix * vec4(center,1.);
        vec3 streak = mat3(modelViewMatrix) * vec3(.12,1.1,.04);
        mv.xyz += streak * position.y * 1.25; mv.x += position.x * max(.05, -mv.z * .0045);
        fade = smoothstep(0.,.08,age)*(1.-smoothstep(.85,1.,age));
        gl_Position = projectionMatrix * mv;`}
        float density = fract(sin(dot(seed, vec3(127.1,311.7,74.7))) * 43758.5453);
        fade *= smoothstep(density - .08, density + .08, strength);
      }`,
      fragmentShader: `uniform float strength; varying vec2 vUv; varying float fade;
      void main(){ ${splash ? 'float d = length(vUv-.5); float a = (1.-smoothstep(.44,.5,d))*smoothstep(.33,.4,d);' : 'float a = (1.-abs(vUv.x-.5)*2.) * sin(vUv.y*3.14159);'}
      gl_FragColor = vec4(.8,.9,1.,min(1.,a*fade*strength*${splash ? '.6' : '1.25'})); }`
    });
    this.rain = new THREE.Mesh(geometry(2600), material(false));
    this.splashes = new THREE.Mesh(geometry(260), material(true));
    this.rain.frustumCulled = this.splashes.frustumCulled = false;
    this.rain.visible = this.splashes.visible = false; scene.add(this.rain, this.splashes);
  }
  smoke(x: number, y: number, z: number, dark = false) { const c = dark ? .45 : .88; this.normal.emit({ x: x + (Math.random() - .5) * .2, y, z: z + (Math.random() - .5) * .2, vx: .25 + Math.random() * .2, vy: .7 + Math.random() * .3, vz: (Math.random() - .5) * .2, max: 4 + Math.random() * 2, size: .7, grow: 3.5, r: c, g: c, b: c * 1.02, a: .55, drag: .3 }); }
  dust(x: number, z: number, n = 14, big = 1) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = (.8 + Math.random() * 1.6) * big; this.normal.emit({ x: x + Math.cos(a) * .3, y: .2 + Math.random() * .8, z: z + Math.sin(a) * .3, vx: Math.cos(a) * s, vy: .4 + Math.random() * .6, vz: Math.sin(a) * s, max: 1.1 + Math.random() * .8, size: .9 * big, grow: 2.2, r: .82, g: .74, b: .6, a: .75, drag: 2.2 }); } }
  chips(x: number, y: number, z: number, color = [.85, .65, .4], n = 8) { for (let i = 0; i < n; i++) this.normal.emit({ x, y, z, vx: (Math.random() - .5) * 3, vy: 1.5 + Math.random() * 2.5, vz: (Math.random() - .5) * 3, max: 1.4, size: .14, r: color[0], g: color[1], b: color[2], grav: 9, fade: 0 }); }
  sparks(x: number, y: number, z: number, n = 10) { for (let i = 0; i < n; i++) this.glow.emit({ x, y, z, vx: (Math.random() - .5) * 4, vy: 1 + Math.random() * 3, vz: (Math.random() - .5) * 4, max: .5 + Math.random() * .4, size: .12, r: 1, g: .7, b: .25, grav: 7 }); }
  flame(x: number, y: number, z: number, k = 1) { this.glow.emit({ x: x + (Math.random() - .5) * .45 * k, y, z: z + (Math.random() - .5) * .45 * k, vy: 1 + Math.random() * .8, max: .55 + Math.random() * .35, size: .85 * k, grow: -.6, r: 1, g: .45 + Math.random() * .3, b: .12, a: .85 }); }
  ember(x: number, y: number, z: number) { this.glow.emit({ x, y, z, vx: (Math.random() - .5) * .4, vy: 1.2 + Math.random(), vz: (Math.random() - .5) * .4, max: 2.5, size: .1, r: 1, g: .55, b: .2, wobble: .4 }); }
  firefly(x: number, y: number, z: number) { this.glow.emit({ x, y, z, max: 5 + Math.random() * 4, size: .22, r: .85, g: 1, b: .45, wobble: .9, a: .9 }); }
  leaf(x: number, y: number, z: number, autumn = false) { const c = autumn ? [.95, .55 + Math.random() * .2, .15] : [.45, .7, .3]; this.normal.emit({ x, y, z, vx: .6 + Math.random() * .4, vy: -.45, vz: (Math.random() - .5) * .3, max: 7, size: .16, r: c[0], g: c[1], b: c[2], wobble: .8, fade: 1 }); }
  sparkle(x: number, y: number, z: number, color = [1, .9, .5], n = 10) { for (let i = 0; i < n; i++) this.glow.emit({ x: x + (Math.random() - .5), y: y + Math.random(), z: z + (Math.random() - .5), vy: .5, max: 1 + Math.random(), size: .2, r: color[0], g: color[1], b: color[2] }); }
  grain(x: number, y: number, z: number, dx: number, dz: number) { for (let i = 0; i < 6; i++) this.normal.emit({ x, y, z, vx: dx * 2 + (Math.random() - .5), vy: 1 + Math.random(), vz: dz * 2 + (Math.random() - .5), max: 1, size: .07, r: .95, g: .82, b: .4, grav: 8, fade: 0 }); }
  water(x: number, y: number, z: number, dx: number, dz: number) { for (let i = 0; i < 5; i++) this.glow.emit({ x, y, z, vx: dx * 1.4 + (Math.random() - .5) * .4, vy: .2, vz: dz * 1.4 + (Math.random() - .5) * .4, max: .7, size: .1, r: .4, g: .65, b: 1, grav: 8 }); }
  coinBurst(x: number, y: number, z: number, n = 6) { for (let i = 0; i < n; i++) { if (this.coinState.length >= 120) this.coinState.shift(); const a = Math.random() * 6.28; this.coinState.push({ x, y, z, vx: Math.cos(a) * 1.2, vy: 3.5 + Math.random() * 1.5, vz: Math.sin(a) * 1.2, life: 0, spin: Math.random() * 6 }); } }
  setRain(on: boolean) { this.rainTarget = on ? 1 : 0; }
  update(dt: number, camTarget: THREE.Vector3) {
    this.t += dt; this.normal.update(dt, this.t); this.glow.update(dt, this.t);
    let n = 0;
    for (const c of this.coinState) { c.life += dt; if (c.life > 1.6) continue; c.vy -= 11 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; if (c.y < .05) { c.y = .05; c.vy *= -.4; } this.dummy.position.set(c.x, c.y, c.z); this.dummy.rotation.set(0, c.spin + c.life * 12, 0); const s = c.life > 1.3 ? (1.6 - c.life) / .3 : 1; this.dummy.scale.setScalar(s); this.dummy.updateMatrix(); this.coins.setMatrixAt(n++, this.dummy.matrix); }
    let alive = 0; for (const c of this.coinState) if (c.life <= 1.6) this.coinState[alive++] = c; this.coinState.length = alive; this.coins.count = n; if (n) this.coins.instanceMatrix.needsUpdate = true;
    // Bounded real-time envelope: full fade/reset within 1.2 seconds of clearing.
    this.rainOn = this.rainTarget > this.rainOn ? Math.min(this.rainTarget, this.rainOn + dt / 1.2) : Math.max(this.rainTarget, this.rainOn - dt / 1.2);
    this.weather.time.value = this.rainOn > 0 ? this.t : 0; this.weather.strength.value = this.rainOn;
    this.rain.visible = this.splashes.visible = this.rainOn > 0;
    // Snap the weather volume so small camera pans do not drag every drop.
    const x = Math.floor(camTarget.x / 8) * 8, z = Math.floor(camTarget.z / 8) * 8;
    this.rain.position.set(x, 0, z); this.splashes.position.set(x, 0, z);
  }
}
