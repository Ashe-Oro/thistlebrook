import {assertRoadsterClearance, assertRowClearance} from './helpers/roadster-clearance.mjs';
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTeslaVehicle, TESLA_STYLES } from '../src/astra/tesla/models.js';
import { roadsterPose, ROADSTER_PERIOD, createPreviewLoop, createPreviewFleetSimulation } from '../src/astra/tesla/motion.js';
import { DEMO, RAMP, LINEUP, STUNT_SEAMS, HOVER_PAD, ROW_AXIS, lineupApexTime, rampContact } from '../src/astra/tesla/demo-motion.js';
import { installTeslaTraffic } from '../src/astra/tesla/adapter.js';
import { createTeslaTown } from '../src/astra/tesla/index.js';
import { compileAstra, distanceToSegment } from '../src/compiler/astra.js';
import { readFileSync } from 'node:fs';
import { resolveAll } from '../src/catalog/resolve-all.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const town=compileAstra(catalog,831);
const rotation=p=>new THREE.Quaternion().fromArray(p.orientation);

test('entire arena show is finite, continuous at every seam and periodic',()=>{
 for(let t=0;t<ROADSTER_PERIOD;t+=.02){const p=roadsterPose(t),next=roadsterPose(t+.02);for(const key of ['x','y','z','thrust'])assert(Number.isFinite(p[key]));assert(p.orientation.every(Number.isFinite));assert(Math.hypot(p.x-next.x,p.y-next.y,p.z-next.z)<.4);assert(rotation(p).angleTo(rotation(next))<.15);assert(p.x<-43,'Dedicated airspace stays west of all town chimneys');assert(p.x>-87&&p.z>-82&&p.z<-42);}
 for(const t of STUNT_SEAMS){const a=roadsterPose(t-1e-5),b=roadsterPose(t+1e-5);assert(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.001,`Position seam ${t}`);assert(rotation(a).angleTo(rotation(b))<.002,`Rotation seam ${t}`);}
 for(const t of [0,6,10,26,30,47,60,79]){const a=roadsterPose(t),b=roadsterPose(t+ROADSTER_PERIOD);assert(Math.abs(a.x-b.x)<1e-8);assert(Math.abs(a.y-b.y)<1e-8);assert(rotation(a).angleTo(rotation(b))<1e-7);}
});

test('two inverted ramp holds, rolling kickflip, standing flip and upright landings',()=>{
 const up=p=>new THREE.Vector3(0,1,0).applyQuaternion(rotation(p));
 for(const t of [9.2,10.8,25.2,26.8]){const p=roadsterPose(t);assert(p.contact);assert(up(p).y<-.95);assert.equal(p.rampAngle,RAMP.hold);assert(p.y>9);}
 assert(RAMP.end>Math.PI);assert(roadsterPose(27.9).rampAngle>Math.PI);
 for(const t of [34,54,62,70,86])assert(up(roadsterPose(t)).y>.999);
 assert(up(roadsterPose(lineupApexTime())).y<-.95);assert(up(roadsterPose(66.85)).y<-.9);
 for(let t=64;t<70;t+=.05){const p=roadsterPose(t);assert.equal(p.localX,HOVER_PAD.x);assert.equal(p.localZ,HOVER_PAD.z);assert(p.thrust>0);}
});

test(`${TOWN_RULE.surface} the Roadster ramp sits on and rises from the lot surface`, () => {
 assert.equal(rampContact(0).y, DEMO.ground);
 for (let step = 0; step <= 80; step++) assert(rampContact(RAMP.end * step / 80).y >= DEMO.ground);
});

test('actual Roadster mesh clears all five parked vehicles and the lot floor',()=>assertRoadsterClearance());

