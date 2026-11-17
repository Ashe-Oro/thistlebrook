import * as THREE from 'three';
import { RESOLVED } from '../catalog/loader.js';
import { dressingReservations } from './dressing-runtime.js';
import { obbFromRect, obbOverlap, toWorldXZ } from '../compiler/geometry.js';
import { isoPresentationBox } from './iso-camera.js';

// Runtime presentation only: compiled placements and navigation stay immutable.
export function createIsoDiorama(stage, town, people) {
 const {scene}=stage;
 const box=isoPresentationBox(scene);
 const x0=box.min.x-6,x1=box.max.x+6,z0=box.min.z-6,z1=box.max.z+6,r=8;
 const shape=new THREE.Shape();shape.moveTo(x0+r,z0);shape.lineTo(x1-r,z0);shape.quadraticCurveTo(x1,z0,x1,z0+r);shape.lineTo(x1,z1-r);shape.quadraticCurveTo(x1,z1,x1-r,z1);shape.lineTo(x0+r,z1);shape.quadraticCurveTo(x0,z1,x0,z1-r);shape.lineTo(x0,z0+r);shape.quadraticCurveTo(x0,z0,x0+r,z0);
 const water=town.instances.filter(i=>['edo-koi-pond-tile','edo-garden-stream-tile'].includes(i.id));
 if(water.length){const h=new THREE.Path(),a=Math.min(...water.map(i=>i.pos[0]-2.5)),b=Math.max(...water.map(i=>i.pos[0]+2.5)),c=Math.min(...water.map(i=>i.pos[1]-2.5)),d=Math.max(...water.map(i=>i.pos[1]+2.5));h.moveTo(a,c);h.lineTo(a,d);h.lineTo(b,d);h.lineTo(b,c);h.closePath();shape.holes.push(h);}
 // The first three runtime roots are the unlabelled sky, hill backdrop, ground.
 // Identify by geometry as well, so interiors and imported assets are untouched.
 for(const root of [...scene.children]){
  if(root.material?.uniforms?.top&&root.material.uniforms.bottom)root.visible=false;
  if(root.isGroup&&!root.userData.inst&&!root.userData.instances&&root.children.length&&root.children.every(o=>o.geometry?.type==='SphereGeometry'))root.visible=false;
  if(root.isGroup&&root.children[0]?.geometry?.type?.match(/CircleGeometry|ShapeGeometry/)&&(root.children[0].geometry.parameters?.radius>=70||root.children[0].geometry.type==='ShapeGeometry'))root.visible=false;
  if(root.name==='life-cloud')root.visible=false;
 }
 const grass=new THREE.MeshLambertMaterial({color:'#a5b47c'});
 grass.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vMeadow;').replace('#include <begin_vertex>','#include <begin_vertex>\nvMeadow=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vMeadow;').replace('#include <color_fragment>','#include <color_fragment>\nfloat meadow=sin(vMeadow.x*.19)*sin(vMeadow.y*.16)*.035+sin(vMeadow.x*.71+vMeadow.y*.49)*.012;diffuseColor.rgb *= 1.0+meadow;');};
 const soil=new THREE.MeshLambertMaterial({color:'#967454'});
 const island=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:3.8,bevelEnabled:false,curveSegments:12}),[grass,soil]);island.rotation.x=Math.PI/2;island.position.y=-.025;island.receiveShadow=true;island.name='iso-soil-island';scene.add(island);
 // Remove field furniture from both compiled batches and art batches. Keep props
 // within a building's immediate neighbourhood; furniture never fills meadows.
 const homes=town.instances.filter(i=>['house','landmark'].includes(i.kind));
 const nearHome=i=>homes.some(b=>{const f=RESOLVED.get(b.id)?.bounds;return Math.hypot(i.pos[0]-b.pos[0],i.pos[1]-b.pos[1])<Math.max(f?f.max[0]-f.min[0]:8,f?f.max[2]-f.min[2]:8)*.6+5;});
 let hiddenFurniture=0;
 const zero=new THREE.Matrix4().makeScale(0,0,0);
 const outside=i=>{const [x,z]=i.pos,cx=THREE.MathUtils.clamp(x,x0+r,x1-r),cz=THREE.MathUtils.clamp(z,z0+r,z1-r);return Math.hypot(x-cx,z-cz)>r-1;};
 scene.traverse(o=>{
  if(o.isInstancedMesh){const rows=o.userData.instances;if(!rows)return;for(let n=0;n<rows.length;n++){const i=rows[n];if(outside(i)||((i.zone==='street'||/bench|streetlamp/.test(i.id))&&!nearHome(i))){o.setMatrixAt(n,zero);hiddenFurniture++;}}o.instanceMatrix.needsUpdate=true;}
  else if(o.userData.inst&&!o.userData.batchPivot&&(outside(o.userData.inst)||(/bench|streetlamp/.test(o.userData.inst.id)&&!nearHome(o.userData.inst))))o.visible=false;
 });
 addYards(scene,town,homes);
 addForestEdges(scene,town,{x0,x1,z0,z1});
 scene.fog=null;
 // Preserve the day/night sky colour as a plain background, never geometry.
 scene.userData.isoDiorama={bounds:{x0,x1,z0,z1},hiddenFurniture};
 const walkers=people.people.slice(0,12).map((p,n)=>{
  const o=p.o.clone(true);o.traverse(c=>{c.userData={...c.userData};delete c.userData.inst;});
  const nodes=town.life.graph.nodes.map((p,k)=>({p,k})).filter(({p})=>p.pos[1]<-35&&p.pos[0]>-50&&p.pos[0]<50);
  const node=nodes[Math.floor(n*nodes.length/12)]?.k??0;
  const pos=town.life.graph.nodes[node].pos;o.position.set(pos[0],p.baseY,pos[1]);o.name='iso-neighbour';scene.add(o);return {o,node,next:null,baseY:p.baseY,n};
 });
 return {update(dt=0,seconds=0){scene.fog=null;for(const w of walkers){const g=town.life.graph;if(w.next===null){const edges=g.edges[w.node];w.next=edges[(w.n+w.node)%edges.length]??w.node;}
 const p=g.nodes[w.next].pos,dx=p[0]-w.o.position.x,dz=p[1]-w.o.position.z,d=Math.hypot(dx,dz),step=Math.min(dt*(1.1+w.n*.025),d);if(d>.001){w.o.position.x+=dx/d*step;w.o.position.z+=dz/d*step;w.o.rotation.y=Math.atan2(dx,dz);}if(d<=step+.001){w.node=w.next;w.next=null;}w.o.position.y=w.baseY+Math.abs(Math.sin(seconds*8+w.n))*.035;w.o.rotation.z=Math.sin(seconds*4+w.n)*.018;
 }},island};
}

