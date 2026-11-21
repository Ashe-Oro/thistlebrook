import {vehicleModel} from '../traffic-fleet.js';

// Apron service vehicles (Airfield pack models, TOWN-27). Every loop stays on
// the landside strip of the apron (x < 92) or the GA service pad, clear of
// the stands, the taxi lanes and runway 18/36, so no vehicle ever needs a
// runway slot (tests/airfield-kit.test.mjs checks a full timetable).
const tug = vehicleModel('af-tug');
const carts = vehicleModel('af-baggage');
const fuel = vehicleModel('af-fuel-truck');
const followMe = vehicleModel('af-follow-me');
const spacing = (tug.length + carts.length) / 2 + .25;
const TAU = Math.PI * 2;
const smooth = (u) => u * u * (3 - 2 * u);

/** Point and unit heading on an ellipse loop (clockwise seen from above). */
function ellipse([cx, cz], rx, rz, a) {
  const position = [cx + Math.sin(a) * rx, cz + Math.cos(a) * rz];
  const tangent = [rx * Math.cos(a), -rz * Math.sin(a)], magnitude = Math.hypot(...tangent);
  return {position, direction: tangent.map((x) => x / magnitude)};
}

// Fuel bowser: waits at the fuel farm (north end), drives to the parked
// Cessna (east side), pumps, then comes back round the west side.
export const FUEL_LOOP = Object.freeze({centre: [89, -3.6], rx: 1.8, rz: 5.1, period: 64});
const FUEL_LEGS = [[0, 14, 0, 0], [14, 24, 0, Math.PI / 2], [24, 46, Math.PI / 2, Math.PI / 2], [46, 64, Math.PI / 2, TAU]];
export function fuelAngle(t) {
  const local = ((t % FUEL_LOOP.period) + FUEL_LOOP.period) % FUEL_LOOP.period;
  const [a, b, from, to] = FUEL_LEGS.find(([a, b]) => local >= a && local < b);
  return from + (to - from) * smooth((local - a) / (b - a));
}
export const fuelStatus = (t) => { const local = ((t % 64) + 64) % 64; return local < 14 ? 'Filling at the fuel farm' : local >= 24 && local < 46 ? 'Refuelling G-THBK' : 'Driving'; };

// Follow-me car: a slow patrol loop between the club stand and the hangar.
export const FOLLOW_LOOP = Object.freeze({centre: [89.5, -31], rx: 1.5, rz: 4, speed: .09});

export function apronVehicles(time) {
  const a = time * .12;
  const position = [87 + Math.sin(a) * 1.4,-75 + Math.cos(a) * 3];
  const tangent = [1.4 * Math.cos(a),-3 * Math.sin(a)], magnitude = Math.hypot(...tangent);
  const direction = tangent.map(x=>x/magnitude);
  const bowser = ellipse(FUEL_LOOP.centre, FUEL_LOOP.rx, FUEL_LOOP.rz, fuelAngle(time));
  const patrol = ellipse(FOLLOW_LOOP.centre, FOLLOW_LOOP.rx, FOLLOW_LOOP.rz, time * FOLLOW_LOOP.speed);
  return [
    {id:'apron-tug',kind:'tug',position,direction,stand:true,...tug},
    {id:'apron-carts',kind:'cart',position:position.map((x,i)=>x-direction[i]*spacing),direction,stand:true,...carts},
    {id:'apron-fuel',kind:'fuel',status:fuelStatus(time),...bowser,...fuel},
    {id:'apron-follow-me',kind:'follow-me',...patrol,...followMe},
  ];
}
