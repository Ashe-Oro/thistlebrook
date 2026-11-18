import { CAFE_COUNTER } from './life/animation-places.js';
import { tagObject, tagComponents, tagBatch } from './registry/render-tags.js';
import * as THREE from 'three';
import { place } from '../catalog/loader.js';
import { toonMaterial } from '../toon.js';
import { ROSTER, KID_SCALE, ballgameState } from './ballgame.js';
import { pedestrianGraph, walkBetween } from '../roads/pedestrian.js';

// Town-scale facilities have explicit parcels and entrances in the compiler.
// This module only furnishes them: it never invents another navigation layout.
export async function buildCivic(scene,town){
 const root=new THREE.Group(),dynamic=new THREE.Group();scene.add(dynamic);
 let assembly='built:school-0';
 const cube=new THREE.BoxGeometry(1,1,1),ball=new THREE.IcosahedronGeometry(1,1),jobs=[],students=[],football=[],baseball=[],gatherers=[],lamps=[];
 const box=(x,y,z,w,h,d,c,parent=root)=>{const m=new THREE.Mesh(cube,toonMaterial(c));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);tagObject(m,parent.userData.registryId||assembly);return m;};
 const orb=(x,y,z,r,c,parent=root)=>{const m=new THREE.Mesh(ball,toonMaterial(c));m.position.set(x,y,z);m.scale.setScalar(r);m.castShadow=true;parent.add(m);tagObject(m,parent.userData.registryId||assembly);return m;};
 const cylinder=(x,y,z,r,h,c,parent=root)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),toonMaterial(c));m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;parent.add(m);tagObject(m,parent.userData.registryId||assembly);return m;};
 const line=(points,c='#eee7d1',parent=root)=>{const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:c}));parent.add(l);tagObject(l,parent.userData.registryId||assembly);return l;};
 const label=(text,x,y,z,w,h=.65,c='#45645c',parent=root,flat=false)=>{const canvas=document.createElement('canvas');canvas.width=Math.min(4096,Math.max(128,Math.round(256*w/h)));canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle=c;ctx.fillRect(0,0,canvas.width,256);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff0d2';ctx.font='bold 180px Georgia';const fs=Math.min(180,180*(canvas.width-32)/Math.max(1,ctx.measureText(text).width));ctx.font=`bold ${fs}px Georgia`;ctx.fillText(text,canvas.width/2,132);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));m.position.set(x,y,z);if(flat)m.rotation.x=-Math.PI/2;parent.add(m);tagObject(m,parent.userData.registryId||assembly);return m;};
 const polygon=(points,y,c)=>{const vertices=points.map(p=>new THREE.Vector2(...p)),indices=THREE.ShapeUtils.triangulateShape(vertices,[]).flat(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(([x,z])=>[x,y,z]),3));g.setIndex(indices);g.computeVertexNormals();const mat=toonMaterial(c).clone();mat.side=THREE.DoubleSide;const m=new THREE.Mesh(g,mat);m.receiveShadow=true;root.add(m);tagObject(m,assembly);return m;};
 const player=async(role,x,z,scale=1,parent=dynamic)=>{const id=assembly,o=await place('townsfolk-'+role,{x,z,scale});tagObject(o,id);o.position.y=.18;parent.add(o);return o;};
 const ring=(x,y,z,r,t,c)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,6,40),toonMaterial(c));m.rotation.x=Math.PI/2;m.position.set(x,y,z);root.add(m);tagObject(m,assembly);return m;};
 // Thistlebrook High: brick classroom wings, a clock tower, lockers, flag and bus bay.
 box(-2,.05,-61,28,.1,12,'#c6b99e');
 for(const x of [-10,6]){
  box(x,2.8,-62,10,5.6,8,'#bc9078');box(x,.4,-62,10.25,.65,8.2,'#d8c6a5');
  box(x,5.7,-62,10.6,.25,8.5,'#647f75');box(x,5.98,-62,10.2,.3,8.15,'#dad1b9');
  for(const y of [1.7,4])for(let n=0;n<4;n++){const wx=x-3.6+n*2.4;box(wx,y,-57.94,1.65,1.55,.1,'#e5d9bc');box(wx,y,-57.86,1.35,1.3,.08,'#72989a');box(wx,y,-57.8,.07,1.3,.07,'#ded5b9');box(wx,y,-57.77,1.35,.07,.07,'#ded5b9');}
  for(let n=0;n<8;n++)box(x-4.6+n*1.3,3,-57.9,.55,.12,.04,'#d4ac8f');
 }
 assembly='built:school-1';box(-2,4.7,-60.5,5,9.4,9,'#dec6a2');box(-2,9.5,-60.5,5.5,.35,9.4,'#638074');box(-2,10.1,-60.5,3.8,1,6.8,'#8ca090');
 assembly='built:school-2';box(-2,1.5,-55.93,3,2.8,.12,'#47726d');for(const x of [-2.65,-1.35]){box(x,1.6,-55.82,1.12,2.2,.08,'#89aaa5');box(x+.38,1.3,-55.73,.07,.3,.07,'#e2c786');}
 for(let n=0;n<3;n++)box(-2,.12+n*.12,-55.3-n*.18,4,.2,.45,'#d0c4aa');tagObject(label('ASTRA HIGH',-2,5.2,-55.87,4.5,.85),'built:school-4');
 assembly='built:school-1';const clockFace=new THREE.Mesh(new THREE.CircleGeometry(1.05,32),new THREE.MeshBasicMaterial({color:'#f6e8c6'}));clockFace.position.set(-2,7.6,-55.9);root.add(tagObject(clockFace,assembly));line([[-2,7.6,-55.83],[-2,8.3,-55.83]],'#4e685d');line([[-2,7.6,-55.82],[-1.5,7.35,-55.82]],'#4e685d');
 for(let n=0;n<12;n++){const a=n/12*Math.PI*2;orb(-2+Math.sin(a)*.86,7.6+Math.cos(a)*.86,-55.8,.045,'#5b7567');}
 assembly='built:school-3';box(11,3.5,-56,.08,7,.08,'#9b977f');box(12,6.1,-56,2,1.05,.05,'#607f68');label('OWLS',12,6.12,-55.96,1.75,.5,'#607f68');
 for(const p of town.supplemental.filter(p=>p.key.startsWith('school-bench')))jobs.push(place(p.asset,{x:p.pos[0],z:p.pos[1],rotY:p.rot,scale:p.scale}).then(o=>root.add(tagObject(o,p.registryId))));
 // Parked school transport gives the campus a recognisable arrival point.
 assembly='built:school-5';box(21,.06,-61,4,.12,10,'#8d9991');const bus=new THREE.Group();bus.position.set(21,0,-61);root.add(bus);
 assembly='built:school-6';box(0,1.3,0,2,1.7,6.4,'#d7ad51',bus);box(0,2.25,0,2.1,.2,6.5,'#edc365',bus);box(0,.65,0,2.05,.25,6.5,'#6b7568',bus);
 for(const x of [-1.025,1.025])for(let n=0;n<5;n++)box(x,1.75,-2.5+n*1.1,.03,.7,.83,'#587c7b',bus);
 box(0,1.75,3.22,1.7,.7,.03,'#70918a',bus);box(0,1.55,-3.22,1.5,.6,.03,'#789c92',bus);
 for(const x of [-1.05,1.05])for(const z of [-2.1,2.1]){const wheel=cylinder(x,.5,z,.46,.22,'#46524e',bus);wheel.rotation.z=Math.PI/2;}
 label('ASTRA SCHOOL BUS',0,1,3.25,1.8,.28,'#cda34c',bus);
 for(let n=0;n<8;n++)jobs.push(player(['child','shopkeeper','herbalist','carpenter'][n%4],-2,-54.5,n%3===0?.85:1).then(o=>students.push({o,n})));
 // Baseball: grass outfield fan, four bases, pitching mound and backstop.
 assembly='built:baseball-0';const home=[-22,-73],fan=[home];for(let n=0;n<=48;n++){const a=-Math.PI*.75+n/48*Math.PI*.5;fan.push([home[0]+Math.cos(a)*24,home[1]+Math.sin(a)*24]);}polygon(fan,.08,'#87a66e');
 assembly='built:baseball-1';const diamond=[[-22,-73],[-14,-81],[-22,-89],[-30,-81]];polygon(diamond,.12,'#caab80');polygon(diamond.map(([x,z])=>[-22+(x+22)*.74,-81+(z+81)*.74]),.14,'#90ac75');
 assembly='built:baseball-2';for(const [x,z]of diamond)box(x,.2,z,.48,.12,.48,'#f2e8c9');assembly='built:baseball-3';cylinder(-22,.18,-81,.7,.12,'#d9ba8c');
 assembly='built:baseball-4';const foul=[fan[1],home,fan.at(-1)];line(foul.map(([x,z])=>[x,.18,z]));
 assembly='built:baseball-5';const fence=[];for(let n=0;n<=28;n++){const a=-Math.PI*.75+n/28*Math.PI*.5,x=-22+Math.cos(a)*24,z=-73+Math.sin(a)*24;box(x,1,z,.08,2,.08,'#647d67');fence.push([x,1.8,z]);}line(fence,'#7e9477');
 assembly='built:baseball-6';for(let n=0;n<9;n++){const x=-26+n;box(x,1.6,-71.6,.05,3.2,.05,'#718875');}for(let n=0;n<5;n++)line([[-26,.4+n*.6,-71.6],[-18,.4+n*.6,-71.6]],'#718875');
 assembly='built:baseball-7';label('ASTRA OWLS  /  BASEBALL',-22,2.5,-96.8,11,1.1);
 assembly='built:baseball-8';for(let n=0;n<3;n++)box(-35,.55+n*.4,-77-n*.5,5,.16,.45,'#bbab85');
 // Kids' pickup game (ballgame.js): nine players plus two waiting to bat, who
 // walk over from school on the sidewalk graph. Adult rigs scaled to child height.
 assembly='built:baseball-9';const kidWalk=(()=>{try{return walkBetween(pedestrianGraph(town),[-2,-54.5],[-22,-69]).map(s=>s.pos);}catch{return null;}})();
 ROSTER.forEach((r,n)=>jobs.push(player(r.look,r.spot[0],r.spot[1],KID_SCALE).then(o=>{const s=Math.abs(o.scale.x-1)<1e-6?KID_SCALE:1,jersey=box(0,1.15*s,.18*s,.66*s,.62*s,.24*s,n%2?'#e0d4b4':'#779087',o);let bat=null;if(r.role==='batter'||r.role==='waiting'){bat=box(.5*s,1.05*s,.2*s,.12*s,1.4*s,.12*s,'#c9a476',o);bat.rotation.z=.6;}o.visible=false;baseball[n]={o,n,bat,jersey};})));
 const baseballBall=orb(-22,1.5,-81,.10,'#f7ebcb',dynamic);
 // Stadium: marked gridiron, running track, tiered stands and goalposts.
 assembly='built:football-0';const sx=30,sz=-84;
 box(sx,.07,sz,58,.12,28,'#ba9076');box(sx,.14,sz,52,.07,22,'#7d9c70');
 for(let n=0;n<10;n++)box(sx-18+n*4,.2,sz,4,.035,18,n%2?'#7b9b6d':'#87a674');
 for(const side of [-1,1])box(sx+side*22.5,.2,sz,5,.04,18,'#607c6b');
 for(let n=0;n<=10;n++){const x=sx-20+n*4;box(x,.24,sz,.1,.025,18,'#eee4c5');if(n>0&&n<10)for(const z of [-6.8,6.8])label(String(Math.min(n,10-n)*10),x,.255,sz+z,1.2,.65,n%2?'#7b9b6d':'#87a674',root,true);}
 for(const side of [-1,1]){assembly='built:football-1';box(sx,.24,sz+side*9,50,.025,.12,'#eee4c5');for(let n=0;n<4;n++){assembly=`built:football-${side===-1?2:3}`;box(sx,.45+n*.38,sz+side*(11.7+n*.5),29,.18,.47,'#c1b18f');for(const x of [-13,0,13])box(sx+x,.2+n*.19,sz+side*(11.7+n*.5),.14,.5+n*.4,.13,'#7f8872');}
  assembly=`built:football-${side===-1?4:5}`;box(sx+side*25.5,2,sz,.17,4,.17,'#d6be82');box(sx+side*25.5,4,sz,.16,.17,5,'#e3c98f');for(const z of [-2.5,2.5])box(sx+side*25.5,5.2,sz+z,.14,2.4,.14,'#e3c98f');
  assembly='built:football-1';for(let lane=0;lane<2;lane++)line([[sx-27,.17,sz+side*(10+lane*.55)],[sx+27,.17,sz+side*(10+lane*.55)]],'#ddc4a0');
 }
 label('OWLS',sx-22.5,.25,sz,8,2.8,'#607c6b',root,true).rotation.z=Math.PI/2;label('ASTRA',sx+22.5,.25,sz,8,2.8,'#607c6b',root,true).rotation.z=-Math.PI/2;
 assembly='built:football-6';for(const x of [24,36])box(x,3,-99.5,.2,6,.2,'#6b7e70');box(30,5,-99.5,13,3,.2,'#3f6258');label('OWLS  14   •   GUESTS  07',30,5.6,-99.36,12,1,'#3f6258');label('3RD QUARTER   /   GO ASTRA!',30,4.35,-99.35,11,.7,'#3f6258');
 assembly='built:football-7';for(const x of [3,57])for(const z of [-96,-72]){box(x,4,z,.14,8,.14,'#7d8b7b');box(x,8,z,3,.5,.45,'#6b7e74');for(let n=0;n<3;n++){const m=box(x-1+n,7.95,z+.25,.7,.35,.06,'#ecdec0');lamps.push(m);}}
 for(let n=0;n<10;n++)jobs.push(player(['watch','blacksmith','carpenter'][n%3],sx,sz,.98).then(o=>{const color=n<5?'#5e867a':'#c7986c';box(0,1.1,.12,.7,.7,.4,color,o);orb(0,1.75,0,.30,color,o);football.push({o,n});}));
 for(let n=0;n<12;n++)jobs.push(player(['merchant','elder','farmhand','shopkeeper'][n%4],18+n%6*4,-96.8-Math.floor(n/6)*.55,.8,root).then(o=>{o.position.y=.65+Math.floor(n/6)*.6;}));
 assembly='built:football-8';const footballBall=orb(30,1,-84,.2,'#a87847',dynamic);footballBall.scale.set(.17,.17,.3);
 // Downtown: a paved meeting square, a fountain with flowing jets, shop
 // displays and distinct awnings. Local fronts follow the compiler rotation.
 assembly='built:fountain-0';box(-57,.07,-6,14,.12,14,'#b9b7a0');box(-57,.15,-6,13.6,.08,13.6,'#d8ceb2');
 for(let n=0;n<9;n++){box(-57,.2,-12+n*1.5,13.4,.018,.035,'#c4bba1');box(-63+n*1.5,.2,-6,.035,.018,13.4,'#c4bba1');}
 assembly='built:fountain-1';cylinder(-57,.3,-6,2.5,.32,'#b9b9a7');cylinder(-57,.56,-6,2.05,.26,'#6ba6ac');ring(-57,.72,-6,2.15,.2,'#dad2b9');cylinder(-57,1.12,-6,.3,1.35,'#c9c4ab');cylinder(-57,1.78,-6,1.05,.2,'#d7ceb4');cylinder(-57,1.9,-6,.86,.06,'#80bbc0');orb(-57,2.2,-6,.23,'#c4c7ae');
 assembly='built:fountain-2';const drops=[];for(let n=0;n<8;n++){const a=n/8*Math.PI*2,points=[];for(let k=0;k<=20;k++){const t=k/20;points.push(new THREE.Vector3(-57+Math.cos(a)*t*1.9,2+Math.sin(t*Math.PI)*.7-t*1.4,-6+Math.sin(a)*t*1.9));}const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,.035,4,false),jet=new THREE.Mesh(geo,toonMaterial('#a1d0cc'));root.add(tagObject(jet,assembly));const m=orb(-57,2,-6,.085,'#d6eee1',dynamic);drops.push({m,a,phase:n/8});}
 for(const p of town.supplemental.filter(p=>p.key.startsWith('fountain-bench')))jobs.push(place(p.asset,{x:p.pos[0],z:p.pos[1],rotY:p.rot,scale:p.scale}).then(o=>root.add(tagObject(o,p.registryId))));
 for(const [planterIndex,[x,z]] of [-62.6,-51.4].flatMap(x=>[-11.6,-.4].map(z=>[x,z])).entries()){assembly=`built:fountain-${planterIndex+3}`;box(x,.4,z,1.1,.65,1.1,'#ae9c7c');orb(x,1,z,.7,'#7c9e6b');orb(x+.1,1.5,z,.17,'#d2a4a2');}
 for(const b of town.buildings.filter(b=>b.district==='downtown')){assembly=`built:${b.key}-sign`;
  const o=new THREE.Group();o.position.set(...[b.pos[0],0,b.pos[1]]);o.rotation.y=b.rot;root.add(o);
  const colors=['#bd826c','#587f79','#a38e6d','#7d9c8b'],n=town.buildings.indexOf(b)%4,color=colors[n];
  const localFront=b.id==='cv-store'?3.85:b.id==='cv-bakery'?3.35:3;
  const shopLabel={'Sunrise Bakehouse':'BAKERY','Sole & Stitch':'SOLE & STITCH','The Reading Room':'BOOKS','Corner Cup Café':'CORNER CAFÉ','Petal & Stem':'FLOWERS','Thistlebrook Town Hall':'TOWN HALL','The Post Office':'POST OFFICE'}[b.name];label(shopLabel,0,3.55,localFront+.05,4.6,.65,color,o);
  if(b.name!=='Thistlebrook Town Hall')for(let k=0;k<8;k++){assembly=`built:${b.key}-awning`;const awning=box(-2.2+k*.62,2.52,localFront+.38,.62,.1,1.2,k%2?'#efe0bd':color,o);awning.rotation.x=.13;}
  if(b.name==='Sole & Stitch'){assembly=`built:${b.key}-display`;box(1.7,.7,localFront+.55,1.2,.14,.7,'#9f8661',o);for(const x of [1.4,1.9]){box(x,.88,localFront+.65,.22,.24,.45,'#926b4d',o);box(x,1.05,localFront+.52,.22,.4,.19,'#926b4d',o);}}
  if(b.name==='Sunrise Bakehouse'){assembly=`built:${b.key}-display`;box(-1.65,.75,localFront+.5,1.25,.18,.7,'#b1986c',o);for(let k=0;k<4;k++){const loaf=orb(-2+k*.24,.96,localFront+.5,.16,'#dab374',o);loaf.scale.z=.28;}}
  if(b.name==='Corner Cup Café'){
   const {x,z,width,depth}=CAFE_COUNTER;
   assembly=`built:${b.key}-awning`;
   box(x,.55,z,width,.87,depth,'#50776a',o);
   box(x,1.02,z,width+.12,.1,depth+.08,'#b89465',o);
   for(const dx of [-.47,.4])cylinder(x+dx,1.12,z,.09,.12,'#ead7ad',o);
  }
  if(b.name==='The Post Office')tagObject(box(1.6,.8,localFront+.5,.65,1.3,.65,'#658694',o),`built:${b.key}-display`);
 }
 for(let n=0;n<8;n++)jobs.push(player(['elder','merchant','herbalist','child','innkeeper','shopkeeper','farmhand','carpenter'][n],-57,-6,1.02).then(o=>gatherers.push({o,n})));
 // All static furnishing, private models included, is batched by geometry.
 await Promise.all(jobs);tagComponents(root,town,'civic.js');tagComponents(dynamic,town,'civic.js');root.updateMatrixWorld(true);const batches=new Map();root.traverse(o=>{if(!o.isMesh)return;const k=o.geometry.uuid+o.material.uuid;if(!batches.has(k))batches.set(k,{o,matrices:[],ids:[]});batches.get(k).matrices.push(o.matrixWorld.clone());batches.get(k).ids.push(o.userData.registryId);});for(const {o,matrices,ids}of batches.values()){const m=new THREE.InstancedMesh(o.geometry,o.material,matrices.length);tagBatch(m,ids);matrices.forEach((v,i)=>m.setMatrixAt(i,v));m.castShadow=o.castShadow;m.receiveShadow=o.receiveShadow;scene.add(m);}root.traverse(o=>{if(o.isLine){const c=o.clone();c.applyMatrix4(o.parent.matrixWorld);scene.add(c);}});
 let baseballManaged=false,lastGame=null;
 const fieldLights=[new THREE.PointLight('#ffe5b5',0,45,1.3),new THREE.PointLight('#d5edf1',0,35,1.3)];fieldLights[0].position.set(30,10,-84);fieldLights[1].position.set(-57,5,-6);fieldLights.forEach(l=>scene.add(l));
 return {setActivityOwner(type,managed){if(type==='baseball')baseballManaged=managed;},audit:()=>({students:students.map(a=>a.o.position.toArray()),football:football.map(a=>a.o.position.toArray()),baseball:baseballBall.position.toArray(),ballgame:lastGame&&{phase:lastGame.phase,kids:lastGame.kids.filter(k=>k.visible).map(k=>({role:k.role,position:[k.pos[0],k.y,k.pos[1]],activity:k.activity}))},fountain:drops.map(d=>d.m.position.toArray())}),stats:{students:8,baseballPlayers:ROSTER.length,footballPlayers:10,stadiumSpectators:12,fountainNeighbours:8},update(t,hour,night,weekday=4){
  fieldLights[0].intensity=night*55;fieldLights[1].intensity=night*9;
  for(const {m,a,phase}of drops){const u=(t*.5+phase)%1;m.position.set(-57+Math.cos(a)*u*1.9,2+Math.sin(u*Math.PI)*.7-u*1.4,-6+Math.sin(a)*u*1.9);}
  students.forEach(({o,n})=>{o.visible=hour>=7&&hour<18;const u=(t*.055+n/8)%1,d=u<.5?u*2:(1-u)*2;o.position.set(-2+d*18,.18+Math.abs(Math.sin(t*7+n))*.04,-54.5+(n%2?-.42:.42));o.rotation.y=u<.5?Math.PI/2:-Math.PI/2;});
  const cycle=t%12;football.forEach(({o,n})=>{o.visible=hour>=8&&hour<22;const side=n<5?-1:1,x=30+side*(5+Math.sin(cycle*.5+n)*4),z=-84+(n%5-2)*2.7+Math.sin(t+n)*.6;o.position.set(x,.18+Math.abs(Math.sin(t*7+n))*.07,z);o.rotation.y=side<0?Math.PI/2:-Math.PI/2;});footballBall.visible=hour>=8&&hour<22;footballBall.position.set(30+Math.sin(t*.8)*9,1+Math.abs(Math.cos(t*.8))*3,-84+Math.sin(t*.4)*3);footballBall.rotation.x=t*4;
  const game=ballgameState(hour,t,weekday,kidWalk);lastGame=game;
  baseball.forEach(({o,n,bat})=>{const k=game.kids[n];o.visible=k.visible;if(!k.visible)return;o.position.set(k.pos[0],k.y,k.pos[1]);o.rotation.y=k.heading;if(bat)bat.rotation.set(0,0,.6+k.swing*1.9);});
  baseballBall.visible=game.ball.visible;baseballBall.position.set(...game.ball.pos);
  gatherers.forEach(({o,n})=>{o.visible=hour>=6&&hour<23;const a=n/8*Math.PI*2+Math.sin(t*.15+n)*.08,r=3.7+(n%2)*.6;o.position.set(-57+Math.sin(a)*r,.18+Math.sin(t*2+n)*.015,-6+Math.cos(a)*r);o.rotation.y=a+Math.PI+Math.sin(t+n)*.12;});
 }};
}
