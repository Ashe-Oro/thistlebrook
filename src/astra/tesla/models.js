import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial, outlineMaterial } from '../../toon.js';
import { createLineupVehicle, lineupProportions, stageLamps } from './lineup-models.js';
import { createHy3dBody, fitToFootprint } from '../hy3d/index.js';
import manifest from '../hy3d/models.json' with { type: 'json' };
import { generatedLamps } from './generated-lamps.js';

export const TESLA_HY3D_SLUGS = Object.freeze({
  roadster: 'roadster-white', sedan: 'model-3', crossover: 'model-y',
  cybercab: 'cybercab', cybertruck: 'cybertruck', semi: 'semi',
  'model-s': 'model-s', 'model-x': 'model-x',
});

function newStyle(slug, name, color) {
  const [width, height, length] = manifest.models[slug].dims;
  return { name, color, width: width * .49, height: height * .49, length: length * .49 };
}

const CAR_LAMPS = {
  cybercab: {head: [.3, .325, 1.0], tail: [.28, .44, -.98]},
  cybertruck: {head: [.38, .555, 1.405], tail: [.38, .61, -1.405]},
  semi: {head: [.48, .64, 1.6], tail: [.3, .47, -1.765]},
  crossover: {head: [.33, .47, 1.07], tail: [.3, .54, -1.125]},
  sedan: {head: [.33, .35, 1.05], tail: [.32, .5, -1.095]},
  roadster: {head: [.25, .41, 1.165], tail: [.3, .42, -1.168]},
};

export function teslaLampSpots(kind, vehicle) {
  const base = kind === 'model-s' ? 'sedan' : kind === 'model-x' ? 'crossover' : kind;
  const lamps = CAR_LAMPS[base];
  const stretch = base === kind ? [1, 1, 1] : lineupProportions(kind, TESLA_STYLES[kind]).stretch;
  return Object.fromEntries(Object.entries(lamps).map(([lamp, [x, y, z]]) => [
    lamp, vehicle?.userData.lampSpots?.[lamp]?.length
      ? vehicle.userData.lampSpots[lamp]
      : [-1, 1].map(side => [side * x * stretch[0], y * stretch[1], z * stretch[2]]),
  ]));
}

// Original, logo-free toy proportions. +Z is forward; origin is the ground
// contact point. No asset loading, timers, scene ownership or traffic logic.
export const TESLA_STYLES = Object.freeze({
  sedan: { name: 'Model 3 look-alike', color: '#2f4f86', width: 1.19, length: 2.31, height: .78 },
  crossover: { name: 'Model Y look-alike', color: '#eceae3', width: 1.19, length: 2.35, height: 1.0 },
  cybercab: { name: 'Cybercab look-alike', color: '#d6b46e', width: 1.09, length: 2.06, height: .78 },
  cybertruck: { name: 'Cybertruck look-alike', color: '#b9c3c3', width: 1.25, length: 2.83, height: 1.0 },
  semi: { name: 'Tesla Semi look-alike', color: '#eeeadd', width: 1.41, length: 3.51, height: 1.96 },
  roadster: { name: 'White Roadster', color: '#f2f0e7', width: 1.1, length: 2.36, height: .77 },
  'model-s': newStyle('model-s', 'Model S', '#934047'),
  'model-x': newStyle('model-x', 'Model X', '#e5e9e9'),
});
const INK = '#283e43', GLASS = '#294f60', RIM = '#a6bac0';
const cube = new THREE.BoxGeometry(1, 1, 1);
const tire = new THREE.CylinderGeometry(.22, .22, .14, 12).rotateZ(Math.PI / 2);
const hub = new THREE.CylinderGeometry(.145, .145, .016, 10).rotateZ(Math.PI / 2);
const spoke = new THREE.BoxGeometry(.018, .24, .036);

