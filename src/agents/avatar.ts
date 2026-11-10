import * as THREE from 'three';
import { createDressedCharacter } from '@char/vanilla/dressed-character';
import type { VillagerDef } from '../data/villagers';
import { RNG, clamp } from '../core/util';
import { makeTool, makeCarry, makeBanner } from './props';

export type Anim = 'idle' | 'walk' | 'run' | 'chop' | 'mine' | 'hoe' | 'water' | 'sit' | 'talk' | 'fight' | 'cheer' | 'dance' | 'pickup' | 'feed' | 'give' | 'hammer' | 'knead' | 'drink' | 'sad' | 'wave' | 'point' | 'laugh';
const EXPR_MAP: Record<string, string> = { happy: 'happy', grin: 'grin', sad: 'sad', angry: 'angry', scared: 'scared', surprised: 'surprised', sleepy: 'sleepy', love: 'love', smirk: 'smirk', determined: 'determined', dizzy: 'dizzy', neutral: 'neutral', knockedOut: 'knockedOut' };

export function generateOutfit(def: VillagerDef, seed: number) {
  const r = new RNG(seed); const o: any = { hair: null, facialHair: null, headgear: null, tops: 'tee', bottoms: 'trousers', shoes: 'sneaker', outerwear: null, accessories: [] as string[] };
  for (const [slot, pool] of Object.entries(def.outfit.pools)) { if (slot === 'accessories') o.accessories = pool.filter(() => r.chance(.5)).slice(0, 2); else o[slot] = r.pick(pool); }
  for (const [slot, v] of Object.entries(def.outfit.fixed)) { if (slot === 'accessories') o.accessories = [...new Set([...(v as string[]), ...o.accessories])]; else o[slot] = v; }
  for (const k of Object.keys(o)) if (o[k] === undefined) o[k] = null;
  return o;
}

