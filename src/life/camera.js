import * as THREE from 'three';
import { blockers, blocked, nearestNode } from './graph.js';
import { RESOLVED, instantiate } from '../catalog/loader.js';
export async function createWalkCamera(stage,town,q){
 const {scene,renderer}=stage,graph=town.life.graph,solids=blockers(town,RESOLVED),keys=new Set();
 // Gates collide for the player; residents use the authored path opening.
 for(const i of town.instances.filter(i=>i.kind==='gate')){const e=RESOLVED.get(i.id);if(e){const {obbFromRect}=await import('../compiler/geometry.js');solids.push(obbFromRect({min:[-(i.width||2)/2,-.12],max:[(i.width||2)/2,.12]},{x:i.pos[0],z:i.pos[1],rotY:i.rotY}));}}
 const start=graph.nodes[nearestNode(graph,[0,18])].pos,player=new THREE.Group();player.position.set(start[0],0,start[1]);
 const figure=await instantiate('townsfolk-shopkeeper');player.add(figure);scene.add(player);
 const walk=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,1000);
 let overview=stage.camera;
 let mode=q.get('view')==='overview'?'overview':'walk',yaw=Math.PI,pitch=.32,explicit=!!q.get('cam')&&q.get('cam')!=='iso';
 if(explicit){walk.position.copy(overview.position);const t=stage.controls.target;const dir=t.clone().sub(walk.position);yaw=Math.atan2(-dir.x,-dir.z);pitch=Math.max(-.1,Math.min(.95,Math.atan2(-dir.y,Math.hypot(dir.x,dir.z))));const n=nearestNode(graph,[t.x+(walk.position.x-t.x)*.25,t.z+(walk.position.z-t.z)*.25]);const pos=graph.nodes[n].pos;player.position.set(pos[0],0,pos[1]);}
 function apply(){stage.controls.enabled=mode==='overview';stage.camera=mode==='walk'?walk:overview;player.visible=mode==='walk';if(mode==='overview'&&document.pointerLockElement)document.exitPointerLock();}
 apply();
 const setStageMode=stage.setMode;
 stage.setMode=m=>{if(mode==='walk'){mode='overview';apply();}setStageMode(m);overview=stage.camera;};
 const canvas=renderer.domElement;
 canvas.addEventListener('click',()=>{if(mode==='walk')canvas.requestPointerLock?.();});
 document.addEventListener('mousemove',e=>{if(mode==='walk'&&document.pointerLockElement===canvas){explicit=false;yaw-=e.movementX*.0025;pitch=Math.max(-.05,Math.min(.9,pitch+e.movementY*.0025));}});
 document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(['Tab','KeyM'].includes(e.code)){e.preventDefault();if(!e.repeat){mode=mode==='walk'?'overview':'walk';apply();}}keys.add(e.code);});
 document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
 window.addEventListener('resize',()=>{walk.aspect=innerWidth/innerHeight;walk.updateProjectionMatrix();});
 const aim=new THREE.Vector3(),desired=new THREE.Vector3();
 function update(dt,seconds){if(mode!=='walk')return;let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),z=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);const len=Math.hypot(x,z);if(len){explicit=false;x/=len;z/=len;const speed=5*dt,dx=(Math.cos(yaw)*x-Math.sin(yaw)*z)*speed,dz=(-Math.sin(yaw)*x-Math.cos(yaw)*z)*speed;
  // Axis sliding and short substeps prevent tunnelling on slow frames.
  const steps=Math.ceil(speed/.12);for(let n=0;n<steps;n++){if(!blocked([player.position.x+dx/steps,player.position.z],solids,.38))player.position.x+=dx/steps;if(!blocked([player.position.x,player.position.z+dz/steps],solids,.38))player.position.z+=dz/steps;}player.rotation.y=Math.atan2(dx,dz);}
 figure.position.y=len?Math.abs(Math.sin(seconds*10))*.045:0;
 if(explicit)return;
 aim.copy(player.position).add(new THREE.Vector3(0,1.35,0));desired.copy(aim).add(new THREE.Vector3(Math.sin(yaw)*5.8,2+pitch*4,Math.cos(yaw)*5.8));
 // Pull the arm in along the ground projection before it enters a footprint.
 for(let t=.12;t<=1;t+=.08){const p=aim.clone().lerp(desired,t);if(blocked([p.x,p.z],solids,.22)){desired.copy(aim).lerp(desired,Math.max(.12,t-.10));break;}}
 desired.y=Math.max(1.7,desired.y);walk.position.lerp(desired,1-Math.exp(-dt*12));walk.position.y=Math.max(1.0,walk.position.y);walk.lookAt(aim);
 }
 if(!explicit){walk.position.set(start[0],4.5,start[1]-5.8);update(1,0);}else walk.lookAt(stage.controls.target);
 return {update,get mode(){return mode;},player};
}
