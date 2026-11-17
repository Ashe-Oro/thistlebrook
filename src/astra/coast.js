import {furnitureId} from './registry/district-furniture.js';
import {tagNewFurniture} from './registry/furniture-tags.js';
import * as THREE from 'three';
import { districtKit } from './downtown-kit.js';
import { toonMaterial } from '../toon.js';
import { COAST_BLOCKS, COAST_REAR, COAST_COURTS, COAST_UMBRELLAS, shoreX } from './coast-plan.js';
import { createCoastLife } from './coast-life.js';

export async function buildCoast(scene,town) {
  const root=new THREE.Group();root.name='Coral Coast';scene.add(root);
  const edge=[[65,-112],[130,-112],...Array.from({length:14},(_,i)=>{const z=-108+i*9;return [shoreX(z),z];}),[127,9],[65,9]],shape=new THREE.Shape();edge.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  const land=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:2.5,bevelEnabled:false}),[toonMaterial('#e7d3a8'),toonMaterial('#b3a083')]);land.rotation.x=Math.PI/2;land.position.y=-.02;land.receiveShadow=true;root.add(land);
  const kit=districtKit(root),{box,drum,orb,wire}=kit,selectables=[];
  const extra=(geometry,color,x,y,z,parent=kit.root)=>{const m=new THREE.Mesh(geometry,toonMaterial(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const beam=(a,b,width,color,parent=kit.root)=>{const mid=new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5),d=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));const m=box(mid.x,mid.y,mid.z,width,d.length(),width,color,parent);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;};
  function label(text,x,y,z,w,h,color,rotation=Math.PI/2){const m=kit.sign(text,x,y,z,w,h,color);m.rotation.y=rotation;return m;}
  const beachCanopies=[];
  function umbrella(x,z,r,color,y=0,beach=false){
    const start=kit.root.children.length;
    drum(x,y+1.6,z,.065,3.2,'#fff2d4');
    // Alternating fabric panels; a low octagonal canopy with a scalloped hem.
    const geo=new THREE.ConeGeometry(r,.62,12,1,true);geo.clearGroups();
    const white=toonMaterial('#fff4d7'),tint=toonMaterial(color);for(let i=0;i<12;i++)geo.addGroup(i*3,3,i%2);
    const m=new THREE.Mesh(geo,[white,tint]);m.position.set(x,y+3.15,z);m.castShadow=true;
    // Animated fabric keeps the umbrella's registry identity outside static baking.
    (beach?root:kit.root).add(m);if(beach)beachCanopies.push(m);
    const id=furnitureId('coral-coast','umbrella',x,y,z);
    m.userData.registryId=id;
    orb(x,y+3.5,z,.12,'#fff2d4');tagNewFurniture(kit.root,start,id);
  }
  function table(x,y,z,color='#fff0cd',roof=false){
    const start=kit.root.children.length;
    drum(x,y+.84,z,.8,.14,color);drum(x,y+.42,z,.075,.84,'#576d68');drum(x,y+.06,z,.38,.08,'#576d68');
    for(const dz of [-1.05,1.05]){box(x,y+.46,z+dz,.7,.12,.65,'#c89066');box(x,y+.87,z+dz+Math.sign(dz)*.28,.72,.8,.09,roof?'#e9c3a3':'#65b6ae');for(const dx of [-.26,.26])box(x+dx,y+.22,z+dz,.075,.44,.5,'#556d67');}
    drum(x+.2,y+.99,z,.085,.23,'#f2b667');drum(x-.25,y+.99,z,.085,.23,'#92ced0');orb(x,y+1.02,z+.26,.13,'#e7818a');tagNewFurniture(kit.root,start,furnitureId('coral-coast','dining-table',x,y,z));
  }
  function palm(x,z,height=6,phase=0){
    for(let j=0;j<5;j++){const a=[x+.045*j*j,j*height/5,z],b=[x+.045*(j+1)**2,(j+1)*height/5,z];beam(a,b,.27-j*.025,'#aa8663');}
    const cx=x+1.125;
    for(let j=0;j<7;j++){
      const angle=j*Math.PI*2/7+phase,dx=Math.cos(angle),dz=Math.sin(angle);
      const points=[cx,height,z,cx+dx*1.5-dz*.48,height+.62,z+dz*1.5+dx*.48,cx+dx*3.1,height-.7,z+dz*3.1,cx+dx*1.5+dz*.48,height+.62,z+dz*1.5-dx*.48];
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex([0,2,1,0,3,2,1,2,0,2,3,0]);g.computeVertexNormals();extra(g,j%2?'#559f82':'#77b995',0,0,0);
    }
    for(let j=0;j<3;j++)orb(cx+(j-1)*.2,height-.12,z+.15,.2,'#a58b55');
  }
  // The ocean sits below the original island. Its southern arm meets the river mouth.

  const ribbon=(start,end,color,y)=>{
    const p=[],idx=[];for(let n=0;n<=120;n++){const z=-111+n*120/120,x=shoreX(z);p.push(typeof start==='function'?start(z):x+start,y,z,typeof end==='function'?end(z):x+end,y,z);if(n<120){const i=n*2;idx.push(i,i+2,i+1,i+1,i+2,i+3);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();const m=extra(g,color,0,0,0);m.castShadow=false;return m;
  };
  ribbon(()=>111,0,'#f4dca0',.035);ribbon(-3.1,0,'#e8c891',.06);ribbon(0,6,'#94dcd1',-.035);ribbon(6,15,'#70cdc8',-.06);ribbon(15,28,'#5dbdc4',-.07);
  // Paved blocks are distinct from the broad promenade and the sand.
  box(83.6,.04,-50.5,33,.08,112,'#d6c8b7');
  box(101,.13,-50.5,4.6,.1,112,'#879fa0');
  box(107.5,.11,-50.5,8,.13,112,'#efdfc7');
  box(112,.1,-50.5,.35,.18,112,'#e5c291');
  for(let z=-104;z<5;z+=3.5){box(101,.19,z,.12,.015,1.4,'#f6e3b4');box(107.5,.185,z,7,.01,.06,'#d5bfa3');}
  for(const z of [-103,-73,-31,2])for(let x=99.5;x<103;x+=.8)box(x,.2,z,.42,.015,2.2,'#faf0cf');
  for(const z of [-102,-88,-74,-60,-46,-32,-18,-4]){
    palm(105.3,z,5.5+(Math.abs(z)%3)*.5,z*.1);
    box(105.6,.3,z,1.8,.4,1.8,'#c3b99c');
    drum(109,z%3?2.5:2.6,z-4,.06,5,'#527b79');orb(109,5.05,z-4,.22,'#ffe6af',kit.root,true);kit.pool(109,z-4,3,'#ffe5a3');
    box(109,.5,z+3,1.1,.14,2.2,'#b89472');box(109.5,.9,z+3,.1,.8,2.2,'#b89472');box(109,.22,z+3,.6,.44,1.7,'#6f8d83');
    drum(109,.48,z+5,.32,.9,'#729f9a');
  }
  function building(b,rear=false){
    const {x,z,height:h,color,neon}=b,w=rear?8:9,d=10,front=x+w/2;
    box(x,h/2,z,w,h,d,color);
    box(x,.3,z,w+.3,.6,d+.3,'#eee1c9');box(x,h-.3,z,w+.45,.3,d+.45,'#fff0d6');
    box(x,h+.15,z,w+.3,.35,d+.3,'#f0d8b8');box(x,h+.37,z,w-.45,.1,d-.45,'#d7bca1');
    // Horizontal eyebrows, vertical fins and dark recessed window frames.
    for(let y=4.5;y<h-1;y+=3){
      box(front+.12,y,z,.3,.16,d+.2,'#fff1d5');
      for(const dz of [-3.4,-1.15,1.15,3.4]){
        box(front+.04,y+1.1,z+dz,.12,1.7,1.65,'#497e86');
        box(front+.13,y+1.1,z+dz,.05,1.35,1.35,'#b5d6cd',kit.root,true);
        box(front+.18,y+1.1,z+dz,.06,1.4,.06,'#fff0d5');
      }
      for(const dx of [-w/2+1.4,0,w/2-1.4]){box(x+dx,y+1,z+5.04,1.45,1.65,.08,'#53858a');box(x+dx,y+1,z+5.1,1.1,1.3,.04,'#c8d9c6',kit.root,true);}
    }
    box(front+.28,h*.54,z-4.65,.45,h-1,.28,'#fff0d5');box(front+.5,h*.54,z-4.65,.08,h-1,.12,neon,kit.root,true);
    for(const dz of [-3,0,3])box(front+.06,1.7,z+dz,.12,2.6,2.3,'#346e77');
    box(front+.16,1.35,z,.06,2.4,.11,'#e9dcb6');
    const awning=box(front+.8,3.3,z,1.7,.18,9.5,rear?'#efd0a0':neon);awning.rotation.z=-.08;
    for(let dz=-4.5;dz<4.6;dz+=1)box(front+.85,3.4,z+dz,1.8,.07,.38,'#fff4da');
    label(b.sign,front+.2,4.05,z,8.4,.85,'#305d68');
    box(front+.23,4.59,z,.08,.08,8.5,neon,kit.root,true);box(front+.23,3.51,z,.08,.08,8.5,neon,kit.root,true);
    if(rear){box(x,h+1.2,z-2,4,1.8,3,color);return;}
    // A recognisable stepped Art Deco crown, with the roof terrace behind it.
    box(front-.5,h+.9,z-3.4,1.3,1.5,2.7,color);box(front-.5,h+1.8,z-3.4,1.3,.4,1.8,'#fff0d5');
    for(const dz of [-4.7,4.7]){box(x,h+.85,z+dz,w,.11,.1,'#f3e4c7');for(let dx=-4;dx<=4;dx+=1)box(x+dx,h+.55,z+dz,.06,.7,.06,'#739a98');}
    box(front-.2,h+.85,z,.1,.11,9.4,'#f3e4c7');
    for(const dz of [-2.7,2.7]){table(x,h+.45,z+dz,'#fff0d4',true);table(95,.2,z+dz);}
    umbrella(x-1.6,z-1,1.75,neon,h+.45);
    box(x-2,h+1,z+3,2.2,1.1,.8,'#427c7e');for(let n=0;n<5;n++)drum(x-2.8+n*.4,h+1.7,z+3,.07,.3,neon,kit.root,true);
    // Open outside stair: the same coordinates are walked by the local graph.
    for(let n=0;n<24;n++){const u=(n+1)/24;box(98-14*u,h*u+.2,z+5.9,.65,.22,1.1,'#ecd3ae');}
    beam([98,.7,z+6.5],[84,h+1,z+6.5],.08,'#5f8d89');box(84,h+.3,z+5.25,1.2,.2,2.4,'#ecd3ae');
    for(const dz of [-4.7,4.7]){box(97.4,.6,z+dz,.7,1,1,'#f3c5a7');orb(97.4,1.2,z+dz,.5,'#77ab83');}
    kit.pool(94,z,6,neon);
    // Festoon over patio, with warm bulbs instead of expensive point lights.
    for(const dz of [-4.8,4.8])box(97,2.1,z+dz,.08,4.2,.08,'#5b8582');
    const pts=[];for(let n=0;n<=12;n++){const zz=z-4.8+n*.8,yy=4.3-Math.sin(n/12*Math.PI)*.5;pts.push([97,yy,zz]);orb(97,yy-.1,zz,.09,'#ffdf9c',kit.root,true);}wire(pts,'#546d66');
  }
  COAST_REAR.forEach(b=>building(b,true));COAST_BLOCKS.forEach(b=>building(b));
  for(const u of COAST_UMBRELLAS){umbrella(u.x,u.z,2.05,u.color,0,true);for(const dz of [-1.6,1.6]){box(u.x+.65,.095,u.z+dz,2.2,.06,.85,u.color);box(u.x-.2,.14,u.z+dz,.5,.12,.75,'#fff1d8');}drum(u.x-1,.22,u.z,.3,.4,'#fff1d8');}
  for(const [i,z] of COAST_COURTS.entries()){
    box(123,.08,z,13,.05,17,'#edd39b');
    for(const x of [116.7,129.3])box(x,.12,z,.08,.03,16.5,'#fff7dd');
    for(const zz of [z-8.2,z+8.2])box(123,.12,zz,12.6,.03,.08,'#fff7dd');
    for(const x of [116.5,129.5])drum(x,1.6,z,.09,3.2,'#4b9fa2');
    for(let y=.9;y<2.9;y+=.27)wire([[116.5,y,z],[129.5,y,z]],'#f6edd8');
    for(let x=116.5;x<=129.5;x+=.4)wire([[x,.9,z],[x,2.85,z]],'#f6edd8');
    box(123,2.9,z,13.2,.12,.08,'#fff6dd');label('CORAL VOLLEY',116.3,1.1,z-7.9,3,.5,'#4d9199');
  }
  // Two elevated lifeguard towers, rescue boards, flags and accessible sand walks.
  for(const [i,z]of [-99,-31].entries()){
    const x=130;
    for(const dx of [-1.1,1.1])for(const dz of [-.9,.9])box(x+dx,1.5,z+dz,.15,3,.15,'#c7a27a');
    box(x,2.5,z+.4,3.2,.18,4,'#f7e3ba');box(x,3.1,z+2.4,3.2,.09,.09,'#fff0cd');for(const dx of [-1.5,1.5])box(x+dx,2.85,z+2.4,.08,.7,.08,'#fff0cd');box(x,3.3,z,2.7,1.5,2.3,i?'#f0a4b5':'#88d0cb');
    box(x,3.55,z+1.17,2.1,.65,.07,'#3a858e');box(x+1.37,3.55,z,.07,.65,1.6,'#3a858e');
    box(x,4.2,z,3.7,.2,3.2,'#fff0cd');label('RESCUE 0'+(i+1),x,2.9,z+1.3,2.4,.5,'#cf747e',0);
    for(let n=0;n<8;n++)box(x-2.6+n*.18,.2+n*.31,z,.46,.16,1.1,'#ead7b2');
    drum(x+1.5,4.6,z,.05,2.5,'#fff0ce');box(x+1.95,5.4,z,.9,.55,.035,'#71bd95');
    const board=box(x-1.9,1.45,z+1.7,.55,2.8,.16,'#f0a36b');board.rotation.z=-.2;
  }
  for(const z of [-103,-73,-31,2]){box(119,.13,z,14,.11,1.6,'#ddbd8f');for(let x=112;x<126;x+=.6)box(x,.2,z,.06,.02,1.5,'#bda27b');}
  for(let z=-103;z<3;z+=7){orb(shoreX(z)+10,.15,z,.17,'#f6a477');}
  wire(Array.from({length:28},(_,i)=>{const z=-103+i*4;return[shoreX(z)+10,.04,z];}),'#b0e0d2');
  // Small racks of surfboards, bicycle hoops, foot showers and arrival signs.
  for(const z of [-73,-31]){
    label('CORAL BEACH',112,2,z,4.6,.8,'#558e8f');
    for(let i=0;i<4;i++){const m=box(113+i*.4,1.1,z+3,.3,2.1,.14,['#ea9f9d','#a1d4c5','#edc66e'][i%3]);m.rotation.z=-.12;}
    drum(113,1.4,z-3,.06,2.8,'#728f8c');box(113.3,2.8,z-3,.65,.08,.08,'#728f8c');drum(113.6,2.75,z-3,.15,.06,'#728f8c');
  }
  kit.bake();
  // Several independently advancing foam fronts make a readable, rolling surf.
  const waves=[];
  for(let band=0;band<4;band++){
    const geo=new THREE.BufferGeometry(),p=new Float32Array(121*6),idx=[];for(let n=0;n<120;n++){const i=n*2;idx.push(i,i+2,i+1,i+1,i+2,i+3);}geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setIndex(idx);
    const mat=new THREE.MeshBasicMaterial({color:band%2?'#e7fff0':'#f7fff2',transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false});const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;root.add(mesh);waves.push({mesh,band});
  }
  for(const v of town.venues.filter(v=>v.district==='coral-coast'))selectables.push({type:'venue',data:v,bounds:new THREE.Box3(new THREE.Vector3(v.box.min[0],0,v.box.min[1]),new THREE.Vector3(v.box.max[0],v.height||5,v.box.max[1]))});
  const life=await createCoastLife(root,town);
  return {selectables,life,audit:()=>({...life.audit(),beachUmbrellas:{total:beachCanopies.length,open:beachCanopies.filter(m=>m.scale.x===1).length}}),update(t,night,hour){
    kit.update(night);life.update(t,hour);
    for(const canopy of beachCanopies){const open=hour>=7&&hour<19;canopy.scale.set(open?1:.12,open?1:2.8,open?1:.12);canopy.position.y=open?3.15:2.5;}
    for(const {mesh,band}of waves){const phase=(t*.15+band/4)%1,attr=mesh.geometry.attributes.position;for(let n=0;n<=120;n++){const z=-110+n,xx=shoreX(z)+9*(1-phase)+Math.sin(z*.28+t*.8)*.24;attr.setXYZ(n*2,xx,.1,z);attr.setXYZ(n*2+1,xx+.16+Math.sin(z*.19+band)**2*.16,.105,z);}attr.needsUpdate=true;mesh.material.opacity=Math.sin(phase*Math.PI)*(.7-night*.3);}
  }};
}
