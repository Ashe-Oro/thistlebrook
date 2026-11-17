import * as THREE from 'three';
import { toonMaterial } from '../toon.js';
const cube=new THREE.BoxGeometry(1,1,1),ball=new THREE.IcosahedronGeometry(1,1);
const cylinders=new Map();
export function primitives(root){
 const mesh=(geometry,color,x=0,y=0,z=0,parent=root)=>{const m=new THREE.Mesh(geometry,typeof color==='string'?toonMaterial(color):color);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const box=(x,y,z,w,h,d,c,p=root)=>{const m=mesh(cube,c,x,y,z,p);m.scale.set(w,h,d);return m;};
 const cylinder=(x,y,z,r,h,c,p=root,top=r)=>{const key=top/r; if(!cylinders.has(key))cylinders.set(key,new THREE.CylinderGeometry(key,1,1,24));const m=mesh(cylinders.get(key),c,x,y,z,p);m.scale.set(r,h,r);return m;};
 const orb=(x,y,z,r,c,p=root)=>{const m=mesh(ball,c,x,y,z,p);m.scale.setScalar(r);return m;};
 const beam=(a,b,r,c,p=root)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const m=box(0,0,0,r,d.length(),r,c,p);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;};
 const ring=(x,y,z,r,t,c,p=root)=>{const m=mesh(new THREE.TorusGeometry(r,t,6,64),c,x,y,z,p);m.rotation.x=Math.PI/2;return m;};
 const label=(text,x,y,z,w,h,c='#344d53',p=root,flat=false)=>{const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=c;ctx.fillRect(0,0,1024,128);ctx.fillStyle='#fff2d7';ctx.font='600 68px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,67,970);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const m=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}),x,y,z,p);if(flat)m.rotation.x=-Math.PI/2;return m;};
 return {mesh,box,cylinder,orb,beam,ring,label};
}
export function rocket(kind){
 const root=new THREE.Group();root.name=kind;const p=primitives(root),{box,cylinder,ring,beam}=p;
 const ship=kind==='ship',superHeavy=kind==='booster',upper=kind==='upper';
 const r=ship||superHeavy?1.45:.7,h=ship?9:superHeavy?18:upper?5:13,white=ship||superHeavy?'#b9ccd0':'#f1eee1';
 cylinder(0,h/2,0,r,h,white);
 if(ship||upper){cylinder(0,h+1.5,0,r,3,white,root,.06);}
 if(ship){const heat=new THREE.Mesh(new THREE.CylinderGeometry(r+.018,r+.018,h,24,1,true,0,Math.PI),toonMaterial('#25353f'));heat.position.y=h/2;root.add(heat);const nose=new THREE.Mesh(new THREE.ConeGeometry(r+.02,3,24,1,true,0,Math.PI),toonMaterial('#25353f'));nose.position.y=h+1.5;root.add(nose);
  for(const y of [1.4,7.7])for(const side of [-1,1]){const fin=box(side*1.6,y,0,1.9,y<2?2.4:1.4,.16,'#2c3d45');fin.rotation.z=side*(y<2?-.22:.3);}
 }
 if(!ship&&!upper){cylinder(0,h-.65,0,r+.015,1.3,superHeavy?'#829ba5':'#293941');
  for(let n=0;n<4;n++){const a=n*Math.PI/2,g=new THREE.Group();g.position.set(Math.sin(a)*r,h-1.2,Math.cos(a)*r);g.rotation.y=a;root.add(g);for(let i=0;i<5;i++)box(-.48+i*.24,0,.6,.05,.1,1.1,'#3d5058',g);for(let j=0;j<5;j++)box(0,0,.15+j*.22,1,.1,.045,'#3d5058',g);}
 }
 if(superHeavy||ship)for(let i=1;i<h;i+=1.35)ring(0,i,0,r+.01,.022,'#7f99a3');
 else if(!upper){p.label('FALCON 9',0,7,.712,3,.55,'#e9eee7').rotation.z=Math.PI/2;}
 const legs=[];
 if(!ship&&!superHeavy&&!upper)for(let n=0;n<4;n++){const a=n*Math.PI/2+Math.PI/4,g=new THREE.Group();g.rotation.y=a;g.position.set(Math.sin(a)*r,.25,Math.cos(a)*r);root.add(g);const leg=new THREE.Group();g.add(leg);beam([0,0,0],[0,3.7,.18],.16,'#24363c',leg);box(0,3.65,.2,.55,.18,.45,'#23343b',leg);legs.push(leg);}
 for(let n=0;n<(superHeavy?9:ship?3:upper?1:5);n++){const a=n*2.399,radius=superHeavy?1:ship?.65:upper?0:.4;cylinder(Math.sin(a)*radius,-.17,Math.cos(a)*radius,.22,.45,'#25323b',root,.13);}
 const flame=new THREE.Group();flame.position.y=-.3;root.add(flame);const orange=new THREE.MeshBasicMaterial({color:'#ff952e'}),cream=new THREE.MeshBasicMaterial({color:'#fff4b0'});
 const outer=cylinder(0,-2.8,0,r*.75,5.6,orange,flame,0.02);outer.rotation.z=Math.PI;
 const inner=cylinder(0,-1.6,0,r*.47,3.5,cream,flame,0.01);inner.rotation.z=Math.PI;flame.visible=false;
 return {root,flame,legs,apply(state,t){root.visible=state.visible;root.position.set(state.x,state.y,state.z);root.rotation.z=state.tilt;legs.forEach(l=>l.rotation.x=state.legs*1.8);flame.visible=state.burn>0;flame.scale.set(1,state.burn*(.9+.1*Math.sin(t*36)),1);}};
}
// Static architecture uses shared geometry/material instances, including kit hulls.
export function batchStatic(source,parent){source.updateMatrixWorld(true);const batches=new Map();source.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+':'+o.material.uuid;if(!batches.has(key))batches.set(key,{o,matrices:[],ids:[]});batches.get(key).matrices.push(o.matrixWorld.clone());batches.get(key).ids.push(o.userData.registryId);});for(const {o,matrices,ids}of batches.values()){const m=new THREE.InstancedMesh(o.geometry,o.material,matrices.length);matrices.forEach((v,i)=>m.setMatrixAt(i,v));m.userData.registryIds=ids;m.castShadow=o.castShadow;m.receiveShadow=o.receiveShadow;parent.add(m);}}
