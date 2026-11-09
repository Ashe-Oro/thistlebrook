import * as THREE from 'three';
import { createDressedCharacter } from '@char/vanilla/dressed-character';
import type { VillagerDef } from '../data/villagers';
import { RNG, clamp } from '../core/util';
import { makeTool, makeCarry, makeBanner } from './props';

export type Anim = 'idle' | 'walk' | 'run' | 'chop' | 'mine' | 'hoe' | 'water' | 'sit' | 'talk' | 'fight' | 'cheer' | 'dance' | 'pickup' | 'feed' | 'give' | 'hammer' | 'knead' | 'drink' | 'sad' | 'wave' | 'point';
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
  tool: THREE.Object3D | null = null; toolKind = ''; carry: THREE.Object3D | null = null; carryKind = ''; banner: THREE.Object3D | null = null; bannerColor = '';
  hitPhase = 0; onHit: (() => void) | null = null; height: number; mats: THREE.Material[] = []; hips: THREE.Bone; hipsY: number; hipM = 1; sitH = .5; outfit: any; bob = 0;
  constructor(public def: VillagerDef, seed: number) {
    this.outfit = generateOutfit(def, seed);
    this.handle = createDressedCharacter({ styleId: 'hero', paletteId: def.palette, colors: { skin: def.skin, hair: def.hair } as any, proportions: { targetHeight: def.height } as any }, this.outfit);
    this.body = this.handle.group; this.root.add(this.body); this.bones = this.handle.build.boneByShortName; this.height = def.height;
    for (const b of this.handle.build.bones as THREE.Bone[]) this.bind.set(b, b.quaternion.clone());
    this.hips = this.bones.Hips; this.hipsY = this.hips.position.y; this.root.updateMatrixWorld(true); this.hipM = new THREE.Vector3().setFromMatrixPosition(this.hips.matrixWorld).y || this.height * .5;
    this.body.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; const arr = Array.isArray(m.material) ? m.material : [m.material]; for (const mt of arr) if (!this.mats.includes(mt)) this.mats.push(mt); } });
    this.handle.face?.setAutoBlink?.(true);
  }
  setExpression(e: string) { e = EXPR_MAP[e] ?? 'neutral'; if (e !== this.expr) { this.expr = e; this.handle.setExpression(e); } }
  setTool(kind: string) {
    if (kind === this.toolKind) return; if (this.tool) this.tool.parent?.remove(this.tool); this.tool = null; this.toolKind = kind; if (!kind) return;
    this.tool = makeTool(kind); const hand = this.bones.RightHand; hand.add(this.tool);
    // Hand local X runs down the arm; point the handle across the fist (local -Z toward the front when arm hangs).
    const upright = kind === 'mug' || kind === 'can' || kind === 'basket';
    if (upright) this.tool.rotation.set(0, 0, -Math.PI / 2); else this.tool.rotation.set(Math.PI / 2, 0, 0); // tools: handle points forward out of the fist
    this.tool.position.set(.06, 0, 0); this.tool.scale.setScalar(1 / this.worldScaleOf(hand));
  }
  setCarry(kind: string) {
    if (kind === this.carryKind) return; if (this.carry) this.carry.parent?.remove(this.carry); this.carry = null; this.carryKind = kind; if (!kind) return;
    this.carry = makeCarry(kind); const sp = this.bones.Spine2; sp.add(this.carry); const s = 1 / this.worldScaleOf(sp); this.carry.scale.setScalar(s);
    this.carry.position.set(0, .12 * s, -.24 * s); // on the back
  }
  setBanner(color: string) {
    if (color === this.bannerColor) return; this.bannerColor = color; if (this.banner) this.banner.parent?.remove(this.banner); this.banner = null; if (!color) return;
    this.banner = makeBanner(color); const sp = this.bones.Spine2; sp.add(this.banner); const s = 1 / this.worldScaleOf(sp); this.banner.scale.setScalar(s * .9); this.banner.position.set(-.12 * s, 0, -.18 * s);
  }
  worldScaleOf(o: THREE.Object3D) { const v = new THREE.Vector3(); o.updateWorldMatrix(true, false); o.getWorldScale(v); const r = new THREE.Vector3(); this.root.getWorldScale(r); return v.x / r.x; }
  headPos(out = new THREE.Vector3()) { return out.set(this.root.position.x, this.root.position.y + this.height + .35, this.root.position.z); }
  private q = new THREE.Quaternion(); private e = new THREE.Euler();
  private pose(name: string, x: number, y: number, z: number, order: THREE.EulerOrder = 'XYZ') { const b = this.bones[name]; if (!b) return; this.e.set(x, y, z, order); b.quaternion.copy(this.bind.get(b)!).multiply(this.q.setFromEuler(this.e)); }
  // arm: fwd (radians forward swing), out (abduction), elbow (forward bend)
  private arm(side: 'L' | 'R', fwd: number, out = 0, elbow = 0) {
    const s = side === 'L' ? 1 : -1, b = this.bones[side === 'L' ? 'LeftArm' : 'RightArm'];
    const qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), s * fwd), qd = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -s * (1.42 - out));
    b.quaternion.copy(this.bind.get(b)!).multiply(qa).multiply(qd);
    this.pose(side === 'L' ? 'LeftForeArm' : 'RightForeArm', 0, -s * elbow, 0);
  }
  private leg(side: 'L' | 'R', fwd: number, knee = 0) { this.pose(side === 'L' ? 'LeftUpLeg' : 'RightUpLeg', -fwd, 0, 0); this.pose(side === 'L' ? 'LeftLeg' : 'RightLeg', knee, 0, 0); }

  update(dt: number, speed01: number) {
    this.phase += dt; const p = this.phase, A = this.anim;
    // heading ease
    const dh = Math.atan2(Math.sin(this.targetHeading - this.heading), Math.cos(this.targetHeading - this.heading)); this.heading += dh * Math.min(1, dt * 9); this.root.rotation.y = this.heading;
    if (Math.abs(this.targetAlpha - this.alpha) > .001) { this.alpha += (this.targetAlpha - this.alpha) * Math.min(1, dt * 5); const a = this.alpha; this.root.visible = a > .03; for (const m of this.mats) { m.transparent = a < .99; m.opacity = a; m.depthWrite = a > .5; } }
    for (const [b, q] of this.bind) b.quaternion.copy(q);
    let hipY = 0, spineX = 0, headX = 0, headY = 0, hipRot = 0;
    const breathe = Math.sin(p * 2.2) * .02;
    let prevHit = this.hitPhase;
    switch (A) {
      case 'walk': case 'run': {
        const run = A === 'run', f = run ? 11 : 7.5 * (0.6 + speed01 * .4), w = p * f, s = Math.sin(w), amp = run ? .9 : .55;
        const carryArms = !!this.carry && !run;
        this.arm('L', carryArms ? .1 : -s * amp * .9, .08, run ? 1.3 : .25); this.arm('R', carryArms ? .1 : s * amp * .9, .08, run ? 1.3 : .25);
        this.leg('L', s * amp, Math.max(0, -Math.cos(w)) * amp * 1.2 + .05); this.leg('R', -s * amp, Math.max(0, Math.cos(w)) * amp * 1.2 + .05);
        hipY = Math.abs(Math.cos(w)) * (run ? .07 : .04) - .02; spineX = run ? .25 : .05; hipRot = s * .08; break;
      }
      case 'chop': case 'mine': case 'hammer': {
        const cyc = A === 'hammer' ? 1.0 : 1.35, u = (p % cyc) / cyc, raise = u < .6 ? u / .6 : 1 - (u - .6) / .4 * 1.0;
        const up = A === 'hammer' ? .4 + raise * 1.6 : .5 + raise * 2.4;
        this.arm('R', up, .1, .3 + (1 - raise) * .2); this.arm('L', A === 'hammer' ? .5 : up * .95, .25, .5);
        spineX = .1 + (1 - raise) * .35; hipY = -.03; this.leg('L', .25, .25); this.leg('R', -.15, .1);
        this.hitPhase = u; if (prevHit < .9 && u >= .9 || (prevHit > u && prevHit < .9)) this.onHit?.(); break;
      }
      case 'hoe': case 'knead': {
        const u = Math.sin(p * (A === 'knead' ? 6 : 4)); this.arm('R', .7 + u * .45, .15, .6); this.arm('L', .7 - u * .2, .15, .7); spineX = .35 + u * .08; this.leg('L', .2, .2); this.leg('R', -.1, .1);
        const ph = (p * (A === 'knead' ? 6 : 4)) % 6.283; if (ph < this.hitPhase) this.onHit?.(); this.hitPhase = ph; break;
      }
      case 'water': case 'feed': case 'pickup': case 'give': case 'point': {
        const k = A === 'feed' ? Math.max(0, Math.sin(p * 4)) : A === 'pickup' ? .5 + .5 * Math.sin(p * 2.5) : .6;
        this.arm('R', .9 + k * .5, .2, .3); this.arm('L', A === 'pickup' ? .9 + k * .5 : .2, .1, .4); spineX = A === 'pickup' ? .4 + k * .4 : A === 'water' ? .25 : .1;
        if (A === 'pickup') { hipY = -.1 * k; this.leg('L', .3 * k, .6 * k); this.leg('R', .3 * k, .6 * k); }
        const ph = (p * 4) % 6.283; if (ph < this.hitPhase) this.onHit?.(); this.hitPhase = ph; break;
      }
      case 'sit': { this.leg('L', 1.5, 1.45); this.leg('R', 1.5, 1.45); this.arm('L', .35, .05, .9); this.arm('R', .35, .05, .9); hipY = -(this.hipM - this.sitH); spineX = -.05 + breathe; headX = Math.sin(p * .7) * .05; headY = Math.sin(p * .4) * .25; break; }
      case 'talk': { const g = Math.sin(p * 3.1); this.arm('R', .5 + g * .35, .25, 1.0 + g * .3); this.arm('L', .15, .1, .4); headX = Math.sin(p * 5) * .06; headY = Math.sin(p * 1.3) * .15; hipY = breathe; break; }
      case 'drink': { const u = (p % 4) / 4, sip = u > .5 && u < .8 ? 1 : 0; this.arm('R', .6 + sip * .9, .1, 1.9 - sip * .2); this.arm('L', .1, .05, .2); headX = -sip * .3; break; }
      case 'fight': { const a = Math.sin(p * 14), b = Math.cos(p * 13); this.arm('L', 1.3 + a * .6, .4, 1.4); this.arm('R', 1.3 - a * .6, .4, 1.4); hipY = Math.abs(Math.sin(p * 9)) * .12; spineX = .2; this.leg('L', .3 + b * .2, .3); this.leg('R', -.3 - b * .2, .3); headY = a * .2; break; }
      case 'cheer': case 'dance': { const h = Math.abs(Math.sin(p * (A === 'dance' ? 7 : 8))); this.arm('L', 2.8 + Math.sin(p * 8) * .2, .5, .2); this.arm('R', 2.8 - Math.sin(p * 8) * .2, .5, .2); hipY = h * (A === 'dance' ? .08 : .14); hipRot = A === 'dance' ? Math.sin(p * 3.5) * .5 : 0; this.leg('L', h * .3, h * .5); this.leg('R', -h * .1, h * .2); break; }
      case 'wave': { this.arm('R', 2.6, .6, .3 + Math.sin(p * 9) * .5); this.arm('L', .05, .05, .2); hipY = breathe; break; }
      case 'sad': { this.arm('L', .05, -.05, .1); this.arm('R', .05, -.05, .1); spineX = .3; headX = .35; hipY = -.02; break; }
      default: { this.arm('L', .05 + breathe, .05, .15); this.arm('R', .05 - breathe, .05, .15); hipY = breathe * .5; headY = Math.sin(p * .5) * .2; headX = Math.sin(p * .33) * .05; }
    }
    if (A === 'idle' && this.carry) { this.arm('L', .1, .05, .2); this.arm('R', .1, .05, .2); }
    this.pose('Spine', spineX * .5, hipRot * .5, 0); this.pose('Spine1', spineX * .5, 0, 0); this.pose('Head', headX, headY, 0); this.pose('Hips', 0, hipRot, 0);
    this.hips.position.y = this.hipsY + hipY * this.hipsY / this.hipM;
    this.body.position.y = this.seatY;
    if (this.banner) (this.banner as any).flag.rotation.x = Math.sin(p * 4) * .15;
    this.handle.update(dt);
  }
  dispose() { this.handle.dispose(); }
}