// A faceted, chamfered cross-section swept along the length of a car.
function shell(rows) {
  const p = [], indices = [];
  for (const [z, w, bottom, top] of rows) {
    for (const [x, y] of [[-w*.82,bottom],[w*.82,bottom],[w,bottom+.07],[w,top-.06],[w*.82,top],[-w*.82,top],[-w,top-.06],[-w,bottom+.07]]) p.push(x,y,z);
  }
  for (let n=0; n<rows.length-1; n++) for(let k=0;k<8;k++) {
    const a=n*8+k,b=n*8+(k+1)%8,c=b+8,d=a+8;
    indices.push(a,b,c,a,c,d);
  }
  for(let k=1;k<7;k++){indices.push(0,k+1,k);const a=(rows.length-1)*8;indices.push(a,a+k,a+k+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
}
function pane(points) {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return g;
}

function roadsterWheels(spec) {
  const len = (spec.length - .04) / 2, x = spec.width / 2 - .11 - .005;
  return [-1, 1].flatMap(side => [-len * .64, len * .62].map(z => ({
    position: [side * x, .22, z], radius: .22,
  })));
}

function roadsterJets(body, owned, nozzles) {
  const jets = new THREE.Group(); body.add(jets); jets.visible = false;
  const material = new THREE.MeshBasicMaterial({ color: '#a7f1ed', transparent: true, opacity: .82, depthWrite: false });
  for (const x of [-.30, .30]) for (const z of [-.7, .65]) {
    if (nozzles) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .07, 8), toonMaterial(INK));
      nozzle.position.set(x, .22, z); body.add(nozzle); owned.push(nozzle.geometry);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.085, .55, 8), material);
    flame.rotation.z = Math.PI; flame.position.set(x, -.075, z); jets.add(flame); owned.push(flame.geometry);
  }
  owned.push(material);
  return jets;
}

function createGeneratedVehicle(kind, spec, scale, template) {
  const root = new THREE.Group(); root.name = spec.name; root.scale.setScalar(scale);
  const pivot = new THREE.Group(); pivot.position.y = .43; root.add(pivot);
  const body = new THREE.Group(); body.position.y = -.43; pivot.add(body);
  const roadster = kind === 'roadster';
  const { roof, wheels: wheelLayout } = roadster ? { roof: spec.height, wheels: roadsterWheels(spec) }
    : lineupProportions(kind, spec);
  const { scale: fit, offset } = fitToFootprint(template.dims, { ...spec, height: roof }, template.geometry.boundingBox);
  const model = createHy3dBody(template, fit, offset);
  model.children[1].material = outlineMaterial(template.outline.uniforms.uThickness.value / fit);
  // Sample in unscaled car-local coordinates before attaching the model.
  model.updateMatrixWorld(true);
  const lamps = generatedLamps(kind, model.children[0], template.dims, fit);
  const owned = [];
  const lampSpots = {};
  for (const [role, { geometry, material, spots }] of Object.entries(lamps)) {
    const light = new THREE.Mesh(geometry, material); light.userData.lamp = role;
    body.add(light); owned.push(geometry, material);
    lampSpots[role] = spots;
  }
  body.add(model);
  const wheels = wheelLayout.map(({ position }) => {
    const wheel = new THREE.Object3D(); wheel.visible = false;
    wheel.position.set(...position); body.add(wheel);
    return wheel;
  });
  const jets = roadster ? roadsterJets(body, owned, false) : new THREE.Group();
  if (!roadster) { body.add(jets); jets.visible = false; }
  root.userData = {
    kind, wheels, wheelRadius: wheelLayout[0].radius * scale, pivot, jets, lampSpots,
    hy3dSlug: template.slug,
    dimensions: { width: spec.width * scale, length: spec.length * scale, height: (roof + .03) * scale },
    animate({ distance = 0, braking = false, night = 0, stage = false, lift = 0, time = 0 } = {}) {
      wheels.forEach((wheel, index) => { wheel.rotation.x = distance / (wheelLayout[index].radius * scale); });
      stageLamps(lamps.head.material, lamps.tail.material, night, braking, stage);
      if (roadster) { jets.visible = lift > 0; jets.scale.y = lift * (.85 + .15 * Math.sin(time * 32)); }
    },
    dispose() { owned.forEach(resource => resource.dispose()); root.removeFromParent(); },
  };
  return root;
}

