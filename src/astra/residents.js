import {createRigidBatches} from './rigid-batches.js';
import {bridgeDeck} from '../compiler/water.js';
import {tagObject} from './registry/render-tags.js';
import { SUNBEAM_RESIDENTS } from './sunbeam-layout.js';
import { MAPLE_HOLLOW_RESIDENTS, KID_SCALE } from './maple-hollow-plan.js';
import * as THREE from 'three';
import { createVillagerMixer } from '../life/villager-mixer.js';
import { animationPlan } from '../life/animation-plan.js';
import { place } from '../catalog/loader.js';
import { TOWNSFOLK } from '../catalog/townsfolk.js';
import { riverZ } from '../compiler/astra.js';
import { createLife } from './life/runtime.js';
import { buildLifeVisuals, residentPoses, activityPose } from './life/visuals.js';

// This adapter only displays executor state. NPC decisions and effects live in
// life/runtime.js; no ambient greetings, speech bubbles or independent wandering.
export async function createResidents(scene,town,options={}){
 const life=createLife(town,options),people=[];
 await Promise.all(life.actors.map(async(actor,n)=>{
  const terrace=SUNBEAM_RESIDENTS.find(p=>p.name===actor.context.name),maple=MAPLE_HOLLOW_RESIDENTS.find(p=>p.name===actor.context.name),model=terrace?TOWNSFOLK.find(m=>m.role===terrace.model):maple?TOWNSFOLK.find(m=>m.role===maple.model)||TOWNSFOLK[n%TOWNSFOLK.length]:TOWNSFOLK[n%TOWNSFOLK.length];
  // Maple Hollow kids use adult rigs at child height, like the Owls ballgame.
  const object=await place(model.id,{scale:maple?.kid&&model.role!=='child'?1.12*KID_SCALE:1.12,animated:true});scene.add(object);
  const body=object.children[0],mixer=createVillagerMixer(object,n),poses=mixer?null:residentPoses(object);
  const bat=new THREE.Mesh(new THREE.CylinderGeometry(.065,.04,1.1,8),new THREE.MeshStandardMaterial({color:'#b99765',roughness:1}));bat.position.set(.5,1,.4);bat.rotation.z=-.65;bat.visible=false;bat.userData.lifeAccessory=true;object.add(bat);tagObject(object,actor.context.assets.home);
  const spot=town.workstations?.find(p=>p.name===actor.context.name);
  people[n]={workplace:spot?{id:spot.venue,node:spot.node}:null,name:actor.context.name,role:actor.context.job.title,story:terrace?.story||(maple?(maple.kid?`Lives in Maple Hollow. Catches the yellow school bus on weekday mornings and plays in the backyards after school.`:`Lives in Maple Hollow and works ${maple.work?'at '+maple.work:'from home'}. Some evenings the neighbours gather round a grill.`):'A day shaped by work, small errands and favourite places.'),object,body,actor,mixer,poses,bat,model:model.id,lastTravel:0,poseTime:0,poseDistance:0,home:actor.context.assets.home,node:actor.context.location.node,route:[],destination:null,visits:0,activity:actor.activity,context:actor.context};
 }));
 const visuals=buildLifeVisuals(scene,life),byId=new Map(life.registry.places.map(p=>[p.id,p]));
 // Include space beyond the camera for tall ride seats and low-angle shadows.
 const viewSphere=new THREE.Sphere(new THREE.Vector3(),24);
 function visiblePose(person,view){
  if(!view)return true;
  viewSphere.center.copy(person.object.position);
  return person.object.visible&&view.intersectsSphere(viewSphere);
 }
 const rigid=createRigidBatches(scene);
 function sync(dt,t,view){
  for(const p of people){
   const a=p.actor,c=a.context;
   if(a.riding){p.object.visible=false;p.activity=a.activity;continue;}
   const where=byId.get(c.location.place),pose=activityPose(a,where,t),o=p.object;
   // school-day: anyone at Thistlebrook High who is not walking is indoors (the
   // classroom view draws the lesson), so nobody waits as a crowd on the steps.
   o.visible=!pose.indoors&&!(c.location.place==='school'&&a.action?.tool!=='walkTo');
   p.node=c.location.node;p.route=a.route;p.destination=byId.get(a.action?.target||c.location.place)||null;p.visits=a.arrivals;p.walkPace=life.walkPace(a);p.activity=life.travelWeather(a)==='hurrying'?'Hurrying through the rain':a.activity;
   if(p.mixer){
    const slot=where?.interaction?.slots.find(s=>s.id===c.location.slot);
    const selected=byId.get(a.action?.target)||where;
    const distance=a.travelled-p.lastTravel;
    const movement=pose.run?Math.hypot(pose.position[0]-o.position.x,pose.position[1]-o.position.z):distance;
    const plan=animationPlan({tool:a.action?.tool,place:selected,slot,position:c.location.position,
     role:p.model.slice('townsfolk-'.length),moving:movement>0,greeting:a.greetingUntil>life.elapsed&&!pose.indoors,variant:a.index});
    if(pose.riding&&Number.isFinite(plan.seatHeight))plan.seatHeight=pose.height;
    p.animation={plan,slot,position:c.location.position};
    p.lastTravel=a.travelled;
    // Maple Hollow yard slots (treehouse, hoop, pool) lift or sink the body.
    const y=(slot?.groundHeight??bridgeDeck(town,pose.position)??(Math.abs(pose.position[0]+57)<6.8&&Math.abs(pose.position[1]+6)<6.8?.19:.15))+(pose.lift||0);
    o.position.set(pose.position[0],y,pose.position[1]);
    o.rotation.set(0,pose.facing,0);
    p.body.visible=visiblePose(p,view);
    p.bat.visible=p.body.visible&&pose.bat;
    if(p.body.visible){
     p.mixer.update(plan,{dt:dt+p.poseTime,distance:movement+p.poseDistance,facing:pose.facing,immediate:p.poseTime>.5});
     p.poseTime=p.poseDistance=0;
    }else{
     p.poseTime+=dt;
     p.poseDistance+=movement;
    }
    continue;
   }
   let y=bridgeDeck(town,pose.position)??.15;
   const walking=a.action?.tool==='walkTo'||pose.run;
   if(pose.seated)y=pose.height+.08;
   if(pose.lift)y+=pose.lift;
   o.position.set(pose.position[0],y+(walking?Math.abs(Math.sin(t*8+p.actor.index))*.05:0),pose.position[1]);
   o.rotation.set(pose.lean,pose.facing,walking?Math.sin(t*8+p.actor.index)*.035:0);
   p.body.visible=visiblePose(p,view);
   p.bat.visible=p.body.visible&&pose.bat;
   if(p.body.visible)p.poses.setSeat(pose.seated);
   if(a.pose==='work')o.rotation.x=Math.sin(t*2+p.actor.index)*.045;
   if(a.pose==='eat')o.rotation.x=Math.sin(t*1.4+p.actor.index)*.035;
  }
  visuals.update();
  rigid.update();
 }
 sync(0,0);
 return {people,life,visuals,setHour:h=>life.setHour(h),update(dt,t,hour,view){life.update(dt,hour);sync(dt,t,view);},pick(ray){
  let result=null,best=Infinity;
  for(const p of people){if(!p.object.visible)continue;const center=p.object.position.clone().add(new THREE.Vector3(0,.8,0)),sphere=new THREE.Sphere(center,.75),hit=ray.intersectSphere(sphere,new THREE.Vector3());if(hit){const d=ray.origin.distanceTo(hit);if(d<best){result=p;best=d;}}}
  return result;
 }};
}
