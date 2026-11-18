import {TOWN_RULE} from '../src/compiler/town-rules.js';
import {cozyBenchSeats} from '../src/astra/registry/asset-points.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileWorld} from '../src/compiler/world-plan.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {createWorldRegistry,registryErrors} from '../src/astra/registry/index.js';
import {registryCoverage} from '../src/astra/registry/coverage.js';
import {overlap,groupAssets,sceneData} from '../src/catalog/library/index.js';
import {checkScene} from '../src/compiler/library-scenes.js';
import {inLake} from '../src/astra/outskirts-layout.js';
import {buildLifeRegistry} from '../src/astra/life/registry.js';
import {FAIR_SLOTS,fairApproach} from '../src/astra/registry/district-activities.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));

test(`${TOWN_RULE.access} eighteen-district model coverage, rest-stop access and canonical asset metadata across seeds`,()=>{
 for(const spec of sceneData.districtScenes)assert.equal(groupAssets('public-stop-'+spec.district).length,3);
 for(const seed of [0,1,17,42,99,831,9999]){
  const town=compileWorld(catalog,seed),r=createWorldRegistry(town),coverage=registryCoverage(town,catalog);
  assert.deepEqual(registryErrors(town),[]);assert.deepEqual(coverage.missing,[]);assert.equal(coverage.registeredModels,coverage.placedModels);assert.equal(coverage.ownedModels,634);
  for(const p of town.modelPlacements){const record=r.findPlace(p.id);assert(record.canonicalAsset,`${p.id}: canonical model`);assert(record.size.every(n=>Number.isFinite(n)&&n>0));assert(record.assetMetadata.type);assert(Array.isArray(record.interactionPoints));assert(record.activity);}
  const stops=town.catalogScenes.filter(s=>s.id.startsWith('stop-'));assert.equal(stops.length,8);assert.equal(new Set(stops.map(s=>s.district)).size,8);assert(!stops.some(s=>s.district==='roadster'),'No rest stop at the Roadster proving ground');
  for(const s of stops){
   assert.deepEqual(checkScene(s),[]);assert.equal(s.members.length,3);assert.equal(s.slots.length,1);
   for(const m of town.modelPlacements){const box={min:[m.pos[0]-m.size[0]/2,m.pos[1]-m.size[2]/2],max:[m.pos[0]+m.size[0]/2,m.pos[1]+m.size[2]/2]};assert(!overlap(s.box,box,.15),s.id+' overlaps '+m.id);}
   for(const slot of s.slots){const p=r.findPlace('activity:'+slot.id),route=r.walkTo(p.id,{fromNode:0,slot:slot.id});assert(route.ok);assert.deepEqual(route.points.at(-1),p.interaction.slots[0].position);}
   if(s.district==='outskirts')assert(!inLake(s.center,2.2));
  }
  assert.deepEqual(buildLifeRegistry(town).rejected,[]);
 }
});

test('named attractions and aliases resolve only to their public access; fair leases stay with its controller',()=>{
 const town=compileWorld(catalog),r=createWorldRegistry(town),life=buildLifeRegistry(town);
 for(const name of ['Starship & Mechazilla','MEGABAY 01','HIGH BAY','STARFACTORY','Autonomous drone ship','LZ-1 · Falcon recovery']){
  const p=r.findPlace(name),route=r.walkTo(name,{fromNode:0});assert(p,name);assert(route.ok,name);assert.equal(p.viewpoint,'starbase-garden');assert.equal(route.entryNode,r.findPlace('starbase-garden').node);
 }
 for(const alias of ['coast','lake','campground','woods','farmland','shell-cove','pier','launch','recovery','offshore','starfactory','parkcoasters','mountainpass'])assert(r.walkTo(alias,{fromNode:0}).ok,alias);
 for(const [id,slots]of Object.entries(FAIR_SLOTS)){
  const p=r.findPlace(id);assert.equal(p.interaction.controller,'fair');assert(!life.places.find(p=>p.id===id).interaction);
  slots.forEach((pos,n)=>{
   const slot=p.interaction.slots[n];assert.deepEqual(slot.position,[pos[0]-140,pos[1]]);assert.deepEqual(slot.approach,fairApproach(id,pos).slice(0,-1).map(p=>[p[0]-140,p[1]]));assert(r.walkTo(id,{fromNode:0,slot:String(n)}).ok);
  });
 }
 // Coverage must detect loss of a new district's individual model identity.
 const removed=town.modelPlacements[0].id;town.registry.places=town.registry.places.filter(p=>p.id!==removed);assert(registryErrors(town).some(e=>e.includes(removed)));assert(registryCoverage(town,catalog).missing.includes(removed));
});

test('bench seat poses use measured source geometry and survive scale/rotation',()=>{
 const p={pos:[10,20],scale:.9,rot:Math.PI/2,elevation:.1},slots=cozyBenchSeats(p);
 assert.equal(slots.length,2);assert(Math.abs(slots[0].seatHeight-(.1+.76*.9))<1e-8);
 assert(Math.abs(slots[0].position[0]-(10+.01224*.9))<1e-8);assert(Math.abs(slots[0].position[1]-(20+.616*.9))<1e-8);
 assert(slots.every(s=>s.candidate&&!s.enabled&&s.provenance==='geometry-sampled'));
});

test('Switchyard rest stays on its pedestrian deck and Merrymead lawn scenes clear shared circulation',()=>{
 for(const seed of [0,831,99]){
  const town=compileWorld(catalog,seed),registry=createWorldRegistry(town);
  const park=town.venues.find(v=>v.id==='skatepark'),rest=town.catalogScenes.find(s=>s.id==='stop-skatepark');
  assert.deepEqual(rest.street,park.entry,'use the park gate rather than an airport-side spur');
  for(const p of [rest.box.min,rest.box.max])assert(p.every((v,k)=>v>park.box.min[k]&&v<park.box.max[k]));
  // The street rail ends at local z=8.5; the pump track starts east of x=1.7.
  assert(rest.box.min[1]-park.pos[1]>8.5);assert(rest.box.max[0]-park.pos[0]<-3.8);
  const seat=registry.findPlace('activity:'+rest.slots[0].id).interaction.slots[0];
  assert.equal(seat.seatHeight,.7,'seat follows the raised park deck');
  for(const scene of town.catalogScenes.filter(s=>s.id.startsWith('lawn-fair-'))){
   assert.deepEqual(checkScene(scene),[]);assert.equal(scene.slots.length,1);
   assert(scene.box.min[0]>-196&&scene.box.max[0]<-181&&scene.box.min[1]>-35&&scene.box.max[1]<-25);
   assert(!overlap(scene.box,rest.box));
   for(const other of town.catalogScenes)if(scene!==other)assert(!overlap(scene.box,other.box,.15));
   for(const venue of town.venues)assert(!overlap(scene.box,venue.box,.15));
   for(const member of scene.members)for(const road of town.roads){
    const pad=road.width/2;
    assert(!overlap(member.box,{min:[Math.min(road.a[0],road.b[0])-pad,Math.min(road.a[1],road.b[1])-pad],max:[Math.max(road.a[0],road.b[0])+pad,Math.max(road.a[1],road.b[1])+pad]}));
   }
   assert(registry.walkTo('activity:'+scene.slots[0].id,{fromNode:0,slot:scene.slots[0].id}).ok);
  }
  assert.equal(town.catalogScenes.filter(s=>s.id.startsWith('lawn-fair-')).length,2);
 }
});
