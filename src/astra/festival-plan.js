// Merrymead-local coordinates. The compiler and renderer apply the district offset.
export const FESTIVAL_ID = 'fair-band';
export const FESTIVAL_ENTRY = [-74, -52];
export const STAGE_TARGET = [-67, -48.4];
export const STAGE_BOX = {min: [-73.5, -51.4], max: [-60.5, -45.4]};
export const STAGE_HEIGHT = .86;
export const LISTENER_YAW_TOLERANCE = 40 * Math.PI / 180;

export function concertHours(weekend) {
  return [weekend ? 16 : 18, 21.5];
}

export const BAND = [
  {id: 'guitar', model: 'carpenter', position: [-70.6, -47.6]},
  {id: 'vocals', model: 'baker', position: [-67.8, -46.7]},
  {id: 'bass', model: 'innkeeper', position: [-65.1, -47.7]},
  {id: 'drums', model: 'miller', position: [-68.8, -49.7]},
  {id: 'keys', model: 'herbalist', position: [-63.15, -46.7]},
];

export const FESTIVAL_STALLS = [
  {asset: 'popcorn_stall', label: 'POPCORN', position: [-58.5, -48.7], box: {min: [-60.15, -50.15], max: [-56.85, -47.25]}, scale: .86, elevation: .08},
  {asset: 'cotton_candy_stall', label: 'CANDY FLOSS', position: [-58.5, -45.35], box: {min: [-60.1, -46.6], max: [-56.9, -44.1]}, scale: .86, elevation: .08},
];
export const FESTIVAL_GATE = {position: [-69, -37.8], width: 6.2};

const guestPositions = [
  [-70.3, -44.1], [-68.3, -43.1], [-66.3, -43.5], [-62.7, -43.7],
  [-73, -41.7], [-70.3, -41.5], [-67.5, -41.3], [-65.7, -41.9], [-61.5, -41.4],
  [-66.8, -39.4],
];
const residentPositions = [[-71, -39.2], [-69, -39.1], [-64.5, -38.9], [-62.2, -39.4]];

export function facingStage([x, z], [stageX, stageZ] = STAGE_TARGET) {
  // Townsfolk models face local +Z at yaw zero.
  return Math.atan2(stageX - x, stageZ - z);
}

function audienceSlots(positions, group) {
  return positions.map((position, i) => ({
    id: `${group}-${i}`, kind: 'standing', position, facing: facingStage(position),
    animation: 'idle', approach: [[-74, position[1]]],
  }));
}

export const GUEST_SLOTS = audienceSlots(guestPositions, 'guest');
export const RESIDENT_SLOTS = audienceSlots(residentPositions, 'resident');
export const FESTIVAL_SLOTS = [...GUEST_SLOTS, ...RESIDENT_SLOTS];

export const insideFestivalBox = ([x, z], {min, max}) =>
  x >= min[0] && x <= max[0] && z >= min[1] && z <= max[1];

export function festivalFindings(people, {stage, target, onRoad}) {
  const findings = [];
  for (const {id, position, yaw, band, watching, standing = true} of people) {
    const add = (category, detail) => findings.push({category, at: position, detail: `${id} ${detail}`});
    const onStage = insideFestivalBox(position, stage);
    if (onStage !== Boolean(band)) add('festival-stage', band ? 'is outside the stage' : 'is on the stage');
    if (standing && onRoad(position)) add('festival-road', 'is standing on a road');
    if (watching) {
      const difference = yaw - facingStage(position, target);
      if (!Number.isFinite(yaw) || Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) > LISTENER_YAW_TOLERANCE) {
        add('festival-facing', 'is facing away from the stage');
      }
    }
  }
  return findings;
}
