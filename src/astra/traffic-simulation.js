import {BUS_ROUTES, TOWN_LANE_OFFSET, CIVIC_CYCLE_OFFSET} from '../roads/town-roads.js';
// Pure road-following simulation. No renderer, assets, timers or global random.
import { vehicleInZone, sweepBlocker, releaseWaitCycles, footprint, pointInFootprint } from '../roads/collisions.js';
import { distanceToSegment } from '../compiler/astra.js';
import { assignFleet, parkedFleet, vehicleModel, FLEET_MODELS } from './traffic-fleet.js';
import { CIVIC_PARKED, FIRE_ROUTE, DELIVERY_ROUTE } from './civic-quarter-life.js';
import { MAPLE_HOLLOW_BAYS, MAPLE_HOLLOW_CROSSWALKS } from './maple-hollow-plan.js';
const length = (a,b) => Math.hypot(b[0]-a[0],b[1]-a[1]);
const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
const unit = (a,b) => { const d=length(a,b); return [(b[0]-a[0])/d,(b[1]-a[1])/d]; };
const mod = (v,n) => ((v%n)+n)%n;
export const TRAFFIC_STOPS = [
 {id:'high-street',name:'High Street',point:[-56,-16],side:[0,1]},
 {id:'campus',name:'Campus & courts',point:[-8,-33],side:[0,1]},
 {id:'quay',name:'Lantern Quay',point:[46,-7],side:[-1,0]},
 {id:'market',name:'Market Square',point:[7,-15],side:[0,-1]},
 {id:'town-hall',name:'Town Hall',point:[-57,4],side:[0,-1]},
];
export const WEST_STOPS=[{id:'union-station',name:'Union Station',point:[-88,-139],side:[0,1]},{id:'civic-green',name:'Civic Green',point:[-91.9,-77],side:[0,1]},{id:'sunbeam',name:'Sunbeam Terrace',point:[-126,-33],side:[0,-1]},{id:'market-gardens',name:'Market Gardens',point:[-115,-119],side:[1,0]}];
// Candidate locations. The walk graph places them only where both curbs connect.
export const CROSSWALKS = [
 {point:[-96,-77]}, {point:[-132,-33]}, {point:[-100,-139]},
 {point:[-48,-8]},
 {point:[-61,4]}, {point:[-22,-25]},
 {point:[1,-33]}, {point:[28,-33]},
 {point:[22,-7]}, {point:[46,-1]},
 // Maple Hollow (opus-suburb): bus stops and the school-edge stop.
 ...MAPLE_HOLLOW_CROSSWALKS,
];
// Parked cars sit in marked bays beside the street, beyond the sidewalk, never
// on a drive lane (grok-roads). yaw is the car's heading; length runs along it.
const CURB_BAYS = [
 {id:'high-street-west-1',center:[-73,-12.45],yaw:Math.PI/2,road:[-73,-16]},
 {id:'high-street-west-2',center:[-70.4,-12.45],yaw:Math.PI/2,road:[-70.4,-16]},
 {id:'campus-lane',center:[-31,-29.48],yaw:Math.PI/2,road:[-31,-33]},
 // vehicle-variety: a residential curb bay on Willowbank's west lane and a
 // short row south of Market Street, each 1.7 m beyond the carriageway edge,
 // clear of sidewalks, crossings, junctions, parcels and props (audit-roads).
 {id:'willowbank-west',center:[-18.45,-7],yaw:0,road:[-22,-7]},
 {id:'market-south-1',center:[7,-18.6],yaw:Math.PI/2,road:[7,-15]},
 {id:'market-south-2',center:[9.4,-18.6],yaw:Math.PI/2,road:[9.4,-15]},
 {id:'market-south-3',center:[11.8,-18.6],yaw:Math.PI/2,road:[11.8,-15]},
].map(b=>{
 const [look]=parkedFleet([b]);
 const model=vehicleModel(look.model);
 return {...b,length:model.length,width:model.width};
});
export const PARKING_BAYS = [...CURB_BAYS,...MAPLE_HOLLOW_BAYS];
export function parkedVehicles() {
 return [
  ...PARKING_BAYS.map(b=>{
   const {model,colour}=PARKED_LOOKS.get(b.id)??{model:b.model};
   return {...b,...vehicleModel(model,colour),kind:'car',parked:true};
  }),
  ...CIVIC_PARKED.map(b=>({...b,...vehicleModel(b.model),kind:FLEET_MODELS[b.model].kind,parked:true})),
 ].map(v=>({...v,position:v.center,direction:[Math.sin(v.yaw),Math.cos(v.yaw)],speed:0,status:'Parked'}));
}
const PARKED_LOOKS=new Map(parkedFleet(PARKING_BAYS).map(f=>[f.bay,f]));
// One documented cycle corridor: Civic Avenue (4.2 m) carries marked cycle
// strips beside the West Loop lanes from Sunbeam Lane to the Civic Green bend.
// Cyclists on that stretch ride the strip, outside the car lane.
export const CYCLE_STRIPS = [
 {id:'civic-avenue-north',name:'Civic Avenue cycle strip',a:[-80,-33],b:[-80,-77],offset:CIVIC_CYCLE_OFFSET,width:.6},
 {id:'civic-avenue-west',name:'Civic Avenue cycle strip',a:[-80,-77],b:[-99,-77],offset:CIVIC_CYCLE_OFFSET,width:.6},
];
// Clear the longest turning bus, including its front corner as it straightens.
const cityBus = vehicleModel('city-bus');
const JUNCTION_RADIUS = Math.hypot(cityBus.length,cityBus.width)/2+TOWN_LANE_OFFSET+.3;
// At Civic Avenue and the Town Hall approach the bus's front corner still
// projects into the opposite lane just after the turn.
function junctionRadius([x,z]) {
 const busTurn = x===-80&&z===-77 || x===-22&&z===4;
 return JUNCTION_RADIUS+(busTurn ? .6 : 0);
}
const onStrip=(a,b)=>CYCLE_STRIPS.find(s=>length(s.a,a)<.01&&length(s.b,b)<.01);
const civicLaneOffset=(a,b)=>{
 if(a[1]===-77&&b[1]===-77&&Math.min(a[0],b[0])>=-105&&Math.max(a[0],b[0])<=-43)return 1;
 if(a[0]===-80&&b[0]===-80&&Math.min(a[1],b[1])>=-77&&Math.max(a[1],b[1])<=-33)return 1;
 return TOWN_LANE_OFFSET;
};
// Only roads wide enough for two small town vehicles, north of the footbridges.
export const motorRoads = town => town.roads.filter(r=>!r.owner && r.kind!=='pedestrian' && r.width>=2.4 && Math.min(r.a[1],r.b[1])<4.01).map(r=>({...r,a:[r.a[0],Math.min(4,r.a[1])],b:[r.b[0],Math.min(4,r.b[1])]})).filter(r=>length(r.a,r.b)>.01);
export function makeLane(points,offset=.7,segmentOffset=null,open=false) {
 const corners=points.map((p,i)=>{
  if(open&&(i===0||i===points.length-1)){
   const d=i===0?unit(p,points[1]):unit(points[i-1],p);
   return [p[0]-d[1]*offset,p[1]+d[0]*offset];
  }
  const a=unit(points[mod(i-1,points.length)],p),b=unit(p,points[(i+1)%points.length]);
  const dot=a[0]*b[0]+a[1]*b[1],f=offset/(1+dot);
  if(dot<-.99)throw Error('Traffic routes cannot reverse at a junction');
  const oa=segmentOffset?.(points[mod(i-1,points.length)],p)??offset,ob=segmentOffset?.(p,points[(i+1)%points.length])??offset;
  if(oa===offset&&ob===offset)return [p[0]-(a[1]+b[1])*f,p[1]+(a[0]+b[0])*f];
  // Different offsets either side of the corner: intersect the two offset lines.
  const det=b[0]*a[1]-a[0]*b[1],w=[-b[1]*ob+a[1]*oa,b[0]*ob-a[0]*oa];
  if(Math.abs(det)<1e-6)return [p[0]+w[0]/2-a[1]*oa,p[1]+w[1]/2+a[0]*oa];
  const s=(-w[0]*b[1]+b[0]*w[1])/det;
  return [p[0]-a[1]*oa+a[0]*s,p[1]+a[0]*oa+a[1]*s];
 });
 if(open)return corners;
 const samples=[];
 for(let i=0;i<corners.length;i++){
  const p=corners[i],prev=corners[mod(i-1,corners.length)],next=corners[(i+1)%corners.length];
  // Blend a short lateral jog as one curve, so a long bus stays clear of the
  // sidewalk while its front swings onto the next parallel street.
  const after=corners[(i+2)%corners.length],incoming=unit(prev,p),outgoing=unit(next,after);
  if(i+1<corners.length&&length(p,next)<1.1&&incoming[0]*outgoing[0]+incoming[1]*outgoing[1]>.999){
   const span=4.5;
   const enter=mix(p,prev,Math.min(span/length(p,prev),.32)),leave=mix(next,after,Math.min(span/length(next,after),.32));
   const tangent=leave.reduce((sum,v,axis)=>sum+(v-enter[axis])*incoming[axis],0)/3;
   const first=enter.map((v,axis)=>v+incoming[axis]*tangent),last=leave.map((v,axis)=>v-outgoing[axis]*tangent);
   for(let k=0;k<=16;k++){
    const t=k/16,a=mix(enter,first,t),b=mix(first,last,t),c=mix(last,leave,t);
    samples.push(mix(mix(a,b,t),mix(b,c,t),t));
   }
   i++;
   continue;
  }
  const r=Math.min(.7,length(prev,p)*.3,length(p,next)*.3);
  const enter=mix(p,prev,r/length(prev,p)),leave=mix(p,next,r/length(next,p));
  for(let k=0;k<=8;k++){const t=k/8;samples.push(mix(mix(enter,p,t),mix(p,leave,t),t));}
 }
 const cumulative=[0];for(let i=0;i<samples.length;i++)cumulative.push(cumulative.at(-1)+length(samples[i],samples[(i+1)%samples.length]));
 return {points:samples,cumulative,length:cumulative.at(-1)};
}
export function sampleLane(path,distance) {
 const d=mod(distance,path.length);
 let i=0,end=path.points.length-1;
 while(i<end){
  const mid=(i+end)>>>1;
  if(path.cumulative[mid+1]<=d)i=mid+1;else end=mid;
 }
 const a=path.points[i],b=path.points[(i+1)%path.points.length],span=path.cumulative[i+1]-path.cumulative[i];
 return {position:mix(a,b,span?(d-path.cumulative[i])/span:0),direction:unit(a,b)};
}
function depotLoop(points) {
 const outward=makeLane(points,TOWN_LANE_OFFSET,civicLaneOffset,true), inward=makeLane([...points].reverse(),TOWN_LANE_OFFSET,civicLaneOffset,true);
 return makeLane([...outward,...inward],0);
}
function nearestDistance(path,point){let best=Infinity,result=0;for(let d=0;d<path.length;d+=.1){const p=sampleLane(path,d).position,s=length(p,point);if(s<best){best=s;result=d;}}return result;}
export function createTrafficSimulation(town) {
 const roads=motorRoads(town);
 const loops={
  ...BUS_ROUTES,
  shops:[[-66,-16],[-48,-16],[-48,4],[-66,4]],
  west:[[-48,-16],[-36,-16],[-36,-15],[-22,-15],[-22,4],[-48,4]],
  north:[[-22,-15],[-22,-33],[46,-33],[46,-15]],
  east:[[22,-15],[46,-15],[46,4],[22,4]],
 };
 // Fail early if another branch removes/repositions a required street.
 for(const points of Object.values(loops))for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];for(let d=0;d<=length(a,b);d+=.25){const p=mix(a,b,d/length(a,b));if(!roads.some(r=>distanceToSegment(p,r.a,r.b)<.02))throw Error(`Traffic route leaves the roads at ${p}`);}
 }
 const routes=Object.fromEntries(Object.entries(loops).flatMap(([id,p])=>[[id,makeLane(p,TOWN_LANE_OFFSET,civicLaneOffset)],[id+'-reverse',makeLane([...p].reverse(),TOWN_LANE_OFFSET,civicLaneOffset)]]));
 // Cyclists use the marked strip where one exists (CYCLE_STRIPS).
 // The strip ends where Civic Avenue narrows (x = -99), so that point joins the cycle's route.
 const cycleLoop=[...loops.station].reverse();cycleLoop.splice(cycleLoop.findIndex(p=>p[0]===-80&&p[1]===-77)+1,0,[-99,-77]);
 routes['station-reverse-cycle']=makeLane(cycleLoop,TOWN_LANE_OFFSET,(a,b)=>onStrip(a,b)?.offset??civicLaneOffset(a,b));
 const vehicles=[],events={deadlocksReleased:[],busArrivals:[],deliveries:0,pedestrianYields:0,junctionYields:0,laps:0};
 function add(kind,route,fraction,stops=[]){const path=routes[route],id=vehicles.length;const v={id,kind,route,path,distance:path.length*fraction,speed:0,maxSpeed:kind==='cycle'?1.8:kind==='bus'?2.5:3.1+(id%3)*.2,wait:0,status:'Cruising',stops:stops.map(s=>({...s,distance:nearestDistance(path,s.point)})),lastStop:null,stoppedAt:null,visits:0};Object.assign(v,sampleLane(path,v.distance));vehicles.push(v);return v;}
 add('bus','town',.025,TRAFFIC_STOPS.map(s=>({...s,dwell:7})));
 for(const [route,fractions] of Object.entries({shops:[.05,.56],west:[.27],north:[.14,.62],east:[.25,.7],'north-reverse':[.36],'shops-reverse':[.75],'west-reverse':[.6]}))for(const f of fractions)add('car',route,f);
 add('van','west',.72,[{id:'florist',name:'Florist delivery',point:[-43,-16],dwell:5}]);
 add('van','east',.02,[{id:'quay-delivery',name:'Quay delivery',point:[46,-8.8],dwell:6}]);
 add('bus','station',.025,WEST_STOPS.map(s=>({...s,dwell:7})));
 for(const f of [.25,.6,.85])add('car','station',f);add('cycle','station-reverse-cycle',.3);
 add('cycle','shops',.32);add('cycle','north',.87);add('cycle','east-reverse',.43);
 for(const [i,f] of assignFleet(vehicles).entries())Object.assign(vehicles[i],vehicleModel(f.model,f.colour));
 const civicRoutes=[
  {id:'civic-engine',model:'af-fire-tender',points:FIRE_ROUTE,depot:94,stop:16},
  {id:'civic-delivery',model:'city-delivery-van',points:DELIVERY_ROUTE,depot:30,stop:8},
 ];
 for(const {id,model,points,depot,stop} of civicRoutes){
  const path=depotLoop(points), destination=points.at(-1);
  const distance=nearestDistance(path,points[0]), vehicle=vehicleModel(model);
  // Stop the tender on the straight approach so its nose stays off the sidewalk during the assist.
  const stopDistance=nearestDistance(path,destination)-(id==='civic-engine'?vehicle.length/2:0);
  const v={id,kind:'van',civic:true,route:id,path,distance,maxSpeed:3.25,speed:0,
   wait:id==='civic-engine'?16:18,stoppedAt:'depot',lastStop:'depot',status:'At depot',
   stops:[{id:'depot',name:'Depot',distance,dwell:depot},{id:'destination',name:'Service call',distance:stopDistance,dwell:stop}],
   visits:0,...vehicle};
  Object.assign(v,sampleLane(path,distance));vehicles.push(v);
 }
 const parked=parkedVehicles();
 for(const v of vehicles)v.positionAhead=distance=>sampleLane(v.path,v.distance+distance).position;
 const civicEntrances=[FIRE_ROUTE[1],FIRE_ROUTE[2],DELIVERY_ROUTE[1]];
 const junctionPoints=[...town.nodes.filter(p=>{const arms=new Set();for(const r of roads)if(distanceToSegment(p,r.a,r.b)<.02)for(const end of [r.a,r.b])if(length(p,end)>.02){const u=unit(p,end);arms.add(u.map(v=>Math.round(v)).join(','));}const u=[...arms].map(s=>s.split(',').map(Number));return arms.size>=3||(arms.size===2&&u[0][0]*u[1][0]+u[0][1]*u[1][1]>-.5);}),...civicEntrances]
  .filter((p,i,a)=>a.findIndex(q=>length(p,q)<2)===i);
 // Short connecting streets are one junction zone. Reserving their corners
 // independently can deadlock a bus and an oncoming bicycle after a pedestrian
 // changes their arrival order. Claim and release the entire zone together.
 const junctions=[];
 for(const point of junctionPoints){const touching=junctions.filter(j=>j.points.some(p=>length(p,point)<JUNCTION_RADIUS*2));if(!touching.length)junctions.push({point,points:[point],owner:null,radius:junctionRadius(point)});else{const group=touching[0];group.points.push(point);group.radius=Math.max(group.radius,junctionRadius(point));for(const other of touching.slice(1)){group.points.push(...other.points);group.radius=Math.max(group.radius,other.radius);junctions.splice(junctions.indexOf(other),1);}}}
 // The Civic Green entrances and the downtown chicane each share a
 // reservation with their adjacent junction. This keeps a car waiting at
 // one junction out of the space a bus sweeps while it clears the other.
 const downtownChicane=[[-48,-16],[-36,-16]];
 for(const points of [civicEntrances,downtownChicane]){
  const linked=junctions.filter(j=>j.points.some(p=>points.some(c=>length(p,c)<.1)));
  const [zone,...rest]=linked;
  for(const j of rest){zone.points.push(...j.points);zone.radius=Math.max(zone.radius,j.radius);junctions.splice(junctions.indexOf(j),1);}
 }
 const radii=new Map(junctionPoints.map(point=>[point,junctionRadius(point)]));
 const pedestrianLookahead=[0,.45],pedestrianSweep=[0,.3,.6];
 let time=0;
 function tick(dt,pedestrians,others,hour){
  const fleet=[...vehicles,...parked,...others];
  time+=dt;
  for(const j of junctions){
   if(j.owner!==null){
    const v=j.owner,next={...v,...sampleLane(v.path,v.distance+2.5)};
    if(j.points.every(p=>!vehicleInZone(v,p,radii.get(p))&&!vehicleInZone(next,p,radii.get(p))))j.owner=null;
   }
   if(j.owner===null){
    let first=Infinity,nearest=Infinity;
    for(const v of vehicles)if(!(v.civic&&v.wait>0))for(const point of j.points){
     const dx=point[0]-v.position[0],dz=point[1]-v.position[1],reach=Math.max(5.5,radii.get(point)+v.length/2+.25);
     if(Math.abs(dx)>=reach||Math.abs(dz)>=reach||dx*v.direction[0]+dz*v.direction[1]<=-.5)continue;
     const d=Math.hypot(dx,dz);
     if(d>=reach)continue;
     // Give a held approach its turn before admitting another vehicle
     // from a continuously arriving platoon.
     const since=v.queuedJunction===j?v.junctionWaitSince:time;
     if(since<first||since===first&&d<nearest){first=since;nearest=d;j.owner=v;}
    }
   }
  }
  for(const v of vehicles){
   v.blockedBy=null;v.crossingYield=false;
   if(v.id==='civic-delivery'&&v.stoppedAt==='depot'&&(hour<8||hour>=16)){v.status='At depot';continue;}
   if(v.wait>0){v.wait=Math.max(0,v.wait-dt);v.speed=0;v.status=v.civic&&v.stoppedAt==='depot'?'At depot':v.id==='civic-engine'?'Assisting at fire scene':v.kind==='bus'?'At stop':'Unloading';if(!v.wait)v.stoppedAt=null;continue;}
   let clearance=Infinity,reason='Cruising',waitingJunction=null;
   const [x,z]=v.position,[forwardX,forwardZ]=v.direction;
   // Look down the lane, including predicted pedestrian positions. Residents
   // keep right of way even away from a painted crossing.
   for(const p of pedestrians){
    if(Math.abs(p.x-x)>11||Math.abs(p.z-z)>11)continue;
    const width=p.crossing?2.8:v.width/2+.28,buffer=p.crossing?1.45:.4;
    for(const horizon of pedestrianLookahead){
     const dx=p.x+(p.vx||0)*horizon-x,dz=p.z+(p.vz||0)*horizon-z;
     const along=dx*forwardX+dz*forwardZ;
     if(along>-.1&&along<8&&Math.abs(dx*forwardZ-dz*forwardX)<width){
      const gap=along-v.length/2-buffer;
      if(gap<clearance){clearance=gap;reason='Yielding to pedestrian';v.crossingYield=horizon===0&&Boolean(p.crossing);}
     }
    }
   }
   for(const other of fleet){if(other===v)continue;
    if(other.path===v.path){const gap=mod(other.distance-v.distance,v.path.length)-(v.length+other.length)/2-.6;if(gap<clearance){clearance=gap;reason='Following traffic';v.blockedBy=other;}}
    const dx=other.position[0]-x,dz=other.position[1]-z;
    const along=dx*forwardX+dz*forwardZ;
    if(along>0&&Math.abs(dx*forwardZ-dz*forwardX)<(v.width+other.width)/2+.12&&forwardX*other.direction[0]+forwardZ*other.direction[1]>.45){
     const gap=along-(v.length+other.length)/2-.5;
     if(gap<clearance){clearance=gap;reason='Following traffic';v.blockedBy=other;}
    }
   }
   for(const j of junctions){
    if(j.owner===null||j.owner===v)continue;
    for(const point of j.points){
     const radius=radii.get(point),dx=point[0]-x,dz=point[1]-z;
     const along=dx*forwardX+dz*forwardZ;
     if(along<0||along>Math.max(6,radius+v.length/2+1)||Math.abs(dx*forwardZ-dz*forwardX)>1.3)continue;
     const gap=along-v.length/2-radius; // room for a turning bus to sweep the corner
     if(gap<clearance){clearance=gap;reason='Yielding at junction';v.blockedBy=j.owner;waitingJunction=j;}
    }
   }
   let stop=null,stopGap=Infinity;
   for(const s of v.stops){const d=mod(s.distance-v.distance,v.path.length);if(d<stopGap){stopGap=d;stop=s;}}
   if(stopGap<.08&&stop?.id!==v.lastStop){v.wait=stop.dwell;v.stoppedAt=stop.id;v.lastStop=stop.id;if(v.civic)v.returning=stop.id==='destination';v.visits++;v.speed=0;
    if(v.kind==='bus')events.busArrivals.push({stop:stop.id,time:+time.toFixed(2)});else events.deliveries++;
    // Keep diagnostics bounded during a long-running town session.
    if(events.busArrivals.length>100)events.busArrivals.shift();continue;
   }
   if(stopGap>2)v.lastStop=null;
   if(stopGap<clearance&&stop?.id!==v.lastStop){clearance=stopGap;reason='Approaching stop';}
   const leaderSpeed=v.blockedBy?.speed??0;
   const followSpeed=reason==='Following traffic'?leaderSpeed+Math.max(0,clearance-leaderSpeed*1.2)*.24:Infinity;
   const wanted=Math.min(v.maxSpeed,followSpeed,Math.sqrt(Math.max(0,2*3*clearance)));
   const old=v.status;v.status=reason;
   if(old!==reason&&reason==='Yielding to pedestrian')events.pedestrianYields++;
   if(old!==reason&&reason==='Yielding at junction')events.junctionYields++;
   v.speed=Math.max(0,Math.min(wanted,v.speed+dt*1.4));
   const travel=Math.max(0,Math.min(v.speed*dt,clearance));
   const queue=reason==='Yielding at junction'&&v.speed<.05?waitingJunction:null;
   if(v.queuedJunction!==queue){v.queuedJunction=queue;v.junctionWaitSince=time;}
   const next=sampleLane(v.path,v.distance+travel);
   if(travel){
    // The outer corner of a turning body can reach a pedestrian outside
    // the straight-ahead lane check. Protect the next oriented footprint.
    const body=footprint({...v,...next}),reach=body.hl+body.hw+1.5;
    const pedestrian=pedestrians.find(p=>Math.abs(p.x-body.c[0])<reach&&Math.abs(p.z-body.c[1])<reach&&
     pedestrianSweep.some(h=>pointInFootprint([p.x+(p.vx||0)*h,p.z+(p.vz||0)*h],body,.3)));
    if(pedestrian){
     if(old!=='Yielding to pedestrian'&&reason!=='Yielding to pedestrian')events.pedestrianYields++;
     v.speed=0;v.status='Yielding to pedestrian';v.blockedBy=null;v.crossingYield=Boolean(pedestrian.crossing);
     continue;
    }
   }
   const blocker=travel&&sweepBlocker(v,{...v,...next},fleet);
   if(blocker){v.blockedBy=blocker;v.speed=0;v.status='Yielding to traffic';continue;}
   const oldLap=Math.floor(v.distance/v.path.length);
   v.distance+=travel;if(Math.floor(v.distance/v.path.length)>oldLap)events.laps++;
   Object.assign(v,next);
  }
  releaseWaitCycles(vehicles,junctions,events.deadlocksReleased);
 }
 return {roads,routes,vehicles,parked,junctions,events,stops:[...TRAFFIC_STOPS,...WEST_STOPS],
  update(dt,pedestrians=[],others=[],hour=10){if(!Number.isFinite(dt)||dt<=0)return;let left=Math.min(dt,1);while(left>1e-8){const step=Math.min(left,1/30);tick(step,pedestrians,others,hour);left-=step;}},
  audit(){return {time:+time.toFixed(2),vehicles:vehicles.map(({id,kind,position,speed,status,visits,stoppedAt})=>({id,kind,position:[...position],speed,status,visits,stoppedAt})),events:structuredClone(events)};}
 };
}
