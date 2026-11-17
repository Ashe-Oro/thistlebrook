import {getAsset} from '../../catalog/library/index.js';

/** Undo the library normalization, then apply the legacy loader/pivot transform.
 * A model affordance remains a candidate until a public approach is verified.
 */
export function assetInteractionPoints(p,catalog,asset){
 // Vehicle mounting needs its own authored anchors; keep library templates local.
 if(asset.category==='vehicle'||/rowboat|canoe$/.test(p.asset))return [];
 const entry=catalog.get(p.asset),sourceScale=entry?.scale||1,scale=p.scale||1,yaw=p.rot||0;
 const directOffset=entry?.yOffset||(!entry&&p.asset.startsWith('nature/')?-asset.geometry.bounds.min[1]:0);
 const transform=point=>{
  const source=point.map((v,k)=>v/asset.placement.scale+asset.placement.origin[k]);
  const x=source[0]*sourceScale*scale,z=source[2]*sourceScale*scale;
  return [p.pos[0]+x*Math.cos(yaw)+z*Math.sin(yaw),(p.elevation||0)+(source[1]+directOffset)*sourceScale*scale,p.pos[1]-x*Math.sin(yaw)+z*Math.cos(yaw)];
 };
 return asset.interactions.map(s=>{
  const pose=transform(s.position),approach=transform(s.approach),seated=s.activity==='sit';
  return {id:s.id,kind:seated?'seat':'standing',position:[pose[0],pose[2]],facing:s.facing+yaw,...(seated?{seatHeight:pose[1]}:{height:pose[1]}),animation:seated?'sit':s.activity==='eat'?'eat':'idle',approach:[[approach[0],approach[2]]],candidate:true,enabled:false,provenance:s.provenance,capacity:s.capacity,clearance:s.clearance*scale,sourceActivity:s.activity};
 });
}
export function cozyBenchSeats(p){
 return assetInteractionPoints({...p,asset:'cv-bench'},new Map([['cv-bench',{scale:1.6}]]),getAsset('cozy-village/bench_01'));
}
