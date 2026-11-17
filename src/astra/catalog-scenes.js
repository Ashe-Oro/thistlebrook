import {tagObject} from './registry/render-tags.js';
import * as THREE from 'three';
import { loadLibraryAsset } from '../catalog/library/loader.js';
import { semantics } from '../catalog/library/index.js';
import { toonMaterial } from '../toon.js';
// Prop-local performers demonstrate the same slot contract the route planner
// consumes. Every lease is exclusive, every motion uses an authored approach.
export async function buildCatalogScenes(scene,town,{residentsOwnSlots=false}={}){
 const root=new THREE.Group();root.name='compiled-library-scenes';scene.add(root);
 const actors=[],leases=new Map(),completed=[];
 for(const compiled of town.catalogScenes||[]){
  const group=new THREE.Group();group.name=compiled.id;root.add(group);
  const pad=new THREE.Mesh(new THREE.BoxGeometry(compiled.box.max[0]-compiled.box.min[0],.035,compiled.box.max[1]-compiled.box.min[1]),toonMaterial(compiled.group==='woodland-camp'?'#b6bd91':'#c6bc9d'));
  pad.position.set((compiled.box.min[0]+compiled.box.max[0])/2,.02+(compiled.elevation||0),(compiled.box.min[1]+compiled.box.max[1])/2);pad.receiveShadow=true;tagObject(pad,'built:'+compiled.id+'-pad');group.add(pad);
  await Promise.all(compiled.members.map(async m=>{const o=await loadLibraryAsset(m.asset);o.position.set(m.pos[0],.06+(compiled.elevation||0),m.pos[1]);o.rotation.y=m.rot;tagObject(o,m.registryId);group.add(o);}));
  if(residentsOwnSlots)continue;
  for(const [index,slot] of compiled.slots.entries()){
   const style=['classic','chef','explorer'][actors.length%3],asset=`character-model-basic-wardrobe/character-model-basic-wardrobe-${style}-vanilla`;
   const object=await loadLibraryAsset(asset);root.add(object);object.position.set(slot.position[0],.06,slot.position[2]);object.rotation.y=slot.facing;
   const bones={};object.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
   object.updateMatrixWorld(true);const hipHeight=bones.Hips?.getWorldPosition(new THREE.Vector3()).y-.06||.7;
   const actor={object,bones,hipHeight,slot,phase:actors.length*1.7,state:'active',until:semantics.activityProfiles[slot.activity].duration[0]+index*2,completed:0};
   actors.push(actor);leases.set(slot.id,actor);
  }
 }
 function pose(a,t,active){
  const {bones:b,object:o,slot}=a,arm=(name,x,z)=>{if(b[name])b[name].rotation.set(x,0,z);};
  for(const bone of Object.values(b))bone.rotation.set(0,0,0);
  arm('LeftArm',0,-1.23);arm('RightArm',0,1.23);
  o.position.y=.06;o.rotation.z=0;
  if(active){
   const wave=Math.sin(t*2+a.phase);
   if(slot.activity==='sit'){
    o.position.y=slot.position[1]+.06-a.hipHeight;
    arm('LeftUpLeg',-Math.PI/2,0);arm('RightUpLeg',-Math.PI/2,0);arm('LeftLeg',Math.PI/2,0);arm('RightLeg',Math.PI/2,0);
    arm('LeftArm',-.45,-.7);arm('RightArm',-.45,.7);
   }else if(slot.activity==='play-music'){
    arm('LeftArm',-.65-wave*.35,-.55);arm('RightArm',-.65+wave*.35,.55);
   }else if(slot.activity==='warm-hands'){
    arm('LeftArm',-.75,-.5);arm('RightArm',-.75,.5);
   }else{
    arm('RightArm',-.65-wave*.2,.65);if(b.Spine)b.Spine.rotation.x=.08+wave*.035;
   }
  }else{const swing=Math.sin(t*7+a.phase)*.35;arm('LeftUpLeg',swing,0);arm('RightUpLeg',-swing,0);}
 }
 function move(a,target,dt){const o=a.object,dx=target[0]-o.position.x,dz=target[1]-o.position.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*.85);if(d>.001){o.position.x+=dx/d*step;o.position.z+=dz/d*step;o.rotation.y=Math.atan2(dx,dz);}return d<.03;}
 function update(t){const dt=Math.max(0,Math.min(.25,t-(update.last??t)));update.last=t;
  for(const a of actors){const s=a.slot;
   if(a.state==='active'&&t>a.until){a.state='leaving';a.completed++;completed.push({slot:s.id,activity:s.activity});}
   if(a.state==='leaving'&&move(a,[s.approach[0],s.approach[2]],dt))a.state='to-aisle';
   if(a.state==='to-aisle'&&move(a,s.landing,dt)){leases.delete(s.id);a.state='waiting';a.until=t+3;}
   if(a.state==='waiting'&&t>a.until&&!leases.has(s.id)){leases.set(s.id,a);a.state='approaching';}
   if(a.state==='approaching'&&move(a,[s.approach[0],s.approach[2]],dt))a.state='entering';
   if(a.state==='entering'&&move(a,[s.position[0],s.position[2]],dt)){a.state='active';a.until=t+semantics.activityProfiles[s.activity].duration[0];a.object.rotation.y=s.facing;}
   pose(a,t,a.state==='active');
  }
 }
 update(0);
 return {root,actors,leases,update,audit:()=>({activityOwner:residentsOwnSlots?'residents':'local-performers',slots:town.interactions.length,scenes:town.catalogScenes.length,props:town.catalogScenes.reduce((n,s)=>n+s.members.length,0),actors:actors.length,completed:completed.slice(-30),states:actors.map(a=>({slot:a.slot.id,activity:a.slot.activity,state:a.state,completed:a.completed,position:a.object.position.toArray(),bones:Object.keys(a.bones).length})),leases:[...leases.keys()]})};
}
