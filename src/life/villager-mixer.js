import { AnimationMixer, LoopOnce, Vector3 } from 'three';
import { CLIP, CROSSFADE, legAngles, strideFoot } from './animation-plan.js';
import { villagerClips } from './animation-clips.js';

const axis = new Vector3(1, 0, 0);
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export function createVillagerMixer(object, variant = 0) {
  const hips = object.getObjectByName('mixamorigHips');
  if (!hips) return null;
  const bone = name => object.getObjectByName('mixamorig' + name);
  const legs = ['Left', 'Right'].map(side => {
    const thigh = bone(side + 'UpLeg'), shin = bone(side + 'Leg'), foot = bone(side + 'Foot');
    return { thigh, shin, foot, upper: -shin.position.y, lower: -foot.position.y };
  });
  const [left] = legs;
  const bindHip = hips.position.y;
  const ankle = bindHip - left.upper - left.lower;
  const scale = object.scale.y * object.children[0].scale.y;
  const stride = Math.min(.83, (left.upper + left.lower) * 1.22) * scale;
  const hipsAboveSeat = .105 * scale;
  const mixer = new AnimationMixer(object);
  let active, clipName, seatBlend = 0, travel = variant * .173, turn = 0, turnTime = 0, heading;
  let seatWorldY, lastFeet = [];
  const actions = new Map();
  function setClip(name, immediate) {
    if (clipName === name && !immediate) return;
    const def = villagerClips.get(name);
    if (!actions.has(name)) actions.set(name, mixer.clipAction(def.clip));
    const next = actions.get(name);
    if (immediate) mixer.stopAllAction();
    else if (active && active !== next) active.fadeOut(CROSSFADE);
    next.reset();
    if (def.once) {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
    } else if (!def.distanceDriven) next.time = (variant * .41) % def.clip.duration;
    if (!immediate && active && active !== next) next.fadeIn(CROSSFADE);
    next.play();
    active = next;
    clipName = name;
  }
  function update(plan, { dt = 0, distance = 0, facing = object.rotation.y, immediate = false } = {}) {
    travel += distance;
    const delta = heading === undefined ? 0 : wrap(facing - heading);
    if (distance > 0 && Math.abs(delta) > 1.15 && turnTime <= 0) {
      turn = delta;
      turnTime = .46;
    }
    heading = facing;
    if (immediate) turnTime = 0;
    const turning = turnTime > 0 && plan.clip === CLIP.walk;
    turnTime = Math.max(0, turnTime - dt);
    setClip(turning ? (turn < 0 ? CLIP.right : CLIP.left) : plan.clip, immediate);
    const phase = (travel / stride) % 1;
    if (villagerClips.get(clipName).distanceDriven) {
      active.paused = true;
      active.time = phase * active.getClip().duration;
    }
    mixer.update(dt);
    if (Number.isFinite(plan.seatHeight)) seatWorldY = plan.seatHeight;
    const sitting = Number.isFinite(plan.seatHeight);
    const amount = dt / CROSSFADE;
    seatBlend = immediate ? Number(sitting) : sitting ? Math.min(1, seatBlend + amount) : Math.max(0, seatBlend - amount);
    const locomoting = plan.locomotion && distance > 0;
    const squat = locomoting ? ((left.upper + left.lower) * .07) : 0;
    const sitHip = seatBlend ? (seatWorldY + hipsAboveSeat - object.position.y) / scale : bindHip;
    hips.position.y = (bindHip - squat) * (1 - seatBlend) + sitHip * seatBlend;
    const phaseFeet = [];
    for (const [i, { thigh, shin, foot, upper, lower }] of legs.entries()) {
      if (!seatBlend && !plan.locomotion && plan.clip === CLIP.play) continue;
      const step = locomoting ? strideFoot(phase + i * .5, stride / scale) : { z: 0, lift: 0, planted: true };
      const drop = hips.position.y - ankle - step.lift * (1 - seatBlend);
      const seatedReach = Math.sqrt(Math.max(0, (upper + lower - .00002) ** 2 - drop ** 2));
      const forward = step.z * (1 - seatBlend) + Math.min(upper * .92, seatedReach) * seatBlend;
      const { thigh: pitch, knee } = legAngles(upper, lower, drop, forward);
      thigh.quaternion.setFromAxisAngle(axis, pitch);
      shin.quaternion.setFromAxisAngle(axis, knee);
      foot.quaternion.setFromAxisAngle(axis, -pitch - knee);
      phaseFeet[i] = { planted: step.planted, targetY: object.position.y + (ankle + step.lift) * scale };
    }
    lastFeet = phaseFeet;
    object.userData.animationClip = clipName;
  }

  function sample() {
    const point = new Vector3();
    return {
      clip: clipName, hipsY: hips.getWorldPosition(point).y, hipsAboveSeat, seatBlend,
      tPose: Math.abs(bone('LeftArm').quaternion.w) > .998 && Math.abs(bone('RightArm').quaternion.w) > .998,
      rootTravel: Math.hypot(hips.position.x, hips.position.z),
      feet: legs.map(({ foot }, i) => ({ ...lastFeet[i], position: foot.getWorldPosition(point).toArray() })),
    };
  }
  update({ clip: variant % 3 ? CLIP.idle : CLIP.look }, { immediate: true });
  return { update, sample, hands: ['LeftHand', 'RightHand'].map(bone) };
}
