import { Quaternion } from 'three';
import { createLife } from '../src/astra/life/runtime.js';
import { animationPlan, animationRuleErrors, CLIP, legAngles, strideFoot } from '../src/life/animation-plan.js';
import { villagerClips } from '../src/life/animation-clips.js';

const arms = ['LeftArm', 'RightArm'].map(name => `mixamorig${name}.quaternion`);

export function auditVillagerAnimations(town, add, mutateSamples) {
  const life = createLife(town, { brain: () => null });
  const samples = [];
  for (const place of life.registry.places) for (const slot of place.interaction?.slots || []) {
    const plan = animationPlan({ tool: 'rest', place, slot, position: slot.position });
    if (plan.clip === CLIP.sit) samples.push({
      clip: plan.clip, slot, position: slot.position, hipsY: plan.seatHeight + .105, hipsAboveSeat: .105,
    });
  }
  const q = new Quaternion();
  for (const [clip, { clip: animation }] of villagerClips) {
    const tracks = arms.map(name => animation.tracks.find(t => t.name === name));
    const tPose = !tracks.every(Boolean) || tracks[0].times.some((_, i) =>
      tracks.every(track => Math.abs(q.fromArray(track.values, i * 4).w) > .998));
    if ([CLIP.walk, CLIP.hike].includes(clip)) {
      // The same distance-driven stance and two-bone solution used in the mixer.
      const upper = .29, lower = .27, stride = (upper + lower) * 1.22;
      let stanceSlip = 0, soleError = 0, previous;
      for (let i = 0; i <= 120; i++) {
        const distance = i * stride / 120;
        const foot = strideFoot(distance / stride, stride);
        const drop = (upper + lower) * .93 - foot.lift;
        const { thigh, knee } = legAngles(upper, lower, drop, foot.z);
        const worldZ = distance - upper * Math.sin(thigh) - lower * Math.sin(thigh + knee);
        const y = (upper + lower) * .93 - upper * Math.cos(thigh) - lower * Math.cos(thigh + knee);
        if (foot.planted) {
          soleError = Math.max(soleError, Math.abs(y));
          if (previous !== undefined) stanceSlip = Math.max(stanceSlip, Math.abs(worldZ - previous));
        }
        previous = foot.planted ? worldZ : undefined;
      }
      const hips = animation.tracks.find(t => t.name === 'mixamorigHips.position');
      let rootTravel = 0;
      if (hips) for (let i = 0; i < hips.values.length; i += 3) {
        rootTravel = Math.max(rootTravel, Math.hypot(hips.values[i] - hips.values[0], hips.values[i + 2] - hips.values[2]));
      }
      samples.push({ clip, tPose, rootTravel, stanceSlip, soleError });
    } else if (tPose) samples.push({ ...([CLIP.sit, CLIP.seatedEat].includes(clip) ? samples[0] : {}), clip, tPose });
  }
  mutateSamples?.(samples);
  for (const sample of samples) for (const error of animationRuleErrors(sample)) {
    add('villager-animation', sample.position || town.venues.find(v => v.id === 'fountain').pos, `${sample.clip}: ${error}`);
  }
  return samples;
}
