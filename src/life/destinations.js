import { findPlace, getPlace, nearestEntryNode } from '../world/registry.js';
import { nearestNode, route } from './graph.js';
export function resolveDestination(place,ctx,world){
 const registry=world.registry,graph=world.graph;
 place=typeof place==='string'?(world.placeTargets?.[ctx.id]?.[place]??place):place;
 const query=typeof place==='string'?{type:place}:place;
 const exact=getPlace(registry,typeof place==='string'?place:place.id);
 const candidates=exact?[exact]:[
  ...(typeof place==='string'?(registry?.places??[]).filter(p=>p.catalogId===place):[]),
  ...findPlace(registry,{...query,near:ctx.location,openAt:ctx.hour}),
  ...(typeof place==='string'?findPlace(registry,{name:place,near:ctx.location}):[]),
 ];
 const start=nearestNode(graph,ctx.location);
 for(const found of candidates){
  const entry=nearestEntryNode(registry,graph,found.id);
  const node=entry<0?entry:(world.arrivalNode?.(ctx.id,found.id,entry)??entry); // WORKTREE-HOOK life-queue
  if(!graph?.connected.includes(node))continue;
  const path=route(graph,start,node);
  if(path.at(-1)===node)return {node,path,place:found.id};
 }
 // Graph-only callers can supply symbolic nodes; a real registry never falls back.
 if(!registry?.places?.length){
  const node=world.destinations?.[ctx.id]?.[typeof place==='string'?place:place.id??place.name??place.type]??-1;
  if(graph?.connected.includes(node)){
   const path=route(graph,start,node);
   if(path.at(-1)===node)return {node,path,place};
  }
 }
 return null;
}
