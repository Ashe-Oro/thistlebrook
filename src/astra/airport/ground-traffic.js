import {vehicleModel} from '../traffic-fleet.js';

const tug = vehicleModel('af-tug');
const carts = vehicleModel('af-baggage');
const spacing = (tug.length + carts.length) / 2 + .25;

export function apronVehicles(time) {
  const a = time * .12;
  const position = [87 + Math.sin(a) * 1.4,-72 + Math.cos(a) * 3];
  const tangent = [1.4 * Math.cos(a),-3 * Math.sin(a)], magnitude = Math.hypot(...tangent);
  const direction = tangent.map(x=>x/magnitude);
  return [
    {id:'apron-tug',kind:'tug',position,direction,...tug},
    {id:'apron-carts',kind:'cart',position:position.map((x,i)=>x-direction[i]*spacing),direction,...carts},
  ];
}
