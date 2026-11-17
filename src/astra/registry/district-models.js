import * as THREE from 'three';
import {tagObject} from './render-tags.js';

import {modelPlacementId} from './model-id.js';

/** Called on the unbatched, district-local source. Capture metadata, never GLB bytes. */
export function tagDistrictModels(source,town,district,origin=[0,0]){
 source.updateWorldMatrix(true,true);
 const inverse=source.matrixWorld.clone().invert();
 const offset=town.registryOffset||[0,0];
 town.renderedModels??=[];
 source.traverse(o=>{
  const entry=o.userData.entry,asset=o.userData.ownedAsset||entry?.id;
  if(!asset||/^townsfolk-|^character-/.test(asset))return;
  const v=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();const local=inverse.clone().multiply(o.matrixWorld);local.decompose(v,q,s);
  const rot=Math.atan2(local.elements[8],local.elements[10]);
  const pos=[v.x+origin[0]+offset[0],v.z+origin[1]+offset[1]],scale=s.x;
  const id=modelPlacementId(district,asset,pos,scale,rot,o.userData.placementOrdinal);
  const box=new THREE.Box3().setFromObject(o),size=box.getSize(new THREE.Vector3()).toArray();
  const record={id,asset,district,pos,scale,rot,size,elevation:v.y,...(o.userData.placementOrdinal===undefined?{}:{ordinal:o.userData.placementOrdinal}),path:o.userData.ownedPath||entry?.path};
  town.renderedModels.push(record);
  if(!town.registry.places.some(p=>p.id===id)){
   if(!town.captureRegistry)throw Error(`Unregistered district model: ${id} (${asset})`);
   town.registry.places.push({...record,name:asset,type:'prop',capabilities:[],node:null});
  }
  tagObject(o,id);
 });
}
