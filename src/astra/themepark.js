import {tagDistrictModels} from './registry/district-models.js';
import * as THREE from 'three';
import {place} from '../catalog/loader.js';
import {toonMaterial} from '../toon.js';
import {districtKit} from './downtown-kit.js';
import {makeRng} from '../compiler/rng.js';
import {PARK_ORIGIN,PARK_MOUNTAINS,APPROACH,RIDES,BIG_TOP} from './themepark-plan.js';
import {buildParkRides} from './themepark-rides.js';
import {buildMidway} from './themepark-midway.js';
import {createGuestSim,buildGuestCrowd} from './themepark-guests.js';
import {parkNight,parkTime} from './themepark-assets.js';
import {residentPoses,registerRidePoses} from './life/visuals.js';
import {packVehicle} from './vehicle-models.js';
import {LOT_RESERVE,pinecrestModel,shuttlePose} from './fair-lot-plan.js';

export async function buildThemePark(scene,town,{detail}={}){
 const root=new THREE.Group();root.name='Pinecrest Adventure Park';root.position.set(PARK_ORIGIN[0],0,PARK_ORIGIN[1]);scene.add(root);
 const kit=districtKit(root),landKit=districtKit(scene),{box,orb,drum,sign}=kit;
 const moving=new THREE.Group();root.add(moving);const jobs=[],selectables=[],rng=makeRng(5196),random=()=>rng.float();
 function ribbon(points,width,color,y,parent=kit.root){
  const verts=[],indices=[];
  points.forEach((p,i)=>{const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],dx=after[0]-before[0],dz=after[1]-before[1],len=Math.hypot(dx,dz)||1;verts.push(p[0]-dz/len*width/2,Array.isArray(y)?y[i]:y,p[1]+dx/len*width/2,p[0]+dz/len*width/2,Array.isArray(y)?y[i]:y,p[1]-dx/len*width/2);if(i<points.length-1){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setIndex(indices);geometry.computeVertexNormals();const m=new THREE.Mesh(geometry,toonMaterial(color));m.receiveShadow=true;parent.add(m);return m;
 }
 function terrain(points,color,top=-.05){const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:2.6,bevelEnabled:false}),[toonMaterial(color),toonMaterial('#ae9a78')]);mesh.rotation.x=Math.PI/2;mesh.position.y=top;mesh.receiveShadow=true;scene.add(mesh);}
 const outline=[[64,-97],[84,-108],[108,-101],[129,-86],[159,-94],[177,-117],[221,-147],[271,-142],[284,-93],[286,-52],[280,-13],[265,17],[227,28],[188,26],[164,18],[143,27],[113,16],[92,6],[64,5]];terrain(outline,'#9eaf77');
 const inside=(x,z)=>{let result=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
 // Wide mountain road: shoulders, asphalt, centre dashes and outside guardrails.
 const road=new THREE.CatmullRomCurve3(APPROACH.map(([x,z])=>new THREE.Vector3(x,0,z))),roadPoints=road.getPoints(350).map(p=>[p.x,p.z]);
 ribbon(roadPoints,7,'#c6b894',.02,landKit.root);ribbon(roadPoints,5.2,'#7c8980',.05,landKit.root);
 for(let i=0;i<140;i++){const p=road.getPointAt(i/140),t=road.getTangentAt(i/140),dash=landKit.box(p.x,.075,p.z,.12,.025,.8,'#efdeb1');dash.rotation.y=Math.atan2(t.x,t.z);if(i>15&&i<103&&i%2===0){const x=p.x+t.z*3.1,z=p.z-t.x*3.1;landKit.box(x,.55,z,.13,1,.13,'#b5aa8d');const rail=landKit.box(x,.9,z,.14,.14,2.6,'#dfceb0');rail.rotation.y=Math.atan2(t.x,t.z);}}
 const mountainGeo=new THREE.ConeGeometry(1,1,7,1),rockGeo=new THREE.IcosahedronGeometry(1,0);
 for(const [x,z,w,h]of PARK_MOUNTAINS){
  const m=new THREE.Mesh(mountainGeo,toonMaterial('#929c80'));m.position.set(x,h/2-.2,z);m.scale.set(w,h,w*.8);m.rotation.y=x;m.userData.scenery=m.material.userData.scenery=true;landKit.root.add(m);
  const cap=new THREE.Mesh(mountainGeo,toonMaterial('#d9d9be'));cap.position.set(x,h*.84,z);cap.scale.set(w*.33,h*.33,w*.8*.33);cap.rotation.y=x;cap.userData.scenery=cap.material.userData.scenery=true;landKit.root.add(cap);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2,r=new THREE.Mesh(rockGeo,toonMaterial('#9caa88'));r.position.set(x+Math.sin(a)*w*.8,2,z+Math.cos(a)*w*.65);r.scale.set(4,3,4);r.userData.scenery=r.material.userData.scenery=true;landKit.root.add(r);}
 }
 // Owned pine trees are shared/instanced at bake time. Canopies clear the road.
 const pine=await place('cv-tree-pine');
 for(let i=0;i<200;i++){
  const x=70+random()*205,z=-101+random()*119;
  if(town?.regions.some(r=>r.id!=='themepark'&&x>r.bounds.minX-3&&x<r.bounds.maxX+3&&z>r.bounds.minZ-3&&z<r.bounds.maxZ+3))continue;
  if(!inside(x-3,z-3)||!inside(x+3,z+3)||!inside(x-3,z+3)||!inside(x+3,z-3))continue;
  if(x>174&&z>-110&&z<10)continue;
  if(roadPoints.some(p=>Math.hypot(x-p[0],z-p[1])<6))continue;
  if(z>15||z<-95&&x<170)continue;
  if(x>LOT_RESERVE.minX-3&&x<LOT_RESERVE.maxX+3&&z>LOT_RESERVE.minZ-3&&z<LOT_RESERVE.maxZ+3){random();random();continue;} // Funfair Parking (grok-fairlot); keep the rng in step
  const tree=pine.clone();tree.position.set(x,0,z);tree.rotation.y=random()*6.28;tree.scale.setScalar(.65+random()*.7);landKit.root.add(tree);
 }
 // Inside the fence: the Fairground pack on a 4 m midway grid, animated rides
 // and Pinecrest's own crowd. Layout and activity points live in themepark-plan.js.
 const midway=await buildMidway(kit,moving,{pine,detail});
 const rides=await buildParkRides(kit.root,moving,{detail});
 const sim=createGuestSim({rides});
 const crowd=await buildGuestCrowd(moving,sim,rides,{place,residentPoses});
 registerRidePoses((rideId,seat,t,startedAt)=>{
  // Residents wait at their loading mark, then ride one dispatch in a real seat.
  const boarding=rides.nextBoarding(rideId,startedAt+1.5),spec=RIDES.find(r=>r.id===rideId);if(!boarding||!spec)return null;
  let s=seat;if(spec.kind==='coaster')s=boarding.train*18+(seat%18);if(spec.kind==='wheel')s=boarding.gondola*2+(seat%2);
  if(t<boarding.time||t>boarding.time+rides.rideTime(rideId))return null;
  const pose=rides.seatWorld(rideId,s);return pose;
 });
 // A pair of shuttle buses makes the trip from the edge of town visible.
 const shuttles=await Promise.all([0,1].map(async i=>{
  const bus=await packVehicle(pinecrestModel(i));bus.name='Pinecrest shuttle '+i;scene.add(bus);return bus;
 }));
 landKit.sign('PINECREST  ↗',78,3,-13,10,1.3,'#527a66');for(const x of [74,82])landKit.box(x,1.5,-13,.16,3,.16,'#8d825c');
 for(const r of [...RIDES,BIG_TOP]){
  const w=r.w||12,d=r.d||12,h=r.h||12,story=r.story||'The circus tent at the end of the north walk. Guests file in through the flap for the next show.';
  selectables.push({type:'venue',data:{id:r.id,name:r.name,district:'themepark',story},bounds:new THREE.Box3(new THREE.Vector3(PARK_ORIGIN[0]+r.x-w/2,0,PARK_ORIGIN[1]+r.z-d/2),new THREE.Vector3(PARK_ORIGIN[0]+r.x+w/2,h,PARK_ORIGIN[1]+r.z+d/2))});
 }
 selectables.push({type:'venue',data:{id:'pinecrest',name:'Pinecrest Adventure Park',district:'themepark',story:'Beyond the mountain pass: Copperhead, nine rides and a midway that glows after dark. Tickets at the arch; the forest shuttle winds back to Lantern Quay.'},bounds:new THREE.Box3(new THREE.Vector3(PARK_ORIGIN[0]-14,0,PARK_ORIGIN[1]+46),new THREE.Vector3(PARK_ORIGIN[0]+14,11,PARK_ORIGIN[1]+56))});
 selectables.push({type:'venue',data:{id:'pinecrest-midway',name:'Pinecrest Midway',district:'themepark',story:'Hoopla, ring toss, a shooting gallery and a shelf of prizes on one side of the street; cotton candy, popcorn, ice cream and hot dogs on the other.'},bounds:new THREE.Box3(new THREE.Vector3(PARK_ORIGIN[0]-24,0,PARK_ORIGIN[1]+26),new THREE.Vector3(PARK_ORIGIN[0]+24,5,PARK_ORIGIN[1]+44))});
 // Register every placed pack model (static and moving) before batching.
 tagDistrictModels(moving,town,'themepark',PARK_ORIGIN);
 await Promise.all(jobs);tagDistrictModels(kit.root,town,'themepark',PARK_ORIGIN);tagDistrictModels(landKit.root,town,'themepark');kit.bake();landKit.bake();
 let lastT=0;
 return{root,selectables,rides,sim,update(t,night,hour){lastT=t;parkNight.value=night;parkTime.value=t;rides.update(t);sim.step(t);crowd.update(t);midway.update(t);kit.update(night);shuttles.forEach((bus,i)=>{const v=shuttlePose(i,t);bus.position.set(v.position[0],.06,v.position[1]);bus.rotation.y=Math.atan2(...v.direction);});},audit(){return{time:lastT,rides:rides.audit(),guests:sim.audit(),positions:sim.guests.map(g=>({id:g.i,state:g.state,position:g.position})),shuttles:shuttles.map(s=>s.position.toArray()),rideCount:RIDES.length};}};
}
