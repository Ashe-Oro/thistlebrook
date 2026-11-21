import {createRigidBatches} from './rigid-batches.js';
import {batchStaticMeshes} from './static-batches.js';
import * as THREE from 'three';
import { lampPosts, WORKS_LAMPS } from './lamp-posts.js';
import { buildLampGlow } from './lamp-glow.js';
import { DISTRICT_OFFSETS } from '../compiler/astra-placement.js';
import { place } from '../catalog/loader.js';
import { toonMaterial } from '../toon.js';
import { trainState, workPeriod } from '../compiler/astra-work.js';

// Owned kit buildings, plants and people share the town's toon materials.
// Only railway equipment and industrial fixtures are authored here.
export async function buildWorkDistrict(scene,town){
 const root=new THREE.Group(),moving=new THREE.Group();scene.add(moving);
 const cube=new THREE.BoxGeometry(1,1,1),ball=new THREE.IcosahedronGeometry(1,1),cyl=new THREE.CylinderGeometry(1,1,1,12);
 const loads=[],wheels=[],smoke=[],lamps=[],buildingBounds=[];
 const buildingIds=new Set(['farm-greenhouse','farm-hay-barn','cv-blacksmith','farm-grain-silo']);
 const mesh=(geo,c,x,y,z,parent=root)=>{const m=new THREE.Mesh(geo,toonMaterial(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const box=(x,y,z,w,h,d,c,parent=root)=>{const m=mesh(cube,c,x,y,z,parent);m.scale.set(w,h,d);return m;};
 const cylinder=(x,y,z,r,h,c,parent=root)=>{const m=mesh(cyl,c,x,y,z,parent);m.scale.set(r,h,r);return m;};
 const orb=(x,y,z,r,c,parent=root)=>{const m=mesh(ball,c,x,y,z,parent);m.scale.setScalar(r);return m;};
 const asset=(id,x,z,scale=1,rotY=0)=>loads.push(place(id,{x,z,scale,rotY}).then(o=>{root.add(o);if(buildingIds.has(id)){o.updateMatrixWorld(true);buildingBounds.push({x,z,bounds:new THREE.Box3().setFromObject(o)});}}));
 const label=(text,x,y,z,w,h=.8,color='#405f56')=>{const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1024,128);ctx.fillStyle='#fff0cf';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 68px Georgia';ctx.fillText(text,512,68,970);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));m.position.set(x,y,z);root.add(m);return m;};
 const roof=(x,y,z,w,d,color)=>{for(const side of [-1,1]){const m=box(x,y,z+side*d*.23,w,.28,d*.58,color);m.rotation.x=side*.47;}box(x,y+d*.12,z,w,.25,.25,'#485f58');};
 const fence=(x,z,length,axis='x')=>{for(let i=0;i<=length;i+=2){box(x+(axis==='x'?i:0),.8,z+(axis==='z'?i:0),.14,1.6,.14,'#b29b73');}for(const y of [.5,1.12])box(x+(axis==='x'?length/2:0),y,z+(axis==='z'?length/2:0),axis==='x'?length:.12,.13,axis==='z'?length:.12,'#c6b38c');};
 const log=(x,y,z,length=4)=>{const m=cylinder(x,y,z,.38,length,'#926e48');m.rotation.z=Math.PI/2;for(const side of [-1,1]){const end=cylinder(x+side*(length/2+.01),y,z,.32,.025,'#d4b67e');end.rotation.z=Math.PI/2;const ring=new THREE.Mesh(new THREE.TorusGeometry(.19,.018,4,12),toonMaterial('#a38455'));ring.position.set(x+side*(length/2+.04),y,z);ring.rotation.y=Math.PI/2;root.add(ring);}};
 // Station: warm masonry, a clock tower, a long canopy and yellow platform edge.
 box(-91,.12,-84,32,.24,17,'#d5c6a6');
 box(-91,.36,-92,33,.66,4,'#b4b7a5');box(-91,.72,-93.8,33,.06,.24,'#e7bd65');
 box(-94,2,-83.5,17,4,6,'#d6b594');box(-94,.4,-83.5,17.3,.6,6.3,'#b79f7f');roof(-94,4.5,-83.5,18,7,'#587c6d');
 for(const x of [-100,-96,-90]){box(x,2,-80.44,1.6,2.25,.13,'#f2dec0');box(x,2.03,-80.34,1.23,1.87,.08,'#668e8a');box(x,2.03,-80.28,.08,1.87,.06,'#e8d4ad');}
 box(-94,1.35,-80.3,1.7,2.6,.15,'#4a6d60');
 box(-85,3.5,-83.5,4.5,7,6.4,'#dbc19a');box(-85,6.9,-83.5,4.9,.4,6.8,'#697d69');roof(-85,7.65,-83.5,5.5,7,'#587c6d');
 const clock=new THREE.Mesh(new THREE.CircleGeometry(.91,32),toonMaterial('#fff0ce'));clock.position.set(-85,5.5,-80.25);root.add(clock);
 box(-85,5.8,-80.15,.08,.66,.05,'#475c50');const hand=box(-84.7,5.35,-80.14,.7,.075,.05,'#475c50');hand.rotation.z=-.45;
 label(town.railway ? 'WEST WORKS MARKET' : 'ASTRA UNION',-94,3.3,-79.6,11,.65);
 for(const x of [-105,-99,-93,-87,-81])box(x,2.2,-91,.13,3.2,.13,'#4f6e5c');
 roof(-93,4.05,-91,27,3.7,'#739285');
 for(const x of [-107,-101,-83])asset('cv-bench',x,-88,.9,Math.PI);
 asset('cv-notice-board',-79,-78,.85);asset('cv-bicycle',-103,-79,.8);asset('cv-plant-potted',-89,-79,1.1);
 label('WEST WORKS',-79,2.8,-70.7,8,1,'#8c7657');
 // The full track is reserved above all pedestrian routes.
 const rail=town.workRail;
 const train=new THREE.Group();
 train.position.z=rail.z;
 if(!town.railway){
 moving.add(train);
 box((rail.minX+rail.maxX)/2,.12,rail.z,rail.maxX-rail.minX,.18,3.3,'#9b9f8f');
 for(let x=rail.minX+.5;x<rail.maxX;x+=1.1)box(x,.24,rail.z,.28,.16,2.6,'#8a785f');
 for(const z of [-.85,.85])box((rail.minX+rail.maxX)/2,.38,rail.z+z,rail.maxX-rail.minX,.13,.12,'#5b6866');
 for(const x of [rail.minX,rail.maxX]){box(x,.8,rail.z,.35,1,2.5,'#705f50');box(x,.9,rail.z,.4,.35,2.65,'#bf8664');}
 // Engine and two carriages for the standalone West Works scene.
 for(const x of [-7,0,7]){
  box(x,.85,0,6.3,.5,2.2,'#465750',train);box(x,2,0,6.1,1.9,2.15,x===7?'#547b69':'#c99b6d',train);box(x,3.05,0,6.5,.25,2.4,'#4b665d',train);
  for(const side of [-1,1]){for(let n=0;n<4;n++)box(x-2.15+n*1.42,2.35,side*1.09,.96,.76,.04,'#b6c9b7',train);box(x,1.44,side*1.1,6,.12,.05,'#f2d496',train);for(const wx of [-2.1,2.1]){const wheel=cylinder(x+wx,.65,side*1.06,.46,.23,'#3d4c47',train);wheel.rotation.x=Math.PI/2;wheels.push(wheel);}}
 }
 box(9.8,2,0,1.2,.9,1.9,'#527362',train);cylinder(9,3.5,0,.3,.8,'#465750',train);
 for(const z of [-.73,.73])orb(10.6,1.9,z,.16,'#ffe2a2',train);
 for(let n=0;n<5;n++){const m=orb(0,0,0,.42,'#eee7ce',moving);m.material=new THREE.MeshBasicMaterial({color:'#eee7ce',transparent:true,opacity:.2,depthWrite:false});m.castShadow=false;smoke.push(m);}
 }
 // Market gardens: a clear centre aisle, four distinct growing plots,
 // licensed greenhouse and barn, packing stalls and rainwater storage.
 box(-96,.055,-51.5,30,.1,27,'#b4bd82');
 box(-95,.13,-52,1.8,.13,27,'#d7c69f');
 for(const x of [-104,-86])for(const z of [-61,-54]){
  box(x,.18,z,12,.2,5.6,'#997952');for(const side of [-1,1])box(x,.35,z+side*2.8,12.2,.28,.14,'#c5aa7e');
  for(let row=0;row<3;row++)for(let col=0;col<8;col++){const px=x-5+col*1.4,pz=z-1.9+row*1.8;orb(px,.52,pz,.38,row===1?'#658d50':'#7c9b59');if(z===-54){orb(px,.8,pz,.14,x===-104?'#d49b59':'#bb6c51');}else box(px,.6,pz,.12,.65,.12,'#adc173');}
 }
 asset('farm-greenhouse',-105,-43,1.45);asset('farm-hay-barn',-86,-43,1.1);asset('farm-produce-stand',-91,-49,1);asset('farm-produce-crates',-88,-49,1.15);asset('farm-rain-barrel',-109,-47,1);asset('farm-wheelbarrow',-99,-48,1);asset('farm-scarecrow',-82,-54,1);
 for(const x of [-110,-83])asset('farm-apple-tree',x,-39,1);
 fence(-111,-65,13);fence(-92,-65,13);fence(-111,-38,30);
 label('SUNWARD  /  MARKET GARDENS',-95,2.7,-64.8,15,1,'#71834e');for(const x of [-102,-88])box(x,1.3,-64.9,.12,2.6,.12,'#a48a60');
 // Timber works: kit smithy, an open saw shed, lumber racks and log stacks.
 box(-61,.06,-51.5,29,.12,27,'#c2b08a');asset('cv-blacksmith',-69,-43,1);
 for(const x of [-59,-49])for(const z of [-52,-42])box(x,2.7,z,.3,5.4,.3,'#927b56');roof(-54,5.9,-47,12,13,'#a57556');
 box(-54,1.1,-47,8,.5,2.3,'#8b795b');box(-54,1.42,-47,8,.12,2.5,'#a3aaa0');
 const saw=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,.09,24),toonMaterial('#c9d0bd'));saw.rotation.x=Math.PI/2;saw.position.set(-54,1.5,-47);moving.add(saw);
 for(let n=0;n<12;n++){const a=n/12*Math.PI*2;const tooth=box(Math.cos(a)*.8,0,Math.sin(a)*.8,.2,.1,.2,'#c9d0bd',saw);tooth.rotation.y=-a;}
 for(const z of [-55,-51])for(let n=0;n<5;n++)log(-69,.5+Math.floor(n/3)*.7,z+(n%3-1)*.8,6);
 for(let n=0;n<5;n++)box(-51,.3+n*.28,-58,7,.22,1.4,n%2?'#d4b47a':'#bd9a64');
 box(-64,.9,-59,3,.15,1,'#aa885f');for(const x of [-65,-63])box(x,.45,-59,.12,.9,.7,'#8b7355');
 asset('cv-firewood-stack',-73,-61,1.1);asset('cv-hand-cart',-58,-60,.9);asset('cv-crate',-49,-52,1);fence(-75,-38,29);fence(-75,-65,9);fence(-60,-65,14);
 label('ROWAN & CO.  /  TIMBER',-61,2.7,-64.8,14,1,'#8b654a');for(const x of [-68,-54])box(x,1.3,-64.9,.12,2.6,.12,'#a48a60');
 // Freight exchange: loading apron, grain store, a gantry and sorted loads.
 box(-60,.09,-83,26,.18,18,'#b7b6a0');asset('farm-hay-barn',-61,-84,1.25);asset('farm-grain-silo',-49,-86,.65);
 for(const x of [-72,-65])box(x,3,-90,.22,6,.22,'#788a79');box(-68.5,6,-90,7.5,.35,.4,'#788a79');box(-68.5,4.4,-90,.06,3,.06,'#465d53');
 const crate=box(-68.5,2.6,-90,1.5,1.4,1.5,'#bf975f',moving);box(-68.5,.4,-90,5,.5,3,'#b89c75');
 for(let n=0;n<6;n++)asset(n%2?'farm-grain-sacks':'farm-produce-crates',-71+(n%3)*2.4,-82+Math.floor(n/3)*3,.9);
 asset('cv-horse-cart',-52,-78,.85,Math.PI/2);label('WEST FREIGHT EXCHANGE',-60,4.15,-80.4,11,.85,'#6c7c67');
 // Modest border planting makes the expanded land read as a district.
 for(const [x,z] of [[-113,-42],[-113,-51],[-113,-61],[-113,-76],[-111,-100],[-102,-100],[-78,-42],[-78,-54],[-44,-41],[-44,-54],[-44,-80],[-44,-99]])asset('cv-tree-pine',x,z,.75);
 for(const [x] of WORKS_LAMPS){asset('cv-streetlamp',x,-71.4,1);const bulb=orb(x,2.6,-71.4,.18,'#ffe0a0',moving);bulb.material=new THREE.MeshBasicMaterial({color:'#ffe0a0'});lamps.push(bulb);}
 // Waiting passengers are scenery; named workers below use real graph routes.
 const passengers=[];
 if(!town.railway)for(let n=0;n<5;n++)loads.push(place(['townsfolk-merchant','townsfolk-watch','townsfolk-carpenter'][n%3],{x:-104+n*4,z:-92,scale:1.05}).then(o=>{o.position.y=.76;moving.add(o);passengers.push(o);}));
 await Promise.all(loads);
 root.name='Works scenery';
 batchStaticMeshes(root,scene);
 // streetlights: the yard lamps had bulbs but no ground pool or halo.
 scene.add(buildLampGlow(lampPosts(town).filter(p=>p.source==='works'),{name:'works lamps',offset:DISTRICT_OFFSETS.works}).group);
 const records=town.venues.filter(v=>v.district==='works').map(v=>({type:'venue',data:v,bounds:new THREE.Box3(new THREE.Vector3(v.box.min[0],0,v.box.min[1]),new THREE.Vector3(v.box.max[0],.4,v.box.max[1]))}));
 // The parcel selects its ground, not an invisible solid volume above the
 // whole yard. Buildings have their own bounds, leaving workers clickable.
 buildingBounds.push({x:-94,z:-83.5,bounds:new THREE.Box3(new THREE.Vector3(-103,0,-87),new THREE.Vector3(-82,9,-80))});
 buildingBounds.push({x:-54,z:-47,bounds:new THREE.Box3(new THREE.Vector3(-60,0,-54),new THREE.Vector3(-48,6.5,-40))});
 for(const {x,z,bounds}of buildingBounds){const data=town.venues.find(v=>v.district==='works'&&x>=v.box.min[0]&&x<=v.box.max[0]&&z>=v.box.min[1]&&z<=v.box.max[1]);if(data)records.push({type:'venue',data,bounds});}
 const economy={produce:0,timber:0,shipped:0,collections:0,workers:0,staffed:{}};
 const rigid=createRigidBatches(moving);
 let lastTime=null,lastTrain=null,currentTrain=trainState(0,10),sawAngle=0;
 return {records,economy,update(t,hour,night,people=[]){
  // dt is derived from simulation time: paused scenes cannot generate goods.
  const dt=lastTime===null?0:Math.max(0,t-lastTime);lastTime=t;
  const working=['morning','afternoon'].includes(workPeriod(hour));
  const staffed={};for(const p of people)if(working&&p.workplace&&p.node===p.workplace.node&&!p.route.length&&p.actor?.action?.tool==='work'&&p.actor.action.target==='workspot:'+p.name){staffed[p.workplace.id]=(staffed[p.workplace.id]||0)+1;}
  economy.commuting=people.filter(p=>working&&p.actor?.action?.tool==='walkTo'&&p.actor.action.target==='workspot:'+p.name).length;economy.staffed=staffed;economy.workers=Object.values(staffed).reduce((a,b)=>a+b,0);
  economy.produce+=(staffed['work-farm']||0)*dt/12;economy.timber+=(staffed['work-timber']||0)*dt/18;
  currentTrain=town.railway ? {open:false,atPlatform:false,departed:false,x:0} : trainState(t,hour);
  if(currentTrain.departed&&lastTrain?.atPlatform&&staffed['work-depot']){let capacity=8;for(let round=0;round<8&&capacity>0;round++)for(const type of ['produce','timber']){if(capacity&&economy[type]>=1){economy[type]--;economy.shipped++;capacity--;}}if(capacity<8)economy.collections++;}
  const travel=lastTrain?currentTrain.x-lastTrain.x:0;lastTrain=currentTrain;train.position.x=currentTrain.x;
  wheels.forEach(w=>w.rotation.y+=travel/.46);
  if(staffed['work-timber'])sawAngle+=dt*7;saw.rotation.y=sawAngle;
  crate.position.y=staffed['work-depot']?2.6+Math.sin(t*.7)*.8:2.6;
  passengers.forEach((p,n)=>{p.visible=currentTrain.open;p.rotation.y=currentTrain.atPlatform?Math.PI:Math.sin(t*.3+n)*.25;p.position.y=.76+(currentTrain.atPlatform?Math.abs(Math.sin(t*2+n))*.025:0);});
  smoke.forEach((m,n)=>{const phase=(t*.3+n/5)%1;m.visible=currentTrain.open&&!town.railway;m.position.set(currentTrain.x+9-phase*2,3.8+phase*3,rail.z);m.scale.setScalar(.4+phase);m.material.opacity=(1-phase)*.25;});
  lamps.forEach(m=>m.visible=night>.2);
  rigid.update();
 },audit(){return {...economy,staffed:{...economy.staffed},train:{...currentTrain},sawAngle,crateY:crate.position.y};}};
}
