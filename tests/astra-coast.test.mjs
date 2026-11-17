import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileWorld as compileAstra,pointInWorld as pointInTown} from '../src/compiler/world-plan.js';
import {shortestPath} from '../src/compiler/astra.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {COAST_BLOCKS,COAST_REAR,COAST_VENUE_COUNT} from '../src/astra/coast-plan.js';
import {createCoastRoutes,createCoastWalkers} from '../src/astra/coast-life-plan.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
test('coast venues join the existing town and remain on the enlarged island',()=>{
 for(const seed of [0,42,831,9999]){
  const town=compileAstra(catalog,seed),venues=town.venues.filter(v=>v.district==='coral-coast');assert.equal(venues.length,COAST_VENUE_COUNT);
  for(const v of venues){for(const corner of [v.box.min,v.box.max])assert(pointInTown(corner,town));const path=shortestPath(town,town.buildings[0].node,v.node);assert.equal(path.at(-1),v.node);assert(path.length>2);}
 }
});
test('crowd routes are connected, stair slopes are walkable, and no path cuts through a building',()=>{
 const g=createCoastRoutes();
 for(const a of g.destinations)for(const b of g.destinations){const path=g.route(a.node,b.node);assert.equal(path[0],a.node);assert.equal(path.at(-1),b.node);}
 for(let i=0;i<g.nodes.length;i++)for(const j of g.edges[i]){
  const a=g.nodes[i],b=g.nodes[j];assert(Math.abs(a[1]-b[1])<=Math.hypot(a[0]-b[0],a[2]-b[2])*1.5+.01,'Stairs must climb continuously');
  for(let step=0;step<=10;step++){const p=a.map((v,k)=>v+(b[k]-v)*step/10);for(const building of [...COAST_BLOCKS,...COAST_REAR]){
    const half=building.x===87?4.5:4;if(p[1]>=building.height)continue;
    assert(!(Math.abs(p[0]-building.x)<half-.05&&Math.abs(p[2]-building.z)<4.95),'Path cuts through '+building.id);
  }}
 }
});
test('visitors make real arrivals, climb roofs, and move continuously across day and evening schedules',()=>{
 const life=createCoastWalkers();let roofs=0,yields=0;
 for(let n=0;n<5000;n++){
  const before=life.people.map(p=>[...p.position]);life.update(.1,n*.1,n<2500?13:21);
  for(const [i,p]of life.people.entries()){assert(Math.hypot(...p.position.map((v,k)=>v-before[i][k]))<=p.speed*.1+.002,'A visitor teleported');if(p.position[1]>9)roofs++;if(p.yielding)yields++;}
 }
 assert(life.people.reduce((s,p)=>s+p.arrivals,0)>100);assert(roofs>100);assert(yields>0);
});
