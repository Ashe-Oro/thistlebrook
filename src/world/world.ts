import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TOWN, scaleOf, type PlaceDef, type PlaceKind } from '../data/town';
import { loadAsset, preload } from './loader';
import { paintGround } from './groundpaint';
import { NavGrid } from './nav';
import { FX } from './fx';
import { RNG, clamp } from '../core/util';

export interface Place { id: string; kind: PlaceKind; name: string; x: number; z: number; cx: number; cz: number; obj?: THREE.Object3D; enterable: boolean; chimney?: THREE.Vector3; district: string; inside: Set<string>; smokeUntil: number; }
export interface Seat { x: number; z: number; y: number; rot: number; place: string; taken: string | null; }

export class Tree {
  hp = 6; state: 'standing' | 'falling' | 'stump' | 'growing' = 'standing'; t = 0; shake = 0; fallDir = 0; claimed: string | null = null; regrowAt = 0;
  constructor(public obj: THREE.Object3D, public stump: THREE.Object3D, public x: number, public z: number, public baseScale: number, public autumn: boolean) {}
  get available() { return this.state === 'standing'; }
}
export class Rock { hp = 8; maxHp = 8; state: 'solid' | 'gone' | 'rising' = 'solid'; t = 0; shake = 0; claimed: string | null = null; regrowAt = 0; constructor(public obj: THREE.Object3D, public x: number, public z: number, public baseScale: number) {} get available() { return this.state === 'solid'; } }
export class Plot {
  stage: 'empty' | 'growing' | 'ripe' = 'growing'; growth = .55 + Math.random() * .4; // v1: fields are scenery (no farming economy yet)
  water = 0; claimed: string | null = null; crops: THREE.Object3D[] = []; wet!: THREE.Mesh; mats: THREE.MeshLambertMaterial[] = []; parts: { im: THREE.InstancedMesh; local: THREE.Matrix4 }[] = [];
  constructor(public x: number, public z: number) {}
}
export class AppleTree { apples = 4; meshes: THREE.Mesh[] = []; claimed: string | null = null; t = 0; constructor(public obj: THREE.Object3D, public x: number, public z: number) {} }
interface Animal { obj: THREE.Object3D; x: number; z: number; tx: number; tz: number; speed: number; pen: [number, number, number, number]; t: number; kind: string; hop: number; }

export class World {
  scene: THREE.Scene; nav: NavGrid; fx: FX; places = new Map<string, Place>(); seats: Seat[] = []; trees: Tree[] = []; rocks: Rock[] = []; plots: Plot[] = []; apples: AppleTree[] = [];
  animals: Animal[] = []; lamps: THREE.Sprite[] = []; lights: THREE.PointLight[] = []; campfireLight!: THREE.PointLight; forgeLight?: THREE.PointLight; private fireTime = 0; sail?: THREE.Object3D; bunting: THREE.Object3D[] = []; rng = new RNG(42);
  // Render-driven cosmetics must never advance the world/simulation stream.
  private cosmeticRng = new RNG(43);
  private scenery: THREE.Object3D[] = [];
  private moving = new Set<THREE.Object3D>();
  private cropM = new THREE.Matrix4(); private borderScenery: THREE.Object3D[] = []; private lotScenery: THREE.Object3D[] = [];
  feeder = new THREE.Vector3(35, 0, 10); stringLights?: THREE.Object3D; night = 0; festival = false; merchantCart?: THREE.Object3D;
  // Village pets. `crowd` is the live villager list (set each sim step) so the dog can trot after the nearest one.
  crowd: { x: number; z: number; inside: string | null }[] = [];
  dog?: { obj: THREE.Object3D; legs: THREE.Object3D; tail: THREE.Object3D; x: number; z: number; tx: number; tz: number; t: number; ph: number; wag: number; trot: boolean };
  ducks: { obj: THREE.Object3D; x: number; z: number; tx: number; tz: number; t: number; cx: number; cz: number; r: number }[] = [];
  constructor(scene: THREE.Scene) { this.scene = scene; this.nav = new NavGrid(TOWN.bounds, 0.5); this.fx = new FX(scene); }

