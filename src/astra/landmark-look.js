// OWNER: night-landmarks lane. Brightness, colour and timing for the Starbase
// and Roadster arena night fixtures. Import-free (like lamp-look.js) so the
// registry, the glow module and the Tesla vehicle factory can all read it.
import {LAMP_LOOK} from './lamp-look.js';

export const LANDMARK_LOOK = Object.freeze({
  // Same switch-on point as the streetlamp heads. Solid emitters (lenses,
  // LED strips, rings, beacon bulbs) ramp in over [headOn/2, headOn] and are
  // fully on past it; additive glow (cones, pools, halos, washes) tracks the
  // night factor linearly, like the streetlamp pools.
  headOn: LAMP_LOOK.headOn,
  // Additive strengths at night = 1 (multiplied by each fixture's own intensity).
  cone: .85, beam: .5, card: .85, halo: .9, wash: .75,
  emitter: 1,
  // Red aviation beacons: FAA-like flash, one synchronised period per site.
  beaconPeriod: 1.6, beaconDuty: .42, beaconFloor: .1, beaconHalo: 1.1,
  // Backlit arena boards: label material colour scale at full night (1 + sign).
  sign: .55,
  // Tesla head / tail lamps on stage (lineup + performing Roadster): HDR colour
  // multiplier added at full night, on top of the base lamp colour.
  carHead: 2.4, carTail: 1.6,
  // Cone geometry: apex radius as a fraction of the far radius.
  coneApex: .14, beamApex: .09,
});

/** Authored palettes. Starbase: cool white, ice cyan, aviation red. Arena: warm. */
export const LANDMARK_COLORS = Object.freeze({
  starbase: Object.freeze({flood: '#e9f2ff', steel: '#b7d0ff', ice: '#8ef1ff', frost: '#bff6ff', red: '#ff2a16', gold: '#ffcf6e', warm: '#ffe6bd', sign: '#d8ecff'}),
  arena: Object.freeze({flood: '#fff0cf', cream: '#ffe9b5', amber: '#ffb447', head: '#f2f7ff', red: '#ff3524', sign: '#ffe2a3'}),
});

const clamp = (v) => Math.max(0, Math.min(1, v));

/** Solid emitter level 0..1: off below headOn/2, fully on past headOn. */
export function emitterLevel(night) {
  const on = LANDMARK_LOOK.headOn;
  return clamp((night - on / 2) / (on / 2));
}

/** Beacon flash 0..1 at time t (seconds): a short soft flash each period. */
export function beaconFlash(t) {
  const {beaconPeriod: p, beaconDuty: d} = LANDMARK_LOOK;
  const u = ((t / p) % 1 + 1) % 1;
  return u < d ? Math.sin(Math.PI * u / d) ** .7 : 0;
}

/** Beacon intensity: off by day, pulsing between a floor and full at night. */
export function beaconLevel(t, night) {
  const f = LANDMARK_LOOK.beaconFloor;
  return emitterLevel(night) * (f + (1 - f) * beaconFlash(t));
}
