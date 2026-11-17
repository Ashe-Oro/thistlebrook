// Uses the owned engine in place. No licensed source is vendored into src/.
import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const basic='/workspace/threejs-assets/character-model-basic/x/character-model-basic-source-1.1.0';
const wardrobe='/workspace/threejs-assets/character-model-basic-wardrobe/x/character-model-basic-wardrobe-source-1.0.0';
const dest=root+'public/licensed/characters/';
await mkdir(dest,{recursive:true});
const code=`
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFileSync } from 'node:fs';
import { buildCharacter } from '${basic}/src/character/build.ts';
import { computeMetrics } from '${basic}/src/character/metrics.ts';
import { loadSetTables } from '${basic}/src/set.ts';
import { dressCharacter } from '${wardrobe}/src/character-wardrobe/dress.ts';
import { TOWNSFOLK as VILLAGERS } from '${root}src/catalog/townsfolk.js';
// GLTFExporter only needs Blob -> ArrayBuffer for these texture-free exports.
globalThis.FileReader=class { readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});} };
const content=loadSetTables().content;
for(const v of VILLAGERS){
 const style={...content.styles.find(s=>s.id===v.style),targetHeight:v.height||1.68};
 const dressed=dressCharacter(v.outfit,style,computeMetrics(style));
 if(dressed.unknown.length)throw Error(dressed.unknown.join(','));
 dressed.dressing.colors={cloth:v.color,clothTrim:v.trim,leather:v.trim,gold:v.trim,metal:'#9b9b93',hair:v.hairColor||'#252321'};
 for(const part of dressed.dressing.parts)if(/^(long-skirt|skirt|breeches|shorts|overalls):/.test(part.id)&&part.mat==='cloth')part.mat='pants';
 for(const part of dressed.dressing.parts)if(part.id.startsWith('apron:')&&part.mat==='cloth')part.mat='clothAlt';
 dressed.dressing.colors.clothAlt=v.trim;
 const b=buildCharacter({styleId:v.style,paletteId:'adventurer',proportions:{targetHeight:style.targetHeight},colors:{shirt:v.color,pants:v.pants||v.color,skin:v.skin||'#d5a078',shoe:'#564533',hair:v.hairColor||'#252321'}},content,{dressing:dressed.dressing,outline:false});
 // Relax the T-pose using the supplied Mixamo skeleton, then bake this idle
 // pose. Runtime weight shifts operate on the complete dressed silhouette.
 b.boneByShortName.LeftArm.rotation.z=-1.23;
 b.boneByShortName.RightArm.rotation.z=1.23;
 b.boneByShortName.LeftForeArm.rotation.y=-0.18;
 b.boneByShortName.RightForeArm.rotation.y=0.18;
 if(v.role==='elder') b.boneByShortName.Spine.rotation.x=0.14;
 b.group.updateMatrixWorld(true);b.skeleton.update();
 const g=b.mesh.geometry.clone(); const pos=g.attributes.position;const p=new THREE.Vector3();
 for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i);b.mesh.applyBoneTransform(i,p);pos.setXYZ(i,p.x,p.y,p.z);}
 g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');g.computeVertexNormals();
 const colors=new Float32Array(pos.count*3);
 for(const group of g.groups){const c=b.mesh.material[group.materialIndex].color;for(let j=group.start;j<group.start+group.count;j++){const i=g.index?g.index.getX(j):j;colors.set(c.toArray(),i*3);}}
 g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.clearGroups();
 const figure=new THREE.Group();figure.name=v.id;
 figure.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true})));
 const add=(geo,color,x,y,z)=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color}));m.position.set(x,y,z);figure.add(m);return m;};
 const box=(w,h,d,c,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z);
 const rod=(a,b,r=.018,c='#695137')=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b);const m=add(new THREE.CylinderGeometry(r,r,A.distanceTo(B),8),c,...A.clone().add(B).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(A).normalize());return m;};
 const U=b.U,M=b.metrics;
 // Headless export uses small geometry facial marks instead of a canvas face.
 const fy=(M.headBottom+b.cfg.headH*.52)*U,fz=b.cfg.headD*U/2+.008;
 const headPose=new THREE.Matrix4().multiplyMatrices(b.boneByShortName.Head.matrixWorld,b.skeleton.boneInverses[b.boneIndex.Head]);
 for(const x of [-1,1])box(.024,.032,.012,'#252321',x*b.cfg.headW*U*.22,fy,fz).applyMatrix4(headPose);
 box(.045,.012,.012,'#74483b',0,fy-.085,fz).applyMatrix4(headPose);
 const waist=M.legTop*U+.08, chest=M.shoulderY*U;
 if(v.role==='baker'||v.role==='innkeeper'){box(.46,.035,.28,'#745139',0,waist+.05,.35);for(const x of [-.12,.12])add(new THREE.SphereGeometry(.07,8,6),'#dba955',x,waist+.11,.35);}
 if(v.role==='blacksmith'||v.role==='carpenter'){rod([.37,waist-.25,.12],[.37,waist+.1,.12],.025);box(.19,.10,.10,'#69737b',.37,waist+.13,.12);}
 if(v.role==='farmhand'||v.role==='herbalist'){box(.28,.22,.24,'#b79359',.38,waist-.12,.14);rod([.25,waist,.14],[.50,waist,.14],.018);}
 if(v.role==='elder')rod([.37,.02,.14],[.37,waist+.18,.14],.022);
 figure.updateMatrixWorld(true);
 const data=await new GLTFExporter().parseAsync(figure,{binary:true});
 writeFileSync('${dest}'+v.id+'.glb',Buffer.from(data));
 console.log(v.id,dressed.used.join(', '));
}
`;
const bundle=dest+'.generator.mjs';
await build({stdin:{contents:code,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:bundle,packages:'external',logLevel:'silent'});
try { await import(bundle+'?v='+Date.now()); } finally { await rm(bundle,{force:true}); }
