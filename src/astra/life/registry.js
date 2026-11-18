import { cafeFrontage, fountainBenches, playReservation } from './animation-places.js';
import { riverZ, pointInTown } from '../../compiler/astra.js';

import {TOOLS,ACTIVITIES,ANIMATIONS,distance,isOpen,interactionErrors} from '../registry/interaction-schema.js';
export {TOOLS,ACTIVITIES,ANIMATIONS,distance,isOpen,interactionErrors};
const point = p => Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);

// Exact AABB segment test. Bench spurs are accepted only with visible clearance;
// no routing through buildings, tree trunks, other props, water or venue fences.
function intersects(a,b,box,pad=.32){
 let lo=0,hi=1;
 for(let k=0;k<2;k++){
  const d=b[k]-a[k],min=box.min[k]-pad,max=box.max[k]+pad;
  if(Math.abs(d)<1e-8){if(a[k]<min||a[k]>max)return false;}
  else {const u=(min-a[k])/d,v=(max-a[k])/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return false;}
 }
 return true;
}
export function clearPropApproach(town,a,b,except=null){
 const boxes=[...town.buildings.map(v=>v.box),...town.venues.map(v=>v.box),...(town.trees||[]).map(t=>({min:[t.pos[0]-.45,t.pos[1]-.45],max:[t.pos[0]+.45,t.pos[1]+.45]})),...(town.props||[]).filter(p=>p!==except).map(p=>({min:[p.pos[0]-.55,p.pos[1]-.55],max:[p.pos[0]+.55,p.pos[1]+.55]}))];
 if(boxes.some(box=>intersects(a,b,box)))return false;
 for(let n=0;n<=Math.ceil(distance(a,b)/.3);n++){
  const u=n/Math.max(1,Math.ceil(distance(a,b)/.3)),p=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
  if(!pointInTown(p,town)||Math.abs(p[1]-riverZ(p[0]))<3.3)return false;
 }
 return true;
}
const seat=(id,position,facing,approach=[],role=undefined)=>({id,kind:'seat',position,facing,seatHeight:.49,animation:'sit',approach, ...(role?{role}: {})});

/** Astra adapter. The public registry job can pass world-space records via extraPlaces
 * or town.registry.places, or attach interaction to any compiled prop.
 * This never mutates town, its graph, or catalog entries. */
