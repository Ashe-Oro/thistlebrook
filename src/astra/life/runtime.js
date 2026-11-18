import { documentedSeat, GREET_RANGE, CROSSFADE } from '../../life/animation-plan.js';
import {mealCopy,walkingCopy} from './activity-copy.js';
import {createWorldRegistry} from '../registry/index.js';
import { buildLifeRegistry, TOOLS, distance, isOpen } from './registry.js';
import { createContexts, dailySchedule } from './profiles.js';
import { scriptedPlanner } from './planner.js';
import { baseballFrame, chessFrame } from './activities.js';
import { sidewalkSteps, keepToSidewalks } from '../../roads/walking.js';
const clamp=v=>Math.max(0,Math.min(100,v));
const durations={work:45,buy:6,sell:8,payBill:7,rest:30,eat:25,visit:24};
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};

/** Pure simulation; no THREE, DOM, network, model calls, or render-time mutations.
 * @param {object} town
 * @param {{brain?:import('./types').Brain, places?:import('./types').Place[], hour?:number}} options */
export function createLife(town,options={}){
 const registry=buildLifeRegistry(town,options.places),byId=new Map(registry.places.map(p=>[p.id,p]));
 const routing=createWorldRegistry({...town,registry:{places:registry.places.map(p=>({...p,type:p.type||p.kind,entryPoints:[{node:p.node,position:town.nodes[p.node],approach:[]}],interactionPoints:p.interaction?.slots||[]}))}});
 let crossingGuard=options.crossingGuard||null;
 let brain=options.brain||scriptedPlanner,day=0,hour=Number.isFinite(options.hour)?((options.hour%24)+24)%24:10.4,elapsed=0,seq=0;
 const actors=createContexts(town,registry).map((context,n)=>({context,index:n,action:null,route:[],localPath:[],history:[],activity:'Starting the day',facing:0,wait:0,retry:0,lastPassing:-100,greetAfter:0,greetingUntil:0,travelled:0,rise:0,pose:'idle',game:null,arrivals:0}));
 const reservations=new Map(),events=[],games=new Map();
 for(const a of actors)a.context.schedule=dailySchedule(a.context,registry,day,town.seed);
 const slotKey=(place,slot)=>`${place}/${slot}`;
 const owns=(a,p,s)=>reservations.get(slotKey(p,s))===a.context.id;
 const fitsSlot=(a,p,s)=>!s.counter||s.role===(a.context.job.workplace===p.id?'service':'customer');
 const freeSlot=(a,p,s)=>fitsSlot(a,p,s)&&(!reservations.has(slotKey(p.id,s.id))||owns(a,p.id,s.id));
 function record(a,action,status,detail){
  const event={id:++seq,day,hour,elapsed,resident:a.context.id,name:a.context.name,tool:action.tool,args:structuredClone(action.args),status,detail};
  a.history.push(event);if(a.history.length>32)a.history.shift();events.push(event);if(events.length>180)events.shift();
 }
 function release(a){for(const [key,id]of reservations)if(id===a.context.id)reservations.delete(key);a.context.location.slot=null;}
 function snapshot(a,passing=false,greetingTarget=null){
  const c=a.context;
  return freeze(structuredClone({self:c,clock:{day,hour,elapsed},passing,greetingTarget,places:registry.places.map(p=>({...p,distance:distance(c.location.position,town.nodes[p.node]),freeSlots:p.interaction?.slots.filter(s=>freeSlot(a,p,s)).map(s=>s.id)||[],participants:actors.filter(b=>b.context.location.place===p.id&&b.context.location.slot&&b.action&&b.action.tool!=='walkTo').map(b=>b.context.id)})),neighbours:actors.filter(b=>b!==a).map(b=>({id:b.context.id,name:b.context.name,place:b.context.location.place,activity:byId.get(b.context.location.place)?.interaction?.activity||null}))}));
 }
 function fail(a,action,error){record(a,action,'rejected',error);return {ok:false,error};}
 /** Single mutation gate, shared by scripted and future replacement brains. */
 function execute(id,request){
  const a=typeof id==='string'?actors.find(a=>a.context.id===id):id;if(!a)return {ok:false,error:'Unknown resident'};
  let action;try{action=structuredClone(request);}catch{return {ok:false,error:'Action must be JSON serializable'};}
  if(!action||!TOOLS.includes(action.tool)||!action.args||typeof action.args!=='object'||typeof action.reason!=='string')return {ok:false,error:'Invalid action shape'};
  if(Array.isArray(action.args)||Object.entries(action.args).some(([key,value])=>!['target','slot','activity','item','bill'].includes(key)||typeof value!=='string'))return fail(a,action,'Action arguments must be supported string fields');
  if(action.tool==='talkTo'){
   const other=actors.find(b=>b.context.id===action.args.target);
   const available=b=>!b.crossing&&!b.waitingToCross&&(!b.action||b.action.tool==='walkTo')&&
     !b.context.location.slot&&b.greetAfter<=elapsed;
   const gap=other&&distance(a.context.location.position,other.context.location.position);
   if(!other||other===a||!available(a)||!available(other)||gap<.65||gap>GREET_RANGE)
    return fail(a,action,'The other resident must be passing within greeting range');
   for(const b of [a,other]){b.greetingUntil=elapsed+1.25;b.greetAfter=elapsed+70;}
   record(a,action,'completed','Exchanged a passing greeting');
   return {ok:true};
  }
  if(a.action)return fail(a,action,'Resident is already performing an action');
  const c=a.context,p=byId.get(action.args.target),tool=action.tool;
  if(!p)return fail(a,action,'Unknown destination');
  if(!isOpen(p.hours,hour)&&p.id!==c.assets.home)return fail(a,action,'Destination is closed');
  if(!p.capabilities.includes(tool))return fail(a,action,'Destination does not support this action');
  if(tool==='walkTo'){
   let slot=null;
   if(p.interaction){
    slot=p.interaction.slots.find(s=>(!action.args.slot||s.id===action.args.slot)&&freeSlot(a,p,s));if(!slot)return fail(a,action,'All interaction slots are occupied');}
   const resolved=routing.resolvePath(c.location.node,p.id,slot?{slot:slot.id}:{});if(!resolved.ok)return fail(a,action,resolved.error);const path=resolved.nodes;
   // Reverse the exact approach to return to the graph before taking a new route.
   const exit=a.localPath.length?[...a.localPath].reverse().slice(1).map(pos=>({pos:[...pos]})):[];
   if(exit.length)exit.push({pos:[...town.nodes[c.location.node]],node:c.location.node});
   const local=slot?[town.nodes[p.node],...resolved.points.slice(path.length)].map(v=>[...v]):[];
   // Walk on sidewalks and footpaths (grok-roads): the town graph above picks
   // and validates the destination; the pedestrian graph supplies the steps.
   const from=exit.length?town.nodes[c.location.node]:c.location.position,walk=path.length>1?sidewalkSteps(town,from,path.at(-1)):[];
   const route=keepToSidewalks(town,c.location.position,[...exit,...walk,...local.slice(1).map(pos=>({pos}))]);
   const previousSlot=byId.get(c.location.place)?.interaction?.slots.find(s=>s.id===c.location.slot);
   a.rise=documentedSeat(previousSlot,c.location.position)?CROSSFADE:0;
   release(a);if(slot){reservations.set(slotKey(p.id,slot.id),c.id);action.args.slot=slot.id;}
   a.localPath=[];c.location.place=null;a.retry=0;
   a.action={...action,elapsed:0,duration:0,target:p.id,local,slot:slot?.id||null};a.route=route;a.activity=walkingCopy(p);a.pose='walk';record(a,action,'started',action.reason);
   if(!route.length)arrive(a);return {ok:true};
  }
  if(c.location.place!==p.id)return fail(a,action,'Walk to the destination first');
  if(p.interaction&&(!c.location.slot||!owns(a,p.id,c.location.slot)))return fail(a,action,'Reserve and approach a slot first');
  if(p.interaction&&!p.interaction.tools.includes(tool))return fail(a,action,'This prop does not support that action');
  if(action.args.activity&&p.interaction?.activity!==action.args.activity)return fail(a,action,'Activity does not match this prop');
  if(tool==='work'&&p.id!==c.job.workplace)return fail(a,action,'Not the assigned workplace');
  if(tool==='work'&&(!(hour>=c.job.shift[0]&&hour<c.job.shift[1])||c.memory.worked>=(c.job.workplace.startsWith('workspot:')?720:360)))return fail(a,action,'Outside the work allowance');
  if(tool==='buy'&&c.money<300)return fail(a,action,'Not enough money for lunch');
  if(tool==='buy'&&action.args.item&&action.args.item!=='meal')return fail(a,action,'Only packed meals are stocked');
  if(tool==='sell'&&(!action.args.item||!Object.hasOwn(c.assets.inventory,action.args.item)||!Number.isInteger(c.assets.inventory[action.args.item])||c.assets.inventory[action.args.item]<=0))return fail(a,action,'Nothing to sell');
  if(tool==='payBill'){
   const bill=c.bills.find(b=>b.id===action.args.bill);
   if(!bill||bill.paidDay===day||bill.dueDay>day||bill.amount>c.money)return fail(a,action,'Bill is not due or cannot be paid');
   if(p.name!=='Thistlebrook Town Hall'&&p.id!==c.job.workplace)return fail(a,action,'Bills are paid at town hall or the workplace');
  }
  if(tool==='eat'&&!c.assets.inventory.meal&&p.id!==c.assets.home)return fail(a,action,'Bring a packed meal');
  const slot=p.interaction?.slots.find(s=>s.id===c.location.slot);
  if(slot?.counter&&tool==='work'&&slot.role!=='service')return fail(a,action,'Approach the service side of the counter');
  a.retry=0;a.action={...action,elapsed:0,waiting:0,duration:p.interaction?.duration||durations[tool],target:p.id};
  a.pose=slot?.animation||(tool==='work'?'work':'idle');if(tool==='eat'&&slot?.kind==='seat')a.pose='eat';
  a.activity=tool==='work'?(c.job.title==='Student'?'Attending class':`Working at ${p.name}`):tool==='buy'?'Picking up a packed lunch':tool==='sell'?'Delivering today’s goods':tool==='payBill'?'Paying the household contribution':tool==='rest'&&p.id===c.assets.home?'Resting at home':tool==='eat'?mealCopy(hour):p.interaction?.label||`Visiting ${p.name}`;
  record(a,action,'started',action.reason);return {ok:true};
 }
 function arrive(a){
  const c=a.context,action=a.action,p=byId.get(action.target);c.location.node=p.node;c.location.place=p.id;c.location.slot=action.slot;a.localPath=action.local;a.action=null;a.pose='idle';a.arrivals++;
  if(action.slot){const s=p.interaction.slots.find(s=>s.id===action.slot);a.facing=s.facing;}
  c.memory.visited.push(p.id);if(c.memory.visited.length>12)c.memory.visited.shift();record(a,action,'completed',`Arrived at ${p.name}`);
 }
 function finish(a){
  const action=a.action,c=a.context,p=byId.get(action.target),tool=action.tool;
  if(tool==='work'){c.memory.worked+=action.duration;c.money+=c.job.wage;if(c.job.product)c.assets.inventory[c.job.product]=(c.assets.inventory[c.job.product]||0)+1;}
  if(tool==='buy'){c.money-=300;c.assets.inventory.meal=(c.assets.inventory.meal||0)+2;c.memory.lastPurchase=elapsed;}
  if(tool==='sell'){c.assets.inventory[action.args.item]--;c.money+=180;c.memory.lastSale=elapsed;}
  if(tool==='payBill'){const b=c.bills.find(b=>b.id===action.args.bill);c.money-=b.amount;b.paidDay=day;b.dueDay=day+3;}
  if(tool==='eat'){if(c.assets.inventory.meal>0)c.assets.inventory.meal--;c.needs.hunger=clamp(c.needs.hunger-65);c.memory.lastMeal=elapsed;c.memory.lastBreak=elapsed;}
  if(tool==='rest'){c.needs.energy=clamp(c.needs.energy+32);c.memory.lastBreak=elapsed;}
  if(p.interaction&&['chess','baseball'].includes(p.interaction.activity)){c.memory.lastLeisure=elapsed;c.needs.recreation=clamp(c.needs.recreation+45);}
  if(tool==='visit')c.needs.recreation=clamp(c.needs.recreation+12);
  record(a,action,'completed',a.activity);a.action=null;a.pose='idle';a.game=null;
 }
 function decide(a,passing=false){
  let request;try{request=brain(snapshot(a,passing));}catch(error){a.retry=4;a.activity='Taking a moment';record(a,{tool:'rest',args:{},reason:'Planner error'},'rejected',String(error));return;}
  if(!request){if(!passing)a.retry=2;return;}
  if(passing){
   if(request.tool!=='walkTo'||request.args?.target===a.action?.target)return;
   // Planner gets a chance to stop only at an already-reached navigation node.
   const old=a.action;a.action=null;const result=execute(a,request);
   if(!result.ok)a.action=old;else record(a,old,'interrupted','Stopped at an accessible prop on the way');
  }else if(!execute(a,request).ok)a.retry=4;
 }
 function advanceWalk(a,dt){
  const rise=Math.min(a.rise,dt);
  a.rise-=rise;
  let budget=(dt-rise)*a.context.personality.pace;
  while(budget>0&&a.route.length){
   const next=a.route[0],pos=a.context.location.position,d=distance(pos,next.pos),step=Math.min(d,budget);
   // Look both ways: a crossing starts only when no car is near (grok-roads).
   if(next.cross&&!a.crossing){if(crossingGuard&&!crossingGuard(pos,next.pos)){a.waitingToCross=true;break;}a.crossing=true;a.waitingToCross=false;}
   if(d>.0001){a.facing=Math.atan2(next.pos[0]-pos[0],next.pos[1]-pos[1]);pos[0]+=(next.pos[0]-pos[0])*step/d;pos[1]+=(next.pos[1]-pos[1])*step/d;a.travelled+=step;}budget-=step;
   if(d<=step){pos[0]=next.pos[0];pos[1]=next.pos[1];a.route.shift();a.crossing=false;if(next.node!==undefined){a.context.location.node=next.node;if(a.route.length&&elapsed-a.lastPassing>20){a.lastPassing=elapsed;decide(a,true);}}}else break;
  }
  if(a.action?.tool==='walkTo'&&!a.route.length)arrive(a);
 }
 function updateGames(dt){
  for(const p of registry.places.filter(p=>p.interaction?.minParticipants>1)){
   const group=actors.filter(a=>a.context.location.place===p.id&&a.context.location.slot&&a.action&&a.action.tool!=='walkTo');
   let game=games.get(p.id);const ids=group.map(a=>a.context.id).sort().join('|');
   if(!game||game.members!==ids){game={members:ids,elapsed:0,phase:'Waiting for players',round:0};games.set(p.id,game);}
   const ready=group.length>=p.interaction.minParticipants;
   if(ready){
    game.elapsed+=dt;game.phase=p.interaction.activity==='baseball'?baseballFrame(p.interaction,game.elapsed).phase:`${chessFrame(game.elapsed).side==='white'?'White':'Black'} to move`;
    if(!game.bonded){game.bonded=true;for(const a of group)for(const b of group){if(a===b)continue;let r=a.context.relationships.find(r=>r.id===b.context.id);if(!r){r={id:b.context.id,familiarity:0,sharedActivities:0};a.context.relationships.push(r);}r.familiarity=Math.min(100,r.familiarity+3);r.sharedActivities++;}}
   }
   for(const a of group){a.game={...game,ready};a.activity=ready?`${p.interaction.label} · ${game.phase}`:`Waiting for ${p.interaction.activity==='chess'?'a chess partner':'the practice team'}`;}
  }
 }
 function update(dt,nextHour=hour){
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,1);
  if(Number.isFinite(nextHour)){
   const normalized=((nextHour%24)+24)%24;
   if(hour>23&&normalized<1){day++;for(const a of actors){a.context.memory.day=day;a.context.memory.worked=0;a.context.schedule=dailySchedule(a.context,registry,day,town.seed);}}
   hour=normalized;
  }
  const greetingTick=Math.floor(elapsed*2)!==Math.floor((elapsed+dt)*2);
  elapsed+=dt;updateGames(dt);
  for(const a of actors){
   const c=a.context;c.needs.hunger=clamp(c.needs.hunger+dt*.045);c.needs.energy=clamp(c.needs.energy-dt*(a.action?.tool==='walkTo'?.028:.012));c.needs.recreation=clamp(c.needs.recreation-dt*.018);
   if(greetingTick&&hour>=7&&hour<20&&a.action?.tool==='walkTo'&&a.greetAfter<=elapsed&&!a.crossing&&!a.waitingToCross){
    const other=actors.find(b=>b!==a&&b.greetAfter<=elapsed&&!b.crossing&&!b.waitingToCross&&
     (!b.action||b.action.tool==='walkTo')&&!b.context.location.slot&&
     distance(c.location.position,b.context.location.position)>=.65&&distance(c.location.position,b.context.location.position)<=GREET_RANGE);
    if(other){
     // The built-in greeting only needs the clock and partner. Custom brains
     // still receive their full frozen planning context.
     const context=brain===scriptedPlanner?{clock:{day,hour,elapsed},greetingTarget:other.context.id}:snapshot(a,true,other.context.id);
     let request;
     try{request=brain(context);}catch{request=null;}
     if(request?.tool==='talkTo')execute(a,request);
    }
   }
   if(a.retry>0){a.retry-=dt;continue;}
   if(!a.action){decide(a);continue;}
   if(a.action.tool==='walkTo'){advanceWalk(a,dt);continue;}
   const p=byId.get(a.action.target),groupActivity=p.interaction?.minParticipants>1;
   if(groupActivity&&!a.game?.ready){a.action.waiting+=dt;const coming=p.interaction.slots.filter(s=>reservations.has(slotKey(p.id,s.id))).length>=p.interaction.minParticipants;if(a.action.waiting>(coming?300:130))finish(a);continue;}
   a.action.elapsed+=dt;
   // Group activities end at a shared boundary; participants never leave mid-pitch.
   const cycle=p.interaction?.activity==='baseball'?36:50;
   const done=groupActivity?a.game.elapsed>=Math.ceil(a.action.duration/cycle)*cycle:a.action.elapsed>=a.action.duration;
   if(done)finish(a);
  }
 }
 return {registry,routing,actors,reservations,events,games,execute,snapshot,update,get hour(){return hour;},get day(){return day;},get elapsed(){return elapsed;},
  setHour(h){if(Number.isFinite(h))hour=((h%24)+24)%24;},
  setCrossingGuard(fn){crossingGuard=typeof fn==='function'?fn:null;},
  setBrain(next){if(typeof next!=='function')throw new TypeError('Brain must be a function');brain=next;},
  audit(){return {day,hour,elapsed,actors:actors.length,reservations:[...reservations],rejectedMetadata:registry.rejected,events:structuredClone(events),people:actors.map(a=>({id:a.context.id,name:a.context.name,money:a.context.money,needs:{...a.context.needs},action:a.action?.tool||null,target:a.action?.target||null,place:a.context.location.place,slot:a.context.location.slot,arrivals:a.arrivals}))};}
 };
}
