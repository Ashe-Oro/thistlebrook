import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { compileTown } from '../src/compiler/compile.js';
import { validateSpec } from '../src/compiler/spec.js';
import { registerPropsTools } from '../src/life/props-interact.js';
import { executeTool, getTool } from '../src/life/tools.js';
import { findPlace, nearestEntryNode, interactionPoints } from '../src/world/registry.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const catalog=resolveAll(read('src/catalog/bounds.json'));
const town=compileTown(validateSpec(read('specs/large.json'),catalog),catalog,{seed:1234,life:true});
registerPropsTools();
const calls=[];
const world={registry:town.registry,graph:town.life.graph,hour:12,props:{doors:new Map(),bellPlaceId:null,approach:(p,name)=>interactionPoints(town.registry,p.id,name==='sit'?'seat':'entry')[0]?.pos||p.pos,apply:(...args)=>calls.push(args)}};
const place=type=>findPlace(town.registry,{type}).find(p=>p.entryNode>=0);
const context=(p,name)=>({pos:[...world.props.approach(p,name)],inventory:{}});
test('life-props: registry route terminates at the selected stall entry',()=>{
 const p=place('market'),ctx=context(place('well'),'drawWater');
 const r=executeTool('walkTo',{target:p.id},ctx,world);
 assert(r.ok);assert.equal(r.path.at(-1),nearestEntryNode(town.registry,world.graph,p.id));
 assert.deepEqual(r.destination,world.graph.nodes[r.path.at(-1)].pos);
});
test('life-props: guards reject invalid, remote, wrong-type and closed actions without mutation',()=>{
 const p=place('market'),ctx=context(p,'buy');
 for(const [name,args,c] of [['buy',{target:'missing'},ctx],['buy',{},ctx],['sit',{target:p.id},ctx],['buy',{target:p.id},{pos:[999,999],inventory:{}}]])assert.equal(executeTool(name,args,c,world).ok,false);
 world.hour=2;assert.equal(executeTool('buy',{target:p.id},ctx,world).ok,false);world.hour=12;
 assert.deepEqual(ctx.inventory,{});
});
test('life-props: valid actions update actor counters and call the runtime adapter',()=>{
 for(const [type,name] of [['seat','sit'],['well','drawWater'],['market','buy'],['tavern','eat']]){
  const p=place(type),ctx=context(p,name),r=executeTool(name,{target:p.id},ctx,world);
  assert(r.ok,JSON.stringify(r));assert.equal(r.placeId,p.id);assert.equal(ctx.action.tool,name);
  if(name==='buy')assert.equal(ctx.inventory.produce,1);
  if(name==='drawWater')assert.equal(ctx.inventory.water,1);
  if(name==='eat')assert.equal(ctx.meals,1);
  assert(getTool(name).argsSchema&&getTool(name).resultSchema);
 }
 const p=place('bakery');world.props.doors.set(p.id,{});world.props.bellPlaceId=p.id;
 for(const name of ['openDoor','closeDoor','ringBell'])assert(executeTool(name,{target:p.id},context(p,name),world).ok);
 assert.equal(calls.length,7);
});
test('life-props: registration preserves a canonical tool supplied by routines',()=>{
 const buy=getTool('buy');registerPropsTools();assert.equal(getTool('buy'),buy);
});

test('life-props: disconnected route never reports a successful walk',()=>{
 const p=place('market'),ctx=context(place('well'),'drawWater');
 const broken={...world,graph:{...world.graph,edges:world.graph.edges.map(()=>[])}};
 assert.equal(executeTool('walkTo',{target:p.id},ctx,broken).ok,false);
 assert.equal(ctx.action,undefined);
});