export function buildLifeRegistry(town,extraPlaces=[]) {
 const places=town.buildings.map(b=>({id:b.key,name:b.name,node:b.node,pos:[...town.nodes[b.node]],kind:b.kind,district:b.district,capabilities:['walkTo','visit','rest','eat',...((b.kind==='home'&&b.shop!=='grocer')?['work']:['work','buy','sell','payBill'])],hours:[0,24]}));
 places.push(...town.venues.map(v=>({id:v.id,name:v.name,node:v.node,pos:[...town.nodes[v.node]],kind:v.type,...(v.district?{district:v.district}:{}),capabilities:['walkTo','visit','work','rest'],hours:v.id==='clinic'?[0,24]:[6,22]})));
 for(const spot of town.workstations||[]){const venue=town.venues.find(v=>v.id===spot.venue);places.push({id:'workspot:'+spot.name,name:venue.name,node:spot.node,pos:[...town.nodes[spot.node]],kind:'workplace',district:'works',capabilities:['walkTo','visit','work','rest'],hours:[7,17]});}
 const fountain=town.venues.find(v=>v.type==='fountain');
 if(fountain){
  const [x,z]=fountain.pos;
  places.push({id:'life:picnic',name:'Fountain picnic table',kind:'prop',furnishing:'picnic',pos:[x,z-5],node:fountain.node,capabilities:['walkTo','eat','rest','visit'],hours:[6,22],interaction:{version:1,activity:'picnic',label:'Lunch by the fountain',tools:['eat','rest','visit'],duration:32,minParticipants:1,entryNode:fountain.node,approach:[[x+3.3,z+5],[x+3.3,z-5]],slots:[seat('north',[x-.6,z-6],0,[[x+1.7,z-6]]),seat('south',[x+.6,z-4],Math.PI,[[x+1.7,z-4]])],hours:[6,22]}});
  places.push({id:'life:chess',name:'Fountain chess table',kind:'prop',furnishing:'chess',pos:[x-3.5,z+5.3],node:fountain.node,capabilities:['walkTo','visit','rest'],hours:[7,22],interaction:{version:1,activity:'chess',label:'A game of chess',tools:['visit','rest'],duration:50,minParticipants:2,entryNode:fountain.node,approach:[[x-1.6,z+5.3]],slots:[seat('white',[x-3.5,z+6.25],Math.PI,[[x-1.6,z+6.25]],'white'),seat('black',[x-3.5,z+4.35],0,[[x-1.6,z+4.35]],'black')],hours:[7,22]}});
 }
 const field=town.venues.find(v=>v.type==='baseball');
 if(field){
  const [x,z]=field.pos,home=[x,z+11],mound=[x,z+3],bases=[home,[x+8,z+3],[x,z-5],[x-8,z+3]];
  const p=places.find(p=>p.id===field.id);
  // Approach around the backstop at z+12.4, then enter on the first-base side.
  p.interaction={version:1,activity:'baseball',label:'Owls batting practice',tools:['visit'],duration:108,minParticipants:3,entryNode:field.node,approach:[[x+5,z+15],[x+5,z+11]],slots:[
   {id:'batter',role:'batter',kind:'player',position:[x+1,z+10.6],facing:-Math.PI/2,animation:'bat',approach:[]},
   {id:'pitcher',role:'pitcher',kind:'player',position:mound,facing:0,animation:'pitch',approach:[[x+4,z+5]]},
   {id:'fielder',role:'fielder',kind:'player',position:[x+8,z-6],facing:Math.PI,animation:'field',approach:[[x+9,z+3]]}
  ],hours:[8,20],game:{bases,mound,field:[x+9,z-9]}};p.hours=[8,20];
 }
 // Existing kit benches: correct rotated seat poses, with conservative safe spurs.
 for(const [n,prop] of (town.props||[]).entries()){
  if(prop.interaction)continue;
  if(prop.id!=='cv-bench')continue;
  const yaw=prop.rot||0,front=[Math.sin(yaw),Math.cos(yaw)],scale=prop.scale||1;
  const entry=[prop.pos[0]+front[0]*1.3,prop.pos[1]+front[1]*1.3];
  const nodes=town.nodes.map((p,i)=>({i,p,d:distance(p,entry)})).filter(v=>v.d<8&&town.edges[v.i].length>1).sort((a,b)=>a.d-b.d);
  const node=nodes.find(v=>clearPropApproach(town,v.p,entry,prop));if(!node)continue;
  const slots=[-.48,.48].map((side,i)=>{
   const pos=[prop.pos[0]+Math.cos(yaw)*side*scale+front[0]*.12,prop.pos[1]-Math.sin(yaw)*side*scale+front[1]*.12];
   return {...seat(String(i),pos,yaw,[[pos[0]+front[0]*.75,pos[1]+front[1]*.75]]),seatHeight:.49*scale};
  });
  places.push({id:`life:bench:${n}`,name:'Wayside bench',node:node.i,pos:[...prop.pos],kind:'prop',capabilities:['walkTo','rest','eat','visit'],hours:[0,24],interaction:{version:1,activity:'sit',label:'A little rest',tools:['rest','eat','visit'],duration:24,minParticipants:1,entryNode:node.i,approach:[entry],slots,hours:[0,24]}});
 }
 const catalogPlaces=(town.registry?[]:town.interactions||[]).filter(s=>s.enabled).map(s=>{
  const scene=town.catalogScenes.find(p=>p.id===s.scene),seated=s.activity==='sit',activity=seated?'sit':s.activity==='eat'?'picnic':'browse';
  const label=({'warm-hands':'Warming hands at the campfire',sort:'Sorting the harvest','play-music':'Playing the taiko drum',browse:'Browsing the stall',eat:'Tea in the lantern court',sit:'A little rest'})[s.activity]||'A moment outdoors';
  const tools=seated?['rest','eat','visit']:s.activity==='eat'?['eat','rest','visit']:['visit'];
  return {id:'catalog:'+s.id,name:scene.name+' · '+label,district:scene.district,pos:[s.position[0],s.position[2]],interaction:{version:1,activity,label,tools,duration:32,minParticipants:1,entryNode:s.node,approach:[],slots:[{id:'place',kind:seated?'seat':'standing',position:[s.position[0],s.position[2]],facing:s.facing,...(seated?{seatHeight:s.position[1]}:{}),animation:seated?'sit':s.activity==='eat'?'eat':['sort','play-music','warm-hands'].includes(s.activity)?'work':'idle',approach:[]}],hours:[6,22]}};
 });
 const incoming=[...catalogPlaces,...(town.registry?.places||[]),...extraPlaces,...(town.props||[]).filter(p=>p.interaction).map((p,n)=>({...p,id:p.key||`life:tagged:${n}`,name:p.name||p.id}))];
 const rejected=[];
 places.push(...fountainBenches(town));
 const play=playReservation(town);if(play)places.push(play);
 for(const record of incoming){
  // District controllers own these leases; town residents may visit the venue entrance.
  if(record?.interaction?.controller&&record.interaction.controller!=='life')continue;
  if(!record?.interaction){
   if(record&&Number.isInteger(record.node)&&record.capabilities?.includes('walkTo')&&!['district','infrastructure','vegetation','effect'].includes(record.type)){
    const index=places.findIndex(p=>p.id===record.id),copy={...record,pos:[...town.nodes[record.node]]};
    if(index<0)places.push(copy);else places[index]={...places[index],...copy,capabilities:[...new Set([...places[index].capabilities,...copy.capabilities])]};
   }continue;
  }
  if(typeof record.id!=='string'||!record.id){rejected.push({id:null,errors:['missing unique place ID']});continue;}
  const errors=interactionErrors(record.interaction,town);
  if(errors.length){rejected.push({id:record.id,errors});continue;}
  const i=record.interaction,index=places.findIndex(p=>p.id===record.id);
  const copy={...(record.furnishing?{furnishing:record.furnishing}:{}),id:record.id,name:record.name||record.id,kind:record.kind||record.type||'prop',...(record.district?{district:record.district}:{}),pos:[...(point(record.pos)?record.pos:i.slots[0].position)],node:i.entryNode,hours:[...i.hours],capabilities:['walkTo',...i.tools],interaction:structuredClone(i)};
  if(index<0)places.push(copy);else places[index]=copy;
 }
 const cafe=town.buildings.find(b=>b.name==='Corner Cup Café');
 const counter=places.find(p=>p.id===cafe?.key);
 if(counter){counter.interaction=cafeFrontage(cafe);counter.points=['counter'];}
 return {version:1,places,rejected};
}
