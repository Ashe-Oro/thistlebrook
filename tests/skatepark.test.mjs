import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {compileWorld as compileAstra} from '../src/compiler/world-plan.js';
import { shortestPath, pointInTown } from '../src/compiler/astra.js';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { bowlPose, bikePose, streetPose, bowlHeight } from '../src/astra/skatepark-motion.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const samplers=[t=>bowlPose(t,0),t=>bowlPose(t,1),streetPose,t=>bikePose(t,0),t=>bikePose(t,1)];
test('park entrance is inside its reserved parcel and reachable from every home',()=>{
 const town=compileAstra(catalog,831),park=town.venues.find(v=>v.type==='skatepark');
 assert(town.regions.some(r=>r.id==='skatepark'));assert(park.entry[1]<park.box.max[1]);
 for(const home of town.buildings)assert.equal(shortestPath(town,home.node,park.node).at(-1),park.node);
 for(const tree of town.trees)assert(!(tree.pos[0]>park.box.min[0]&&tree.pos[0]<park.box.max[0]&&tree.pos[1]>park.box.min[1]&&tree.pos[1]<park.box.max[1]));
});
test('riders stay in the parcel, never teleport, and complete their activities',()=>{
 const states=new Set();
 for(let t=0;t<132;t+=.025) {
  const poses=samplers.map(sample=>sample(t));
  for(let n=0;n<poses.length;n++){
   const p=poses[n],next=samplers[n](t+.025);states.add(p.state);
   assert(p.x>-11.5&&p.x<11.5&&p.z>-16&&p.z<15.5,'Rider stays inside venue');
   assert(Number.isFinite(p.y)&&p.y>=.2);
   assert(Math.hypot(next.x-p.x,next.y-p.y,next.z-p.z)<.32,`Discontinuous path ${n} at ${t}`);
  }
  assert(!(poses[0].state==='Carving the bowl'&&poses[1].state==='Carving the bowl'),'Only one bowl run at a time');
  for(const n of [0,1])assert(Math.abs(poses[n].y-bowlHeight(Math.hypot(poses[n].x+5.3,poses[n].z+8)))<1e-8);
  for(let a=0;a<poses.length;a++)for(let b=a+1;b<poses.length;b++)assert(Math.hypot(poses[a].x-poses[b].x,poses[a].y-poses[b].y,poses[a].z-poses[b].z)>.65,`Riders collide ${a}/${b} at ${t}`);
 }
 for(const state of ['Waiting at the coping','Dropping into the bowl','Carving the bowl','Rolling onto the deck','Grinding the flat bar','Ollie onto the rail','Landing the grind','Turning on the quarter pipe','Air over the dirt jump'])assert(states.has(state),state);
});

// grok-merge: the pump track is built up on the dirt pad, never carved into it.
test('pump track surface, lips and rollers sit at or above the pad; bikes ride the surface', async () => {
 const { PUMP, pumpHeight, pumpSurface } = await import('../src/astra/skatepark-motion.js');
 let min = Infinity;
 for (let i = 0; i <= 720; i++) {
  const a = i / 720 * Math.PI * 2;
  for (let j = 0; j <= 16; j++) min = Math.min(min, pumpSurface(a, (j / 16 - .5) * 2 * PUMP.halfWidth));
 }
 assert.ok(min >= PUMP.padTop, `track min ${min.toFixed(3)} dips below pad ${PUMP.padTop}`);
 // Rollers rise above the troughs, so the humps are real.
 assert.ok(pumpHeight(Math.PI / 6) - pumpHeight(0) > .5);
 // Wheel contact follows the centreline surface except when airborne.
 for (let t = 0; t < 15; t += .05) for (const k of [0, 1]) {
  const p = bikePose(t, k), a = Math.atan2((p.z + 1) / 11.8, (p.x - 5.8) / 3.2);
  if (p.state.startsWith('Air')) assert.ok(p.y >= pumpHeight(a) - 1e-6); else assert.ok(Math.abs(p.y - pumpHeight(a)) < 1e-6);
  assert.ok(p.y >= PUMP.padTop);
 }
});
