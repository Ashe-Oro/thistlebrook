import {PARK_ACTIVITIES,PARK_ORIGIN,PARK_NODES} from '../themepark-plan.js';

// Pinecrest activity points: riding, queueing, eating, playing midway games and
// watching. The same records drive the park's own crowd (themepark-guests.js);
// here they become executable, reservable registry places for town residents.
const TOOLS={ride:['visit'],queue:['visit'],play:['visit'],watch:['rest','visit'],picnic:['eat','rest','visit']};
const PARK_HOURS=[9,23];
const world=p=>[+(p[0]+PARK_ORIGIN[0]).toFixed(3),+(p[1]+PARK_ORIGIN[1]).toFixed(3)];
export function parkActivityRecords(town){
 const nodeFor=key=>{const p=world(PARK_NODES[key]),i=town.nodes.findIndex(n=>Math.hypot(n[0]-p[0],n[1]-p[1])<.02);if(i<0)throw Error('Pinecrest node is not on the world graph: '+key);return i;};
 return PARK_ACTIVITIES.map(a=>{
  const node=nodeFor(a.node),seated=a.kind==='seat';
  const slots=a.slots.map((s,k)=>({id:String(k),kind:seated?'seat':'standing',position:world(s.position),facing:s.facing,...(seated?{seatHeight:a.seatHeight}:{}),animation:a.animation,approach:(s.approach||[]).map(world),...(s.seat!==undefined?{seat:s.seat}:{})}));
  const tools=a.activity==='watch'&&!seated?['visit']:TOOLS[a.activity];
  const interaction={version:1,activity:a.activity,label:a.label,tools,duration:a.duration,minParticipants:1,entryNode:node,approach:[],slots,hours:[...PARK_HOURS],...(a.ride?{ride:a.ride}:{}),...(a.hidden?{hidden:true}:{})};
  return {id:a.id,name:a.name,type:'area',kind:'pinecrest-'+a.activity,district:'themepark',owner:'pinecrest',occupants:[],hours:[...PARK_HOURS],capabilities:['walkTo',...tools],pos:slots[0].position,node,entryPoints:[{node,position:[...town.nodes[node]],approach:[]}],interactionPoints:slots,interaction,activity:{enabled:true,activity:a.activity,animation:a.animation,slots},...(a.ride?{ride:a.ride}:{}),...(a.stall?{stall:a.stall}:{})};
 });
}
export function addParkActivities(town){
 const records=parkActivityRecords(town);
 town.registry.places.push(...records);
 return records;
}
