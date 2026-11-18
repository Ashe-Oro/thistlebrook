// Uses the owned engine in place. No licensed source is vendored into src/.
import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const basic='/workspace/threejs-assets/character-model-basic/x/character-model-basic-source-1.1.0';
const wardrobe='/workspace/threejs-assets/character-model-basic-wardrobe/x/character-model-basic-wardrobe-source-1.0.0';
const rigged=process.argv.includes('--rigged');
const dest=root+'public/licensed/characters/'+(rigged?'rigged/':'');
await mkdir(dest,{recursive:true});
const code=`
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFileSync } from 'node:fs';
${rigged?"import { riggedFigure, writeRiggedGlb } from '"+root+"tools/rigged-villager-export.mjs';":''}
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { buildCharacter } from '${basic}/src/character/build.ts';
import { computeMetrics } from '${basic}/src/character/metrics.ts';
import { loadSetTables } from '${basic}/src/set.ts';
import { dressCharacter } from '${wardrobe}/src/character-wardrobe/dress.ts';
import { VILLAGERS } from '${root}src/catalog/villagers.js';
// GLTFExporter only needs Blob -> ArrayBuffer for these texture-free exports.
globalThis.FileReader=class { readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});} };
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
const lanternDoc=await io.read('${root}public/licensed/edo-village/paper_lantern.glb');
const content=loadSetTables().content;
for(const v of VILLAGERS){
 const style={...content.styles.find(s=>s.id===v.style),targetHeight:v.height||1.68};
 const dressed=dressCharacter(v.outfit,style,computeMetrics(style));
 if(dressed.unknown.length)throw Error(dressed.unknown.join(','));
 dressed.dressing.colors={cloth:v.color,clothTrim:v.trim,leather:v.trim,gold:v.trim,metal:'#9b9b93',hair:v.role==='elder'?'#aaa69d':'#252321'};
 if(v.role==='miko')for(const part of dressed.dressing.parts)if(part.id.startsWith('long-skirt:'))part.mat='clothAlt';
 for(const part of dressed.dressing.parts)if(part.id.startsWith('apron:')&&part.mat==='cloth')part.mat='clothAlt';
 dressed.dressing.colors.clothAlt=v.trim;
 const b=buildCharacter({styleId:v.style,paletteId:'adventurer',proportions:{targetHeight:style.targetHeight},colors:{shirt:v.color,pants:v.role==='miko'?v.trim:v.color,shoe:'#564533',hair:v.role==='elder'?'#aaa69d':'#252321'}},content,{dressing:dressed.dressing,outline:false});
 // Relax the T-pose using the supplied Mixamo skeleton, then bake this idle
 // pose. Runtime weight shifts operate on the complete dressed silhouette.
 b.boneByShortName.LeftArm.rotation.z=-1.23;
 b.boneByShortName.RightArm.rotation.z=1.23;
 b.boneByShortName.LeftForeArm.rotation.y=-0.18;
 b.boneByShortName.RightForeArm.rotation.y=0.18;
 if(v.role==='elder') b.boneByShortName.Spine.rotation.x=0.14;
 b.group.updateMatrixWorld(true);b.skeleton.update();
 const figure=new THREE.Group();figure.name=v.id;
 if(!${rigged}){
 const g=b.mesh.geometry.clone(); const pos=g.attributes.position;const p=new THREE.Vector3();
 for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i);b.mesh.applyBoneTransform(i,p);pos.setXYZ(i,p.x,p.y,p.z);}
 g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');g.computeVertexNormals();
 const colors=new Float32Array(pos.count*3);
 for(const group of g.groups){const c=b.mesh.material[group.materialIndex].color;for(let j=group.start;j<group.start+group.count;j++){const i=g.index?g.index.getX(j):j;colors.set(c.toArray(),i*3);}}
 g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.clearGroups();
 figure.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true})));
 }
 const add=(geo,color,x,y,z)=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color}));m.position.set(x,y,z);figure.add(m);return m;};
 const box=(w,h,d,c,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z);
 const rod=(a,b,r=.018,c='#695137')=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b);const m=add(new THREE.CylinderGeometry(r,r,A.distanceTo(B),8),c,...A.clone().add(B).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(A).normalize());return m;};
 const U=b.U,M=b.metrics;
 // Headless export uses small geometry facial marks instead of a canvas face.
 const fy=(M.headBottom+b.cfg.headH*.52)*U,fz=b.cfg.headD*U/2+.008;
 const face=(...args)=>{const mark=box(...args);mark.userData.face=true;return mark;};
 const headPose=new THREE.Matrix4().multiplyMatrices(b.boneByShortName.Head.matrixWorld,b.skeleton.boneInverses[b.boneIndex.Head]);
 for(const x of [-1,1])face(.024,.032,.012,'#252321',x*b.cfg.headW*U*.22,fy,fz).applyMatrix4(headPose);
 face(.045,.012,.012,'#74483b',0,fy-.085,fz).applyMatrix4(headPose);
 const waist=M.legTop*U+.08, chest=M.shoulderY*U;
 if(v.role!=='porter')box(b.cfg.torsoW*U+.09,.095,b.cfg.torsoD*U+.11,v.trim,0,waist,0); // missing obi
 if(['samurai','miko'].includes(v.role)){
  // Existing long skirt supplies the volume; these front pleats read as hakama.
  for(const x of [-.14,-.07,0,.07,.14])box(.012,.39,.015,v.role==='miko'?'#8e2835':'#121c2b',x,waist-.29,.19);
 }
 if(v.role==='samurai')for(const x of [-1,1]){const m=box(.22,.16,.12,v.trim,x*.25,chest-.08,0);m.rotation.z=x*.22;}
 if(['samurai','ronin'].includes(v.role)){
  rod([-.25,waist+.13,.05],[-.52,waist-.48,-.12],.027,'#302a2a');
  rod([-.25,waist+.13,.05],[-.18,waist+.30,.09],.023,'#ae9264');
  box(.13,.025,.10,'#ac9660',-.25,waist+.13,.05);
 }
 if(['monk','elder','farmer','fisherman','miko','child'].includes(v.role)){
  const x=.43;const top=v.role==='fisherman'?2.05:v.role==='child'?1.03:1.65;
  rod([x,.03,.16],[x,top,.16],v.role==='child'?.012:.019);
  if(v.role==='monk'){add(new THREE.TorusGeometry(.09,.012,6,16),'#b4a174',x,top,.16);}
  if(v.role==='farmer'){box(.32,.065,.13,'#686b65',x,top-.1,.16);}
  if(v.role==='fisherman')rod([x,top,.16],[x+.28,.15,.4],.003,'#d6ceaa');
  if(v.role==='miko')for(let k=0;k<4;k++){const m=box(.12,.12,.018,'#fff8e7',x+(k%2)*.10,top-.10-k*.10,.17);m.rotation.z=(k%2?1:-1)*.5;}
  if(v.role==='child')for(let k=0;k<4;k++){const m=box(.11,.055,.018,k%2?'#f0c744':'#579e9b',x+Math.cos(k*Math.PI/2)*.06,top+Math.sin(k*Math.PI/2)*.06,.18);m.rotation.z=k*Math.PI/2+.5;}
 }
 if(v.role==='hostess'){box(.46,.035,.27,'#59382d',0,waist+.12,.35);for(const x of [-.12,.12])add(new THREE.CylinderGeometry(.045,.04,.07,10),'#e5dec4',x,waist+.17,.35);}
 if(v.role==='miko'){for(const x of [-1,1]){const m=box(.14,.10,.045,v.trim,x*.13,1.53,-.13);m.rotation.z=x*.4;}}
 if(v.role==='lantern-maker'){
  // Reuse the owned Edo paper lantern, decoded directly without a listener.
  const lantern=new THREE.Group();
  for(const node of lanternDoc.getRoot().listNodes())for(const prim of node.getMesh()?.listPrimitives()||[]){
   const geo=new THREE.BufferGeometry();
   for(const [src,dst] of [['POSITION','position'],['NORMAL','normal'],['COLOR_0','color']]){const a=prim.getAttribute(src);if(a)geo.setAttribute(dst,new THREE.BufferAttribute(a.getArray().slice(),a.getElementSize()));}
   const idx=prim.getIndices();if(idx)geo.setIndex(new THREE.BufferAttribute(idx.getArray().slice(),1));
   geo.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
   const color=prim.getMaterial()?.getBaseColorFactor()||[1,1,1,1];
   lantern.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:new THREE.Color(...color.slice(0,3)),vertexColors:!!geo.attributes.color})));
  }
  const bb=new THREE.Box3().setFromObject(lantern),size=bb.getSize(new THREE.Vector3()),center=bb.getCenter(new THREE.Vector3());
  const holder=new THREE.Group();holder.add(lantern);lantern.position.set(-center.x,-bb.min.y,-center.z);holder.scale.setScalar(.34/size.y);holder.position.set(.43,.54,.17);figure.add(holder);
  rod([.43,.88,.17],[.43,1.02,.17],.01,'#4c3b2a');
 }
 if(v.role==='porter'){
  rod([-.65,chest+.02,0],[.65,chest+.02,0],.033);
  for(const x of [-.59,.59]){rod([x,chest,0],[x,waist-.20,0],.009);box(.27,.29,.28,'#a78a5b',x,waist-.24,0);box(.28,.025,.29,'#65543b',x,waist-.24,0);}
 }
 figure.updateMatrixWorld(true);
 const data=await new GLTFExporter().parseAsync(${rigged?'riggedFigure(b,figure,v.role)':'figure'},{binary:true});
 ${rigged?"await writeRiggedGlb('":"writeFileSync('"}${dest}'+v.id+'.glb',${rigged?'data':'Buffer.from(data)'});
 console.log(v.id,dressed.used.join(', '));
}
`;
const bundle=dest+'.generator.mjs';
await build({stdin:{contents:code,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:bundle,packages:'external',logLevel:'silent'});
try { await import(bundle+'?v='+Date.now()); } finally { await rm(bundle,{force:true}); }
