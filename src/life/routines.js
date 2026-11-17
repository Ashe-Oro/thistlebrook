import { DAILY, PROFILES, OVERRIDES, MEETINGS, VARIATIONS, AMBIENT, PLACE_ALIASES, ACTION_LINES } from './data/routines.js';
import { distance } from './graph.js';
import { deriveSeed, makeRng } from '../compiler/rng.js';
import { resolveDestination } from './destinations.js';
export function buildRoutines(town,calendar){
 const residents=town.instances.filter(p=>p.id.startsWith('townsfolk-'));
 const original=structuredClone(town.life.reservations),destinations={},schedules={},placeTargets={};
 const work=role=>residents.find(p=>p.id===`townsfolk-${role}`).workplace.node;
 const occupied={tavern:[],market:[],plaza:[]};
 const spaced=(kind,node)=>{const graph=town.life.graph,used=occupied[kind];const result=graph.connected.filter(n=>used.every(u=>distance(graph.nodes[u].pos,graph.nodes[n].pos)>1.1)).sort((a,b)=>distance(graph.nodes[a].pos,graph.nodes[node].pos)-distance(graph.nodes[b].pos,graph.nodes[node].pos))[0]??node;used.push(result);return result;};
 const plaza=original.find(e=>e.type==='chat').nodes;
 for(const [index,p] of residents.entries()){
  const role=p.id.slice(10),profile=PROFILES[role],rng=makeRng(deriveSeed(town.seed,8200+index));
  const nodes=destinations[p.id]={home:p.home.node,work:p.workplace.node,tavern:work('innkeeper'),market:original.find(e=>e.type==='shop').nodes[0],plaza:p.schedule.find(s=>s.activity==='plaza')?.node??plaza[index%2]};
  const targets=placeTargets[p.id]={};
  for(const [key,assignment] of [['home',p.home],['work',p.workplace]]){
   const place=town.registry?.places?.find(place=>place.catalogId===assignment.id&&place.lot===assignment.lot);
   if(place)targets[key]=place.id;
  }
  for(const [owner,...aliases] of PLACE_ALIASES)for(const alias of aliases){nodes[alias]??=work(owner);targets[alias]=aliases[1];}
  for(const kind of ['tavern','market','plaza'])nodes[kind]=spaced(kind,nodes[kind]);
  const rows=new Map(DAILY.map(r=>[r[0],r]));for(const r of OVERRIDES[role]||[])rows.set(r[0],r);
  for(const v of VARIATIONS)if(v.weekdays?.includes(calendar.weekday)||v.weather?.includes(calendar.weather))rows.set(v.hour,[v.hour,v.place,v.tool,v.activity]);
  // A seeded afternoon errand gives each resident a distinct pause.
  const errand=15+rng.int(0,3)/10;rows.set(errand,[errand,'market','buy','pick up supplies']);
  let beats=[...rows.values()].map(([hour,place,tool,activity])=>({hour,place,tool,activity,text:tool==='work'?profile[1]:rng.pick(ACTION_LINES[tool]??AMBIENT[calendar.weather])}));
  const insert=(event,k,partner,text)=>{
   const resume={...beats.filter(s=>s.hour<=event.end).sort((a,b)=>a.hour-b.hour).at(-1),hour:event.end};
   const key=`event:${event.key}:${k}`;nodes[key]=event.nodes[k];
   targets[key]=event.target;
   beats=beats.filter(s=>s.hour<event.start||s.hour>=event.end);
   beats.push({hour:event.start,place:key,tool:partner?'talkTo':({shop:'buy',eat:'eat',play:'visit'}[event.type]??'visit'),activity:event.type,partner,text},resume);
  };
  for(const e of original){const k=e.ids.indexOf(p.id);if(k>=0)insert(e,k,e.ids.length>1?e.ids[(k+1)%e.ids.length]:null,e.ids.length>1?profile[4]:e.type==='play'?'Catch! Your turn!':rng.pick(ACTION_LINES[e.type==='shop'?'buy':e.type]??AMBIENT[calendar.weather]));}
  for(const [n,m] of MEETINGS.entries()){const k=m.roles.indexOf(role);if(k<0)continue;
   const e={key:`routine-meeting-${n}`,start:m.hour,end:m.end,nodes:plaza,ids:m.roles.map(r=>`townsfolk-${r}`),type:m.type,target:m.place};
   insert(e,k,e.ids[1-k],profile[4]);
   if(k===0)town.life.reservations.push(e);
  }
  schedules[p.id]=beats.sort((a,b)=>a.hour-b.hour).map((s,n)=>({...s,key:`${p.id}:${n}`}));
  // Bind symbolic routines once, from their intended locations, so repeated seeks
  // cannot choose a different nearby place based on the previous seek's position.
  if(town.registry?.places?.length)for(const key of new Set(['home','work',...schedules[p.id].map(beat=>beat.place)])){
   const node=nodes[key];
   const destination=resolveDestination(targets[key]??key,{id:p.id,location:town.life.graph.nodes[node].pos},{registry:town.registry,graph:town.life.graph});
   if(!destination)throw Error(`Unreachable routine destination: ${p.id} ${key}`);
   targets[key]=destination.place;nodes[key]=destination.node;
  }
 }
 if(town.registry?.places?.length)for(const event of town.life.reservations){
  event.nodes=event.ids.map((id,k)=>destinations[id][`event:${event.key}:${k}`]);
 }
 return {destinations,schedules,placeTargets};
}
