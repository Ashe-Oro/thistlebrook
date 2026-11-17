// These are the existing fair controller's authored circulation paths. One
// source defines registry queries and visitor motion; no inferred furniture seats.
export const FAIR_SLOTS={
 'fair-wheel':[[-59,-85],[-60.2,-85],[-59,-86.3],[-60.2,-86.3]],
 'fair-carousel':[[-47,-61.8],[-49,-61.8],[-51,-61.8],[-53,-61.8]],
 'fair-pond':[[-63,-61.5],[-65,-61.5],[-67,-61.5],[-69,-61.5],[-71,-61.5]],
 'fair-picnic':[[-51,-87],[-51,-90],[-51,-93],[-47,-96]],
 'fair-band':[[-72,-42],[-70,-42],[-68,-42],[-65,-42],[-63,-42],[-72,-39.5],[-69,-39.5],[-64,-39.5]],
 'fair-food':[[-52.5,-51],[-52.5,-47],[-52.5,-43],[-54,-51]],
};
export function fairApproach(id,slot){
 if(id==='fair-picnic')return [[-52,-84],[-52,slot[1]],slot];
 if(id==='fair-band')return [[-74,slot[1]],slot];
 if(id==='fair-food')return [[-54,-53],[-54,slot[1]],slot];
 return [slot];
}
export function addDistrictActivities(town){
 const offset=town.regions.find(r=>r.id==='fair').offset,move=p=>p.map((v,k)=>v+offset[k]);
 for(const [id,positions]of Object.entries(FAIR_SLOTS)){
  const p=town.registry.places.find(p=>p.id===id),picnic=id==='fair-picnic';
  const slots=positions.map((pos,n)=>({id:String(n),kind:'standing',position:move(pos),facing:picnic||id==='fair-food'?Math.PI/2:Math.PI,animation:picnic?'eat':'idle',approach:fairApproach(id,pos).slice(0,-1).map(move)}));
  const interaction={version:1,controller:'fair',activity:picnic?'picnic':'browse',label:picnic?'Taking a picnic break':id==='fair-food'?'Buying a picnic':id==='fair-band'?'Listening to the band':'Watching the fair',tools:picnic?['eat','rest','visit']:['visit'],duration:picnic?50:30,minParticipants:1,entryNode:p.node,approach:[],slots,hours:p.hours};
  p.interaction=interaction;p.interactionPoints=slots;p.capabilities=['walkTo',...interaction.tools];p.activity={enabled:true,activity:interaction.activity,animation:slots[0].animation,slots,controller:'fair'};
 }
}
