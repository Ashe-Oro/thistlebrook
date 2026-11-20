import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTeslaVehicle} from '../../src/astra/tesla/models.js';
import {roadsterPose, ROADSTER_PERIOD, DEMO, LINEUP, ROW_AXIS, lineupApexTime} from '../../src/astra/tesla/demo-motion.js';

export function assertRoadsterClearance(hy3d) {
 const car=createTeslaVehicle('roadster',{scale:DEMO.carScale,hy3d});car.userData.jets.removeFromParent();
 const parked=LINEUP.map(v=>{const o=createTeslaVehicle(v.kind,{scale:DEMO.carScale,hy3d});o.position.set(v.x+DEMO.x,DEMO.ground,v.z+DEMO.z);return {o,box:new THREE.Box3().setFromObject(o)};});
 let minimum=Infinity;
 for(let t=0;t<ROADSTER_PERIOD;t+=.025){const p=roadsterPose(t);car.position.set(p.x,p.y,p.z);car.userData.pivot.quaternion.fromArray(p.orientation);car.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(car,true);assert(bounds.min.y>=DEMO.ground-.04,`Floor at ${t}`);assert(bounds.min.x>DEMO.x-21.54&&bounds.max.x<DEMO.x+21.54,`Curb clearance at ${t}`);for(const other of parked){assert(!bounds.intersectsBox(other.box),`Lineup collision ${other.o.userData.kind} at ${t}`);if(t>44&&t<54&&bounds.max.x>other.box.min.x&&bounds.min.x<other.box.max.x)minimum=Math.min(minimum,bounds.min.y-other.box.max.y);}}
 assert(minimum>6,`Minimum vertical lineup clearance ${minimum}`);car.userData.dispose();parked.forEach(v=>v.o.userData.dispose());
}

export function assertRowClearance(scene, tesla) {
 scene.updateMatrixWorld(true);
 const boxes=tesla.arena.lineup.map(o=>({kind:o.userData.kind,box:new THREE.Box3().setFromObject(o,true)}));
 const stand=tesla.arena.grandstandBounds.clone().applyMatrix4(tesla.arena.root.matrixWorld);
 const inside=(p,b)=>p.x>=b.min.x&&p.x<=b.max.x&&p.z>=b.min.z&&p.z<=b.max.z;
 const overlaps=(a,b)=>a.min.x<=b.max.x&&a.max.x>=b.min.x&&a.min.z<=b.max.z&&a.max.z>=b.min.z;
 const visited=[];
 for(let t=42;t<=54.0001;t+=.01){
  tesla.update(t);scene.updateMatrixWorld(true);
  const car=tesla.roadster.object,center=car.userData.pivot.getWorldPosition(new THREE.Vector3());
  const footprint=new THREE.Box3().setFromObject(car,true);
  assert(Math.abs(center.z-(DEMO.z+ROW_AXIS.z))<1e-8,'Run-up, flight and touchdown must be colinear');
  assert(!inside(center,stand)&&!overlaps(footprint,stand),`Grandstand overflight at ${t}`);
  if(t>=44&&t<54){
   assert(footprint.min.z>=Math.max(...boxes.map(v=>v.box.min.z))&&footprint.max.z<=Math.min(...boxes.map(v=>v.box.max.z)),'Entire flying mesh stays inside the row footprint in Z');
   for(const {kind,box} of boxes)if(inside(center,box)&&!visited.includes(kind)){visited.push(kind);assert(footprint.min.y>box.max.y+6);}
  }
 }
 assert.deepEqual(visited,['cybercab','cybertruck','semi','crossover','sedan']);
 tesla.update(lineupApexTime());scene.updateMatrixWorld(true);const apex=tesla.roadster.object.userData.pivot.getWorldPosition(new THREE.Vector3());
 assert(inside(apex,boxes[2].box),'Apex directly over the actual Semi bounds');assert(Math.abs(apex.x-(DEMO.x+ROW_AXIS.centerX))<1e-8);
 tesla.update(44);scene.updateMatrixWorld(true);assert(new THREE.Box3().setFromObject(tesla.roadster.object,true).max.x<boxes[0].box.min.x,'Takeoff immediately before Cybercab');
 tesla.update(54);scene.updateMatrixWorld(true);assert(new THREE.Box3().setFromObject(tesla.roadster.object,true).min.x>boxes[4].box.max.x,'Entire car lands beyond Model 3');
}
