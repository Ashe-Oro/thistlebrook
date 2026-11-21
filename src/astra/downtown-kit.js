import {inheritMeshDetail} from './model-detail.js';
import * as THREE from 'three';
import { place } from '../catalog/loader.js';
import { toonMaterial } from '../toon.js';
import { LAMP_LOOK } from './lamp-look.js';

// District-local drawing tools. Shared geometry keeps the little details cheap.
export function districtKit(scene) {
  const root = new THREE.Group();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 16);
  const emissive = new Map();
  const lights = [];
  function material(color, glow = false) {
    if (!glow) return toonMaterial(color);
    if (!emissive.has(color)) {
      const m = toonMaterial(color).clone();
      m.emissive.set(color);
      emissive.set(color, m);
    }
    return emissive.get(color);
  }
  function mesh(geometry, x, y, z, w, h, d, color, parent = root, glow = false) {
    const m = new THREE.Mesh(geometry, material(color, glow));
    m.position.set(x, y, z); m.scale.set(w, h, d);
    m.castShadow = !glow; m.receiveShadow = !glow; parent.add(m);
    return m;
  }
  const box = (x,y,z,w,h,d,c,p=root,g=false) => mesh(cube,x,y,z,w,h,d,c,p,g);
  const orb = (x,y,z,r,c,p=root,g=false) => mesh(sphere,x,y,z,r,r,r,c,p,g);
  const drum = (x,y,z,r,h,c,p=root,g=false) => mesh(cylinder,x,y,z,r,h,r,c,p,g);
  function ring(x,y,z,r,t,c,parent=root) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r,t,6,24),material(c));
    m.position.set(x,y,z);parent.add(m);return m;
  }
  function wire(points, color = '#56615b', parent = root) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));
    parent.add(l); return l;
  }
  function sign(text,x,y,z,w,h,color,parent=root,tilt=0) {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.max(128,Math.round(1024*h/w));
    const ctx=canvas.getContext('2d'),ch=canvas.height;
    ctx.fillStyle=color;ctx.fillRect(0,0,1024,ch);
    ctx.strokeStyle='#f5dfac';ctx.lineWidth=4;ctx.strokeRect(12,12,1000,ch-24);
    ctx.fillStyle='#fff0cf';ctx.textAlign='center';ctx.textBaseline='middle';
    let size=ch*.53;ctx.font=`700 ${size}px Georgia`;
    size=Math.min(size,size*945/ctx.measureText(text).width);ctx.font=`700 ${size}px Georgia`;ctx.fillText(text,512,ch*.53);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
    m.position.set(x,y,z);m.rotation.x=tilt;parent.add(m);return m;
  }
  // lamp=true marks a pool cast by a lamp post (streetlights brightness pass).
  function pool(x,z,r,color,lamp=false) {
    const c=document.createElement('canvas');c.width=c.height=64;
    const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(r*2,r*2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,opacity:0,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.position.set(x,.29,z);m.userData.lampPool=lamp;scene.add(m);lights.push(m);return m;
  }
  function bake() {
    root.updateMatrixWorld(true);const batches=new Map();
    root.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+o.material.uuid;
      if(!batches.has(key))batches.set(key,{source:o,matrices:[],ids:[]});batches.get(key).matrices.push(o.matrixWorld.clone());batches.get(key).ids.push(o.userData.registryId);});
    for(const {source,matrices,ids} of batches.values()) {
      const m=new THREE.InstancedMesh(source.geometry,source.material,matrices.length);inheritMeshDetail(source,m);
      matrices.forEach((matrix,i)=>m.setMatrixAt(i,matrix));m.userData.registryIds=ids;m.castShadow=source.castShadow;m.receiveShadow=source.receiveShadow;scene.add(m);
    }
    root.traverse(o=>{if(o.isLine){const l=o.clone();l.matrixAutoUpdate=false;l.matrix.copy(o.matrixWorld);scene.add(l);}});
  }
  return {root,box,orb,drum,ring,wire,sign,pool,bake,update(night){emissive.forEach(m=>m.emissiveIntensity=night*1.3);lights.forEach(m=>m.material.opacity=night*(m.userData.lampPool?LAMP_LOOK.kitLampPool:.48));}};
}

// Reuse the owned character meshes AND their ink hulls in instanced draws.
// People retain individual transforms, but 200 supporters do not add 200 draws.
export async function districtCrowd(scene, people) {
  const roles=[...new Set(people.map(p=>p.role+':'+p.period))];
  const templates=await Promise.all(roles.map(key=>place('townsfolk-'+key.split(':')[0])));
  const batches=[];
  roles.forEach((key,r)=>{
    const [role,period]=key.split(':');
    const members=people.filter(p=>p.role===role&&p.period===period),template=templates[r];template.updateMatrixWorld(true);
    template.traverse(part=>{
      if(!part.isMesh)return;
      const mesh=new THREE.InstancedMesh(part.geometry,part.material,members.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const bounds=period==='day'?[-57,3,-8,32]:period==='night'?[55,3,1,37]:[30,4,-84,34];
      mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(...bounds.slice(0,3)),bounds[3]);
      mesh.castShadow=part.castShadow;mesh.receiveShadow=part.receiveShadow;scene.add(mesh);
      batches.push({mesh,members,local:part.matrixWorld.clone()});
    });
  });
  // Scarves travel with their wearers and disappear with the evening crowd.
  const scarfGeometry=new THREE.BoxGeometry(.7,.2,.36);
  for(let team=0;team<2;team++) {
    const members=people.filter((p,i)=>p.period==='game'&&(i%3===0?0:1)===team);
    const mesh=new THREE.InstancedMesh(scarfGeometry,toonMaterial(team?'#4c8c80':'#edc477'),members.length);
    mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(30,4,-84),34);scene.add(mesh);
    batches.push({mesh,members,local:new THREE.Matrix4().makeTranslation(0,1.28,.1)});
  }
  const transform=new THREE.Object3D(),matrix=new THREE.Matrix4();
  return {people,update(t,hour,sheltering=()=>false){
    people.forEach(p=>{
      p.visible=!sheltering(p)&&(p.period==='night'?(hour>=17||hour<1):p.period==='game'?(hour>=18&&hour<22):hour>=7&&hour<19);
      const pose=p.motion(t);p.position=pose;
      transform.position.set(pose.x,pose.y,pose.z);transform.rotation.set(0,pose.yaw||0,pose.lean||0);
      transform.scale.setScalar(p.visible?p.scale||.9:0);transform.updateMatrix();
      p.matrix??=new THREE.Matrix4();p.matrix.copy(transform.matrix);
    });
    batches.forEach(({mesh,members,local})=>{
      mesh.visible=members.some(p=>p.visible);
      if(!mesh.visible)return;
      members.forEach((p,i)=>mesh.setMatrixAt(i,matrix.multiplyMatrices(p.matrix,local)));
      mesh.instanceMatrix.needsUpdate=true;
    });
  }};
}