test('kickflip stays high over every vehicle and lands entirely beyond Model 3',()=>{
 const visited=new Set();let highTime=0,previous=roadsterPose(44).localX;
 for(let t=44;t<54;t+=.01){const p=roadsterPose(t);assert.equal(p.localZ,1.5);assert(p.localX>=previous);previous=p.localX;if(p.altitude>12)highTime+=.01;
  for(const v of LINEUP)if(Math.abs(p.localX-v.x)<.06){visited.add(v.kind);assert(p.altitude>10,`High above ${v.label}`);}
  const up=new THREE.Vector3(0,1,0).applyQuaternion(rotation(p));if(up.y<0)assert(p.localX>0&&p.localX<8,'Roll above middle vehicles only');
 }
 assert.equal(visited.size,5);assert(highTime>3,'Broad peak, rather than a momentary spike');
 const landed=roadsterPose(54);assert.equal(landed.altitude,0);assert(landed.localX-1.6>LINEUP.at(-1).x+1,'Entire car lands beyond the final bay');
 // Under the normal diagonal camera, x-z controls horizontal screen placement.
 // The standing flip must project wholly outside the row, at every altitude.
 assert(HOVER_PAD.x-HOVER_PAD.z<LINEUP[0].x-LINEUP[0].z-5);
});

test('rendered world-space vault follows the row axis through every vehicle box, never the grandstand',()=>{
 const scene=new THREE.Scene(),tesla=createTeslaTown(scene,town);
 try { assertRowClearance(scene,tesla); } finally { tesla.dispose(); }
});

test('all moving preview centres and physical footprints stay on existing downtown paving',()=>{
 const path=createPreviewLoop(),roads=town.roads.filter(r=>!r.owner&&r.width>=2.4);
 for(let d=0;d<path.length;d+=.04){const p=path.sample(d);for(const x of [-.57,0,.57])for(const z of [-1.25,0,1.25]){const world=[p.x+x*Math.cos(p.yaw)+z*Math.sin(p.yaw),p.z-x*Math.sin(p.yaw)+z*Math.cos(p.yaw)];assert(roads.some(r=>distanceToSegment(world,r.a,r.b)<=r.width/2+.02),`Car leaves paving at ${world}`);}}
});

test('preview fleet yields to a person and resumes with safe following distances',()=>{
 const s=createPreviewFleetSimulation(),car=s.vehicles[0],ahead=s.path.sample(car.distance+3.5),start=car.distance;
 for(let i=0;i<120;i++)s.update(1/30,[{x:ahead.x,z:ahead.z}]);
 assert(car.distance-start<2.1);assert.equal(car.speed,0);assert.match(car.status,/Yielding/);
 for(let i=0;i<1800;i++){s.update(1/30);for(let j=0;j<s.vehicles.length;j++){const a=s.vehicles[j],b=s.vehicles[(j+1)%s.vehicles.length];const gap=((b.distance-a.distance)%s.path.length+s.path.length)%s.path.length;assert(gap>=3.099);}}
 assert(car.distance>start+50);
});

test('factory is logo-free procedural geometry, ground-origin and within published dimensions',()=>{
 for(const [kind,spec] of Object.entries(TESLA_STYLES)){
  const object=createTeslaVehicle(kind);object.userData.jets.removeFromParent();
  const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3());
  assert(Math.abs(bounds.min.y)<1e-6);assert(size.x<=spec.width+.001,`${kind} width ${size.x}`);assert(size.z<=spec.length+.001,`${kind} length ${size.z}`);
  assert.equal(object.userData.wheels.length,kind==='semi'?6:4);object.userData.animate({distance:2.2});assert(Math.abs(object.userData.wheels[0].rotation.x-2.2/object.userData.wheelRadius)<1e-8);object.userData.dispose();
 }
 assert.throws(()=>createTeslaVehicle('unknown'),/Unknown/);
});

