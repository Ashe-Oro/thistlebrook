import {makeRng} from '../../compiler/rng.js';
export const OUTSKIRTS_LOGS=[[-61,68],[-61,87],[-35,114],[31,99]];
// Give scenery a separate deterministic stream; water animation cannot change
// a model's registry identity by consuming another random number first.
export function outskirtsLogPlacements(seed){
 const rng=makeRng(seed+1943);
 return OUTSKIRTS_LOGS.map(pos=>({id:'nat-fallen-log-mossy',pos,scale:.7,rot:rng.float()*6}));
}
export function seedModelPlacements(town,catalog){
 if(!town.outskirts)return [];
 return [...town.outskirts.trees,...outskirtsLogPlacements(town.seed)].map(t=>{
  const b=catalog.get(t.id).bounds,w=b.max[0]-b.min[0],d=b.max[2]-b.min[2],c=Math.abs(Math.cos(t.rot)),s=Math.abs(Math.sin(t.rot));
  return {asset:t.id,district:'outskirts',pos:t.pos,scale:t.scale,rot:Math.atan2(Math.sin(t.rot),Math.cos(t.rot)),elevation:0,size:[(c*w+s*d)*t.scale,(b.max[1]-b.min[1])*t.scale,(s*w+c*d)*t.scale],path:catalog.get(t.id).path};
 });
}
