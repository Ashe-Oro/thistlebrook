import { VILLAGERS } from '../catalog/villagers.js';
import { math as Math } from './math.js';
import { obbFromRect, obbOverlap, pointInArea } from './geometry.js';

// Small idle weight shifts keep people rooted on the walk and avoid moving
// through crowds or architecture. Phases and positions use the compiler RNG.
const SPOTS = [
  [-40,-100,'edo-lantern-lane'], [4,-100,'edo-lantern-lane'],
  [12,-117,'edo-shrine-approach'], [-77,-94,'edo-garden-walk'],
  [44,-100,'edo-lantern-lane'], [-69,-83,'edo-bridge-loop'],
  [-50,-64,'edo-approach'], [-50,-87,'edo-approach'],
  [-16,-100,'edo-lantern-lane'], [20,-128,'edo-precinct-walk'],
  [-24,-100,'edo-lantern-lane'], [-61,-94,'edo-garden-walk'],
];
const at = i => ({x:i.pos[0],z:i.pos[1],rotY:i.rotY});
export function villagerObstructions(i, instances, catalog) {
  const o=obbFromRect(catalog.get(i.id).footprint,at(i));
  return instances.filter(b => ['house','landmark','fence','gate'].includes(b.kind)
    || (b.kind==='prop' && /wall|fence|cart|lantern|barrel|basket|table|boulder|stone$/.test(b.id)))
    .filter(b=>obbOverlap(o,obbFromRect(catalog.get(b.id).footprint,at(b),b.scale||1),0.08));
}
export function spawnVillagers({instances,catalog,rng,area}) {
  for(const [n,v] of VILLAGERS.entries()) {
    const [x,z,street]=SPOTS[n];
    const t0=+rng.float(0,1).toFixed(6);
    const phase=+rng.float(0,Math.PI*2).toFixed(6);
    const candidate={id:v.id,kind:'villager',district:'edo',street,pos:[x,z],rotY:0,scale:1,
      motion:{mode:'idle',street,t0,speed:0,phase}};
    let placed=false;
    for(const [dx,dz] of [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6],[1.2,0],[-1.2,0],[0,1.2],[0,-1.2]]) {
      candidate.pos=[+(x+dx+(t0-.5)*.16).toFixed(4),z+dz];
      if(!pointInArea(area,candidate.pos)||villagerObstructions(candidate,instances,catalog).length)continue;
      instances.push(candidate);placed=true;break;
    }
    if(!placed)throw Error(`No clear Edo villager position for ${v.id}`);
  }
}
