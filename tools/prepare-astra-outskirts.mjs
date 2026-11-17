// Local links only. The whole public/licensed directory is gitignored and
// excluded from builds. Source GLBs remain in the owned asset library.
import {mkdirSync,existsSync,symlinkSync,writeFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';
const names=['log_cabin','camp_tent','dock_jetty','canoe','canoe_paddle_rack','campsite_picnic_table','stone_ring_campfire','trailhead_sign','trail_marker_post','bear_food_locker','woodland_privy','ranger_hut','camp_tripod_kettle'];
const target=new URL('../public/licensed/astra-outskirts/',import.meta.url);mkdirSync(target,{recursive:true});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});const manifest={};
for(const name of names){
 const source=`/workspace/threejs-assets/nature/bundle/glb/individual/${name}.glb`,link=new URL(name+'.glb',target);if(!existsSync(link))symlinkSync(source,link);
 const doc=await io.read(source),box=new THREE.Box3();
 for(const node of doc.getRoot().listNodes())for(const prim of node.getMesh()?.listPrimitives()||[]){const a=prim.getAttribute('POSITION'),matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix()),p=[];for(let i=0;i<a.getCount();i++)box.expandByPoint(new THREE.Vector3(...a.getElement(i,p)).applyMatrix4(matrix));}
 manifest[name]={min:box.min.toArray().map(n=>+n.toFixed(3)),max:box.max.toArray().map(n=>+n.toFixed(3))};
 console.log(name,JSON.stringify(manifest[name]));
}
writeFileSync(new URL('../src/astra/outskirts-bounds.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
