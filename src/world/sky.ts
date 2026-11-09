import * as THREE from 'three';
import { clamp, lerp } from '../core/util';
// Day/night cycle + weather: sun arc, hemisphere tint, gradient sky dome, stars, fog.
const KEYS: [number, string, string, string, number, number][] = [
  // hour, skyTop, skyBottom, sunColor, sunIntensity, hemi
  [0, '#0b1430', '#1d2b52', '#9fb4ff', 0.65, .72], [5, '#1a2350', '#5a4f7a', '#ff9e6b', 0.45, .58], [6.5, '#6f9fd8', '#ffc08a', '#ffb070', 1.4, .85],
  [9, '#5fa0e0', '#cfe6f5', '#fff1d6', 2.6, 1.15], [15, '#5a9be0', '#d4e9f5', '#fff4dd', 2.7, 1.15], [18, '#6d86c8', '#ffb07a', '#ff9a55', 1.6, .85],
  [19.5, '#2b2f66', '#c06a6a', '#ff7a45', .55, .62], [21, '#0f1838', '#2a2f5a', '#9fb4ff', .65, .72], [24, '#0b1430', '#1d2b52', '#9fb4ff', 0.65, .72],
];
const COLORS = KEYS.map(k => [new THREE.Color(k[1]), new THREE.Color(k[2]), new THREE.Color(k[3])]);
export class Sky {
  sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; dome: THREE.Mesh; stars: THREE.Points; night = 0; rain = 0;
  top = new THREE.Color(); bot = new THREE.Color();
  private grey = new THREE.Color('#8e99a6'); private sunTint = new THREE.Color();
  private nightSky = new THREE.Color('#8e9dce'); private nightGround = new THREE.Color('#354358');
  constructor(public scene: THREE.Scene, mobile: boolean) {
    this.hemi = new THREE.HemisphereLight('#eaf4ff', '#56663f', 1); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff', 2.5); this.sun.castShadow = true; const sz = mobile ? 1024 : 2048; this.sun.shadow.mapSize.set(sz, sz);
    Object.assign(this.sun.shadow.camera, { left: -60, right: 60, top: 45, bottom: -45, near: 5, far: 200 }); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun); scene.add(this.sun.target);
    const dg = new THREE.SphereGeometry(400, 32, 16);
    this.dome = new THREE.Mesh(dg, new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: this.top }, bot: { value: this.bot } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = smoothstep(-.08,.85,vP.y); gl_FragColor = vec4(mix(bot, top, pow(h,.8)),1.); }' }));
    this.dome.renderOrder = -1; scene.add(this.dome);
    const sp = new Float32Array(1500 * 3); for (let i = 0; i < 1500; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.28, r = Math.sqrt(1 - u * u), y = Math.abs(u) * .9 + .1; sp.set([Math.cos(a) * r * 380, y * 380, Math.sin(a) * r * 380], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(this.stars);
    scene.fog = new THREE.Fog('#cfe6f5', 90, 230);
  }
  update(hour: number, rain: number, focus: THREE.Vector3) {
    hour = ((hour % 24) + 24) % 24; rain = clamp(rain); this.rain = rain;
    let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= hour) i++;
    const a = KEYS[i], b = KEYS[i + 1], u = clamp((hour - a[0]) / (b[0] - a[0]));
    const t = u * u * (3 - 2 * u), ca = COLORS[i], cb = COLORS[i + 1];
    this.top.copy(ca[0]).lerp(cb[0], t).lerp(this.grey, rain * .6);
    this.bot.copy(ca[1]).lerp(cb[1], t).lerp(this.grey, rain * .5);
    const sunCol = this.sunTint.copy(ca[2]).lerp(cb[2], t);
    const sunI = lerp(a[4], b[4], t) * (1 - rain * .55), hemiI = lerp(a[5], b[5], t) * (1 - rain * .2);
    const day = hour > 6 && hour < 19.5; this.night = clamp(hour < 12 ? (6.5 - hour) / 1.5 : (hour - 18.5) / 1.5);
    // Sun by day, moon by night (both from the south-ish so the default camera sees lit fronts).
    const ang = day ? (hour - 6) / 13.5 * Math.PI : ((hour + 24 - 19.5) % 24) / 10.5 * Math.PI;
    this.sun.position.set(focus.x - Math.cos(ang) * 60, 15 + Math.sin(ang) * 55, focus.z + 40); this.sun.target.position.copy(focus).setY(0);
    this.sun.color.copy(sunCol); this.sun.intensity = sunI; this.hemi.intensity = hemiI;
    this.hemi.color.set('#eaf4ff').lerp(this.nightSky, this.night * .8); this.hemi.groundColor.set('#56663f').lerp(this.nightGround, this.night);
    this.stars.visible = this.night > .01 && rain < .99;
    (this.stars.material as THREE.PointsMaterial).opacity = this.night * (1 - rain) * .8;
    (this.scene.fog as THREE.Fog).color.copy(this.bot); this.dome.position.copy(focus); this.stars.position.copy(focus);
  }
}
