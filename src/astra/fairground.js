import {furnitureId} from './registry/district-furniture.js';
import {tagNewFurniture} from './registry/furniture-tags.js';
import {tagDistrictModels} from './registry/district-models.js';
import * as THREE from 'three';
import { place } from '../catalog/loader.js';
import { toonMaterial } from '../toon.js';
import { fairSchedule } from '../compiler/astra-fair.js';
import { createFairLife } from './fair-life.js';

const C={cream:'#f4dfad',red:'#cf7969',teal:'#578e89',ink:'#485e58',gold:'#d8ad5d',wood:'#a78962'};
export async function buildFairground(scene,town){
  const fixed=new THREE.Group(),moving=new THREE.Group();moving.name='Merrymead rides';scene.add(moving);
  const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,10,8),cylinder=new THREE.CylinderGeometry(1,1,1,16);
  const bulbs=[],ducks=[],horses=[],riders=[],musicians=[],ripples=[];
  const mesh=(geo,color,x,y,z,parent=fixed)=>{const m=new THREE.Mesh(geo,toonMaterial(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const box=(x,y,z,w,h,d,color,parent)=>{const m=mesh(cube,color,x,y,z,parent);m.scale.set(w,h,d);return m;};
  const ball=(x,y,z,r,color,parent)=>{const m=mesh(sphere,color,x,y,z,parent);m.scale.setScalar(r);return m;};
  const disk=(x,y,z,r,h,color,parent)=>{const m=mesh(cylinder,color,x,y,z,parent);m.scale.set(r,h,r);return m;};
  const beam=(a,b,width,color,parent=fixed)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),m=mesh(cylinder,color,...av.clone().add(bv).multiplyScalar(.5).toArray(),parent);m.scale.set(width,av.distanceTo(bv),width);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return m;};
  const ring=(x,y,z,r,width,color,parent=fixed)=>mesh(new THREE.TorusGeometry(r,width,6,64),color,x,y,z,parent);
  const sign=(label,x,y,z,width,color=C.ink)=>{
    const c=document.createElement('canvas');c.width=1024;c.height=180;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle=C.cream;ctx.lineWidth=3;ctx.strokeRect(12,12,1000,156);ctx.fillStyle=C.cream;ctx.font='bold 60px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,512,94);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width*180/1024),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));m.position.set(x,y,z);fixed.add(m);return m;
  };
  const bulb=(x,y,z,parent=moving,color='#ffe0a0')=>{const m=ball(x,y,z,.11,color,parent);m.material=new THREE.MeshBasicMaterial({color});bulbs.push(m);return m;};
  const load=async(id,x,z,scale=1,rot=0,parent=fixed)=>{const o=await place(id,{x,z,scale,rotY:rot});parent.add(o);return o;};
  const jobs=[];

  // Warm paving distinguishes the midway, while the pond and picnic grounds
  // remain green. The compiled paths already connect every entrance.
  box(-64,.03,-90,20,.05,19,'#b9c58e');
  disk(-64,.13,-91,9,.12,'#d8c8a2');disk(-50,.14,-68,6.3,.14,'#ddcba7');
  box(-67,.04,-45,18,.06,15,'#9eb57b');box(-49,.08,-46,12,.12,16,'#d8c9a8');
  // Alternating mowing stripes make the picnic lawn readable at town scale.
  for(let n=0;n<6;n++)box(-49,.045,-98+n*2.8,9,.035,1.4,'#a3bb7b');

  // A little eight-car wheel. Each suspended cabin counter-rotates, so its
  // floor stays level instead of tumbling with the wheel.
  const wheel=new THREE.Group();wheel.position.set(-64,10.2,-91);moving.add(wheel);
  for(const z of [-1,1]){
    ring(0,0,z,7,.18,C.teal,wheel);ring(0,0,z,6.6,.06,C.gold,wheel);
    for(let n=0;n<8;n++){const a=n/8*Math.PI*2;beam([0,0,z],[Math.cos(a)*7,Math.sin(a)*7,z],.075,C.cream,wheel);}
  }
  for(let n=0;n<32;n++){const a=n/32*Math.PI*2;bulb(Math.cos(a)*7,Math.sin(a)*7,1.15,wheel);}
  const cabins=[];
  for(let n=0;n<8;n++){
    const a=n/8*Math.PI*2,g=new THREE.Group();g.position.set(Math.cos(a)*7,Math.sin(a)*7,0);wheel.add(g);cabins.push(g);
    beam([-0.1,0,-1.25],[-0.1,0,1.25],.10,C.gold,g);
    box(0,-1.1,0,1.65,.24,1.9,n%2?C.red:C.teal,g);
    for(const x of [-.78,.78]){box(x,-.65,0,.1,.85,1.9,n%2?C.red:C.teal,g);beam([x,-1,0],[x,.1,0],.055,C.cream,g);}
    box(0,-.65,-.92,1.65,.8,.12,C.cream,g);box(0,-.75,.92,1.65,.55,.12,n%2?C.red:C.teal,g);
    box(0,.2,0,1.95,.14,2.2,C.cream,g);
    for(const z of [-1.1,1.1])bulb(0,.25,z,g);
    if(n%2===0)jobs.push(load('townsfolk-child',0,0,.55,0,g).then(o=>{o.position.y=-.95;riders.push(o);}));
  }
  for(const z of [-92.65,-89.35])for(const x of [-67.8,-60.2]){
    beam([x,.25,z],[-64,10.2,z],.20,C.cream);box(x,.35,z,1.3,.5,1.2,C.wood);
  }
  beam([-64,10.2,-93],[-64,10.2,-89],.38,C.gold);
  ball(-64,10.2,-88.8,.55,C.red);
  sign('LITTLE SKYWHEEL',-64,3.5,-88.3,7.2);
  box(-58,.65,-87,2,1.2,1.6,C.teal);box(-58,2,-87,2.5,.22,2,C.cream);sign('TICKETS',-58,1.35,-86.15,1.7);
  for(const x of [-61,-58]){for(const z of [-86.3,-84,-82])box(x,.8,z,.1,1.5,.1,C.wood);box(x,1.25,-84.2,.08,.1,4.5,C.cream);}

  // Carousel deck, striped tent roof, and individually bobbing carved ponies.
  const carousel=new THREE.Group();carousel.position.set(-50,.2,-68);moving.add(carousel);
  disk(0,.25,0,4.6,.4,C.red,carousel);disk(0,.5,0,4.35,.16,C.cream,carousel);
  disk(0,2.65,0,.42,4.4,C.gold,carousel);
  for(let n=0;n<12;n++){
    const roof=mesh(new THREE.ConeGeometry(5.1,2.2,1,1,false,n/12*Math.PI*2,Math.PI/6),n%2?C.cream:C.red,0,5,0,carousel);
    // ConeGeometry's per-sector cap closes each stripe without a texture.
    roof.material=roof.material.clone();roof.material.side=THREE.DoubleSide;
    const a=n/12*Math.PI*2;
    bulb(Math.sin(a)*4.85,3.98,Math.cos(a)*4.85,carousel);
  }
  ring(0,3.91,0,4.9,.12,C.gold,carousel).rotation.x=Math.PI/2;
  ball(0,6.2,0,.3,C.gold,carousel);
  for(let n=0;n<6;n++){
    const a=n/6*Math.PI*2,x=Math.sin(a)*3.25,z=Math.cos(a)*3.25;
    beam([x,.5,z],[x,4,z],.055,C.gold,carousel);
    const horse=new THREE.Group();horse.position.set(x,1.35,z);horse.rotation.y=a+Math.PI/2;carousel.add(horse);horses.push(horse);
    // Small stylised wooden horses, with saddles, bridles, tails and four legs.
    const body=ball(0,0,0,.55,n%2?C.cream:'#d4b88a',horse);body.scale.set(.4,.45,.8);
    beam([0,.05,.45],[0,.6,.65],.19,C.cream,horse);box(0,.65,.83,.37,.38,.65,C.cream,horse);
    for(const x of [-.16,.16]){box(x,.95,.64,.08,.28,.13,C.gold,horse);for(const z of [-.4,.4])beam([x,-.2,z],[x,-.75,z+.12],.07,C.cream,horse);}
    box(0,.31,-.05,.52,.16,.5,C.teal,horse);beam([0,0,-.65],[0,-.4,-.95],.09,C.wood,horse);
    for(const x of [-.2,.2])ball(x,.72,.86,.035,C.ink,horse);
    if(n%2===0)jobs.push(load('townsfolk-child',0,0,.48,0,horse).then(o=>{o.position.y=.36;riders.push(o);}));
  }
  sign('MEADOW CAROUSEL',-50,1.7,-62.6,6.2,C.red);
  for(const x of [-55.5,-44.5])for(const z of [-72,-68,-64]){box(x,.7,z,.12,1.4,.12,C.cream);ball(x,1.45,z,.12,C.gold);}

  // Pond: irregular shore, quiet highlights, reeds, and actual owned duck GLBs.
  const pondShape=new THREE.Shape();
  for(let n=0;n<=64;n++){const a=n/64*Math.PI*2,r=1+Math.sin(a*3)*.07;const x=Math.cos(a)*7*r,z=Math.sin(a)*5.2*r;n?pondShape.lineTo(x,z):pondShape.moveTo(x,z);}
  const pondGeo=new THREE.ShapeGeometry(pondShape,48);
  const water=(scale,color,y)=>{const m=mesh(pondGeo,color,-67,y,-68);m.rotation.x=-Math.PI/2;m.scale.setScalar(scale);m.castShadow=false;return m;};
  water(1.12,'#c3c5a0',.08);water(1,'#6caaa7',.10);water(.86,'#79b7b2',.115);
  for(let n=0;n<14;n++){const a=n*2.4,r=2+n%3*.9,x=-67+Math.cos(a)*r,z=-68+Math.sin(a)*r*.8;const m=box(x,.14,z,.7,.015,.035,'#b4d7cb',moving);m.castShadow=false;ripples.push({m,x,phase:n});}
  for(let n=0;n<7;n++)jobs.push(load('farm-duck',-67,-68,.7,0,moving).then(o=>{o.userData.placementOrdinal=n;ducks[n]=o;}));
  for(const [x,z]of [[-73,-67],[-71,-72],[-61,-69],[-63,-73]]){
    for(let n=0;n<5;n++){const dx=Math.sin(n*2)*.3,dz=Math.cos(n*2)*.3;beam([x+dx,.1,z+dz],[x+dx+.1,.8+n%3*.17,z+dz],.025,'#718b60');disk(x+dx+.08,.85+n%3*.17,z+dz,.07,.32,'#8d6a4d');}
    disk(x,.15,z,.48,.07,'#8ea96d');
  }
  sign('WILLOW POND',-70,1.1,-61.4,3.8);

  // Owned market stalls form a food court, with west-facing service counters.
  for(const [n,z]of [-51,-47,-43].entries()){
    jobs.push(load('cv-market-stall',-48.5,z,1, -Math.PI/2));
    for(const dz of [-1.25,1.25])box(-50.2,1.35,z+dz,.08,2.7,.08,C.wood);
    const labels=['LEMONADE','WARM BUNS','BERRY SCOOPS'];
    const s=sign(labels[n],-50.2,2.7,z,2.8,[C.teal,C.gold,C.red][n]);s.rotation.y=-Math.PI/2;
    jobs.push(load('townsfolk-'+['merchant','baker','shopkeeper'][n],-47.9,z,1,-Math.PI/2,moving).then(o=>musicians.push({o,vendor:true,base:0})));
  }
  for(const x of [-52.5,-45.5])box(x,1.65,-40.4,.12,3.3,.12,C.wood);
  sign('THE PICNIC PANTRY',-49,3.4,-40.4,7.5,C.red);

  // Picnic tables, a checked blanket, and cups make the lawn an actual place.
  for(const z of [-87,-90,-93]){
    const start=fixed.children.length;
    box(-48.6,.94,z,2.3,.15,1.4,C.wood);
    for(const x of [-49.95,-47.25]){box(x,.5,z,.55,.13,1.7,C.cream);for(const dz of [-.55,.55])box(x,.25,z+dz,.13,.5,.13,C.wood);}
    for(const x of [-49.3,-47.9])box(x,.45,z,.13,.9,.9,C.wood);
    disk(-48.6,1.09,z,.15,.14,C.cream);ball(-49,1.14,z,.12,C.red);tagNewFurniture(fixed,start,furnitureId('fair','picnic-table',-48.6,0,z));
  }
  box(-47,.12,-96,3.5,.04,2.1,'#d7947c');
  for(let x=0;x<5;x++)for(let z=0;z<3;z++)if((x+z)%2===0)box(-48.4+x*.7,.15,-96.7+z*.7,.7,.015,.7,C.cream);
  jobs.push(load('cv-crate',-45.5,-96,.5));

  // Lawn games and picnic circles occupy the gaps between the reserved
  // rides and paths. Owned kit props match the existing food court.
  const lawnGuests=[];
  for(const [x,z]of [[-73,-88],[-73,-54],[-59,-96]]){
    box(x,.13,z,3.4,.05,2.4,C.red);
    for(let n=0;n<4;n++)box(x-1.25+n*.85,.16,z,.38,.02,2.3,C.cream);
    jobs.push(load('cv-crate',x+1.3,z+.6,.45));
    jobs.push(load('farm-produce-crates',x-.6,z,.4));
    for(const [n,dx,dz]of [[0,-1.7,.4],[1,1.3,-1.4]])jobs.push(load('townsfolk-'+(n?'child':'herbalist'),x+dx,z+dz,n?.7:.9,n?0:Math.PI/2,moving).then(o=>lawnGuests.push(o)));
  }
  // Ring toss beside the midway, and a skittles lane on the listening lawn.
  for(const [x,z]of [[-73,-82],[-59,-54]]){
    jobs.push(load('cv-market-stall',x,z,.8));
    jobs.push(load('cv-flower-cart',x+2.2,z,.65));
    jobs.push(load('townsfolk-merchant',x,z-.9,.9,0,moving).then(o=>lawnGuests.push(o)));
    box(x,1,z+1.1,2.4,.15,.8,C.wood);
    for(let n=0;n<3;n++){
      disk(x-.7+n*.7,1.35,z+1.1,.045,.6,C.gold);
      ring(x-.7+n*.7,1.2,z+1.1,.19,.035,C.red).rotation.x=Math.PI/2;
    }
    jobs.push(load('townsfolk-child',x,z+2.5,.75,Math.PI,moving).then(o=>lawnGuests.push(o)));
  }
  box(-58,.11,-48,2,.04,6,C.cream);
  for(let row=0;row<3;row++)for(let n=0;n<=row;n++){
    const x=-58+(n-row/2)*.4,z=-50+row*.4;
    disk(x,.42,z,.09,.55,C.red);ball(x,.75,z,.13,C.cream);
  }
  ball(-58,.3,-45.8,.22,C.teal);
  jobs.push(load('cv-bench',-59,-43,.7,Math.PI/2));
  jobs.push(load('townsfolk-child',-58,-44.5,.75,Math.PI,moving).then(o=>lawnGuests.push(o)));

  // A proper fan-shaped shell: concentric half arches open onto the lawn.
  box(-67,.4,-48.4,13,.7,6,C.wood);box(-67,.8,-48.4,13,.12,6,C.cream);
  for(let n=0;n<4;n++){
    const r=6.2-n*.45,arch=new THREE.TorusGeometry(r,.15,6,40,Math.PI);
    mesh(arch,n%2?C.gold:C.cream,-67,.9,-46.5-n*.9);
  }
  const shellVertices=[],shellIndices=[];
  for(let row=0;row<2;row++)for(let i=0;i<=40;i++){
    const a=i/40*Math.PI,r=row?5.2:6.2;
    shellVertices.push(-67+Math.cos(a)*r,.9+Math.sin(a)*r,row?-50.8:-46.5);
    if(!row&&i<40){const j=i;shellIndices.push(j,j+1,j+41,j+1,j+42,j+41);}
  }
  const shellGeo=new THREE.BufferGeometry();shellGeo.setAttribute('position',new THREE.Float32BufferAttribute(shellVertices,3));shellGeo.setIndex(shellIndices);shellGeo.computeVertexNormals();
  const shell=mesh(shellGeo,C.cream,0,0,0);shell.material=shell.material.clone();shell.material.side=THREE.DoubleSide;
  const back=new THREE.Shape();back.moveTo(-5.5,0);back.absarc(0,0,5.5,Math.PI,0,true);back.lineTo(-5.5,0);
  mesh(new THREE.ShapeGeometry(back),C.teal,-67,.85,-50.8);
  for(let n=0;n<3;n++)box(-67,.2+n*.2,-44.8-n*.4,4,.18,.5,C.cream);
  for(const x of [-72.5,-61.5]){box(x,1.7,-46,1,1.7,.8,C.ink);const speaker=disk(x,1.8,-45.56,.3,.04,'#344c48');speaker.rotation.x=Math.PI/2;}
  sign('MERRYMEAD SESSIONS',-67,4.2,-50.6,8.5);
  for(let n=0;n<3;n++)jobs.push(load('townsfolk-'+['baker','miller','innkeeper'][n],-70+n*3,-48,.95,Math.PI,moving).then(o=>{
    o.position.y=.88;musicians.push({o,vendor:false,base:.88});
    if(n<2){ball(.35,.9,-.35,.32,C.gold,o);beam([.35,1,-.35],[.35,1.9,-.35],.065,C.wood,o);}
    else disk(0,.7,-.6,.48,.45,C.red,o);
  }));
  for(const z of [-43,-40.5])for(const x of [-72,-64])jobs.push(load('cv-bench',x,z,.85,Math.PI));

  // Park gateways, avenue trees, beds and festoons tie the precinct together.
  for(const x of [-45,-40])box(x,2.2,-35.8,.22,4.4,.22,C.wood);
  sign('MERRYMEAD PARK',-42.5,4,-35.65,7.7,C.teal);
  for(const [x,z,scale]of [[-74,-98,1],[-45,-98,.8],[-74,-81,.8],[-74,-58,.85],[-58,-58,.8],[-57,-78,.8],[-46,-79,.75],[-74,-38,.8],[-58,-38,.85]])jobs.push(load('cv-tree-oak',x,z,scale));
  jobs.push(load('cv-tree-fruit',-46,-84,.85));
  for(const [x,z]of [[-74,-61],[-60,-75],[-73,-95],[-45,-92],[-58,-40]])jobs.push(load('cv-flower-bed',x,z,.85));
  for(const [x,z]of [[-76,-79],[-43,-79],[-76,-57],[-43,-57],[-43,-37]])jobs.push(load('cv-streetlamp',x,z,1));
  for(const z of [-79,-57]){
    for(const x of [-76,-43])box(x,2.7,z,.13,5.4,.13,C.wood);
    for(let n=0;n<24;n++){
      const u=n/23,x=-76+u*33,y=5.3-Math.sin(u*Math.PI)*1.2;
      if(n<23){const v=(n+1)/23;beam([x,y,z],[-76+v*33,5.3-Math.sin(v*Math.PI)*1.2,z],.017,C.ink);}
      bulb(x,y-.08,z);
      if(n%2===0){const flag=mesh(new THREE.ConeGeometry(.2,.55,3),n%4?C.red:C.teal,x,y-.35,z);flag.rotation.z=Math.PI;}
    }
  }
  await Promise.all(jobs);tagDistrictModels(fixed,town,'fair',[0,0]);tagDistrictModels(moving,town,'fair');
  // Static props share instances; only the rides, water and people get updates.
  fixed.updateMatrixWorld(true);const batches=new Map();fixed.traverse(o=>{
    if(!o.isMesh)return;const key=o.geometry.uuid+o.material.uuid;
    if(!batches.has(key))batches.set(key,{o,matrices:[],ids:[]});batches.get(key).matrices.push(o.matrixWorld.clone());batches.get(key).ids.push(o.userData.registryId);
  });
  for(const {o,matrices,ids}of batches.values()){
    const instance=new THREE.InstancedMesh(o.geometry,o.material,matrices.length);matrices.forEach((m,i)=>instance.setMatrixAt(i,m));instance.userData.registryIds=ids;instance.castShadow=o.castShadow;instance.receiveShadow=o.receiveShadow;scene.add(instance);
  }
  const life=await createFairLife(scene,town);
  const lights=[[-64,-91],[-50,-68],[-67,-44],[-49,-46]].map(([x,z])=>{const l=new THREE.PointLight('#ffd498',0,17,1.6);l.position.set(x,5,z);scene.add(l);return l;});
  let lastTime=null,rideTime=0,schedule=fairSchedule(4,10);
  return {life,wheel,carousel,stats:{fairVisitors:30,fairDucks:7,fairRiders:riders.length},update(t,hour,night,day=4){
    const dt=lastTime===null?0:Math.max(0,t-lastTime);lastTime=t;schedule=fairSchedule(day,hour);if(schedule.open)rideTime+=dt;
    wheel.rotation.z=rideTime*.075;cabins.forEach(g=>g.rotation.z=-wheel.rotation.z);
    carousel.rotation.y=rideTime*.17;horses.forEach((h,n)=>h.position.y=1.35+Math.sin(rideTime*1.6+n)*.2);
    riders.forEach(o=>o.visible=schedule.open);
    lawnGuests.forEach((o,n)=>{o.visible=hour>=9&&hour<22;o.rotation.z=Math.sin(t*1.8+n)*.025;});
    ducks.forEach((o,n)=>{const a=t*.065-n*.32,x=-67+Math.cos(a)*4.2,z=-68+Math.sin(a)*2.7;o.position.set(x,.12+Math.sin(t*2+n)*.025,z);o.rotation.y=Math.atan2(-Math.sin(a)*4.2,Math.cos(a)*2.7);});
    ripples.forEach(({m,x,phase})=>{m.position.x=x+Math.sin(t*.4+phase)*.25;});
    musicians.forEach(({o,vendor,base},n)=>{o.visible=vendor?schedule.open:schedule.concert;o.rotation.z=Math.sin(t*2+n)*.035;o.position.y=base+Math.abs(Math.sin(t*2+n))*.025;});
    bulbs.forEach(b=>{b.visible=night>.12&&schedule.open;});lights.forEach(l=>l.intensity=night*(schedule.open?24:2));
    life.update(t,hour,day);
  },audit(){return {schedule,rideAngle:wheel.rotation.z,carouselAngle:carousel.rotation.y,ducks:ducks.map(d=>d.position.toArray()),...life.audit()};}};
}
