import {tagAssembly} from './registry/render-tags.js';
import * as THREE from 'three';
import {DISTRICT_OFFSETS,moveParcel} from '../compiler/astra-placement.js';

// Retain each district's authored local animation paths while using the same
// translation as its compiled doors, reservations, selection boxes and roads.
export async function buildPlacedDistrict(builder,scene,town,district) {
 const offset=DISTRICT_OFFSETS[district],inverse=offset.map(v=>-v),root=new THREE.Group();
 root.name=district;root.position.set(offset[0],0,offset[1]);scene.add(root);
 const local={...town};
 for(const key of ['buildings','venues'])local[key]=town[key].map(p=>p.district===district?moveParcel(p,inverse):p);
 if(district==='works')local.workRail={minX:town.workRail.minX+inverse[0],maxX:town.workRail.maxX+inverse[0],z:town.workRail.z+inverse[1]};
 const result=await builder(root,local),translation=new THREE.Vector3(offset[0],0,offset[1]);
 for(const record of result.records||result.selectables||[]){
  record.bounds.translate(translation);
  record.data=[...town.buildings,...town.venues].find(p=>record.data.key?p.key===record.data.key:p.id===record.data.id);
 }
 tagAssembly(root,town.districts.find(d=>d.id===district).registryId);return result;
}
