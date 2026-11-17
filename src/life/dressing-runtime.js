// Life-only owned props. The compiler and its instance array are never changed.
import { RESOLVED, instantiate } from '../catalog/loader.js';
import { batchInstances } from '../compiler/batches.js';
import { blockers } from './graph.js';
import { deriveSeed, makeRng } from '../compiler/rng.js';
import { obbFromRect, obbOverlap, toWorldXZ, rectXZ } from '../compiler/geometry.js';

const pools = {
 market: ['cv-flower-cart','aut-apple-crate','aut-bushel-basket','farm-produce-crates','aut-mums-in-pot','cv-crate','aut-gourd-squash-cluster','cv-bench'],
 yard: ['aut-mums-in-pot','cv-plant-potted','cv-flower-bed','nat-log-bench','aut-garden-cart','cv-firewood-stack','aut-bushel-basket','aut-ornamental-grass'],
 street: ['aut-mums-in-pot','cv-bench','cv-plant-potted','aut-harvest-lantern','aut-apple-crate'],
};
const boxFor=(i,catalog)=>obbFromRect(rectXZ(catalog.get(i.id).bounds),{x:i.pos[0],z:i.pos[1],rotY:i.rotY||0},i.scale||1);
export function dressingReservations(town,catalog=RESOLVED){
 const boxes=blockers(town,catalog);
 for(const i of town.instances.filter(i=>['house','landmark'].includes(i.kind)))boxes.push(boxFor(i,catalog));
 for(const i of town.instances){
  if(['house','landmark','well','fence','villager','ring'].includes(i.kind))continue;
  if(i.kind==='path'){
   boxes.push(obbFromRect({min:[-(i.width||i.params?.width||2.3)/2,-(i.length||i.params?.length||0)/2],max:[(i.width||i.params?.width||2.3)/2,(i.length||i.params?.length||0)/2]},{x:i.pos[0],z:i.pos[1],rotY:i.rotY}));
  }else if(catalog.has(i.id))boxes.push(boxFor(i,catalog));
 }
 // Protect every navigable edge, including the plaza ring and social anchors.
 const g=town.life.graph;
 for(let a=0;a<g.nodes.length;a++)for(const b of g.edges[a])if(b>a){const p=g.nodes[a].pos,q=g.nodes[b].pos,len=Math.hypot(q[0]-p[0],q[1]-p[1]);boxes.push(obbFromRect({min:[-.85,-len/2],max:[.85,len/2]},{x:(p[0]+q[0])/2,z:(p[1]+q[1])/2,rotY:Math.atan2(q[0]-p[0],q[1]-p[1])}));}
 return boxes;
}
export function auditDressing(town,rows,catalog=RESOLVED){
 const reserved=dressingReservations(town,catalog),accepted=[],violations=[];
 for(const [index,i] of rows.entries()){const box=boxFor(i,catalog);if(reserved.some(b=>obbOverlap(box,b,.18)))violations.push({index,id:i.id,type:'reserved'});if(accepted.some(b=>obbOverlap(box,b,.18)))violations.push({index,id:i.id,type:'dressing'});accepted.push(box);}
 return {count:rows.length,violations};
}
export function planDressing(town,catalog=RESOLVED){
 if(!town.life)return [];
 const rng=makeRng(deriveSeed(town.seed,0x415254)),reserved=dressingReservations(town,catalog),rows=[];
 function attempt(id,pos,rotY,zone){
  const e=catalog.get(id);if(!e)return;
  // Keep pack-native dimensions except oversized carts/benches; no giant props.
  const span=Math.max(e.bounds.max[0]-e.bounds.min[0],e.bounds.max[2]-e.bounds.min[2]);
  const scale=Math.min(1,(id.includes('cart')?2.5:id.includes('bench')?2.2:1.25)/span);
  const i={id,pos,rotY,scale,zone},box=boxFor(i,catalog);
  if(reserved.some(b=>obbOverlap(box,b,.22)))return;
  reserved.push(box);rows.push(i);return true;
 }
 for(const b of town.instances.filter(i=>['house','landmark'].includes(i.kind)&&i.district!=='edo')){
  const f=catalog.get(b.id).footprint,zone=b.kind==='house'?'yard':'market',pool=pools[zone];let placed=0;
  for(let n=0;n<100&&placed<(zone==='market'?7:4);n++){
   const side=n%4,offset=rng.float(.65,2.6);let x=rng.float(f.min[0]-1,f.max[0]+1),z=rng.float(f.min[1]-1,f.max[1]+1);
   if(side===0)z=f.max[1]+offset;if(side===1)x=f.max[0]+offset;if(side===2)x=f.min[0]-offset;if(side===3)z=f.min[1]-offset;
   const pos=toWorldXZ([x,z],{x:b.pos[0],z:b.pos[1],rotY:b.rotY});
   if(attempt(rng.pick(pool),pos,b.rotY+(side===1?-Math.PI/2:side===2?Math.PI/2:0),zone))placed++;
  }
 }
 for(const p of town.instances.filter(i=>i.kind==='path'&&(i.streetId||i.street))){
  const length=p.length||p.params?.length||0,width=p.width||p.params?.width||2.3;
  for(let n=0;n<Math.floor(length/5);n++)for(const side of [-1,1]){
   const pos=toWorldXZ([side*(width/2+1.1),-length/2+(n+.5)*5],{x:p.pos[0],z:p.pos[1],rotY:p.rotY});attempt(rng.pick(pools.street),pos,p.rotY+(side>0?-Math.PI/2:Math.PI/2),'street');
  }
 }
 return rows;
}
export async function createDressing(stage,town){
 const snapshot=JSON.stringify(town),rows=planDressing(town),audit=auditDressing(town,rows);
 if(audit.violations.length)throw Error('Art dressing clearance failed');
 // Reuse the town's instancing path: density adds instances, not a draw call
 // per basket. Loader toon materials and inverted hulls survive batching.
 const groups=new Map();for(const i of rows){if(!groups.has(i.id))groups.set(i.id,[]);groups.get(i.id).push(i);}
 const objects=await Promise.all([...groups].map(async([id,instances])=>{
  const template=await instantiate(id);template.position.y=-RESOLVED.get(id).bounds.min[1];
  const batch=batchInstances(template,instances);batch.userData.artDressing=instances;return batch;
 }));
 stage.scene.add(...objects);
 if(JSON.stringify(town)!==snapshot)throw Error('Art dressing mutated compiled town');
 return {rows,audit,objects};
}
