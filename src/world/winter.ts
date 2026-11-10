import * as THREE from 'three';
import { RNG } from '../core/util';

/* One shared uniform; preserve existing hooks (including the painted ground's edge fade). */
export function snowMaterial(mat: THREE.Material, snow: { value: number }, ground = false) {
  if (!(mat instanceof THREE.MeshLambertMaterial || mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) || mat.userData.winterSnow) return;
  mat.userData.winterSnow = true;
  const before = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, renderer) => {
    before.call(mat, sh, renderer); sh.uniforms.uSnow = snow;
    sh.vertexShader = 'varying vec3 vSnowNormal; varying vec3 vSnowPosition;\n' + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
      vSnowNormal = inverseTransformDirection(transformedNormal, viewMatrix);`);
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 snowPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        snowPosition = instanceMatrix * snowPosition;
      #endif
      vSnowPosition = (modelMatrix * snowPosition).xyz;`);
    sh.fragmentShader = 'uniform float uSnow; varying vec3 vSnowNormal; varying vec3 vSnowPosition;\n' + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float snowPatch = .5 + .26 * sin(vSnowPosition.x * 1.7 + sin(vSnowPosition.z * 1.3)) + .24 * sin(vSnowPosition.z * 2.1 + vSnowPosition.x * .6);
      float snowUp = smoothstep(.55, .85, normalize(vSnowNormal).y);
      ${ground ? `float snowGrass = smoothstep(.015, .12, diffuseColor.g - diffuseColor.r);
      float snowCover = mix(.38 + .35 * snowPatch, .82 + .16 * snowPatch, snowGrass);` : 'float snowCover = .88 + .1 * snowPatch;'}
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.91, .95, 1.0), uSnow * snowUp * snowCover);`);
  };
  mat.customProgramCacheKey = () => key + (ground ? '|winter-ground-v1' : '|winter-cap-v1');
  mat.needsUpdate = true;
}

/* Fixed cosmetic buffers: two draws, no particle objects or per-frame allocations. */
export class WinterWeather {
  private rng = new RNG(1943); private time = 0; private cursor = 0;
  private head = new THREE.Vector3(); private snow = 0;
  private uniforms = { time: { value: 0 }, snow: { value: 0 }, density: { value: 0 } };
  private flakes: THREE.Points; private breathPoints: THREE.Points;
  private pos = new Float32Array(96 * 3); private age = new Float32Array(96).fill(2);
  private velocity = new Float32Array(96 * 2); private opacity = new Float32Array(96); private sizes = new Float32Array(96);
  constructor(scene: THREE.Scene) {
    const seeds = new Float32Array(900 * 3); for (let i = 0; i < seeds.length; i++) seeds[i] = this.rng.next();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
    this.flakes = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: this.uniforms,
      vertexShader: `uniform float time; uniform float snow; uniform float density; varying float alpha;
      void main(){ vec3 s = position; float age = fract(s.y + time * (.035 + s.x * .025));
      vec3 p = vec3((s.x-.5)*64. + sin(time*.6+s.z*30.)*.7, (1.-age)*18., (s.z-.5)*64. + sin(time*.4+s.x*30.)*.5);
      vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp((.065+s.z*.055)*500./max(1.,-mv.z),1.,7.);
      float flakeDensity = fract(sin(dot(s,vec3(127.1,311.7,74.7)))*43758.5453);
      alpha = snow * smoothstep(flakeDensity-.025,flakeDensity+.025,density) * smoothstep(0.,.08,age) * (1.-smoothstep(.9,1.,age)); }`,
      fragmentShader: `varying float alpha; void main(){float d=length(gl_PointCoord-.5); gl_FragColor=vec4(.94,.97,1.,alpha*(1.-smoothstep(.15,.5,d))*.8);}` }));
    const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); b.setAttribute('alpha', new THREE.BufferAttribute(this.opacity, 1).setUsage(THREE.DynamicDrawUsage)); b.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.breathPoints = new THREE.Points(b, new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      vertexShader: `attribute float alpha; attribute float size; varying float a; void main(){a=alpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=size*500./max(1.,-mv.z);}`,
      fragmentShader: `varying float a; void main(){float d=length(gl_PointCoord-.5); gl_FragColor=vec4(.94,.97,1.,a*(1.-smoothstep(0.,.5,d)));}` }));
    this.flakes.frustumCulled = this.breathPoints.frustumCulled = false;
    this.flakes.visible = this.breathPoints.visible = false; scene.add(this.flakes, this.breathPoints);
  }
  breath(dt: number, avatar: { alpha: number; heading: number; bones: Record<string, THREE.Object3D> }, outdoors: boolean) {
    if (this.snow <= .5 || !outdoors || avatar.alpha < .9 || this.rng.next() >= 1 - Math.exp(-dt * .35)) return;
    avatar.bones.Head.getWorldPosition(this.head);
    const i = this.cursor++ % 96, j = i * 3, dx = Math.sin(avatar.heading), dz = Math.cos(avatar.heading);
    this.pos[j] = this.head.x + dx * .19; this.pos[j + 1] = this.head.y + .03; this.pos[j + 2] = this.head.z + dz * .19;
    this.velocity[i * 2] = dx * .3; this.velocity[i * 2 + 1] = dz * .3; this.age[i] = 0;
  }
  update(dt: number, target: THREE.Vector3, snow: number, rain: number) {
    this.snow = snow; this.time += dt; this.uniforms.time.value = this.time; this.uniforms.snow.value = snow;
    this.uniforms.density.value = .2 + Math.min(1, rain) * .75; this.flakes.visible = snow > .001;
    this.flakes.position.set(Math.floor(target.x / 8) * 8, 0, Math.floor(target.z / 8) * 8);
    let alive = false;
    for (let i = 0; i < 96; i++) { const age = this.age[i] += dt, j = i * 3; this.opacity[i] = 0; if (age >= 1.4) continue;
      alive = true; this.pos[j] += this.velocity[i * 2] * dt; this.pos[j + 1] += .18 * dt; this.pos[j + 2] += this.velocity[i * 2 + 1] * dt;
      this.opacity[i] = Math.sin(age / 1.4 * Math.PI) * .32 * snow; this.sizes[i] = .09 + age * .23;
    }
    this.breathPoints.visible = alive;
    if (alive) { const a = this.breathPoints.geometry.attributes; a.position.needsUpdate = a.alpha.needsUpdate = a.size.needsUpdate = true; }
  }
}