// Small, reserved gardens make the space between the original homes feel owned.
// Geometry is batched by colour; paths, doors and navigation remain clear.
function addYards(scene,town,homes){
 const reserved=dressingReservations(town),parts=new Map();
 const add=(color,x,y,z,w,h,d,angle=0)=>{if(!parts.has(color))parts.set(color,[]);const o=new THREE.Object3D();o.position.set(x,y,z);o.scale.set(w,h,d);o.rotation.y=angle;o.updateMatrix();parts.get(color).push(o.matrix.clone());};
 for(const p of town.instances.filter(i=>i.kind==='path'&&(i.streetId||i.street))){const width=p.width||p.params?.width||2.3,length=p.length||p.params?.length||0;for(const side of [-1,1]){const q=toWorldXZ([side*(width/2+.08),0],{x:p.pos[0],z:p.pos[1],rotY:p.rotY});add('#9c9271',q[0],.045,q[1],.16,.07,Math.max(.1,length-.7),p.rotY);}}
 let gardens=0;
 for(const [n,b] of homes.entries()){
  const f=RESOLVED.get(b.id).footprint;
  for(const side of [-1,1]){
   const local=[side*(Math.max(Math.abs(f.min[0]),Math.abs(f.max[0]))+1.8),0];
   const p=toWorldXZ(local,{x:b.pos[0],z:b.pos[1],rotY:b.rotY});
   const area=obbFromRect({min:[-1.2,-2.3],max:[1.2,2.3]},{x:p[0],z:p[1],rotY:b.rotY});
   if(reserved.some(r=>obbOverlap(area,r,.25)))continue;reserved.push(area);gardens++;
   const piece=(c,x,y,z,w,h,d)=>{const q=toWorldXZ([x,z],{x:p[0],z:p[1],rotY:b.rotY});add(c,q[0],y,q[1],w,h,d,b.rotY);};
   piece('#89734f',0,.035,0,2.2,.08,4.2);
   for(const x of [-1.12,1.12])piece('#c0b399',x,.13,0,.13,.2,4.4);
   for(const z of [-2.15,2.15])piece('#c0b399',0,.13,z,2.35,.2,.13);
   for(let k=0;k<12;k++){const x=k%3*.65-.65,z=Math.floor(k/3)*.9-1.35;piece('#71825a',x,.2,z,.42,.33,.42);piece(n%3===0?'#dba66f':n%3===1?'#d4c185':'#bd8691',x,.4,z,.24,.18,.24);}
   // Rear fence and a laundry line in alternate yards.
   for(const z of [-1.9,0,1.9])piece('#b8a281',1.3,.65,z,.12,1.3,.12);
   for(const y of [.45,.95])piece('#b8a281',1.3,y,0,.09,.10,3.9);
   if(n%2===0){for(const z of [-1.8,1.8])piece('#796952',-.95,1.0,z,.09,2,.09);piece('#8f8170',-.95,1.9,0,.035,.035,3.6);for(let k=0;k<3;k++)piece(k%2?'#e3c5a1':'#d5d9cc',-.95,1.5,k*.9-.9,.035,.75,.6);}
  }
 }
 for(const [color,matrices] of parts){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color}),matrices.length);matrices.forEach((m,n)=>mesh.setMatrixAt(n,m));mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='iso-yard';scene.add(mesh);}
 scene.userData.isoGardens=gardens;
}

