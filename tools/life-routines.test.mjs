import { installRoutines } from '../src/life/routine-runtime.js';
import { createArrivalSlots } from '../src/life/arrival-slots.js';
import { blockers, blocked, distance } from '../src/life/graph.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { compileTown } from '../src/compiler/compile.js';
import { createNpcContext } from '../src/life/context.js';
import { createCalendar } from '../src/life/calendar.js';
import { buildRoutines } from '../src/life/routines.js';
import { createPlanner } from '../src/life/planner.js';
import { getTool, listTools, executeTool } from '../src/life/tools.js';
import { createEconomy } from '../src/life/economy.js';
import { nearestEntryNode } from '../src/world/registry.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const catalog=resolveAll(read('src/catalog/bounds.json'));
const town=compileTown(read('specs/large.json'),catalog,{seed:1234,life:true});
const runtimeTown=structuredClone(town),pristineTown=structuredClone(town);
const calendar=createCalendar(1234),routines=buildRoutines(town,calendar);
const world={graph:town.life.graph,destinations:routines.destinations,contexts:new Map(),arrived:()=>true,move(){},act(){},economy:createEconomy()};
for(const p of town.instances.filter(p=>p.id.startsWith('townsfolk-')))world.contexts.set(p.id,createNpcContext(p,{...calendar,schedule:routines.schedules[p.id]}));
test('life-routines: all contexts serialize and all day plans use registered tools',()=>{
 assert.equal(world.contexts.size,12);assert.equal(listTools().length,9);
 for(const c of world.contexts.values()){
  assert.deepEqual(JSON.parse(JSON.stringify(c)),c);assert(c.schedule.length>=9);
  for(let hour=0;hour<24;hour+=.125){c.hour=hour;delete c.beat;const planner=createPlanner(),call=planner.plan(c,world);assert(getTool(call.tool));assert.equal(executeTool(call.tool,call.args,c,world).ok,true);const beat=c.schedule.filter(s=>s.hour<=hour).at(-1);c.beat=beat.key;const action=planner.plan(c,world);assert(getTool(action.tool));}
 }
});
test('life-routines: invalid tools and failed preconditions have no effects',()=>{
 const c=[...world.contexts.values()][0],before=JSON.stringify(c);
 for(const [name,args] of [['missing',{}],['walkTo',{}],['walkTo',{place:'Atlantis'}],['walkTo',{place:{type:'bakery',extra:()=>0}}],['walkTo',{place:[]}],['talkTo',{target:'nobody',text:'Hello'}],['work',{activity:42}],['payBill',{}]])assert.equal(executeTool(name,args,c,world).ok,false);
 assert.equal(JSON.stringify(c),before);assert.deepEqual(world.economy.counters,{buy:0,sell:0,payBill:0});
});
test('life-routines: calendar override and seeded replay',()=>{
 assert.deepEqual(createCalendar(1234),calendar);assert.deepEqual(createCalendar(1,new URLSearchParams('weekday=sun&weather=rain')),{weekday:'sun',weather:'rain'});
});
test('life-routines: legacy social beats and new relationships remain seekable',()=>{
 for(const [id,hour,tool] of [['baker',9.021,'talkTo'],['elder',12.021,'talkTo'],['carpenter',12.021,'buy'],['farmhand',12.021,'eat'],['child',12.021,'visit'],['herbalist',16.5,'talkTo'],['watch',21,'work']])assert.equal(routines.schedules[`townsfolk-${id}`].filter(b=>b.hour<=hour).at(-1).tool,tool);
});

test('life-routines: runtime seeks execute tools and remain repeatable with player present',()=>{
 const members=runtimeTown.instances.filter(p=>p.id.startsWith('townsfolk-')).map(i=>({i,path:[],goal:-1,o:{position:{x:i.pos[0],z:i.pos[1]},userData:{}}}));
 const people={people:members,installArrivalSlots:targets=>createArrivalSlots(runtimeTown,catalog,targets),seek(){for(const p of members){const s=p.i.schedule[0],pos=runtimeTown.life.graph.nodes[s.node].pos;p.goal=s.node;p.o.position.x=pos[0];p.o.position.z=pos[1];}},update(){this.seek();}};
 const social={seek(){},update(){}},api={hour:9.021,mode:'overview'};
 installRoutines({town:runtimeTown,people,social,api,q:new URLSearchParams('weekday=wed&weather=clear'),stage:{camera:{position:{x:0,z:0}}}});
 const assertArrived=contexts=>{for(const c of contexts){
  const p=members.find(p=>p.i.id===c.id),beat=c.schedule.filter(b=>b.hour<=c.hour).at(-1);
  assert.equal(c.currentAction.tool,beat.tool,`${c.id} at ${c.hour}`);
  assert.equal(p.goal,c.destination);assert.equal(p.path.length,0);
  assert.deepEqual(c.location,runtimeTown.life.graph.nodes[c.destination].pos);
  const slot=runtimeTown.life.graph.nodes[c.destination];
  assert.equal(slot.street,'life-arrival');assert.equal(slot.residentId,c.id);
  assert.equal(slot.entryNode,nearestEntryNode(runtimeTown.registry,runtimeTown.life.graph,slot.placeId));
  assert(!blocked(c.location,blockers(runtimeTown,catalog),.3));
  if(beat.place==='home'||beat.place==='work'){
   const assignment=beat.place==='home'?p.i.home:p.i.workplace;
   const place=runtimeTown.registry.places.find(place=>place.catalogId===assignment.id&&place.lot===assignment.lot);
   assert.equal(slot.placeId,place.id);
  }
 }};
 assertArrived(api.contexts());
 const hours=new Set([9.021,12.021,16.5,17.5,18.75,20.5,0,...api.contexts().flatMap(c=>c.schedule.map(b=>b.hour))]);
 for(const hour of hours){
  people.seek(hour);const first=api.contexts();assert.equal(first.length,12);assert(first.every(c=>c.currentAction&&c.currentAction.tool!=='walkTo'));
  assertArrived(first);
  // Regression: seeking shared meals/plaza must place actual resident roots
  // at distinct slots, while keeping every pair within talkTo's four metres.
  for(let a=0;a<first.length;a++)for(let b=a+1;b<first.length;b++){
   const x=first[a],y=first[b],nodes=runtimeTown.life.graph.nodes;
   if(nodes[x.destination].placeId!==nodes[y.destination].placeId)continue;
   assert(distance(x.location,y.location)>=.95,`stacked: ${x.id}, ${y.id} at ${hour}`);
   assert(distance(x.location,y.location)<4);
  }
  people.seek(hour);assert.deepEqual(api.contexts(),first);
  people.update(.1,hour,0);social.update(hour,0);
 }
 assert.equal(api.context('townsfolk-watch').job,'watch');
 assert.throws(()=>{api.planner={};});
});

