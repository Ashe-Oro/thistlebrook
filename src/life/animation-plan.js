export const CLIP = Object.freeze({
  idle: 'Idle', look: 'Look Around', walk: 'Walk', left: 'Turn Left', right: 'Turn Right',
  wave: 'Wave', sit: 'Sit', eat: 'Eat', seatedEat: 'Seated Eat', seatedChat: 'Seated Chat', counter: 'Counter',
  work: 'Work', read: 'Read', fish: 'Fish', hike: 'Hike', play: 'Play',
});
export const GREET_RANGE = 2.6;
export const CROSSFADE = .25;

export function documentedSeat(slot, position) {
  return slot?.kind === 'seat' && Number.isFinite(slot.seatHeight) &&
    slot.seatHeight >= 0 && Array.isArray(slot.position) && slot.position.length === 2 &&
    slot.position.every(Number.isFinite) &&
    (!position || Math.hypot(position[0] - slot.position[0], position[1] - slot.position[1]) <= .12);
}

export function animationPlan({ tool, place, slot, position, role, moving, greeting, turn, variant = 0 }) {
  const seat = documentedSeat(slot, position);
  const activity = place?.interaction?.activity;
  const kind = place?.kind || place?.type;
  const idle = variant % 3 === 0 ? CLIP.look : CLIP.idle;
  if (greeting || tool === 'talkTo') return seat && !moving
    ? { clip: CLIP.seatedChat, seatHeight: slot.seatHeight }
    : { clip: CLIP.wave, locomotion: !!moving };
  if (moving) {
    const trail = ['hill', 'trail', 'hill-path'].includes(kind);
    return { clip: turn ? (turn < 0 ? CLIP.right : CLIP.left) : role === 'hiker' && trail ? CLIP.hike : CLIP.walk, locomotion: true };
  }
  if (tool === 'walkTo') return { clip: idle };
  if (seat && (!tool || ['rest', 'visit', 'eat'].includes(tool))) {
    return { clip: tool === 'eat' ? CLIP.seatedEat : CLIP.sit, seatHeight: slot.seatHeight };
  }
  if (role === 'fisherman' && tool === 'work' && ['pier', 'harbor-pier'].includes(kind)) return { clip: CLIP.fish };
  if (kind === 'fair-band' && slot) return { clip: variant % 3 === 0 ? CLIP.play : idle };
  if (role === 'child' && tool === 'visit' && activity === 'play' && slot) return { clip: CLIP.play };
  const counter = slot?.kind === 'counter' || place?.points?.some(point => point === 'counter' || point.kind === 'counter') ||
    ['bakery', 'market', 'store', 'tavern', 'fish-market'].includes(kind);
  if (tool === 'eat') return { clip: CLIP.eat };
  if (['work', 'buy', 'sell', 'payBill'].includes(tool) && counter) return { clip: CLIP.counter };
  if (tool === 'work' || slot?.animation === 'work') return { clip: CLIP.work };
  if (tool === 'visit' && (!activity || activity === 'browse')) return { clip: variant % 2 ? idle : CLIP.read };
  return { clip: idle };
}

export const STANCE = .6;

export function strideFoot(phase, stride) {
  const u = ((phase % 1) + 1) % 1;
  if (u < STANCE) return { z: (STANCE / 2 - u) * stride, lift: 0, planted: true };
  const swing = (u - STANCE) / (1 - STANCE);
  // Smooth swing, with slope -stride at both contacts to match the stance leg.
  const blend = swing * swing * (3 - 2 * swing);
  return {
    z: stride * (-STANCE / 2 + blend - swing * (1 - STANCE)),
    lift: Math.sin(Math.PI * swing) ** 2 * stride * .12,
    planted: false,
  };
}

// Angles in a sagittal plane. Identity foot rotation keeps the sole level.
export function legAngles(upper, lower, drop, forward) {
  const clamp = value => Math.max(-1, Math.min(1, value));
  const reach = Math.min(upper + lower - .00001, Math.max(Math.abs(upper - lower) + .00001, Math.hypot(drop, forward)));
  const knee = Math.PI - Math.acos(clamp((upper ** 2 + lower ** 2 - reach ** 2) / (2 * upper * lower)));
  return { thigh: -Math.atan2(forward, drop) - Math.atan2(lower * Math.sin(knee), upper + lower * Math.cos(knee)), knee };
}

export function animationRuleErrors(sample) {
  const errors = [];
  const { clip, slot, position, hipsY, hipsAboveSeat, tPose, rootTravel, stanceSlip, soleError } = sample;
  if (clip === CLIP.sit || clip === CLIP.seatedEat || clip === CLIP.seatedChat) {
    if (!documentedSeat(slot, position)) errors.push('Sit requires a reserved, documented seat');
    else if (!Number.isFinite(hipsY) || !Number.isFinite(hipsAboveSeat) || Math.abs(hipsY - hipsAboveSeat - slot.seatHeight) > .04) errors.push('Seated hips miss the seat');
  }
  if (tPose) errors.push('Villager is in its bind pose');
  if ([CLIP.walk, CLIP.hike].includes(clip) &&
      [rootTravel, stanceSlip, soleError].some(value => !Number.isFinite(value) || Math.abs(value) > .025)) {
    errors.push('Locomotion moves the root or skates above/across the walking surface');
  }
  return errors;
}
