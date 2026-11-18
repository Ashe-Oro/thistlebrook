// Pure road-following simulation. No renderer, assets, timers or global random.
import { distanceToSegment } from '../compiler/astra.js';
const length = (a,b) => Math.hypot(b[0]-a[0],b[1]-a[1]);
const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
const unit = (a,b) => { const d=length(a,b); return [(b[0]-a[0])/d,(b[1]-a[1])/d]; };
const mod = (v,n) => ((v%n)+n)%n;
export const TRAFFIC_STOPS = [
 {id:'high-street',name:'High Street',point:[-54,-16],side:[0,1]},
 {id:'campus',name:'Campus & courts',point:[-8,-33],side:[0,1]},
 {id:'quay',name:'Lantern Quay',point:[46,-7],side:[-1,0]},
 {id:'market',name:'Market Square',point:[7,-15],side:[0,-1]},
 {id:'town-hall',name:'Town Hall',point:[-57,4],side:[0,-1]},
];
export const WEST_STOPS=[{id:'union-station',name:'Union Station',point:[-88,-139],side:[0,1]},{id:'civic-green',name:'Civic Green',point:[-90,-77],side:[0,1]},{id:'sunbeam',name:'Sunbeam Terrace',point:[-126,-33],side:[0,-1]},{id:'market-gardens',name:'Market Gardens',point:[-115,-119],side:[1,0]}];
// Candidate locations. The walk graph places them only where both curbs connect.
export const CROSSWALKS = [
 {point:[-94,-77]}, {point:[-132,-33]}, {point:[-100,-139]},
 {point:[-48,-8]},
 {point:[-61,4]}, {point:[-22,-25]},
 {point:[1,-33]}, {point:[28,-33]},
 {point:[22,-7]}, {point:[46,-1]},
];
// Parked cars sit in marked bays beside the street, beyond the sidewalk, never
// on a drive lane (grok-roads). yaw is the car's heading; length runs along it.
export const PARKING_BAYS = [
 {id:'high-street-west-1',center:[-73,-12.8],yaw:Math.PI/2,length:1.85,width:.88,road:[-73,-16]},
 {id:'high-street-west-2',center:[-70.4,-12.8],yaw:Math.PI/2,length:1.85,width:.88,road:[-70.4,-16]},
 {id:'campus-lane',center:[-31,-29.8],yaw:Math.PI/2,length:1.85,width:.88,road:[-31,-33]},
];
// Only roads wide enough for two small town vehicles, north of the footbridges.
export const motorRoads = town => town.roads.filter(r=>!r.owner && r.kind!=='pedestrian' && r.width>=2.4 && Math.min(r.a[1],r.b[1])<4.01).map(r=>({...r,a:[r.a[0],Math.min(4,r.a[1])],b:[r.b[0],Math.min(4,r.b[1])]})).filter(r=>length(r.a,r.b)>.01);
export function makeLane(points,offset=.7) {
 const corners=points.map((p,i)=>{
  const a=unit(points[mod(i-1,points.length)],p),b=unit(p,points[(i+1)%points.length]);
  const dot=a[0]*b[0]+a[1]*b[1],f=offset/(1+dot);
  if(dot<-.99)throw Error('Traffic routes cannot reverse at a junction');
  return [p[0]-(a[1]+b[1])*f,p[1]+(a[0]+b[0])*f];
 });
 const samples=[];
 corners.forEach((p,i)=>{
  const prev=corners[mod(i-1,corners.length)],next=corners[(i+1)%corners.length];
  const r=Math.min(.7,length(prev,p)*.3,length(p,next)*.3);
  const enter=mix(p,prev,r/length(prev,p)),leave=mix(p,next,r/length(p,next));
  for(let k=0;k<=8;k++){const t=k/8;samples.push(mix(mix(enter,p,t),mix(p,leave,t),t));}
 });
 const cumulative=[0];for(let i=0;i<samples.length;i++)cumulative.push(cumulative.at(-1)+length(samples[i],samples[(i+1)%samples.length]));
 return {points:samples,cumulative,length:cumulative.at(-1)};
}
export function sampleLane(path,distance) {
 const d=mod(distance,path.length);let i=0;while(i<path.points.length-1&&path.cumulative[i+1]<=d)i++;
 const a=path.points[i],b=path.points[(i+1)%path.points.length],span=path.cumulative[i+1]-path.cumulative[i];
 return {position:mix(a,b,span?(d-path.cumulative[i])/span:0),direction:unit(a,b)};
}
function nearestDistance(path,point){let best=Infinity,result=0;for(let d=0;d<path.length;d+=.1){const p=sampleLane(path,d).position,s=length(p,point);if(s<best){best=s;result=d;}}return result;}
export function createTrafficSimulation(town) {
 const roads=motorRoads(town);
 const loops={
  town:[[-66,-16],[-36,-16],[-36,-15],[-22,-15],[-22,-33],[46,-33],[46,4],[22,4],[22,-15],[-22,-15],[-22,4],[-66,4]],
  station:[[-115,-139],[-42,-139],[-42,-103],[-105,-103],[-105,-77],[-80,-77],[-80,-33],[-144,-33],[-144,-70],[-115,-70]],
  shops:[[-66,-16],[-48,-16],[-48,4],[-66,4]],
  west:[[-48,-16],[-36,-16],[-36,-15],[-22,-15],[-22,4],[-48,4]],
  north:[[-22,-15],[-22,-33],[46,-33],[46,-15]],
  east:[[22,-15],[46,-15],[46,4],[22,4]],
 };
 // Fail early if another branch removes/repositions a required street.
 for(const points of Object.values(loops))for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];for(let d=0;d<=length(a,b);d+=.25){const p=mix(a,b,d/length(a,b));if(!roads.some(r=>distanceToSegment(p,r.a,r.b)<.02))throw Error(`Traffic route leaves the roads at ${p}`);}
 }
 const routes=Object.fromEntries(Object.entries(loops).flatMap(([id,p])=>[[id,makeLane(p)],[id+'-reverse',makeLane([...p].reverse())]]));
 const vehicles=[],events={busArrivals:[],deliveries:0,pedestrianYields:0,junctionYields:0,laps:0};
 function add(kind,route,fraction,stops=[]){const path=routes[route],id=vehicles.length;const v={id,kind,route,path,distance:path.length*fraction,speed:0,maxSpeed:kind==='cycle'?1.8:kind==='bus'?2.5:3.1+(id%3)*.2,length:kind==='bus'?3.2:kind==='van'?2.2:kind==='cycle'?1.45:1.85,width:kind==='cycle'?.45:kind==='bus'?.98:.88,wait:0,status:'Cruising',stops:stops.map(s=>({...s,distance:nearestDistance(path,s.point)})),lastStop:null,stoppedAt:null,visits:0};Object.assign(v,sampleLane(path,v.distance));vehicles.push(v);return v;}
 add('bus','town',.025,TRAFFIC_STOPS.map(s=>({...s,dwell:7})));
 for(const [route,fractions] of Object.entries({shops:[.05,.56],west:[.27],north:[.14,.62],east:[.25,.7],'north-reverse':[.36],'shops-reverse':[.75],'west-reverse':[.6]}))for(const f of fractions)add('car',route,f);
 add('van','west',.72,[{id:'florist',name:'Florist delivery',point:[-39,-15],dwell:5}]);
 add('van','east',.02,[{id:'quay-delivery',name:'Quay delivery',point:[46,-11],dwell:6}]);
 add('bus','station',.025,WEST_STOPS.map(s=>({...s,dwell:7})));
 for(const f of [.25,.6,.85])add('car','station',f);add('cycle','station-reverse',.3);
 add('cycle','shops',.32);add('cycle','north',.87);add('cycle','east-reverse',.43);
 const junctionPoints=town.nodes.filter(p=>{const arms=new Set();for(const r of roads)if(distanceToSegment(p,r.a,r.b)<.02)for(const end of [r.a,r.b])if(length(p,end)>.02){const u=unit(p,end);arms.add(u.map(v=>Math.round(v)).join(','));}const u=[...arms].map(s=>s.split(',').map(Number));return arms.size>=3||(arms.size===2&&u[0][0]*u[1][0]+u[0][1]*u[1][1]>-.5);})
  .filter((p,i,a)=>a.findIndex(q=>length(p,q)<2)===i).map(point=>({point,owner:null}));
 // Short connecting streets are one junction zone. Reserving their corners
 // independently can deadlock a bus and an oncoming bicycle after a pedestrian
 // changes their arrival order. Claim and release the entire zone together.
 const junctions=[];
 for(const {point}of junctionPoints){const touching=junctions.filter(j=>j.points.some(p=>length(p,point)<7));if(!touching.length)junctions.push({point,points:[point],owner:null});else{const group=touching[0];group.points.push(point);for(const other of touching.slice(1)){group.points.push(...other.points);junctions.splice(junctions.indexOf(other),1);}}}
 let time=0;
 function tick(dt,pedestrians){
  time+=dt;
  for(const j of junctions){
   if(j.owner!==null){const v=vehicles[j.owner];if(j.points.every(p=>{const dx=p[0]-v.position[0],dz=p[1]-v.position[1];return dx*v.direction[0]+dz*v.direction[1]<-3.5||Math.hypot(dx,dz)>8;}))j.owner=null;}
   if(j.owner===null){let nearest=Infinity;for(const v of vehicles)for(const point of j.points){const dx=point[0]-v.position[0],dz=point[1]-v.position[1],d=Math.hypot(dx,dz);if(d<5.5&&d<nearest&&dx*v.direction[0]+dz*v.direction[1]>-.5){nearest=d;j.owner=v.id;}}}
  }
  for(const v of vehicles){
   if(v.wait>0){v.wait=Math.max(0,v.wait-dt);v.speed=0;v.status=v.kind==='bus'?'At stop':'Unloading';if(!v.wait)v.stoppedAt=null;continue;}
   let clearance=Infinity,reason='Cruising';const ahead=(point)=>{const dx=point[0]-v.position[0],dz=point[1]-v.position[1];return {along:dx*v.direction[0]+dz*v.direction[1],across:Math.abs(dx*v.direction[1]-dz*v.direction[0])};};
   // Look down the lane, including predicted pedestrian positions. Residents
   // keep right of way even away from a painted crossing.
   for(const p of pedestrians){for(const horizon of [0,.45]){const q=[p.x+(p.vx||0)*horizon,p.z+(p.vz||0)*horizon],a=ahead(q);if(a.along>-.1&&a.along<8&&a.across<v.width/2+.28){const gap=a.along-v.length/2-.4;if(gap<clearance){clearance=gap;reason='Yielding to pedestrian';}}}}
   for(const other of vehicles){if(other===v)continue;
    if(other.path===v.path){const gap=mod(other.distance-v.distance,v.path.length)-(v.length+other.length)/2-.6;if(gap<clearance){clearance=gap;reason='Following traffic';}}
    const a=ahead(other.position),alignment=v.direction[0]*other.direction[0]+v.direction[1]*other.direction[1];
    if(a.along>0&&a.across<(v.width+other.width)/2+.12&&alignment>.45){const gap=a.along-(v.length+other.length)/2-.5;if(gap<clearance){clearance=gap;reason='Following traffic';}}
   }
   for(const j of junctions)for(const point of j.points){const a=ahead(point);if(a.along<0||a.along>6||a.across>1.3)continue;
    if(j.owner!==null&&j.owner!==v.id){const gap=a.along-v.length/2-3; // room for a turning bus to sweep the corner
   if(gap<clearance){clearance=gap;reason='Yielding at junction';}}
   }
   let stop=null,stopGap=Infinity;
   for(const s of v.stops){const d=mod(s.distance-v.distance,v.path.length);if(d<stopGap){stopGap=d;stop=s;}}
   if(stopGap<.08&&stop?.id!==v.lastStop){v.wait=stop.dwell;v.stoppedAt=stop.id;v.lastStop=stop.id;v.visits++;v.speed=0;
    if(v.kind==='bus')events.busArrivals.push({stop:stop.id,time:+time.toFixed(2)});else events.deliveries++;
    // Keep diagnostics bounded during a long-running town session.
    if(events.busArrivals.length>100)events.busArrivals.shift();continue;
   }
   if(stopGap>2)v.lastStop=null;
   if(stopGap<clearance&&stop?.id!==v.lastStop){clearance=stopGap;reason='Approaching stop';}
   const wanted=Math.min(v.maxSpeed,Math.sqrt(Math.max(0,2*3*clearance)));
   const old=v.status;v.status=reason;
   if(old!==reason&&reason==='Yielding to pedestrian')events.pedestrianYields++;
   if(old!==reason&&reason==='Yielding at junction')events.junctionYields++;
   v.speed=Math.max(0,Math.min(wanted,v.speed+dt*1.4));
   const travel=Math.max(0,Math.min(v.speed*dt,clearance));
   const oldLap=Math.floor(v.distance/v.path.length);v.distance+=travel;if(Math.floor(v.distance/v.path.length)>oldLap)events.laps++;
   Object.assign(v,sampleLane(v.path,v.distance));
  }
 }
 return {roads,routes,vehicles,junctions,events,stops:[...TRAFFIC_STOPS,...WEST_STOPS],
  update(dt,pedestrians=[]){if(!Number.isFinite(dt)||dt<=0)return;let left=Math.min(dt,1);while(left>1e-8){const step=Math.min(left,1/30);tick(step,pedestrians);left-=step;}},
  audit(){return {time:+time.toFixed(2),vehicles:vehicles.map(({id,kind,position,speed,status,visits,stoppedAt})=>({id,kind,position:[...position],speed,status,visits,stoppedAt})),events:structuredClone(events)};}
 };
}
