import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld,pointInWorld} from '../src/compiler/world-plan.js';
import {insideLandscape} from '../src/compiler/landscape.js';
import {registryErrors,shortestRoutes} from '../src/astra/registry/index.js';
import {registryCoverage} from '../src/astra/registry/coverage.js';
import {flightState, CYCLE} from '../src/astra/starbase-flight.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));

test('continuous ground supports all districts and regional resident routes; scenery is completely registered',()=>{
 for(const seed of [0,831]){
  const town=compileWorld(catalog,seed),known=new Map(town.registry.places.map(p=>[p.id,p]));
  for(const d of town.districts)assert(insideLandscape(d.id==='harbor'?[157,36]:d.center),d.name);
  for(const p of [[-160,-100],[0,-210],[80,145],[140,180]])assert(pointInWorld(p,town));
  assert(town.landscape.models.length>500);assert(town.landscape.hills.length>10);
  for(const p of town.landscape.models){const r=known.get(p.registryId);assert(r?.canonicalAsset,p.asset);assert(r.size.every(n=>n>0));assert(r.assetMetadata);}
  assert.deepEqual(registryErrors(town),[]);assert.deepEqual(registryCoverage(town,catalog).missing,[]);
  const routes=shortestRoutes(town,0);
  for(const r of town.roads.filter(r=>r.kind==='world-link')){
   assert.equal(r.width,5.6);assert(r.walkline.length>=3);assert.equal(r.centerline.length,r.walkline.length);
   for(const p of r.walkline){const node=town.nodes.findIndex(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.015);assert(node>=0);assert.equal(routes.path(node).at(-1),node);}
  }
 }
});
test('recovery ship sails out before Falcon launch, receives the booster and returns continuously',()=>{
 assert(flightState(60).droneX<flightState(78).droneX);
 assert.equal(flightState(88).droneX,96);
 for(let t=0;t<CYCLE;t+=.1){const a=flightState(t),b=flightState(t+.1);assert(Math.hypot(a.droneX-b.droneX,a.droneZ-b.droneZ)<.6);}
 for(const t of [116,120,131]){const s=flightState(t);assert.equal(s.f9.x,s.droneX);assert.equal(s.f9.z,s.droneZ);assert(!insideLandscape([s.droneX+225,s.droneZ+280]));}
 assert.equal(flightState(140).droneX,73);
});
