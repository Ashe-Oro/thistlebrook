import test from 'node:test';
import assert from 'node:assert/strict';
import {flightState,CYCLE,routeAt} from '../src/astra/starbase-flight.js';

test('all three flight profiles launch, separate and recover their reusable stages',()=>{
 assert(flightState(16).booster.y>3);assert.equal(flightState(16).booster.burn,1);
 const caught=flightState(38);assert.equal(caught.booster.y,8);assert.equal(caught.booster.burn,0);assert.equal(caught.arms,0);
 assert.equal(flightState(55).ship.tilt,Math.PI/2);assert(flightState(65).ship.tilt>0&&flightState(65).ship.tilt<Math.PI/2);
 const home=flightState(70);assert.equal(home.ship.tilt,0);assert.equal(home.ship.burn,0);assert.equal(home.ship.y,3);assert.equal(home.booster.x,4);assert.notEqual(home.ship.x,home.booster.x);
 assert.equal(flightState(94).f9.burn,1);assert(flightState(108).upper.y>flightState(108).f9.y);
 for(const t of [116,120,128,133]){const s=flightState(t);assert.equal(s.f9.x,s.droneX);assert.equal(s.f9.z,s.droneZ);assert.equal(s.f9.legs,1);assert.equal(s.f9.burn,0);}
 assert(flightState(132).droneX<flightState(116).droneX);
 const heavy=flightState(148);assert(heavy.sides.every(s=>s.visible&&s.burn===1&&s.y===heavy.f9.y));
 const twin=flightState(172);assert.deepEqual(twin.sides.map(s=>[s.x,s.y,s.z,s.legs,s.burn]),[[-8,.65,43,1,0],[27,.65,55,1,0]]);
});
test('flight actor paths are continuous at separation, catch and touchdown',()=>{
 for(const boundary of [10,23,37,47,62,69,88,100,116,142,154,172]){
  const a=flightState(boundary-.00001),b=flightState(boundary);
  const keys=boundary<80?boundary===47?['booster']:['booster','ship']:['f9','upper'];
  for(const key of keys){if(!a[key].visible||!b[key].visible)continue;const d=Math.hypot(a[key].x-b[key].x,a[key].y-b[key].y,a[key].z-b[key].z);assert(d<.01,`${key} jumps ${d} at ${boundary}`);}
 }
});
test('clock repeats deterministically with finite grounded positions',()=>{
 assert.deepEqual(flightState(0),flightState(CYCLE));
 for(let t=0;t<CYCLE;t+=.25){const s=flightState(t);for(const v of [s.booster,s.ship,s.f9,s.upper,...s.sides]){assert([v.x,v.y,v.z,v.tilt].every(Number.isFinite));assert(v.y>=0);assert(v.legs>=0&&v.legs<=1);}}
});
test('local route follows pavement corners and dwells without overshooting',()=>{
 const route=[[0,0],[10,0],[10,10],[0,10],[0,0]];
 for(let t=0;t<80;t+=.1){const a=routeAt(route,t,1,2),b=routeAt(route,t+.01,1,2);assert(a.x===0||a.x===10||a.z===0||a.z===10);assert(Math.hypot(a.x-b.x,a.z-b.z)<.011);}
 assert.equal(routeAt(route,11,1,2).walking,false);
});
