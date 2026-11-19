import {packVehicle} from './vehicle-models.js';
import { pedestrianGraph } from '../roads/pedestrian.js';
import { midpoint } from '../roads/crosswalks.js';
import * as THREE from 'three';
import {place} from '../catalog/loader.js';
import {toonMaterial} from '../toon.js';
import {districtKit} from './downtown-kit.js';
import {tagObject,tagBatch} from './registry/render-tags.js';
import {REGIONAL} from '../roads/regional.js';
import {createRegionalTraffic} from '../roads/regional-traffic.js';
import {residentPedestrian} from '../roads/walking.js';
import {distanceToSegment} from '../compiler/astra.js';
import {cruiserPose, waterlineAt} from './water-traffic-plan.js';
import {hull} from './watercraft.js';
import {landscapeHills} from '../compiler/terrain.js';
import {excavateHill, tunnelCuts} from './railway-tunnels.js';
import {inkMesh} from './ink-mesh.js';

function strip(points,width,color,y,parent,id) {
 const vertices=[],indices=[];
 points.forEach((p,i)=>{
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;
  vertices.push(p[0]-dz/len*width/2,y,p[1]+dx/len*width/2,p[0]+dz/len*width/2,y,p[1]-dx/len*width/2);
  if(i<points.length-1){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
 });
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
 const m=new THREE.Mesh(g,toonMaterial(color));m.receiveShadow=true;parent.add(tagObject(m,id));return m;
}
const curve=points=>new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');

export async function buildLandscape(scene,town) {
 const plan=town.landscape,kit=districtKit(scene),{box,orb,sign}=kit;
 const shape=new THREE.Shape(),coast=[];
 plan.outline.forEach((p,i)=>{const prev=plan.outline[(i+plan.outline.length-1)%plan.outline.length],next=plan.outline[(i+1)%plan.outline.length];const a=Math.hypot(prev[0]-p[0],prev[1]-p[1]),b=Math.hypot(next[0]-p[0],next[1]-p[1]),radius=Math.min(5,a/4,b/4),start=p.map((v,k)=>v+(prev[k]-v)/a*radius),end=p.map((v,k)=>v+(next[k]-v)/b*radius);if(i)shape.lineTo(...start);else shape.moveTo(...start);shape.quadraticCurveTo(...p,...end);});shape.closePath();
 coast.push(...shape.getPoints(6).map(p=>[p.x,p.y]));
 const land=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:3,bevelEnabled:false}),[toonMaterial('#a5b67d'),toonMaterial('#a09275')]);
 land.rotation.x=Math.PI/2;land.position.y=-.09;land.receiveShadow=true;scene.add(tagObject(land,plan.registryId));
 // One animated ocean material, below every beach and pier, extends beyond the
 // camera's world framing. There are no district-sized water rectangles.
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800,1,1),toonMaterial('#72b2b9').clone());sea.rotation.x=-Math.PI/2;sea.position.set(60,-.45,80);sea.receiveShadow=true;
 const clock={value:0};sea.material.onBeforeCompile=shader=>{shader.uniforms.uGulfTime=clock;shader.vertexShader='varying vec3 vGulfPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGulfPosition=position;');shader.fragmentShader='uniform float uGulfTime; varying vec3 vGulfPosition;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat wave=sin(vGulfPosition.x*1.7+sin(vGulfPosition.y*.7+uGulfTime*.4)+uGulfTime*.8);float crest=smoothstep(.97,1.,wave)*smoothstep(.6,1.,sin(vGulfPosition.y*2.9+sin(vGulfPosition.x*.43)));diffuseColor.rgb+=crest*.065;');};scene.add(tagObject(sea,'landscape:ocean'));
 // Sand traces the entire irregular perimeter. Inland edges become rocky ridges;
 // the sheltered inlet and the eastern Gulf edge have broad, pale beaches.
 coast.push(coast[0]);
 strip(coast,9,'#d9c799',-.095,scene,plan.registryId);
 strip(coast,3,'#e9d9ac',-.08,scene,plan.registryId);
 const cuts = town.railway ? tunnelCuts(town.railway) : [];
 for (const h of landscapeHills(town)) for (const [i, part] of h.parts.entries()) {
   // Bake non-uniform terrain scale so the ink uses a consistent world width.
   const source = part.geometry.clone().scale(...part.scale).translate(...part.position);
   const geometry = excavateHill(source, cuts);
   const material = toonMaterial(i ? '#d5d2af' : h.mountain ? '#8e9d7b' : '#9eaf77').clone();
   const mesh = inkMesh(new THREE.Mesh(geometry, material), .10);
   mesh.receiveShadow = true;
   mesh.castShadow = true;
   mesh.userData.scenery = material.userData.scenery = true;
   kit.root.add(tagObject(mesh, h.id));
 }
 // Owned vegetation is instanced by source mesh. Every instance carries its own
 // compiler placement ID, including meadow grass and wildflowers.
 for(const asset of new Set(plan.models.map(p=>p.asset))) {
  const template=await place(asset),members=plan.models.filter(p=>p.asset===asset);template.updateMatrixWorld(true);
  const transform=new THREE.Object3D(),matrix=new THREE.Matrix4();
  template.traverse(part=>{if(!part.isMesh)return;const batch=new THREE.InstancedMesh(part.geometry,part.material,members.length);
   members.forEach((p,i)=>{transform.position.set(p.pos[0],p.y||0,p.pos[1]);transform.rotation.y=p.rot;transform.scale.setScalar(p.scale);transform.updateMatrix();batch.setMatrixAt(i,matrix.multiplyMatrices(transform.matrix,part.matrixWorld));});
   tagBatch(batch, members.map(p => p.registryId));
   if (part.userData.outline) {
     batch.userData.outline = true;
     batch.receiveShadow = false;
     batch.castShadow = false;
   } else {
     batch.castShadow = part.castShadow;
     batch.receiveShadow = true;
   }
   if (part.userData.foliage) batch.userData.foliage = true;
   scene.add(batch);
  });
 }
 // Regional roads (grok-roads): one record per chain with a single filleted
 // centerline. Verge and asphalt follow it exactly; junction pads fill the
 // joins; real road ends get a turning circle. Footpaths and sidewalks are
 // drawn from the pedestrian graph elsewhere, never down the road's middle.
 const routes=[],pad=(x,z,r,color,y,id)=>{const m=new THREE.Mesh(new THREE.CircleGeometry(r,28),toonMaterial(color));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;scene.add(tagObject(m,id));};
 const regional=town.roads.filter(r=>r.centerline),walk=pedestrianGraph(town);
 const zebras=walk.crossings.map(([a,b])=>midpoint(walk.nodes[a].pos,walk.nodes[b].pos));
 for(const r of regional) {
  const points=r.centerline;routes.push({road:r,length:r.length});
  if(r.mapleHollow)continue; // Maple Hollow streets are dressed by maple-hollow.js (sidewalks, kerbs, no rural fences)
  strip(points,REGIONAL.verge,'#c5b68f',.025,scene,r.registryId);strip(points,REGIONAL.width,'#76847b',.06,scene,r.registryId);
  for(const [i,end] of r.ends.entries()){const p=end.pos;
   if(end.terminus&&!end.touches){pad(p[0],p[1],REGIONAL.turnRadius+1.2,'#c5b68f',.024,r.registryId);pad(p[0],p[1],REGIONAL.turnRadius,'#76847b',.059,r.registryId);}
   else{pad(p[0],p[1],REGIONAL.verge/2,'#c5b68f',.024,r.registryId);pad(p[0],p[1],REGIONAL.width/2,'#76847b',.059,r.registryId);}
  }
  const start=kit.root.children.length;let run=0;
  // Bridge spans (planned in roads/regional.js): a deck slab, piers and solid
  // parapets carry the road over open water instead of laying asphalt on it.
  const bridged=new Set();
  for(const [from,to] of r.bridges||[])for(let i=from+1;i<=to;i++){bridged.add(i);const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;const t=[dx/len,dz/len],yaw=Math.atan2(dx,dz),mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
   box(mx,-.55,mz,REGIONAL.verge+.5,1.1,len+.05,'#9d9580').rotation.y=yaw;
   for(const side of [-1,1]){const px=mx+t[1]*(REGIONAL.verge/2)*side,pz=mz-t[0]*(REGIONAL.verge/2)*side;box(px,.4,pz,.35,.75,len+.05,'#b9b19a').rotation.y=yaw;}
   if(i%2===0)box(b[0],-2.2,b[1],REGIONAL.verge*.6,3.2,1.1,'#8a8371').rotation.y=yaw;
  }
  // Centre dashes every 5 m; fences sit outside the walking verge and stop
  // short of junctions and road ends so paths stay open.
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;const t=[dx/len,dz/len];
   for(let d=(5-run%5)%5;d<len;d+=5){const along=run+d;const x=a[0]+t[0]*d,z=a[1]+t[1]*d;if(!zebras.some(([cx,cz])=>Math.hypot(cx-x,cz-z)<1.4)){const m=box(x,.09,z,.11,.025,1.7,'#f0dfb0');m.rotation.y=Math.atan2(t[0],t[1]);}
    if(along>9&&along<r.length-9&&Math.round(along)%10===0&&!bridged.has(i))for(const side of [-1,1]){const fx=x+t[1]*REGIONAL.fence*side,fz=z-t[0]*REGIONAL.fence*side;if(town.roads.some(o=>o!==r&&o.kind!=='world-link'&&distanceToSegment([fx,fz],o.a,o.b)<o.width/2+1.2))continue;box(fx,.5,fz,.12,.9,.12,'#a99f83');const rail=box(fx,.88,fz,.12,.12,9.6,'#ded0ae');rail.rotation.y=Math.atan2(t[0],t[1]);}}
   run+=len;}
  kit.root.children.slice(start).forEach(o=>tagObject(o,r.registryId));
 }
 // Vehicles come from the pure regional simulation; render only mirrors it.
 const traffic=createRegionalTraffic(town);
 const vehicles=await Promise.all(traffic.vehicles.map(async sim=>{
  const object=await packVehicle(sim);scene.add(object);object.name=sim.id;
  const road=sim.regionalId;
  tagObject(object,road<0?'maple-hollow':town.roads[road]?.registryId);
  return {object,sim,road,routeGroup:town.roads[road]?.routeGroup};
 }));
 // The tour ferry and sailboats use the same Gulf as the working cutters and
 // recovery ship. Waypoints stay outside the preserved beach and launch pads.
 function boat(id,sail=false){const g=new THREE.Group();scene.add(g);const parts=[];const b=(...args)=>parts.push(box(...args,g));
  b(0,0,0,sail?2.5:4,.8,sail?7:11,sail?'#eee3bf':'#537d83');b(0,.5,0,sail?2.2:3.7,.2,sail?6.6:10.5,'#d4b88a');
  b(0,1.4,-1,sail?1.5:3,sail?.9:1.8,sail?2:5,'#eee1bb');b(0,2,-.8,sail?1.2:3.1,.5,sail?1.5:4.5,'#476e76');
  if(sail){b(0,4.2,0,.12,8,.12,'#b59c72');const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,1,.1,0,8,.1,0,1,3.2],3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,new THREE.MeshToonMaterial({color:'#f4e5bf',side:THREE.DoubleSide}));g.add(m);}
  tagObject(g,id);return g;
 }
 // vehicle-variety: the ferry is the owned Vice Beach motor yacht on the
 // documented harbor-to-coast timetable (water-traffic-plan.js CRUISER).
 const ferry=new THREE.Group();scene.add(ferry);ferry.add(await hull('yacht'));tagObject(ferry,'landscape:ferry');
 const sails=[boat('landscape:sail-0',true),boat('landscape:sail-1',true)];
 const ferryRoute=curve([[180,78],[185,95],[187,133],[207,187],[270,190],[315,164],[322,127],[319,84]]),ferryLength=ferryRoute.getLength();
 kit.bake();
 let lastT=0;
 let others=()=>[];
 return {vehicles,routes,sea,traffic,setOtherVehicles(fn){others=fn;},update(t,hour,people,railTravellers=[]){
  clock.value=t;const dt=Math.max(0,Math.min(.8,t-lastT));lastT=t;
  const walkers=(people||[]).filter(p=>p.object.visible!==false).map(p=>residentPedestrian(p.actor,p.walkPace));
  traffic.update(dt,hour,[...walkers,...railTravellers],others());
  for(const v of vehicles){v.object.position.set(v.sim.position[0],.1,v.sim.position[1]);v.object.rotation.y=Math.atan2(v.sim.direction[0],v.sim.direction[1]);}
  const pose=cruiserPose(hour??10);ferry.position.set(pose.pos[0],waterlineAt(pose.pos)+Math.sin(t)*.05,pose.pos[1]);ferry.rotation.y=pose.yaw;ferry.userData.state=pose.state;
  sails.forEach((s,i)=>{const a=t*.015+i*2;s.position.set(340+i*18+Math.sin(a)*12,-.1,94+i*65+Math.cos(a)*24);s.rotation.y=Math.atan2(Math.cos(a)*12,-Math.sin(a)*24);});
 },audit(){return {ground:plan.outline,ownedPlacements:plan.models.length,hills:plan.hills.length,roads:routes.length,vehicles:vehicles.filter(v=>!v.sim.mapleHollow).map(v=>({road:v.road,position:v.object.position.toArray(),distance:v.sim.s,routeGroup:v.routeGroup})),ferry:ferry.position.toArray(),ferryState:ferry.userData.state,ferryRouteLength:ferryLength,ocean:1};}};
}
