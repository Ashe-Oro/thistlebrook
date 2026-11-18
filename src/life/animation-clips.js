import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack } from 'three';
import { CLIP } from './animation-plan.js';

// Original shared choreography for the owned rig's identity bind rotations.
// All translations are evaluated from the navigation and the actor's rig.
const base = {
  Hips: [0, 0, 0], Spine: [0, 0, 0], Spine2: [0, 0, 0], Head: [0, 0, 0],
  LeftArm: [0, 0, -1.34], RightArm: [0, 0, 1.34],
  LeftForeArm: [0, -.17, 0], RightForeArm: [0, .17, 0],
  LeftHand: [0, 0, 0], RightHand: [0, 0, 0],
  LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0],
  LeftFoot: [0, 0, 0], RightFoot: [0, 0, 0],
};
function walk(u, poles = false) {
  const s = Math.sin(2 * Math.PI * u);
  const pose = {
    Spine2: [.07, .12 * s, -.035 * s],
    LeftArm: [-.11, -.39 * s, -1.31], RightArm: [-.11, -.39 * s, 1.31],
    LeftForeArm: [0, -.28, 0], RightForeArm: [0, .28, 0],
  };
  if (poles) {
    pose.LeftForeArm = [0, -.95, 0];
    pose.RightForeArm = [0, .95, 0];
  }
  return pose;
}
const sit = u => ({
  Spine: [.12 + .025 * Math.sin(u * 2 * Math.PI), 0, 0],
  LeftArm: [-.2, -.18, -1.49], RightArm: [-.2, .18, 1.49],
  LeftForeArm: [0, -.95, 0], RightForeArm: [0, .95, 0],
  LeftUpLeg: [-1.45, 0, 0], RightUpLeg: [-1.45, 0, 0], LeftLeg: [1.45, 0, 0], RightLeg: [1.45, 0, 0],
});
const eat = u => {
  const bite = (1 - Math.cos(u * 2 * Math.PI)) / 2;
  return { LeftArm: [-.35, -.6, -1.25 + .45 * bite], LeftForeArm: [0, -.8, 1.45 * bite], Head: [.14 * bite, -.12 * bite, 0] };
};
const counter = u => {
  const reach = Math.sin(u * 2 * Math.PI) ** 2;
  return { Spine: [.06 + .13 * reach, .13 * (reach - .5), 0],
    LeftArm: [-.15, -.78 * reach, -1.16], LeftForeArm: [0, -.9 + .65 * reach, 0],
    RightArm: [-.2, .52, 1.34], RightForeArm: [0, .83, 0], Head: [.15 * reach, -.15 + .2 * reach, 0] };
};
const turn = (u, sign) => ({ Spine2: [.06, sign * Math.sin(u * Math.PI) * .55, 0], Head: [0, sign * Math.sin(u * Math.PI) * .5, 0] });

const definitions = [
  [CLIP.idle, 3.2, u => ({ Spine2: [.027 * Math.sin(2 * Math.PI * u), 0, 0] })],
  [CLIP.look, 4.8, u => ({ Head: [.04, .4 * Math.sin(2 * Math.PI * u), -.06], Spine2: [0, .19 * Math.sin(2 * Math.PI * u), .04] })],
  [CLIP.walk, 1, walk, true],
  [CLIP.hike, 1, u => walk(u, true), true],
  [CLIP.left, .46, u => turn(u, 1), false, true],
  [CLIP.right, .46, u => turn(u, -1), false, true],
  [CLIP.wave, 1.25, u => {
    const reach = Math.min(1, Math.sin(Math.PI * u) * 1.8);
    return { LeftArm: [-.24 * reach, -.24 * reach, -1.34 + 1.65 * reach],
      LeftForeArm: [0, -.17 - .3 * reach, reach * (1.13 + .28 * Math.sin(8 * Math.PI * u))],
      Head: [0, -.22 * reach, -.09 * reach] };
  }, false, true],
  [CLIP.sit, 3.4, sit],
  [CLIP.eat, 2.5, eat],
  [CLIP.seatedEat, 2.5, u => ({ ...sit(u), ...eat(u) })],
  [CLIP.seatedChat, 1.25, u => {
    const gesture = Math.sin(Math.PI * u);
    return { ...sit(u), Head: [.12 * gesture, -.28 * gesture, 0],
      LeftForeArm: [0, -.95, .85 * gesture], LeftArm: [-.35, -.28, -1.49 + .54 * gesture] };
  }, false, true],
  [CLIP.counter, 2.25, counter],
  [CLIP.work, 2.4, u => ({ ...counter(u), Head: [.23, -.12, 0], Spine: [.24, .12 * Math.sin(2 * Math.PI * u), 0] })],
  [CLIP.read, 4.6, u => ({ Head: [.3 + .08 * Math.sin(2 * Math.PI * u), 0, 0],
    LeftArm: [-.16, -.68, -1.39], RightArm: [-.16, .68, 1.39],
    LeftForeArm: [0, -1.14, .28], RightForeArm: [0, 1.14, -.28] })],
  [CLIP.fish, 3.8, u => {
    const pull = Math.sin(2 * Math.PI * u);
    return { Spine: [-.03 - .10 * pull, -.11, 0], Head: [.19, -.16, 0],
      LeftArm: [-.18, -.79 - .18 * pull, -1.21], RightArm: [-.2, .72 + .13 * pull, 1.34],
      LeftForeArm: [0, -.78, .2], RightForeArm: [0, .74, -.18] };
  }],
  [CLIP.play, 1.25, u => {
    const s = Math.sin(2 * Math.PI * u);
    return { Spine2: [.11, .16 * s, .19 * s], Head: [-.16, .2 * s, 0],
      LeftArm: [-.28, -.47, -.45 + .5 * s], RightArm: [-.21, .45, .45 + .5 * s],
      LeftLeg: [.17 * (1 + s), 0, 0], RightLeg: [.17 * (1 - s), 0, 0] };
  }],
];

export const villagerClips = new Map(definitions.map(([name, duration, sample, distanceDriven, once]) => {
  const keys = Array.from({ length: 25 }, (_, i) => i / 24);
  const poses = keys.map(u => ({ ...base, ...sample(u) }));
  const times = keys.map(u => u * duration);
  const q = new Quaternion(), e = new Euler();
  const tracks = Object.keys(base).map(bone => new QuaternionKeyframeTrack(
    // GLTFLoader sanitizes colons. The on-disk names retain them.
    `mixamorig${bone}.quaternion`, times, poses.flatMap(pose => q.setFromEuler(e.set(...pose[bone])).toArray()),
  ));
  return [name, { clip: new AnimationClip(name, duration, tracks), distanceDriven, once }];
}));
