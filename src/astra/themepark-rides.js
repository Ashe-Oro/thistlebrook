import * as THREE from 'three';
import {COPPERHEAD,RIDES,TRAM_LINE} from './themepark-plan.js';
import {KIT_SCALE,coasterPath,coasterTimetable,coasterSupports} from './themepark-coaster.js';
import {fairgroundModel,fairgroundMesh,loadFairgroundDetail,splitFairground,fairgroundAsset} from './themepark-assets.js';

// Shared run profile for flat rides: load (stopped), ramp up, run, ramp down.
// Returns the accumulated angle, continuous across cycles.
export function spinAngle(t,{cycle,load,omega,ramp=4}){
 const run=cycle-load,per=omega*(run-ramp),k=Math.floor(t/cycle),p=t-k*cycle;
 let a=0;
 if(p>load){const u=p-load;a=u<ramp?omega*u*u/(2*ramp):u<run-ramp?omega*(u-ramp/2):per-omega*(run-u)**2/(2*ramp);}
 return k*per+a;
}
export function rideSpeed(t,spec){const h=.05;return (spinAngle(t+h,spec)-spinAngle(t-h,spec))/(2*h);}
// Drop tower carriage height (source units above its rest) through one cycle.
export function dropHeight(t,cycle=30){
 const p=((t%cycle)+cycle)%cycle,top=7.6;
 if(p<7)return 0;if(p<19)return top*(.5-.5*Math.cos(Math.PI*(p-7)/12));if(p<22)return top;
 if(p<23.4){const u=(p-22)/1.4;return top*(1-u*u);}
 if(p<24.6){const u=(p-23.4)/1.2;return Math.max(0,.35*Math.sin(Math.PI*u)*(1-u));}
 return 0;
}

