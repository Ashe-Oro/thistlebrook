import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {compileAstra} from '../src/compiler/astra.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {createWorldRegistry,registryErrors,shortestRoutes,isOpen} from '../src/astra/registry/index.js';
import {interactionErrors} from '../src/astra/registry/interaction-schema.js';
import {renderCoverage,tagObject,tagBatch,tagComponents} from '../src/astra/registry/render-tags.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));

test('every compiled placement has complete unique registry metadata across 100 seeds',()=>{
 for(let seed=0;seed<100;seed++){
  const town=compileAstra(catalog,seed);
  assert.deepEqual(registryErrors(town),[],`seed ${seed}`);
  const registry=createWorldRegistry(town);
  assert.equal(new Set(registry.places.map(p=>p.id)).size,registry.places.length);
  for(const p of registry.places){
   assert.equal(registry.findPlace(p.id),p);
   if(p.type==='prop')assert(p.activity);
   if(p.activity&&!p.activity.enabled){assert(!p.interaction);for(const slot of p.activity.slots){assert.equal(slot.position.length,2);assert(slot.position.every(Number.isFinite));assert(Number.isFinite(slot.facing));if(slot.kind==='seat'){assert.equal(slot.animation,'sit');assert(Number.isFinite(slot.seatHeight));}}}
   if(p.interaction){assert.deepEqual(interactionErrors(p.interaction,town),[]);assert(p.activity.enabled);assert(!p.capabilities.includes('talkTo'));}
  }
  const starts=[...new Set(registry.findAll({capability:'walkTo'}).map(p=>p.node))];
  for(const start of starts){
   const routes=shortestRoutes(town,start);
   for(const p of registry.findAll({capability:'walkTo'})){
    const path=routes.path(p.node);
    assert.equal(path[0],start,`seed ${seed}: ${p.id}`);assert.equal(path.at(-1),p.node);
    for(let n=1;n<path.length;n++)assert(town.edges[path[n-1]].includes(path[n]));
   }
  }
  for(const p of registry.places.filter(p=>p.interaction))for(const slot of p.interaction.slots){
   const route=registry.walkTo(p.id,{fromNode:town.buildings[0].node,slot:slot.id});
   assert(route.ok);assert.equal(route.entryNode,p.interaction.entryNode);
   assert.deepEqual(route.points.at(-1),slot.position);
   const local=[...p.interaction.approach,...slot.approach,slot.position];
   assert.deepEqual(route.points.slice(route.nodes.length),local);
  }
  const market=registry.walkTo('market',{fromNode:town.buildings[0].node});assert(market.ok);assert.equal(market.place.name,'Market Square');
 }
});

test('queries respect services, opening hours and inaccessible props',()=>{
 const town=compileAstra(catalog),r=createWorldRegistry(town),start=town.buildings[0].node;
 assert.equal(r.findPlace('sole & stitch').name,'Sole & Stitch');
 assert.equal(r.findPlace('unknown'),null);assert.equal(r.findPlace(null),null);
 assert.equal(r.walkTo('unknown',{fromNode:start}).ok,false);
 assert.equal(r.walkTo('market',{fromNode:-1}).ok,false);
 assert.equal(r.walkTo('market').ok,false);
 assert(!r.findPlace('parcel-1').capabilities.includes('buy'));
 assert.equal(r.walkTo('The Nightjar',{fromNode:start,hour:12}).ok,false);
 assert.equal(r.walkTo('The Nightjar',{fromNode:start,hour:23}).ok,true);
 assert(isOpen([17,1],0));assert(!isOpen([17,1],1));assert(!isOpen([17,1],17-1e-3));
 assert(r.findNearest(start,'eat',{hour:12}).capabilities.includes('eat'));
 assert.equal(r.findNearest(start,'talkTo'),null);
 assert.equal(r.findNearest(-1,'eat'),null);
 const disabled=r.places.find(p=>p.activity&&!p.activity.enabled&&p.node===null);
 assert.equal(r.walkTo(disabled.id,{fromNode:start}).error,'No verified access');
 const active=r.places.find(p=>p.interaction);
 assert.equal(r.walkTo(active.id,{fromNode:start,slot:'missing'}).error,'Unknown slot');
 for(const p of r.findAll({capability:'buy',district:'downtown',hour:12}))assert.equal(p.district,'downtown');
});

test('nearest uses weighted graph paths rather than Euclidean distance',()=>{
 const place=(id,node)=>({id,name:id,pos:[0,0],node,capabilities:['walkTo','rest'],hours:[0,24],entryPoints:[{node,approach:[]}]});
 const town={nodes:[[0,0],[1,0],[0,4],[100,0]],edges:[[2,3],[3],[0],[0,1]],registry:{places:[place('close-in-space',1),place('close-on-path',2)]}};
 const r=createWorldRegistry(town);
 assert.equal(r.findNearest(0,'rest').id,'close-on-path');
 town.edges[0]=[3];town.edges[2]=[];
 assert.equal(r.walkTo('close-on-path',{fromNode:0}).error,'Unreachable entry');
});

test('coverage and activity checks reject missing records, invalid entries and overlapping seats',()=>{
 const town=compileAstra(catalog);
 town.registry.places=town.registry.places.filter(p=>p.id!==town.props[0].registryId);
 assert(registryErrors(town).some(e=>e.startsWith('Unregistered placement')));
 const other=compileAstra(catalog),p=other.registry.places.find(p=>p.interaction?.slots.length===2);
 p.interaction.slots[1].position=[...p.interaction.slots[0].position];
 assert(registryErrors(other).some(e=>e.includes('overlap')));
 p.interaction.entryNode=999999;
 assert(registryErrors(other).some(e=>e.includes('entryNode')));
});

test('draw batching retains individual placement IDs and detects untagged additions',()=>{
 const town=compileAstra(catalog),scene=new THREE.Scene(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshBasicMaterial(),id=town.buildings[0].registryId;
 const m=new THREE.Mesh(geo,mat);scene.add(m);
 assert.equal(renderCoverage(scene,town).length,1);
 assert.throws(()=>tagComponents(scene,town,'test'),/Missing registry metadata/);
 tagObject(m,id);assert.deepEqual(renderCoverage(scene,town),[]);
 const batch=new THREE.InstancedMesh(geo,mat,2);scene.add(batch);
 assert.throws(()=>tagBatch(batch,[id]),/Missing/);
 tagBatch(batch,[id,town.props[0].registryId]);assert.deepEqual(renderCoverage(scene,town),[]);
 batch.userData.registryIds[1]='unknown';assert.equal(renderCoverage(scene,town).length,1);
 geo.dispose();mat.dispose();
});
