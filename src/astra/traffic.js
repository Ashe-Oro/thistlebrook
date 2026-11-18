import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from '../toon.js';
import { place } from '../catalog/loader.js';
import { createTrafficSimulation, PARKING_BAYS } from './traffic-simulation.js';
import { batchInstances } from '../compiler/batches.js';
import { instantiate } from '../catalog/loader.js';
import { FLEET_MODELS, FOOTPRINT, LIVERY, assignFleet, parkedFleet, fitModel } from './traffic-fleet.js';
import { planStreets, CLASS_STYLE, FURNITURE_MODELS } from './street-plan.js';
import { loadPackGeometry, retintGeometry, toonModel, instancedModel } from './vehicle-models.js';
import { distanceToSegment } from '../compiler/astra.js';
import { residentPedestrian } from '../roads/walking.js';
import { pedestrianGraph } from '../roads/pedestrian.js';
import { midpoint, ZEBRA_HALF_WIDTH } from '../roads/crosswalks.js';

// Self-contained integration: the compiler and resident routines stay untouched.
export async function createTraffic(scene,town,residents,world){
 const simulation=createTrafficSimulation(town),root=new THREE.Group();root.name='Thistlebrook town traffic';scene.add(root);
 const materials=new Map(),cube=new THREE.BoxGeometry(1,1,1),wheelGeo=new THREE.CylinderGeometry(.22,.22,.12,10);
 const material=color=>{if(!materials.has(color))materials.set(color,toonMaterial(color));return materials.get(color);};
 const box=(parent,x,y,z,w,h,d,color)=>{const m=new THREE.Mesh(cube,material(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const label=(parent,text,x,y,z,w,h,bg='#315e60',fg='#fff3d3')=>{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,512,128);c.fillStyle=fg;c.font='bold 64px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,68,480);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}));m.position.set(x,y,z);parent.add(m);return m;
 };
 const streets=new THREE.Group(), walk=pedestrianGraph(town);
 const crossingCenters=walk.crossings.map(([a,b])=>midpoint(walk.nodes[a].pos,walk.nodes[b].pos));
 // vehicle-variety: three street classes read from the asphalt tone, the
 // markings and the kerbside furniture (street-plan.js).
 const streetPlan=planStreets(town,simulation);
 const classOf=r=>streetPlan.streets.find(s=>Math.hypot(s.a[0]-r.a[0],s.a[1]-r.a[1])<.01&&Math.hypot(s.b[0]-r.b[0],s.b[1]-r.b[1])<.01)?.cls||'town';
 const clearOfJunctions=(x,z,pad=2)=>!simulation.junctions.some(j=>j.points.some(p=>Math.hypot(p[0]-x,p[1]-z)<pad))&&!crossingCenters.some(([cx,cz])=>Math.hypot(cx-x,cz-z)<1.15);
 for(const r of simulation.roads){const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),cls=classOf(r),style=CLASS_STYLE[cls],nx=-dz/len,nz=dx/len;
  const road=box(streets,(r.a[0]+r.b[0])/2,.185,(r.a[1]+r.b[1])/2,r.width-.12,.035,len,style.asphalt);road.rotation.y=angle;
  for(let d=1.5;d<len-1;d+=style.centre==='dash'?3.5:.9){const x=r.a[0]+dx*d/len,z=r.a[1]+dz*d/len;
   if(!style.centre||!clearOfJunctions(x,z))continue;
   if(style.centre==='dash'){const dash=box(streets,x,.209,z,cls==='avenue'?.08:.065,.012,cls==='avenue'?1.2:.9,style.dash);dash.rotation.y=angle;}
   // The widest run (Civic Avenue, 4.2 m) takes a double centre line.
   else for(const o of [-.11,.11]){const line=box(streets,x+nx*o,.209,z+nz*o,.06,.012,.92,'#e6c46a');line.rotation.y=angle;}
  }
  // Downtown avenues and the boulevard get solid edge lines inside the kerb.
  if(style.edge)for(let d=.9;d<len-.4;d+=.9){const x=r.a[0]+dx*d/len,z=r.a[1]+dz*d/len;if(!clearOfJunctions(x,z,r.width/2+1.6))continue;for(const side of [-1,1]){const o=side*(r.width/2-.2),line=box(streets,x+nx*o,.208,z+nz*o,.055,.012,.92,style.edge);line.rotation.y=angle;}}
 }
 // Marked cycle strips (CYCLE_STRIPS): green surfacing, a white lane line and
 // painted bicycle chevrons, both sides of Civic Avenue.
 for(const st of streetPlan.strips){const dx=st.b[0]-st.a[0],dz=st.b[1]-st.a[1],len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),nx=-dz/len,nz=dx/len;
  for(const side of [-1,1])for(let d=.45;d<len-.2;d+=.9){const x=st.a[0]+dx*d/len,z=st.a[1]+dz*d/len;if(!clearOfJunctions(x,z,2.4))continue;
   const o=side*st.offset,strip=box(streets,x+nx*o,.206,z+nz*o,st.width,.012,.92,'#6fa883');strip.rotation.y=angle;
   const lo=side*(st.offset-st.width/2-.05),line=box(streets,x+nx*lo,.211,z+nz*lo,.05,.012,.6,'#f0ead6');line.rotation.y=angle;
   if(Math.round(d/.9)%6===0){const mark=box(streets,x+nx*o,.214,z+nz*o,.3,.012,.12,'#f0ead6');mark.rotation.y=angle;const tip=box(streets,x+nx*o+dx/len*.12,.214,z+nz*o+dz/len*.12,.12,.012,.12,'#f0ead6');tip.rotation.y=angle;}
  }
 }
 for(const [i,s] of simulation.stops.entries()){
  // Posts stand on the kerb, just outside the carriageway.
  const hw=Math.max(...simulation.roads.filter(r=>distanceToSegment(s.point,r.a,r.b)<.05).map(r=>r.width/2),1.5),g=new THREE.Group();g.position.set(s.point[0]+s.side[0]*(hw+.22),0,s.point[1]+s.side[1]*(hw+.22));root.add(g);
  box(g,0,1.12,0,.065,2.1,.065,'#465e58');box(g,0,1.98,0,.73,.67,.1,'#e6c16b');
  label(g,i<5?'1':'2',0,2,.06,.55,.4);label(g,s.name.toUpperCase(),0,1.5,.06,1.75,.25);
  const line=box(streets,s.point[0]+s.side[0]*1.15,.225,s.point[1]+s.side[1]*1.15,s.side[0]===0?4.2:.075,.02,s.side[0]===0?.075:4.2,'#e4ba5e');line.castShadow=false;
 }
 // Parking uses existing cul-de-sac paving, outside the moving lanes. These
 // positions do not reserve new land or collide with seeded building parcels.
 // Bays sit beyond the south sidewalk with a short dropped-kerb apron.
 for(const b of PARKING_BAYS){if(b.type==='driveway')continue;const [x,z]=b.center,u=[Math.sin(b.yaw),Math.cos(b.yaw)],dd=Math.hypot(x-b.road[0],z-b.road[1]),n=[(x-b.road[0])/dd,(z-b.road[1])/dd],ang=b.yaw;
  const hw=Math.max(...simulation.roads.filter(r=>distanceToSegment(b.road,r.a,r.b)<.05).map(r=>r.width/2),1.3),at=(a,o)=>[x+u[0]*a+n[0]*o,z+u[1]*a+n[1]*o];
  const pad=box(streets,x,.2,z,1.6,.03,3.2,'#77867e');pad.rotation.y=ang;pad.scale.set(1.6,.03,3.2);
  const apronLen=dd-.8-hw,[ax,az]=at(0,-.8-apronLen/2),apron=box(streets,ax,.19,az,2.2,.03,apronLen+.05,'#a9a28f');apron.rotation.y=Math.atan2(n[0],n[1]);
  for(const a of [-1.5,1.5]){const [lx,lz]=at(a,0),l=box(streets,lx,.223,lz,1.3,.02,.055,'#e4e4c8');l.rotation.y=ang;}
  const [bx,bz]=at(0,.62),back=box(streets,bx,.223,bz,.055,.02,3,'#e4e4c8');back.rotation.y=ang;}
 const sign=new THREE.Group();sign.position.set(-75.3,0,-12.2);root.add(sign);box(sign,0,1,0,.07,1.8,.07,'#465e58');label(sign,'P',0,1.8,.02,.65,.65);
 // Draw the same sidewalk and crossing edges that the residents use.
 const paving='#d6ceb5', joints=new Map(), jointGeometry=new THREE.CylinderGeometry(1,1,.035,12);
 const sidewalkY=p=>walk.index.near(p).some(r=>r.source==='regional'&&distanceToSegment(p,r.a,r.b)<r.hw+1.2)?.047:.155;
 walk.edges.forEach((list,u)=>{
  for(const edge of list){
   if(edge.to<=u||(!edge.crossing&&!edge.sidewalk))continue;
   const a=walk.nodes[u].pos,b=walk.nodes[edge.to].pos,mid=midpoint(a,b);
   const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);
   if(length<.001)continue;
   if(edge.crossing){
    const {hw,source}=edge.road;
    const hasTrafficOverlay=simulation.roads.some(r=>distanceToSegment(mid,r.a,r.b)<.08);
    const y=source==='regional'?.07:hasTrafficOverlay?.213:.126;
    const count=Math.max(3,Math.round(hw*2/.44)), spacing=hw*2/count;
    for(let i=0;i<count;i++){
     const d=-hw+spacing*(i+.5);
     const stripe=box(streets,mid[0]+dx/length*d,y,mid[1]+dz/length*d,ZEBRA_HALF_WIDTH*2,.012,spacing*.53,'#ece6cf');
     stripe.rotation.y=yaw;stripe.castShadow=false;
    }
   }else{
    const radius=Math.min(.55,Math.max(.09,-walk.index.depth(mid)));
    const strip=box(streets,mid[0],sidewalkY(mid),mid[1],radius*2,.035,length,paving);
    strip.rotation.y=yaw;strip.castShadow=false;
    for(const id of [u,edge.to])joints.set(id,Math.max(radius,joints.get(id)||0));
   }
  }
 });
 for(const [id,radius] of joints){
  const p=walk.nodes[id].pos,r=Math.min(radius,Math.max(.09,-walk.index.depth(p)));
  const joint=new THREE.Mesh(jointGeometry,material(paving));
  joint.position.set(p[0],sidewalkY(p),p[1]);joint.scale.set(r,1,r);streets.add(joint);
 }
 // Collapse street geometry by material; no per-dash draw calls.
 streets.updateMatrixWorld(true);const batches=new Map();streets.traverse(o=>{if(!o.isMesh)return;const geometries=batches.get(o.material)||[];geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));batches.set(o.material,geometries);});
 for(const [mat,geometries] of batches){const m=new THREE.Mesh(mergeGeometries(geometries),mat);m.receiveShadow=true;m.userData.weatherPaving=({'77867e':'road','d6ceb5':'sidewalk','a9a28f':'road'})[mat.color.getHexString()];root.add(m);geometries.forEach(g=>g.dispose());}
 jointGeometry.dispose();
 // Owned pack vehicles, re-tooned on load and fitted inside the simulation
 // footprint (traffic-fleet.js). Body colours retint a cloned geometry.
 async function packVehicle({model,colour},footprint){
  const m=FLEET_MODELS[model],fit=fitModel(model,footprint),base=await loadPackGeometry(m.path);
  const g=new THREE.Group(),geometry=m.retint&&colour!==LIVERY?retintGeometry(base,m.retint,colour):base;
  g.add(toonModel(geometry,{scale:fit.scale,offset:fit.offset}));g.userData.fleet={model,colour,pack:m.pack,size:fit.size};return g;
 }
 async function bicycle(index){
  const g=new THREE.Group(),bike=await place('cv-bicycle',{scale:.68});g.add(bike);
  // The owned bicycle faces +Z. A compact posed rider has pedalling knees,
  // a helmet and hands on the bars; no dialogue or floating status bubbles.
  box(g,0,1.17,-.1,.32,.48,.28,['#ce815f','#4d9291','#c3a459'][index%3]).rotation.x=.28;
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.17,1),material('#d8ac7e'));head.position.set(0,1.55,.04);g.add(head);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.19,8,6,0,Math.PI*2,0,Math.PI/2),material('#e4ca84'));helmet.position.set(0,1.6,.04);g.add(helmet);
  for(const x of [-.2,.2]){const arm=box(g,x,1.24,.17,.09,.36,.1,'#d8ac7e');arm.rotation.x=-.85;}
  const legs=[];for(const x of [-.13,.13])legs.push(box(g,x,.8,-.05,.12,.43,.15,'#3b575e'));g.userData.legs=legs;return g;
 }
 const fleet=assignFleet(simulation.vehicles),parked=parkedFleet(PARKING_BAYS);
 const objects=await Promise.all(simulation.vehicles.map(async (v,i)=>{const g=v.kind==='cycle'?await bicycle(v.id):await packVehicle(fleet[i],FOOTPRINT[v.kind]);g.name=`traffic-${v.kind}-${v.id}`;root.add(g);return g;}));
 const parkedObjects=await Promise.all(PARKING_BAYS.map(async (b,i)=>{if(b.type==='driveway')return null;const g=await packVehicle(parked[i],{length:b.length,width:b.width});g.name=`parked-${b.id}`;g.position.set(b.center[0],.215,b.center[1]);g.rotation.y=b.yaw;root.add(g);return g;}));
 // Kerbside furniture and bus shelters, instanced per model.
 const byModel=new Map();for(const it of streetPlan.items){if(!byModel.has(it.model))byModel.set(it.model,[]);byModel.get(it.model).push(it);}
 const furniture=new THREE.Group();furniture.name='Street furniture';root.add(furniture);
 await Promise.all([...byModel].map(async ([model,items])=>{const fm=FURNITURE_MODELS[model];
  if(fm.catalog){const template=await instantiate(fm.catalog);furniture.add(batchInstances(template,items.map(it=>({pos:it.pos,rotY:it.yaw,scale:fm.scale}))));}
  else furniture.add(await instancedModel(fm.path,items,{scale:fm.scale,y:0,name:model}));
 }));
 const sync=()=>{simulation.vehicles.forEach((v,i)=>{const g=objects[i];g.position.set(v.position[0],.215,v.position[1]);g.rotation.y=Math.atan2(...v.direction);g.userData.wheels?.forEach(w=>w.rotation.x=v.distance/.22);g.userData.legs?.forEach((leg,k)=>leg.rotation.x=Math.sin(v.distance*5+k*Math.PI)*.65);});};
 sync();
 const pickBounds=new THREE.Box3(),hitPoint=new THREE.Vector3();
 return {simulation,root,objects,parkedObjects,fleet,parked,streetPlan,pick(ray){
  let closest=null,best=Infinity;
  for(const [i,g] of objects.entries()){
   pickBounds.setFromObject(g);const hit=ray.intersectBox(pickBounds,hitPoint);if(!hit)continue;
   const distance=ray.origin.distanceTo(hit);if(distance>=best)continue;best=distance;
   const v=simulation.vehicles[i],f=fleet[i],role=f.role,modelName=FLEET_MODELS[f.model]?.name;
   const name=v.kind==='bus'?(v.route==='station'?'Thistlebrook West Loop':'Thistlebrook Town Loop'):role?.name||(v.kind==='cycle'?'Cycling through town':'Around-town drive');
   const detail=v.kind==='bus'?(v.route==='station'?'Route 2 · ':'Route 1 · ')+v.stops.map(s=>s.name).join(' → '):role?.detail||(v.kind==='cycle'?(v.route.endsWith('cycle')?'Riding the Civic Avenue cycle strip':'A ride through the neighbourhood'):`Local traffic · ${modelName}`);
   const story=v.kind==='bus'?'The town bus connects the shops, campus, quay and market. It pauses at each gold stop and gives people crossing the street time to pass.':role?.story||'Following the streets, slowing for the neighbours and waiting a turn at the junctions.';
   closest={type:'traffic',name,distance,bounds:pickBounds.clone(),object:g,data:{name,detail,story:story+' '+v.status+'.'}};
  }return closest;
 },update(dt){
  const pedestrians=residents.people.filter(p=>!p.actor.riding).map(p=>residentPedestrian(p.actor,residents.life.walkPace(p.actor)));
  if(world?.railway)pedestrians.push(...world.railway.service.pedestrians);
  const civic=world?.civicQuarter?.audit();if(civic){for(const p of civic.people)if(p.visible)pedestrians.push({x:p.position[0],z:p.position[2]});for(const p of [civic.engine,civic.delivery])pedestrians.push({x:p[0],z:p[2]});}
  // Kids walking to and from the ballgame are pedestrians too (civic.js / ballgame.js).
  for(const k of world?.districts?.civic?.audit?.().ballgame?.kids||[])pedestrians.push({x:k.position[0],z:k.position[2]});
  pedestrians.push(...(world?.districts?.civic?.school?.pedestrians ?? []));
  simulation.update(dt,pedestrians);sync();
 },audit:()=>({...simulation.audit(),fleet:fleet.map(f=>({id:f.id,model:f.model,colour:f.colour})),parked:parked.map(p=>({...p})),streets:{classes:streetPlan.classes,furniture:streetPlan.items.length,shelters:streetPlan.items.filter(i=>i.kind==='shelter').map(i=>i.stop),strips:streetPlan.strips.map(s=>s.id)}})};
}
