import {bridgeDeck} from '../compiler/water.js';
import {tagObject} from './registry/render-tags.js';
import { SUNBEAM_RESIDENTS } from './sunbeam-layout.js';
import * as THREE from 'three';
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
  const terrace=SUNBEAM_RESIDENTS.find(p=>p.name===actor.context.name),model=terrace?TOWNSFOLK.find(m=>m.role===terrace.model):TOWNSFOLK[n%TOWNSFOLK.length];
  const object=await place(model.id,{scale:1.12});scene.add(object);
  const poses=residentPoses(object);
  const bat=new THREE.Mesh(new THREE.CylinderGeometry(.065,.04,1.1,8),new THREE.MeshStandardMaterial({color:'#b99765',roughness:1}));bat.position.set(.5,1,.4);bat.rotation.z=-.65;bat.visible=false;bat.userData.lifeAccessory=true;object.add(bat);tagObject(object,actor.context.assets.home);
  const spot=town.workstations?.find(p=>p.name===actor.context.name);
  people[n]={workplace:spot?{id:spot.venue,node:spot.node}:null,name:actor.context.name,role:actor.context.job.title,story:terrace?.story||'A day shaped by work, small errands and favourite places.',object,actor,poses,bat,home:actor.context.assets.home,node:actor.context.location.node,route:[],destination:null,visits:0,activity:actor.activity,context:actor.context};
 }));
 const visuals=buildLifeVisuals(scene,life),byId=new Map(life.registry.places.map(p=>[p.id,p]));
 function sync(t){
  for(const p of people){
   const a=p.actor,c=a.context,where=byId.get(c.location.place),pose=activityPose(a,where,t),o=p.object;
   p.node=c.location.node;p.route=a.route;p.destination=byId.get(a.action?.target||c.location.place)||null;p.visits=a.arrivals;p.activity=a.activity;
   p.poses.setSeat(pose.seated);p.bat.visible=pose.bat;
   let y=bridgeDeck(town,pose.position)??.15;
   const walking=a.action?.tool==='walkTo'||pose.run;
   if(pose.seated)y=pose.height+.08;
   o.position.set(pose.position[0],y+(walking?Math.abs(Math.sin(t*8+p.actor.index))*.05:0),pose.position[1]);
   o.rotation.set(pose.lean,pose.facing,walking?Math.sin(t*8+p.actor.index)*.035:0);
   if(a.pose==='work')o.rotation.x=Math.sin(t*2+p.actor.index)*.045;
   if(a.pose==='eat')o.rotation.x=Math.sin(t*1.4+p.actor.index)*.035;
  }
  visuals.update();
 }
 sync(0);
 return {people,life,visuals,setHour:h=>life.setHour(h),update(dt,t,hour){life.update(dt,hour);sync(t);},pick(ray){
  let result=null,best=Infinity;
  for(const p of people){const center=p.object.position.clone().add(new THREE.Vector3(0,.8,0)),sphere=new THREE.Sphere(center,.75),hit=ray.intersectSphere(sphere,new THREE.Vector3());if(hit){const d=ray.origin.distanceTo(hit);if(d<best){result=p;best=d;}}}
  return result;
 }};
}
