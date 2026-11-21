import * as THREE from 'three';
import { createGLTFLoader } from '../../gltf-loader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { toonMaterial, toonVertexColorMaterial } from '../../toon.js';
import { bindMeshDetail,lodUrl } from '../../astra/model-detail.js';
import { getAsset } from './index.js';
const loader=createGLTFLoader();
const cache=new Map();
function loadContent(url){
 if(!cache.has(url))cache.set(url,loader.loadAsync(url).then(g=>{
  g.scene.traverse(m=>{if(!m.isMesh)return;const convert=original=>{const material=(m.geometry.attributes.color?toonVertexColorMaterial():toonMaterial(original.color?.getHex()??0xffffff)).clone();material.side=original.side;material.map=original.map;material.transparent=original.transparent;material.opacity=original.opacity;material.alphaTest=original.alphaTest;return material;};m.material=Array.isArray(m.material)?m.material.map(convert):convert(m.material);m.castShadow=true;m.receiveShadow=true;});return g.scene;
 }));
 return cache.get(url);
}
export async function loadLibraryAsset(id,{detail,centre}={}){
 const asset=getAsset(id);
 const url='/owned-assets/'+asset.path.split('/').map(encodeURIComponent).join('/');
 const variant=detail&&centre&&lodUrl(url);
 const root=new THREE.Group();
 const make=async path=>{
  const content=clone(await loadContent(path));
  const {origin,scale}=asset.placement;
  content.position.set(...origin.map(v=>-v*scale));content.scale.setScalar(scale);
  return content;
 };
 const low=await make(variant||url);
 root.add(low);root.name=id;root.userData.asset=asset;
 if(variant){
  const meshes=object=>{const parts=[];object.traverse(o=>{if(o.isMesh)parts.push(o);});return parts;};
  let full;
  meshes(low).forEach((mesh,i)=>bindMeshDetail(detail,[centre],mesh,async()=>{
   full??=loadContent(url).then(meshes);
   return (await full)[i]?.geometry;
  }));
 }
 return root;
}
