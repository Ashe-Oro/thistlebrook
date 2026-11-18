import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileAstra,distanceToSegment} from '../src/compiler/astra.js';
import {createTrafficSimulation,sampleLane} from '../src/astra/traffic-simulation.js';
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import {crossingClear,footprint,pointInFootprint} from '../src/roads/collisions.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const town=compileAstra(catalog,831);
const simulate=(s,seconds,people=[])=>{for(let t=0;t<seconds;t+=.05)s.update(.05,people);};

test('all lane routes stay on real motor roads, away from school paths and river bridges',()=>{
 const s=createTrafficSimulation(town);
 for(const [id,path] of Object.entries(s.routes))for(let d=0;d<path.length;d+=.1){const {position:p,direction:u}=sampleLane(path,d);
  for(const side of [-.49,.49]){const edge=[p[0]-u[1]*side,p[1]+u[0]*side];assert(s.roads.some(r=>distanceToSegment(edge,r.a,r.b)<=r.width/2),`${id} leaves street envelope at ${edge}`);}
  assert(p[1]<6,'Traffic must not drive onto wooden footbridges');
 }
 for(const seed of [0,7,42,99])assert.doesNotThrow(()=>createTrafficSimulation(compileAstra(catalog,seed)));
});
test('the town bus clears the sidewalk at the downtown jog',()=>{
 const {vehicles}=createTrafficSimulation(town),bus=vehicles.find(v=>v.kind==='bus'&&v.route==='town');
 const sidewalk=Array.from({length:41},(_,i)=>[-36.2486+i*.1,-13.3806+i*.00625]);
 for(let distance=0;distance<bus.path.length;distance+=.05){
  const pose=sampleLane(bus.path,distance);
  if(pose.position[0]<-40||pose.position[0]>-29)continue;
  const busFootprint=footprint({...bus,...pose});
  assert(!sidewalk.some(point=>pointInFootprint(point,busFootprint,.25)),`bus encroaches on the sidewalk at ${pose.position}`);
 }
});
test('a pedestrian waits for a vehicle turning onto the crossing',()=>{
 const curb=[4,-2],farCurb=[4,2];
 const vehicle={kind:'bus',length:4.4,width:1.6,position:[0,0],direction:[0,-1],speed:1};
 assert.equal(crossingClear(curb,farCurb,[{...vehicle,positionAhead:d=>[0,-d]}]),true);
 assert.equal(crossingClear(curb,farCurb,[{...vehicle,positionAhead:d=>[Math.max(0,d-1),-1]}]),false);
});
test('both buses repeatedly serve all nine stops, deliveries continue and every vehicle moves',()=>{
 const s=createTrafficSimulation(town),before=s.vehicles.map(v=>v.distance);simulate(s,900);
 for(const stop of s.stops)assert(s.events.busArrivals.filter(a=>a.stop===stop.id).length>=3,`Bus must return to ${stop.id}`);
 assert(s.events.deliveries>=20);assert(s.events.junctionYields>0);
 s.vehicles.forEach((v,i)=>assert(v.distance-before[i]>v.path.length*2,`${v.kind} ${i} got stuck`));
});
test('bus dwells at a stop and then departs; stationary cars do not creep when time is zero',()=>{
 const s=createTrafficSimulation(town),bus=s.vehicles[0];
 for(let i=0;i<400&&bus.wait===0;i++)s.update(.05);
 assert(bus.wait>6);assert.equal(bus.stoppedAt,'high-street');const distance=bus.distance;
 simulate(s,3);assert.equal(bus.distance,distance);const frozen=s.audit();s.update(0);assert.deepEqual(s.audit(),frozen);
 simulate(s,8);assert(bus.distance>distance+1);
});
test(`${TOWN_RULE.yield}: cars and bicycles brake for a pedestrian in their lane and resume when it clears`,()=>{
 for(const kind of ['car','cycle']){
  const s=createTrafficSimulation(town),v=s.vehicles.find(v=>v.kind===kind);
  // An isolated straight road separates pedestrian priority from queues.
  s.vehicles.splice(0,s.vehicles.length,v);v.id=0;s.junctions.length=0;
  v.distance=5;Object.assign(v,sampleLane(v.path,v.distance));v.speed=v.maxSpeed;
  const crossing=sampleLane(v.path,v.distance+5).position;
  simulate(s,5,[{x:crossing[0],z:crossing[1]}]);
  assert(v.speed<.01);assert(v.distance<10-v.length/2);assert(s.events.pedestrianYields>0);
  const stopped=v.distance;simulate(s,3);assert(v.distance>stopped+1);
 }
});
test('faster vehicles queue behind a slower cyclist with a physical gap',()=>{
 const s=createTrafficSimulation(town),car=s.vehicles.find(v=>v.kind==='car'),bike=s.vehicles.find(v=>v.kind==='cycle');
 s.vehicles.splice(0,s.vehicles.length,car,bike);s.junctions.length=0;car.id=0;bike.id=1;bike.path=car.path;
 car.distance=3;bike.distance=8;for(const v of [car,bike])Object.assign(v,sampleLane(v.path,v.distance));
 for(let i=0;i<80;i++){s.update(.05);assert(bike.distance-car.distance>=(bike.length+car.length)/2+.4);}
 assert(car.speed<=bike.maxSpeed+.3);
});
test('simulation is deterministic and rejects an absent connecting road',()=>{
 const a=createTrafficSimulation(town),b=createTrafficSimulation(town);simulate(a,30);simulate(b,30);assert.deepEqual(a.audit(),b.audit());
 const broken=structuredClone(town);broken.roads=broken.roads.filter(r=>r.a[0]!==46||r.b[0]!==46);assert.throws(()=>createTrafficSimulation(broken),/leaves the roads/);
});

