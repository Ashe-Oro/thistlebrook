import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileAstra,checkAstra} from '../src/compiler/astra.js';
import {createLife} from '../src/astra/life/runtime.js';
import {SUNBEAM_RESIDENTS} from '../src/astra/sunbeam-layout.js';
import {WORK_ASSIGNMENTS} from '../src/compiler/astra-work.js';
import {motorRoads,createTrafficSimulation,sampleLane} from '../src/astra/traffic-simulation.js';
import {overlap} from '../src/catalog/library/index.js';
import {pathBox} from '../src/compiler/asset-vignettes.js';
import {footprint,pointInFootprint} from '../src/roads/collisions.js';
import {pedestrianGraph} from '../src/roads/pedestrian.js';
import {CIVIC_CYCLE_OFFSET} from '../src/roads/town-roads.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const town=compileAstra(catalog,831);
test('all nine districts have catalog slots in the one reservation registry',()=>{
 const life=createLife(town,{brain:()=>null,hour:10}),places=life.registry.places.filter(p=>p.id.startsWith('activity:'));
 assert.equal(life.actors.length,40);assert.equal(places.length,town.interactions.length);assert.equal(new Set(places.map(p=>p.district)).size,9);assert.deepEqual(life.registry.rejected,[]);
 for(const [i,p] of places.entries())assert(life.execute(life.actors[i],{tool:'walkTo',args:{target:p.id},reason:'Reach the real prop'}).ok);
 for(let i=0;i<1600;i++)life.update(.25,10);
 for(const [i,p] of places.entries()){
  const a=life.actors[i];assert.equal(a.context.location.place,p.id);assert.deepEqual(a.context.location.position,p.interaction.slots[0].position);
  assert(life.execute(a,{tool:'visit',args:{target:p.id},reason:'Use the reserved prop'}).ok);
  assert.equal(life.execute(life.actors[30],{tool:'walkTo',args:{target:p.id},reason:'Cannot double book'}).ok,false);
 }
 assert.equal(life.reservations.size,places.length);
});
test('terrace residents keep their homes; six workers have distinct assigned stations',()=>{
 const life=createLife(town,{hour:10});
 for(const p of SUNBEAM_RESIDENTS){const c=life.actors.find(a=>a.context.name===p.name).context;assert.equal(c.assets.home,`sunbeam-${p.home}`);}
 for(const [name,venue]of Object.entries(WORK_ASSIGNMENTS)){const c=life.actors.find(a=>a.context.name===name).context,spot=town.workstations.find(s=>s.name===name),place=life.registry.places.find(p=>p.id===c.job.workplace);assert.equal(spot.venue,venue);assert.equal(place.node,spot.node);assert.deepEqual(c.job.shift,[7,17]);}
});
test('catalog scene collisions fail checks and motor roads clear Sunbeam Mall',()=>{
 const broken=structuredClone(town);broken.catalogScenes[0].box=structuredClone(town.buildings[0].box);assert(checkAstra(broken).errors.some(e=>e.includes('Catalog scene crosses parcel')));
 assert(!motorRoads(town).some(r=>overlap(pathBox(r.a,r.b,r.width/2),town.sunbeamReservation)));
 const traffic=createTrafficSimulation(town);assert.equal(traffic.vehicles.filter(v=>v.kind==='bus').length,2);assert.equal(traffic.stops.length,9);
});

test('the returning fire tender clears the Civic Avenue sidewalk throughout the turn',()=>{
 const traffic=createTrafficSimulation(town),engine=traffic.vehicles.find(v=>v.id==='civic-engine');
 const curb=pedestrianGraph(town).nodes.find(n=>n.kind==='kerb'&&n.pos[1]===-52&&n.pos[0]>-80&&n.pos[0]<-76);
 assert(curb);
 for(let distance=0;distance<engine.path.length;distance+=.02){
  const {c,d,hl,hw}=footprint({...engine,...sampleLane(engine.path,distance)});
  if(Math.abs(c[1]-curb.pos[1])>4)continue;
  const outerEdge=c[0]+(hl+.25)*Math.abs(d[0])+(hw+.25)*Math.abs(d[1]);
  assert(outerEdge<curb.pos[0], `Tender corner reaches the sidewalk at ${c}`);
 }
});

