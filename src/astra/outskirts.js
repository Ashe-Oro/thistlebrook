import {createRigidBatches} from './rigid-batches.js';
import {batchStaticMeshes} from './static-batches.js';
import {bindMeshDetail,lodUrl} from './model-detail.js';
import {outskirtsLogPlacements} from './registry/seed-models.js';
import {tagDistrictModels} from './registry/district-models.js';
import * as THREE from 'three';
import {createGLTFLoader} from '../gltf-loader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {place} from '../catalog/loader.js';
import {toonMaterial,toonVertexColorMaterial,outlineMaterial,ensureNonZeroNormals} from '../toon.js';
import {makeRng} from '../compiler/rng.js';
import {distanceToSegment,pointInTown} from '../compiler/astra.js';
import {LAKE,inLake} from './outskirts-layout.js';
import {createOutskirtsLife} from './outskirts-life.js';
import BOUNDS from './outskirts-bounds.json';

// Uncatalogued Nature models are loaded privately and shared by every instance.
// No GLB bytes or copied materials live in the repository or production bundle.
const loader=createGLTFLoader(),models=new Map();
function natureModel(path){
 if(!models.has(path))models.set(path,loader.loadAsync(path).then(g=>{
  const meshes=[];g.scene.traverse(m=>{if(m.isMesh)meshes.push(m);});
  for(const m of meshes){m.material=m.geometry.attributes.color?toonVertexColorMaterial():toonMaterial(m.material.color);m.castShadow=m.receiveShadow=true;
   const hull=new THREE.BufferGeometry();hull.setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)hull.setIndex(m.geometry.index.clone());const smooth=mergeVertices(hull,.001);smooth.computeVertexNormals();ensureNonZeroNormals(smooth);ensureNonZeroNormals(m.geometry);const ink=new THREE.Mesh(smooth,outlineMaterial(.018));m.add(ink);
  }return g.scene;
 }));
 return models.get(path);
}
const meshes=object=>{const list=[];object.traverse(o=>{if(o.isMesh)list.push(o);});return list;};
async function nature(name,x,z,scale=1,rotation=0,detail){
 const path=import.meta.env.BASE_URL+`licensed/astra-outskirts/${name}.glb`,variant=detail&&lodUrl(path);
 const content=(await natureModel(variant||path)).clone(true);
 if(variant)meshes(content).forEach((mesh,i)=>bindMeshDetail(detail,[[x,z]],mesh,async()=>meshes(await natureModel(path))[i]?.geometry));
 const object=new THREE.Group();object.userData.ownedAsset='nature/'+name;object.userData.ownedPath='nature/'+name+'.glb';
 content.position.y=-BOUNDS[name].min[1];object.add(content);object.scale.setScalar(scale);object.position.set(x,.12,z);object.rotation.y=rotation;return object;
}
export async function buildOutskirts(scene,town,{detail}={}){
 const data=town.outskirts,root=new THREE.Group(),dynamic=new THREE.Group();dynamic.name='Stillwater life';scene.add(dynamic);
 const rng=makeRng(town.seed+921),random=()=>rng.float(),loads=[],water=[],lanterns=[],boats=[],fireflies=[];
 const boxGeo=new THREE.BoxGeometry(1,1,1),rockGeo=new THREE.IcosahedronGeometry(1,1),circleGeo=new THREE.CircleGeometry(1,64);
 const mesh=(geometry,color,x,y,z,parent=root)=>{const m=new THREE.Mesh(geometry,toonMaterial(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 const box=(x,y,z,w,h,d,c,parent=root)=>{const m=mesh(boxGeo,c,x,y,z,parent);m.scale.set(w,h,d);return m;};
 const rock=(x,y,z,sx,sy,sz,c)=>{const m=mesh(rockGeo,c,x,y,z);m.scale.set(sx,sy,sz);return m;};
 const disk=(x,z,rx,rz,color,y=.025)=>{const m=mesh(circleGeo,color,x,y,z);m.rotation.x=-Math.PI/2;m.scale.set(rx,rz,1);m.castShadow=false;return m;};
 const kit=(id,x,z,scale=1,rot=0)=>loads.push(place(id,{x,z,scale,rotY:rot}).then(o=>root.add(o)));
 const prop=(name,x,z,scale=1,rot=0)=>loads.push(nature(name,x,z,scale,rot,detail).then(o=>root.add(o)));
 function sign(title,subtitle,x,z,width=7){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const c=canvas.getContext('2d');c.fillStyle='#344f47';c.fillRect(0,0,768,192);c.strokeStyle='#b8c6a2';c.lineWidth=3;c.strokeRect(12,12,744,168);c.textAlign='center';c.fillStyle='#fff0c9';c.font='600 43px Georgia';c.fillText(title,384,86);c.fillStyle='#c4d3b2';c.font='22px sans-serif';c.fillText(subtitle,384,135);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}));plane.position.set(x,2.3,z);root.add(plane);for(const dx of [-width*.41,width*.41])box(x+dx,1.15,z,.13,2.3,.13,'#7e7154');
 }
 // Patches break up the old lawn into woodland floor, meadow and clearings.
 for(const [x,z,rx,rz]of [[-60,61,17,22],[-56,85,20,22],[-31,114,25,8],[29,91,15,11]])disk(x,z,rx,rz,'#96ab76');
 for(const c of data.clearings)disk(c.x,c.z,c.rx,c.rz,'#b7bf87',.035);
 disk(-13,102,18,9,'#bcc18d',.04);
 // A gently irregular shoreline uses the same conservative ellipse that
 // reserves the navigation graph and foliage, so the bank never blocks paths.
 if(!detail)buildStillwaterSurface(root);
 for(let i=0;i<62;i++){const x=LAKE.x+(random()-.5)*44,z=LAKE.z+(random()-.5)*34;if(!inLake([x,z],-2))continue;const m=box(x,.07,z,.4+random()*1.8,.012,.035,i%3?'#b0d4c9':'#88bdba',dynamic);m.castShadow=false;water.push({m,x,width:m.scale.x,phase:random()*6});}
 // The shore's cattails, stones, rock shelves, lily pads, mallards and heron
 // are Nature models planned with the landscape (src/compiler/nature-edges.js).
 // They replace the box reeds and blob rocks that used to ring the lake here.
 // Three cabinside clearings and a practical campsite, built from owned kits.
 prop('log_cabin',-43,60,1.5);prop('log_cabin',-43,78,1.5);
 prop('ranger_hut',20,45,1.25);prop('trailhead_sign',-26.5,43,1.2);
 sign('STILLWATER','LAKE LOOP  •  BIRCH HOLLOW  •  CAMPING',-23,38,8);
 sign('HINTERLAND FARM','GROWN HERE  /  SHARED IN TOWN',44,81,7);
 sign('THE CAMPGROUND','THREE LITTLE PITCHES BY THE WATER',-12,111,7);
 for(const [i,x]of [-24,-13,-2].entries()){
  prop('camp_tent',x,101,1.35,i===1?.14:-.08);prop('campsite_picnic_table',x-3.6,103,1.2,Math.PI/2);prop('bear_food_locker',x+2.7,100,.9);disk(x,101,3.8,3.3,'#c7bd94',.07);
 }
 prop('stone_ring_campfire',-12,94.5,1.55);prop('camp_tripod_kettle',-12,94.5,1.15);prop('woodland_privy',-31,102,1.1,Math.PI/2);
 for(const [x,z,r]of [[-15,95,1.2],[-9,95,-1.2],[-12,98,0],[-65,77,0]])kit('nat-log-bench',x,z,1.6,r);
 for(const [x,z]of [[-47,61],[-47,79],[-30,99]])kit('nat-split-firewood-pile',x,z,.7);
 for(const [x,z]of [[-40,63],[-40,81]]){prop('campsite_picnic_table',x,z,1.1);kit('cv-flower-bed',x-1,z,0.7);}
 // Deck boards span the one short route into the lake. The owned jetty adds
 // rail posts; its end is aligned with the angler's exact destination node.
 prop('dock_jetty',-10,51,1.65);box(-10,.29,52.4,2,.3,6.6,'#8e8268');
 for(let i=0;i<19;i++)box(-10,.46,49.2+i*.35,2.05,.075,.29,'#c0a77b');
 prop('canoe_paddle_rack',-6.8,49,1.25);
 loads.push(nature('canoe',-7.3,55.4,1.2,.2,detail).then(o=>{dynamic.add(o);boats.push(o);}));
 kit('nat-willow',-2,48,.7);kit('nat-granite-rock-cluster',10,88,.7);
 for(const [i,r]of data.roads.entries())if(i%3===0&&r.a[1]>42)prop('trail_marker_post',r.a[0]+1.4,r.a[1],1,Math.atan2(r.b[0]-r.a[0],r.b[1]-r.a[1]));
 // Field rows, turning headlands and open gateways make the farming legible.
 for(const field of data.fields){disk(field.x,field.z,field.w*.59,field.d*.65,'#acb77d',.04);box(field.x,.09,field.z,field.w,.12,field.d,field.crop==='wheat'?'#ab945c':'#927955');
  if(field.crop==='orchard'){
   for(let ix=0;ix<4;ix++)for(let iz=0;iz<2;iz++){kit('farm-apple-tree',field.x-7.5+ix*5,field.z-2.8+iz*5.6,.9);disk(field.x-7.5+ix*5,field.z-2.8+iz*5.6,1.3,1.3,'#a3ac70',.17);}
  }else for(let ix=0;ix<10;ix++){
   const x=field.x-field.w/2+1+ix*(field.w-2)/9;box(x,.18,field.z,.5,.11,field.d-1.2,'#796449');
   if(field.crop==='wheat')for(let iz=0;iz<20;iz++){const z=field.z-field.d/2+1+iz*(field.d-2)/19;box(x,.56,z,.65,.65,.14,iz%3?'#d5c37a':'#c7ad64');}
   else for(let iz=0;iz<12;iz++){const z=field.z-field.d/2+1+iz*(field.d-2)/11;rock(x,.38,z,.43,.33,.38,ix%3?'#73935d':'#a6af66');if(ix%3===0)rock(x,.55,z,.19,.16,.19,'#c68a50');}
  }
  for(const edge of [-1,1])for(let j=0;j<Math.floor(field.d/4);j++)kit('farm-rail-fence',field.x+edge*(field.w/2+.35),field.z-field.d/2+2+j*4,1,Math.PI/2);
 }
 kit('farm-big-red-barn',52,83,1,-Math.PI/2);kit('farm-grain-silo',57,79,.7);kit('farm-scarecrow',45,42,1.2);kit('farm-wheelbarrow',50,57,1.1,.4);kit('farm-produce-crates',46,86.5,1);kit('farm-produce-crates',10,109,1);kit('farm-hay-bale-round',57,89,1.15);kit('farm-hay-bale-round',54,90,1);kit('farm-windmill-pump',35,88,.9);
 for(const [x,z]of [[36,44],[39,44],[42,44],[45,44],[48,44],[51,44]])kit('farm-wheat-cluster',x,z,1);
 // Woodland density tapers into an irregular meadow edge, leaving open views
 // across the lake and every trail's full canopy clearance.
 for(const tree of data.trees)kit(tree.id,...tree.pos,tree.scale,tree.rot);
 for(let i=0;i<180;i++){const x=-74+random()*132,z=36+random()*85;if(!pointInTown([x,z],town)||inLake([x,z],3)||data.fields.some(f=>Math.abs(x-f.x)<f.w/2+2&&Math.abs(z-f.z)<f.d/2+2)||data.clearings.some(c=>((x-c.x)/c.rx)**2+((z-c.z)/c.rz)**2<1)||data.roads.some(r=>distanceToSegment([x,z],r.a,r.b)<2.2))continue;const c=i%5===0?'#eee0a6':i%7===0?'#bca1af':'#849e68';rock(x,.16,z,.14,.18,.14,c);if(i%4===0)rock(x+.4,.13,z+.2,.12,.15,.12,c);}
 for(const log of outskirtsLogPlacements(town.seed))kit(log.id,...log.pos,log.scale,log.rot);
 // A pair of deer browse within a clearing, away from foot traffic.
 const wildlife=[];for(let i=0;i<2;i++)loads.push(place('nat-deer',{x:-61+i*2.6,z:72+i*2,scale:.8,rotY:1.8}).then(o=>{dynamic.add(o);wildlife.push({o,x:o.position.x,z:o.position.z,phase:i*2});}));
 const glowMat=new THREE.MeshBasicMaterial({color:'#ffce7c'}),flame=mesh(new THREE.ConeGeometry(.33,1,7),'#f6b65d',-12,.85,94.5,dynamic);flame.material=glowMat;
 const fireLight=new THREE.PointLight('#ffd18a',0,11,1.6);fireLight.position.set(-12,1.6,94.5);dynamic.add(fireLight);
 const halo=new THREE.Mesh(new THREE.CircleGeometry(4,40),new THREE.MeshBasicMaterial({color:'#f7c878',transparent:true,opacity:0,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.set(-12,.14,94.5);dynamic.add(halo);
 for(const [x,z]of [[-43,63],[-43,81],[-24,103],[-13,103],[-2,103],[20,47]]){box(x+2,1.1,z,.1,2.2,.1,'#74694d');const bulb=mesh(rockGeo,'#ffda91',x+2,2.1,z,dynamic);bulb.scale.set(.14,.21,.14);bulb.material=glowMat;lanterns.push(bulb);}
 for(let i=0;i<18;i++){const m=new THREE.Mesh(rockGeo,new THREE.MeshBasicMaterial({color:'#e4e6a3'}));m.scale.setScalar(.055);dynamic.add(m);fireflies.push({m,x:-32+random()*43,z:91+random()*20,phase:random()*6});}
 await Promise.all(loads);tagDistrictModels(root,town,'outskirts',[0,0]);tagDistrictModels(dynamic,town,'outskirts');
 // All repeated geometry, including private kit hulls, uses shared instances.
 root.name='Stillwater scenery';
 const statics=batchStaticMeshes(root,scene,{cellSize:54});
 const life=await createOutskirtsLife(scene,town);
 const rigid=createRigidBatches(dynamic);
 const selectables=data.destinations.map(d=>({type:'outskirts',data:d,bounds:new THREE.Box3(new THREE.Vector3(d.pos[0]-2,0,d.pos[1]-2),new THREE.Vector3(d.pos[0]+2,d.height,d.pos[1]+2))}));
 // Buildings can be clicked on the roof as well as at their path endpoint.
 for(const [id,x,z,rx,rz,h]of [['cabin-1',-43,60,3.3,2.9,5.4],['cabin-2',-43,78,3.3,2.9,5.4],['farm',52,83,4.5,4.5,5.4],['ranger',20,45,2,2,4]]){const d=data.destinations.find(d=>d.id==='outskirts-'+id);selectables.push({type:'outskirts',data:d,bounds:new THREE.Box3(new THREE.Vector3(x-rx,0,z-rz),new THREE.Vector3(x+rx,h,z+rz))});}
 return {life,selectables,stats:{trees:data.trees.length,visitors:life.people.length,destinations:data.destinations.length,staticBatches:statics.children.length},update(t,night,hour){
  life.update(t,hour);for(const w of water){w.m.position.x=w.x+Math.sin(t*.35+w.phase)*.3;w.m.scale.x=w.width*(.85+Math.sin(t*.7+w.phase)*.15);}boats.forEach((b,i)=>{b.position.y=.05+Math.sin(t*.8+i)*.025;b.rotation.z=Math.sin(t*.55)*.025;});
  const lit=night>.18;flame.visible=lit;flame.scale.y=.8+Math.sin(t*8)*.12;fireLight.intensity=night*(8+Math.sin(t*7)*.6);halo.material.opacity=night*.2;lanterns.forEach(l=>l.visible=lit);fireflies.forEach(f=>{f.m.visible=lit;f.m.position.set(f.x+Math.sin(t*.4+f.phase),.8+Math.sin(t*.8+f.phase)*.4,f.z+Math.cos(t*.3+f.phase));});
  wildlife.forEach(a=>{a.o.position.set(a.x+Math.sin(t*.05+a.phase)*.8,.03,a.z+Math.cos(t*.07+a.phase)*.4);a.o.rotation.y=1.8+Math.sin(t*.2+a.phase)*.2;a.o.rotation.x=Math.sin(t*.5+a.phase)*.07;});
  rigid.update();
 },audit(){return {stats:this.stats,people:life.audit(),arrivals:[...life.arrivals],canoes:boats.map(b=>b.position.toArray()),wildlife:wildlife.map(a=>a.o.position.toArray())};}};
}

export function buildStillwaterSurface(root) {
 const mesh=(geometry,color,x,y,z)=>{
  const object=new THREE.Mesh(geometry,toonMaterial(color));
  object.position.set(x,y,z);
  object.receiveShadow=true;
  root.add(object);
  return object;
 };
 const lakeShape=(pad,color,y)=>{const shape=new THREE.Shape();for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,k=1+.022*Math.sin(a*5)+.015*Math.cos(a*7),x=LAKE.x+(LAKE.rx+pad)*Math.cos(a)*k,z=LAKE.z+(LAKE.rz+pad)*Math.sin(a)*k;if(i===0)shape.moveTo(x,z);else shape.lineTo(x,z);}shape.closePath();const m=mesh(new THREE.ShapeGeometry(shape),color,0,y,0);m.rotation.x=Math.PI/2;m.material=m.material.clone();m.material.side=THREE.DoubleSide;m.castShadow=false;return m;};
 // Surfaces sit at town.water.lake.level (0.04), a few mm above the inflow
 // and outflow ribbons that end two metres inside the shore.
 lakeShape(2.1,'#c8c49b',.005);lakeShape(.55,'#a3c8b5',.028);lakeShape(0,'#74b3b1',.043);lakeShape(-2.2,'#69a6ac',.047);
 return root;
}
