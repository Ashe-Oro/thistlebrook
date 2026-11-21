import {packVehicle, loadPackGeometry, toonModel, instancedModel} from '../vehicle-models.js';
import {vehicleModel} from '../traffic-fleet.js';
import {apronVehicles} from './ground-traffic.js';
import {tagDistrictModels} from '../registry/district-models.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from '../../toon.js';
import { place } from '../../catalog/loader.js';
import { AIRPORT, FLEET, sampleFlight, sampleHelicopter } from './traffic.js';
import { makeAircraft, makeHelicopter, makeCessna } from './aircraft.js';
import {STRUCTURES, AIRSIDE, WINDSOCK, PARKED_AIRCRAFT, SERVICE_PAD, RUNWAY_EDGE_LIGHTS, TAXIWAY_LIGHTS, BEACON_HEAD, airfieldPath, airfieldFixtures} from './airfield-plan.js';
import {buildLandmarkGlow, setLandmarkNight} from '../landmark-glow.js';
export { AIRPORT } from './traffic.js';

// Every static Airfield-pack placement (buildings and airside furniture) is
// baked into one vertex-coloured geometry: one toon draw plus one ink draw.
async function bakedPlacements(placements) {
 const parts = await Promise.all(placements.map(async p => {
  const g = (await loadPackGeometry(airfieldPath(p.model))).clone();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(p.pos[0], p.y ?? 0, p.pos[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw || 0), new THREE.Vector3().setScalar(p.scale || 1));
  return g.applyMatrix4(m);
 }));
 const geometry = mergeGeometries(parts); parts.forEach(g => g.dispose());
 geometry.computeBoundingBox(); geometry.computeBoundingSphere();
 const object = toonModel(geometry);
 object.name = 'Airfield pack buildings'; object.userData.airfield = placements.map(p => p.id);
 return object;
}