export function createTeslaVehicle(kind='sedan', { color, scale=1, hy3d }={}) {
  const spec=TESLA_STYLES[kind];if(!spec)throw Error(`Unknown electric vehicle style: ${kind}`);
  const template = hy3d?.get(TESLA_HY3D_SLUGS[kind]);
  if (template) return createGeneratedVehicle(kind, spec, scale, template);
  if(kind!=='roadster')return createLineupVehicle(kind,spec,{color,scale});
  const root=new THREE.Group();root.name=spec.name;root.scale.setScalar(scale);
  // Stunt rotations happen about the centre of mass, not the contact patch.
  const pivot=new THREE.Group();pivot.position.y=.43;root.add(pivot);
  const body=new THREE.Group();body.position.y=-.43;pivot.add(body);
  const batches=new Map(),owned=[];
  const add=(geometry,c,outline=false)=>{
    const list=batches.get(c)||[];list.push(geometry);batches.set(c,list);
    if(outline){const m=new THREE.Mesh(geometry.clone(),outlineMaterial(.009));m.userData.outline=true;body.add(m);owned.push(m.geometry);}
  };
  const box=(x,y,z,w,h,d,c,rot=0)=>{const g=cube.clone().scale(w,h,d).rotateX(rot).translate(x,y,z);add(g,c);};
  const strut=(a,b,c)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);const g=cube.clone().scale(.025,direction.length(),.025);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());add(g,c);};
  const paint=color||spec.color,truck=kind==='cybertruck',cab=kind==='cybercab',sport=kind==='roadster';
  const len=(spec.length-.04)/2,w=spec.width/2-.11;
  const rows=truck?
    [[-len,w*.9,.25,.56],[-.65,w,.24,.7],[.25,w,.24,.67],[len,w*.87,.27,.52]]:
    [[-len,w*.79,.27,.45],[-len*.72,w,.23,sport?.48:.58],[len*.52,w,.24,sport?.44:.54],[len,w*.77,.28,.4]];
  add(shell(rows),paint,true);
  box(0,.27,0,w*1.85,.09,len*1.82,INK);
  // The glass canopy tapers into both bonnet and rear deck.
  const roofY=spec.height,roofBack=truck?-.38: sport?-.25:-.32,roofFront=sport?.10:.1;
  const rearZ=truck?-.8:-.79,frontZ=truck?.86:sport?.51:.64;
  const baseY=sport?.43:.54,roofW=w*(cab?.73:.76),baseW=w*.9;
  add(pane([[-baseW,baseY,frontZ],[baseW,baseY,frontZ],[roofW,roofY,roofFront],[-roofW,roofY,roofFront]]),GLASS);
  add(pane([[baseW,baseY,rearZ],[-baseW,baseY,rearZ],[-roofW,roofY,roofBack],[roofW,roofY,roofBack]]),GLASS);
  add(pane([[-roofW,roofY,roofFront],[roofW,roofY,roofFront],[roofW,roofY,roofBack],[-roofW,roofY,roofBack]]),sport?INK:GLASS);
  for(const side of [-1,1]){
    // Side glass and fine body-coloured pillars; pane winding is corrected below.
    let points=[[side*baseW,baseY,rearZ],[side*baseW,baseY,frontZ],[side*roofW,roofY,roofFront],[side*roofW,roofY,roofBack]];
    if(side===1)points=points.reverse();add(pane(points),GLASS);
    // Belt rail, flush handles and understated side skirts.
    box(side*w*.94,baseY-.025,-.04,.035,.045,1.4,paint);
    box(side*(w+.008),.48,sport?-.18:-.07,.02,.025,.15,INK);
    box(side*(w+.008),.32,0,.025,.045,1.5,truck?INK:paint);
    strut([side*baseW,baseY,frontZ],[side*roofW,roofY,roofFront],paint);
    strut([side*baseW,baseY,rearZ],[side*roofW,roofY,roofBack],paint);
    if(!cab&&!sport)strut([side*baseW,baseY,-.16],[side*roofW,roofY,-.16],paint);
    // Cybercabs have smooth, mirror-free sides and gold aero wheel covers.
    if(!cab)box(side*(w+.045),baseY+.09,.48,.13,.07,.15,paint);
  }
  if(truck){
    box(0,.64,-.94,w*1.62,.04,.53,INK);
    for(let i=0;i<5;i++)box(0,.665,-1.12+i*.09,w*1.57,.012,.018,RIM);
    box(0,roofY+.005,-.14,roofW*2,.025,.48,paint);
  }else if(cab){
    box(0,roofY+.008,-.12,roofW*1.95,.025,.48,paint);
    box(0,.45,len+.005,w*1.6,.035,.02,'#eaf5d9');
  }else if(sport){
    box(0,.52,-1.0,w*1.88,.045,.16,INK);
    box(0,.535,-1.0,w*1.93,.025,.16,paint);
    for(const x of [-.22,.22])box(x,.73,-.28,.17,.055,.1,paint);
  }
  // Slim lamps, rear light bar, undercut front intake. No badges or logos.
  const light=new THREE.MeshBasicMaterial({color:'#f7f4d5'}),tail=new THREE.MeshBasicMaterial({color:'#fa7961'});
  const lightMesh=(x,y,z,width,material)=>{const m=new THREE.Mesh(cube.clone().scale(width,.035,.025),material);m.position.set(x,y,z);m.userData.lamp=material===tail?'tail':'head';body.add(m);owned.push(m.geometry);};
  if(truck)lightMesh(0,.49,len+.005,w*1.65,light);
  else for(const side of [-1,1])lightMesh(side*w*.57,.41,len+.005,w*.48,light);
  lightMesh(0,truck?.52:.42,-len-.008,w*1.55,tail);
  box(0,.32,len*.985,w*1.25,.065,.018,INK);
  // Merge static details per paint/glass colour; wheel animation stays separate.
  for(const [c,parts] of batches){const flat=parts.map(p=>{p.deleteAttribute('uv');if(p.index){const n=p.toNonIndexed();p.dispose();return n;}return p;});const g=mergeGeometries(flat);const m=new THREE.Mesh(g,toonMaterial(c));m.castShadow=true;m.receiveShadow=true;body.add(m);owned.push(g);flat.forEach(p=>p.dispose());}
  const wheels=[];
  for(const {position} of roadsterWheels(spec)){
    const side = Math.sign(position[0]);
    const wheel=new THREE.Group();wheel.position.set(...position);body.add(wheel);wheels.push(wheel);
    const rubber=new THREE.Mesh(tire,toonMaterial(INK));rubber.castShadow=true;wheel.add(rubber);
    const cap=new THREE.Mesh(hub,toonMaterial(cab?paint:RIM));cap.position.x=side*.078;wheel.add(cap);
    if(!cab)for(let k=0;k<3;k++){const blade=new THREE.Mesh(spoke,toonMaterial(INK));blade.position.x=side*.09;blade.rotation.x=k*Math.PI/3;wheel.add(blade);}
    else {const center=new THREE.Mesh(hub,toonMaterial('#aa874c'));center.scale.set(1,.32,.32);center.position.x=side*.09;wheel.add(center);}
  }
  if(sport)for(const z of [-.52,.48]){const g=new THREE.CylinderGeometry(.19,.19,.025,12);const fan=new THREE.Mesh(g,toonMaterial(INK));fan.position.set(0,.22,z);body.add(fan);owned.push(g);for(let i=0;i<4;i++){const blade=new THREE.Mesh(cube.clone().scale(.3,.012,.035).rotateY(i*Math.PI/4),toonMaterial(RIM));blade.position.set(0,.202,z);body.add(blade);owned.push(blade.geometry);}}
  const jets = roadsterJets(body, owned, true);
  root.userData={kind,wheels,wheelRadius:.22*scale,pivot,jets,dimensions:{width:spec.width*scale,length:spec.length*scale,height:(spec.height+.03)*scale},
    animate({distance=0,braking=false,night=0,lift=0,time=0,stage=false}={}){
      wheels.forEach(wheel=>wheel.rotation.x=distance/(.22*scale));
      stageLamps(light,tail,night,braking,stage);
      jets.visible=lift>0;jets.scale.y=lift*(.85+.15*Math.sin(time*32));
    },
    dispose(){owned.forEach(g=>g.dispose());light.dispose();tail.dispose();root.removeFromParent();},
  };
  return root;
}
