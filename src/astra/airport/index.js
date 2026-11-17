import {tagDistrictModels} from '../registry/district-models.js';
import * as THREE from 'three';
import { toonMaterial } from '../../toon.js';
import { place } from '../../catalog/loader.js';
import { AIRPORT, FLEET, sampleFlight, sampleHelicopter } from './traffic.js';
import { makeAircraft, makeHelicopter } from './aircraft.js';
export { AIRPORT } from './traffic.js';

export async function buildAirport(scene,town) {
 const root=new THREE.Group(),staticRoot=new THREE.Group(),dynamic=new THREE.Group();root.name='Thistlebrook Municipal Airport';root.add(dynamic);scene.add(root);
 const cube=new THREE.BoxGeometry(1,1,1),bulbs=[],passengers=[],jobs=[];
 const box=(x,y,z,w,h,d,c,parent=staticRoot)=>{const m=new THREE.Mesh(cube,toonMaterial(c));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const label=(text,x,y,z,w,h,c='#355b60',flat=false,parent=staticRoot)=>{const canvas=document.createElement('canvas');canvas.width=Math.max(256,Math.round(256*w/h));canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle=c;ctx.fillRect(0,0,canvas.width,256);ctx.fillStyle='#fff0d2';ctx.font='bold 155px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,132,canvas.width-24);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));m.position.set(x,y,z);if(flat)m.rotation.x=-Math.PI/2;parent.add(m);return m;};
 const ring=(x,y,z,r,t,c)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,5,48),toonMaterial(c));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);staticRoot.add(m);};
 // Independent eastern parcel. It touches the old island at x=65 and does
 // not alter compiler-owned parcels, trees, navigation nodes or reservations.
 box(105.5,-1.28,-49.5,81,2.5,127,'#b3a083');box(105.5,-2.48,-49.5,80.8,.3,126.8,'#8c8770');box(105.5,-.01,-49.5,81,.08,127,'#a8bc7d');
 box(124,.08,-49,11,.12,118,'#687477');
 for(const x of [119,129])box(x,.15,-49,.12,.025,116,'#e6dfbf');
 for(let z=-95;z<=-9;z+=8)box(124,.16,z,.22,.025,3,'#f6ebca');
 for(const z of [-103,5])for(let n=0;n<6;n++)box(120.4+n*1.4,.16,z,.75,.025,4,'#f6ebca');
 label('36',124,.18,-1,4,3,'#687477',true);const opposite=label('18',124,.18,-95,4,3,'#687477',true);opposite.rotation.z=Math.PI;
 // Apron and parallel taxi lanes with two distinct circulation directions.
 box(95,.065,-42,34,.11,78,'#b2b4a5');box(109,.09,-41,6,.12,88,'#929f94');box(113,.09,-84,23,.12,7,'#929f94');box(117,.09,2,19,.12,7,'#929f94');
 for(const [x,z,w,d]of [[109,-40,.13,82],[102,-45,.13,70],[113,-84,22,.13],[117,2,16,.13]])box(x,.17,z,w,.025,d,'#ead08a');
 for(const g of FLEET){box(97,.17,g.gate,8,.025,.12,'#ead08a');box(94,.17,g.gate, .12,.025,5,'#ead08a');label(g.id==='AT201'?'A1':g.id==='CL104'?'B1':'B2',96,.18,g.gate+5,3,1.5,'#929f94',true);}
 // The terminal is on the public side; boarding stays west of the taxi lanes.
 box(77,.12,-60,19,.2,34,'#d6c8a7');box(77,2.2,-62,14,4.2,22,'#e4d4ae');box(77,4.4,-62,15,.35,23,'#517d79');
 for(let n=0;n<7;n++){box(84.06,2.5,-71+n*3, .1,2.2,2.5,'#6e9fa3');box(84.15,2.5,-71+n*3,.12,2.3,.1,'#e4d4ae');}
 for(let n=0;n<4;n++)box(72+n*3.3,2.5,-50.94,2.4,2.1,.1,'#709a9c');
 box(77,3.8,-49.6,16,.15,3.5,'#b1885e');label('ASTRA MUNICIPAL',77,4.7,-50.1,14,1.2);label('DEPARTURES  /  ARRIVALS',77,2.9,-49.95,10,.55);
 box(84.9,1.45,-65,1.8,2.8,2,'#56878a');box(86,.19,-65,3,.22,3,'#d9d1b5');
 // Tower, rooftop radar and club hangar.
 box(75,5.4,-82,4.6,10.8,4.6,'#d1ba91');box(75,10.9,-82,7,2.7,6.5,'#4e7277');box(75,12.4,-82,7.8,.35,7.2,'#ece0bd');
 for(let n=0;n<4;n++)box(72.3+n*1.8,11.1,-78.7,.1,2.3,.12,'#d0c7a6');box(75,13.2,-82,.2,1.4,.2,'#6d786a');
 const radar=new THREE.Group();radar.position.set(75,14,-82);dynamic.add(radar);box(0,0,0,3,.6,.2,'#557b77',radar);
 box(78,2.4,-20,18,4.7,15,'#c4baa0');box(78,5,-20,19,.6,16,'#b67b5a');box(87.06,2,-20,.12,3.8,12,'#455f60');for(let n=0;n<9;n++)box(87.15,.4+n*.4,-20,.1,.08,12,'#78918a');label('CLOVER FLYING CLUB',78,4,-12.4,15,.9);
 // Helipad and windsock clear of both fixed-wing movement lanes.
 box(80,.1,-102,17,.18,17,'#738a81');ring(80,.22,-102,6.7,.13,'#e9dfb9');label('H',80,.23,-102,5,5,'#738a81',true);
 box(137,2.5,-84,.16,5,.16,'#eee2be');const windsock=new THREE.Group();windsock.position.set(137,5,-84);dynamic.add(windsock);
 for(let i=0;i<5;i++){const m=new THREE.Mesh(new THREE.CylinderGeometry(.38-i*.047,.34-i*.047,.55,10),toonMaterial(i%2?'#eee2be':'#ce7c51'));m.rotation.z=Math.PI/2;m.position.x=.3+i*.5;windsock.add(m);}
 // The world compiler brings the public approach to this landside street.
 // Keep its geometry inside the airport parcel; the original off-island stub
 // belonged to the pre-merge town edge.
 box(68,.075,-42,5,.12,18,'#87958b');box(69,.1,-47,7,.14,5,'#d9c9a4');
 for(let z=-44;z<=-36;z+=2)box(68,.16,z,2.8,.025,.8,'#eee1bd');
 for(const z of [-47,-36]){box(79,.35,z,6,.5,1.2,'#bca884');for(let n=0;n<6;n++){const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(.6,1),toonMaterial('#7a9b67'));shrub.position.set(76.5+n,.85,z);staticRoot.add(shrub);}}
 for(let n=0;n<3;n++){const z=-40.5,x=76+n*5;box(x,.13,z,3.5,.04,6,'#a0a99a');box(x-1.8,.18,z,.1,.03,6,'#ece2c4');const car=new THREE.Group();car.position.set(x,.15,z);staticRoot.add(car);box(0,.6,0,1.8,.8,3.4,['#ad795e','#628e8a','#d0bd87'][n],car);box(0,1.1,-.1,1.6,.6,1.7,'#58777f',car);for(const side of [-1,1])for(const end of [-1,1])box(side*.9,.35,end, .18,.5,.65,'#374e4f',car);}
 label('AIRPORT →',69,1.9,-31,6,.9);box(69,1,-31,.12,2,.12,'#927d5d');
 for(let z=-106;z<10;z+=6){box(143,1,z,.1,2,.1,'#859282');if(z<4)for(const y of [.65,1.4])box(143,y,z+3,.045,.045,6,'#859282');}
 for(const x of [118.5,129.5])for(let z=-105;z<=7;z+=8){const m=box(x,.28,z,.21,.18,.24,'#c9dfda',dynamic);m.material=new THREE.MeshBasicMaterial({color:'#b7dfde'});bulbs.push(m);}
 for(const z of [-90,-80,-70])for(let i=0;i<3;i++)box(137+i*.7,.21,z,.35,.16,.35,'#f5e4a8');
 for(const z of [-55,-59])jobs.push(place('cv-bench',{x:86,z,rotY:Math.PI/2,scale:.85}).then(o=>staticRoot.add(o)));
 for(const [n,role]of ['merchant','elder','child','shopkeeper','watch','farmhand'].entries())jobs.push(place('townsfolk-'+role,{x:85.5,z:-64+n*1.4,scale:1}).then(o=>{dynamic.add(o);passengers.push({o,n});}));
 const aircraft=FLEET.map(spec=>{const model=makeAircraft(spec);dynamic.add(model.root);return {spec,...model};});
 const heli=makeHelicopter();dynamic.add(heli.root);
 // A baggage tug follows a service loop on the terminal side of the stand.
 const tug=new THREE.Group();dynamic.add(tug);box(0,.6,0,1.25,.8,2,'#d9b05b',tug);box(0,1.2,-.4,1, .7,.9,'#608a90',tug);
 for(const z of [-2.4,-4]){box(0,.45,z,1.2,.2,1.4,'#576d68',tug);box(0,.8,z,1,.55,1.1,'#c7a781',tug);}for(const x of [-.65,.65])for(const z of [-.6,.6,-2.4,-4])box(x,.25,z,.18,.4,.4,'#354c4d',tug);
 await Promise.all(jobs);tagDistrictModels(staticRoot,town,'airport',[0,0]);
 // Repeated markings, buildings and private props use shared instanced draws.
 staticRoot.updateMatrixWorld(true);const batches=new Map();staticRoot.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+o.material.uuid;if(!batches.has(key))batches.set(key,{o,matrices:[],ids:[]});batches.get(key).matrices.push(o.matrixWorld.clone());batches.get(key).ids.push(o.userData.registryId);});for(const {o,matrices,ids}of batches.values()){const m=new THREE.InstancedMesh(o.geometry,o.material,matrices.length);matrices.forEach((v,i)=>m.setMatrixAt(i,v));m.userData.registryIds=ids;m.castShadow=o.castShadow;m.receiveShadow=o.receiveShadow;root.add(m);}
 let states=[];
 const update=(t,night=0)=>{
  states=aircraft.map(a=>{const state=sampleFlight(a.spec,t);a.root.position.copy(state.position);a.root.rotation.y=state.heading;a.body.rotation.set(state.pitch,0,state.bank);a.gear.visible=a.spec.kind==='light'||state.gear;a.props.forEach(p=>p.rotation.z=t*(state.phase==='At stand'?1:35));a.lights.forEach(m=>m.visible=Math.sin(t*4)>-.3);return state;});
  const h=sampleHelicopter(t);heli.root.position.copy(h.position);heli.root.rotation.y=h.heading;heli.body.rotation.x=h.pitch;heli.rotor.rotation.y=t*34;heli.tailRotor.rotation.x=t*48;states.push(h);
  radar.rotation.y=t*.5;windsock.rotation.y=.2+Math.sin(t*.5)*.16;windsock.rotation.z=-.12+Math.sin(t*2)*.035;
  bulbs.forEach(m=>m.material.color.set(night>.3?'#c2fcf0':'#9eb9ad'));
  const atStand=states[0].phase==='At stand';passengers.forEach(({o,n})=>{const u=((t*.12+n*.17)%2),walk=u<1?u:2-u;o.visible=atStand;o.position.set(85.4+walk*3.2,.2,-66+(n%3)*1.1);o.rotation.y=u<1?Math.PI/2:-Math.PI/2;o.rotation.z=Math.sin(t*8+n)*.035;});
  const a=t*.12;tug.position.set(87+Math.sin(a)*1.4,.18,-72+Math.cos(a)*3);tug.rotation.y=Math.atan2(1.4*Math.cos(a),-3*Math.sin(a));tug.visible=atStand;
 };
 update(0);
 return {root,aircraft,helicopter:heli,view:AIRPORT.view,update,audit:()=>states.map(s=>({...s,position:s.position.toArray()})),
  selectables:[{type:'airport',data:{name:'Thistlebrook Municipal Airport'},bounds:new THREE.Box3(new THREE.Vector3(69,0,-74),new THREE.Vector3(86,5,-49))}]};
}
