import {createRigidBatches} from './rigid-batches.js';
import {tagDistrictModels} from './registry/district-models.js';
import * as THREE from 'three';
import { QUAY_LAMPS } from './lamp-posts.js';
import { LAMP_LOOK } from './lamp-look.js';
import { createGLTFLoader } from '../gltf-loader.js';
import { place } from '../catalog/loader.js';
import { toonMaterial, toonVertexColorMaterial } from '../toon.js';
import { harborGeometry, batchHarbor } from './harbor-geometry.js';
import { createHarborLife } from './harbor-life.js';
import { buildWatercraft } from './watercraft.js';

// Saltwind's geometry and animation are deliberately independent of civic.js.
export async function buildHarbor(scene,town) {
  const root=new THREE.Group(),dynamic=new THREE.Group();dynamic.name='Saltwind Harbor';scene.add(dynamic);
  const {box,orb,cylinder,line,polygon,ring,label}=harborGeometry(root);
  const jobs=[],boats=[],ripples=[],buoys=[],lamps=[],gulls=[];
  const kit=(id,x,z,scale=1,rotY=0,y=0)=>jobs.push(place(id,{x,z,scale,rotY}).then(o=>{o.position.y=y;root.add(o);}));
  // The shared Gulf surrounds Saltwind's preserved quay and beach geometry.
  const shore=[[22,34],[65,34],[65,28],[87,28],[95,38],[95,52],[88,57],[69,53],[54,52],[44,59],[28,62],[21,55],[21,42]];
  polygon(shore,-.025,'#b1bd8b',root,2.3);
  polygon([[22,44],[47,44],[53,50],[50,54],[43,61],[29,65],[22,59],[19,53]],-.22,'#99c8c0');
  polygon([[23,44],[46,44],[50,49],[47,55],[42,59],[29,62],[22,56]],.015,'#e4d0a1',root,.3);
  polygon([[26,47],[43,47],[46,51],[42,56],[31,59],[25,54]],.025,'#efdeb5');
  // Harbor paving and boardwalk are broad enough for passing walkers.
  box(69,.02,38,51,.08,12,'#c8c1a0');
  const deck=(x,z,w,d)=>{
    box(x,-.03,z,w,.2,d,'#8d7558');
    const count=Math.ceil(d/.48);
    for(let n=0;n<count;n++)box(x,.105,z-d/2+(n+.5)*d/count,w,.07,d/count-.035,n%4===0?'#ba9b73':'#c8ad83');
  };
  deck(59,43,68,4.1);deck(70,57,3.8,28);deck(72.9,59,8,2.5);deck(67.4,69,9.2,2.7);
  for(let n=0;n<10;n++)for(const side of [-1,1]){
    const z=45+n*2.7;cylinder(70+side*1.65,-.3,z,.14,2.6,'#82775f');cylinder(70+side*1.65,1.02,z,.19,.13,'#e0c59c');
  }
  for(let x=26;x<=92;x+=3.3){
    cylinder(x,.4,45,.11,1,'#8a7960');if(x<33||x>39&&x<67||x>73)line([[x,.85,45],[x+1.65,.62,45],[x+3.3,.85,45]],'#e6cf9d');
  }
  // Quay wall with regularly spaced stone blocks and timber fenders.
  for(let x=53;x<88;x+=2.1){box(x,-.6,51,2,.9,1,'#a4ab99');box(x,-.02,51,2.1,.3,1.2,'#c6c7ae');}
  for(const [x,z] of [[68,48],[72,54],[68,63],[74,58.35],[64,69.95],[85,45]]){
    cylinder(x,.35,z,.22,.5,'#445d59');cylinder(x,.62,z,.32,.12,'#526b65');ring(x,.22,z,.46,.055,'#b69a6b');
  }
  // Fish market: a tiled roof, striped awning, cold counters and tiny silver catch.
  box(57,1.7,36.8,12,3.4,5.5,'#e6d5ad');box(57,.25,36.8,12.3,.4,5.7,'#9da99b');
  for(let x=51.3;x<63;x+=.65)box(x,1.8,39.6,.055,3.2,.055,'#c2ab87');
  for(const x of [52,62]){box(x,2,39.68,1.5,1.4,.1,'#567d79');box(x,2,39.76,.08,1.4,.08,'#e7d3a7');}
  for(const side of [-1,1]){const roof=box(57,3.95,36.8+side*1.45,13,.22,3.5,'#547d7c');roof.rotation.x=side*.42;}
  box(57,4.65,36.8,13,.18,.18,'#3e6666');
  label('SALTWIND  FISH MARKET',57,3.2,40.05,10.5,.85);
  for(let n=0;n<12;n++){
    const canopy=box(51.5+n,2.85,40.65,1,.1,2.4,n%2?'#f0dfb5':'#bf715b');canopy.rotation.x=.12;
    box(51.5+n,2.62,41.83,1,.35,.08,n%2?'#f0dfb5':'#bf715b');
  }
  for(const x of [51,63])cylinder(x,1.35,41.75,.07,2.7,'#706c54');
  for(const x of [53,60]){
    box(x,.65,40.8,3.3,1.1,1.3,'#74988d');box(x,1.26,40.8,3.55,.16,1.5,'#e4dcca');
    box(x,1.37,40.8,3.1,.1,1.1,'#a7c7c4');
    for(let n=0;n<7;n++){const f=orb(x-1.2+n*.4,1.49,40.8+(n%2?-.18:.16),.22,'#c8dadd');f.scale.set(.25,.1,.11);box(x-1.42+n*.4,1.49,40.8+(n%2?-.18:.16),.15,.06,.2,'#7a9ea3');}
    label(x<55?'TODAY’S CATCH':'FROM OUR BOATS',x,.8,41.48,2.8,.4);
  }
  // Two purpose-built boathouses, with their doors and apron off the promenade.
  for(const [x,c,name] of [[76.5,'#ad725d','THE NET LOFT'],[84,'#759589','BOATWORKS']]){
    box(x,2.1,35,6,4.2,7.2,c);box(x,.24,35,6.3,.4,7.5,'#a7aa92');
    for(let n=0;n<10;n++)box(x, .5+n*.36,38.64,6,.035,.04,'#dfc49d');
    for(const side of [-1,1]){const roof=box(x+side*1.65,4.7,35,3.8,.2,8,'#526c6b');roof.rotation.z=side*-.42;}
    box(x,5.45,35,.16,.15,8,'#354f52');
    box(x,1.48,38.72,3.5,2.8,.1,'#3f615b');
    for(const side of [-1,1]){box(x+side*.85,1.5,38.82,.08,2.7,.08,'#bda77e');const brace=box(x+side*.85,1.5,38.85,.07,2.9,.08,'#bda77e');brace.rotation.z=side*.56;}
    label(name,x,3.6,38.8,5,.58);
    box(x,4.65,38.9,1.2,.65,.1,'#cbbd95');box(x,4.65,38.98,.95,.45,.06,'#789b9a');
  }
  kit('cv-home-cottage',67.8,36,.72);
  kit('cv-hand-cart',63.4,39.2,.8,.5);
  for(const [x,z] of [[49,38],[65,39],[87.5,39],[78,40.2],[73,48],[66,67]])kit('cv-crate',x,z,.7,0,.15);
  for(const [x,z] of [[49,36],[88,37],[80.5,40],[67,48]])kit('cv-barrel',x,z,.65,0,.1);
  for(const [x,z] of [[28,41],[40,41],[88,41]])kit('cv-bench',x,z,.9,0,.1);
  for(const [x,z] of [[23,37],[29,36],[40,37],[91,31]])kit('cv-tree-pine',x,z,.72);
  for(const [x,z] of [[24,50],[43,57],[86,54],[96,51],[97,48],[93,56]])kit('cv-rock-stone-pile',x,z,.65);
  // Nets hang on a drying rack behind the working pier.
  for(const x of [54,62])cylinder(x,1.65,48,.075,3.3,'#8b775a');
  for(let n=0;n<=16;n++)line([[54+n*.5,3.1,48],[54+n*.5,.65+Math.sin(n*.35)*.2,48]],'#657f74');
  for(let n=0;n<8;n++)line([[54,.7+n*.34,48],[58,.5+n*.34,48],[62,.7+n*.34,48]],'#657f74');
  for(const [x,z] of [[74,48],[78,47],[86,46]]){ring(x,.25,z,.7,.08,'#ad956c');ring(x,.35,z,.6,.08,'#c5ae7e');}
  // Breakwater and the red-banded harbor light are visible from every district.
  for(let n=0;n<11;n++){const z=52+n*1.8,x=91-n*.28;const rock=orb(x,-.15,z,1.2,'#91a7a1');rock.scale.set(1.3,.7,1);}
  cylinder(91,.14,51,3.1,.4,'#c5c6b0',root,3.1,16);
  cylinder(91,4.9,51,1.9,9.4,'#f1e1bc',root,1.23,16);
  for(const y of [3.5,6.5]){const r=1.9-(y-.625-.2)*.67/9.4+.025;cylinder(91,y,51,r,1.25,'#bc735d',root,r-1.25*.67/9.4,16);}
  cylinder(91,9.55,51,2.05,.3,'#496967',root,2.05,16);
  const lantern=cylinder(91,10.35,51,1.2,1.4,'#7dabad',root,1.2,12);lantern.material=lantern.material.clone();
  for(let n=0;n<12;n++){const a=n/12*Math.PI*2;cylinder(91+Math.sin(a)*1.8,10.05,51+Math.cos(a)*1.8,.04,1,'#526f69');line([[91+Math.sin(a)*1.8,10.5,51+Math.cos(a)*1.8],[91+Math.sin(a+Math.PI/6)*1.8,10.5,51+Math.cos(a+Math.PI/6)*1.8]],'#526f69');}
  cylinder(91,11.35,51,1.6,1,'#b36655',root,0,12);cylinder(91,12.1,51,.06,.7,'#52665d');
  box(91,1.12,52.8,1.1,1.85,.12,'#3c6664');box(91,1.12,49.2,1.1,1.85,.12,'#3c6664');box(91,8,52.33,.55,.9,.1,'#557e7b');
  label('SALTWIND LIGHT',91,1.25,54.1,4,.5);
  const lamp=orb(91,10.4,51,.85,'#ffe2a0',dynamic);lamp.material=new THREE.MeshBasicMaterial({color:'#ffdf93'});
  const beacon=new THREE.Group();beacon.position.set(91,10.5,51);dynamic.add(beacon);
  const beamGeo=new THREE.ConeGeometry(4.5,31,24,1,true);beamGeo.rotateZ(Math.PI/2);beamGeo.translate(15.5,0,0);
  const beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color:'#ffe4ac',transparent:true,opacity:.11,side:THREE.DoubleSide,depthWrite:false}));beacon.add(beam);
  const beaconLight=new THREE.PointLight('#ffd397',0,22,1.6);beaconLight.position.set(91,10.5,51);dynamic.add(beaconLight);
  // Beach huts, deck chairs, umbrellas, a lifebuoy and a safe swimming boundary.
  for(let n=0;n<3;n++){
    const x=28+n*3.1,c=['#bd7d64','#719c98','#d2b46d'][n];
    box(x,1.2,47,2.3,2.4,2.3,c);box(x,1.1,48.18,1.15,1.95,.07,'#f1dfb3');
    for(const side of [-1,1]){const roof=box(x+side*.65,2.65,47,1.55,.13,2.7,'#557b77');roof.rotation.z=-side*.48;}
    label(String(n+1).padStart(2,'0'),x,1.9,48.25,.45,.35,c);
  }
  label('SHELL COVE',39,2.1,49,4.5,.7);for(const x of [37,41])cylinder(x,1.05,49,.06,2.1,'#958669');
  for(const [x,z,c] of [[28,55,'#b96d5e'],[41,52,'#60958f'],[39,56,'#d5af63']]){
    cylinder(x,1.2,z,.055,2.4,'#988266');
    const umbrella=new THREE.Mesh(new THREE.ConeGeometry(1.8,.65,8),toonMaterial(c));umbrella.position.set(x,2.55,z);root.add(umbrella);
    for(let n=0;n<8;n++){const a=n*Math.PI/4;line([[x,2.88,z],[x+Math.sin(a)*1.8,2.23,z+Math.cos(a)*1.8]],'#eddfbc');}
    const seat=box(x+.9,.55,z+1,1.1,.07,1.7,'#eee0b8');seat.rotation.x=-.35;
    for(const side of [-1,1])box(x+.9+side*.55,.3,z+1,.06,.6,1.8,'#a58f68');
    box(x-1,.07,z+.5,1.2,.04,2.1,c);
  }
  cylinder(44,1,50,.07,2,'#988061');ring(44,1.65,50,.5,.12,'#d3825d',root,true);
  for(let n=0;n<9;n++){const x=24+n*2.5,z=67+Math.sin(n/8*Math.PI)*2;const b=orb(x,-.3,z,.18,n%2?'#e5d4a6':'#bd7058',dynamic);buoys.push({o:b,x,z,n});}
  line(Array.from({length:17},(_,n)=>[24+n*1.25,-.3,67+Math.sin(n/16*Math.PI)*2]),'#b9cfbb');
  // Fishing cutters, with deckhouses, rigging, tires and their own mooring ropes.
  for(const [x,z,c,name] of [[77,66,'#b46d58','MARIGOLD'],[63,58,'#4b8185','WREN']]){
    const boat=new THREE.Group();boat.position.set(x,-.25,z);dynamic.add(boat);
    const hull=[[-1.5,-3],[1.5,-3],[1.65,1],[1.05,2.7],[0,3.6],[-1.05,2.7],[-1.65,1]];
    polygon(hull,.7,c,boat,1.1);polygon(hull.map(([a,b])=>[a*.94,b*.96]),.74,'#d6bd8c',boat);
    for(const side of [-1,1])box(side*1.5,1.05,-.7,.12,.65,4.6,c,boat);
    box(0,1.6,-1,2,1.7,2.5,'#ede0b7',boat);box(0,2.5,-1,2.3,.18,2.8,c,boat);
    box(0,1.95,.28,1.6,.65,.07,'#547e82',boat);for(const side of [-1,1])box(side*1.02,1.95,-1,.07,.65,1.6,'#547e82',boat);
    cylinder(.7,3,-1.4,.14,1.1,'#495d58',boat);cylinder(0,3,1,.07,4.5,'#bb9c6b',boat);
    box(0,4.6,1,3.2,.08,.08,'#beaa82',boat);line([[-1.4,.8,-2.5],[0,5.1,1],[1.4,.8,-2.5]],'#e5d3ab',boat);
    for(const side of [-1,1])for(const dz of [-2,0,2]){const tire=ring(side*1.6,.8,dz,.3,.12,'#3f5455',boat,true);tire.rotation.y=Math.PI/2;}
    label(name,0,.96,3.1,1.6,.35,c,boat);boats.push({o:boat,x,z,phase:x,route:new THREE.CatmullRomCurve3([[x,0,z],[80,0,80],[85,0,101],[90+(x%3)*3,0,124]].map(p=>new THREE.Vector3(...p)))});
  }
  line([[72,.4,65],[74,-.05,64.5],[77,.2,63]],'#a18b66');line([[68,.4,57],[66,-.08,56.5],[63,.3,55]],'#a18b66');
  // vehicle-variety: owned pack watercraft (rowboats, kayak, canoe, airboat,
  // speedboat, floatplane) at documented berths, racks and water loops.
  const watercraft=await buildWatercraft(dynamic,'harbor');
  tagDistrictModels(dynamic,town,'harbor');
  // Calm water marks, drifting seabirds and bobbing channel markers.
  for(let n=0;n<90;n++){
    const x=22+(n*17.31)%80,z=58+(n*7.73)%23;
    if(x<49&&z<66||x>85&&z<72)continue;
    const m=box(x,-.39,z,.7+(n%4)*.45,.012,.065,n%3?'#9bcfc9':'#c2ded1',dynamic);m.castShadow=false;ripples.push({o:m,x,n});
  }
  for(const [x,z] of [[84,76],[58,77]]){const b=new THREE.Group();b.position.set(x,-.35,z);dynamic.add(b);cylinder(0,.2,0,.5,.5,'#f0deae',b,.3);cylinder(0,.85,0,.14,.9,x>70?'#ba7059':'#648b75',b);buoys.push({o:b,x,z,n:x});}
  for(let n=0;n<7;n++){
    const g=new THREE.Group();dynamic.add(g);orb(0,0,0,.18,'#f2e9d2',g).scale.set(.17,.13,.32);
    const wings=[-1,1].map(side=>{const m=box(side*.4,0,0,.7,.045,.22,'#ece7d2',g);return m;});gulls.push({o:g,wings,n});
  }
  for(const [x] of QUAY_LAMPS){
    cylinder(x,1.7,44.7,.07,3.4,'#647b70');box(x,3.35,44.7,.6,.12,.6,'#49665e');
    const bulb=orb(x,3.1,44.7,.19,'#ffdea1',dynamic);bulb.material=new THREE.MeshBasicMaterial({color:'#ffdea1'});lamps.push(bulb);
    const light=new THREE.PointLight('#ffc879',0,8,1.8);light.position.set(x,2.8,44.7);dynamic.add(light);lamps.push(light);
  }
  label('SALTWIND HARBOR',46,3.6,42,9,1);for(const x of [41.7,50.3])cylinder(x,1.8,42,.09,3.6,'#7c8064');
  label('GULLWATCH PIER',70,1.7,53,4,.55);cylinder(68.2,.85,53,.06,1.7,'#8d7b59');
  await Promise.all(jobs);tagDistrictModels(root,town,'harbor',[0,0]);batchHarbor(root,scene);
  const life=await createHarborLife(dynamic,town);
  const rigid=createRigidBatches(dynamic);
  let lastT=0;
  return {
    life, boats, watercraft, beacon, pick:life.pick,
    update(t,hour,night){
      const dt=Math.max(0,t-lastT);lastT=t;life.update(dt,t,hour);watercraft.update(t,hour);
      for(const b of boats){if(b.route){const travel=hour<5||hour>=19?0:hour<7?(hour-5)/2:hour<17?1:(19-hour)/2;const p=b.route.getPointAt(travel),tangent=b.route.getTangentAt(travel);b.o.position.x=p.x;b.o.position.z=p.z;b.o.rotation.y=Math.atan2(tangent.x,tangent.z)+(hour>=17?Math.PI:0);}
      b.o.position.y=(b.baseY??-.25)+Math.sin(t*.8+b.phase)*.08;b.o.rotation.z=Math.sin(t*.65+b.phase)*.025;}
      for(const r of ripples){r.o.position.x=r.x+Math.sin(t*.23+r.n)*.45;r.o.scale.x=.6+Math.sin(t*.6+r.n)*.3;}
      for(const b of buoys){b.o.position.y=-.3+Math.sin(t*1.5+b.n)*.06;b.o.rotation.z=Math.sin(t+b.n)*.07;}
      for(const {o,wings,n} of gulls){const a=t*.13+n*.9;o.position.set(65+Math.cos(a)*23,7+n*.7+Math.sin(a*2),62+Math.sin(a)*13);o.rotation.y=-a;wings.forEach((w,i)=>w.rotation.z=(i?1:-1)*Math.sin(t*4+n)*.4);o.visible=hour>5&&hour<20;}
      beacon.rotation.y=t*.2;beacon.visible=night>.25;lamp.visible=night>.2;beaconLight.intensity=night*5;lantern.material.emissive.setRGB(night*.9,night*.4,night*.09);
      for(const m of lamps){if(m.isLight)m.intensity=night*LAMP_LOOK.harbourLight;else m.visible=night>.2;}
      rigid.update();
    },
    audit(){return {...life.audit(),boats:boats.length+watercraft.boats.filter(b=>b.g.visible).length,watercraft:watercraft.audit(),lighthouseOn:beacon.visible,beaconAngle:beacon.rotation.y};},
  };
}