test('traffic adapter preserves agents, collision envelopes, transforms and restores originals',()=>{
 const root=new THREE.Group(),vehicles=Array.from({length:10},(_,id)=>({id,kind:id===0?'bus':id===9?'cycle':'car',width:.88,length:1.85,distance:2.2,speed:1}));
 const objects=vehicles.map((v,i)=>{const o=new THREE.Group();o.position.set(i,.22,-16);o.rotation.y=i*.2;root.add(o);return o;});
 const originals=[...objects],before=structuredClone(vehicles),traffic={root,objects,simulation:{vehicles}},adapter=installTeslaTraffic(traffic);
 assert.equal(adapter.installed.length,7);assert.deepEqual(vehicles,before);assert.equal(objects[0],originals[0]);assert.equal(objects[9],originals[9]);
 for(const {i,v,object} of adapter.installed){assert.deepEqual(object.position.toArray(),originals[i].position.toArray());assert(object.quaternion.equals(originals[i].quaternion));const bounds=new THREE.Box3();object.rotation.set(0,0,0);bounds.setFromObject(object);const size=bounds.getSize(new THREE.Vector3());assert(size.x<=v.width+.001);assert(size.z<=v.length+.001);}
 adapter.update(.8);adapter.dispose();assert.deepEqual(objects,originals);assert.equal(root.children.length,10);
});

test('scene system creates exactly one Roadster, freezes at identical time, and disposes its scene roots',()=>{
 const scene=new THREE.Scene(),tesla=createTeslaTown(scene,town);assert.equal(tesla.fleet.length,7);
 tesla.update(12);const before=tesla.audit();tesla.update(12);assert.deepEqual(tesla.audit(),before);assert.equal(before.roadster.count,1);assert(before.roadster.altitude>8);assert.equal(before.arena.lineup.length,5);
 const sameScene=new THREE.Scene(),trafficRoot=new THREE.Group();sameScene.add(trafficRoot);const vehicles=[{id:0,kind:'car',width:.88,length:1.85,distance:0,speed:1}];const original=new THREE.Group();trafficRoot.add(original);const integrated=createTeslaTown(sameScene,town,{traffic:{root:trafficRoot,objects:[original],simulation:{vehicles}}});assert.equal(integrated.simulation,null);assert(Math.abs(integrated.roadster.object.position.y-(DEMO.ground+.05))<1e-8);assert.equal(integrated.audit().mode,'traffic-adapter');integrated.dispose();assert.deepEqual(trafficRoot.children,[original]);
 tesla.dispose();assert.equal(scene.children.length,0);
});

test('lineup look-alikes: per-vehicle budgets and recognisable proportions',()=>{
 const built=Object.fromEntries(LINEUP.map(v=>[v.kind,createTeslaVehicle(v.kind,{color:v.color})]));
 for(const [kind,o] of Object.entries(built)){
  let meshes=0,triangles=0;o.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
  assert(triangles<=3000,`${kind} triangles ${triangles}`);assert(meshes<=(kind==='semi'?10:8),`${kind} draw calls ${meshes}`);
  assert(o.children[0].children[0].children.some(m=>m.userData.outline),`${kind} has an ink hull`);
 }
 const size=k=>new THREE.Box3().setFromObject(built[k]).getSize(new THREE.Vector3());
 // Real length order: Cybercab < Model 3 <= Model Y < Cybertruck < Semi cab.
 assert(size('cybercab').z<size('sedan').z&&size('sedan').z<=size('crossover').z&&size('crossover').z<size('cybertruck').z&&size('cybertruck').z<size('semi').z);
 // Model Y is visibly taller than Model 3; the Semi towers over everything.
 assert(size('crossover').y-size('sedan').y>.15);assert(size('semi').y>1.8*size('sedan').y);
 Object.values(built).forEach(o=>o.userData.dispose());
});

test('arena leaves the east world-link road clear (no connector slab over the crosswalk)',()=>{
 const scene=new THREE.Scene(),tesla=createTeslaTown(scene,town);scene.updateMatrixWorld(true);
 const box=new THREE.Box3();tesla.arena.root.traverse(o=>{if(o.isMesh&&!o.userData.kind&&o.parent===tesla.arena.root&&o.geometry.attributes.position){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox);}});
 assert(box.max.x<=23.01,`Arena geometry reaches local x ${box.max.x}`);tesla.dispose();
});
