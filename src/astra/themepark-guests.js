import * as THREE from 'three';
import {PARK_NODES,PARK_ACTIVITIES,QUEUES,RIDE_QUEUES,RIDES,parkRoute,sampleWalk,routeLength,residentSeats} from './themepark-plan.js';

// Pinecrest's own visitor population. Guests read the same activity records as
// the life registry: they walk the path graph, join a ride's queue and shuffle
// forward, board when the ride dispatches, ride in a real seat, then eat, play
// a midway game or watch the rides. Seats reserved for town residents (the
// highest seat numbers of each ride) are never handed to guests.
const SPACING = .82;

function rng(seed){let s=seed>>>0||1;return ()=>{s=Math.imul(s^s>>>15,2246822507)^Math.imul(s^s>>>13,3266489909);s^=s>>>16;return (s>>>0)/4294967296;};}
const pick=(list,r)=>list[Math.floor(r()*list.length)%list.length];

export function createGuestSim({count=180,rides,seed=5207,start=-160}){
 const byKind={ride:[],eat:[],play:[],watch:[]};
 for(const a of PARK_ACTIVITIES){
  if(a.activity==='ride')byKind.ride.push(a);
  else if(a.activity==='picnic')byKind.eat.push(a);
  else if(a.activity==='play')byKind.play.push(a);
  else if(a.activity==='watch')byKind.watch.push(a);
 }
 const queueLength=Object.fromEntries(Object.entries(QUEUES).map(([id,p])=>[id,routeLength(p)]));
 const queues=Object.fromEntries(RIDES.map(r=>[r.id,[]])),occupied=new Set(),riders=new Map(),cursor={};
 const guests=[];
 const nodes=Object.keys(PARK_NODES).filter(k=>k!=='gate');
 for(let i=0;i<count;i++){
  const r=rng(seed+i*7919),g={i,r,speed:1.05+r()*.42,node:pick(nodes,r),mode:'idle',until:start,path:null,pathStart:0,pathLength:0,activity:null,slot:null,ride:null,seat:null,queueD:0,position:[0,0],yaw:0,seated:false,hidden:false,state:'walking',visits:0};
  const p=PARK_NODES[g.node];g.position=[p[0]+(r()-.5)*3,p[1]+(r()-.5)*3];
  guests.push(g);
 }
 let now=start;
 const walk=(g,points,then)=>{g.mode='walk';g.path=points;g.pathStart=now;g.pathLength=routeLength(points);g.then=then;g.state='walking';g.seated=false;g.hidden=false;};
 function choose(g){
  const roll=g.r();
  const kind=roll<.5?'ride':roll<.66?'eat':roll<.8?'play':'watch';
  const options=byKind[kind];let a=pick(options,g.r);
  if(kind==='ride'){const rideId=a.ride;walk(g,parkRoute(g.node,RIDE_QUEUES[rideId].node),()=>joinQueue(g,rideId));g.target=a;return;}
  // Free slot or another choice next time.
  const free=a.slots.map((s,k)=>k).filter(k=>!occupied.has(a.id+'/'+k));
  if(!free.length){g.mode='idle';g.until=now+3+g.r()*4;return;}
  const k=pick(free,g.r),slot=a.slots[k];occupied.add(a.id+'/'+k);g.activity=a;g.slot=k;
  const route=parkRoute(g.node,a.node).concat(slot.approach||[],[slot.position]);
  walk(g,route,()=>{g.mode='act';g.until=now+a.duration*(.7+g.r()*.6);g.state=a.activity==='picnic'?'eating':a.activity==='play'?'playing':'watching';g.position=[...slot.position];g.yaw=slot.facing;g.seated=a.kind==='seat';g.hidden=!!a.hidden;});
 }
 function joinQueue(g,rideId){g.mode='queue';g.ride=rideId;g.queueD=0;g.state='queueing';queues[rideId].push(g);}
 function leaveActivity(g){
  const a=g.activity,slot=a.slots[g.slot];occupied.delete(a.id+'/'+g.slot);g.activity=null;g.visits++;
  const back=[slot.position,...[...(slot.approach||[])].reverse(),PARK_NODES[a.node]];g.node=a.node;
  walk(g,back,()=>{g.mode='idle';g.until=now;});
 }
 function dispatch(rideId,event){
  const q=queues[rideId],cap=rides.capacity(rideId);if(!cap)return;
  const spec=RIDES.find(r=>r.id===rideId);
  // Seats offered by this dispatch (coaster: one train, wheel: one gondola).
  let seats;
  if(spec.kind==='coaster')seats=Array.from({length:18},(_,k)=>event.train*18+k);
  else if(spec.kind==='wheel')seats=[event.gondola*2,event.gondola*2+1];
  else seats=Array.from({length:cap},(_,k)=>k);
  seats=seats.filter(s=>s<cap-residentSeats(spec));
  const front=queueLength[rideId]-Math.max(6,seats.length*SPACING+2);
  let n=0;
  while(q.length&&n<seats.length&&q[0].queueD>=front){const g=q.shift();g.mode='ride';g.state='riding';g.seat=seats[n++];g.until=event.time+rides.rideTime(rideId);g.boardAt=event.time;g.seated=true;riders.set(g.i,g);}
 }
 function step(t){
  const dt=Math.min(.5,Math.max(0,t-now));now=t;
  // Ride dispatches since the last step.
  for(const ride of RIDES){
   cursor[ride.id]??=now-dt;
   for(let guard=0;guard<40;guard++){const ev=rides.nextBoarding(ride.id,cursor[ride.id]);if(!ev||ev.time>now)break;dispatch(ride.id,ev);cursor[ride.id]=ev.time+1e-3;}
  }
  for(const [id,q]of Object.entries(queues)){const L=queueLength[id];q.forEach((g,rank)=>{g.queueD=Math.min(L-rank*SPACING,g.queueD+g.speed*.8*dt);const pose=sampleWalk(QUEUES[id],Math.max(0,g.queueD));g.position=[pose.x,pose.z];g.yaw=pose.yaw;});}
  for(const g of guests){
   if(g.mode==='idle'&&now>=g.until)choose(g);
   else if(g.mode==='walk'){const d=(now-g.pathStart)*g.speed;const pose=sampleWalk(g.path,Math.min(d,g.pathLength));g.position=[pose.x,pose.z];g.yaw=pose.yaw;if(d>=g.pathLength){const then=g.then;g.then=null;then();}}
   else if(g.mode==='act'&&now>=g.until)leaveActivity(g);
   else if(g.mode==='ride'&&now>=g.until){riders.delete(g.i);const q=RIDE_QUEUES[g.ride];g.node=q.node;g.visits++;g.seated=false;g.mode='walk';walk(g,[q.board,q.exit,PARK_NODES[q.node]],()=>{g.mode='idle';g.until=now+g.r()*2;});g.ride=null;g.seat=null;}
  }
 }
 // Fill the park before the first frame.
 for(let t=start;t<0;t+=.5)step(t);
 return {guests,queues,riders,step,get now(){return now;},
  audit(){const states={};for(const g of guests)states[g.state]=(states[g.state]||0)+1;return {count:guests.length,states,queues:Object.fromEntries(Object.entries(queues).map(([k,q])=>[k,q.length])),riding:Object.fromEntries(RIDES.map(r=>[r.id,guests.filter(g=>g.mode==='ride'&&g.ride===r.id).length]))};}};
}

