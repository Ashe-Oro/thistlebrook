import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileAstra,shortestPath,checkAstra,pointInTown} from '../src/compiler/astra.js';
import {trainState,workPeriod,workDestination,WORK_ASSIGNMENTS} from '../src/compiler/astra-work.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
test('workplaces connect to actual homes and the lunch square without crossing rail',()=>{
 const town=compileAstra(catalog,831),works=town.venues.filter(v=>v.district==='works');assert.equal(works.length,4);
 for(const v of works){assert(pointInTown(v.pos,town));for(const home of town.buildings.filter(b=>b.kind==='home')){const path=shortestPath(town,home.node,v.node);assert.equal(path[0],home.node);assert.equal(path.at(-1),v.node);assert(path.every(n=>town.nodes[n][1]>town.workRail.z+2));}}
 const blocked=structuredClone(town);blocked.roads.push({a:[-110,-120],b:[-80,-120],width:3});assert(checkAstra(blocked).errors.includes('Street crosses venue: Sunward Market Gardens'));
});
test('workers have explicit shift, lunch and home destinations at time boundaries',()=>{
 const town=compileAstra(catalog),home=town.buildings.find(b=>b.kind==='home');assert.equal(Object.keys(WORK_ASSIGNMENTS).length,6);
 for(const id of Object.values(WORK_ASSIGNMENTS)){const p={home:home.node,workplace:town.venues.find(v=>v.id===id)};for(const h of [0,6.99,17,23.99])assert.equal(workDestination(p,town,h),home);for(const h of [7,11.99,13,16.99])assert.equal(workDestination(p,town,h),p.workplace);for(const h of [12,12.99])assert.equal(workDestination(p,town,h).id,'fountain');}
 assert.equal(workDestination({},town,10),null);assert.equal(workPeriod(12),'lunch');
});
test('shuttle dwells, travels continuously on its rails and closes overnight',()=>{
 assert(trainState(0,9).atPlatform);assert(trainState(23.99,9).atPlatform);assert(!trainState(24,9).atPlatform);
 assert.equal(trainState(0,9).x,trainState(24,9).x);assert.equal(trainState(50,9).x,trainState(64,9).x);
 for(let t=0;t<200;t+=.1){const a=trainState(t,9),b=trainState(t+.1,9);assert(Math.abs(a.x-b.x)<.25);assert(a.x-10.5>=-112&&a.x+10.8<=-47);}
 assert.equal(trainState(10,22).open,false);assert.equal(trainState(10,22).x,trainState(80,22).x);
});
