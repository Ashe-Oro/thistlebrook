// OWNER: grok-woods lane. Contract: docs/specs/GROK-WOODS.md.
// Pinewood hikers. Pure and clock-driven like ballgame.js: every pose comes
// from (woods plan, hour, t, weekday), so pause, speed, the collision sim and
// tests all see the same hikers. src/astra/woods.js renders them.
// weekday: 0 = Monday .. 6 = Sunday (world.update passes (4 + life.day) % 7).
import {terrainY,TRAIL} from '../compiler/woods.js';

export const HIKE_HOURS=Object.freeze({first:8,lastOffTrail:17.5,weekendLastOffTrail:18});
export const HIKERS_WEEKDAY=12,HIKERS_WEEKEND=22;
const LOOKS=['farmhand','herbalist','merchant','carpenter','miller','innkeeper','watch','elder','baker','shopkeeper','blacksmith'];
const GAME_SECONDS_PER_HOUR=90; // life runtime: hour += dt / 90
const hash=n=>{let x=Math.imul(n^0x9e3779b9,0x85ebca6b);x^=x>>>13;x=Math.imul(x,0xc2b2ae35);x^=x>>>16;return (x>>>0)/4294967296;};
const isWeekend=w=>w===5||w===6;

// A route's walking line: trail legs joined end to end (reversed as needed).
export function routeLine(woods,route){
 const out=[];
 for(const [id,rev] of route.legs){const t=woods.trails.find(t=>t.id===id);const pts=rev?[...t.points].reverse():t.points;for(const p of pts){const last=out.at(-1);if(last&&Math.hypot(last[0]-p[0],last[2]-p[2])<.05)continue;out.push(p);}}
 const dist=[0];for(let i=1;i<out.length;i++)dist.push(dist[i-1]+Math.hypot(out[i][0]-out[i-1][0],out[i][2]-out[i-1][2]));
 let restAt=dist.at(-1);
 if(route.kind==='loop'){const goal=woods.lookout.pos;let best=Infinity;out.forEach((p,i)=>{const d=Math.hypot(p[0]-goal[0],p[2]-goal[1]);if(d<best){best=d;restAt=dist[i];}});}
 return {points:out,dist,length:dist.at(-1),restAt};
}
function sample(line,s){
 const {points:p,dist:d}=line;s=Math.max(0,Math.min(line.length,s));
 let lo=0,hi=d.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(d[m]<=s)lo=m;else hi=m;}
 const k=d[hi]>d[lo]?(s-d[lo])/(d[hi]-d[lo]):0,a=p[lo],b=p[hi];
 return {x:a[0]+(b[0]-a[0])*k,z:a[2]+(b[2]-a[2])*k,dir:[b[0]-a[0],b[2]-a[2]],bridge:!!(a.onBridge&&b.onBridge),deck:a.onBridge?a[1]:b[1]};
}

// Who hikes today. Deterministic per weekday: more people at weekends,
// some in pairs. Each start time is chosen so the hike (out, rest, back)
// ends at the trailhead before the day's last-off-trail hour.
export function hikerRoster(woods,weekday=4){
 const weekend=isWeekend(weekday),count=weekend?HIKERS_WEEKEND:HIKERS_WEEKDAY,last=weekend?HIKE_HOURS.weekendLastOffTrail:HIKE_HOURS.lastOffTrail;
 const lines=new Map(woods.routes.map(r=>[r.id,routeLine(woods,r)]));
 const roster=[];
 for(let n=0;n<count;n++){
  const pairWith=n>0&&hash(n*31+weekday)<.3&&roster.at(-1)&&!roster.at(-1).pairWith?roster.at(-1):null;
  const route=pairWith?pairWith.route:woods.routes[Math.floor(hash(n*7+weekday*13)*woods.routes.length)];
  const line=lines.get(route.id),speed=pairWith?pairWith.speed:.85+hash(n*11+3)*.35;
  const rest=pairWith?pairWith.rest:.25+hash(n*5+weekday)*.45;
  const walkHours=(route.kind==='loop'?line.length:line.length*2)/(speed*GAME_SECONDS_PER_HOUR);
  const latest=last-walkHours-rest-.05,start=pairWith?pairWith.start+.01:HIKE_HOURS.first+hash(n*17+weekday*3)*Math.max(0,latest-HIKE_HOURS.first);
  roster.push({id:`hiker-${n}`,n,look:LOOKS[(n*5+weekday)%LOOKS.length],route,line,speed,rest,start,end:start+walkHours+rest,walkHours,side:pairWith?.72:.3,pairWith:pairWith?.id||null});
  // Pairs walk abreast: the leader moves to the centre line so the two rigs
  // (about .5 m wide) are ~.8 m apart instead of overlapping.
  if(pairWith)pairWith.side=-.05;
 }
 return roster;
}

// One hiker's pose at `hour` (null when not on the trails).
export function hikerPose(h,woods,hour,t=0){
 if(!(hour>=h.start&&hour<h.end))return null;
 const {line,route,speed,rest}=h,metres=(hour-h.start)*GAME_SECONDS_PER_HOUR*speed;
 const outLen=route.kind==='loop'?line.restAt:line.length;
 let s,back=false,resting=false;
 if(metres<outLen){s=metres;}
 else if(hour<h.start+outLen/(speed*GAME_SECONDS_PER_HOUR)+rest){s=outLen;resting=true;}
 else{const after=metres-outLen-rest*GAME_SECONDS_PER_HOUR*speed;if(route.kind==='loop')s=Math.min(line.length,outLen+after);else{s=Math.max(0,line.length-after);back=true;}}
 const p=sample(line,s),len=Math.hypot(...p.dir)||1,dir=[p.dir[0]/len*(back?-1:1),p.dir[1]/len*(back?-1:1)];
 // Keep right of the trail's centre line (two-way traffic); pairs walk abreast.
 const side=resting?0:h.side,x=p.x+dir[1]*-side*1,z=p.z+dir[0]*side;
 let rx=x,rz=z,heading=Math.atan2(dir[0],dir[1]);
 if(resting){const a=h.n*2.39996,r=1.1+(h.n%3)*.5;rx=p.x+Math.cos(a)*r;rz=p.z+Math.sin(a)*r;heading=route.rest==='lookout'?woods.lookout.facing:a+Math.PI;}
 const ground=p.bridge&&!resting?p.deck:terrainY(rx,rz)+TRAIL.lift;
 const walking=!resting;
 return {x:rx,z:rz,y:ground+(walking?Math.abs(Math.sin(t*6.5+h.n))*.04:0),heading,walking,resting,activity:resting?(route.rest==='lookout'?'Taking in the view at Pinewood Lookout':route.rest==='cairn'?'Adding a stone to the South Knob cairn':'Resting by Pinewood Pond'):back?'Hiking back to the trailhead':'Hiking the '+route.id.replace('-',' & ')+' route'};
}

export function hikersState(woods,hour,t=0,weekday=4){
 const roster=hikerRoster(woods,weekday);
 return {roster,hikers:roster.map(h=>({id:h.id,look:h.look,pose:hikerPose(h,woods,hour,t)}))};
}