/** Instanced townsfolk for the sim: standing and seated meshes per role. */
export async function buildGuestCrowd(parent,sim,rides,{place,residentPoses}){
 const roles=['child','shopkeeper','herbalist','merchant'],batches=[];
 const root=new THREE.Group();root.name='Pinecrest crowd';parent.add(root);
 for(const [r,role]of roles.entries()){
  const members=sim.guests.filter(g=>g.i%roles.length===r);
  for(const seated of [false,true]){
   const template=await place('townsfolk-'+role);
   if(seated)residentPoses(template).setSeat(true);
   template.updateMatrixWorld(true);
   template.traverse(part=>{if(!part.isMesh)return;const mesh=new THREE.InstancedMesh(part.geometry,part.material,members.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=part.castShadow&&!part.userData.outline;root.add(mesh);batches.push({mesh,members,seated,local:part.matrixWorld.clone()});});
  }
 }
 const transform=new THREE.Object3D(),seat=new THREE.Matrix4(),scale=new THREE.Matrix4(),out=new THREE.Matrix4();
 const matrices=sim.guests.map(()=>new THREE.Matrix4());
 return {update(t,draw=true){
  root.visible=draw;
  if(!draw)return;
  for(const g of sim.guests){
   if(g.hidden)continue;
   const m=matrices[g.i];
   const s=.8+(g.i%3)*.06;
   if(g.mode==='ride'&&rides.seatMatrix(g.ride,g.seat,seat)){scale.makeScale(s,s,s);m.multiplyMatrices(seat,scale);continue;}
   const y=g.seated?(g.activity?.seatHeight||.46)*1.12:.16;
   transform.position.set(g.position[0],y+(g.mode==='walk'?Math.abs(Math.sin(t*7+g.i))*.05:0),g.position[1]);
   transform.rotation.set(0,g.yaw,g.mode==='walk'?Math.sin(t*7+g.i)*.035:0);transform.scale.setScalar(s);transform.updateMatrix();m.copy(transform.matrix);
  }
  for(const {mesh,members,seated,local}of batches){
   let count=0;
   for(const g of members)if(!g.hidden&&g.seated===seated)mesh.setMatrixAt(count++,out.multiplyMatrices(matrices[g.i],local));
   mesh.count=count;
   mesh.instanceMatrix.needsUpdate=true;
  }
 }};
}
