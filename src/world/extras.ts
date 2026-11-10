import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Avatar } from '../agents/avatar';
import { VILLAGERS } from '../data/villagers';
import { RNG, clamp } from '../core/util';
import type { World } from './world';

type Point = [number, number];
interface Extra { root: THREE.Group; avatar?: Avatar; proxy?: THREE.Mesh; path: Point[]; lengths: number[]; length: number; arrival: number; departure: number; phase: number; kid: boolean; festival: boolean; elapsed: number; distance: number; walkPhase: number; }
// Muted clothing tints for the far proxy; indistinguishable from the full avatar at > ~22 m.
const CLOTH = ['#8c6b53', '#5f7a6b', '#7b6b86', '#9a6a5a', '#6b7f99', '#8a8560', '#7c9082', '#a0785f'];
export interface ExtrasOptions { seed?: number; count?: number; }

// Presentation only: no occupancy, claims, sim events or shared random streams.
// Routes follow game time; idle motion follows a real-time presentation clock.
export class Extras {
  private root = new THREE.Group(); private people: Extra[] = []; private rng: RNG; private ready = false; private time = 0;
  private cloth?: THREE.InstancedMesh; private clothPhases: number[] = []; private dummy = new THREE.Object3D();
  private proxyMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private cat = new THREE.Group(); private tail = new THREE.Group();
  constructor(private world: World, scene: THREE.Scene, private opts: ExtrasOptions = {}) {
    this.rng = new RNG(opts.seed ?? 73191); this.root.name = 'Cosmetic extras'; scene.add(this.root);
  }
  async init() {
    if (this.ready) return; this.ready = true;
    const n = Math.max(6, Math.min(10, Math.floor(this.opts.count ?? 8) || 8));
    for (let i = 0; i < n; i++) {
      const r = this.rng, kid = i === 2 || i === 3, festival = i >= n - 2;
      const edge: Point = [i % 2 ? 46 : -47, -3 + r.range(-.7, .7)];
      const market = this.world.places.get('market'), plaza = this.world.places.get('plaza');
      const end: Point = festival && market ? [market.x + r.range(-2, 2), market.z + 2] : [plaza?.x ?? -9, (plaza?.z ?? 3.5) + r.range(-1, 1)];
      const start = this.world.nav.nearestFree(...edge), goal = this.world.nav.nearestFree(...end);
      // Failed paths stay absent; never replace a failed A* route with an obstacle-crossing line.
      const path = this.world.nav.findPath(...start, ...goal); if (!path || path.length < 2) continue;
      const def = VILLAGERS[[9, 7, 4, 10, 3, 11, 0, 8, 6, 1][i] % VILLAGERS.length];
      let avatar: Avatar | undefined, proxy: THREE.Mesh | undefined, root: THREE.Group;
      try {
        avatar = new Avatar({ ...def, id: `extra-${i}`, height: kid ? 1.25 : def.height, outfit: { fixed: { tops: kid ? 'tee' : 'sweater', bottoms: kid ? 'shorts' : 'trousers', shoes: 'boot', hair: kid ? 'messy' : 'short-crop' }, pools: {} } }, r.int(1, 999999));
        avatar.phase = r.range(0, 10); avatar.handle.face?.setAutoBlink?.(false); root = avatar.root;
      } catch { root = this.fallback(kid); }
      root.name = `Background passer-by ${i + 1}`; root.visible = false;
      root.traverse((o: any) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = true; } });
      // One-draw stand-in for distant passers-by: the full articulated avatar is only drawn up close.
      if (avatar) { proxy = this.makeProxy(kid, def.skin, CLOTH[i % CLOTH.length], def.hair); proxy.visible = false; root.add(proxy); }
      this.root.add(root); const lengths = [0];
      for (let j = 1; j < path.length; j++) lengths.push(lengths[j - 1] + Math.hypot(path[j][0] - path[j - 1][0], path[j][1] - path[j - 1][1]));
      this.people.push({ root, avatar, proxy, path, lengths, length: lengths[lengths.length - 1], arrival: 7 + i * .3, departure: 17 + i * .12, phase: r.range(0, 6.28), kid, festival, elapsed: 0, distance: 0, walkPhase: 0 });
    }
    this.decorations();
  }
  private fallback(kid: boolean) {
    const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: kid ? '#bd7860' : '#7c9082' });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.19, kid ? .5 : .9, 2, 5), mat); body.position.y = kid ? .55 : .8; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 6, 4), new THREE.MeshLambertMaterial({ color: '#d9a066' })); head.position.y = kid ? 1.1 : 1.55; g.add(head); return g;
  }
  // Single merged, vertex-coloured figure (body + head + hair) — one draw call, a few hundred triangles.
  private makeProxy(kid: boolean, skin: string, cloth: string, hair: string) {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, hex: string) => { const c = new THREE.Color(hex), n = g.attributes.position.count, col = new Float32Array(n * 3); for (let k = 0; k < n; k++) col.set([c.r, c.g, c.b], k * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g); };
    const bh = kid ? .5 : .9, by = kid ? .55 : .82, hy = kid ? 1.12 : 1.56, hr = kid ? .15 : .17;
    add(new THREE.CapsuleGeometry(kid ? .17 : .19, bh, 2, 6).translate(0, by, 0), cloth);
    add(new THREE.SphereGeometry(hr, 7, 5).translate(0, hy, 0), skin);
    add(new THREE.SphereGeometry(hr * .98, 6, 4).scale(1, .82, 1).translate(0, hy + hr * .36, -.02), hair);
    const mesh = new THREE.Mesh(mergeGeometries(parts)!, this.proxyMat); parts.forEach(g => g.dispose());
    mesh.castShadow = false; mesh.receiveShadow = false; return mesh;
  }
  private decorations() {
    // One instanced draw for washing; poles and rope are deliberately simple geometry.
    const laundry = this.world.places.get('laundry'); if (laundry) {
      const x = laundry.x, z = laundry.z;
      this.cloth = new THREE.InstancedMesh(new THREE.PlaneGeometry(.48, .7), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), 6);
      this.cloth.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.cloth.frustumCulled = false;
      for (let i = 0; i < 6; i++) { this.cloth.setColorAt(i, new THREE.Color(['#e6d8b8', '#9badba', '#bb8982'][i % 3])); this.clothPhases.push(this.rng.range(0, 6.28)); }
      this.cloth.position.set(x, 1.45, z + .5); this.root.add(this.cloth);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 4, 4), new THREE.MeshLambertMaterial({ color: '#756451' })); rope.rotation.z = Math.PI / 2; rope.position.set(x, 1.8, z + .5); this.root.add(rope);
      for (const dx of [-2, 2]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.9, 5), rope.material); pole.position.set(x + dx, .95, z + .5); this.root.add(pole); }
    }
    const mat = new THREE.MeshLambertMaterial({ color: '#6e6259', flatShading: true });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), mat); body.scale.set(.32, .19, .19); body.position.y = .18; this.cat.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.14, 6, 4), mat); head.position.set(.27, .33, 0); this.cat.add(head);
    for (const z of [-.08, .08]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(.07, .14, 3), mat); ear.position.set(.27, .46, z); this.cat.add(ear); }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(.025, .04, .4, 5), mat); tail.position.y = .18; this.tail.add(tail); this.tail.position.set(-.28, .2, 0); this.tail.rotation.z = .8; this.cat.add(this.tail);
    // A private low garden wall avoids competing with simulation-owned seats.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.5, .65, .35), new THREE.MeshLambertMaterial({ color: '#a49b88' })); wall.position.set(-28, .325, -17.3); this.root.add(wall);
    this.cat.position.set(-28, .65, -17.3); this.root.add(this.cat);
  }
  update(dt: number, simHour: number, rain: number, camTarget: THREE.Vector3, camPos?: THREE.Vector3) {
    if (!Number.isFinite(simHour)) return;
    const realDt = Math.max(0, Number.isFinite(dt) ? dt : 0); this.time += realDt;
    const h = ((simHour % 24) + 24) % 24, t = this.time, wet = clamp(rain);
    for (const p of this.people) {
      p.root.visible = h >= p.arrival && h < p.departure + .8 && (!p.festival || this.world.festival);
      if (!p.root.visible) { p.elapsed = 0; p.distance = 0; p.walkPhase = 0; continue; }
      // Enter in the morning, stroll between edge/plaza, then retrace the route at dusk.
      const stroll = (h - p.arrival - .8) / (p.departure - p.arrival - .8) * Math.PI * 2 * (p.kid ? 4 : 2);
      const u = h < p.arrival + .8 ? (h - p.arrival) / .8 : h >= p.departure ? 1 - (h - p.departure) / .8 : p.festival ? 1 : .55 + .45 * Math.cos(stroll);
      const d = clamp(u) * p.length; let j = 1; while (j < p.lengths.length - 1 && p.lengths[j] < d) j++;
      p.walkPhase += Math.abs(d - p.distance) * (p.kid ? 1.2 : .8); p.distance = d;
      const a = p.path[j - 1], b = p.path[j], f = (d - p.lengths[j - 1]) / Math.max(.001, p.lengths[j] - p.lengths[j - 1]);
      p.root.position.set(a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f);
      const returning = h >= p.departure || h >= p.arrival + .8 && Math.sin(stroll) > 0;
      const heading = Math.atan2(b[0] - a[0], b[1] - a[1]) + (returning ? Math.PI : 0), waiting = p.festival && h >= p.arrival + .8 && h < p.departure;
      p.elapsed += realDt;
      // Distance to the camera (falls back to the look-at point until the camera is wired in): drives both
      // the full→proxy swap and the animation-update throttle.
      const camD2 = p.root.position.distanceToSquared(camPos ?? camTarget), far = camD2 > 28 * 28;
      if (p.avatar) {
        const proxyFar = !!p.proxy && far;
        if (p.proxy) p.proxy.visible = proxyFar; p.avatar.body.visible = !proxyFar;
        if (proxyFar) { p.root.rotation.y = heading; p.avatar.heading = p.avatar.targetHeading = heading; } // frozen: no skeleton work
        else { p.avatar.setLod(Math.sqrt(camD2));
          if (p.elapsed >= (far ? .25 : 1 / 15)) {
            p.avatar.heading = p.avatar.targetHeading = heading; p.avatar.anim = waiting ? 'talk' : p.kid ? 'run' : 'walk';
            p.avatar.phase = (waiting ? t : p.walkPhase) + p.phase; p.avatar.update(0, .7); p.elapsed = 0;
          }
        }
      } else p.root.rotation.y = heading;
    }
    if (this.cloth) {
      for (let i = 0; i < 6; i++) { this.dummy.position.set((i - 2.5) * .57, 0, 0); this.dummy.rotation.set(Math.sin(t * .7 + this.clothPhases[i]) * (.12 + wet * .12), 0, Math.sin(t * .4 + i) * .04); this.dummy.updateMatrix(); this.cloth.setMatrixAt(i, this.dummy.matrix); }
      this.cloth.instanceMatrix.needsUpdate = true;
    }
    this.tail.rotation.x = Math.sin(t * .5) * .3; this.cat.visible = wet < .65;
  }
  /** Currently visible people; excludes the cat and decorative props. */
  count() { return this.people.reduce((n, p) => n + Number(p.root.visible), 0); }
}
