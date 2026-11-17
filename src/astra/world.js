import {buildLandscape} from './landscape.js';
import {buildWater} from './water.js';
import { tagObject, tagComponents, tagBatch, buildAssembly } from './registry/render-tags.js';
import {buildExpansions} from './expansions.js';
import { buildPlacedDistrict } from './placed-district.js';
import * as THREE from 'three';
import { place, RESOLVED } from '../catalog/loader.js';
import { toonMaterial } from '../toon.js';
import { riverZ, distanceToSegment } from '../compiler/astra.js';
import { buildCivicQuarter } from './civic-quarter.js';
import { buildSunbeam } from './sunbeam.js';
import { buildDistricts } from './districts.js';
import { buildCatalogScenes } from './catalog-scenes.js';
import { buildWorkDistrict } from './work-district.js';
import { makeRng } from '../compiler/rng.js';
export async function buildAstra(scene,town){
 const rng=makeRng(town.seed+100),random=()=>rng.float();
 const nightUniform={value:0},windowMaterials=new Map();
 const glowCanvas=document.createElement('canvas');glowCanvas.width=64;glowCanvas.height=64;const gc=glowCanvas.getContext('2d'),gradient=gc.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,220,130,.8)');gradient.addColorStop(.4,'rgba(255,215,120,.35)');gradient.addColorStop(1,'rgba(255,215,120,0)');gc.fillStyle=gradient;gc.fillRect(0,0,64,64);const glowTexture=new THREE.CanvasTexture(glowCanvas);
 const statics=new THREE.Group(),animations={smoke:[],water:[],animals:[],lamps:[],flags:[],mills:[]},selectables=[];
 let assembly='built:island';
 const mat=c=>toonMaterial(c);
 const mesh=(geo,color,x=0,y=0,z=0,parent=statics)=>{const m=new THREE.Mesh(geo,mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);tagObject(m,parent.userData.registryId||assembly);return m;};
 const cubeGeo=new THREE.BoxGeometry(1,1,1),ballGeo=new THREE.IcosahedronGeometry(1,1);
 const box=(x,y,z,w,h,d,c,parent)=>{const m=mesh(cubeGeo,c,x,y,z,parent);m.scale.set(w,h,d);return m;};
 const sphere=(x,y,z,r,c,parent)=>{const m=mesh(ballGeo,c,x,y,z,parent);m.scale.setScalar(r);return m;};
 const asset=async(id,x,z,rot=0,scale=1,parent=statics,registryId)=>{const o=await place(id,{x,z,rotY:rot,scale});parent.add(o);if(registryId)tagObject(o,registryId);return o;};
 // The town grows in districts, with a cut-in northwest edge instead of
 // a large unused rectangular meadow. The compiler owns this same outline.
 const shape=new THREE.Shape(),corners=town.outline,r=3;
 corners.forEach((p,n)=>{const prev=corners[(n+corners.length-1)%corners.length],next=corners[(n+1)%corners.length],a=Math.hypot(prev[0]-p[0],prev[1]-p[1]),b=Math.hypot(next[0]-p[0],next[1]-p[1]),start=[p[0]+(prev[0]-p[0])/a*r,p[1]+(prev[1]-p[1])/a*r],end=[p[0]+(next[0]-p[0])/b*r,p[1]+(next[1]-p[1])/b*r];if(!n)shape.moveTo(...start);else shape.lineTo(...start);shape.quadraticCurveTo(...p,...end);});shape.closePath();
 const land=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:2.5,bevelEnabled:false,curveSegments:10}),[mat('#a8bc7d'),mat('#b3a083')]);land.rotation.x=Math.PI/2;land.position.y=-.02;land.receiveShadow=true;scene.add(tagObject(land,'built:island'));
 const lower=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:false,curveSegments:10}),mat('#8c8770'));lower.rotation.x=Math.PI/2;lower.position.y=-2.4;lower.scale.set(.998,.998,1);scene.add(tagObject(lower,'built:island'));
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.ShadowMaterial({opacity:.1}));floor.rotation.x=-Math.PI/2;floor.position.y=-3;floor.receiveShadow=true;scene.add(tagObject(floor,'built:island'));
 // The whole river system (falls, reaches, deltas, footbridges) is drawn
 // from town.water; the original trunk shimmer below keeps its seeded order.
 assembly='built:river';const water=buildWater(scene,town);
 for(let n=0;n<60;n++){const x=-38+random()*102,z=riverZ(x)+(random()-.5)*4;const m=box(x,.065,z,.35+random()*1.2,.015,.035,'#b7d7cf',scene);m.castShadow=false;animations.water.push({m,x,z,phase:random()*6,width:m.scale.x});}
 // Continuous soft lanes with rounded joins, plus an inset market square.
 const circleGeo=new THREE.CylinderGeometry(1,1,.06,12);
 for(const region of town.regions||[])if(region.ground){assembly=town.districts.find(d=>d.id===region.id).registryId;const b=region.bounds;box((b.minX+b.maxX)/2,-1.28,(b.minZ+b.maxZ)/2,b.maxX-b.minX+3,2.5,b.maxZ-b.minZ+3,'#a8bc7d');}
 for(const r of town.roads){assembly=r.registryId;if(r.kind==='world-link')continue;if(r.external==='coral-coast'&&Math.min(r.a[0],r.b[0])<225)continue;if(r.external&&r.kind!=='catalog'&&!['fair','skatepark','coral-coast'].includes(r.external))continue;
 const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],len=Math.hypot(dx,dz);if(len<.01)continue;
  const m=box((r.a[0]+r.b[0])/2,.07,(r.a[1]+r.b[1])/2,r.width,.09,len,r.kind==='avenue'?'#87958b':'#d9c9a4');m.rotation.y=Math.atan2(dx,dz);
  for(const p of [r.a,r.b]){const c=mesh(circleGeo,r.kind==='avenue'?'#87958b':'#d9c9a4',p[0],.07,p[1]);c.scale.set(r.width/2,1,r.width/2);}
 }
 assembly='built:market-paving';box(1,.085,3.5,16,.07,10.5,'#c6bea1');box(1,.13,3.5,15.5,.06,10,'#ded4b6');
 // Sparse small cobbles leave the broad paving calm at overview scale.
 for(let i=0;i<100;i++){const x=-6.5+random()*15,z=-1.2+random()*9.5;box(x,.17,z,.25+random()*.23,.025,.18+random()*.17,i%2?'#c9bea1':'#ece1c4');}
 for(const [bridgeIndex,x] of town.bridges.entries()){assembly=`built:bridge-${bridgeIndex}`;const z=riverZ(x);box(x,.24,z,3.3,.3,7.4,'#bca681');for(let k=0;k<18;k++)box(x,.43,z-3.5+k*.4,3.1,.09,.34,'#cbb592');for(const side of [-1,1]){for(let k=0;k<5;k++)box(x+side*1.48,1,z-3.4+k*1.7,.16,1.4,.16,'#a18b6e');box(x+side*1.48,1.54,z,.14,.17,7.3,'#bba17b');box(x+side*1.48,.91,z,.1,.12,7.3,'#bba17b');}}
 const landscape=await buildLandscape(scene,town);
 const expansions=await buildExpansions(scene,town);selectables.push(...expansions.selectables);
 const civicQuarter=await buildAssembly(buildCivicQuarter,scene,town,'civic-green');selectables.push(...civicQuarter.venueRecords);
 const districts=await buildAssembly(buildDistricts,scene,town,'common');selectables.push(...districts.venueRecords.filter(v=>!['civic-green','works','themepark','coral-coast'].includes(v.data.district)));
 const works=await buildPlacedDistrict(buildWorkDistrict,scene,town,'works');selectables.push(...works.records);
 const sunbeam=await buildPlacedDistrict(buildSunbeam,scene,town,'sunbeam');selectables.push(...sunbeam.selectables);
 const catalogActivities=await buildCatalogScenes(scene,town,{residentsOwnSlots:true});
 const loads=[];
 for(const b of town.buildings.filter(b=>!b.custom)){loads.push(asset(b.id,...b.pos,b.rot,1,statics,b.registryId).then(o=>{o.traverse(m=>{if(!m.isMesh||m.userData.outline||!m.material.vertexColors)return;const original=m.material;if(!windowMaterials.has(original)){const material=original.clone();material.onBeforeCompile=shader=>{shader.uniforms.uAstraNight=nightUniform;shader.fragmentShader='uniform float uAstraNight;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\nif(vColor.b>vColor.r*1.08 && vColor.g>vColor.r*1.08 && vColor.b>.25){totalEmissiveRadiance+=vec3(1.0,.48,.09)*uAstraNight*.9;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.4,.1),uAstraNight); }\n#endif');};material.customProgramCacheKey=()=> 'astra-windows';windowMaterials.set(original,material);}m.material=windowMaterials.get(original);});o.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(o);selectables.push({type:'building',data:b,bounds,object:o});}));}
 for(const p of [...town.props,...town.trees])loads.push(asset(p.id,...p.pos,p.rot,p.scale,statics,p.registryId));
 for(const g of town.gardens){assembly=g.registryId;box(g.x,.075,g.z,g.width,.13,g.depth,'#917851');for(const x of [-1,1])box(g.x+x*g.width/2,.19,g.z,.12,.22,g.depth+.2,'#c6b591');for(const z of [-1,1])box(g.x,.19,g.z+z*g.depth/2,g.width,.22,.12,'#c6b591');for(let n=0;n<12;n++){const x=g.x+(n%2-.5)*.75,z=g.z+(Math.floor(n/2)-2.5)*.62;sphere(x,.3,z,.21,'#6d914d');sphere(x,.45,z,.1,n%3?'#ebbf76':'#d79899');}}
 for(const p of town.props.filter(p=>p.id==='cv-market-stall'))for(let n=0;n<12;n++)tagObject(sphere(p.pos[0]-.65+(n%4)*.4,1.03+Math.floor(n/4)*.035,p.pos[1]+.2+Math.floor(n/4)*.15,.13,n%3?'#d8a75d':'#ae674e'),`built:produce-${town.props.indexOf(p)}`);
 // Fences run along the rear of lots, never across the door corridor.
 for(const p of town.supplemental.filter(p=>/fence|laundry/.test(p.key)))loads.push(asset(p.asset,...p.pos,p.rot,p.scale,statics,p.registryId));
 // Riverbank reeds, wildflowers and rocks obey the reserved approach lanes.
 assembly='built:river-reeds';
 for(let i=0;i<145;i++){const x=-36+random()*99,side=i%2?1:-1,z=riverZ(x)+side*(3.2+random()*.6);if(town.bridges.some(b=>Math.abs(x-b)<2.6))continue;for(let j=0;j<3;j++){const m=box(x+j*.16,.25+random()*.12,z,.055,.5+random()*.25,.055,'#789763');m.rotation.z=(random()-.5)*.4;}}
 assembly='built:wildflowers';
 for(let i=0;i<170;i++){const x=(random()-.5)*73,z=(random()-.5)*61;if(town.venues.some(v=>x>v.box.min[0]&&x<v.box.max[0]&&z>v.box.min[1]&&z<v.box.max[1])||Math.abs(z-riverZ(x))<4||town.roads.some(r=>distanceToSegment([x,z],r.a,r.b)<r.width/2+.6)||town.buildings.some(b=>x>b.box.min[0]-1&&x<b.box.max[0]+1&&z>b.box.min[1]-1&&z<b.box.max[1]+1))continue;const flower=i%4===0;sphere(x,.12,z,flower?.12:.09,flower?(i%3?'#f0dfae':'#d59b97'):'#8da865');if(flower)for(let j=0;j<3;j++)sphere(x+.2*(j-1),.13,z+.23,.07,'#f4e5bd');}
 for(const p of town.supplemental.filter(p=>p.key.startsWith('bank-rock')))loads.push(asset(p.asset,...p.pos,random()*6,.4+random()*.3,statics,p.registryId));
 // The mill's canvas sails turn slowly above the roof line.
 const mill=town.buildings.find(b=>b.id==='cv-windmill');
 assembly='built:mill-sails';
 if(mill){const rotor=new THREE.Group();rotor.position.set(mill.pos[0],6.3,mill.pos[1]+2.6);scene.add(rotor);sphere(0,0,0,.35,'#857253',rotor);for(let n=0;n<4;n++){const blade=new THREE.Group();blade.rotation.z=n*Math.PI/2;rotor.add(blade);box(0,1.7,0,.13,.12+3.4,.15,'#897357',blade);box(.42,2,0,.68,2.1,.06,'#e4d5ab',blade);for(let j=0;j<5;j++)box(.42,1.1+j*.46,.05,.8,.045,.06,'#a99068',blade);}animations.mills.push(rotor);}
 // Market bunting is light geometry; each pennant can stir independently.
 assembly='built:market-bunting';for(const z of [-.8,8.5]){for(const x of [-7.2,9])box(x,2.25,z,.12,4.5,.12,'#947a58');const pts=[];for(let n=0;n<=30;n++){const t=n/30;pts.push(new THREE.Vector3(-7.2+t*16.2,4.4-Math.sin(t*Math.PI)*.8,z));}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#7e795e'}));statics.add(tagObject(line,assembly));for(let n=1;n<20;n++){const t=n/20,x=-7.2+t*16.2,y=4.4-Math.sin(t*Math.PI)*.8;const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-.25,0,0,.25,0,0,0,-.55,0],3));geo.computeVertexNormals();const m=mesh(geo,['#c77c62','#edd29a','#7a9e92'][n%3],x,y,z,scene);m.material=m.material.clone();m.material.side=THREE.DoubleSide;animations.flags.push(m);}}
 for(const b of town.buildings.filter((b,i)=>!b.custom&&i%3===0&&b.pos[1]<0)){assembly=`built:${b.key}-smoke`;const height=RESOLVED.get(b.id).bounds.max[1];for(let n=0;n<4;n++){const m=sphere(b.pos[0]+.6,height+1,b.pos[1],.3,'#e4e5d5',scene);m.material=new THREE.MeshBasicMaterial({color:'#edf0df',transparent:true,opacity:.3,depthWrite:false});m.castShadow=false;animations.smoke.push({m,x:b.pos[0]+.6,z:b.pos[1],y:height-.6,phase:n/4});}}
 for(const p of town.props.filter(p=>p.id==='cv-streetlamp')){assembly=`built:lamp-${town.props.indexOf(p)}`;const m=sphere(p.pos[0],2.55,p.pos[1],.17,'#ffe4a6',scene);m.material=new THREE.MeshBasicMaterial({color:'#ffe4a6'});animations.lamps.push(m);const glow=new THREE.Mesh(new THREE.CircleGeometry(2.6,24),new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,opacity:0,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.set(p.pos[0],.19,p.pos[1]);scene.add(tagObject(glow,assembly));animations.lamps.push(glow);}
 // Owned animals remain individually animated.
 for(const p of town.supplemental.filter(p=>/^(duck|chicken)-/.test(p.key))){const kind=p.asset==='farm-duck'?'duck':'chicken',n=Number(p.key.split('-').at(-1));loads.push(asset(p.asset,...p.pos,p.rot,p.scale,scene,p.registryId).then(o=>animations.animals.push({o,kind,n})));}
 await Promise.all(loads);
 // Instance reused kit meshes, including their toon hulls. These are private
 // models fetched at runtime; neither this module nor builds embed the assets.
 tagComponents(statics,town,'world');tagComponents(scene,town,'world');
 statics.updateMatrixWorld(true);const batches=new Map();statics.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+':'+o.material.uuid;if(!batches.has(key))batches.set(key,{source:o,matrices:[],ids:[]});batches.get(key).matrices.push(o.matrixWorld.clone());batches.get(key).ids.push(o.userData.registryId);});
 for(const {source,matrices,ids} of batches.values()){const m=new THREE.InstancedMesh(source.geometry,source.material,matrices.length);tagBatch(m,ids);matrices.forEach((v,i)=>m.setMatrixAt(i,v));m.castShadow=source.castShadow;m.receiveShadow=source.receiveShadow;scene.add(m);}
 // Lines aren't mesh instances.
 statics.traverse(o=>{if(o.isLine){const line=o.clone();line.applyMatrix4(o.parent.matrixWorld);scene.add(line);}});
 return {landscape,water,selectables,animations,expansions,districts,civicQuarter,works,sunbeam,catalogActivities,update(t,night,hour=10,people=[],day=4){landscape.update(t,hour,people);water.update(t);expansions.update(t,hour,night,day);catalogActivities.update(t);sunbeam.update(t,hour,night);works.update(t,hour,night,people);civicQuarter.update(t,hour,night);districts.update(t,hour,night,day);nightUniform.value=night;for(const rotor of animations.mills)rotor.rotation.z=-t*.18;for(const s of animations.smoke){const phase=(t*.12+s.phase)%1;s.m.position.set(s.x+phase*1.8,s.y+phase*4,s.z+phase*.5);s.m.scale.setScalar(.15+phase*.72);s.m.material.opacity=(1-phase)*.23;}for(const r of animations.water){r.m.position.x=r.x+Math.sin(t*.4+r.phase)*.4;r.m.scale.x=r.width*(.8+Math.sin(t+r.phase)*.25);}animations.flags.forEach((m,n)=>m.rotation.y=Math.sin(t*1.8+n)*.15);for(const a of animations.animals){if(a.kind==='duck'){const x=-13+Math.sin(t*.08)*13-a.n*.85;a.o.position.set(x,.05+Math.sin(t*2+a.n)*.025,riverZ(x)+Math.sin(t*.3-a.n*.3)*.4);a.o.rotation.y=Math.cos(t*.08)>0?Math.PI/2:-Math.PI/2;}else{const p=t*.3+a.n*2;a.o.position.set(18+Math.sin(p)*1.5,.05+Math.abs(Math.sin(t*5+a.n))*.04,29+Math.cos(p*.7));a.o.rotation.y=Math.atan2(Math.cos(p),-.7*Math.sin(p*.7));}}for(const m of animations.lamps){if(m.geometry.type==='CircleGeometry')m.material.opacity=night*.6;else m.visible=night>.2;}}};
}