  async build(onProgress?: (n: number, t: number) => void) {
    const keys: string[] = [];
    for (const d of TOWN.districts) { for (const l of d.lots) keys.push(l.a); for (const r of d.resources) keys.push(r.a); }
    keys.push('cozy/windmill_sail_01', 'nature/axe_chopping_stump', 'farm/wheat_cluster', 'farm/chicken', 'farm/cow', 'farm/sheep', 'farm/pig', 'cozy/tree_pine_01', 'cozy/tree_oak_01', 'cozy/bush_round_01', 'cozy/festival_bunting_01', 'cozy/veh_horse_cart_01', 'farm/horse', 'cozy/rock_boulder_01');
    await preload(keys, onProgress);
    this.ground();
    for (const r of TOWN.roads) this.nav.setCost((r.from + r.to) / 2, r.z, (r.to - r.from) / 2 + 2, 1.6, 0.7);
    for (const d of TOWN.districts) {
      for (const l of d.lots) await this.placeLot(d.id, l);
      for (const r of d.resources) await this.placeResource(r);
      for (const s of d.spots ?? []) this.places.set(s.id, { id: s.id, kind: s.kind, name: s.name, x: s.x, z: s.z, cx: s.x, cz: s.z, enterable: false, district: d.id, inside: new Set(), smokeUntil: 0 });
    }
    this.paint();
    await this.border(); await this.windmill(); await this.critters(); this.pets(); this.nightLights();
    this.finishScenery();
    // keep entries reachable
    for (const p of this.places.values()) this.nav.circle(p.x, p.z, 0.6, 0);
  }