function addForestEdges(scene,town,bounds){
 const reserved=dressingReservations(town),positions=[];
 const centers=[[bounds.x0+17,bounds.z0+25],[bounds.x0+15,(bounds.z0+bounds.z1)*.5],[bounds.x1-18,bounds.z0+20]];
 for(let k=0;k<66;k++){const c=centers[k%3],a=k*2.39996,r=3+Math.sqrt(Math.floor(k/3))*2.3,p=[c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r];const box=obbFromRect({min:[-2,-2],max:[2,2]},{x:p[0],z:p[1],rotY:0});if(reserved.some(b=>obbOverlap(box,b,.4)))continue;reserved.push(box);positions.push(p);}
 const sources=scene.children.filter(o=>o.userData.instances?.[0]?.kind==='tree');
 sources.slice(0,3).forEach((root,t)=>{const inst=root.userData.instances[0],points=positions.filter((_,n)=>n%3===t);if(!points.length)return;root.traverse(source=>{if(!source.isInstancedMesh)return;const mesh=new THREE.InstancedMesh(source.geometry,source.material,points.length),base=new THREE.Matrix4(),shift=new THREE.Matrix4();source.getMatrixAt(0,base);points.forEach((p,n)=>{shift.makeTranslation(p[0]-inst.pos[0],0,p[1]-inst.pos[1]);mesh.setMatrixAt(n,shift.clone().multiply(base));});mesh.userData={...source.userData};delete mesh.userData.instances;mesh.layers.mask=source.layers.mask;mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.name='iso-forest-edge';scene.add(mesh);});});
 scene.userData.isoForestTrees=positions.length;
}
