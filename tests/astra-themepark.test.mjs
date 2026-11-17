import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PARK_NODES,PARK_EDGES,QUEUES,RIDE_QUEUES,RIDES,COPPERHEAD,PARK_ACTIVITIES,PARK_ORIGIN,residentSeats,parkRoute,routeLength,sampleWalk,pathTiles} from '../src/astra/themepark-plan.js';
import {coasterPath,coasterTimetable,KIT_SCALE} from '../src/astra/themepark-coaster.js';
import {spinAngle,dropHeight} from '../src/astra/themepark-rides.js';
import {createGuestSim} from '../src/astra/themepark-guests.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {createWorldRegistry,registryErrors} from '../src/astra/registry/index.js';
import {buildLifeRegistry} from '../src/astra/life/registry.js';

test('Every midway destination is reachable using authored path edges',()=>{
 for(const a of Object.keys(PARK_NODES))for(const b of Object.keys(PARK_NODES)){
  const path=parkRoute(a,b);assert.deepEqual(path[0],PARK_NODES[a]);assert.deepEqual(path.at(-1),PARK_NODES[b]);
  for(let i=1;i<path.length;i++)assert(PARK_EDGES.some(([u,v])=>PARK_NODES[u]===path[i-1]&&PARK_NODES[v]===path[i]||PARK_NODES[v]===path[i-1]&&PARK_NODES[u]===path[i]));
  assert.deepEqual([sampleWalk(path,routeLength(path)+1).x,sampleWalk(path,routeLength(path)+1).z],PARK_NODES[b]);
 }
 for(const [id,points]of Object.entries(QUEUES)){assert.deepEqual(points[0],PARK_NODES[RIDE_QUEUES[id].node]);assert.deepEqual(points.at(-1),RIDE_QUEUES[id].board);}
});
test('Path edges lie on the 4 m tile grid and tile into connected midway pieces',()=>{
 for(const [a,b]of PARK_EDGES){const p=PARK_NODES[a],q=PARK_NODES[b];assert(p[0]===q[0]||p[1]===q[1],`${a}-${b} is axis aligned`);for(const v of [...p,...q])assert.equal(Math.abs(v%4),0);}
 const tiles=pathTiles();assert(tiles.length>60);
 for(const t of tiles)assert(['road_midway_straight','road_midway_corner','road_midway_t','road_midway_4way'].includes(t.asset));
});
test('Copperhead is a closed kit circuit with a dwelling station and spaced trains',()=>{
 assert.equal(COPPERHEAD.pieces.length,29);assert.deepEqual(COPPERHEAD.end,{cell:[0,0],heading:[1,0],level:0});
 const path=coasterPath(COPPERHEAD.centre),tt=coasterTimetable(path,{dwell:9});
 assert(path.length>200);assert(Math.max(...path.points.map(p=>p.y))>20);
 for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i];assert(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1.2,'continuous rail');}
 assert.equal(tt.distanceAt(1),0);assert.equal(tt.distanceAt(8),0);
 let prev=path.sample(0);
 for(let t=.05;t<tt.period*2;t+=.05){const d=tt.distanceAt(t),p=path.sample(d);assert(Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z)<2.5,'no jumps');assert(p.y>=1.05*KIT_SCALE-1e-6);prev=p;
  const other=tt.distanceAt(t+tt.gap),sep=Math.min(Math.abs(other-d),path.length-Math.abs(other-d));assert(sep>12,'trains never overlap');}
 // Track stays inside the fence and north of the promenade.
 for(const p of path.points){assert(Math.abs(p.x)<48&&p.z<-8&&p.z>-50);}
});
test('Flat-ride run profiles are continuous and the drop tower returns to rest',()=>{
 for(const spec of [{cycle:44,load:10,omega:.45},{cycle:40,load:9,omega:1.1,ramp:5}]){let prev=spinAngle(0,spec);for(let t=.05;t<200;t+=.05){const a=spinAngle(t,spec);assert(a>=prev-1e-9&&a-prev<spec.omega*.06);prev=a;}}
 assert.equal(dropHeight(2),0);assert(dropHeight(20)>7);assert.equal(dropHeight(29),0);
});
test('The crowd queues, boards real seats and uses every activity kind',()=>{
 const capacity={copperhead:36,'skyline-wheel':32,'pine-bumpers':7,'swinging-pines':12,pinefall:8,carousel:16,'teacup-twirl':18,'little-racers':5,'pinecrest-express':8};
 const rides={capacity:id=>capacity[id],rideTime:id=>id==='copperhead'?47:RIDES.find(r=>r.id===id).cycle,nextBoarding(id,t){const r=RIDES.find(r=>r.id===id),c=id==='copperhead'?47:r.cycle;if(id==='copperhead')return [0,1].map(j=>({train:j,time:Math.ceil((t+j*23.5)/47)*47-j*23.5})).sort((a,b)=>a.time-b.time)[0];if(id==='skyline-wheel'){const m=Math.ceil(t/4);return {gondola:((-m%16)+16)%16,time:m*4};}return {time:Math.ceil(t/c)*c};}};
 const sim=createGuestSim({count:180,rides});const seen=new Set();
 for(let t=0;t<240;t+=.25){sim.step(t);for(const g of sim.guests){seen.add(g.state);if(g.mode==='ride')assert(g.seat<capacity[g.ride]-residentSeats(RIDES.find(r=>r.id===g.ride)),'guest never takes a resident seat');}}
 for(const s of ['walking','queueing','riding','eating','playing','watching'])assert(seen.has(s),s);
 const a=sim.audit();assert(Object.values(a.riding).reduce((x,y)=>x+y,0)>10);
 for(const [id,q]of Object.entries(sim.queues))q.forEach((g,rank)=>assert(g.queueD<=routeLength(QUEUES[id])-rank*.82+1e-6));
});
test('Pinecrest activities are executable registry places reachable from town',()=>{
 const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
 const town=compileWorld(catalog,831),registry=createWorldRegistry(town);
 assert.deepEqual(registryErrors(town),[]);
 const records=town.registry.places.filter(p=>p.kind?.startsWith('pinecrest-'));
 assert.equal(records.length,PARK_ACTIVITIES.length);
 const kinds=new Set(records.map(p=>p.interaction.activity));for(const k of ['ride','queue','picnic','play','watch'])assert(kinds.has(k),k);
 for(const ride of RIDES){assert(records.some(p=>p.id===`pinecrest:ride:${ride.id}`&&p.interaction.ride===ride.id));}
 for(const p of records.filter((_,i)=>i%5===0)){const route=registry.walkTo(p.id,{fromNode:0,slot:'0'});assert(route.ok,p.id+' '+route.error);assert.deepEqual(route.points.at(-1),p.interaction.slots[0].position);}
 const life=buildLifeRegistry(town);assert.deepEqual(life.rejected,[]);assert(life.places.some(p=>p.id==='pinecrest:ride:copperhead'));
 for(const p of records)for(const s of p.interaction.slots){const x=s.position[0]-PARK_ORIGIN[0],z=s.position[1]-PARK_ORIGIN[1];assert(Math.abs(x)<52&&Math.abs(z)<53,'inside the fence');}
});
test('A town resident walks to Pinecrest, reserves a ride seat and rides; guests leave it free',async()=>{
 const {createLife}=await import('../src/astra/life/runtime.js');
 const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
 const town=compileWorld(catalog,831),life=createLife(town,{brain:()=>null,hour:14}),a=life.actors[0];
 const start=[...a.context.location.position];
 assert.deepEqual(life.execute(a.context.id,{tool:'walkTo',args:{target:'pinecrest:ride:carousel'},reason:'An afternoon at Pinecrest'}),{ok:true});
 for(let i=0;i<6000&&a.action;i++)life.update(.25,14);
 assert.equal(a.context.location.place,'pinecrest:ride:carousel');
 const place=life.registry.places.find(p=>p.id==='pinecrest:ride:carousel'),slot=place.interaction.slots.find(s=>s.id===a.context.location.slot);
 assert(Math.hypot(start[0]-slot.position[0],start[1]-slot.position[1])>100,'a real journey from town');
 assert.equal(life.reservations.get(`pinecrest:ride:carousel/${slot.id}`),a.context.id);
 assert.deepEqual(life.execute(a.context.id,{tool:'visit',args:{target:'pinecrest:ride:carousel'},reason:'Ride the carousel'}),{ok:true});
 assert.equal(a.activity,'Riding Woodland Carousel');
 assert(slot.seat>=RIDES.find(r=>r.id==='carousel').seats-residentSeats(RIDES.find(r=>r.id==='carousel')));
});
