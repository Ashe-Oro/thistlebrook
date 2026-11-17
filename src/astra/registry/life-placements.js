import {buildLifeRegistry} from '../life/registry.js';
import {createContexts} from '../life/profiles.js';
// The executor and inspection API share IDs for workstations and authored props.
export function includeLifePlacements(town){
 const life=buildLifeRegistry(town),known=new Map(town.registry.places.map(p=>[p.id,p]));
 for(const p of life.places){
  const existing=known.get(p.id);
  if(existing){if(existing.interaction?.controller)continue;existing.capabilities=[...p.capabilities];existing.hours=[...p.hours];continue;}
  const district=p.district||town.districts.reduce((a,b)=>Math.hypot(a.center[0]-p.pos[0],a.center[1]-p.pos[1])<Math.hypot(b.center[0]-p.pos[0],b.center[1]-p.pos[1])?a:b).id;
  const r={...p,type:p.kind==='workplace'?'area':'prop',district,owner:'Astra town',occupants:[],entryPoints:[{node:p.node,position:[...town.nodes[p.node]],approach:p.interaction?.approach||[]}],interactionPoints:p.interaction?.slots||[],activity:{enabled:!!p.interaction,activity:p.interaction?.activity||'work',animation:p.interaction?.slots[0]?.animation||'idle',slots:p.interaction?.slots||[],reason:p.interaction?undefined:'An assigned workplace on the public graph'}};
  town.registry.places.push(r);known.set(r.id,r);
 }
 for(const p of town.registry.places)if(p.type==='building')p.occupants=[];
 for(const c of createContexts(town,life)){const home=known.get(c.assets.home);if(home)home.occupants.push(c.name);}
 return town.registry;
}