  // Freeze local transforms only: static children still inherit moving parents.
  private finishScenery() {
    for (const root of this.scenery) root.traverse(o => {
      if (!this.moving.has(o)) { o.updateMatrix(); o.matrixAutoUpdate = false; }
    });
    // Border plants have no simulation handles or changing visibility. Keep batches
    // local so one visible tree does not submit the entire forest on phones.
    const batches = new Map<string, THREE.Mesh[]>();
    for (const root of this.borderScenery) {
      root.updateWorldMatrix(true, true);
      root.traverse(o => {
        if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || !o.visible ||
            Array.isArray(o.material) || o.material.transparent || o.matrixWorld.determinant() <= 0) return;
        const key = `${Math.floor(root.position.x / 24)},${Math.floor(root.position.z / 24)}:${o.geometry.uuid}:${o.material.uuid}:${o.castShadow}`;
        const group = batches.get(key) ?? []; group.push(o); batches.set(key, group);
      });
    }
    // Town lots never move or toggle (bunting, string lights and the merchant cart live elsewhere), and the packs share
    // a handful of vertex-coloured materials, so every lot part in a 30 m cell that shares a material is baked into
    // one world-space geometry: houses, lamps, fences, benches and barrels become a few draws per cell.
    const merges = new Map<string, THREE.Mesh[]>();
    for (const root of this.lotScenery) {
      if (!root.visible) continue;
      root.updateWorldMatrix(true, true);
      root.traverse(o => {
        if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || (o as any).isSkinnedMesh || !o.visible || Array.isArray(o.material) || o.material.transparent) return;
        const g = o.geometry, sig = Object.keys(g.attributes).sort().join(',') + (g.index ? ':i' : ':n') + (g.morphAttributes && Object.keys(g.morphAttributes).length ? ':m' : '');
        const key = `${Math.floor(root.position.x / 30)},${Math.floor(root.position.z / 30)}:${o.material.uuid}:${o.castShadow}:${o.receiveShadow}:${sig}`;
        const group = merges.get(key) ?? []; group.push(o); merges.set(key, group);
      });
    }
    for (const meshes of merges.values()) {
      if (meshes.length < 2) continue;
      const geos = meshes.map(m => { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); if (m.matrixWorld.determinant() < 0) { const idx = g.index; if (idx) for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); } } return g; });
      const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose()); if (!merged) continue;
      const first = meshes[0], mesh = new THREE.Mesh(merged, first.material); mesh.name = 'lots-merged';
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); this.scene.add(mesh);
      for (const m of meshes) m.removeFromParent();
    }
    for (const meshes of batches.values()) {
      if (meshes.length < 3) continue;
      const first = meshes[0], batch = new THREE.InstancedMesh(first.geometry, first.material, meshes.length);
      batch.name = 'border-plants'; batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow;
      meshes.forEach((mesh, i) => { batch.setMatrixAt(i, mesh.matrixWorld); });
      batch.instanceMatrix.needsUpdate = true; batch.computeBoundingBox(); batch.computeBoundingSphere();
      batch.updateMatrix(); batch.matrixAutoUpdate = false; this.scene.add(batch);
      for (const mesh of meshes) mesh.removeFromParent();
    }
    this.scenery.length = 0; this.borderScenery.length = 0; this.lotScenery.length = 0; this.moving.clear();
  }

  private shadows(root: THREE.Object3D, cast: boolean, receive = false) {
    root.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  }

  paint() {
    const paths: { pts: [number, number][]; w: number; kind: 'dirt' | 'cobble' }[] = [
      { pts: [[-34, -15.5], [18, -15.5]], w: 2.6, kind: 'dirt' }, { pts: [[18, -3], [47, -3]], w: 3, kind: 'dirt' }, { pts: [[30, -3], [31, -15], [38, -20]], w: 2.2, kind: 'dirt' },
      { pts: [[-22, -3], [-24, 6.5]], w: 1.8, kind: 'dirt' }, { pts: [[-30, -3], [-34, 9]], w: 1.6, kind: 'dirt' }, { pts: [[-1, 9], [2, 13]], w: 1.8, kind: 'dirt' }, { pts: [[18, -3], [18, 4.5]], w: 2, kind: 'dirt' },
      { pts: [[-46, -3], [-36, -4]], w: 2.2, kind: 'dirt' }, { pts: [[-36, -4], [-41, -8]], w: 1.5, kind: 'dirt' }, { pts: [[35, -3], [33.4, 8]], w: 1.6, kind: 'dirt' },
    ];
    for (const p of this.places.values()) { if (!p.enterable && p.kind !== 'chapel') continue; const lane = p.z > 18 ? 23 : p.z < -12 ? -15.5 : -3; if (Math.abs(p.z - lane) < .5) continue; paths.push({ pts: [[p.x, p.z], [p.x, lane]], w: 1.5, kind: p.district === 'farmstead' ? 'dirt' : 'dirt' }); }
    paths.push({ pts: [[-46, -3], [20, -3]], w: 4, kind: 'cobble' }, { pts: [[-9.5, -3], [-9.5, -15.5]], w: 2.6, kind: 'cobble' });
    // Riverside: an east-west lane and a connector up to the plaza
    paths.push({ pts: [[-26, 23], [8, 23]], w: 2.6, kind: 'dirt' }, { pts: [[-9, 6], [-11, 23]], w: 2, kind: 'dirt' });
    const ground = paintGround(paths, [{ x0: -18.5, z0: -1, x1: .5, z1: 11.5, r: 2.5 }]);
    this.scene.add(ground); this.scenery.push(ground);
  }
  ground() {
    const g = new THREE.PlaneGeometry(260, 200, 130, 100); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute, col = new Float32Array(pos.count * 3), c = new THREE.Color(), b = TOWN.bounds;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const out = Math.max(0, Math.max(b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ) - 2);
      const n = Math.sin(x * .21) * Math.cos(z * .17) + Math.sin(x * .07 + z * .05) * 1.4;
      pos.setY(i, out > 0 ? Math.min(14, out * out * .02 + out * .12) * (0.75 + .25 * Math.sin(x * .1 + z * .13)) : -0.01);
      c.set('#78b04c').offsetHSL(n * .006, 0, n * .025 - out * .002); col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true; m.name = 'ground'; this.scene.add(m); this.scenery.push(m);
  }

  async placeLot(district: string, l: { a: string; x: number; z: number; rot?: number; s?: number; place?: PlaceDef; solid?: boolean; tag?: string }) {
    const o = await loadAsset(l.a), s = (l.s ?? 1) * scaleOf(l.a), rot = l.rot ?? 0;
    o.scale.setScalar(s); const box = new THREE.Box3().setFromObject(o);
    o.position.set(l.x, 0, l.z); o.rotation.y = rot; this.scene.add(o);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, hx = (box.max.x - box.min.x) / 2, hz = (box.max.z - box.min.z) / 2;
    const c = Math.cos(rot), sn = Math.sin(rot), wcx = l.x + cx * c + cz * sn, wcz = l.z - cx * sn + cz * c;
    const isProp = !l.place && hx * hz < 1.5;
    const height = box.max.y - box.min.y;
    const detail = /flower_bed|grass|tuft|path_stone|road|string_lights/.test(l.a);
    this.shadows(o, !detail && Math.max(hx * 2, hz * 2, height) >= .6,
      !detail && (!!l.place || hx * hz >= 1.5));
    this.scenery.push(o); if (l.tag !== 'stringlights') this.lotScenery.push(o);
    if (l.solid !== false && !l.a.includes('road') && !l.a.includes('string_lights')) this.nav.rect(wcx, wcz, Math.max(.2, hx - (isProp ? .05 : .25)), Math.max(.2, hz - (isProp ? .05 : .25)), rot);
    if (l.tag === 'bench') this.seats.push({ x: l.x + .35 * c - .05, z: l.z + .1, y: .45, rot, place: 'bench', taken: null }, { x: l.x - .35 * c, z: l.z + .1, y: .45, rot, place: 'bench', taken: null });
    if (l.tag === 'logbench') { const fx = -25 - l.x, fz = 10 - l.z, r = Math.atan2(fx, fz); for (const off of [-.42, .42]) this.seats.push({ x: l.x + Math.cos(r) * off, z: l.z - Math.sin(r) * off, y: .42, rot: r, place: 'campfire', taken: null }); }
    if (l.tag === 'lamp') this.addLamp(l.x, 2.75 * (s / 1.45), l.z);
    if (l.tag === 'stringlights') this.stringLights = o;
    if (l.place) {
      const fz = box.max.z + (l.place.kind === 'market' ? 0.9 : 0.75), fxl = l.place.kind === 'market' ? 0 : cx;
      const ex = l.x + fxl * c + fz * sn, ez = l.z - fxl * sn + fz * c;
      const p: Place = { ...(l.place as any), enterable: !!l.place.enterable, x: ex, z: ez, cx: wcx, cz: wcz, obj: o, district, inside: new Set(), smokeUntil: 0 };
      if (l.place.chimney) { const [a, b2, d] = l.place.chimney; p.chimney = new THREE.Vector3(l.x + a * c + d * sn, b2, l.z - a * sn + d * c); }
      this.places.set(p.id, p);
    }
    return o;
  }

  async placeResource(r: { kind: string; a: string; x: number; z: number; rot?: number; s?: number }) {
    const s = (r.s ?? 1) * scaleOf(r.a), o = await loadAsset(r.a); o.scale.setScalar(s); o.position.set(r.x, 0, r.z); o.rotation.y = r.rot ?? this.rng.range(0, 6.28); this.scene.add(o);
    this.scenery.push(o); this.shadows(o, r.kind !== 'plot', r.kind === 'plot');
    if (r.kind === 'tree' || r.kind === 'rock') this.moving.add(o);
    if (r.kind === 'tree') {
      const stump = await loadAsset('nature/axe_chopping_stump'); stump.position.set(r.x, 0, r.z); stump.scale.setScalar(.85); stump.visible = false; this.scene.add(stump);
      this.scenery.push(stump); this.shadows(stump, false);
      this.trees.push(new Tree(o, stump, r.x, r.z, s, r.a.includes('maple'))); this.nav.circle(r.x, r.z, .7);
    } else if (r.kind === 'rock') { this.rocks.push(new Rock(o, r.x, r.z, s)); const b = new THREE.Box3().setFromObject(o); this.nav.circle(r.x, r.z, Math.min(b.max.x - b.min.x, b.max.z - b.min.z) * .42); }
    else if (r.kind === 'apple') {
      const t = new AppleTree(o, r.x, r.z); const am = new THREE.MeshLambertMaterial({ color: '#d7263d', emissive: '#3a0008' }), ag = new THREE.SphereGeometry(.13, 8, 6);
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(ag, am); const a = i / 6 * 6.28 + .3; m.position.set(r.x + Math.cos(a) * 1.1, 2.3 + (i % 3) * .35, r.z + Math.sin(a) * .9 + .2); m.castShadow = false; this.scene.add(m); t.meshes.push(m); }
      this.apples.push(t); this.nav.circle(r.x, r.z, .6);
    } else if (r.kind === 'plot') {
      o.rotation.y = 0; o.traverse((m: any) => { if (m.isMesh) m.castShadow = false; });
      const p = new Plot(r.x, r.z);
      const wet = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 3.7), new THREE.MeshBasicMaterial({ color: '#2a1c10', transparent: true, opacity: 0, depthWrite: false }));
      wet.rotation.x = -Math.PI / 2; wet.position.set(r.x, .62, r.z); wet.renderOrder = 1; this.scene.add(wet); this.scenery.push(wet); p.wet = wet;
      // nine wheat clumps per plot, drawn as one instanced mesh per clump part (one shared tint per plot)
      const tpl = await loadAsset('farm/wheat_cluster'); tpl.updateMatrixWorld(true); const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); p.mats.push(mat);
      tpl.traverse((m: any) => { if (!m.isMesh) return; const im = new THREE.InstancedMesh(m.geometry, mat, 9); im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; im.count = 0; this.scene.add(im); p.parts.push({ im, local: m.matrixWorld.clone() }); });
      for (let i = 0; i < 9; i++) {
        const w = new THREE.Object3D(); w.position.set(r.x + (i % 3 - 1) * 1.15 + this.rng.range(-.15, .15), .35, r.z + (Math.floor(i / 3) - 1) * 1.15 + this.rng.range(-.15, .15)); w.rotation.y = this.rng.range(0, 6.28); w.visible = false; p.crops.push(w);
      }
      this.plots.push(p);
    }
  }

  async border() {
    const b = TOWN.bounds, rng = new RNG(7);
    for (let i = 0; i < 150; i++) {
      const side = rng.int(0, 3); let x = 0, z = 0;
      if (side === 0) { x = rng.range(b.minX - 30, b.maxX + 30); z = b.minZ - rng.range(1, 16); } else if (side === 1) { x = rng.range(b.minX - 30, b.maxX + 30); z = b.maxZ + rng.range(3, 14); }
      else if (side === 2) { x = b.minX - rng.range(1, 18); z = rng.range(b.minZ - 10, b.maxZ + 10); } else { x = b.maxX + rng.range(1, 18); z = rng.range(b.minZ - 10, b.maxZ + 10); }
      const out = Math.max(0, Math.max(b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ) - 2), y = Math.min(14, out * out * .02 + out * .12) * (0.75 + .25 * Math.sin(x * .1 + z * .13));
      const k = rng.next(), o = await loadAsset(k < .55 ? 'cozy/tree_pine_01' : k < .85 ? 'cozy/tree_oak_01' : 'cozy/bush_round_01');
      o.position.set(x, y - .1, z); o.scale.setScalar(rng.range(1.2, 2.1)); o.rotation.y = rng.range(0, 6.28); o.traverse((m: any) => { if (m.isMesh) m.receiveShadow = false; }); this.scene.add(o);
      this.scenery.push(o); this.borderScenery.push(o);
    }
  }
  async windmill() {
    const p = this.places.get('windmill'); if (!p?.obj) return;
    const sail = await loadAsset('cozy/windmill_sail_01'); sail.scale.setScalar(1.6);
    const hub = new THREE.Group(); hub.position.set(0, 4.25, 1.85); hub.add(sail); p.obj.add(hub); this.sail = hub;
    sail.scale.setScalar(1); this.moving.add(hub); this.shadows(sail, true);
  }
  async critters() {
    const pen: [number, number, number, number] = [32, 4, 45, 14];
    const spec: [string, number, number][] = [['farm/chicken', 6, 1.2], ['farm/cow', 1, .5], ['farm/sheep', 2, .45], ['farm/pig', 1, .5]];
    for (const [a, n, sp] of spec) for (let i = 0; i < n; i++) {
      const o = await loadAsset(a); const x = this.cosmeticRng.range(pen[0] + 1, pen[2] - 1), z = this.cosmeticRng.range(pen[1] + 1, pen[3] - 1);
      o.position.set(x, 0, z); this.scene.add(o); this.scenery.push(o); this.moving.add(o); this.shadows(o, a !== 'farm/chicken'); this.animals.push({ obj: o, x, z, tx: x, tz: z, speed: sp, pen, t: this.cosmeticRng.range(0, 5), kind: a.split('/')[1], hop: 0 });
    }
    this.nav.rect(38.5, 9, 7, 5.2, 0, 1); // paddock interior blocked for villagers except feeder spot
    this.nav.circle(35, 10, 1.2, 0); this.nav.rect(33.5, 6.5, 1.5, 3.6, 0, 0);
    const coop = this.places.get('coop'); if (coop) { coop.x = 33; coop.z = 8.5; }
    this.places.set('feeder', { id: 'feeder', kind: 'coop', name: 'the hen yard', x: 33.4, z: 9.6, cx: 35, cz: 10, enterable: false, district: 'farmstead', inside: new Set(), smokeUntil: 0 });
  }
  // Cheap procedural pets: a plaza dog and a few pond ducks. Few draw calls, no shadows.
  pets() {
    const M = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = false; return b; };
    // --- dog: a scruffy low-poly terrier that trots around the plaza ---
    const fur = M('#8a5a32'), furD = M('#6f471f'), g = new THREE.Group();
    g.add(box(.3, .26, .62, fur, 0, .34, 0));            // body
    const legs = new THREE.Group();
    for (const [lx, lz] of [[-.1, .22], [.1, .22], [-.1, -.22], [.1, -.22]] as [number, number][]) legs.add(box(.08, .24, .08, furD, lx, .12, lz));
    g.add(legs);
    const head = new THREE.Group(); head.position.set(0, .42, .36); head.add(box(.22, .22, .22, fur, 0, 0, 0)); head.add(box(.12, .1, .14, furD, 0, -.03, .14)); // snout
    head.add(box(.06, .12, .02, furD, -.1, .14, -.02)); head.add(box(.06, .12, .02, furD, .1, .14, -.02));  // ears
    g.add(head);
    const tail = box(.05, .05, .26, fur, 0, .44, -.34); tail.geometry.translate(0, 0, .13); tail.position.z = -.47; g.add(tail);
    g.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = false; }); g.position.set(-9, 0, 8); this.scene.add(g);
    this.dog = { obj: g, legs, tail, x: -9, z: 8, tx: -9, tz: 8, t: 0, ph: 0, wag: 0, trot: false };
    // --- ducks: bob about on the Riverside mill pond ---
    const bodyM = M('#4f5a52'), headM = M('#1f6b3a'), beakM = M('#e0a53a');
    for (const [pid, nD, dx, dz] of [['rivpond', 4, 2, 27], ['pond', 3, -36, 13]] as [string, number, number, number][]) {
    const pond = this.places.get(pid) as any; const pcx = pond?.cx ?? dx, pcz = pond?.cz ?? dz, pr = 1.7;
    for (let i = 0; i < nD; i++) {
      const d = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(.17, 7, 5), bodyM); body.scale.set(1, .7, 1.4); body.position.y = .08; d.add(body);
      const h = new THREE.Mesh(new THREE.SphereGeometry(.1, 6, 5), headM); h.position.set(0, .2, .18); d.add(h);
      d.add(box(.05, .04, .1, beakM, 0, .18, .28));
      const tl = box(.08, .05, .12, bodyM, 0, .12, -.2); tl.rotation.x = .5; d.add(tl);
      d.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = false; });
      const a = i / nD * 6.28, x = pcx + Math.cos(a) * pr * .6, z = pcz + Math.sin(a) * pr * .6;
      d.position.set(x, .22, z); this.scene.add(d);
      this.ducks.push({ obj: d, x, z, tx: x, tz: z, t: this.cosmeticRng.range(0, 4), cx: pcx, cz: pcz, r: pr });
    }
    }
  }

  glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,230,170,1)'); gr.addColorStop(.25, 'rgba(255,190,110,.55)'); gr.addColorStop(1, 'rgba(255,160,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  addLamp(x: number, y: number, z: number, size = 2.2) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); s.position.set(x, y, z); s.scale.setScalar(size); this.scene.add(s); this.lamps.push(s); return s; }
  nightLights() {
    const mk = (x: number, y: number, z: number, d: number, col = '#ffb36b') => { const l = new THREE.PointLight(col, 0, d, 1.6); l.position.set(x, y, z); this.scene.add(l); this.lights.push(l); return l; };
    mk(-9, 3.2, 4, 16); mk(-9.5, 3, -5.5, 12); this.campfireLight = mk(-25, 1.4, 10, 10, '#ff9a4a');
    this.campfireLight.decay = 2; this.campfireLight.castShadow = false;
    const smithy = this.places.get('smithy');
    if (smithy) {
      this.forgeLight = new THREE.PointLight('#ffae62', 0, 9, 2);
      this.forgeLight.position.set(smithy.x, 1.5, smithy.z);
      this.forgeLight.castShadow = false; this.scene.add(this.forgeLight);
    }
    for (let i = 0; i < 7; i++) this.addLamp(-11.4 + i * .64, 2.55 - Math.sin(i / 6 * Math.PI) * .45, -5.2, .9);
    const p = this.places.get('campfire'); if (p) { p.x = -25; p.z = 10; }
  }
  async setFestival(on: boolean) {
    this.festival = on;
    if (on && !this.bunting.length) for (const [x, z, r] of [[-15, 0, 0], [-3, 0, 0], [-17.5, 6, Math.PI / 2], [-.5, 6, Math.PI / 2]] as [number, number, number][]) { const o = await loadAsset('cozy/festival_bunting_01'); o.scale.setScalar(1.4); o.position.set(x, 0, z); o.rotation.y = r; this.shadows(o, false); this.scene.add(o); this.bunting.push(o); }
    for (const b of this.bunting) b.visible = on;
  }
  async setMerchant(on: boolean) {
    if (on && !this.merchantCart) { const o = await loadAsset('cozy/veh_horse_cart_01'); o.scale.setScalar(1.3); o.position.set(-21.4, 0, 1.2); o.rotation.y = .25; this.scene.add(o); this.merchantCart = o; const h = await loadAsset('farm/horse'); h.position.set(-24.6, 0, 2.0); h.rotation.y = -1.32; this.scene.add(h); (o as any).horse = h; }
    if (this.merchantCart) { this.merchantCart.visible = on; (this.merchantCart as any).horse.visible = on; }
  }
  seatsFor(place: string) { return this.seats.filter(s => s.place === place); }

  update(dt: number, gdt: number, clock: number, night: number) {
    this.night = night; const t = clock;
    if (this.sail) this.sail.rotation.z -= dt * .45;
    for (const s of this.lamps) (s.material as THREE.SpriteMaterial).opacity = night * (0.85 + Math.sin(t * .37 + s.position.x) * .08);
    this.lights[0].intensity = night * 10; this.lights[1].intensity = night * 8;
    this.fireTime += dt;
    const flicker = .9 + Math.sin(this.fireTime * 9.7) * .06 + Math.sin(this.fireTime * 17.3) * .04;
    this.campfireLight.intensity = (3 + clamp(night) * 24) * (this.festival ? 1.3 : 1) * flicker;
    if (this.forgeLight) {
      const smithy = this.places.get('smithy');
      this.forgeLight.intensity = (2 + clamp(night) * 12 + (smithy && smithy.smokeUntil > clock ? 10 : 0)) * flicker;
    }
    // campfire flames always (bigger at night)
    if (this.cosmeticRng.next() < dt * (12 + night * 30)) this.fx.flame(-25, .35, 10, .8 + night * .5); if (this.cosmeticRng.next() < dt * 3 * night) this.fx.ember(-25, .8, 10);
    for (const p of this.places.values()) if (p.chimney && (p.smokeUntil > clock || p.inside.size > 0 && (night > .2 || p.kind === 'bakery')) && this.cosmeticRng.next() < dt * 3) this.fx.smoke(p.chimney.x, p.chimney.y, p.chimney.z);
    if (night > .5 && this.cosmeticRng.next() < dt * 4) this.fx.firefly(-36 + (this.cosmeticRng.next() - .5) * 10, .4 + this.cosmeticRng.next() * 1.2, 13 + (this.cosmeticRng.next() - .5) * 8);
    if (night > .5 && this.cosmeticRng.next() < dt * 2) this.fx.firefly(3 + (this.cosmeticRng.next() - .5) * 10, .5 + this.cosmeticRng.next(), 17 + (this.cosmeticRng.next() - .5) * 6);
    if (this.cosmeticRng.next() < dt * 1.2) { const tr = this.cosmeticRng.pick(this.trees); if (tr.state === 'standing') this.fx.leaf(tr.x + (this.cosmeticRng.next() - .5) * 2, 3 + this.cosmeticRng.next() * 2, tr.z, tr.autumn); }
    // Trees
    for (const tr of this.trees) {
      if (tr.state === 'standing' && tr.shake > 0) { tr.shake = Math.max(0, tr.shake - dt * 3); tr.obj.rotation.z = Math.sin(tr.shake * 40) * tr.shake * .05; }
      if (tr.state === 'falling') { tr.t += dt; const u = Math.min(1, tr.t / 1.4), a = u * u * Math.PI / 2 * .98; tr.obj.rotation.set(Math.cos(tr.fallDir) * a, tr.obj.rotation.y, -Math.sin(tr.fallDir) * a, 'YXZ'); if (u >= 1 && tr.t < 1.45) { this.fx.dust(tr.x + Math.sin(tr.fallDir) * 3, tr.z + Math.cos(tr.fallDir) * 3, 26, 1.4); } if (tr.t > 2.6) { tr.obj.visible = false; tr.stump.visible = true; tr.state = 'stump'; tr.regrowAt = clock + 1440; } }
    }
    for (const r of this.rocks) {
      if (r.shake > 0) { r.shake = Math.max(0, r.shake - dt * 4); r.obj.position.x = r.x + Math.sin(r.shake * 60) * r.shake * .05; }
    }
    for (const p of this.plots) {
      (p.wet.material as THREE.MeshBasicMaterial).opacity = clamp(p.water) * .35;
      const vis = p.stage !== 'empty', g = p.stage === 'ripe' ? 1 : p.growth;
      p.crops.forEach((c, i) => { c.visible = vis; if (vis) { const s = .2 + g * (1.05 + (i % 3) * .08); c.scale.set(s * 1.15, s, s * 1.15); c.position.y = .3 + Math.sin(t * .9 + i) * 0; c.rotation.z = Math.sin(t * 1.3 + i * .7 + p.x) * .05; } });
      for (const pt of p.parts) { pt.im.count = vis ? p.crops.length : 0; if (!vis) continue; p.crops.forEach((c, i) => { c.updateMatrix(); this.cropM.multiplyMatrices(c.matrix, pt.local); pt.im.setMatrixAt(i, this.cropM); }); pt.im.instanceMatrix.needsUpdate = true; }
      const col = p.stage === 'ripe' ? new THREE.Color(1.05, 1, .85) : new THREE.Color().setRGB(.55 + .5 * g, 1, .45 + .4 * g);
      p.mats.forEach(m => m.color.copy(col));
    }
    for (const a of this.apples) a.meshes.forEach((m, i) => m.visible = i < a.apples);
    for (const an of this.animals) {
      an.t -= dt; const dx = an.tx - an.x, dz = an.tz - an.z, d = Math.hypot(dx, dz);
      if (an.t <= 0 || d < .1) { if (an.t <= 0) { const feed = an.kind === 'chicken' && an.hop > 0; an.tx = feed ? 35 + (this.cosmeticRng.next() - .5) * 2 : this.cosmeticRng.range(an.pen[0] + 1.2, an.pen[2] - 1.2); an.tz = feed ? 10 + (this.cosmeticRng.next() - .5) * 2 : this.cosmeticRng.range(an.pen[1] + 1.2, an.pen[3] - 1.2); an.t = this.cosmeticRng.range(3, 9); } }
      if (d > .1) { const sp = an.speed * (an.hop > 0 ? 2.2 : 1) * Math.min(1, d); an.x += dx / d * sp * dt; an.z += dz / d * sp * dt; const ty = Math.atan2(dx, dz); an.obj.rotation.y += Math.atan2(Math.sin(ty - an.obj.rotation.y), Math.cos(ty - an.obj.rotation.y)) * Math.min(1, dt * 4); an.obj.position.y = an.kind === 'chicken' ? Math.abs(Math.sin(t * 14 + an.x)) * .05 : 0; }
      else if (an.kind === 'chicken') an.obj.rotation.x = Math.max(0, Math.sin(t * 6 + an.z)) * .4;
      an.hop = Math.max(0, an.hop - dt); an.obj.position.x = an.x; an.obj.position.z = an.z;
    }
    // village dog: trots after the nearest villager on foot, else pootles around the plaza
    if (this.dog) {
      const dg = this.dog; dg.t -= dt; let best: { x: number; z: number } | null = null, bd = 16;
      for (const c of this.crowd) { if (c.inside) continue; const d = Math.hypot(c.x - dg.x, c.z - dg.z); if (d < bd) { bd = d; best = c; } }
      if (best) { dg.trot = true; const d = Math.max(.001, bd); dg.tx = best.x - (best.x - dg.x) / d * 1.7; dg.tz = best.z - (best.z - dg.z) / d * 1.7; }
      else { dg.trot = false; if (dg.t <= 0) { dg.tx = clamp(-9 + (this.cosmeticRng.next() - .5) * 22, -20, 4); dg.tz = clamp(5 + (this.cosmeticRng.next() - .5) * 16, -2, 15); dg.t = this.cosmeticRng.range(2, 5); } }
      const dx = dg.tx - dg.x, dz = dg.tz - dg.z, dd = Math.hypot(dx, dz), moving = dd > .3;
      if (moving) { const sp = dg.trot ? 2.7 : 1.4; dg.x += dx / dd * sp * dt; dg.z += dz / dd * sp * dt; const ty = Math.atan2(dx, dz); dg.obj.rotation.y += Math.atan2(Math.sin(ty - dg.obj.rotation.y), Math.cos(ty - dg.obj.rotation.y)) * Math.min(1, dt * 6); dg.ph += dt * (dg.trot ? 16 : 9); }
      dg.obj.position.set(dg.x, moving ? Math.abs(Math.sin(dg.ph)) * .03 : 0, dg.z);
      dg.legs.children.forEach((l, i) => { (l as THREE.Object3D).rotation.x = moving ? Math.sin(dg.ph + (i % 2) * Math.PI) * .6 : 0; });
      dg.wag += dt * (dg.trot || !moving ? 13 : 6); dg.tail.rotation.y = Math.sin(dg.wag) * .5;
    }
    // ducks: drift lazily about the mill pond
    for (const dk of this.ducks) {
      dk.t -= dt; if (dk.t <= 0) { const a = this.cosmeticRng.next() * 6.28, rr = this.cosmeticRng.next() * dk.r; dk.tx = dk.cx + Math.cos(a) * rr; dk.tz = dk.cz + Math.sin(a) * rr; dk.t = this.cosmeticRng.range(3, 7); }
      const dx = dk.tx - dk.x, dz = dk.tz - dk.z, d = Math.hypot(dx, dz);
      if (d > .05) { dk.x += dx / d * .35 * dt; dk.z += dz / d * .35 * dt; const ty = Math.atan2(dx, dz); dk.obj.rotation.y += Math.atan2(Math.sin(ty - dk.obj.rotation.y), Math.cos(ty - dk.obj.rotation.y)) * Math.min(1, dt * 3); }
      dk.obj.position.set(dk.x, .2 + Math.sin(t * 2 + dk.x) * .02, dk.z);
    }
  }
  // time-based state (called from the sim step so it is correct at any speed, including headless fast-forward)
  simTick(gdt: number, clock: number) {
    for (const tr of this.trees) {
      if (tr.state === 'stump' && clock > tr.regrowAt) { tr.state = 'growing'; tr.t = 0; tr.obj.rotation.set(0, tr.obj.rotation.y, 0); tr.obj.visible = true; tr.obj.scale.setScalar(.05); tr.stump.visible = false; tr.hp = 6; }
      if (tr.state === 'growing') { tr.t += gdt; const u = Math.min(1, tr.t / 480); tr.obj.scale.setScalar(tr.baseScale * (.08 + .92 * u)); if (u >= 1) tr.state = 'standing'; }
    }
    for (const r of this.rocks) {
      if (r.state === 'gone' && clock > r.regrowAt) { r.state = 'rising'; r.t = 0; r.obj.visible = true; r.hp = r.maxHp; }
      if (r.state === 'rising') { r.t += gdt; const u = Math.min(1, r.t / 240); r.obj.scale.setScalar(r.baseScale * u); r.obj.position.y = -(1 - u) * .5; if (u >= 1) r.state = 'solid'; }
    }
    for (const p of this.plots) {
      p.water = Math.max(0, p.water - gdt / 720);
    }
    for (const a of this.apples) { a.t += gdt; if (a.apples < a.meshes.length && a.t > 200) { a.apples++; a.t = 0; } }
  }
  feedAnimals() { for (const a of this.animals) if (a.kind === 'chicken') { a.hop = 8; a.t = 0; } }
}