test('life-routines: registry adapter accepts a place name, type and ID',()=>{
 const c=[...world.contexts.values()][0];
 for(const place of ['The Flour & Fern',{type:'smithy'},'cv-tavern',{name:'Willowmere Provisions'}])assert.equal(executeTool('walkTo',{place},c,world).ok,true);
 const registered={...world,registry:town.registry};
 c.hour=12;
 for(const place of ['The Flour & Fern',{type:'smithy'},'cv-tavern',{name:'Willowmere Provisions'},'market']){
  assert.equal(executeTool('walkTo',{place},c,registered).ok,true);
  assert(town.registry.places.some(p=>nearestEntryNode(town.registry,town.life.graph,p.id)===c.destination));
 }
 const before=JSON.stringify(c);
 assert.equal(executeTool('walkTo',{place:'Atlantis'},c,{...registered,destinations:{[c.id]:{Atlantis:c.destination}}}).ok,false);
 assert.equal(JSON.stringify(c),before);
});
test('life-routines: movement routes before actions and distant speech has no effect',()=>{
 const graph={nodes:[{pos:[0,0]},{pos:[1,0]},{pos:[8,0]}],edges:[[1],[0,2],[1]],connected:[0,1,2]};
 const c=createNpcContext({id:'resident',pos:[0,0]}),other=createNpcContext({id:'other',pos:[8,0]});let moved;
 const local={graph,destinations:{resident:{home:2}},contexts:new Map([['other',other]]),move:(id,d)=>{moved={id,...d};},arrived:()=>false};
 assert.equal(executeTool('walkTo',{place:'home'},c,local).ok,true);assert.deepEqual(moved.path,[0,1,2]);assert.deepEqual(c.location,[0,0]);
 const snapshot=JSON.stringify(c);assert.equal(executeTool('work',{},c,local).error,'still walking');assert.equal(JSON.stringify(c),snapshot);
 local.arrived=()=>true;assert.equal(executeTool('talkTo',{target:'other',text:'Hello'},c,local).error,'neighbour too far away');assert.equal(JSON.stringify(c),snapshot);
});
test('life-routines: weather and weekend choices are reproducible table variations',()=>{
 const rain=buildRoutines(structuredClone(pristineTown),{weekday:'sun',weather:'rain'});
 const schedule=rain.schedules['townsfolk-baker'];assert.equal(schedule.find(b=>b.hour===14).activity,'weekend gathering');assert.equal(schedule.find(b=>b.hour===16).place,'tavern');
});

test('life-routines: shared registry arrivals have distinct deterministic walkable slots',()=>{
 for(const seed of [1,7,1234]){
  const local=compileTown(read('specs/large.json'),catalog,{seed,life:true});
  const {placeTargets}=buildRoutines(local,createCalendar(seed));
  const replay=structuredClone(local),arrivalNode=createArrivalSlots(local,catalog,placeTargets);
  const reversed=Object.fromEntries(Object.entries(placeTargets).reverse());
  const replayNode=createArrivalSlots(replay,catalog,reversed);
  const tavern=Object.values(placeTargets).map(p=>p.tavern).find(Boolean);
  const entry=nearestEntryNode(local.registry,local.life.graph,tavern),solids=blockers(local,catalog),positions=[];
  for(const id of Object.keys(placeTargets)){
   const node=arrivalNode(id,tavern,entry),pos=local.life.graph.nodes[node].pos;
   assert.notEqual(node,entry);assert.deepEqual(pos,replay.life.graph.nodes[replayNode(id,tavern,entry)].pos);
   assert(distance(pos,local.life.graph.nodes[entry].pos)<=3);
   for(let n=0;n<=100;n++)assert(!blocked(pos.map((v,k)=>v+(local.life.graph.nodes[entry].pos[k]-v)*n/100),solids,.3));
   for(const previous of positions){assert(distance(pos,previous)>=.95);assert(distance(pos,previous)<4);}
   positions.push(pos);
  }
  assert.equal(positions.length,12);
  assert.equal(nearestEntryNode(local.registry,local.life.graph,tavern),entry);
 }
});
