// Runtime-only plan: never mutates the compiled town or its life-off JSON.
import { blockers, blocked } from './graph.js';
import { obbFromRect } from '../compiler/geometry.js';
const doorSolids=(town,catalog)=>[...blockers(town,catalog),...town.instances.filter(i=>i.kind==='gate').map(i=>obbFromRect({min:[-(i.width||2)/2,-.12],max:[(i.width||2)/2,.12]},{x:i.pos[0],z:i.pos[1],rotY:i.rotY}))];
export const INTERIOR_SPACES = [
 { id:'bakery', building:'cv-bakery', name:'The Flour & Fern', subtitle:'Village bakery · bread fresh from the hearth', accent:'#a34c32' },
 { id:'inn', building:'cv-tavern', name:'The Copper Kettle', subtitle:'Village inn · a table by the fire', accent:'#47796f' },
 { id:'store', building:'cv-store', name:'Willowmere Provisions', subtitle:'General store · books, baskets & good things', accent:'#71834b' },
 { id:'smithy', building:'cv-blacksmith', name:'Bram’s Workshop', subtitle:'Smithy · tools, timber & a working hearth', accent:'#626e79' },
];
export function createInteriorPlan(town,catalog){
 if(!town.life)return [];
 const solids=doorSolids(town,catalog);
 return INTERIOR_SPACES.flatMap((space,index)=>{
  const host=town.instances.find(i=>i.id===space.building);if(!host)return [];
  const entry=catalog.get(host.id),a=host.rotY||0,s=host.scale||1;
  const world=(x,z)=>[host.pos[0]+s*(x*Math.cos(a)+z*Math.sin(a)),host.pos[1]+s*(-x*Math.sin(a)+z*Math.cos(a))];
  const door=world(entry.door.pos[0],entry.door.pos[2]);
  let trigger;
  // The footprint includes the doorstep: put the action point beyond it,
  // along the actual door normal, rather than teleporting into a collider.
  for(let offset=.5;offset<=4;offset+=.1){const p=world(entry.door.pos[0],entry.footprint.max[1]+offset);if(!blocked(p,solids,.46)){trigger=p;break;}}
  if(!trigger)throw Error(`life-interiors: no safe doorstep for ${space.id}`);
  return [{...space,door,trigger,rotation:a,origin:[320+index*30,0],exit:[0,4.25],spawn:[0,2.1],counter:[0,-.35],lanterns:[[-4.7,1.8],[4.7,1.8]]}];
 });
}
export function checkInteriorPlan(plan,town,catalog){
 const failures=[],solids=doorSolids(town,catalog);
 for(const space of INTERIOR_SPACES){if(!town.instances.some(i=>i.id===space.building))continue;const room=plan.find(r=>r.id===space.id);if(!room){failures.push(`missing ${space.id}`);continue;}
  if(!Array.isArray(room.trigger)||room.trigger.length!==2||!room.trigger.every(Number.isFinite)||blocked(room.trigger,solids,.4))failures.push(`${space.id} trigger inside wall`);
  if(room.lanterns?.length<2)failures.push(`${space.id} missing fixtures`);
 }
 return {name:'life-interiors',ok:failures.length===0,failures};
}
