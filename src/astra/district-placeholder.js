import * as THREE from 'three';
import {toonMaterial} from '../toon.js';
import {RUNWAY} from './airport/airfield-plan.js';
import {WORLD_OFFSETS} from '../compiler/world-plan.js';

const body = new THREE.BoxGeometry(1,1,1);
const roof = new THREE.CylinderGeometry(0,.71,1,4,1).rotateY(Math.PI/4);
const wall = toonMaterial('#b0ab91');
const top = toonMaterial('#9a9783');

export function districtPlaceholder(town, id, parent,bounds) {
  const root = new THREE.Group();
  root.name = id + ' silhouette';
  const venues = (town.venues || []).filter(venue => venue.district === id && venue.box);
  if (!venues.length && bounds) {
    const {minX,minZ,maxX,maxZ} = bounds;
    const x = (minX+maxX)/2, z = (minZ+maxZ)/2;
    venues.push({box:{min:[x-5,z-4],max:[x+5,z+4]}});
  }
  for (const {box} of venues) {
    const w = box.max[0]-box.min[0], d = box.max[1]-box.min[1];
    const h = Math.min(8,Math.max(2,Math.min(w,d)*.36));
    const x = (box.min[0]+box.max[0])/2, z = (box.min[1]+box.max[1])/2;
    const base = new THREE.Mesh(body,wall), cap = new THREE.Mesh(roof,top);
    base.position.set(x,h/2,z);
    base.scale.set(w,h,d);
    cap.position.set(x,h*1.18,z);
    cap.scale.set(w,h*.36,d);
    root.add(base,cap);
  }
  if (id === 'airport') {
    const runway = new THREE.Mesh(body,toonMaterial('#687477'));
    const [x,z] = WORLD_OFFSETS.airport;
    runway.position.set(RUNWAY.x+x,.08,(RUNWAY.z0+RUNWAY.z1)/2+z);
    runway.scale.set(RUNWAY.half*2,.1,RUNWAY.z1-RUNWAY.z0);
    root.add(runway);
  }
  root.traverse(object => { object.userData.registryExempt = true; });
  parent.add(root);
  return root;
}
