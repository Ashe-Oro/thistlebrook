import * as THREE from 'three';
import { place } from '../catalog/loader.js';
import { toonMaterial } from '../toon.js';

// Sunbeam's architecture, furnishings and authored courtyard activity stay
// together here. Its doors and through routes belong to sunbeam-layout.js.
export async function buildSunbeam(scene, town) {
  const root = new THREE.Group(), moving = new THREE.Group();
  root.name = 'Sunbeam Terrace'; moving.name = 'Sunbeam courtyard life'; scene.add(moving);
  const cube = new THREE.BoxGeometry(1,1,1), ball = new THREE.IcosahedronGeometry(1,1);
  const jobs=[], selectables=[], neighbours=[], washing=[], lights=[];
  const glass = toonMaterial('#6c9399').clone();
  const box=(x,y,z,w,h,d,c,parent=root)=>{
    const m=new THREE.Mesh(cube,typeof c==='string'?toonMaterial(c):c);
    m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  };
  const orb=(x,y,z,r,c,parent=root)=>{const m=new THREE.Mesh(ball,toonMaterial(c));m.position.set(x,y,z);m.scale.setScalar(r);m.castShadow=true;parent.add(m);return m;};
  const line=(points,color='#58645b',parent=root)=>{const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));parent.add(m);return m;};
  const label=(text,x,y,z,w,h,color='#486d65',parent=root,flat=false)=>{
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1024,128);ctx.fillStyle='#fff0cf';ctx.font='600 78px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,68,970);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));mesh.position.set(x,y,z);if(flat)mesh.rotation.x=-Math.PI/2;parent.add(mesh);return mesh;
  };
  const asset=(id,x,z,scale=1,rotY=0,parent=root,y=0)=>jobs.push(place(id,{x,z,scale,rotY}).then(o=>{o.position.y=y;parent.add(o);}));
  const planter=(x,z,w=1.5,parent=root,y=.35)=>{box(x,y,z,w,.5,.6,'#ad7c61',parent);box(x,y+.27,z,w-.15,.05,.44,'#705947',parent);for(let n=0;n<5;n++){orb(x-w*.38+n*w*.19,y+.45,z,.22,'#70945e',parent);orb(x-w*.38+n*w*.19,y+.66,z,.11,n%2?'#e9bc6e':'#d69398',parent);}};
  // A brick-paved, car-free court. The two exits join the existing town graph.
  box(-61,.08,-52,35.7,.12,13.4,'#c0ad93');box(-61,.15,-52,35.2,.06,12.9,'#d6c4a8');
  for(let n=0;n<36;n++)box(-78.3+n,.185,-52,.028,.01,12.8,'#c4b195');
  for(let n=0;n<13;n++)box(-61,.19,-58+n,35,.01,.028,'#c4b195');
  box(-61,.2,-52,35,.025,3,'#e6d5b7');
  for(const z of [-58.2,-45.8])box(-61,.23,z,35.5,.2,.18,'#f0dfbd');

  for(const [i,b] of town.buildings.filter(b=>b.district==='sunbeam').entries()){
    const g=new THREE.Group();g.position.set(b.pos[0],0,b.pos[1]);g.rotation.y=b.rot;root.add(g);
    const h=b.height, trim='#efdbb7', roof='#536d70';
    box(0,h/2,0,5.5,h,6,b.color,g);
    box(0,.35,0,5.65,.7,6.15,'#b8aa95',g);
    for(const y of [2.9,5.6,h-.1])box(0,y,0,5.64,.18,6.14,trim,g);
    for(const x of [-2.65,2.65])box(x,h/2,3.05,.16,h,.15,trim,g);
    // Low slate roof with a raised ridge and chimney, varied across the row.
    for(const side of [-1,1]){const r=box(0,h+.6,side*1.5,5.8,.22,3.4,roof,g);r.rotation.x=side*.34;}
    box(0,h+1.17,0,5.85,.2,.23,'#405b61',g);
    box(-1.7,h+.95,-1.7,.65,1.8,.65,'#ba8d72',g);box(-1.7,h+1.9,-1.7,.85,.18,.85,trim,g);
    // Every elevation gets proper windows, so orbiting reveals homes too.
    for(const side of [-1,1])for(const y of [4.3,6.9])for(const x of [-1.3,1.3]){
      box(x,y,side*3.065,1.5,1.85,.14,trim,g);box(x,y,side*3.15,1.23,1.57,.06,glass,g);
      box(x,y,side*3.2,.07,1.6,.05,trim,g);box(x,y,side*3.2,1.25,.07,.05,trim,g);
      box(x,y-.98,side*3.17,1.8,.16,.3,trim,g);
      for(const dx of [-.94,.94])box(x+dx,y,side*3.12,.32,1.7,.12,i%2?'#526f71':'#738879',g);
    }
    // Side windows punctuate the exposed ends of the terrace blocks.
    for(const side of [-1,1])for(const y of [1.6,4.3,6.9]){
      box(side*2.77,y,0,.1,1.7,1.35,trim,g);box(side*2.84,y,0,.05,1.43,1.08,glass,g);box(side*2.88,y,0,.03,1.43,.06,trim,g);
    }
    box(.95,1.35,3.08,1.28,2.35,.18,'#f2dfba',g);box(.95,1.28,3.2,1.04,2.15,.1,i%2?'#496b69':'#805d50',g);
    box(.95,1.83,3.27,.65,.62,.035,glass,g);orb(1.31,1.1,3.3,.055,'#e1bd76',g);
    box(.95,.15,3.37,1.7,.25,.52,'#c6b79c',g);
    label(String(i+1).padStart(2,'0'),1.94,1.9,3.16,.43,.25,'#496760',g);
    if(b.shop){
      box(-1.24,1.35,3.1,1.95,2.15,.12,trim,g);box(-1.24,1.35,3.18,1.7,1.9,.08,glass,g);
      label(b.shop==='grocer'?'NELL’S CORNER':'THE WASHHOUSE',0,2.95,3.25,5.05,.52,b.shop==='grocer'?'#517c65':'#64878f',g);
      for(let k=0;k<10;k++){const a=box(-2.43+k*.54,2.55,3.75,.54,.13,1.35,k%2?trim:b.shop==='grocer'?'#638976':'#789ba3',g);a.rotation.x=.15;box(-2.43+k*.54,2.38,4.39,.54,.32,.07,k%2?trim:b.shop==='grocer'?'#638976':'#789ba3',g);}
      if(b.shop==='grocer')for(let j=0;j<2;j++){box(-1.9+j*.9,.47,3.9,.8,.75,.7,'#9a7957',g);for(let k=0;k<6;k++)orb(-2.15+j*.9+k%3*.24,.92,3.7+Math.floor(k/3)*.25,.14,j?'#e9bc59':'#c87d66',g);}
      else for(const x of [-1.8,-.65]){const rim=new THREE.Mesh(new THREE.TorusGeometry(.38,.075,8,24),toonMaterial('#ede1c3'));rim.position.set(x,1.02,3.25);g.add(rim);}
    }else{
      box(-1.25,1.5,3.1,1.65,1.65,.13,trim,g);box(-1.25,1.5,3.19,1.38,1.38,.08,glass,g);box(-1.25,1.5,3.25,.07,1.4,.06,trim,g);
      planter(-1.3,3.42,1.7,g,.52);
    }
    // Rear entrances and pocket gardens give the outward-facing row life too.
    box(.95,1.3,-3.08,1.2,2.4,.13,trim,g);box(.95,1.25,-3.17,.96,2.2,.07,'#698478',g);
    box(.95,1.82,-3.23,.64,.65,.04,glass,g);
    box(-1.25,1.55,-3.08,1.65,1.7,.12,trim,g);box(-1.25,1.55,-3.16,1.4,1.45,.06,glass,g);
    box(-1.25,1.55,-3.21,.06,1.45,.04,trim,g);
    if(i>=5){
      box(0,.12,-4.6,5.5,.16,2.8,'#b9ba88',g);box(.95,.22,-4.5,1.3,.08,2.8,'#d8c6a6',g);
      for(const x of [-2.65,2.65]){box(x,.52,-4.5,.1,.08,2.8,'#cabb99',g);for(let n=0;n<5;n++)box(x,.38,-3.4-n*.55,.1,.7,.1,'#cabb99',g);}
      planter(-1.4,-5.5,1.9,g);asset('cv-plant-potted',-1.4,-3.7,.65,0,g,.15);
    }
    // A balcony, iron rail and planter gives each household a little outside.
    box(0,3.2,3.55,4.55,.18,1.15,trim,g);box(0,4,4.05,4.6,.08,.08,'#435a55',g);
    for(let n=0;n<12;n++)box(-2.2+n*.4,3.6,4.05,.055,.8,.055,'#435a55',g);
    for(const x of [-2.25,2.25])box(x,4,3.55,.07,.07,1.05,'#435a55',g);
    planter(-1.4,4.08,1.4,g,3.6);
    box(1.3,3.55,3.6,.6,.12,.6,'#ab845d',g);box(1.3,3.95,3.35,.6,.7,.08,'#ab845d',g);
    selectables.push({type:'building',data:b,bounds:new THREE.Box3(new THREE.Vector3(b.box.min[0],0,b.box.min[1]),new THREE.Vector3(b.box.max[0],h+2,b.box.max[1]))});
  }
  // Small shared gardens leave the north/south doorstep paths clear.
  for(const [x,z] of [[-69,-55.8],[-57,-55.8],[-51,-48],[-75.8,-48]]){
    box(x,.38,z,2,.65,1.25,'#b89973');box(x,.73,z,1.8,.06,1.08,'#756446');
    for(let n=0;n<5;n++){orb(x-.65+n*.32,1,z,.3,'#719761');orb(x-.65+n*.32,1.25,z,.12,n%2?'#e3bb5b':'#cb8a77');}
  }
  for(const [x,z] of [[-77.2,-57],[-44.6,-56],[-44.6,-46],[-76.9,-36.8],[-45,-36.8]])asset('cv-tree-fruit',x,z,.67);
  for(const [x,z,rot] of [[-64,-55.8,0],[-57,-48,Math.PI]])asset('cv-bench',x,z,.82,rot);
  asset('cv-flower-cart',-45,-50,.62,Math.PI/2);
  asset('cv-plant-potted',-59,-37,.8);asset('cv-notice-board',-58.8,-35.1,.8);
  // Washing occupies the west margin; the doorstep and through routes stay clear.
  for(const z of [-57.5,-53.8])box(-75.5,1.25,z,.1,2.5,.1,'#887658');
  line([[-75.5,2.4,-57.5],[-75.5,2.35,-55.6],[-75.5,2.4,-53.8]],'#756952');
  for(let n=0;n<4;n++){
    const cloth=box(-75.5,1.91,-57+n*.85,.65,.9,.035,['#f0e3bd','#9aafbc','#dca395','#d9c27e'][n],moving);
    cloth.rotation.y=Math.PI/2;washing.push(cloth);
  }
  // Entry sign, book exchange, bicycle hoops and two residents' parked bikes.
  for(const x of [-63.5,-58.5])box(x,1.825,-34.6,.14,3.65,.14,'#7f7860');
  label('SUNBEAM TERRACE',-61,3.25,-34.5,5.8,.65);
  label('18 HOMES  ·  ONE LITTLE COURT',-61,2.7,-34.5,5.3,.36,'#9d8565');
  box(-59,1.25,-38.1,1.1,1.1,.6,'#bb8b64');box(-59,1.25,-37.78,.85,.85,.03,'#51665b');
  for(let n=0;n<6;n++)box(-59.35+n*.14,1.17,-37.73,.1,.5+n%2*.14,.16,['#dcbe77','#b58175','#7d9e99'][n%3]);
  box(-59,.5,-38.1,.15,1,.15,'#8d795d');box(-59,1.87,-38.1,1.35,.18,.8,'#607c71');label('TAKE A BOOK',-59,1.73,-37.74,1,.19);
  const bike=(x,z,color)=>{const g=new THREE.Group();g.position.set(x,.12,z);g.rotation.y=.3;root.add(g);
    for(const wx of [-.65,.65]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.42,.05,6,24),toonMaterial('#485d57'));wheel.position.set(wx,.48,0);g.add(wheel);}
    line([[-.65,.48,0],[-.2,1.05,0],[.1,.48,0],[-.65,.48,0],[-.15,1.05,0],[.5,1.05,0],[.1,.48,0]],color,g);
    line([[.65,.48,0],[.45,1.25,0],[.7,1.3,0]],color,g);box(-.2,1.12,0,.4,.09,.2,'#685e4d',g);
  };bike(-65,-46.3,'#b37d5f');bike(-47,-57.4,'#789ba3');
  // Chalk hopscotch and a spinning pinwheel are the court's little landmarks.
  for(let n=0;n<7;n++){const x=-66+(n===3?-.45:n===4?.45:0),z=-50+n*.56;line([[x-.35,.225,z-.25],[x+.35,.225,z-.25],[x+.35,.225,z+.25],[x-.35,.225,z+.25],[x-.35,.225,z-.25]],'#fff0cb');}
  const pinwheel=new THREE.Group();pinwheel.position.set(-69,1.9,-55.8);moving.add(pinwheel);box(-69,1,-55.8,.055,2,.055,'#c6ac7a');
  for(let n=0;n<4;n++){const petal=box(0,.24,0,.26,.5,.035,['#ca8e77','#e5c16c','#7ca29a','#a6b1c1'][n],pinwheel);petal.rotation.z=n*Math.PI/2;petal.position.set(Math.sin(n*Math.PI/2)*.24,Math.cos(n*Math.PI/2)*.24,0);}
  for(const [x,z]of [[-76,-51],[-46,-53],[-63,-36]]){asset('cv-streetlamp',x,z,.9);const glow=new THREE.PointLight('#ffce87',0,10,1.5);glow.position.set(x,2.8,z);scene.add(glow);lights.push(glow);}
  const localSpots=[['elder',-63.2,-55,.97],['merchant',-62,-54.8,1],['child',-66,-49,.95],['farmhand',-69,-54.8,1],['innkeeper',-74.5,-55.9,1],['child',-64.7,-48.1,.85]];
  localSpots.forEach(([role,x,z,scale],n)=>jobs.push(place('townsfolk-'+role,{x,z,scale}).then(o=>{o.position.y=.22;moving.add(o);neighbours.push({o,n,x,z});})));
  // Repeated geometry is instanced, including the private kit's toon outlines.
  await Promise.all(jobs);root.updateMatrixWorld(true);const batches=new Map();
  root.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+o.material.uuid;if(!batches.has(key))batches.set(key,{o,matrices:[]});batches.get(key).matrices.push(o.matrixWorld.clone());});
  for(const {o,matrices}of batches.values()){const m=new THREE.InstancedMesh(o.geometry,o.material,matrices.length);matrices.forEach((matrix,i)=>m.setMatrixAt(i,matrix));m.castShadow=o.castShadow;m.receiveShadow=o.receiveShadow;scene.add(m);}
  root.traverse(o=>{if(o.isLine){const copy=o.clone();copy.applyMatrix4(o.parent.matrixWorld);scene.add(copy);}});
  neighbours.sort((a,b)=>a.n-b.n);
  return {selectables,stats:{homes:18,buildings:9,shops:2,courtyardNeighbours:6},
    audit:()=>({neighbours:neighbours.map(({o})=>({position:o.position.toArray(),rotation:o.rotation.y,visible:o.visible})),washing:washing.map(m=>m.rotation.x),pinwheel:pinwheel.rotation.z}),
    update(t,hour,night){
      glass.color.set('#6c9399').lerp(new THREE.Color('#f4c477'),night);glass.emissive.set('#e9aa58');glass.emissiveIntensity=night*.65;lights.forEach(l=>l.intensity=night*5);
      washing.forEach((m,n)=>{m.rotation.x=Math.sin(t*1.6+n*.7)*.16;m.rotation.z=Math.sin(t+n)*.03;});pinwheel.rotation.z=-t*.75;
      neighbours.forEach(({o,n,x,z})=>{
        o.visible=hour>=7&&hour<21;
        const hopping=n===2||n===5,phase=t*(n===2?.65:.48)+n;
        o.position.set(x,.22+(hopping?Math.max(0,Math.sin(t*4+n))*.25:Math.sin(t*1.7+n)*.012),hopping?z+Math.sin(phase)*1.15:z);
        o.rotation.y=n<2?(n===0?Math.PI/2:-Math.PI/2):n===3?Math.PI:n===4?-Math.PI/2:Math.cos(phase)>0?0:Math.PI;
        o.rotation.z=Math.sin(t*(hopping?4:1.5)+n)*.035;
      });
    }};
}
