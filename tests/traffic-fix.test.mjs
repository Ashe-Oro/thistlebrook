import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NodeIO,getBounds} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {DELIVERY_ROUTE} from '../src/astra/civic-quarter-life.js';
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import {createTrafficSimulation,sampleLane} from '../src/astra/traffic-simulation.js';
import {createRegionalTraffic} from '../src/roads/regional-traffic.js';
import {footprint, pointInFootprint, releaseWaitCycles} from '../src/roads/collisions.js';
import {FLEET_MODELS,VEHICLE_LENGTH_METRES,WORLD_UNITS_PER_METRE,vehicleModel} from '../src/astra/traffic-fleet.js';
import {createFairLotSim,STYLES,fairLotModel} from '../src/astra/fair-lot-sim.js';
import {BAYS,CAR,shuttlePose} from '../src/astra/fair-lot-plan.js';
import {apronVehicles} from '../src/astra/airport/ground-traffic.js';
import {starbaseRoadVehicles} from '../src/astra/starbase-road.js';
import {trafficMonitor} from '../tools/sim-traffic.mjs';

const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const town=compileWorld(catalog,831);

function verifyFootprint(vehicle,bounds) {
  assert(bounds, `Unknown render model ${vehicle.model}`);
  const {min,max}=bounds;
  for(const [axis,key] of [[0,'width'],[2,'length']]){
    const measured=(max[axis]-min[axis])*vehicle.fit.scale;
    assert(Math.abs(measured-vehicle[key])<=.02,`${vehicle.id??vehicle.model} ${key}: ${vehicle[key]} / ${measured}`);
  }
}

function fleetPlacements() {
  const traffic=createTrafficSimulation(town);
  const lot=createFairLotSim({hour:12});
  return [...traffic.vehicles,...traffic.parked,...createRegionalTraffic(town).vehicles,
    ...lot.vehicles(),...STYLES.map(s=>fairLotModel(s.id,s.colors[0])),shuttlePose(0,0),shuttlePose(1,0),
    ...apronVehicles(0),...starbaseRoadVehicles(0)];
}

test(`${TOWN_RULE.packVehicles} physics matches the owned GLB fitted for all road systems`,async()=>{
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
  const bounds=new Map();
  for(const [id,entry] of Object.entries(FLEET_MODELS)){
    const file=new URL('../public/'+entry.path,import.meta.url).pathname;
    const doc=await io.read(file);
    const box=getBounds(doc.getRoot().listScenes()[0]);
    for(const key of ['min','max'])for(const axis of [0,1,2])assert(Math.abs(box[key][axis]-entry[key][axis])<.001,id+' '+key);
    bounds.set(id,box);
  }
  const vehicles=fleetPlacements();
  for(const v of vehicles)verifyFootprint(v,bounds.get(v.model));
  const smaller={...vehicles[0],length:vehicles[0].length-.025};
  assert.throws(()=>verifyFootprint(smaller,bounds.get(smaller.model)),/length/);
});

test('vehicle placements share the target-length scale across all road systems',()=>{
  const fleet=fleetPlacements(), byModel=new Map();
  for(const vehicle of fleet){
    const {class:category,min,max}=FLEET_MODELS[vehicle.model];
    const expected=VEHICLE_LENGTH_METRES[category]*WORLD_UNITS_PER_METRE/(max[2]-min[2]);
    assert(Math.abs(vehicle.fit.scale/expected-1)<=.01,`${vehicle.id??vehicle.model} scale`);
    assert.equal(vehicle.fit.scale,byModel.get(vehicle.model)??vehicle.fit.scale,`${vehicle.model} varies by placement`);
    byModel.set(vehicle.model,vehicle.fit.scale);
  }
  assert.equal(byModel.size,Object.keys(FLEET_MODELS).length);
  const school=fleet.filter(v=>v.model==='sn-school-bus');
  assert.deepEqual(school.map(v=>v.id).sort(),['astra-school-bus','school-bus']);
  assert.equal(school[0].length,school[1].length);

  for(const {id,colors} of STYLES){
    const vehicle=fairLotModel(id,colors[0]);
    assert(vehicle.length<=CAR.length&&vehicle.width<=CAR.width,`${id} clears the bay turn envelope`);
    assert(BAYS.every(b=>vehicle.length<=b.length&&vehicle.width<=b.width),`${id} fits the marked bays`);
  }
});

test(`${TOWN_RULE.vehicleClearance} the all-system OBB check catches uncoordinated scripted traffic`,()=>{
  const monitor=trafficMonitor(),bus=vehicleModel('city-bus');
  const a={id:'bus',kind:'bus',...bus,position:[0,0],direction:[1,0]};
  const b={id:'scripted',...vehicleModel('af-fire-tender'),position:[0,0],direction:[0,1]};
  monitor.sample({systems:{town:[a],civic:[b]},t:1,hour:7});
  assert.equal(monitor.result().overlap,1);
  // Two long vehicles can overlap with their centres over six metres apart.
  const long={...a,length:8};
  monitor.sample({systems:{town:[long,{...long,id:'second bus',position:[7,0]}]},t:2,hour:7});
  assert.equal(monitor.result().overlap,2);
});