export class Avatar {
  root = new THREE.Group(); body: THREE.Group; handle: any; bones: Record<string, THREE.Bone>; bind = new Map<THREE.Bone, THREE.Quaternion>();
  anim: Anim = 'idle'; phase = Math.random() * 10; expr = 'neutral'; heading = 0; targetHeading = 0; alpha = 1; targetAlpha = 1; seatY = 0;
  // Set while physically seated, including upper-body gestures; clear on leaving the seat.
  seated = false;
  tool: THREE.Object3D | null = null; toolKind = ''; carry: THREE.Object3D | null = null; carryKind = ''; banner: THREE.Object3D | null = null; bannerColor = '';
  hitPhase = 0; onHit: (() => void) | null = null; height: number; mats: THREE.Material[] = []; hips: THREE.Bone; hipsY: number; hipM = 1; sitH = .5; outfit: any; bob = 0;
  // Far LOD (presentation only): small overlay meshes to drop when the avatar is tiny on screen.
  lodFar = false; private lodMeshes: THREE.Mesh[] = [];
  constructor(public def: VillagerDef, seed: number) {
    this.outfit = generateOutfit(def, seed);
    this.handle = createDressedCharacter({ styleId: 'hero', paletteId: def.palette, colors: { skin: def.skin, hair: def.hair } as any, proportions: { targetHeight: def.height } as any }, this.outfit);
    this.body = this.handle.group; this.root.add(this.body); this.bones = this.handle.build.boneByShortName; this.height = def.height;
    for (const b of this.handle.build.bones as THREE.Bone[]) this.bind.set(b, b.quaternion.clone());
    this.hips = this.bones.Hips; this.hipsY = this.hips.position.y; this.root.updateMatrixWorld(true); this.hipM = new THREE.Vector3().setFromMatrixPosition(this.hips.matrixWorld).y || this.height * .5;
    this.body.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; const arr = Array.isArray(m.material) ? m.material : [m.material]; for (const mt of arr) if (!this.mats.includes(mt)) this.mats.push(mt); } });
    this.handle.face?.setAutoBlink?.(true);
    // Far LOD: catalogue small, non-structural overlays (trims, bags, loose accessories) that neither
    // define the silhouette nor sit in the head region, so dropping them past ~34 m cuts draws/triangles
    // while the main body mesh, hair/hats and the face (hence portraits) always stay drawn.
    { let maxTri = 0; const cand: [THREE.Mesh, number, boolean][] = []; const bx = new THREE.Box3();
      this.body.traverse((o: any) => { if (!o.isMesh || o.name === 'CharacterOutline' || o.name === 'face') return;
        const g = o.geometry as THREE.BufferGeometry, tri = (g.index ? g.index.count : g.attributes.position.count) / 3;
        bx.setFromObject(o); cand.push([o, tri, bx.min.y < this.height * .68]); if (tri > maxTri) maxTri = tri; });
      for (const [m, tri, low] of cand) if (low && tri < maxTri * .22) this.lodMeshes.push(m); }
    this.buildMerged();
  }
  // Keep CharacterMesh intact for material/name consumers. Both twins share its skeleton and
  // vertex buffers; only their index order and baked colours belong to this avatar.
  private mainMesh: THREE.SkinnedMesh | null = null;
  private nearMesh: THREE.SkinnedMesh | null = null;
  private farMesh: THREE.SkinnedMesh | null = null;
  private mergedMat: THREE.MeshToonMaterial | null = null;
  private characterLod: THREE.LOD | null = null;
  private colourStamp = '';
  farOn = false;
  private buildMerged() {
    const main = this.body.getObjectByName('CharacterMesh') as THREE.SkinnedMesh | undefined;
    if (!main?.isSkinnedMesh || !Array.isArray(main.material) || main.geometry.index) return;
    const materials = main.material as THREE.MeshToonMaterial[], src = main.geometry;
    const base = materials.find(m => m.isMeshToonMaterial && m.name !== 'face');
    const face = materials.find(m => m.name === 'face');
    if (!base || !face) return;
    const opaqueIndices: number[] = [], faceIndices: number[] = [];
    for (const group of src.groups) {
      const indices = materials[group.materialIndex ?? 0] === face ? faceIndices : opaqueIndices;
      for (let i = group.start; i < Math.min(group.start + group.count, src.attributes.position.count); i++) indices.push(i);
    }
    const geometry = new THREE.BufferGeometry();
    // Include UVs for the original face texture as well as all skinning attributes.
    for (const [name, attribute] of Object.entries(src.attributes)) geometry.setAttribute(name, attribute);
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 3), 3));
    geometry.setIndex([...opaqueIndices, ...faceIndices]);
    geometry.addGroup(0, opaqueIndices.length, 0);
    geometry.addGroup(opaqueIndices.length, faceIndices.length, 1);
    geometry.boundingBox = src.boundingBox; geometry.boundingSphere = src.boundingSphere;
    const mat = base.clone(); mat.name = 'mergedLod'; mat.color.set(0xffffff); mat.vertexColors = true;
    mat.onBeforeCompile = base.onBeforeCompile; mat.customProgramCacheKey = base.customProgramCacheKey;
    const near = new THREE.SkinnedMesh(geometry, [mat, face]); near.name = 'CharacterNear';
    // The far twin omits the decal triangles entirely (one opaque draw, no black face quad).
    const farGeometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) farGeometry.setAttribute(name, attribute);
    farGeometry.setIndex(opaqueIndices); farGeometry.boundingBox = src.boundingBox; farGeometry.boundingSphere = src.boundingSphere;
    const far = new THREE.SkinnedMesh(farGeometry, mat); far.name = 'CharacterFar';
    const lod = new THREE.LOD(); lod.name = 'CharacterLOD';
    lod.position.copy(main.position); lod.quaternion.copy(main.quaternion); lod.scale.copy(main.scale);
    for (const mesh of [near, far]) {
      mesh.bindMode = main.bindMode; mesh.bind(main.skeleton, main.bindMatrix);
      mesh.bindMatrixInverse.copy(main.bindMatrixInverse); mesh.frustumCulled = false;
      mesh.castShadow = main.castShadow; mesh.receiveShadow = main.receiveShadow;
    }
    lod.addLevel(near, 0); lod.addLevel(far, 42, 4 / 42);
    main.parent!.add(lod); main.visible = false;
    this.mainMesh = main; this.nearMesh = near; this.farMesh = far; this.mergedMat = mat; this.characterLod = lod;
    this.mats.push(mat); this.refreshMerged();
  }
  /** Re-bake opaque colours after outfit tint changes; face expressions keep their original material. */
  refreshMerged() {
    if (!this.mainMesh || !this.nearMesh) return;
    const materials = this.mainMesh.material as THREE.MeshToonMaterial[];
    const colours = this.nearMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (const group of this.mainMesh.geometry.groups) {
      const material = materials[group.materialIndex ?? 0]; if (!material || material.name === 'face') continue;
      const c = material.color;
      for (let i = group.start; i < Math.min(group.start + group.count, colours.count); i++) colours.setXYZ(i, c.r, c.g, c.b);
    }
    colours.needsUpdate = true;
    this.colourStamp = this.materialStamp();
  }
  private materialStamp() {
    return (this.mainMesh?.material as THREE.MeshToonMaterial[] | undefined)?.map(m =>
      m.name === 'face' ? '' : `${m.color.r},${m.color.g},${m.color.b}`).join(';') ?? '';
  }
  // Presentation only. Renderer-driven LOD also selects the detailed twin for the portrait
  // camera, even when setLod last saw a distant main camera. Body visibility still gates both.
  setLod(dist: number) {
    if (this.materialStamp() !== this.colourStamp) this.refreshMerged();
    // Nonuniform emissive flashes cannot be baked into one toon material: retain the exact
    // original rendering for their duration, including changes made by external consumers.
    const flashing = (this.mainMesh?.material as THREE.MeshToonMaterial[] | undefined)?.some(m =>
      m.name !== 'face' && m.emissive && m.emissiveIntensity !== 0 && m.emissive.getHex() !== 0) ?? false;
    if (this.mainMesh && this.characterLod) { this.mainMesh.visible = flashing; this.characterLod.visible = !flashing; }
    this.farOn = dist > (this.farOn ? 38 : 42);
    const far = dist > (this.lodFar ? 30 : 34); if (far === this.lodFar) return; this.lodFar = far;
    for (const m of this.lodMeshes) m.visible = !far;
    if (this.tool) this.tool.visible = !far; if (this.carry) this.carry.visible = !far; if (this.banner) this.banner.visible = !far;
  }
  // jump straight to an opacity (cuts, flashbacks): mid-fade transparency sorting can paint the face decal black
  snapAlpha(a: number) { this.alpha = this.targetAlpha = a; this.root.visible = a > .03; for (const m of this.mats) { const face = m.name === 'face'; m.transparent = a < .99 || face; m.opacity = a; m.depthWrite = a > .5 && !face; } }
  setExpression(e: string) { e = EXPR_MAP[e] ?? 'neutral'; if (e !== this.expr) { this.expr = e; this.handle.setExpression(e); } }
  setTool(kind: string) {
    if (kind === this.toolKind) return; if (this.tool) this.tool.parent?.remove(this.tool); this.tool = null; this.toolKind = kind; if (!kind) return;
    this.tool = makeTool(kind); const hand = this.bones.RightHand; hand.add(this.tool);
    // Hand local X runs down the arm; point the handle across the fist (local -Z toward the front when arm hangs).
    const upright = kind === 'mug' || kind === 'can' || kind === 'basket';
    if (upright) this.tool.rotation.set(0, 0, -Math.PI / 2); else this.tool.rotation.set(Math.PI / 2, 0, 0); // tools: handle points forward out of the fist
    const scale = 1 / this.worldScaleOf(hand);
    const striking = kind === 'hammer' || kind === 'axe' || kind === 'pickaxe';
    // Move the grip forward so the raised handle stays ahead of the face.
    this.tool.position.set(.06, 0, striking ? -.10 * scale : 0); this.tool.scale.setScalar(scale);
    if (this.lodFar) this.tool.visible = false;
  }
  setCarry(kind: string) {
    if (kind === this.carryKind) return; if (this.carry) this.carry.parent?.remove(this.carry); this.carry = null; this.carryKind = kind; if (!kind) return;
    this.carry = makeCarry(kind); const sp = this.bones.Spine2; sp.add(this.carry); const s = 1 / this.worldScaleOf(sp); this.carry.scale.setScalar(s);
    this.carry.position.set(0, .12 * s, -.24 * s); // on the back
    if (this.lodFar) this.carry.visible = false;
  }
  setBanner(color: string) {
    if (color === this.bannerColor) return; this.bannerColor = color; if (this.banner) this.banner.parent?.remove(this.banner); this.banner = null; if (!color) return;
    this.banner = makeBanner(color); const sp = this.bones.Spine2; sp.add(this.banner); const s = 1 / this.worldScaleOf(sp); this.banner.scale.setScalar(s * .9); this.banner.position.set(-.12 * s, 0, -.18 * s);
    if (this.lodFar) this.banner.visible = false;
  }
  worldScaleOf(o: THREE.Object3D) { const v = new THREE.Vector3(); o.updateWorldMatrix(true, false); o.getWorldScale(v); const r = new THREE.Vector3(); this.root.getWorldScale(r); return v.x / r.x; }
  headPos(out = new THREE.Vector3()) { return out.set(this.root.position.x, this.root.position.y + this.height + .35, this.root.position.z); }
  private q = new THREE.Quaternion(); private e = new THREE.Euler();
  private armQ = new THREE.Quaternion(); private downQ = new THREE.Quaternion();
  private axisX = new THREE.Vector3(1, 0, 0); private axisZ = new THREE.Vector3(0, 0, 1);
  private previousAnim: Anim = 'idle';
  private pose(name: string, x: number, y: number, z: number, order: THREE.EulerOrder = 'XYZ') { const b = this.bones[name]; if (!b) return; this.e.set(x, y, z, order); b.quaternion.copy(this.bind.get(b)!).multiply(this.q.setFromEuler(this.e)); }
  // arm: fwd (radians forward swing), out (abduction), elbow (forward bend)
  private arm(side: 'L' | 'R', fwd: number, out = 0, elbow = 0) {
    const s = side === 'L' ? 1 : -1, b = this.bones[side === 'L' ? 'LeftArm' : 'RightArm'];
    const qa = this.armQ.setFromAxisAngle(this.axisX, s * fwd), qd = this.downQ.setFromAxisAngle(this.axisZ, -s * (1.42 - out));
    b.quaternion.copy(this.bind.get(b)!).multiply(qa).multiply(qd);
    this.pose(side === 'L' ? 'LeftForeArm' : 'RightForeArm', 0, -s * elbow, 0);
  }
  private leg(side: 'L' | 'R', fwd: number, knee = 0) { this.pose(side === 'L' ? 'LeftUpLeg' : 'RightUpLeg', -fwd, 0, 0); this.pose(side === 'L' ? 'LeftLeg' : 'RightLeg', knee, 0, 0); }

  update(dt: number, speed01: number) {
    dt = clamp(dt, 0, .1);
    this.phase += dt; const p = this.phase, A = this.anim;
    const changed = A !== this.previousAnim; this.previousAnim = A;
    // heading ease
    const dh = Math.atan2(Math.sin(this.targetHeading - this.heading), Math.cos(this.targetHeading - this.heading)); this.heading += dh * Math.min(1, dt * 9); this.root.rotation.y = this.heading;
    if (Math.abs(this.targetAlpha - this.alpha) > .001) { this.alpha += (this.targetAlpha - this.alpha) * Math.min(1, dt * 5); const a = this.alpha; this.root.visible = a > .03; for (const m of this.mats) { const face = m.name === 'face'; m.transparent = a < .99 || face; m.opacity = a; m.depthWrite = a > .5 && !face; } }
    for (const [b, q] of this.bind) b.quaternion.copy(q);
    let hipY = 0, spineX = 0, headX = 0, headY = 0, hipRot = 0;
    const breathe = Math.sin(p * 2.2) * .02;
    const prevHit = changed ? -1 : this.hitPhase;
    let leanZ = 0;
    switch (A) {
      case 'walk': case 'run': {
        const run = A === 'run', f = run ? 11 : 7.5 * (0.6 + speed01 * .4), w = p * f, s = Math.sin(w), amp = run ? .9 : .55;
        const carryArms = !!this.carry && !run;
        this.arm('L', carryArms ? .1 : -s * amp * .9, .08, run ? 1.3 : .25); this.arm('R', carryArms ? .1 : s * amp * .9, .08, run ? 1.3 : .25);
        this.leg('L', s * amp, Math.max(0, -Math.cos(w)) * amp * 1.2 + .05); this.leg('R', -s * amp, Math.max(0, Math.cos(w)) * amp * 1.2 + .05);
        hipY = -Math.cos(w * 2) * (run ? .055 : .025); spineX = run ? .2 : .04; hipRot = s * (run ? .12 : .07); leanZ = Math.cos(w) * .025; break;
      }
      case 'chop': case 'mine': case 'hammer': {
        const cyc = A === 'hammer' ? 1.0 : 1.35, u = (p % cyc) / cyc, raise = u < .62 ? Math.sin(u / .62 * Math.PI / 2) : u < .9 ? 1 - Math.pow((u - .62) / .28, 2) : 0;
        // Swing beside the head rather than folding the tool back over the crown.
        const up = A === 'hammer' ? .4 + raise * 1.1 : .5 + raise * 1.35;
        this.arm('R', up, .35 + raise * .25, .2 + (1 - raise) * .3); this.arm('L', A === 'hammer' ? .5 : up * .95, .35, .4);
        spineX = .1 + (1 - raise) * .35; hipY = -.03; this.leg('L', .25, .25); this.leg('R', -.15, .1);
        this.hitPhase = u; if (!changed && (prevHit < .9 && u >= .9 || prevHit > u && prevHit < .9)) this.onHit?.(); break;
      }
      case 'hoe': {
        const u = (p % 1.55) / 1.55;
        const lift = u < .55 ? Math.sin(u / .55 * Math.PI / 2) : Math.max(0, 1 - (u - .55) / .28);
        this.arm('R', .55 + lift * 1.05, .18, .35 + lift * .4);
        this.arm('L', .5 + lift * .8, .22, .55);
        spineX = .2 + (1 - lift) * .25; hipY = -.035;
        this.leg('L', .18, .18); this.leg('R', -.12, .12);
        if (!changed && (prevHit < .83 && u >= .83 || prevHit > u && prevHit < .83)) this.onHit?.();
        this.hitPhase = u; break;
      }
      case 'knead': {
        const u = Math.sin(p * 6); this.arm('R', .7 + u * .45, .15, .6); this.arm('L', .7 - u * .2, .15, .7); spineX = .35 + u * .08; this.leg('L', .2, .2); this.leg('R', -.1, .1);
        const ph = (p * 6) % 6.283; if (ph < this.hitPhase) this.onHit?.(); this.hitPhase = ph; break;
      }
      case 'water': case 'feed': case 'pickup': case 'give': case 'point': {
        const k = A === 'feed' ? Math.max(0, Math.sin(p * 4)) : A === 'pickup' ? .5 + .5 * Math.sin(p * 2.5) : .6;
        this.arm('R', .9 + k * .5, .2, .3); this.arm('L', A === 'pickup' ? .9 + k * .5 : .2, .1, .4); spineX = A === 'pickup' ? .4 + k * .4 : A === 'water' ? .25 : .1;
        if (A === 'pickup') { hipY = -.18 * k; this.leg('L', .45 * k, .85 * k); this.leg('R', .45 * k, .85 * k); }
        const ph = (p * 4) % 6.283; if (ph < this.hitPhase) this.onHit?.(); this.hitPhase = ph; break;
      }
      case 'sit': { this.leg('L', 1.5, 1.45); this.leg('R', 1.5, 1.45); this.arm('L', .55, .12, .65); this.arm('R', .55, .12, .65); hipY = -(this.hipM - this.sitH); spineX = -.05 + breathe; headX = Math.sin(p * .7) * .05; headY = Math.sin(p * .4) * .25; break; }
      case 'talk': { const g = Math.sin(p * 3.1), reply = .5 + .5 * Math.sin(p * .9); this.arm('R', .4 + g * .25, .22, .8 + g * .25); this.arm('L', .15 + reply * .4, .15, .4 + reply * .5); leanZ = Math.sin(p * 1.4) * .025; headX = Math.sin(p * 5) * .06; headY = Math.sin(p * 1.3) * .15; hipY = breathe; break; }
      case 'laugh': { const chuckle = Math.sin(p * 10); this.arm('L', .5, .18, 1); this.arm('R', .6, .2, 1.1); spineX = -.08 + chuckle * .04; headX = -.12 + chuckle * .04; hipY = Math.abs(chuckle) * .025; break; }
      case 'drink': { const u = (p % 4) / 4, sip = Math.min(clamp((u - .25) / .2), clamp((.9 - u) / .15)); this.arm('R', .6 + sip * .9, .1, 1.9 - sip * .2); this.arm('L', .1, .05, .2); headX = -sip * .3; break; }
      case 'fight': { const a = Math.sin(p * 14), b = Math.cos(p * 13); this.arm('L', 1.1 + a * .55, .35, .95 - a * .4); this.arm('R', 1.1 - a * .55, .35, .95 + a * .4); leanZ = b * .07; hipRot = a * .16; hipY = Math.abs(Math.sin(p * 9)) * .12; spineX = .2; this.leg('L', .3 + b * .2, .3); this.leg('R', -.3 - b * .2, .3); headY = a * .2; break; }
      case 'dance': { const beat = p * 6, sway = Math.sin(beat * .5); this.arm('L', .9 + Math.sin(beat) * .6, .35, .8); this.arm('R', .9 - Math.sin(beat) * .6, .35, .8); this.leg('L', .15 + sway * .25, .15 + Math.max(0, -sway) * .4); this.leg('R', .15 - sway * .25, .15 + Math.max(0, sway) * .4); hipY = .025 * Math.cos(beat * 2) - .025; hipRot = sway * .28; leanZ = sway * .09; headY = -hipRot * .5; break; }
      case 'cheer': { const h = Math.abs(Math.sin(p * 8)); this.arm('L', 2.8 + Math.sin(p * 8) * .2, .5, .2); this.arm('R', 2.8 - Math.sin(p * 8) * .2, .5, .2); hipY = h * .1; hipRot = Math.sin(p * 4) * .06; this.leg('L', h * .3, h * .5); this.leg('R', -h * .1, h * .2); break; }
      case 'wave': { this.arm('R', 2.6, .6, .65 + Math.sin(p * 9) * .3); this.arm('L', .05, .05, .2); hipY = breathe; break; }
      case 'sad': { this.arm('L', .12, .03, .18); this.arm('R', .12, .03, .18); spineX = .28 + breathe; headX = .3; headY = Math.sin(p * .45) * .08; hipY = -.035; this.leg('L', .05, .08); this.leg('R', .05, .08); break; }
      default: { this.arm('L', .05 + breathe, .05, .15); this.arm('R', .05 - breathe, .05, .15); hipY = breathe * .35; leanZ = Math.sin(p * .65) * .025; const glance = Math.pow(Math.max(0, Math.sin(p * .37)), 4); headY = Math.sin(p * .71) * .45 * glance; headX = Math.sin(p * .33) * .04; this.leg('L', 0, .025 + Math.max(0, leanZ)); this.leg('R', 0, .025 + Math.max(0, -leanZ)); }
    }
    // Layer seating after the gesture, replacing every lower-body contribution.
    // seatY remains the existing body elevation offset; sitH is the seat's hip height.
    if (A === 'sit' || (this.seated || this.seatY !== 0) &&
      (A === 'idle' || A === 'talk' || A === 'drink' || A === 'cheer' || A === 'laugh' || A === 'wave' || A === 'point' || A === 'give' || A === 'sad')) {
      this.leg('L', 1.5, 1.45); this.leg('R', 1.5, 1.45);
      hipY = -(this.hipM - this.sitH); hipRot = 0;
    }
    if (A === 'idle' && this.carry) { this.arm('L', .1, .05, .2); this.arm('R', .1, .05, .2); }
    this.pose('Spine', spineX * .5, hipRot * .5, leanZ); this.pose('Spine1', spineX * .5, 0, 0); this.pose('Head', headX, headY, 0); this.pose('Hips', 0, hipRot, 0);
    this.hips.position.y = this.hipsY + hipY * this.hipsY / this.hipM;
    this.body.position.y = this.seatY;
    if (this.banner) (this.banner as any).flag.rotation.x = Math.sin(p * 4) * .15;
    this.handle.update(dt);
  }
  dispose() {
    // Dispose only owned geometry/index/colour buffers and the one cloned material.
    this.characterLod?.removeFromParent(); this.nearMesh?.geometry.dispose(); this.farMesh?.geometry.dispose();
    this.mergedMat?.dispose(); this.handle.dispose();
  }
}
