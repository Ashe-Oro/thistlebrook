import * as THREE from 'three';
import { createGLTFLoader } from '../../gltf-loader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { toonMaterial, toonVertexColorMaterial } from '../../toon.js';
import { getAsset } from './index.js';
const loader=createGLTFLoader();
const cache=new Map();
export async function loadLibraryAsset(id){
 const asset=getAsset(id);
 if(!cache.has(id))cache.set(id,loader.loadAsync('/owned-assets/'+asset.path.split('/').map(encodeURIComponent).join('/')).then(g=>{
  g.scene.traverse(m=>{if(!m.isMesh)return;const convert=original=>{const material=(m.geometry.attributes.color?toonVertexColorMaterial():toonMaterial(original.color?.getHex()??0xffffff)).clone();material.side=original.side;material.map=original.map;material.transparent=original.transparent;material.opacity=original.opacity;material.alphaTest=original.alphaTest;return material;};m.material=Array.isArray(m.material)?m.material.map(convert):convert(m.material);m.castShadow=true;m.receiveShadow=true;});return g.scene;
 }));
 const content=clone(await cache.get(id)),root=new THREE.Group();
 const {origin,scale}=asset.placement;content.position.set(...origin.map(v=>-v*scale));content.scale.setScalar(scale);root.add(content);root.name=id;root.userData.asset=asset;return root;
}
