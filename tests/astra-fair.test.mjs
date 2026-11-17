import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileWorld as compileAstra,pointInWorld as pointInTown,checkWorld as checkAstra} from '../src/compiler/world-plan.js';
import {shortestPath} from '../src/compiler/astra.js';
import {fairSchedule} from '../src/compiler/astra-fair.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
test('weekend afternoon and evening peak, quiet mornings, and closing boundaries',()=>{
  for(const day of [5,6]){
    assert.equal(fairSchedule(day,10.99).open,false);assert.equal(fairSchedule(day,11).open,true);
    for(const hour of [13,16,20.9])assert(fairSchedule(day,hour).visitors>fairSchedule(2,hour).visitors);
    assert.equal(fairSchedule(day,15.99).concert,false);assert.equal(fairSchedule(day,16).concert,true);
    assert.equal(fairSchedule(day,22).open,false);assert.equal(fairSchedule(day,23).visitors,0);
  }
  assert.equal(fairSchedule(4,14.99).open,false);assert.equal(fairSchedule(4,15).open,true);
  assert.equal(fairSchedule(4,18).concert,true);assert.equal(fairSchedule(5,21.5).concert,false);
});
test('six park destinations are on the island and reachable from every town district',()=>{
  const town=compileAstra(catalog,831),fair=town.venues.filter(v=>v.district==='fair');
  assert.equal(fair.length,6);
  for(const v of fair){
    assert(pointInTown(v.pos,town));
    for(const b of town.buildings){const path=shortestPath(town,b.node,v.node);assert.equal(path[0],b.node);assert.equal(path.at(-1),v.node);}
  }
  const pond=fair.find(v=>v.type==='fair-pond');
  for(const road of town.roads)for(let i=0;i<=20;i++){
    const t=i/20,x=road.a[0]+(road.b[0]-road.a[0])*t,z=road.a[1]+(road.b[1]-road.a[1])*t;
    assert(((x-pond.pos[0])/7.5)**2+((z-pond.pos[1])/5.7)**2>1,'A public path enters the pond');
  }
});
test('checker rejects a shortcut through a fair ride',()=>{
  const town=compileAstra(catalog,831);
  town.roads.push({a:[-210,-91],b:[-197,-91],width:2,kind:'park'});
  assert(checkAstra(town).errors.includes('Street crosses venue: The Little Skywheel'));
});
