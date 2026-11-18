import { documentedSeat, GREET_RANGE, CROSSFADE } from '../../life/animation-plan.js';
import {mealCopy,walkingCopy} from './activity-copy.js';
import {createWorldRegistry} from '../registry/index.js';
import { buildLifeRegistry, TOOLS, distance, isOpen } from './registry.js';
import { createContexts, dailySchedule } from './profiles.js';
import { scriptedPlanner } from './planner.js';
import { baseballFrame, chessFrame } from './activities.js';
import { allowsWeatherVisit, isWeather, travelWeather, weatherPlan, weatherSlotOpen } from '../weather-plan.js';
import { sidewalkSteps, keepToSidewalks } from '../../roads/walking.js';
import { commuting, inWindow, LOW_RECREATION, MEAL_COST, MEAL_RECOVERY, reserve, RETRY_DESTINATION, SECONDS_PER_HOUR, tickNeeds } from './needs.js';
const durations={work:45,buy:6,sell:8,payBill:7,rest:30,eat:14,visit:24};
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};

/** Pure simulation; no THREE, DOM, network, model calls, or render-time mutations.
 * @param {object} town
 * @param {{brain?:import('./types').Brain, places?:import('./types').Place[], hour?:number, weather?:string}} options */
export function createLife(town,options={}){
 const registry=buildLifeRegistry(town,options.places),byId=new Map(registry.places.map(p=>[p.id,p]));
 const routing=createWorldRegistry({...town,registry:{places:registry.places.map(p=>({...p,type:p.type||p.kind,entryPoints:[{node:p.node,position:town.nodes[p.node],approach:[]}],interactionPoints:p.interaction?.slots||[]}))}});
 let crossingGuard=options.crossingGuard||null,railGuard=options.railGuard||null,localWalkGuard=null,transit=null;
 let brain=options.brain||scriptedPlanner,day=0,hour=Number.isFinite(options.hour)?((options.hour%24)+24)%24:10.4,elapsed=0,seq=0;
 let weather=isWeather(options.weather)?options.weather:'clear';
 const actors=createContexts(town,registry).map((context,n)=>({context,index:n,action:null,route:[],localPath:[],history:[],activity:'Starting the day',facing:0,wait:0,retry:0,lastPassing:-100,greetAfter:0,greetingUntil:0,travelled:0,rise:0,pose:'idle',game:null,arrivals:0}));
 const reservations=new Map(),events=[],games=new Map();
 for(const a of actors){
  const c=a.context,work=byId.get(c.job.workplace),home=byId.get(c.assets.home);
  if(work.node!==home.node){
   let previous=home.pos,length=0;
   for(const {pos} of sidewalkSteps(town,previous,work.node)){length+=distance(previous,pos);previous=pos;}
   c.job.commute=(length/c.personality.pace+16)/SECONDS_PER_HOUR;
  }
  if(c.sleep[1]===6&&c.job.shift[1]>c.job.shift[0]){
   const wake=Math.min(6,c.job.shift[0]-c.job.commute);
   c.sleep=[(wake+16)%24,wake];
  }
  c.schedule=dailySchedule(c,registry,day,town.seed);
 }
 const slotKey=(place,slot)=>`${place}/${slot}`;
 const owns=(a,p,s)=>reservations.get(slotKey(p,s))===a.context.id;
 const fitsSlot=(a,p,s)=>!s.counter||s.role===(a.context.job.workplace===p.id?'service':'customer');
 const freeSlot=(a,p,s)=>weatherSlotOpen(weather,p,s)&&fitsSlot(a,p,s)&&(!reservations.has(slotKey(p.id,s.id))||owns(a,p.id,s.id));
 function record(a,action,status,detail){
  const event={id:++seq,day,hour,elapsed,resident:a.context.id,name:a.context.name,tool:action.tool,args:structuredClone(action.args),status,detail};
  a.history.push(event);if(a.history.length>32)a.history.shift();events.push(event);if(events.length>180)events.shift();
 }
 function release(a){for(const [key,id]of reservations)if(id===a.context.id)reservations.delete(key);a.context.location.slot=null;}
 function canTalk(a,b){
  if(a===b||a.riding||b.riding||a.greetAfter>elapsed||b.greetAfter>elapsed||a.crossing||b.crossing||a.waitingToCross||b.waitingToCross)return false;
  const one=a.context.location,two=b.context.location,gap=distance(one.position,two.position);
  if(gap<.65||gap>GREET_RANGE)return false;
  const busy=actor=>actor.action?.sleeping||actor.action?.tool==='work';
  if(busy(a)||busy(b))return false;
  if(one.place&&one.place===two.place)return true;
  return !one.slot&&!two.slot&&[a,b].every(actor=>!actor.action||actor.action.tool==='walkTo');
 }
 function snapshot(a,passing=false,greetingTarget=null,internal=false){
  const c=a.context;
  const present=new Map();
  for(const b of actors){
   const loc=b.context.location;
   if(loc.place&&loc.slot&&b.action&&b.action.tool!=='walkTo'){
    if(!present.has(loc.place))present.set(loc.place,[]);
    present.get(loc.place).push(b.context.id);
   }
  }
  const view={self:c,clock:{day,hour,elapsed},weather,transit:!!transit,passing,greetingTarget,places:registry.places.map(p=>({...p,weatherAllowsVisit:allowsWeatherVisit(weather,p,a.index),weatherSlotOpen:weatherSlotOpen(weather,p,p.interaction?.slots.find(s=>s.id===c.location.slot)),distance:distance(c.location.position,town.nodes[p.node]),freeSlots:p.interaction?.slots.filter(s=>freeSlot(a,p,s)).map(s=>s.id)||[],participants:present.get(p.id)||[]})),neighbours:actors.filter(b=>b!==a).map(b=>({id:b.context.id,name:b.context.name,place:b.context.location.place,activity:byId.get(b.context.location.place)?.interaction?.activity||null}))};
  return internal?view:freeze(structuredClone(view));
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
   if(!other||!canTalk(a,other))return fail(a,action,'The other resident must be nearby and available');
   for(const [b,partner] of [[a,other],[other,a]]){
    b.greetingUntil=elapsed+1.25;b.greetAfter=elapsed+70;
    b.context.needs.recreation=reserve(b.context.needs.recreation+12);
    let relation=b.context.relationships.find(r=>r.id===partner.context.id);
    if(!relation){relation={id:partner.context.id,familiarity:0,sharedActivities:0};b.context.relationships.push(relation);}
    relation.familiarity=reserve(relation.familiarity+2);relation.sharedActivities++;
   }
   record(a,action,'completed',`Chatted with ${other.context.name}`);
   return {ok:true};
  }
  if(a.action)return fail(a,action,'Resident is already performing an action');
  const c=a.context,p=byId.get(action.args.target),tool=action.tool;
  if(!p)return fail(a,action,'Unknown destination');
  const staff=p.id===c.job.workplace&&commuting(c.job,hour)&&['walkTo','work','eat'].includes(tool);
  if(!isOpen(p.hours,hour)&&p.id!==c.assets.home&&!staff)return fail(a,action,'Destination is closed');
  if(!['work','buy','sell','payBill'].includes(tool)&&!allowsWeatherVisit(weather,p,a.index))return fail(a,action,'Outdoor leisure is limited in this weather');
  if(!p.capabilities.includes(tool))return fail(a,action,'Destination does not support this action');
  if(p.interaction?.residents&&!p.interaction.residents.includes(c.id))return fail(a,action,'Private to its residents');
  if(a.riding)return fail(a,action,'Riding a vehicle');
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
  if(tool==='work'&&!inWindow(c.job.shift,hour))return fail(a,action,'Outside the scheduled shift');
  if(tool==='buy'&&c.money<MEAL_COST)return fail(a,action,'Not enough money for lunch');
  if(tool==='buy'&&action.args.item&&action.args.item!=='meal')return fail(a,action,'Only packed meals are stocked');
  if(tool==='sell'&&(!action.args.item||!Object.hasOwn(c.assets.inventory,action.args.item)||!Number.isInteger(c.assets.inventory[action.args.item])||c.assets.inventory[action.args.item]<=0))return fail(a,action,'Nothing to sell');
  if(tool==='payBill'){
   const bill=c.bills.find(b=>b.id===action.args.bill);
   if(!bill||bill.paidDay===day||bill.dueDay>day||bill.amount>c.money)return fail(a,action,'Bill is not due or cannot be paid');
   if(p.name!=='Thistlebrook Town Hall'&&p.id!==c.job.workplace)return fail(a,action,'Bills are paid at town hall or the workplace');
  }
  if(tool==='eat'&&!c.assets.inventory.meal&&p.id!==c.assets.home)return fail(a,action,'Bring a packed meal');
  const slot=p.interaction?.slots.find(s=>s.id===c.location.slot);
  if(slot&&!weatherSlotOpen(weather,p,slot))return fail(a,action,'This picnic seat is closed for snow');
  if(slot?.counter&&tool==='work'&&slot.role!=='service')return fail(a,action,'Approach the service side of the counter');
  const sleeping=tool==='rest'&&p.id===c.assets.home&&inWindow(c.sleep,hour);
  a.retry=0;a.action={...action,elapsed:0,waiting:0,duration:tool==='eat'?durations.eat:p.interaction?.duration||durations[tool],target:p.id,sleeping};
  a.pose=slot?.animation||(tool==='work'?'work':'idle');if(tool==='eat')a.pose='eat';
  a.activity=sleeping?'Asleep at home':tool==='work'?(c.job.title==='Student'?'Attending class':`Working at ${p.name}`):tool==='buy'?'Picking up a packed lunch':tool==='sell'?'Delivering today’s goods':tool==='payBill'?'Paying the household contribution':tool==='rest'&&p.id===c.assets.home?'Resting at home':tool==='eat'?mealCopy(hour):p.interaction?.label||`Visiting ${p.name}`;
  record(a,action,'started',action.reason);return {ok:true};
 }
 function arrive(a){
  const c=a.context,action=a.action,p=byId.get(action.target);c.location.node=p.node;c.location.place=p.id;c.location.slot=action.slot;a.localPath=action.local;a.action=null;a.pose='idle';a.arrivals++;
  if(action.slot){const s=p.interaction.slots.find(s=>s.id===action.slot);a.facing=s.facing;}
  c.memory.visited.push(p.id);if(c.memory.visited.length>12)c.memory.visited.shift();record(a,action,'completed',`Arrived at ${p.name}`);
 }
 function finish(a){
  const action=a.action,c=a.context,p=byId.get(action.target),tool=action.tool;
  if(tool==='work'&&action.elapsed>=action.duration){c.money+=c.job.wage;if(c.job.product)c.assets.inventory[c.job.product]=(c.assets.inventory[c.job.product]||0)+1;}
  if(tool==='buy'){c.money-=MEAL_COST;c.assets.inventory.meal=(c.assets.inventory.meal||0)+2;c.memory.lastPurchase=elapsed;}
  if(tool==='sell'){c.assets.inventory[action.args.item]--;c.money+=180;c.memory.lastSale=elapsed;}
  if(tool==='payBill'){const b=c.bills.find(b=>b.id===action.args.bill);c.money-=b.amount;b.paidDay=day;b.dueDay=day+3;}
  if(tool==='eat'){if(c.assets.inventory.meal>0)c.assets.inventory.meal--;c.needs.hunger=reserve(c.needs.hunger+MEAL_RECOVERY);c.memory.lastMeal=elapsed;c.memory.lastBreak=elapsed;}
  if(tool==='rest'&&!action.sleeping){c.needs.energy=reserve(c.needs.energy+24);c.memory.lastBreak=elapsed;}
  if(tool==='visit'){
   c.memory.lastLeisure=elapsed;
   const group=p.interaction?.minParticipants>1;
   if(!group||a.game?.ready)c.needs.recreation=reserve(c.needs.recreation+(group?45:22));
  }
  record(a,action,'completed',a.activity);a.action=null;a.pose='idle';a.game=null;
 }
 function decide(a,passing=false){
  let request;try{request=brain(snapshot(a,passing,null,brain===scriptedPlanner));}catch(error){a.retry=4;a.activity='Taking a moment';record(a,{tool:'rest',args:{},reason:'Planner error'},'rejected',String(error));return;}
  if(!request){if(!passing)a.retry=2;return;}
  if(passing){
   if(request.tool!=='walkTo'||request.args?.target===a.action?.target)return;
   // Planner gets a chance to stop only at an already-reached navigation node.
   const old=a.action;a.action=null;const result=execute(a,request);
   if(!result.ok)a.action=old;else record(a,old,'interrupted','Stopped at an accessible prop on the way');
  }else {
   const result=execute(a,request);
   if(!result.ok){
    const target=request.args?.target;
    if(brain===scriptedPlanner&&byId.has(target)){
     a.context.memory.blocked[target]=elapsed+RETRY_DESTINATION;
     record(a,request,'fallback',`Trying a different place: ${result.error}`);
    }
    a.retry=2;
   }
  }
 }
 function advanceWalk(a,dt){
  const rise=Math.min(a.rise,dt);
  a.rise-=rise;
  let budget=(dt-rise)*a.context.personality.pace*weatherPlan(weather).pace;
  while(budget>0&&a.route.length){
   const next=a.route[0],pos=a.context.location.position,d=distance(pos,next.pos),step=Math.min(d,budget);
   // Look both ways: a crossing starts only when no car is near (grok-roads).
   if(next.cross&&!a.crossing){if(crossingGuard&&!crossingGuard(pos,next.pos)){a.waitingToCross=true;break;}a.crossing=true;a.waitingToCross=false;}
   // Level crossings (railway-loop): wait at the barrier while a train is due.
   if(d>.0001&&(railGuard||localWalkGuard)){
    const ahead=[pos[0]+(next.pos[0]-pos[0])*step/d,pos[1]+(next.pos[1]-pos[1])*step/d];
    a.waitingForTrain=!!railGuard&&!railGuard(pos,ahead);
    a.waitingForLocalTraffic=!!localWalkGuard&&!localWalkGuard(pos,ahead);
    if(a.waitingForTrain||a.waitingForLocalTraffic)break;
   }
   if(d>.0001){a.facing=Math.atan2(next.pos[0]-pos[0],next.pos[1]-pos[1]);pos[0]+=(next.pos[0]-pos[0])*step/d;pos[1]+=(next.pos[1]-pos[1])*step/d;a.travelled+=step;}budget-=step;
   if(d<=step){pos[0]=next.pos[0];pos[1]=next.pos[1];a.route.shift();a.crossing=false;if(next.node!==undefined){a.context.location.node=next.node;if(brain!==scriptedPlanner&&a.route.length&&elapsed-a.lastPassing>20){a.lastPassing=elapsed;decide(a,true);}}}else break;
  }
  if(a.action?.tool==='walkTo'&&!a.route.length)arrive(a);
 }
 // Transit (opus-suburb): scheduled vehicles from roads/regional-traffic.js stop
 // with their doors open; commuters waiting at that stop board, riders whose
 // run drops off here alight on the kerb side. Riders are hidden passengers.
 function board(a,v){
  const c=a.context;release(a);a.action=null;a.route=[];a.localPath=[];a.riding=v.id;c.location.place=null;a.pose='idle';
  a.activity=v.kind==='school-bus'?'Riding the school bus':'Riding to work';c.memory.rode={...(c.memory.rode||{}),[v.run]:day};
  record(a,{tool:'visit',args:{target:v.stopAt},reason:'Board the '+(v.kind==='school-bus'?'school bus':'car')},'completed',a.activity);
 }
 function alight(a,v){
  const c=a.context;a.riding=null;c.location.position=[...v.door];c.location.node=v.stopNode;c.location.place=null;c.location.slot=null;a.retry=0;a.activity='Off the bus';
  record(a,{tool:'visit',args:{target:v.stopAt},reason:'Step off at the stop'},'completed',a.activity);
 }
 function updateTransit(){
  if(!transit)return;
  for(const v of transit.vehicles){
   if(v.doorOpen&&v.stopAt){
    // Homebound stops drop each rider at their own stop; the school stop drops everyone.
    const home=v.stops?.find(s=>s.id===v.stopAt)?.home;
    if(v.dropoff?.includes(v.stopAt))for(const a of actors)if(a.riding===v.id&&(!home||v.stopAt===a.context.commute?.stop+'-home'||!a.context.commute))alight(a,v);
    if(v.pickup?.includes(v.stopAt))for(const a of actors){const c=a.context;if(!a.riding&&c.commute&&c.location.place===v.stopAt&&a.action?.tool!=='walkTo')board(a,v);}
   }
   for(const a of actors)if(a.riding===v.id)a.context.location.position=[...v.position];
  }
 }
 /** Commuters walking to, or waiting at, a stop (the bus holds its doors for them). */
 const pendingAt=stop=>actors.filter(a=>!a.riding&&a.context.commute&&(a.action?.tool==='walkTo'?a.action.target===stop:a.context.location.place===stop)).length;
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
  elapsed+=dt;updateGames(dt);updateTransit();
  for(const a of actors){
   const c=a.context;
   tickNeeds(c.needs,a.action,dt);
   if(a.riding)continue;
   if(greetingTick&&hour>=7&&hour<20&&a.greetAfter<=elapsed&&
     (c.needs.recreation<LOW_RECREATION||c.personality.sociability>=.7)){
    const other=actors.find(b=>canTalk(a,b));
    if(other){
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
   if(a.action.sleeping){
    if(inWindow(c.sleep,hour))continue;
    finish(a);a.activity='At home';decide(a);continue;
   }
   if(a.action.tool==='work'){
    if(!inWindow(c.job.shift,hour)){finish(a);decide(a);continue;}
    c.memory.worked+=dt;
   }
   if(a.action.tool==='buy'&&!isOpen(p.hours,hour)){
    record(a,a.action,'fallback','The shop closed; find another meal');
    a.action=null;a.pose='idle';decide(a);continue;
   }
   if(groupActivity&&!a.game?.ready){a.action.waiting+=dt;const coming=p.interaction.slots.filter(s=>reservations.has(slotKey(p.id,s.id))).length>=p.interaction.minParticipants;if(a.action.waiting>(coming?300:130))finish(a);continue;}
   a.action.elapsed+=dt;
   // Group activities end at a shared boundary; participants never leave mid-pitch.
   const cycle=p.interaction?.activity==='baseball'?36:50;
   const done=groupActivity?a.game.elapsed>=Math.ceil(a.action.duration/cycle)*cycle:a.action.elapsed>=a.action.duration;
   if(done)finish(a);
  }
 }
 function setWeather(next){
  if(!isWeather(next)||next===weather)return weather;
  weather=next;
  for(const a of actors){
   a.retry=0;
   if(!a.action||['walkTo','work','buy','sell','payBill'].includes(a.action.tool))continue;
   const p=byId.get(a.action.target),slot=p.interaction?.slots.find(s=>s.id===a.context.location.slot);
   if(allowsWeatherVisit(weather,p,a.index)&&weatherSlotOpen(weather,p,slot))continue;
   record(a,a.action,'interrupted','Weather sent the resident under cover');
   a.action=null;a.pose='idle';a.game=null;a.activity='Heading for cover';
  }
  return weather;
 }
 return {registry,routing,actors,reservations,events,games,execute,snapshot:(a,passing,greetingTarget)=>snapshot(a,passing,greetingTarget),update,get hour(){return hour;},get day(){return day;},get elapsed(){return elapsed;},
  get weather(){return weather;},setWeather,
  travelWeather(a){return travelWeather(weather,a.index,a.action?.tool==='walkTo');},
  walkPace(a){return a.context.personality.pace*weatherPlan(weather).pace;},
  setHour(h){if(Number.isFinite(h))hour=((h%24)+24)%24;},
  setCrossingGuard(fn){crossingGuard=typeof fn==='function'?fn:null;},
  setLocalWalkGuard(fn){localWalkGuard=typeof fn==='function'?fn:null;},
  setRailGuard(fn){railGuard=typeof fn==='function'?fn:null;},
  setTransit(t){transit=t&&Array.isArray(t.vehicles)?t:null;if(transit)transit.pending=pendingAt;},get transit(){return transit;},
  setBrain(next){if(typeof next!=='function')throw new TypeError('Brain must be a function');brain=next;},
  audit(){return {day,hour,elapsed,weather,actors:actors.length,reservations:[...reservations],rejectedMetadata:registry.rejected,events:structuredClone(events),people:actors.map(a=>({id:a.context.id,name:a.context.name,money:a.context.money,needs:{...a.context.needs},action:a.action?.tool||null,target:a.action?.target||null,place:a.context.location.place,slot:a.context.location.slot,arrivals:a.arrivals,...(a.riding?{riding:a.riding}:{}),weatherTravel:travelWeather(weather,a.index,a.action?.tool==='walkTo')}))};}
 };
}
