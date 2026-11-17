import {COAST_BLOCKS,COAST_UMBRELLAS} from '../coast-plan.js';
export const furnitureId=(district,kind,x,y,z)=>`furniture:${district}:${kind}:${[x,y,z].map(n=>+n.toFixed(3)).join(':')}`;
export function districtFurniture(town){
 const rows=[],region=id=>town.regions.find(r=>r.id===id)?.offset||[0,0];
 const add=(district,kind,x,y,z,size,slots=[])=>{const o=region(district);rows.push({id:furnitureId(district,kind,x,y,z),name:kind.replaceAll('-',' ')+' · '+district,district,pos:[x+o[0],z+o[1]],height:y,size,slots:slots.map(s=>({...s,position:[s.position[0]+o[0],s.position[1]+o[1]]}))});};
 for(const b of COAST_BLOCKS){
  for(const dz of [-2.7,2.7])for(const roof of [false,true]){
   const x=roof?b.x:95,y=roof?b.height+.45:.2,z=b.z+dz;
   add('coral-coast','dining-table',x,y,z,[1.6,1.5,3.5],[-1,1].map(side=>({id:String(side),kind:'seat',position:[x,z+side*1.05],facing:side>0?Math.PI:0,seatHeight:.46+y,animation:'eat',approach:[],controller:'coast',navigationDomain:roof?'coast-stairs':'coast-patio'})));
  }
  add('coral-coast','umbrella',b.x-1.6,b.height+.45,b.z-1,[3.5,3.5,3.5]);
 }
 for(const u of COAST_UMBRELLAS)add('coral-coast','umbrella',u.x,0,u.z,[4.1,3.5,4.1]);
 for(const z of [-87,-90,-93])add('fair','picnic-table',-48.6,0,z,[3.25,1.3,1.7],[{id:'west',kind:'standing',position:[-51,z],facing:Math.PI/2,animation:'eat',approach:[],controller:'fair'}]);
 return rows;
}
export function addDistrictFurniture(town){
 town.districtFurniture=districtFurniture(town);
 for(const f of town.districtFurniture){
  const activity=f.slots.length?'picnic':'browse';
  town.registry.places.push({...f,type:'prop',kind:'prop',owner:f.district,occupants:[],hours:[0,24],capabilities:[],node:null,entryPoints:[],interactionPoints:f.slots,activity:{enabled:false,activity,animation:f.slots.length?'eat':'idle',slots:f.slots,controller:f.district,reason:'District controller owns the local access and poses; global pedestrian access is not authored'}});
 }
}