export async function buildAirport(scene,town) {
 const root=new THREE.Group(),staticRoot=new THREE.Group(),dynamic=new THREE.Group();root.name='Thistlebrook Municipal Airport';root.add(dynamic);scene.add(root);
 const cube=new THREE.BoxGeometry(1,1,1),passengers=[],jobs=[];
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
 // GA service pad: fuel farm, tie-downs and the bowser's loop.
 {const p=SERVICE_PAD;box(p.x,.07,p.z,p.w,.12,p.d,'#aeb0a2');for(const [x,z]of [[82.5,-4],[95.5,-6]])box(x,.14,z,6.4,.02,.1,'#ead08a');}
 // Helipad clear of both fixed-wing movement lanes.
 box(80,.1,-102,17,.18,17,'#738a81');ring(80,.22,-102,6.7,.13,'#e9dfb9');label('H',80,.23,-102,5,5,'#738a81',true);
 // The world compiler brings the public approach to this landside street.
 // Keep its geometry inside the airport parcel; the original off-island stub
 // belonged to the pre-merge town edge.
 box(68,.075,-42,5,.12,18,'#87958b');box(69,.1,-47,7,.14,5,'#d9c9a4');
 for(let z=-44;z<=-36;z+=2)box(68,.16,z,2.8,.025,.8,'#eee1bd');
 // Terminal forecourt: a paved walk from the approach to the FBO door.
 box(77,.11,-54.4,9,.14,3.6,'#d9c9a4');
 for(const z of [-47,-36]){box(79,.35,z,6,.5,1.2,'#bca884');for(let n=0;n<6;n++){const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(.6,1),toonMaterial('#7a9b67'));shrub.position.set(76.5+n,.85,z);staticRoot.add(shrub);}}
 const bays=[76,81,86];
 for(const x of bays){const z=-40.5;box(x,.13,z,3.5,.04,6,'#a0a99a');box(x-1.8,.18,z,.1,.03,6,'#ece2c4');}
 label('AIRPORT →',69,1.9,-31,6,.9);box(69,1,-31,.12,2,.12,'#927d5d');
 for(let z=-106;z<10;z+=6){box(143,1,z,.1,2,.1,'#859282');if(z<4)for(const y of [.65,1.4])box(143,y,z+3,.045,.045,6,'#859282');}
 for(const z of [-55,-59])jobs.push(place('cv-bench',{x:86,z,rotY:Math.PI/2,scale:.85}).then(o=>staticRoot.add(o)));
 for(const [n,role]of ['merchant','elder','child','shopkeeper','watch','farmhand'].entries())jobs.push(place('townsfolk-'+role,{x:85.5,z:-64+n*1.4,scale:1}).then(o=>{dynamic.add(o);passengers.push({o,n});}));
 // Airfield pack: buildings and airside furniture, edge lights, windsock.
 jobs.push(bakedPlacements([...STRUCTURES,...AIRSIDE]).then(o=>root.add(o)));
 jobs.push(instancedModel(airfieldPath('runway_edge_light'),RUNWAY_EDGE_LIGHTS,{scale:1.6,y:.14,name:'Runway edge lights'}).then(o=>root.add(o)));
 jobs.push(instancedModel(airfieldPath('taxiway_blue_light'),TAXIWAY_LIGHTS,{scale:1.6,y:.12,name:'Taxiway edge lights'}).then(o=>root.add(o)));
 const windsock=new THREE.Group();windsock.position.set(WINDSOCK.pos[0],0,WINDSOCK.pos[1]);dynamic.add(windsock);
 jobs.push(loadPackGeometry(airfieldPath(WINDSOCK.model)).then(g=>windsock.add(toonModel(g,{scale:WINDSOCK.scale}))));
 for(const p of PARKED_AIRCRAFT)jobs.push(makeCessna({id:p.id},{navLights:false}).then(a=>{a.root.position.set(p.pos[0],.14,p.pos[1]);a.root.rotation.y=p.yaw;a.root.name=p.id;root.add(a.root);}));
 // Landside cars and the station's fire tender are pack vehicles (TOWN-27).
 for(const [i,[model,colour]]of [['sn-family-sedan','#82aa9d'],['vb-pastel-sedan','#e9bd63'],['sn-minivan','#6e90a1']].entries())jobs.push(packVehicle(vehicleModel(model,colour)).then(o=>{o.position.set(bays[i],.15,-40.5);o.rotation.y=i%2?Math.PI:0;root.add(o);}));
 jobs.push(packVehicle(vehicleModel('af-fire-tender')).then(o=>{o.position.set(96,.12,-91.6);root.add(o);}));
 const aircraft=await Promise.all(FLEET.map(async spec=>{const model=spec.kind==='light'?await makeCessna(spec):makeAircraft(spec);dynamic.add(model.root);return {spec,...model};}));
 const heli=makeHelicopter();dynamic.add(heli.root);
 // Apron service vehicles: tug and baggage train at the airliner stand, the
 // fuel bowser on the GA row and the follow-me car's patrol loop.
 const groundVehicles=await Promise.all(apronVehicles(0).map(async v=>{
  const object=await packVehicle(v);object.name=v.id;dynamic.add(object);return object;
 }));
 // Night: edge, taxiway and PAPI lights, the swept beacon, floods and windows
 // through the landmark-glow registry (no new scene lights).
 const beaconHead=new THREE.Object3D();beaconHead.position.set(...BEACON_HEAD.pos);root.add(beaconHead);
 const glow=buildLandmarkGlow(airfieldFixtures(),{name:'Airfield',follow:{beaconHead}});root.add(glow.group);
 await Promise.all(jobs);tagDistrictModels(staticRoot,town,'airport',[0,0]);
 // Repeated markings, buildings and private props use shared instanced draws.
 staticRoot.updateMatrixWorld(true);const batches=new Map();staticRoot.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+o.material.uuid;if(!batches.has(key))batches.set(key,{o,matrices:[],ids:[]});batches.get(key).matrices.push(o.matrixWorld.clone());batches.get(key).ids.push(o.userData.registryId);});for(const {o,matrices,ids}of batches.values()){const m=new THREE.InstancedMesh(o.geometry,o.material,matrices.length);matrices.forEach((v,i)=>m.setMatrixAt(i,v));m.userData.registryIds=ids;m.castShadow=o.castShadow;m.receiveShadow=o.receiveShadow;root.add(m);}
 let states=[];
 const update=(t,night=0)=>{
  states=aircraft.map(a=>{const state=sampleFlight(a.spec,t);a.root.position.copy(state.position);a.root.rotation.y=state.heading;a.body.rotation.set(state.pitch,0,state.bank);a.gear.visible=a.spec.kind==='light'||state.gear;a.props.forEach(p=>p.rotation.z=t*(state.phase==='At stand'?1:35));a.lights.forEach(m=>m.visible=Math.sin(t*4)>-.3);return state;});
  const h=sampleHelicopter(t);heli.root.position.copy(h.position);heli.root.rotation.y=h.heading;heli.body.rotation.x=h.pitch;heli.rotor.rotation.y=t*34;heli.tailRotor.rotation.x=t*48;states.push(h);
  windsock.rotation.y=.2+Math.sin(t*.5)*.16;windsock.children[0]?.rotation.set(0,0,Math.sin(t*2)*.012);
  beaconHead.rotation.y=t*1.4;beaconHead.updateMatrix();setLandmarkNight(night,t);glow.update();
  const atStand=states[0].phase==='At stand';passengers.forEach(({o,n})=>{const u=((t*.12+n*.17)%2),walk=u<1?u:2-u;o.visible=atStand;o.position.set(83.6+walk*5.6,.2,-61.6-walk*.4+(n%3)*.45);o.rotation.y=u<1?Math.PI/2:-Math.PI/2;o.rotation.z=Math.sin(t*8+n)*.035;});
  apronVehicles(t).forEach((v,i)=>{const object=groundVehicles[i];object.position.set(v.position[0],.18,v.position[1]);object.rotation.y=Math.atan2(...v.direction);object.visible=!v.stand||atStand;});
 };
 update(0);
 return {root,aircraft,helicopter:heli,glow,view:AIRPORT.view,update,audit:()=>states.map(s=>({...s,position:s.position.toArray()})),
  selectables:[{type:'airport',data:{name:'Thistlebrook Municipal Airport'},bounds:new THREE.Box3(new THREE.Vector3(69,0,-74),new THREE.Vector3(86,5,-49))}]};
}
