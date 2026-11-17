import test from 'node:test';
import assert from 'node:assert/strict';
import { FLEET, PERIOD, sampleFlight, sampleHelicopter } from '../src/astra/airport/traffic.js';

test('every aircraft completes a continuous, repeatable flight with separated runway slots',()=>{
 const phases=new Map(FLEET.map(f=>[f.id,new Set()]));let minSeparation=Infinity;
 for(let t=0;t<=PERIOD*2;t+=.1){
  const states=FLEET.map(f=>sampleFlight(f,t));
  assert(states.filter(s=>s.runway).length<=1,`runway conflict at ${t}`);
  for(let a=0;a<states.length;a++){
   const s=states[a],next=sampleFlight(FLEET[a],t+.1);phases.get(s.id).add(s.phase);
   assert(s.position.toArray().every(Number.isFinite));assert(s.position.y>=.21);
   assert(s.position.distanceTo(next.position)<2.7,`position jump ${s.id} ${t}`);
   assert(s.position.distanceTo(sampleFlight(FLEET[a],t+PERIOD).position)<1e-8);
   if(s.runway)assert.equal(s.position.x,124);
   for(let b=a+1;b<states.length;b++)minSeparation=Math.min(minSeparation,s.position.distanceTo(states[b].position));
  }
 }
 assert(minSeparation>13,`aircraft too close: ${minSeparation}`);
 for(const p of phases.values())for(const required of ['At stand','Pushback','Taxi out','Takeoff','Climb','Over town','Approach','Landing','Rollout','Taxi in'])assert(p.has(required));
 for(const f of FLEET){const s=sampleFlight(f,104-f.offset);assert(s.position.x<65&&s.position.z>-104&&s.position.z<34,'flyover should cross the existing town');}
});
test('helicopter lifts vertically, patrols, returns to its pad and sets down continuously',()=>{
 const phases=new Set();let maxY=0;
 for(let t=0;t<200;t+=.1){const s=sampleHelicopter(t);phases.add(s.phase);maxY=Math.max(maxY,s.position.y);assert(s.position.distanceTo(sampleHelicopter(t+.1).position)<2);assert(s.position.y>=.21);if(['Lift off','Set down','On helipad'].includes(s.phase)){assert.equal(s.position.x,80);assert.equal(s.position.z,-102);}}
 assert(maxY>25);assert.equal(phases.size,4);assert.equal(sampleHelicopter(0).position.y,.22);
});

test('relocated airliner clears Pinecrest terrain through the entire flight cycle',async()=>{
 const {PARK_MOUNTAINS}=await import('../src/astra/themepark-plan.js');
 const {WORLD_OFFSETS}=await import('../src/compiler/world-plan.js');
 let clearance=Infinity;
 // A nine-unit envelope encloses the banked airliner in every orientation.
 // Expand each mountain footprint by that envelope before comparing altitude.
 for(let t=0;t<PERIOD;t+=.05){
  const p=sampleFlight(FLEET[0],t).position,x=p.x+WORLD_OFFSETS.airport[0],z=p.z+WORLD_OFFSETS.airport[1];
  for(const [mx,mz,w,h]of PARK_MOUNTAINS){
   const r=Math.hypot(Math.max(0,Math.abs(x-mx)-9)/w,Math.max(0,Math.abs(z-mz)-9)/(w*.8));
   if(r>=1)continue;
   clearance=Math.min(clearance,p.y-9-(h+1)*(1-r));
  }
 }
 assert(clearance>2,`aircraft crosses mountain envelope: ${clearance}`);
});
