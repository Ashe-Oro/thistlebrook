import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileAstra,pointInTown,shortestPath} from '../src/compiler/astra.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {civicLifeState,sampleRoute,FIRE_ROUTE,STORY_ROUTE} from '../src/astra/civic-quarter-life.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
test('civic services and park connect to downtown and campus without leaving land',()=>{
 const town=compileAstra(catalog),venues=town.venues.filter(v=>v.district==='civic-green');
 assert.equal(venues.length,5);
 for(const v of venues){assert(pointInTown(v.pos,town));for(const id of ['school','fountain'])assert(shortestPath(town,v.node,town.venues.find(x=>x.id===id).node).length>1);}
 for(const route of [FIRE_ROUTE,STORY_ROUTE])for(let n=0;n<=100;n++){const p=sampleRoute(route,n/100);assert(pointInTown([p.x,p.z],town));}
});
test('response proceeds through arrival, extinguishing, return and a new cycle',()=>{
 assert.equal(civicLifeState(0,10).phase,'ready');
 assert.equal(civicLifeState(25,10).phase,'responding');
 const onsite=civicLifeState(44,10);assert.equal(onsite.fireProgress,1);assert(onsite.fireVisible&&onsite.waterVisible);
 const safe=civicLifeState(52,10);assert(!safe.fireVisible);assert(safe.waterVisible);assert.equal(safe.phase,'assisting');
 assert.equal(civicLifeState(65,10).phase,'returning');
 assert.equal(civicLifeState(85,10).fireProgress,0);
 assert.deepEqual(civicLifeState(110,10),civicLifeState(0,10));
});
test('emergency vehicle follows the entire street route continuously',()=>{
 let previous=sampleRoute(FIRE_ROUTE,0);
 for(let n=0;n<2200;n++){const s=civicLifeState(n*.1,10),p=sampleRoute(FIRE_ROUTE,s.fireProgress);assert(Math.hypot(p.x-previous.x,p.z-previous.z)<.4,'Vehicle teleported');previous=p;}
 assert.deepEqual([sampleRoute(FIRE_ROUTE,1).x,sampleRoute(FIRE_ROUTE,1).z],FIRE_ROUTE.at(-1));
});
test('civic opening hours distinguish story time, deliveries and overnight cover',()=>{
 assert(civicLifeState(0,10).deliveryActive);assert(!civicLifeState(0,10).storyTime);
 assert(civicLifeState(0,15.5).storyTime);assert(!civicLifeState(0,18).storyTime);
 const night=civicLifeState(25,23);assert(!night.libraryOpen&&!night.deliveryActive&&!night.parkOpen);assert.equal(night.phase,'responding');
});
