import {createRigidBatches} from './rigid-batches.js';
import {batchStaticLines,batchStaticMeshes} from './static-batches.js';
import { tagObject, tagComponents, buildAssembly } from './registry/render-tags.js';
import * as THREE from 'three';
import {place} from '../catalog/loader.js';
import {buildCivic} from './civic.js';
import {buildDowntown} from './downtown.js';
import {toonMaterial} from '../toon.js';

// Sports equipment is procedural; buildings, vegetation and all people come
// from the owned kit. Every activity stays inside its compiled venue parcel.
export async function buildDistricts(scene,town){
 const civic=await buildCivic(scene,town);
 const downtown=await buildAssembly(buildDowntown,scene,town,'downtown');
 const root=new THREE.Group(),dynamic=new THREE.Group();scene.add(dynamic);
 let assembly='built:tennis-0';
 const cube=new THREE.BoxGeometry(1,1,1),ball=new THREE.IcosahedronGeometry(1,1),actors=[],nightActors=[],tennis=[],basket=[],swings=[],bulbs=[];
 const box=(x,y,z,w,h,d,color,parent=root)=>{const m=new THREE.Mesh(cube,toonMaterial(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);tagObject(m,parent.userData.registryId||assembly);return m;};
 const orb=(x,y,z,r,color,parent=root)=>{const m=new THREE.Mesh(ball,toonMaterial(color));m.position.set(x,y,z);m.scale.setScalar(r);m.castShadow=true;parent.add(m);tagObject(m,parent.userData.registryId||assembly);return m;};
 const cylinder=(x,y,z,r,h,color,parent=root)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),toonMaterial(color));m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;parent.add(m);tagObject(m,parent.userData.registryId||assembly);return m;};
 const line=(points,color='#f5e8ce',parent=root)=>{const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));parent.add(m);tagObject(m,parent.userData.registryId||assembly);return m;};
 const circle=(x,z,r,color='#f3e6ce')=>line(Array.from({length:65},(_,n)=>[x+Math.cos(n/64*Math.PI*2)*r,.23,z+Math.sin(n/64*Math.PI*2)*r]),color);
 const rect=(x,z,w,d,color='#f2e4c7',thick=.09)=>{for(const k of [-1,1]){box(x+k*w/2,.23,z,thick,.025,d,color);box(x,.23,z+k*d/2,w,.025,thick,color);}};
 const sign=(label,x,y,z,width,background='#405b50')=>{const c=document.createElement('canvas');c.width=1024;c.height=180;const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,1024,180);ctx.fillStyle='#f9edcd';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='48px Georgia';ctx.fillText(label,512,91);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width*180/1024),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));m.position.set(x,y,z);root.add(m);tagObject(m,assembly);return m;};
 const person=async(role,x,z,scale=1.1)=>{const id=assembly,o=await place('townsfolk-'+role,{x,z,scale});tagObject(o,id);dynamic.add(o);o.position.y=.22;actors.push(o);return o;};
 const jobs=[];
 // North Common: two different games, visible boundaries, access gates,
 // courtside seats and a small playground rather than one empty green.
 for(const v of town.venues.filter(v=>['tennis','basketball'].includes(v.type))){
  assembly=`built:${v.id}-0`;const [x,z]=v.pos,w=v.type==='tennis'?25:19,d=16;
  box(x,.1,z,w,.15,d,'#d3c5a2');box(x,.18,z,w-1,.08,d-1,v.type==='tennis'?'#638e83':'#bf8670');
  if(v.type==='tennis'){
   box(x,.2,z,21.5,.025,11,'#719d8d');rect(x,z,21,11);rect(x,z,21,8.4);
   for(const side of [-1,1])box(x+side*6.4,.23,z,.09,.025,8.4,'#f2e4c7');box(x,.23,z,12.8,.025,.09,'#f2e4c7');
   assembly='built:tennis-1';for(const side of [-1,1])box(x,1,z+side*5.8,.12,1.8,.12,'#455f57');
   for(let k=0;k<24;k++)line([[x,.35,z-5.6+k*.48],[x,1.6,z-5.6+k*.48]],'#66786c');
   for(let k=0;k<6;k++)line([[x,.35+k*.24,z-5.6],[x,.35+k*.24,z+5.6]],'#66786c');
   box(x,1.65,z,.09,.09,11.6,'#f4e9cb');
   for(let n=0;n<2;n++)jobs.push(person(n?'herbalist':'carpenter',x+(n?9.5:-9.5),z).then(o=>{const racket=new THREE.Mesh(new THREE.TorusGeometry(.38,.055,6,14),toonMaterial('#c9a45f'));racket.scale.y=1.3;racket.position.set(.75,1.1,.25);o.add(tagObject(racket,'built:tennis-5'));box(.75,.63,.25,.07,.6,.07,'#8b7052',o);tennis.push({o,n,x,z});}));
   assembly='built:tennis-4';sign('NORTH COMMON  /  TENNIS',x,1.7,z-7.75,9);
  }else{
   rect(x,z,17,12);box(x,.24,z,.09,.025,12,'#f3e6ce');circle(x,z,1.8);
   for(const side of [-1,1]){rect(x+side*6.2,z,4.5,5);circle(x+side*4,z,1.6);box(x+side*8.85,1.7,z,.16,3.4,.16,'#526a65');box(x+side*8.7,3.7,z,.13,1.35,2.1,'#eee7d4');box(x+side*8.61,3.6,z,.025,.53,.8,'#b06c53');box(x+side*8.58,3.6,z,.03,.4,.63,'#f1e8d2');const hoop=new THREE.Mesh(new THREE.TorusGeometry(.44,.045,6,16),toonMaterial('#c47f53'));hoop.rotation.x=Math.PI/2;hoop.position.set(x+side*8.15,3.1,z);root.add(tagObject(hoop,`built:basketball-${side===-1?1:2}`));for(let n=0;n<8;n++){const a=n/8*Math.PI*2;line([[x+side*8.15+Math.cos(a)*.43,3.08,z+Math.sin(a)*.43],[x+side*8.15+Math.cos(a)*.28,2.5,z+Math.sin(a)*.28]],'#ece6d0');}}
   for(let n=0;n<4;n++)jobs.push(person(['watch','merchant','blacksmith','shopkeeper'][n],x+(n%2?3:-3),z+(n<2?-3:3)).then(o=>basket.push({o,n,x,z})));
   assembly='built:basketball-5';sign('PICK-UP GAMES  /  EVERYONE WELCOME',x,1.7,z-7.75,10);
  }
  // Open south gate connects to the public lane.
  assembly=`built:${v.id}-${v.type==='tennis'?2:3}`;for(const side of [-1,1]){for(let n=0;n<7;n++)box(x+side*(w/2-.15),1.2,z-7.3+n*2.4,.08,2.2,.08,'#6c7b64');for(const y of [.5,2.15])box(x+side*(w/2-.15),y,z,.055,.06,14.6,'#829077');for(let k=0;k<2;k++)box(x+side*(w/4+1),.8+k*.6,z+7.5,w/2-2,.07,.08,'#829077');}
  // Bleachers sit beyond the baseline and leave playing space clear.
  assembly=`built:${v.id}-${v.type==='tennis'?3:4}`;for(let n=0;n<2;n++)box(x,.42+n*.25,z-6.7-n*.55,8,.15,.5,'#c4ae86');
 }
 assembly='built:tennis-5';const tennisBall=orb(1,1,-44,.13,'#e5db72',dynamic),basketBall=tagObject(orb(28,.5,-44,.28,'#c07743',dynamic),'built:basketball-6');
 assembly='built:playground-0';const park=town.venues.find(v=>v.type==='playground'),[px,pz]=park.pos;
 box(px,.08,pz,17,.12,16,'#b8c495');assembly='built:playground-1';rect(px+3,pz+3,5,4,'#c4ad83',.2);box(px+3,.16,pz+3,4.8,.12,3.8,'#e3d0a6');
 assembly='built:playground-2';for(const side of [-1,1]){for(const dz of [-1,1]){const m=box(px-3+side*3,1.8,pz-2+dz, .15,3.8,.15,'#aa8060');m.rotation.x=dz*.25;}}
 box(px-3,3.65,pz-2,6.5,.18,.2,'#b7865f');
 for(let n=0;n<2;n++){assembly=`built:playground-${n+3}`;const swing=new THREE.Group();swing.position.set(px-4.4+n*2.7,3.55,pz-2);dynamic.add(swing);for(const dx of [-.5,.5])box(dx,-1.4,0,.035,2.8,.035,'#8b8b72',swing);box(0,-2.8,0,1.3,.12,.6,'#c58d61',swing);swings.push(swing);if(!n)jobs.push(person('child',0,0,.88).then(o=>{dynamic.remove(o);swing.add(o);o.position.set(0,-2.7,0);o.rotation.y=Math.PI;}));}
 assembly='built:playground-5';box(px+4,1.15,pz-3,2.2,2.3,2,'#ad956e');const slide=box(px+4,1.1,pz-1,1.1,.14,4,'#8eaaa1');slide.rotation.x=.52;for(let n=0;n<4;n++)box(px+2.5,.3+n*.5,pz-3,.7,.14,1.2,'#c3ad80');assembly='built:playground-6';sign('LITTLE OAK PLAYGROUND',px,2.1,pz-7,9,'#899775');
 // Lantern Quay: outdoor tables and a late-opening cluster of venues.
 for(const [index,{centre:[x,z]}] of town.courtyards.entries()){assembly=`built:table-${index}`;cylinder(x,.86,z,.72,.12,'#b28e66');cylinder(x,.43,z,.1,.8,'#8d745b');for(const side of [-1,1]){assembly=`built:chair-${index}-${side}`;box(x,.48,z+side*1.05,.6,.12,.6,'#b9a47c');box(x,.95,z+side*1.3,.65,.8,.1,'#b9a47c');for(const dx of [-.23,.23])box(x+dx,.25,z+side*1.05,.06,.5,.5,'#816e56');}assembly=`built:cup-${index}`;cylinder(x,.99,z,.12,.12,'#f0dfb8');}
 for(const [signIndex,[label,x,z]] of [['THE NIGHTJAR',55,-19.5],['LANTERN ROOM',55,-3.8],['MOONRISE',55,7.9]].entries()){assembly=`built:${town.buildings.filter(b=>b.district==='quay')[signIndex].key}-sign`;sign(label,x,3.8,z,5,label==='MOONRISE'?'#9a7987':'#48675e');}
 // String lights span the dining garden. A restrained pool of colour makes
 // the night quarter legible without replacing the cel shading with bloom.
 for(const [lightIndex,z] of [-17,-1,28].entries()){assembly=`built:quay-lights-${lightIndex}`;for(const x of [48,62])box(x,2.5,z,.12,5,.12,'#9e8563');const pts=[];for(let n=0;n<=30;n++){const t=n/30;pts.push([48+t*14,4.9-Math.sin(t*Math.PI)*.7,z]);}line(pts,'#6e775d');for(let n=0;n<12;n++){const t=(n+.5)/12,m=orb(48+t*14,4.8-Math.sin(t*Math.PI)*.7,z,.12,'#ffe2a3',dynamic);m.material=new THREE.MeshBasicMaterial({color:n%3?'#ffe0a3':'#edb3a5'});bulbs.push(m);}}
 // The bandstand is a destination, with a small audience court around it.
 assembly='built:bandstand-0';box(55,.14,26,13,.2,11,'#c7b996');assembly='built:bandstand-1';box(55,.54,24,9,.8,5,'#a08a6c');box(55,1,24,9,.12,5,'#beaa84');for(let n=0;n<3;n++)box(55,.25+n*.25,27-n*.35,4,.2,.5,'#b4a182');
 assembly='built:bandstand-2';for(const x of [51,59])box(x,3.4,22.2,.18,5,.18,'#92775c');box(55,4.2,22.4,8.3,2,.15,'#526c64');sign('THE RIVERSIDE SESSIONS',55,4.25,22.5,7.7);
 for(const side of [-1,1]){assembly=`built:bandstand-${side===-1?3:4}`;box(55+side*3.6,1.8,24,1.1,1.65,.8,'#3f514b');orb(55+side*3.6,1.85,24.42,.32,'#64776a');}
 assembly='built:bandstand-5';for(let n=0;n<3;n++)jobs.push(person(['baker','innkeeper','miller'][n],52.8+n*2.1,24,1.1).then(o=>{o.position.y=1.1;nightActors.push({o,n,musician:true,x:o.position.x,z:o.position.z});if(n<2){orb(.35,.8,.35,.31,'#b18a55',o);orb(.35,1.1,.35,.24,'#b18a55',o);box(.35,1.45,.35,.13,.8,.08,'#8b6b4c',o);}else{cylinder(0,.6,.6,.5,.5,'#97765a',o);}}));
 for(let n=0;n<8;n++)jobs.push(person(['elder','herbalist','carpenter','merchant','farmhand','watch','shopkeeper','blacksmith'][n],51.2+n%4*2.4,28.5+Math.floor(n/4)*2,1.1).then(o=>{nightActors.push({o,n,musician:false,x:o.position.x,z:o.position.z});}));
 for(let n=0;n<6;n++)jobs.push(person(['elder','herbalist','innkeeper','watch','carpenter','merchant'][n],town.courtyards[n<4?0:4].centre[0]+(n%2?1.25:-1.25),n<2?-17:n<4?-3:-12.5,1.05).then(o=>{nightActors.push({o,n:n+10,musician:false,terrace:true,x:o.position.x,z:o.position.z});}));
 // Keep additional static district geometry batched by shape and material.
 await Promise.all(jobs);tagComponents(root,town,'districts.js');tagComponents(dynamic,town,'districts.js');root.name='Common scenery';batchStaticMeshes(root,scene);batchStaticLines(root,scene);
 const rigid=createRigidBatches(dynamic);
 const warmLights=[[-12,55],[24,55]].map(([z,x])=>{const light=new THREE.PointLight('#ffd19b',0,18,1.3);light.position.set(x,5,z);scene.add(light);return light;});
 const venueRecords=town.venues.map(v=>({type:'venue',name:v.name,data:v,bounds:new THREE.Box3(new THREE.Vector3(v.box.min[0],0,v.box.min[1]),new THREE.Vector3(v.box.max[0],v.height||2,v.box.max[1]))}));
 venueRecords.push(...downtown.landmarkRecords);
 return {actors,venueRecords,civic,downtown,stats:{sportsPlayers:6,playgroundChildren:1,musicians:3,eveningAudience:8,terraceVisitors:6,...civic.stats,...downtown.stats},update(t,hour,night,weekday,weather){
  civic.update(t,hour,night,weekday,weather);
  downtown.update(t,hour,night,weather);
  warmLights.forEach(light=>light.intensity=night*26);
  const tx=1+Math.sin(t*.95)*9.2,tz=-44+Math.sin(t*1.9)*3;tennisBall.position.set(tx,.65+Math.abs(Math.cos(t*.95))*2.3,tz);tennisBall.visible=hour>6&&hour<21;
  for(const a of tennis){a.o.visible=hour>6&&hour<21;a.o.position.set(a.x+(a.n?10:-10),.22+Math.abs(Math.sin(t*6))*.03,tz);a.o.rotation.y=a.n?-Math.PI/2:Math.PI/2;a.o.rotation.z=Math.sin(t*.95+(a.n?Math.PI:0))*.1;}
  const cycle=t%10;for(const a of basket){a.o.visible=hour>6&&hour<22;const dx=Math.sin(t*.7+a.n*2)*2.6,dz=Math.cos(t*.8+a.n)*2;a.o.position.set(a.x+(a.n%2?2:-2)+dx,.22+Math.abs(Math.sin(t*7+a.n))*.04,a.z+(a.n<2?-2.5:2.5)+dz);a.o.rotation.y=Math.atan2(28-a.o.position.x,-44-a.o.position.z);}
  const shooter=basket[0]?.o;if(shooter){if(cycle<6)basketBall.position.set(shooter.position.x+.6,.4+Math.abs(Math.sin(t*8))*.75,shooter.position.z);else{const u=(cycle-6)/4;basketBall.position.set(26+(36.15-26)*u,1.4+1.7*u+Math.sin(Math.PI*u)*4,-45+u);}}basketBall.visible=hour>6&&hour<22;
  swings.forEach((s,n)=>s.rotation.x=Math.sin(t*1.5+n)*.38);nightActors.forEach(a=>{a.o.visible=hour>=17||hour<1;a.o.position.y=(a.musician?1.1:.22)+Math.abs(Math.sin(t*(a.musician?3:2)+a.n))*.07;a.o.rotation.y=a.terrace?(a.n%2?-Math.PI/2:Math.PI/2)+Math.sin(t*.5+a.n)*.1:a.musician?Math.sin(t+a.n)*.12:Math.PI+Math.sin(t*.7+a.n)*.2;a.o.rotation.z=Math.sin(t*2+a.n)*.045;});bulbs.forEach(m=>{m.visible=night>.15;});
  rigid.update();
 }};
}
