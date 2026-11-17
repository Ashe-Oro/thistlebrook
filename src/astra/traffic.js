import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from '../toon.js';
import { place } from '../catalog/loader.js';
import { createTrafficSimulation, PARKING_BAYS, CROSSWALKS } from './traffic-simulation.js';
import { distanceToSegment } from '../compiler/astra.js';
import { pedestrianGraph } from '../roads/pedestrian.js';
import { REGIONAL } from '../roads/regional.js';

// Self-contained integration: the compiler and resident routines stay untouched.
export async function createTraffic(scene,town,residents,world){
 const simulation=createTrafficSimulation(town),root=new THREE.Group();root.name='Astra town traffic';scene.add(root);
 const materials=new Map(),cube=new THREE.BoxGeometry(1,1,1),wheelGeo=new THREE.CylinderGeometry(.22,.22,.12,10);
 const material=color=>{if(!materials.has(color))materials.set(color,toonMaterial(color));return materials.get(color);};
 const box=(parent,x,y,z,w,h,d,color)=>{const m=new THREE.Mesh(cube,material(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const label=(parent,text,x,y,z,w,h,bg='#315e60',fg='#fff3d3')=>{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,512,128);c.fillStyle=fg;c.font='bold 64px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,68,480);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}));m.position.set(x,y,z);parent.add(m);return m;
 };
 const streets=new THREE.Group();
 for(const r of simulation.roads){const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
  const road=box(streets,(r.a[0]+r.b[0])/2,.185,(r.a[1]+r.b[1])/2,r.width-.12,.035,len,'#77867e');road.rotation.y=angle;
  // Soft cream dashes make the road hierarchy legible from the town view.
  for(let d=2;d<len-1;d+=3.5){const x=r.a[0]+dx*d/len,z=r.a[1]+dz*d/len;
   if(simulation.junctions.some(j=>j.points.some(p=>Math.hypot(p[0]-x,p[1]-z)<2))||simulation.crosswalks.some(c=>Math.hypot(c.point[0]-x,c.point[1]-z)<1.3))continue;
   const dash=box(streets,x,.209,z,.065,.012,.9,'#e1d6b3');dash.rotation.y=angle;
  }
 }
 for(const c of simulation.crosswalks){const g=new THREE.Group();g.position.set(c.point[0],0,c.point[1]);g.rotation.y=c.axis==='x'?Math.PI/2:0;streets.add(g);
  for(let i=-2;i<=2;i++)box(g,0,.221,i*.36,2.45,.025,.2,'#f0e7cb');
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
 for(const b of PARKING_BAYS){const [x,z]=b.center,edge=b.road[1]+1.5;box(streets,x,.2,z,3.2,.03,1.6,'#77867e');box(streets,x,.19,(edge+z-.8)/2,2.2,.03,Math.abs(z-.8-edge)+.05,'#a9a28f');for(const dx of [-1.5,1.5])box(streets,x+dx,.223,z,.055,.02,1.3,'#e4e4c8');box(streets,x,.223,z+.62,3,.02,.055,'#e4e4c8');}
 const sign=new THREE.Group();sign.position.set(-75.3,0,-12.2);root.add(sign);box(sign,0,1,0,.07,1.8,.07,'#465e58');label(sign,'P',0,1.8,.02,.65,.65);
 // Sidewalks and junction crosswalks come from the pedestrian graph that
 // residents route on (grok-roads), so what is drawn is where people walk.
 {const g=pedestrianGraph(town),regional=p=>g.surfaces.some(s=>s.source==='regional'&&distanceToSegment(p,s.a,s.b)<REGIONAL.verge/2+.2);
  g.edges.forEach((list,u)=>{for(const e of list){if(e.to<u)continue;const a=g.nodes[u].pos,b=g.nodes[e.to].pos,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.05)continue;const yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);
   if(e.crossing){if(CROSSWALKS.some(c=>Math.hypot(c.point[0]-mid[0],c.point[1]-mid[1])<1.6))continue;const y=regional(mid)?.07:.21,n=Math.max(2,Math.floor(len/.5));for(let k=1;k<n;k++){const t=k/n,m=box(streets,a[0]+(b[0]-a[0])*t,y,a[1]+(b[1]-a[1])*t,1.05,.012,.24,'#ece6cf');m.rotation.y=yaw;m.castShadow=false;}continue;}
   if(g.nodes[u].kind!=='kerb'||g.nodes[e.to].kind!=='kerb'||regional(mid))continue;
   const m=box(streets,mid[0],.14,mid[1],1.0,.06,len+.12,'#d6ceb5');m.rotation.y=yaw;m.castShadow=false;}});}
 // Collapse street geometry by material; no per-dash draw calls.
 streets.updateMatrixWorld(true);const batches=new Map();streets.traverse(o=>{if(!o.isMesh)return;const geometries=batches.get(o.material)||[];geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));batches.set(o.material,geometries);});
 for(const [mat,geometries] of batches){const m=new THREE.Mesh(mergeGeometries(geometries),mat);m.receiveShadow=true;root.add(m);geometries.forEach(g=>g.dispose());}
 function vehicle(kind,color,route='town'){
  const g=new THREE.Group(),len=kind==='bus'?3.2:kind==='van'?2.2:1.85,w=kind==='bus'?.98:.88;
  box(g,0,.4,0,w,.38,len,color);box(g,0,.25,0,w+.04,.12,len-.1,'#3c514e');
  if(kind==='bus'){
   box(g,0,.92,-.05,w,1.04,len-.1,'#e7d6a4');box(g,0,1.47,-.05,w+.08,.12,len,'#346d6a');box(g,0,.55,0,w+.02,.24,len,'#458b83');
   for(const side of [-1,1])for(let k=0;k<5;k++)box(g,side*(w/2+.007),1.08,-1.22+k*.53,.02,.44,.4,'#466568');
   box(g,0,1.09,len/2,.78,.47,.025,'#466568');label(g,route==='station'?'2 • WEST LOOP':'1 • TOWN LOOP',0,1.39,len/2+.025,.88,.16);
   const door=box(g,-w/2-.018,.78,1,.025,.9,.4,'#294e52');g.userData.door=door;
   box(g,0,1.56,-.4,.6,.13,.7,'#d1d0b8');
  }else if(kind==='van'){
   box(g,0,.92,-.38,w,.9,1.3,'#e3dfcb');box(g,0,.87,.52,w*.9,.72,.8,color);
   box(g,0,1,.94,w*.76,.36,.035,'#52767a');
   for(const side of [-1,1]){const panel=label(g,'ASTRA POST',side*(w/2+.01),1,-.3,1.05,.22,'#e3dfcb','#356860');panel.rotation.y=side*Math.PI/2;}
   const parcel=box(g,-.85,.35,-.45,.36,.32,.35,'#be8d55');parcel.visible=false;g.userData.parcel=parcel;
  }else{
   box(g,0,.7,-.12,w*.82,.47,1.03,color);box(g,0,.77,.405,w*.7,.28,.025,'#52767a');box(g,0,.77,-.645,w*.7,.26,.025,'#52767a');
   for(const side of [-1,1])box(g,side*w*.42,.78,-.1,.02,.27,.75,'#52767a');box(g,0,.97,-.12,w*.83,.09,1.02,color);
  }
  const wheels=[];
  for(const side of [-1,1])for(const z of [-len*.31,len*.31]){const m=new THREE.Mesh(wheelGeo,material('#293d3d'));m.rotation.z=Math.PI/2;m.position.set(side*w/2,.23,z);g.add(m);wheels.push(m);const hub=box(g,side*(w/2+.065),.23,z,.018,.13,.13,'#afbab0');hub.castShadow=false;}
  for(const side of [-1,1]){box(g,side*w*.32,.5,len/2+.015,.16,.12,.025,'#ffe7a0');box(g,side*w*.32,.5,-len/2-.015,.15,.1,.025,'#b75442');}
  g.userData.wheels=wheels;return g;
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
 const colors=['#cd7358','#e9bd63','#82aa9d','#6e90a1','#e4dcc4'];
 const objects=await Promise.all(simulation.vehicles.map(async v=>{const g=v.kind==='cycle'?await bicycle(v.id):vehicle(v.kind,colors[v.id%colors.length],v.route);g.name=`traffic-${v.kind}-${v.id}`;root.add(g);return g;}));
 PARKING_BAYS.forEach((b,i)=>{const g=vehicle('car',colors[(i+1)%colors.length]);g.position.set(b.center[0],.22,b.center[1]);g.rotation.y=b.yaw;root.add(g);});
 const sync=()=>{simulation.vehicles.forEach((v,i)=>{const g=objects[i];g.position.set(v.position[0],.22,v.position[1]);g.rotation.y=Math.atan2(...v.direction);g.userData.wheels?.forEach(w=>w.rotation.x=v.distance/.22);g.userData.legs?.forEach((leg,k)=>leg.rotation.x=Math.sin(v.distance*5+k*Math.PI)*.65);if(g.userData.door)g.userData.door.scale.z=v.wait>0?.2:.4;if(g.userData.parcel)g.userData.parcel.visible=v.wait>0;});};
 sync();
 const pickBounds=new THREE.Box3(),hitPoint=new THREE.Vector3();
 return {simulation,root,objects,pick(ray){
  let closest=null,best=Infinity;
  for(const [i,g] of objects.entries()){
   pickBounds.setFromObject(g);const hit=ray.intersectBox(pickBounds,hitPoint);if(!hit)continue;
   const distance=ray.origin.distanceTo(hit);if(distance>=best)continue;best=distance;
   const v=simulation.vehicles[i],name=v.kind==='bus'?(v.route==='station'?'Astra West Loop':'Astra Town Loop'):v.kind==='van'?'Astra Post':v.kind==='cycle'?'Cycling through town':'Around-town drive';
   const detail=v.kind==='bus'?(v.route==='station'?'Route 2 · ':'Route 1 · ')+v.stops.map(s=>s.name).join(' → '):v.kind==='van'?'Local delivery round':v.kind==='cycle'?'A ride through the neighbourhood':'Local traffic';
   const story=v.kind==='bus'?'The town bus connects the shops, campus, quay and market. It pauses at each gold stop and gives people crossing the street time to pass.':v.kind==='van'?'Parcels travel by road to the shops and quay. The van pulls up for a short unloading stop before continuing its round.':'Following the streets, slowing for the neighbours and waiting a turn at the junctions.';
   closest={type:'traffic',name,distance,bounds:pickBounds.clone(),object:g,data:{name,detail,story:story+' '+v.status+'.'}};
  }return closest;
 },update(dt){
  const pedestrians=residents.people.map(p=>{const target=p.route.length?p.route[0].pos:null,x=p.object.position.x,z=p.object.position.z,d=target?Math.hypot(target[0]-x,target[1]-z):0,moving=d>.01&&p.actor.action?.tool==='walkTo',pace=p.context.personality.pace;return {x,z,vx:moving?(target[0]-x)/d*pace:0,vz:moving?(target[1]-z)/d*pace:0};});
  const civic=world?.civicQuarter?.audit();if(civic){for(const p of civic.people)if(p.visible)pedestrians.push({x:p.position[0],z:p.position[2]});for(const p of [civic.engine,civic.delivery])pedestrians.push({x:p[0],z:p[2]});}
  // Kids walking to and from the ballgame are pedestrians too (civic.js / ballgame.js).
  for(const k of world?.districts?.civic?.audit?.().ballgame?.kids||[])pedestrians.push({x:k.position[0],z:k.position[2]});
  simulation.update(dt,pedestrians);sync();
 },audit:()=>simulation.audit()};
}