/** Build every Pinecrest ride. Static kit pieces go to `staticRoot` (batched), moving parts to `moving`. */
export async function buildParkRides(staticRoot,moving,{detail}={}){
 const rides={},anchors={},meshes=[];
 const ride=id=>RIDES.find(r=>r.id===id);
 const frame=spec=>{const g=new THREE.Group();g.position.set(spec.x,0,spec.z);g.rotation.y=spec.rot||0;g.scale.setScalar(spec.scale||1);g.userData.ownedAsset=fairgroundAsset(spec.asset);g.userData.ownedPath='fairground/'+spec.asset+'.glb';moving.add(g);return g;};
 const part=(geometry,parent,scale,pivot=[0,0,0])=>{const g=new THREE.Group();g.position.set(...pivot);parent.add(g);if(geometry?.attributes.position?.count){const m=fairgroundMesh(geometry,scale);g.add(m);meshes.push(m);}return g;};
 const anchor=(parent,pos,yaw=0)=>{const a=new THREE.Object3D();a.position.set(...pos);a.rotation.y=yaw;parent.add(a);return a;};

 // ---- Copperhead: kit pieces, supports, stations and two trains.
 {
  const spec=ride('copperhead'),path=coasterPath(COPPERHEAD.centre),timetable=coasterTimetable(path,{dwell:9});
  const jobs=[];
  for(const p of COPPERHEAD.pieces){
   jobs.push(fairgroundModel(p.asset,{x:p.position[0],y:p.base,z:p.position[1],rot:p.yaw,scale:p.scale,detail}).then(o=>staticRoot.add(o)));
  }
  // A stacked support tower carries every raised piece down to the lawn.
  for(const t of coasterSupports(COPPERHEAD.pieces))jobs.push(fairgroundModel('coaster_support',{x:t.x,z:t.z,rot:t.yaw,scale:[KIT_SCALE,t.height,KIT_SCALE],detail}).then(o=>staticRoot.add(o)));
  await Promise.all(jobs);
  const carGeometry=await loadFairgroundDetail('roller_coaster_car',detail),trains=[];
  for(let j=0;j<2;j++){
   const cars=[];
   for(let c=0;c<3;c++){
    const car=new THREE.Group();car.userData.ownedAsset=fairgroundAsset('roller_coaster_car');car.userData.ownedPath='fairground/roller_coaster_car.glb';car.userData.placementOrdinal=j*3+c;moving.add(car);
    const body=new THREE.Group();body.scale.setScalar(KIT_SCALE);car.add(body);body.add(fairgroundMesh(carGeometry,KIT_SCALE));
    // Two riders per car, three cars per model.
    for(const z of [.72,0,-.72])for(const x of [-.22,.22])(anchors.copperhead??=[]).push(anchor(body,[x,.42,z-.06]));
    cars.push(car);
   }
   trains.push(cars);
  }
  rides.copperhead={spec,path,timetable,trains,
   boardings:(t)=>[0,1].map(j=>{const offset=j*timetable.gap;return {train:j,time:Math.ceil((t+offset)/timetable.period)*timetable.period-offset};}),
   update(t){trains.forEach((cars,j)=>{const d=timetable.distanceAt(t+j*timetable.gap);cars.forEach((car,c)=>{const front=path.sample(d-c*2.6*KIT_SCALE+1.2),back=path.sample(d-c*2.6*KIT_SCALE-1.2),mid=path.sample(d-c*2.6*KIT_SCALE);car.position.set(mid.x,mid.y-.12*KIT_SCALE,mid.z);car.lookAt(car.position.x+front.x-back.x,car.position.y+front.y-back.y,car.position.z+front.z-back.z);});});},
  };
 }

 // ---- Skyline Wheel: rotating wheel and sixteen level gondolas.
 {
  const spec=ride('skyline-wheel'),g=frame(spec),geometry=await loadFairgroundDetail('ferris_wheel',detail);
  const hub=[0,6.55,0],R=4.72,N=16,angles=Array.from({length:N},(_,k)=>-Math.PI/2+k*Math.PI*2/N);
  const pivots={wheel:hub};angles.forEach((a,k)=>pivots['g'+k]=[hub[0]+R*Math.cos(a),hub[1]+R*Math.sin(a),0]);
  const parts=splitFairground(geometry,c=>{
   if(Math.max(...c.size)<1.45&&Math.abs(c.center[2])<.95)for(let k=0;k<N;k++){const p=pivots['g'+k];if(Math.hypot(c.center[0]-p[0],c.center[1]-(p[1]-.62))<.95)return 'g'+k;}
   if(c.min[1]>.45&&Math.abs(c.center[2])<1.05&&Math.hypot(c.center[0]-hub[0],c.center[1]-hub[1])<5.6)return 'wheel';
   return null;
  },pivots);
  part(parts.static,g,spec.scale);
  const wheel=part(parts.wheel,g,spec.scale,hub),gondolas=angles.map((a,k)=>{const gg=part(parts['g'+k],g,spec.scale,pivots['g'+k]);for(const x of [-.28,.28])(anchors['skyline-wheel']??=[]).push(anchor(gg,[x,-.6,.05]));return gg;});
  const omega=Math.PI*2/spec.cycle;
  rides['skyline-wheel']={spec,group:g,boardings:t=>{const step=spec.cycle/N,m=Math.ceil(t/step);return [{gondola:((-m%N)+N)%N,time:m*step}];},
   update(t){const a=omega*t;wheel.rotation.z=a;angles.forEach((b,k)=>gondolas[k].position.set(hub[0]+R*Math.cos(b+a),hub[1]+R*Math.sin(b+a),0));}};
 }

 // ---- Woodland Carousel: rotating deck, bobbing horses on brass poles.
 {
  const spec=ride('carousel'),g=frame(spec),geometry=await loadFairgroundDetail('gallopers_carousel',detail);
  const poles=[];for(let k=0;k<8;k++){const a=k*Math.PI/4;poles.push([2.28*Math.cos(a),2.28*Math.sin(a)],[1.52*Math.cos(a+Math.PI/8),1.52*Math.sin(a+Math.PI/8)]);}
  const parts=splitFairground(geometry,c=>{
   if(c.max[1]<.2)return null;
   if(c.min[1]>.9&&c.max[1]<2.05&&Math.max(c.size[0],c.size[2])<1.1){let best=-1,d=.75;poles.forEach((p,k)=>{const e=Math.hypot(c.center[0]-p[0],c.center[2]-p[1]);if(e<d){d=e;best=k;}});if(best>=0)return 'h'+best;}
   return 'deck';
  });
  part(parts.static,g,spec.scale);
  const deck=part(parts.deck,g,spec.scale),horses=poles.map((p,k)=>{const h=part(parts['h'+k],deck,spec.scale);const tangent=Math.atan2(p[0],p[1])+Math.PI/2;(anchors.carousel??=[]).push(anchor(h,[p[0],1.5,p[1]],tangent));return h;});
  const run={cycle:spec.cycle,load:10,omega:Math.PI*2/14};
  rides.carousel={spec,group:g,run,boardings:t=>[{time:Math.ceil(t/spec.cycle)*spec.cycle}],update(t){deck.rotation.y=spinAngle(t,run);const v=rideSpeed(t,run)/run.omega;horses.forEach((h,k)=>h.position.y=v*.22*Math.sin(t*2.2+k*1.7));}};
 }

 // ---- Teacup Twirl: turning saucer with six spinning cups.
 {
  const spec=ride('teacup-twirl'),g=frame(spec),geometry=await loadFairgroundDetail('teacups',detail);
  const cups=[[1.3,.75],[0,1.5],[-1.3,.75],[-1.3,-.75],[0,-1.5],[1.3,-.75]],pivots={};cups.forEach((c,k)=>pivots['c'+k]=[c[0],0,c[1]]);
  const parts=splitFairground(geometry,c=>{
   if(c.max[1]<=.225)return null;
   if(c.min[1]>=.25&&c.max[1]<1.1)for(let k=0;k<6;k++)if(Math.hypot(c.center[0]-cups[k][0],c.center[2]-cups[k][1])<.82)return 'c'+k;
   return 'saucer';
  },pivots);
  part(parts.static,g,spec.scale);
  const saucer=part(parts.saucer,g,spec.scale),cupGroups=cups.map((c,k)=>{const cg=part(parts['c'+k],saucer,spec.scale,pivots['c'+k]);for(let s=0;s<3;s++){const a=s*Math.PI*2/3;(anchors['teacup-twirl']??=[]).push(anchor(cg,[.33*Math.cos(a),.42,.33*Math.sin(a)],Math.atan2(-Math.cos(a),-Math.sin(a))));}return cg;});
  const run={cycle:spec.cycle,load:9,omega:Math.PI*2/9};
  rides['teacup-twirl']={spec,group:g,run,boardings:t=>[{time:Math.ceil(t/spec.cycle)*spec.cycle}],update(t){const a=spinAngle(t,run);saucer.rotation.y=a;cupGroups.forEach((cg,k)=>cg.rotation.y=-a*(1.6+k*.13)+k);}};
 }

 // ---- Swingin' Pines: chair-o-plane canopy and twelve flying chairs.
 {
  const spec=ride('swinging-pines'),g=frame(spec),geometry=await loadFairgroundDetail('chair_o_plane',detail);
  const parts=splitFairground(geometry,c=>c.max[1]<.3||Math.hypot(c.center[0],c.center[2])<.7&&c.max[1]<3.35?null:'top');
  part(parts.static,g,spec.scale);
  const top=part(parts.top,g,spec.scale);
  for(let k=0;k<12;k++){const a=(-167.5+30*k)*Math.PI/180;(anchors['swinging-pines']??=[]).push(anchor(top,[1.93*Math.cos(a),1.4,1.93*Math.sin(a)],Math.atan2(Math.cos(a),Math.sin(a))+Math.PI/2));}
  const run={cycle:spec.cycle,load:9,omega:Math.PI*2/5.5,ramp:5};
  rides['swinging-pines']={spec,group:g,run,boardings:t=>[{time:Math.ceil(t/spec.cycle)*spec.cycle}],update(t){top.rotation.y=spinAngle(t,run);}};
 }

 // ---- Pinefall drop tower.
 {
  const spec=ride('pinefall'),g=frame(spec),geometry=await loadFairgroundDetail('drop_tower',detail);
  const parts=splitFairground(geometry,c=>c.min[1]>.28&&c.max[1]<1.5&&(Math.max(c.size[0],c.size[2])>1||Math.hypot(c.center[0],c.center[2])>.45)?'carriage':null);
  part(parts.static,g,spec.scale);
  const carriage=part(parts.carriage,g,spec.scale);
  for(let k=0;k<8;k++){const a=(22.5+45*k)*Math.PI/180;(anchors.pinefall??=[]).push(anchor(carriage,[.98*Math.cos(a),.78,.98*Math.sin(a)],Math.atan2(Math.cos(a),Math.sin(a))));}
  rides.pinefall={spec,group:g,boardings:t=>[{time:Math.ceil(t/spec.cycle)*spec.cycle}],update(t){carriage.position.y=dropHeight(t,spec.cycle);}};
 }

 // ---- Pine Bumpers: pavilion cars plus two loose bumper cars.
 {
  const spec=ride('pine-bumpers'),g=frame(spec),geometry=await loadFairgroundDetail('bumper_car_pavilion',detail);
  const centres=[[.11,.28],[1.39,1.23],[-1.28,1.11],[-.48,-1.22],[1.22,-1.04]],pivots={};centres.forEach((c,k)=>pivots['car'+k]=[c[0],0,c[1]]);
  const parts=splitFairground(geometry,c=>{if(c.min[1]<.18||c.max[1]>1.3||Math.max(c.size[0],c.size[2])>1.8)return null;for(let k=0;k<5;k++)if(Math.hypot(c.center[0]-centres[k][0],c.center[2]-centres[k][1])<1.05)return 'car'+k;return null;},pivots);
  part(parts.static,g,spec.scale);
  const cars=centres.map((c,k)=>part(parts['car'+k],g,spec.scale,pivots['car'+k]));
  for(let k=0;k<2;k++){const extra=await fairgroundModel('bumper_car',{scale:1/1.0,ordinal:k});extra.position.set(0,.34,0);g.add(extra);cars.push(extra);}
  cars.forEach(car=>(anchors['pine-bumpers']??=[]).push(anchor(car,[0,.55,-.08])));
  const paths=cars.map((_,k)=>({ax:1.2+.1*(k%3),az:1.15-.08*(k%2),fx:.31+.07*k,fz:.43+.05*((k*3)%5),p:k*1.9,q:k*2.7}));
  const position=(k,t)=>{const p=paths[k];return [p.ax*Math.sin(t*p.fx+p.p),p.az*Math.sin(t*p.fz+p.q)];};
  rides['pine-bumpers']={spec,group:g,boardings:t=>[{time:Math.ceil(t/spec.cycle)*spec.cycle}],update(t){
   const phase=t%spec.cycle,active=phase>8;
   cars.forEach((car,k)=>{const tt=active?t:Math.floor(t/spec.cycle)*spec.cycle+8,[x,z]=position(k,tt),[x2,z2]=position(k,tt+.1);car.position.x=x;car.position.z=z;car.rotation.y=Math.atan2(x2-x,z2-z);});
  }};
 }

 // ---- Little Racers: five kiddie cars circling a small track.
 {
  const spec=ride('little-racers'),g=new THREE.Group();g.position.set(spec.x,0,spec.z);moving.add(g);
  const ring=new THREE.Group();g.add(ring);const cars=[];
  for(let k=0;k<5;k++){const a=k*Math.PI*2/5,car=await fairgroundModel('kiddie_ride_car',{x:2.4*Math.cos(a),z:2.4*Math.sin(a),rot:Math.atan2(-Math.sin(a),Math.cos(a))+Math.PI,scale:spec.scale,ordinal:k});ring.add(car);cars.push(car);(anchors['little-racers']??=[]).push(anchor(car,[0,.46,-.12]));}
  const run={cycle:spec.cycle,load:8,omega:Math.PI*2/10};
  rides['little-racers']={spec,group:g,boardings:t=>[{time:Math.ceil(t/spec.cycle)*spec.cycle}],update(t){ring.rotation.y=-spinAngle(t,run);cars.forEach((c,k)=>c.position.y=Math.abs(Math.sin(t*3+k))*.04*rideSpeed(t,run)/run.omega);}};
 }

 // ---- Pinecrest Express tram: shuttles along the north walk.
 {
  const spec=ride('pinecrest-express'),tram=await fairgroundModel('park_tram',{scale:spec.scale,detail});moving.add(tram);
  for(const z of [.05,-.5,-1.05,-1.55])for(const x of [-.24,.24])(anchors['pinecrest-express']??=[]).push(anchor(tram.children[0],[x,.62,z]));
  const travel=(TRAM_LINE.to-TRAM_LINE.from-6),speed=3.2,dwell=(spec.cycle-2*travel/speed)/2;
  const state=t=>{const p=((t%spec.cycle)+spec.cycle)%spec.cycle,run=travel/speed;
   if(p<dwell)return {x:TRAM_LINE.to-3,dir:-1};if(p<dwell+run){const u=(p-dwell)/run;return {x:TRAM_LINE.to-3-travel*(u*u*(3-2*u)),dir:-1};}
   if(p<2*dwell+run)return {x:TRAM_LINE.from+3,dir:1};const u=(p-2*dwell-run)/run;return {x:TRAM_LINE.from+3+travel*(u*u*(3-2*u)),dir:1};};
  rides['pinecrest-express']={spec,tram,boardings:t=>[{time:Math.ceil(t/spec.cycle)*spec.cycle}],update(t){const s=state(t);tram.position.set(s.x,0,TRAM_LINE.z);tram.rotation.y=s.dir>0?Math.PI/2:-Math.PI/2;}};
 }

 const list=Object.values(rides),scratch=new THREE.Matrix4(),inverse=new THREE.Matrix4(),_p=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_one=new THREE.Vector3(1,1,1);
 return {
  rides,anchors,
  update(t){for(const r of list)r.update(t);moving.updateMatrixWorld(true);},
  /** Seat transform relative to the park root (for riders) — wraps by capacity. */
  seatMatrix(id,seat,target=new THREE.Matrix4()){const list=anchors[id];if(!list?.length)return null;const a=list[((seat%list.length)+list.length)%list.length];inverse.copy(moving.parent.matrixWorld).invert();scratch.multiplyMatrices(inverse,a.matrixWorld).decompose(_p,_q,_s);return target.compose(_p,_q,_one);},
  seatWorld(id,seat){const list=anchors[id];if(!list?.length)return null;const a=list[((seat%list.length)+list.length)%list.length],p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();a.matrixWorld.decompose(p,q,s);const f=new THREE.Vector3(0,0,1).applyQuaternion(q);return {position:[p.x,p.z],height:p.y,facing:Math.atan2(f.x,f.z)};},
  capacity:id=>anchors[id]?.length||0,
  nextBoarding(id,t){return rides[id].boardings(t).sort((a,b)=>a.time-b.time)[0];},
  rideTime(id){const r=rides[id];return id==='copperhead'?r.timetable.period:r.spec.cycle;},
  audit(){const c=rides.copperhead;return {copperhead:{length:c.path.length,period:c.timetable.period,pieces:COPPERHEAD.pieces.length,top:Math.max(...c.path.points.map(p=>p.y)),trains:c.trains.map(cars=>cars.map(car=>car.position.toArray().map(v=>+v.toFixed(2))))},wheel:rides['skyline-wheel'].group.children.length,seats:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,v.length]))};},
 };
}
