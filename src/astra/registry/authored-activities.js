// Same drill, role anchors and backstop access as village/astra-life.
// Keep this together with the corresponding field geometry when relocating it.
export function baseballInteraction(field){
 const [x,z]=field.pos,home=[x,z+11],mound=[x,z+3],bases=[home,[x+8,z+3],[x,z-5],[x-8,z+3]];
 return {version:1,activity:'baseball',label:'Owls batting practice',tools:['visit'],duration:108,minParticipants:3,entryNode:field.node,approach:[[x+5,z+15],[x+5,z+11]],slots:[
  {id:'batter',role:'batter',kind:'player',position:[x+1,z+10.6],facing:-Math.PI/2,animation:'bat',approach:[]},
  {id:'pitcher',role:'pitcher',kind:'player',position:mound,facing:0,animation:'pitch',approach:[[x+4,z+5]]},
  {id:'fielder',role:'fielder',kind:'player',position:[x+8,z-6],facing:Math.PI,animation:'field',approach:[[x+9,z+3]]}
 ],hours:[8,20],game:{bases,mound,field:[x+9,z-9]}};
}

// Unreservable seat candidates measured directly from the procedural box tops.
// Circulation through these assemblies must be authored before enabling them.
export function proceduralSeatCandidates(item,town){
 const seats=[];
 const row=(id,x,z,count,spacing,height,facing)=>{
  for(let n=0;n<count;n++)seats.push({id:`${id}/${n}`,kind:'seat',position:[x+(n-(count-1)/2)*spacing,z],facing,seatHeight:height,animation:'sit',approach:[]});
 };
 const venue=town.venues.find(v=>v.id===item.owner);
 if(!venue)return seats;
 const [x,z]=venue.pos;
 if(item.key==='built:tennis-3'||item.key==='built:basketball-4')for(let n=0;n<2;n++)row(`row-${n}`,x,z-6.7-n*.55,7,1,.495+n*.25,0);
 if(item.key==='built:baseball-8')for(let n=0;n<3;n++)row(`row-${n}`,x-13,z+7-n*.5,5,1,.63+n*.4,Math.PI);
 if(item.key==='built:football-2'||item.key==='built:football-3'){
  const side=item.key.endsWith('-2')?-1:1;
  for(let n=0;n<4;n++)row(`row-${n}`,x,z+side*(11.7+n*.5),25,1,.54+n*.38,side===-1?0:Math.PI);
 }
 if(item.key==='built:playground-3'||item.key==='built:playground-4'){
  const n=item.key.endsWith('-3')?0:1;
  row('swing',x-4.4+n*2.7,z-2,1,1,.81,Math.PI);
 }
 return seats;
}