test('walkers give the returning fire tender room on the station driveway',()=>{
 const traffic=createTrafficSimulation(town);
 const engine=traffic.vehicles.find(v=>v.id==='civic-engine');
 const sidewalk=[-86.8,-79.7];
 assert(traffic.clearFireDriveway(sidewalk));
 engine.position=[-87.1,-78.4];
 engine.direction=[0,-1];
 assert(!traffic.clearFireDriveway(sidewalk));
 assert(traffic.clearFireDriveway([-84,-79.7]));
});

test('the cyclist waits on the cycle strip while Civic Green’s junction is occupied',()=>{
 const traffic=createTrafficSimulation(town);
 const bike=traffic.vehicles.find(v=>v.route==='station-reverse-cycle');
 const delivery=traffic.vehicles.find(v=>v.id==='civic-delivery');
 const junction=traffic.junctions.find(j=>j.points.some(([x,z])=>x===-80&&z===-77));
 for(const [vehicle,x,z] of [[bike,-80+CIVIC_CYCLE_OFFSET,-72.2],[delivery,-76.8,-78]]){
  let nearest=Infinity;
  for(let distance=0;distance<vehicle.path.length;distance+=.05){
   const pose=sampleLane(vehicle.path,distance);
   const gap=Math.hypot(pose.position[0]-x,pose.position[1]-z);
   if(gap>=nearest)continue;
   nearest=gap;
   Object.assign(vehicle,pose,{distance});
  }
  assert(nearest<.05);
 }
 delivery.wait=0;
 junction.owner=delivery;
 const approach=[...bike.position];
 traffic.update(1/30);
 assert.deepEqual(bike.position,approach);
 assert.equal(bike.status,'Yielding at junction');
 assert.equal(bike.blockedBy?.id,delivery.id);
});

test('the West Loop bus clears both sidewalks through the station approach bend',()=>{
 const traffic=createTrafficSimulation(town);
 const bus=traffic.vehicles.find(v=>v.kind==='bus'&&v.route==='station');
 const graph=pedestrianGraph(town);
 const nearTurn=([x,z])=>Math.hypot(x+105,z+103)<13;
 const sidewalks=[];
 for(const [from,edges] of graph.edges.entries())for(const {to,sidewalk} of edges){
  if(!sidewalk||to<=from)continue;
  const a=graph.nodes[from].pos,b=graph.nodes[to].pos;
  const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.05));
  for(let i=0;i<=steps;i++){
   const p=a.map((v,axis)=>v+(b[axis]-v)*i/steps);
   if(nearTurn(p))sidewalks.push(p);
  }
 }
 assert(sidewalks.length>0);
 for(let distance=0;distance<bus.path.length;distance+=.04){
  const pose=sampleLane(bus.path,distance);
  if(!nearTurn(pose.position))continue;
  const body=footprint({...bus,...pose});
  assert(!sidewalks.some(p=>pointInFootprint(p,body,.25)), `Bus corner reaches a sidewalk at ${pose.position}`);
 }
});

test('both buses serve all stops while forty residents follow real routines',()=>{
 const life=createLife(town,{hour:10.4}),traffic=createTrafficSimulation(town);
 for(let n=0;n<9000;n++){
  const hour=n<2500?10.4:n<4500?16:n<5400?17.4:21;life.update(.1,hour);
  const pedestrians=life.actors.map(a=>{const [x,z]=a.context.location.position,target=a.route[0]?.pos,d=target?Math.hypot(target[0]-x,target[1]-z):0,pace=a.context.personality.pace;return {x,z,vx:d?(target[0]-x)/d*pace:0,vz:d?(target[1]-z)/d*pace:0};});
  traffic.update(.1,pedestrians);
 }
 for(const stop of traffic.stops)assert(traffic.events.busArrivals.some(e=>e.stop===stop.id),stop.name+' must be served with residents present');
 assert(traffic.vehicles.filter(v=>v.kind==='bus').every(v=>v.visits>=5));
});
