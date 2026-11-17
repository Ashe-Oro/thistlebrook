import * as THREE from 'three';
import { createTeslaVehicle } from './models.js';
import { roadsterPose, createPreviewFleetSimulation } from './motion.js';
import { installTeslaTraffic } from './adapter.js';
import { createDemoArena } from './arena.js';
import { DEMO } from './demo-motion.js';
export { createTeslaVehicle, TESLA_STYLES } from './models.js';
export { installTeslaTraffic } from './adapter.js';

// One optional traffic adapter, one preview fallback, exactly one Roadster.
// Absolute simulation time makes pause, speed and deterministic capture agree.
export function createTeslaTown(scene,town,{traffic=null,residents=null}={}){
  const root=new THREE.Group();root.name='Thistlebrook electric vehicles';scene.add(root);
  const adapter=traffic?installTeslaTraffic(traffic):null;
  const simulation=adapter?null:createPreviewFleetSimulation();
  const fleet=simulation?simulation.vehicles.map((v,i)=>{
    const object=createTeslaVehicle(v.kind,i===5?{color:'#93b7ad'}:{});root.add(object);return object;
  }):adapter.installed.map(item=>item.object);
  // Validate preview against the real map rather than silently driving on a
  // moved avenue. Production traffic validates its own routes.
  if(simulation)for(let d=0;d<simulation.path.length;d+=.25){
    const p=simulation.path.sample(d);
    if(!town.roads.some(r=>!r.owner&&r.width>=2.4&&segmentDistance(p,r)<r.width/2-.1))throw Error('Tesla preview needs the downtown avenue loop; pass the merged traffic system instead');
  }
  const arena=createDemoArena(root,{residents});
  const object=createTeslaVehicle('roadster',{scale:DEMO.carScale});root.add(object);
  const roadster={name:'White Roadster',object,followLerp:12,cameraTarget:new THREE.Vector3(),phase:'Ready at the ramp'};
  const shadowMaterial=new THREE.MeshBasicMaterial({color:'#263c3d',transparent:true,opacity:.18,depthWrite:false});
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,32),shadowMaterial);shadow.rotation.x=-Math.PI/2;root.add(shadow);
  let lastTime=null,pose=roadsterPose(0),button=null;
  function update(time,night=0){
    const dt=lastTime===null?0:Math.max(0,time-lastTime);lastTime=time;
    if(simulation){
      const pedestrians=(residents?.people||[]).map(p=>({x:p.object.position.x,z:p.object.position.z}));
      simulation.update(dt,pedestrians);
      fleet.forEach((o,i)=>{const v=simulation.vehicles[i];o.position.set(v.x,.15,v.z);o.rotation.y=v.yaw;o.userData.animate({distance:v.distance,braking:v.speed<.5,night});});
    }else adapter.update(night);
    pose=roadsterPose(time);roadster.phase=pose.phase;object.position.set(pose.x,pose.y,pose.z);roadster.cameraTarget.set(pose.x,pose.y*.8,pose.z);
    object.userData.pivot.quaternion.fromArray(pose.orientation);object.userData.animate({distance:pose.distance,time,night});
    shadow.position.set(pose.x,DEMO.ground+.012,pose.z);shadow.scale.set(1.3+pose.altitude*.03,.65+pose.altitude*.02,1);shadow.material.opacity=.18/(1+pose.altitude*.12);
    arena.update(time,pose,night);
    if(button)button.title='Watch Roadster · '+pose.phase;
  }
  update(0);
  return {root,fleet,roadster,arena,simulation,adapter,update,demoView:{x:DEMO.x,z:DEMO.z,y:2,zoom:2.65,elevation:45},
    addWatchButton(uiRoot,onWatch){
      button=document.createElement('button');button.type='button';button.dataset.view='roadster';button.textContent='Roadster arena ↗';button.setAttribute('aria-label','Watch Roadster demo');button.title='Watch the ramp, lineup kickflip and hover show';button.addEventListener('click',onWatch);uiRoot.querySelector('.view-tabs').append(button);return button;
    },
    audit(){return {mode:adapter?'traffic-adapter':'standalone-preview',fleet:fleet.map((o,i)=>({kind:o.userData.kind,position:o.position.toArray(),status:simulation?.vehicles[i].status||adapter?.installed[i].v.status})),arena:arena.audit(),roadster:{...pose,count:1},triangles:countTriangles(root)};},
    dispose(){button?.remove();adapter?.dispose();if(simulation)fleet.forEach(o=>o.userData.dispose());object.userData.dispose();shadow.geometry.dispose();shadowMaterial.dispose();arena.dispose();root.removeFromParent();},
  };
}
function segmentDistance(p,r){const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],t=Math.max(0,Math.min(1,((p.x-r.a[0])*dx+(p.z-r.a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-r.a[0]-dx*t,p.z-r.a[1]-dz*t);}
function countTriangles(root){let n=0;root.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return n;}
