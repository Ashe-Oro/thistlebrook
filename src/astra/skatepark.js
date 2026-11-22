import {createRigidBatches} from './rigid-batches.js';
import {batchStaticMeshes} from './static-batches.js';
import {tagDistrictModels} from './registry/district-models.js';
import * as THREE from 'three';
import { place } from '../catalog/loader.js';
import { toonMaterial } from '../toon.js';
import { SKATEPARK } from './skatepark-layout.js';
import { bowlHeight, rampHeight, pumpHeight, pumpSurface, PUMP, bowlPose, streetPose, bikePose } from './skatepark-motion.js';

// Switchyard is a self-contained venue. No global timers, asset copies or RNG
// changes: all geometry is local to the compiled parcel and activity uses t.
export async function buildSkatepark(scene, town) {
 const venue = town.venues.find(v => v.id === SKATEPARK.id);
 if (!venue) return { update() {}, audit: () => ({ riders: [] }) };
 const root = new THREE.Group(), fixed = new THREE.Group(), moving = new THREE.Group();
 root.name = 'Switchyard Skate & Bike Park';
 root.position.set(...[venue.pos[0], 0, venue.pos[1]]); root.add(moving); scene.add(root);
 const cube = new THREE.BoxGeometry(1,1,1), sphere = new THREE.IcosahedronGeometry(1,2);
 const rod = new THREE.CylinderGeometry(1,1,1,8), wheels = new THREE.TorusGeometry(.39,.065,6,18);
 const ink = '#354c4c', cream = '#f5e9c9', teal = '#669d98', dark = '#376a68', coral = '#d18161';
 const mesh = (geo,color,x=0,y=0,z=0,parent=fixed) => {
  const m=new THREE.Mesh(geo,toonMaterial(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 };
 const box = (x,y,z,w,h,d,c,parent=fixed) => {const m=mesh(cube,c,x,y,z,parent);m.scale.set(w,h,d);return m;};
 const ball = (x,y,z,r,c,parent=fixed) => {const m=mesh(sphere,c,x,y,z,parent);m.scale.setScalar(r);return m;};
 const bar = (a,b,r,c,parent=fixed) => {
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),m=mesh(rod,c,0,0,0,parent);
  m.position.copy(av).add(bv).multiplyScalar(.5);m.scale.set(r,av.distanceTo(bv),r);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return m;
 };
 const line = (pts,r,c,parent=fixed) => {
  for(let i=1;i<pts.length;i++)bar(pts[i-1],pts[i],r,c,parent);
 };
 const sign = (text,x,y,z,width,color=dark,ground=false) => {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=200;
  const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1024,200);
  ctx.strokeStyle=cream;ctx.lineWidth=6;ctx.strokeRect(12,12,1000,176);
  ctx.fillStyle=cream;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 70px sans-serif';ctx.fillText(text,512,105,940);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width*200/1024),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));
  m.position.set(x,y,z);if(ground)m.rotation.x=-Math.PI/2;fixed.add(m);return m;
 };
 // Mesh a parametric surface with upward winding. Reused by the bowl and dirt.
 const surface = (nu,nv,fn,color) => {
  const p=[],indices=[];
  for(let u=0;u<=nu;u++)for(let v=0;v<=nv;v++)p.push(...fn(u/nu,v/nv));
  for(let u=0;u<nu;u++)for(let v=0;v<nv;v++){const a=u*(nv+1)+v,b=a+nv+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(indices);geo.computeVertexNormals();
  const material=toonMaterial(color).clone();material.side=THREE.DoubleSide;
  const m=new THREE.Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;fixed.add(m);return m;
 };
 box(0,.08,-.5,22.6,.18,30.7,'#c9bea2');
 box(-5.5,.17,6.2,10.6,.1,16.4,'#b9c7bc');
 box(5.5,PUMP.padTop-.06,-1,10.8,.12,28.2,'#d5ac80');
 // The bowl is raised above the island, with a fully modelled interior and
 // outer retaining wall. It is not a painted disk or an occluded ground hole.
 surface(28,80,(u,v)=>{const r=u*4.6,a=v*Math.PI*2;return [-5.3+r*Math.cos(a),bowlHeight(r),-8+r*Math.sin(a)];},teal);
 surface(1,80,(u,v)=>{const r=4.6+u*.65,a=v*Math.PI*2;return [-5.3+r*Math.cos(a),2.17,-8+r*Math.sin(a)];},cream);
 surface(1,80,(u,v)=>{const a=v*Math.PI*2;return [-5.3+5.25*Math.cos(a),.18+u*1.99,-8+5.25*Math.sin(a)];},dark);
 line(Array.from({length:81},(_,i)=>{const a=i/80*Math.PI*2;return [-5.3+4.61*Math.cos(a),2.2,-8+4.61*Math.sin(a)];}),.055,ink);
 for(const r of [1.8,3.2])line(Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return [-5.3+r*Math.cos(a),bowlHeight(r)+.025,-8+r*Math.sin(a)];}),.025,'#c5dcd1');
 // Three broad steps onto the deck, away from the run and the pedestrian gate.
 for(let i=0;i<4;i++)box(-5.3,.27+i*.25,-2.4-i*.45,3,.5+i*.5,.55,cream);
 sign('01 / THE BOWL',-5.3,2.35,-13.45,7.2);
 // Quarter pipe, coping, low manual pad and the uninterrupted flat-bar run.
 surface(20,1,(u,v)=>[-9.7+v*8,rampHeight(u*2),u*2],teal);
 box(-5.7,.85,-.2,8,1.7,.4,dark);bar([-9.7,1.77,0],[-1.7,1.77,0],.065,ink);
 box(-2.2,.38,7.3,1.4,.35,4,coral);box(-2.2,.58,7.3,1.5,.07,4.1,cream);
 bar([-5,.9,4.5],[-5,.9,8.5],.065,ink);
 for(const z of [4.7,8.3]){bar([-5,.23,z],[-5,.9,z],.055,ink);box(-5,.23,z,.65,.06,.35,ink);}
 sign('02 / STREET',-5.7,.24,13.5,6,dark,true);
 // Oval pump track, four visible colour bands and six shaped dirt rollers.
 // The exact same height function controls wheel contact in bikePose.
 surface(144,8,(u,v)=>{const a=u*Math.PI*2,w=(v-.5)*2*PUMP.halfWidth;return [5.8+(3.2+w)*Math.cos(a),pumpSurface(a,w),-1+(11.8+w)*Math.sin(a)];},'#b67e52');
 for(const side of [-1,1])surface(144,1,(u,v)=>{const a=u*Math.PI*2,w=side*.875;return [5.8+(3.2+w)*Math.cos(a),PUMP.padTop+v*(pumpSurface(a,w)-PUMP.padTop),-1+(11.8+w)*Math.sin(a)];},'#a7764d');
 for(const side of [-1,1])line(Array.from({length:145},(_,i)=>{const a=i/144*Math.PI*2;return [5.8+(3.2+side*.89)*Math.cos(a),pumpSurface(a,side*PUMP.halfWidth)+.02,-1+(11.8+side*.89)*Math.sin(a)];}),.045,'#edd2a0');
 for(let n=0;n<6;n++){const a=(n+.5)*Math.PI/3;line(Array.from({length:9},(_,j)=>{const w=(j/8-.5)*1.65;return [5.8+(3.2+w)*Math.cos(a),pumpSurface(a,w)+.025,-1+(11.8+w)*Math.sin(a)];}),.045,cream);}
 sign('03 / PUMP & FLY',5.8,.25,-1,5.2,dark,true);
 // Little planted island keeps pedestrians away from the fast line.
 for(const z of [-6,4]){box(5.8,.3,z,2.7,.3,2.6,'#b8b589');for(let i=0;i<5;i++)ball(5+Math.sin(i*4)*.5,.52,z+(i-2)*.36,.28,'#839a68');}
 // Boundary fence has a wide opening opposite the compiled access lane.
 for(const x of [-11,11]){for(let z=-15;z<=14;z+=2.9)bar([x,.18,z],[x,1.35,z],.055,ink);for(const y of [.6,1.25])bar([x,y,-15],[x,y,14],.04,ink);}
 for(const z of [-15,14.8])for(const [a,b] of z>0?[[-11,-8],[-4,11]]:[[-11,11]]){for(const y of [.6,1.25])bar([a,y,z],[b,y,z],.04,ink);}
 // Entrance canopy, map board, refill tap, bike rack and spectator benches.
 for(const x of [-8.3,-3.7])bar([x,.2,14.6],[x,3.6,14.6],.11,dark);
 sign('SWITCHYARD',-6,3.3,14.6,5.7);sign('SKATE + BIKE',-6,2.55,14.62,3.6,coral);
 for(let i=0;i<3;i++){const x=.2+i*.65;bar([x,.2,13.3],[x,1.1,13.3],.055,ink);bar([x,1.1,13.3],[x,1.1,14.3],.055,ink);bar([x,1.1,14.3],[x,.2,14.3],.055,ink);}
 box(-10,.65,12.5,.65,.9,.65,teal);bar([-10,.9,12.5],[-10,1.3,12.5],.08,ink);bar([-10,1.3,12.5],[-9.7,1.3,12.5],.06,ink);
 const loads=[],spectators=[];
 const owned=async(id,x,z,rot=0,scale=1)=>{const o=await place(id,{x,z,rotY:rot,scale});fixed.add(o);o.position.y+=.2;return o;};
 loads.push(owned('cv-bicycle',1,14,Math.PI/2,.9));
 for(const [x,z,rot] of [[.4,-11,Math.PI/2],[.4,-5,Math.PI/2],[-9.5,7,Math.PI/2]])loads.push(owned('cv-bench',x,z,rot,.8));
 for(const [n,[x,z]] of [[.2,-12.5],[.2,-8.7],[.2,-3.5],[-10,3.2],[-3.1,12.9],[2.1,14]].entries()){
  loads.push(place(['townsfolk-child','townsfolk-carpenter','townsfolk-herbalist','townsfolk-merchant','townsfolk-child','townsfolk-watch'][n],{scale:n===0?.95:1}).then(o=>{
   o.position.set(x,.22,z);o.rotation.y=x>0?Math.PI/2:-Math.PI/2;moving.add(o);spectators.push({o,n,x,z});
  }));
 }
 const lamps=[];
 for(const [x,z] of [[-10.7,-14.3],[10.6,13.6],[10.6,-14.3]]){
  bar([x,.2,z],[x,4.4,z],.07,ink);box(x,4.4,z,.85,.15,.5,cream);
  const lamp=new THREE.PointLight('#ffdc9d',0,17,1.5);lamp.position.set(x,4.2,z);root.add(lamp);lamps.push(lamp);
 }
 // Articulated riders are purpose built: the owned standing figures are used
 // for spectators, while knees, elbows and feet here match the equipment.
 function rider(color,skin,bike=false) {
  const o=new THREE.Group(),body=new THREE.Group(),gear=new THREE.Group();o.add(gear,body);moving.add(o);
  const upper=new THREE.Group();body.add(upper);const legs=[];
  const head=ball(0,1.64,0,.23,skin,upper);head.scale.y*=1.12;
  const helmet=mesh(new THREE.SphereGeometry(.265,12,8,0,Math.PI*2,0,Math.PI*.58),color,0,1.73,0,upper);
  box(0,1.74,.23,.35,.06,.18,ink,upper);bar([-.2,1.7,.02],[0,1.42,.12],.017,ink,upper);bar([.2,1.7,.02],[0,1.42,.12],.017,ink,upper);
  const torso=box(0,1.16,0,.5,.55,.32,color,upper);torso.rotation.x=bike?.22:0;
  box(0,.87,-.03,.44,.2,.3,ink,upper);
  for(let side=-1;side<=1;side+=2){
   const x=side*.21,foot=[x,bike?.49:.23,bike?-.08:side*.32],knee=[x,.6,.28];
   const thigh=bar([x,.88,0],knee,.105,ink,body),shin=bar(knee,foot,.08,skin,body);
   const shoe=box(...foot,.22,.12,.34,cream,body),pad=ball(...knee,.115,ink,body);
   legs.push({side,x,foot,thigh,shin,shoe,pad});
   const elbow=[side*.45,1.03,bike?.36:.1],hand=[side*(bike?.34:.6),bike?1.04:1.05,bike?.7:.15];
   bar([side*.25,1.35,0],elbow,.085,color,upper);bar(elbow,hand,.065,skin,upper);ball(...hand,.07,skin,upper);
  }
  const wheelObjects=[];
  if(bike){
   for(const z of [-.68,.73]){
    const wheel=new THREE.Group();wheel.position.set(0,.44,z);gear.add(wheel);
    const tyre=mesh(wheels,ink,0,0,0,wheel);tyre.rotation.y=Math.PI/2;
    for(let n=0;n<6;n++){const a=n*Math.PI/3;bar([0,0,0],[0,Math.sin(a)*.34,Math.cos(a)*.34],.012,cream,wheel);}
    wheelObjects.push(wheel);
   }
   const back=[0,.44,-.68],front=[0,.44,.73],crank=[0,.46,-.05],saddle=[0,.99,-.35],stem=[0,1.08,.53];
   for(const [a,b] of [[back,crank],[back,saddle],[saddle,crank],[saddle,stem],[stem,crank],[stem,front]])bar(a,b,.045,color,gear);
   box(0,1,-.36,.32,.09,.3,ink,gear);bar(stem,[0,1.08,.7],.04,ink,gear);bar([-.36,1.08,.7],[.36,1.08,.7],.04,ink,gear);
   bar([-.28,.48,-.05],[.28,.48,-.05],.035,ink,gear);
  }else{
   box(0,.13,0,.36,.09,1.18,ink,gear);for(const z of [-.57,.57]){const nose=box(0,.17,z,.36,.07,.2,color,gear);nose.rotation.x=z>0?-.2:.2;}
   for(const z of [-.38,.38]){bar([-.25,.08,z],[.25,.08,z],.025,ink,gear);for(const x of [-.23,.23]){const w=mesh(new THREE.CylinderGeometry(.08,.08,.1,8),cream,x,.08,z,gear);w.rotation.z=Math.PI/2;}}
  }
  return {o,body,upper,gear,wheelObjects,poseLegs(crouch,t){
   upper.position.y=-crouch;
   const segment=(m,a,b)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);m.position.copy(av).add(bv).multiplyScalar(.5);m.scale.y=av.distanceTo(bv);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());};
   for(const leg of legs){
    const {x,side}=leg,phase=t*7+(side<0?Math.PI:0);
    const foot=bike?[x,.49+Math.sin(phase)*.12,-.05+Math.cos(phase)*.12]:leg.foot;
    const knee=[x,.6-crouch*.4,.28+crouch*.5];
    segment(leg.thigh,[x,.88-crouch,0],knee);segment(leg.shin,knee,foot);
    leg.pad.position.set(...knee);leg.shoe.position.set(...foot);
   }
  }};
 }
 const actors=[
  {...rider('#dc9962','#d5a078'),name:'Remy',kind:'bowl',sample:t=>bowlPose(t,0)},
  {...rider('#7b95b1','#98633f'),name:'Jo',kind:'bowl',sample:t=>bowlPose(t,1)},
  {...rider('#d37d78','#b8835d'),name:'Frankie',kind:'street',sample:streetPose},
  {...rider('#e2b955','#d5a078',true),name:'Alex',kind:'bmx',sample:t=>bikePose(t,0)},
  {...rider('#709d97','#98633f',true),name:'Sasha',kind:'bmx',sample:t=>bikePose(t,1)},
 ];
 await Promise.all(loads);tagDistrictModels(fixed,town,'skatepark',venue.pos);
 // Batch the furniture, fences and surfaces; keep articulated riders separate.
 fixed.name='Skatepark scenery';
 batchStaticMeshes(fixed,root);
 const rigid=createRigidBatches(moving);
 let lastT=0;
 return {
  root, actors, stats:{skaters:3,bikers:2,spectators:6},
  update(t,hour,night){
   lastT=t;moving.visible=hour>=6&&hour<22;
   actors.forEach(a=>{
    const p=a.sample(t),next=a.sample(t+.015),dx=next.x-p.x,dz=next.z-p.z,d=Math.hypot(dx,dz);
    a.o.position.set(p.x,p.y+.015,p.z);a.o.rotation.set(0,d>.00001?Math.atan2(dx,dz):p.heading,0);
    a.gear.rotation.x=d>.00001?-Math.atan2(next.y-p.y,d):0;
    a.body.rotation.x=a.gear.rotation.x*.5;a.body.rotation.z=p.lean;
    a.poseLegs(p.crouch,t);
    // Gentle pedalling and compression; hands stay near the handlebars.
    if(a.kind==='bmx')a.wheelObjects.forEach(w=>w.rotation.x=-t*8);
    a.state=p.state;
   });
   spectators.forEach(({o,n})=>{o.rotation.y=(n<3?Math.PI/2:-Math.PI/2)+Math.sin(t*.6+n)*.16;o.position.y=.22+Math.max(0,Math.sin(t*2+n)-.8)*.1;});
   lamps.forEach(l=>l.intensity=night*22);
   rigid.update();
  },
  audit(){return {time:lastT,open:moving.visible,riders:actors.map(a=>({name:a.name,kind:a.kind,state:a.state,position:a.o.position.toArray()})),spectators:spectators.length};},
 };
}
