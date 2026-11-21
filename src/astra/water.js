// OWNER: grok-river lane (village/grok-river). Contract: docs/specs/GROK-RIVER.md.
// Renders town.water: every reach of the Willow River, the Spring Falls on
// the Mountain Pass, the lake and Gulf deltas, and the footbridges. All
// geometry is derived from the compiler plan; nothing is placed by hand.
import * as THREE from 'three';
import {toonMaterial} from '../toon.js';
import {tagObject} from './registry/render-tags.js';
import {mountainSurface,groundAt} from '../compiler/water.js';
import {inLake} from './outskirts-layout.js';
import {makeRng} from '../compiler/rng.js';

export function buildWater(scene,town){
 const plan=town.water,rng=makeRng(town.seed+5150),random=()=>rng.float();
 const root=new THREE.Group();root.name='Willow River system';scene.add(root);
 const mats=new Map(),mat=c=>{if(!mats.has(c))mats.set(c,toonMaterial(c));return mats.get(c);};
 const geo=(vertices,indices)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;};
 const add=(g,color,id='built:river',shadow=true)=>{const m=new THREE.Mesh(g,mat(color));m.receiveShadow=true;m.castShadow=false;if(!shadow)m.receiveShadow=false;root.add(tagObject(m,id));return m;};
 const cube=new THREE.BoxGeometry(1,1,1),rockGeo=new THREE.DodecahedronGeometry(1,0);
 const box=(x,y,z,w,h,d,c,yaw=0,id='built:river')=>{const m=new THREE.Mesh(cube,mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.y=yaw;m.castShadow=true;m.receiveShadow=true;root.add(tagObject(m,id));return m;};
 const frame=(pts,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return {tx:dx/l,tz:dz/l,nx:-dz/l,nz:dx/l};};
 // Ribbon across a polyline: offsets[k] = [lateral factor, y fn].
 const ribbon=(pts,cols)=>{const v=[],idx=[],n=cols.length;
  pts.forEach((p,i)=>{const f=frame(pts,i);for(const [off,y] of cols){const o=off(p);v.push(p[0]+f.nx*o,y(p,o,f),p[1]+f.nz*o);}if(i<pts.length-1)for(let k=0;k<n-1;k++){const a=i*n+k,b=a+n;idx.push(a,a+1,b,a+1,b+1,b);}});
  return geo(v,idx);};
 const streaks=[],falling=[];
 // Upper, town and meadow reaches render as one continuous strip so the
 // joins have no seams; the outflow and the falls are their own strips.
 const strips=[];
 for(const reach of plan.reaches){
  // Rendered water stops two metres inside Stillwater, under the lake surface.
  let pts=reach.points.map(p=>Object.assign([...p],{reach:reach.id}));
  if(reach.into==='lake'){const k=pts.findIndex(p=>inLake(p,-2));if(k>0)pts=pts.slice(0,k+1);}
  if(reach.from==='lake'){const k=pts.findLastIndex(p=>inLake(p,-2));if(k>=0)pts=pts.slice(k);}
  const last=strips.at(-1);
  if(reach.kind==='river'&&last?.kind==='river'&&!reach.from&&Math.hypot(last.pts.at(-1)[0]-pts[0][0],last.pts.at(-1)[1]-pts[0][1])<.01)last.pts.push(...pts.slice(1));
  else if(reach.into==='sea'){const k=pts.findIndex(p=>p[2]<plan.reaches.find(r=>r.id==='outflow').points[0][2]-.01&&groundAt(town,p)<-.4);
   // From the beach ledge the water runs down to the Gulf in the Gulf's own
   // colour, ending 1 cm above the sea surface so the two read as one.
   strips.push({kind:reach.kind,pts:pts.slice(0,k+1)},{kind:'run',pts:pts.slice(k)});}
  else strips.push({kind:reach.kind,pts});
 }
 for(const {kind,pts} of strips){
  if(kind==='run'){add(ribbon(pts,[[p=>-p[3],p=>p[2]],[p=>p[3],p=>p[2]]]),'#72b2b9');continue;}
  if(kind==='cascade'){
   // Falls drape over the real mountain faces, 10 cm proud of the rock.
   const surf=(p,o,f)=>Math.max(.075,(mountainSurface(p[0]+f.nx*o,p[1]+f.nz*o)??-.09)+.1);
   add(ribbon(pts,[[p=>-p[3]-.18,(p,o,f)=>surf(p,o,f)-.04],[p=>-p[3],surf],[p=>0,(p,o,f)=>surf(p,o,f)+.01],[p=>p[3],surf],[p=>p[3]+.18,(p,o,f)=>surf(p,o,f)-.04]]),'#9fcfcc');
   add(ribbon(pts,[[p=>-p[3]*.45,(p,o,f)=>surf(p,o,f)+.03],[p=>p[3]*.45,(p,o,f)=>surf(p,o,f)+.03]]),'#d9eeea');
   for(let i=0;i<14;i++)falling.push({m:box(0,0,0,.18+random()*.3,.05,.5,'#f2fbf7'),u:random(),lane:(random()-.5)*.9,speed:.35+random()*.25,pts});
   // Spring cleft at the lip: two dark rocks frame the source.
   const lip=pts[0],f=frame(pts,0);
   for(const s of [-1,1]){const r=new THREE.Mesh(rockGeo,mat('#7f8b72'));r.position.set(lip[0]+f.nx*s*1.05-f.tx*.3,lip[2]+.15,lip[1]+f.nz*s*1.05-f.tz*.3);r.scale.set(.75,.6,.7);r.rotation.y=s;r.castShadow=true;root.add(tagObject(r,'built:river'));}
   continue;
  }
  const g=p=>groundAt(town,p);
  const bankY=(p,o,f)=>g([p[0]+f.nx*o,p[1]+f.nz*o])+.006;
  // Sand skirt meets the real ground at its outer edge and dips under the water.
  add(ribbon(pts,[[p=>-p[3]-p[4],bankY],[p=>-p[3]+.2,p=>p[2]-.02],[p=>p[3]-.2,p=>p[2]-.02],[p=>p[3]+p[4],bankY]]),'#ced2a7');
  add(ribbon(pts,[[p=>-p[3],p=>p[2]-.006],[p=>p[3],p=>p[2]-.006]]),'#77b6b5');
  add(ribbon(pts,[[p=>-p[3]*.72,p=>p[2]],[p=>p[3]*.72,p=>p[2]]]),'#70afb3');
  for(let i=0;i<pts.length;i+=3){const p=pts[i];if(p.reach==='town'||g(p)<-.2)continue; // world.js keeps the original trunk shimmer.
   const f=frame(pts,i),o=(random()-.5)*p[3]*1.4,w=.35+random()*1.2;
   const m=box(p[0]+f.nx*o,p[2]+.025,p[1]+f.nz*o,w,.015,.035,'#b7d7cf',Math.atan2(f.tx,f.tz)+Math.PI/2);m.castShadow=false;
   streaks.push({m,x:m.position.x,z:m.position.z,tx:f.tx,tz:f.tz,phase:random()*6,width:w});}
  // Bank reeds are Nature cattails planned with the landscape (src/compiler/nature-edges.js).
 }
 // Plunge pool under the falls, with a foam ring.
 for(const q of plan.pools){
  const pool=add(new THREE.CircleGeometry(q.r,28),'#77b6b5');pool.rotation.x=-Math.PI/2;pool.position.set(q.x,q.level-.004,q.z);
  for(let i=0;i<9;i++){const a=random()*6.28,r=random()*q.r*.55,foam=add(new THREE.CircleGeometry(.2+random()*.35,10),'#e4f3ee');foam.rotation.x=-Math.PI/2;foam.position.set(q.x+.5+Math.cos(a)*r,q.level+.004,q.z-.6+Math.sin(a)*r);foam.scale.y=.6;}
  const sand=add(new THREE.RingGeometry(q.r,q.r+.55,28),'#ced2a7');sand.rotation.x=-Math.PI/2;sand.position.set(q.x,-.084,q.z);
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2+.4,r=new THREE.Mesh(rockGeo,mat(i%2?'#9caa88':'#8e9a7c'));r.position.set(q.x+Math.cos(a)*(q.r+.5),.05,q.z+Math.sin(a)*(q.r+.5));r.scale.set(.45+random()*.4,.3+random()*.25,.45+random()*.35);r.rotation.y=random()*6;r.castShadow=true;root.add(tagObject(r,'built:river'));}
 }
 // Deltas: sandbars split the widened mouths into braided channels.
 const out=plan.reaches.find(r=>r.id==='outflow').points,west=plan.reaches.find(r=>r.id==='west').points;
 const bar=(p,f,o,len,wid,yaw=0)=>{const m=add(new THREE.CircleGeometry(1,18),'#e1d3a6');m.rotation.x=-Math.PI/2;m.rotation.z=Math.atan2(f.tx,f.tz)+yaw;m.scale.set(wid,len,1);m.position.set(p[0]+f.nx*o,p[2]+.006,p[1]+f.nz*o);return m;};
 const mouthIndex=plan.mouth.headIndex;
 for(const [k,o,len,wid,yaw] of [[-9,-1.2,3.6,1.1,.15],[-4,2.3,2.8,.9,-.2],[-2,-2.9,2.2,.75,.25]]){const i=Math.max(0,mouthIndex+k);bar(out[i],frame(out,i),o,len,wid,yaw);}
 const wi=west.findIndex(p=>inLake(p,1));if(wi>2)bar(west[wi-3],frame(west,wi-3),.6,2.2,.8,.1);
 // Foam flecks ride the water surface where the river tips over the ledge.
 const ledge=out.findIndex(p=>Math.hypot(p[0]-plan.mouth.ledge[0],p[1]-plan.mouth.ledge[1])<.6);
 for(let i=0;i<16;i++){const k=Math.max(0,ledge-Math.floor(random()*4)),p=out[k],f=frame(out,k),o=(random()-.5)*p[3]*1.6,m=add(new THREE.CircleGeometry(1,12),'#e9f4ef');m.rotation.x=-Math.PI/2;m.rotation.z=Math.atan2(f.tx,f.tz)+Math.PI/2;m.scale.set(.2+random()*.25,.5+random()*.8,1);m.position.set(p[0]+f.nx*o,p[2]+.012,p[1]+f.nz*o);}
 // Timber footbridges for every new path crossing (the town's three bridges
 // keep their original geometry in world.js).
 for(const b of plan.bridges.filter(b=>!b.existing)){
  const id='built:'+b.id,c=Math.cos(b.yaw),s=Math.sin(b.yaw),at=(along,across,y,w,h,d,col)=>box(b.pos[0]+s*along+c*across,y,b.pos[1]+c*along-s*across,w,h,d,col,b.yaw,id);
  at(0,0,.3,b.width,.2,b.length,'#bca681');
  for(let k=0;k<Math.floor(b.length/.42);k++)at(-b.length/2+.25+k*.42,0,.43,b.width-.15,.07,.32,'#cbb592');
  for(const side of [-1,1]){const x=side*(b.width/2-.08),posts=Math.max(3,Math.round(b.length/1.7)+1);
   for(let k=0;k<posts;k++)at(-b.length/2+.15+k*(b.length-.3)/(posts-1),x,.95,.15,1.2,.15,'#a18b6e');
   at(0,x,1.48,.13,.15,b.length,'#bba17b');at(0,x,.9,.09,.1,b.length,'#bba17b');}
  // Abutments tie the deck to dry land at both ends.
  for(const end of [-1,1])at(end*(b.length/2+.25),0,.12,b.width+.3,.24,.7,'#a99f83');
 }
 return {root,update(t){
  for(const r of streaks){const d=Math.sin(t*.4+r.phase)*.4;r.m.position.set(r.x+r.tx*d,r.m.position.y,r.z+r.tz*d);r.m.scale.x=r.width*(.8+Math.sin(t+r.phase)*.25);}
  for(const f of falling){const u=(f.u+t*f.speed*.25)%1,i=Math.min(f.pts.length-2,Math.floor(u*(f.pts.length-1))),a=f.pts[i],b=f.pts[i+1],k=u*(f.pts.length-1)-i,fr=frame(f.pts,i);
   const x=a[0]+(b[0]-a[0])*k+fr.nx*f.lane*a[3],z=a[1]+(b[1]-a[1])*k+fr.nz*f.lane*a[3],y=(mountainSurface(x,z)??-.09)+.16;f.m.position.set(x,Math.max(y,a[2]+.03),z);f.m.rotation.y=Math.atan2(fr.tx,fr.tz);f.m.rotation.x=-.9;}
 },audit(){return {reaches:plan.reaches.map(r=>r.id),bridges:plan.bridges.length,streaks:streaks.length,falls:falling.length};}};
}