// Separating-axis check on actual oriented vehicle footprints catches turning
// and merge conflicts that a centre-point or same-lane distance check misses.
test('vehicle footprints stay separated through bends and merges for fifteen minutes',()=>{
 const s=createTrafficSimulation(town);
 const overlaps=(a,b)=>{
  const delta=[b.position[0]-a.position[0],b.position[1]-a.position[1]];
  for(const axis of [a.direction,b.direction,[-a.direction[1],a.direction[0]],[-b.direction[1],b.direction[0]]]){
   let extent=0;for(const v of [a,b])extent+=Math.abs(axis[0]*v.direction[0]+axis[1]*v.direction[1])*v.length/2+Math.abs(axis[0]*v.direction[1]-axis[1]*v.direction[0])*v.width/2;
   if(Math.abs(delta[0]*axis[0]+delta[1]*axis[1])>=extent-.08)return false;
  }return true;
 };
 for(let tick=0;tick<9000;tick++){
  s.update(.1);
  for(let a=0;a<s.vehicles.length;a++)for(let b=a+1;b<s.vehicles.length;b++)assert(!overlaps(s.vehicles[a],s.vehicles[b]),`Traffic conflict ${a}/${b} at ${tick/10}s`);
 }
});

test('the western bus resumes after pedestrian delays at the terrace switchback',()=>{
 for(const delay of [20,80,160]){
  const s=createTrafficSimulation(town),bus=s.vehicles.find(v=>v.kind==='bus'&&v.route==='station');
  // A pedestrian temporarily occupies the narrow approach; the changed arrival
  // order must not leave the bus and oncoming cycle holding adjacent corners.
  simulate(s,delay,[{x:-115.7,z:-74}]);const before=bus.distance;
  simulate(s,900);
  assert(bus.distance-before>bus.path.length*2,'West Loop must keep circulating');
  for(const stop of bus.stops)assert(s.events.busArrivals.some(e=>e.stop===stop.id));
 }
});
