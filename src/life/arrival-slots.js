import { blockers, blocked, distance } from './graph.js';
import { obbFromRect, pointInArea } from '../compiler/geometry.js';
import { nearestEntryNode } from '../world/registry.js';

// Runtime-only frontage slots. Registry entries remain the source of identity
// and navigation; the compiler and serialized life-off graph are untouched.
export function createArrivalSlots(town, catalog, placeTargets) {
 const graph=town.life.graph, solids=blockers(town,catalog), slots=new Map(), used=[];
 for(const place of town.registry.places.filter(p=>p.building)){
  const inst=town.instances[place.instanceIndex],entry=catalog.get(place.catalogId);
  if(entry?.footprint&&!['house','landmark','well'].includes(inst.kind))solids.push(obbFromRect(entry.footprint,{x:inst.pos[0],z:inst.pos[1],rotY:inst.rotY||0},inst.scale??1));
 }
 // The extra .03m clearance exceeds half the .05m sample interval, so a
 // narrow fence cannot hide between samples on these short approach edges.
 const clear=(a,b)=>{const steps=Math.max(1,Math.ceil(distance(a,b)/.05));
  for(let n=0;n<=steps;n++)if(blocked(a.map((v,k)=>v+(b[k]-v)*n/steps),solids,.33))return false;
  return true;
 };
 for(const place of [...town.registry.places].sort((a,b)=>a.id.localeCompare(b.id))){
  const ids=Object.keys(placeTargets).filter(id=>Object.values(placeTargets[id]).includes(place.id)).sort();
  if(!ids.length)continue;
  const anchor=nearestEntryNode(town.registry,graph,place.id);if(anchor<0)continue;
  const origin=graph.nodes[anchor].pos, facing=place.points.find(p=>p.node===anchor)?.facing??[0,1];
  const candidates=[];
  // A compact staggered frontage, about one resident's width per slot. All
  // participants fit within speech range even at the twelve-person supper.
  for(let row=-3;row<=4;row++)for(let col=-4;col<=4;col++){
   const side=col+(Math.abs(row)%2)*.5,forward=row*.87;
   const pos=[origin[0]+facing[1]*side+facing[0]*forward,origin[1]-facing[0]*side+facing[1]*forward];
   if(distance(pos,origin)>3||!pointInArea(town.area,pos,.4)||!clear(origin,pos))continue;
   candidates.push(pos);
  }
  candidates.sort((a,b)=>distance(a,origin)-distance(b,origin)||a[0]-b[0]||a[1]-b[1]);
  const chosen=[];
  for(const id of ids){
   const pos=candidates.find(p=>used.every(u=>distance(p,u)>=.95)&&chosen.every(u=>distance(p,u)<3.95));
   if(!pos)throw Error(`No safe arrival slot: ${place.id} ${id}`);
   used.push(pos);chosen.push(pos);
   const node=graph.nodes.length;
   graph.nodes.push({pos,street:'life-arrival',placeId:place.id,residentId:id,entryNode:anchor});
   graph.edges.push([anchor]);graph.edges[anchor].push(node);graph.connected.push(node);
   slots.set(`${id}:${place.id}`,node);
  }
 }
 for(const event of town.life.reservations)event.nodes=event.ids.map((id,k)=>{
  const place=placeTargets[id]?.[`event:${event.key}:${k}`]??placeTargets[id]?.[event.target];
  return slots.get(`${id}:${place}`)??event.nodes[k];
 });
 return (id,place,node)=>slots.get(`${id}:${place}`)??node;
}
