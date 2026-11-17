import { TOWNSFOLK } from '../catalog/townsfolk.js';
import { createNpcContext } from './context.js';
import { createCalendar } from './calendar.js';
import { createPlanner } from './planner.js';
import { createEconomy } from './economy.js';
import { executeTool, listTools } from './tools.js';
import { buildRoutines } from './routines.js';
import { PROFILES, AMBIENT } from './data/routines.js';
export function installRoutines({town,people,social,api,q,stage}){
 const calendar=createCalendar(town.seed,q),{destinations,schedules,placeTargets}=buildRoutines(town,calendar);
 for(const [id,beats] of Object.entries(schedules))for(const [n,b] of beats.entries()){
  if(b.place.startsWith('event:'))continue;
  town.life.reservations.push({key:`daily:${b.key}`,type:({eat:'eat',buy:'shop',sell:'shop'}[b.tool]??(b.activity==='play'?'play':'chat')),ids:[id],nodes:[destinations[id][b.place]],start:b.hour,end:beats[n+1]?.hour??24,target:b.place});
 }
 const arrivalNode=people.installArrivalSlots(placeTargets); // WORKTREE-HOOK life-queue
 const contexts=new Map(),economy=createEconomy();let planner=createPlanner(),seeking=false;
 const log=[];
 const world={registry:town.registry,graph:town.life.graph,destinations,placeTargets,contexts,economy,arrivalNode,
  arrived(id){const p=people.people.find(p=>p.i.id===id);return !p.path.length&&p.goal===contexts.get(id).destination;},
  move(id,d){const p=people.people.find(p=>p.i.id===id);p.i.schedule=[{hour:0,node:d.node,activity:'walking'}];p.o.userData.speech=null;p.o.userData.tool=null;},
  act(id,tool,args){const p=people.people.find(p=>p.i.id===id);p.i.schedule[0].activity=args.activity??tool;p.o.userData.speech=args.text??contexts.get(id).schedule.find(b=>b.key===contexts.get(id).beat)?.text;
   p.o.userData.tool=tool;
  },
 };
 for(const p of people.people){const v=TOWNSFOLK.find(v=>v.id===p.i.id),profile=PROFILES[v.role];
  const ctx=createNpcContext(v,{personality:profile[0],schedule:schedules[v.id],location:[p.o.position.x,p.o.position.z],...calendar,
   bills:[{id:'household',status:'unpriced'}],obligations:[{kind:'daily',description:profile[1]}],assets:[{kind:'home',id:p.i.home.id},{kind:'workplace',id:p.i.workplace.id}],
   relationships:[{id:`townsfolk-${profile[2]}`,kind:profile[3],interactions:0}],needs:{hunger:25,energy:75,social:30,work:50}});
  contexts.set(v.id,ctx);
 }
 const sync=hour=>{for(const p of people.people){const c=contexts.get(p.i.id);c.hour=hour;c.location=[p.o.position.x,p.o.position.z];}};
 function step(hour){sync(hour);for(const ctx of contexts.values()){if(ctx.id==='player')continue;
  const beat=ctx.schedule.filter(s=>s.hour<=hour).at(-1),call=planner.plan(ctx,world);if(!call)continue;
  const result=executeTool(call.tool,call.args,ctx,world);
  if(result.ok){if(call.tool==='walkTo')ctx.beat=beat.key;else ctx.completed=beat.key;
   log.push({id:ctx.id,hour,...call});if(log.length>180)log.shift();}
 }}
 const seek=people.seek.bind(people),update=people.update.bind(people);
 people.seek=hour=>{seeking=true;economy.reset();log.length=0;for(const ctx of contexts.values()){if(ctx.id==='player')continue;delete ctx.beat;delete ctx.completed;ctx.currentAction=null;ctx.needs={hunger:25,energy:75,social:30,work:50};for(const r of ctx.relationships)r.interactions=0;}step(hour);seek(hour);sync(hour);step(hour);seeking=false;};
 people.update=(dt,hour,seconds)=>{step(hour);update(dt,hour,seconds);sync(hour);step(hour);};
 // Rendering consumes tool state; nearby player reactions also go through talkTo.
 contexts.set('player',{id:'player',location:[0,0]});
 const socialUpdate=social.update.bind(social);let lastPlayer=-Infinity;
 social.update=(hour,seconds)=>{const player=contexts.get('player');player.location=[stage.camera.position.x,stage.camera.position.z];
  if(!seeking&&api.mode==='walk'&&hour*60-lastPlayer>15){const c=[...contexts.values()].find(c=>c.id!=='player'&&world.arrived(c.id)&&Math.hypot(c.location[0]-player.location[0],c.location[1]-player.location[1])<3);
   if(c){const result=executeTool('talkTo',{target:'player',text:AMBIENT[calendar.weather][0],activity:'greet'},c,world);if(result.ok)lastPlayer=hour*60;}}
  socialUpdate(hour,seconds);
 };
 Object.assign(api,{context:id=>{const c=contexts.get(id);return c?structuredClone(c):null;},contexts:()=>[...contexts.values()].filter(c=>c.id!=='player').map(c=>structuredClone(c)),tools:()=>listTools().map(({name,argsSchema,resultSchema})=>({name,argsSchema,resultSchema})),history:()=>structuredClone(log),economy:()=>({...economy.counters}),weekday:calendar.weekday,weather:calendar.weather});
 Object.defineProperty(api,'planner',{get:()=>planner,set:value=>{if(typeof value?.plan!=='function')throw Error('Planner requires plan(context, world)');planner=value;}});
 people.seek(api.hour);social.seek(api.hour);
}
