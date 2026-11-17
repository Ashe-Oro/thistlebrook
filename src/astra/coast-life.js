import {furnitureId} from './registry/district-furniture.js';
import * as THREE from 'three';
import {place} from '../catalog/loader.js';
import {toonMaterial} from '../toon.js';
import {COAST_BLOCKS,COAST_UMBRELLAS,COAST_COURTS,shoreX} from './coast-plan.js';
import {createCoastWalkers} from './coast-life-plan.js';

export async function createCoastLife(root,town){
  const walking=createCoastWalkers(),batches=[],transform=new THREE.Object3D(),matrix=new THREE.Matrix4();
  const roles=['merchant','herbalist','shopkeeper','child'];
  const templates=await Promise.all(roles.map(role=>place('townsfolk-'+role)));
  for(const [i,template]of templates.entries()){
    const members=walking.people.filter(p=>p.id%4===i);template.updateMatrixWorld(true);
    template.traverse(part=>{if(!part.isMesh)return;const mesh=new THREE.InstancedMesh(part.geometry,part.material,members.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=part.castShadow;mesh.receiveShadow=part.receiveShadow;root.add(mesh);batches.push({mesh,members,local:part.matrixWorld.clone()});});
  }
  const beach=[];
  for(const u of COAST_UMBRELLAS)for(const side of [-1,1])beach.push({type:'sunbathe',x:u.x-.2,z:u.z+side*1.6,index:beach.length});
  for(let n=0;n<12;n++){const z=n<7?-96+n*3.7:-40+(n-7)*3.2;beach.push({type:'swim',x:shoreX(z)+3.8+(n%3)*1.3,z,index:beach.length});}
  for(const z of COAST_COURTS)for(let n=0;n<4;n++)beach.push({type:'volley',x:120+(n%2)*6,z:z+(n<2?-4:4),court:z,side:n<2?-1:1,slot:n,index:beach.length});
  for(const z of [-99,-31])beach.push({type:'guard',x:130,z:z+2,y:2.6,index:beach.length});
  for(const b of COAST_BLOCKS)for(const roof of [false,true])for(const side of [-1,1])beach.push({type:'dine',x:roof?b.x:95,z:b.z+side*2.7+1.05,y:roof?b.height+.45:.2,index:beach.length,roof});
  // Articulated, swimsuit-clad beach residents. Shared instanced parts keep
  // swimming, reclining and volleyball poses inexpensive at town scale.
  const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.IcosahedronGeometry(1,1),parts=[];
  const skins=['#e9b996','#b47e60','#d59c7a'],clothes=['#e98194','#52b9b9','#f1b757','#748fbd'];
  function part(geometry,color,filter,pose){const members=beach.filter(filter);if(!members.length)return;const mesh=new THREE.InstancedMesh(geometry,toonMaterial(color),members.length);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.userData.registryIds=members.map(p=>p.type==='dine'?furnitureId('coral-coast','dining-table',p.x,p.y,p.z-1.05):null);root.add(mesh);parts.push({mesh,members,pose});}
  for(let skin=0;skin<3;skin++){
    const filter=p=>p.index%3===skin;
    part(sphere,skins[skin],filter,()=>({pos:[0,1.47,0],scale:[.24,.28,.23]}));
    for(const side of [-1,1]){
      part(cube,skins[skin],filter,(p,t)=>({pos:[side*.35,1.05+(p.type==='volley'?.1:0),p.type==='dine'?.22:0],scale:[.13,.56,.15],rx:p.type==='swim'?Math.sin(t*3+p.index+side)*1.3:p.type==='volley'?-1.2-Math.sin(t*2+p.index)*.4:p.type==='dine'?-1.1:side*.08,rz:p.type==='swim'?side*.6:side*.15}));
      part(cube,skins[skin],filter,(p,t)=>({pos:[side*.13,p.type==='dine'?.43:.36,p.type==='dine'?.19:0],scale:[.17,p.type==='dine'?.45:.65,.18],rx:p.type==='swim'?Math.sin(t*5+side+p.index)*.18:p.type==='dine'?-1.25:0}));
    }
  }
  for(let c=0;c<4;c++){
    part(cube,clothes[c],p=>p.index%4===c,()=>({pos:[0,.97,0],scale:[.48,.58,.28]}));
    part(cube,c%2?'#355b72':'#f3e4bc',p=>p.index%4===c,()=>({pos:[0,.65,0],scale:[.48,.21,.3]}));
  }
  part(sphere,'#534944',()=>true,p=>({pos:[0,1.65,-.025],scale:p.type==='swim'?[.25,.11,.24]:[.25,.16,.24]}));
  for(const side of [-1,1])part(cube,'#3f5053',()=>true,()=>({pos:[side*.085,1.5,.216],scale:[.05,.045,.025]}));
  const balls=COAST_COURTS.map(z=>{const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(.23,1),toonMaterial('#fff3cf'));root.add(ball);return{ball,z};});
  const ripples=[];for(const p of beach.filter(p=>p.type==='swim')){const m=new THREE.Mesh(new THREE.RingGeometry(.45,.5,16),new THREE.MeshBasicMaterial({color:'#e4fff3',side:THREE.DoubleSide,transparent:true,opacity:.5,depthWrite:false}));m.rotation.x=-Math.PI/2;root.add(m);ripples.push({m,p});}
  let last=0,hour=10;
  return {walking,beach,update(t,h){
    const dt=Math.max(0,Math.min(t-last,.8));last=t;hour=h;if(dt>0)walking.update(dt,t,h);
    for(const p of walking.people){const [x,y,z]=p.position,offset=p.walking?.19:0;transform.position.set(x+Math.cos(p.yaw)*offset,y+(p.walking?Math.abs(Math.sin(t*8+p.id))*.045:0),z-Math.sin(p.yaw)*offset);transform.rotation.set(0,p.yaw,p.walking?Math.sin(t*8+p.id)*.025:0);transform.scale.setScalar(.95);transform.updateMatrix();p.matrix??=new THREE.Matrix4();p.matrix.copy(transform.matrix);}
    for(const {mesh,members,local}of batches){members.forEach((p,i)=>mesh.setMatrixAt(i,matrix.multiplyMatrices(p.matrix,local)));mesh.instanceMatrix.needsUpdate=true;}
    const day=h>=7&&h<19;
    for(const p of beach){
      let x=p.x,y=p.y||.15,z=p.z,rx=0,ry=0,rz=0,visible=true;
      if(p.type==='sunbathe'){y=.28;rz=-Math.PI/2;visible=day;}
      if(p.type==='swim'){x+=Math.sin(t*.22+p.index)*.8;z+=Math.sin(t*.14+p.index)*1.4;y=-.02+Math.sin(t*2+p.index)*.04;rx=Math.PI/2;ry=Math.sin(t*.14+p.index)*.35;visible=day;}
      if(p.type==='volley'){x+=Math.sin(t*.7+p.slot)*.7;z+=Math.cos(t*.8+p.slot)*.35;const jump=Math.max(0,Math.sin(t*1.57+p.slot*Math.PI));y+=jump**8*.5;ry=p.side>0?Math.PI:0;}
      if(p.type==='dine'){y-=.05;ry=Math.PI;}
      transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.setScalar(visible?1:0);transform.updateMatrix();p.matrix??=new THREE.Matrix4();p.matrix.copy(transform.matrix);p.position=[x,y,z];p.visible=visible;
    }
    for(const {mesh,members,pose}of parts){members.forEach((p,i)=>{const v=pose(p,t);transform.position.set(...v.pos);transform.rotation.set(v.rx||0,0,v.rz||0);transform.scale.set(...v.scale);transform.updateMatrix();mesh.setMatrixAt(i,matrix.multiplyMatrices(p.matrix,transform.matrix));});mesh.instanceMatrix.needsUpdate=true;}
    for(const {ball,z}of balls){const u=(t*.26)%1,s=u<.5?u*2:(1-u)*2;ball.position.set(123+Math.sin(t*.5)*2,1.4+Math.sin(s*Math.PI)*3.6,z-4+s*8);ball.rotation.set(t,t*.6,0);}
    for(const {m,p}of ripples){m.visible=day;m.position.set(p.position[0],.08,p.position[2]+.6);m.scale.setScalar(1+Math.sin(t*2+p.index)*.15);}
  },audit(){return {walkers:walking.people.length,beachActors:beach.length,visibleBeachActors:beach.filter(p=>p.visible).length,swimmers:beach.filter(p=>p.type==='swim'&&p.visible).length,sunbathers:beach.filter(p=>p.type==='sunbathe'&&p.visible).length,volleyballPlayers:8,diners:28,arrivals:walking.people.reduce((sum,p)=>sum+p.arrivals,0),rooftopArrivals:walking.people.filter(p=>p.kind==='roof'&&p.arrivals>0).length,hour,people:walking.people.map(p=>({id:p.id,position:p.position,activity:p.walking?'walking':p.yielding?'yielding':p.kind,arrivals:p.arrivals,venue:p.venue}))};}};
}