test(`${TOWN_RULE.trafficFlow} the stall check rejects the old centreline turnaround`,()=>{
  const monitor=trafficMonitor();
  const turned={id:'turned',kind:'bus',position:[0,0],direction:[-1,0],length:4.6,width:1.8};
  const queue={id:'queue',kind:'car',position:[-3.9,-.92],direction:[1,0],length:2.9,width:1.35};
  function legacyClearance(v,o) {
    const [dx,dz]=o.position.map((x,i)=>x-v.position[i]);
    const along=dx*v.direction[0]+dz*v.direction[1];
    const across=Math.abs(dx*v.direction[1]-dz*v.direction[0]);
    const align=v.direction[0]*o.direction[0]+v.direction[1]*o.direction[1];
    const halfLengths=(v.length+o.length)/2;
    return along>0&&across<(v.width+o.width)/2+.3&&(align>.2||along<halfLengths+2.5)?along-halfLengths-1:Infinity;
  }
  for(const [v,o] of [[turned,queue],[queue,turned]]){
    assert(legacyClearance(v,o)<0,'old opposite-lane following stops both cars');
    v.status='Following traffic';
    v.blockedBy=o;
  }
  for(let t=0;t<=32;t++)monitor.sample({systems:{regional:[turned,queue]},t,hour:7+t/90});
  assert.equal(monitor.result().stall,2);
  assert(monitor.result().stalls.every(s=>s.chain.length===3));
});

test(`${TOWN_RULE.trafficFlow} a closed synthetic gate holds the line and reopens it`,()=>{
  const road={kind:'world-link',width:5.6,a:[0,0],b:[180,0]};
  const traffic=createRegionalTraffic({roads:[road],regionalLines:[{id:0,roads:[0],points:[road.a,road.b]}]});
  const [lead,tail]=traffic.vehicles;
  for(const [v,s] of [[lead,54],[tail,40]])Object.assign(v,{s,forward:true,position:[s,-1.3],direction:[1,0]});
  const gate={point:[100,0],stop:3,closed:true};
  traffic.setStopLines(()=>[gate]);
  for(let i=0;i<200;i++)traffic.update(.2);
  assert.equal(lead.status,'Waiting at level crossing');
  assert.equal(lead.speed,0);
  assert.equal(tail.status,'Following traffic');
  assert.equal(tail.blockedBy,lead);
  assert(Math.abs(lead.position[0]+lead.length/2-(gate.point[0]-gate.stop))<.02);
  gate.closed=false;
  for(let i=0;i<50;i++)traffic.update(.2);
  assert(lead.position[0]>gate.point[0]+lead.length/2);
  assert(tail.position[0]>gate.point[0]+tail.length/2);
  assert.notEqual(lead.status,'Waiting at level crossing');
});

test(`${TOWN_RULE.trafficFlow} a clear reservation can break a circular wait deterministically`,()=>{
  const a={id:'A',position:[6,0],direction:[-1,0],speed:0,length:2,width:1};
  const b={id:'B',position:[-6,0],direction:[1,0],speed:0,length:2,width:1};
  a.blockedBy=b;
  b.blockedBy=a;
  const zone={point:[0,0],owner:b}, events=[];
  releaseWaitCycles([b,a],[zone],events);
  assert.equal(zone.owner,a);
  assert.deepEqual(events,[{allowed:'A',cycle:['A','B'],at:[0,0]}]);
  releaseWaitCycles([b,a],[zone],events);
  assert.equal(events.length,1);
});

test('the clinic delivery van clears the entrance and sidewalk while turning or waiting',()=>{
  const traffic=createTrafficSimulation(town);
  const delivery=traffic.vehicles.find(v=>v.id==='civic-delivery');
  const clearSidewalk=()=>{
    for(let x=-79;x<=-65;x+=.1)assert(!pointInFootprint([x,-79.7],footprint(delivery),.25));
  };
  assert.equal(delivery.stoppedAt,'depot');
  clearSidewalk();

  const door=town.venues.find(v=>v.id==='clinic').entry;
  for(let distance=0;distance<delivery.path.length;distance+=.05){
    const pose=sampleLane(delivery.path,distance);
    assert(!pointInFootprint(door,footprint({...delivery,...pose}),.25),'loading route clears the clinic entrance');
  }

  const entrance=DELIVERY_ROUTE[1];
  const junction=traffic.junctions.find(j=>j.points.some(([x,z])=>x===entrance[0]&&z===entrance[1]));
  junction.owner={...delivery,position:entrance,direction:[1,0]};
  traffic.vehicles.splice(0,traffic.vehicles.length,delivery);
  for(let i=0;i<150;i++)traffic.update(.2);
  assert.equal(delivery.status,'Yielding at junction');
  assert.equal(delivery.speed,0);
  clearSidewalk();
});

test('the fire tender assists with its whole footprint clear of the sidewalk',()=>{
  const tender=createTrafficSimulation(town).vehicles.find(v=>v.id==='civic-engine');
  const stop=tender.stops.find(s=>s.id==='destination');
  const body=footprint({...tender,...sampleLane(tender.path,stop.distance)});
  for(let x=-94;x<=-80;x+=.1){
    assert(!pointInFootprint([x,-54.1],body,.25));
    assert(!pointInFootprint([x,-49.9],body,.25));
  }
});
