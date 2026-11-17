import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld,checkWorld,WORLD_OFFSETS} from '../src/compiler/world-plan.js';
import {createWorldRegistry,shortestRoutes,registryErrors} from '../src/astra/registry/index.js';
import {createLife} from '../src/astra/life/runtime.js';
import {placeInfo} from '../src/astra/place-info.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const ids=['harbor','fair','outskirts','airport','skatepark','themepark','coral-coast','roadster','starbase'];
test('all eighteen districts share a connected graph and valid registry over varied seeds',()=>{
 for(const seed of [0,1,42,831,9999]){const t=compileWorld(catalog,seed);assert.equal(t.districts.length,18);assert(checkWorld(t).ok);assert.deepEqual(registryErrors(t),[]);for(const id of ids)assert(t.districts.some(d=>d.id===id));const r=createWorldRegistry(t);for(const home of t.buildings){const paths=shortestRoutes(t,home.node);for(const venue of t.venues)assert.equal(paths.path(venue.node).at(-1),venue.node);}for(const id of ids)assert(r.findAll({district:id,capability:'walkTo'}).length>0);assert.equal(t.registry.places.filter(p=>p.type==='building').reduce((n,p)=>n+p.occupants.length,0),40);}
});
test('resident routing reaches remote public entrances without teleporting or entering the launch range',()=>{
 const t=compileWorld(catalog,831),life=createLife(t,{hour:16,brain:()=>null}),targets=['harbor-market','fair-wheel','outskirts-dock','airport-terminal','skatepark','pinecrest','coast-beach','roadster-arena','starbase-garden'];
 targets.forEach((target,i)=>assert(life.execute(life.actors[i],{tool:'walkTo',args:{target},reason:'Visit the connected district'}).ok));
 for(let n=0;n<10000;n++){const before=life.actors.slice(0,targets.length).map(a=>[...a.context.location.position]);life.update(.1,16);life.actors.slice(0,targets.length).forEach((a,i)=>assert(Math.hypot(a.context.location.position[0]-before[i][0],a.context.location.position[1]-before[i][1])<=a.context.personality.pace*.1+1e-6));}
 targets.forEach((target,i)=>assert.equal(life.actors[i].context.location.place,target));const launch=createWorldRegistry(t).walkTo('Starship & Mechazilla',{fromNode:0});assert(launch.ok);assert.equal(launch.place.viewpoint,'starbase-garden');assert.equal(launch.entryNode,t.venues.find(v=>v.id==='starbase-garden').node);assert.deepEqual(life.registry.rejected,[]);
});
test('cards describe the selected place and every expansion keeps its relocation',()=>{
 const t=compileWorld(catalog,831);assert.equal(placeInfo(t.venues.find(v=>v.id==='coast-beach'),t).badge,'Coral Coast');assert(!placeInfo({id:'cv-bakery',name:'A different place',district:'harbor'},t).story.includes('Mabel'));assert.equal(placeInfo(t.venues.find(v=>v.id==='airport-terminal'),t).badge,'Astra Municipal Airport');assert.deepEqual(WORLD_OFFSETS.roadster,[-140,-110]);assert.deepEqual(t.nodes[t.venues.find(v=>v.id==='skatepark').node],[81,-95]);
});
