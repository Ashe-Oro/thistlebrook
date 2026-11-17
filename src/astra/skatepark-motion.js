// All tracks and their actors sample these same surfaces. Distances are metres;
// elapsed is the town simulation clock, so pause and speed work without timers.
const TAU = Math.PI * 2;
const mod = (v, n) => ((v % n) + n) % n;
export const bowlHeight = r => .32 + 1.85 * Math.pow(Math.max(0, (r - 1.8) / 2.8), 2);
export const rampHeight = z => .22 + 1.5 * Math.pow(Math.max(0, (2 - z) / 2), 2);
// The dirt pad top is y=.24. The pump track is built up on it: the crowned
// surface (lower at the lips) and every roller stay at or above the pad, so
// nothing reads as a trough carved into the ground.
export const PUMP = Object.freeze({padTop: .24, halfWidth: .875, crown: .12, base: .16, roller: .68});
export const pumpHeight = a => PUMP.padTop + PUMP.base + PUMP.roller * Math.pow(Math.sin(3 * a), 4);
// Surface height across the track: w is the offset from the centreline (-halfWidth..halfWidth).
export const pumpSurface = (a, w) => pumpHeight(a) - PUMP.crown * Math.pow(w / PUMP.halfWidth, 2);

// Separated by half a lap: no overtaking, opposing riders or shared landings.
export function bikePose(t, index = 0) {
 const a = mod((t / 15 + index / 2) * TAU, TAU);
 const bump = mod(a, Math.PI / 3), launch = .46, land = .87;
 let y = pumpHeight(a), state = 'Pumping the rollers';
 if (bump > launch && bump < land) {
  const u = (bump - launch) / (land - launch);
  const base = pumpHeight(launch) * (1-u) + pumpHeight(land) * u;
  y = base + 1.05 * 4 * u * (1-u); state = 'Air over the dirt jump';
 }
 return { x: 5.8 + 3.2 * Math.cos(a), z: -1 + 11.8 * Math.sin(a), y,
  heading: Math.atan2(-3.2 * Math.sin(a), 11.8 * Math.cos(a)),
  lean: -.15, crouch: state.startsWith('Air') ? .18 : .06, state };
}

// Each skater gets an exclusive 18-second bowl run, then waits on the deck.
// The return follows the same lip as the drop-in: no teleport between turns.
export function bowlPose(t, index = 0) {
 const clock = mod(t - index * 22, 44), startAngle = index ? Math.PI : 0;
 let a = startAngle, r = 4.6, state = 'Waiting at the coping';
 if (clock < 2) { r = 4.6 - 2.5 * Math.sin(clock / 2 * Math.PI / 2); state = 'Dropping into the bowl'; }
 else if (clock < 18) {
  const u = (clock - 2) / 16;
  a += u * TAU * 2; r = 2.1 + 1.8 * Math.pow(Math.sin(u * Math.PI * 4), 2);
  state = 'Carving the bowl';
 } else if (clock < 20) { r = 2.1 + 2.5 * (1 - Math.cos((clock-18)/2*Math.PI/2)); state = 'Rolling onto the deck'; }
 return { x: -5.3 + r*Math.cos(a), z: -8 + r*Math.sin(a), y: bowlHeight(r),
  heading: clock < 2 ? -Math.PI/2-startAngle : clock >= 18 && clock < 20 ? Math.PI/2-startAngle : -a,
  lean: clock >= 2 && clock < 18 ? -.28 : 0, crouch: clock < 2 ? .23 : .08, state };
}

export function streetPose(t) {
 const u = mod(t, 14); let x, z, heading, state = 'Pushing toward the rail';
 if (u < 5) { x = -5; z = 2 + u*1.7; heading = 0; }
 else if (u < 7) { const a=(u-5)/2*Math.PI; x=-6.5+1.5*Math.cos(a);z=10.5+1.5*Math.sin(a);heading=-a;state='Rolling out'; }
 else if (u < 12) {x=-8;z=10.5-(u-7)*1.7;heading=Math.PI;state='Approaching the quarter pipe';}
 else {const a=(u-12)/2*Math.PI;x=-6.5-1.5*Math.cos(a);z=2-2*Math.sin(a);heading=Math.PI-a;state='Turning on the quarter pipe';}
 let y = rampHeight(z);
 if(u<5) {
  if(z>=4.5 && z<=8.5){y=.9;state='Grinding the flat bar';}
  else if(z>3.3 && z<4.5){const f=(z-3.3)/1.2;y=.22+.68*f+.45*Math.sin(f*Math.PI);state='Ollie onto the rail';}
  else if(z>8.5 && z<9.5){const f=z-8.5;y=.9-.68*f+.24*Math.sin(f*Math.PI);state='Landing the grind';}
 }
 return {x,z,y,heading,lean:0,crouch:state.includes('Ollie')?.24:.08,state};
}
