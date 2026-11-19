import {packVehicle} from './vehicle-models.js';
import {vehicleModel} from './traffic-fleet.js';
import * as THREE from 'three';
import {lampPosts,CIVIC_LAMPS} from './lamp-posts.js';
import {buildLampGlow} from './lamp-glow.js';
import {place} from '../catalog/loader.js';
import {toonMaterial} from '../toon.js';
import {civicLifeState,sampleRoute,CIVIC_PARKED,STORY_ROUTE} from './civic-quarter-life.js';

export async function buildCivicQuarter(scene,town) {
  const root=new THREE.Group(),moving=new THREE.Group();moving.name='Civic Green activity';scene.add(moving);
  const cube=new THREE.BoxGeometry(1,1,1),ball=new THREE.IcosahedronGeometry(1,1),round=new THREE.CylinderGeometry(1,1,1,24),jobs=[],actors=[],lamps=[];
  const mesh=(geo,x,y,z,w,h,d,color,parent=root)=>{const m=new THREE.Mesh(geo,toonMaterial(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const box=(x,y,z,w,h,d,c,p)=>mesh(cube,x,y,z,w,h,d,c,p);
  const orb=(x,y,z,r,c,p)=>mesh(ball,x,y,z,r,r,r,c,p);
  const disc=(x,y,z,r,h,c,p)=>mesh(round,x,y,z,r,h,r,c,p);
  const label=(text,x,y,z,w,h=0.65,color='#405e59',parent=root)=>{
    const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');
    ctx.fillStyle=color;ctx.fillRect(0,0,1024,128);ctx.fillStyle='#fff3d9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 68px Georgia';
    const size=Math.min(68,68*970/Math.max(ctx.measureText(text).width,1));ctx.font=`bold ${size}px Georgia`;ctx.fillText(text,512,68);
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));m.position.set(x,y,z);parent.add(m);return m;
  };
  const asset=(id,x,z,scale=1,rot=0)=>jobs.push(place(id,{x,z,scale,rotY:rot}).then(o=>root.add(o)));
  const actor=(role,name,x,z,behavior,n=0,scale=1)=>jobs.push(place('townsfolk-'+role,{x,z,scale}).then(o=>{o.position.y=.18;moving.add(o);if(behavior==='firefighter'||behavior==='station'){disc(0,1.85,0,.34,.07,'#d6b366',o);orb(0,1.97,0,.25,'#d6b366',o);box(0,1.2,.28,.6,.1,.04,'#e5d39a',o);}if(behavior==='librarian'){const book=box(.25,1,.35,.65,.08,.42,'#ad6c55',o);book.rotation.z=-.2;box(.25,1.05,.35,.59,.025,.38,'#eeddb8',o);}actors.push({o,name,x,z,behavior,n});}));
  const window=(x,y,z,w=1.3,h=1.6)=>{box(x,y,z,w+.2,h+.2,.14,'#f3e7cd');box(x,y,z+.08,w,h,.1,'#6f9a9b');box(x,y,z+.15,.07,h,.05,'#f3e7cd');};
  const building=(x,z,w,d,h,wall,roof)=>{box(x,.18,z,w+.6,.3,d+.6,'#c6bca5');box(x,h/2+.3,z,w,h,d,wall);box(x,h+.4,z,w+.65,.3,d+.65,roof);box(x,h+.62,z,w+.2,.16,d+.2,roof);for(const side of [-1,1]){box(x+side*w/2,h+.75,z,.15,.3,d,'#d9d2b9');box(x,h+.75,z+side*d/2,w,.3,.15,'#d9d2b9');}};
  const cross=(x,y,z,color,parent=root)=>{box(x,y,z,.28,1.2,.12,color,parent);box(x,y,z,1.2,.28,.12,color,parent);};
  const lamp=(x,z)=>{box(x,1.8,z,.12,3.6,.12,'#54675a');box(x,3.65,z,.55,.2,.55,'#53665a');const m=orb(x,3.4,z,.2,'#ffe6a9',moving);m.material=new THREE.MeshBasicMaterial({color:'#ffe0a1'});lamps.push(m);};
  // Kerbed civic avenue and forecourts. Lane geometry comes from the compiler.
  for(const z of [-79.4,-74.6])box(-71,.13,z,57,.13,.4,'#d9d4bc');
  for(const x of [-82.4,-77.6])box(x,.13,-55,.4,.13,39,'#d9d4bc');
  for(let x=-98;x<-44;x+=5)box(x,.13,-77,2,.025,.1,'#eee2bc');
  for(let z=-73;z<-35;z+=5)box(-80,.13,z,.1,.025,2,'#eee2bc');
  for(const z of [-72.5,-54])for(let n=0;n<6;n++)box(-81.65+n*.65,.15,z,.34,.025,2,'#f0e5c9');
  for(const [x,z]of CIVIC_LAMPS)lamp(x,z);
  // Fire station: two open apparatus bays, red brick and a hose tower.
  building(-91,-90,16,11,5.2,'#b67a62','#735f54');
  box(-91,.14,-82.5,17,.16,4.4,'#b7b6a1');
  for(const x of [-94,-88]){
    box(x,1.9,-84.44,4.6,3.4,.12,'#3f5350');box(x,3.8,-84.32,4.95,.24,.25,'#e5cfaa');
    for(const side of [-1,1])box(x+side*2.4,2,-84.25,.23,3.8,.25,'#e5cfaa');
    for(let n=0;n<5;n++)box(x,4.1+n*.15,-84.33,4.5,.08,.15,'#9d594d');
    box(x,.24,-83.5,.12,.04,2,'#e9d6ad');
  }
  // Roof vents and a hose drying rail give the station a working roofline.
  for(const x of [-94,-89]){box(x,5.95,-92,1.2,.55,1.4,'#b8afa0');box(x,6.28,-92,1.4,.12,1.6,'#7d8175');}
  for(let n=0;n<5;n++)box(-99+n*.5,7.3,-91.7,.08,2,.1,'#665d4f');
  label('ASTRA FIRE & RESCUE',-91,5,-84.25,13,.85,'#954b3d');
  building(-98,-94,3.1,4.3,9.5,'#bb866b','#815a48');
  label('01',-98,7.5,-91.8,2,1.6,'#9b5d49');window(-98,5,-91.8,1,1.5);
  for(const x of [-98.5,-83.5]){disc(x,.5,-81,.24,.85,'#b65e44');disc(x,.96,-81,.31,.13,'#d6ac69');box(x,.64,-81,.8,.16,.15,'#b65e44');}
  // Clinic: bright low wings, green medical emblem, sheltered waiting area.
  building(-71,-91,14,10,4.5,'#e2d8bd','#6c9284');
  for(const x of [-76,-73.6,-68.4,-66])window(x,2.5,-85.91,1.6,1.9);
  box(-71,1.7,-85.85,1.9,2.8,.14,'#567c75');window(-71,1.9,-85.72,1.35,1.9);
  box(-71,3.65,-84.5,6,.24,3,'#789e8b');box(-73.7,1.9,-85.1,.13,3.5,.13,'#d6cbb1');box(-68.3,1.9,-83.2,.13,3.5,.13,'#d6cbb1');
  for(const x of [-75,-70,-65]){const panel=box(x,5.3,-92.4,3,.12,2.6,'#486e7e');panel.rotation.x=.18;for(let n=0;n<3;n++)box(x-1+n,5.43,-92.4,.025,.025,2.4,'#94afb0');}
  label('WILLOW COMMUNITY CLINIC',-71,4.7,-85.78,12,.7,'#477f73');
  box(-71,5.7,-90,2.4,2.1,.45,'#f1e9d0');cross(-71,5.7,-89.7,'#568b73');
  box(-71,.13,-82.9,14,.14,2.8,'#d4cbb0');box(-73.48,.11,-82.2,3.6,.12,5.5,'#b6b4a1');asset('cv-bench',-77.4,-82.8,.8);
  for(const x of [-77,-65]){box(x,.5,-84,1.3,.7,1.2,'#aa9a79');orb(x,1.1,-84,.65,'#7c9d74');}
  // Public library: taller terracotta reading hall, high glazing, open book crest.
  building(-52,-91,16,11,6.7,'#ceb393','#65847c');
  for(const x of [-58,-55,-49,-46]){window(x,3.4,-85.4,1.7,3.7);box(x,1.45,-85.18,1.6,.12,.3,'#a48360');}
  box(-52,1.9,-85.35,2.3,3.2,.15,'#4a706a');window(-52,2,-85.19,1.8,2.3);
  for(const x of [-54,-50])box(x,2.1,-83.5,.25,4.2,.25,'#f0dfbd');box(-52,4.2,-83.9,6,.35,3.4,'#547a70');
  // A raised glazed lantern lights the reading hall from above.
  box(-52,7.5,-92,8,.8,3.5,'#658a8b');box(-52,8,-92,8.3,.18,3.8,'#446c63');
  for(let n=0;n<6;n++)box(-55.5+n*1.4,7.5,-90.2,.08,.8,.08,'#d9d2b9');
  label('CIVIC LIBRARY',-52,5.9,-85.2,13,1,'#557b72');
  for(const side of [-1,1]){const m=box(-52+side*.58,7.65,-89,1.15,.16,1.6,'#f0ddb6');m.rotation.z=side*.2;}
  label('BOOK RETURNS',-46,1.5,-82.35,2,.4);box(-46,.75,-82.7,1.7,1.5,.7,'#799788');box(-46,1.17,-82.3,1.3,.1,.1,'#3e5852');
  for(let n=0;n<6;n++)box(-58+n*.22,.9,-83.2,.15,.5,.3,['#b87561','#688d8a','#d2b163'][n%3]);
  label('STORY TIME  /  3 PM',-57,1.7,-82.5,3.6,.65,'#a17b51');box(-57,.8,-82.6,.12,1.5,.12,'#a17b51');
  // Neighbourhood police post and bike racks, facing the shared street.
  building(-92,-65,12,10,4.4,'#bdc8be','#5f7d8a');
  for(const x of [-96,-92])window(x,2.4,-59.9,2,1.8);
  box(-88,1.5,-59.85,1.8,2.6,.14,'#4d6b7d');label('NEIGHBOURHOOD POLICE',-92,4.3,-59.75,11,.75,'#496678');
  disc(-92,5.2,-65,.7,.2,'#d5b66f');box(-89,.12,-57,10,.15,3,'#cac7b1');
  label('HELP • LOST & FOUND',-92,1.2,-59.73,3.2,.4,'#577887');
  for(let i=0;i<2;i++){
    const x=-98+i*2;for(const z of [-57.5,-56.4]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.43,.07,5,14),toonMaterial('#4b625b'));wheel.rotation.y=Math.PI/2;wheel.position.set(x,.6,z);root.add(wheel);}
    box(x,.9,-57,.12,.12,1.3,'#b7a061');box(x,1.25,-56.45,.7,.1,.1,'#5c7063');box(x,1.1,-57,.1,.8,.1,'#738778');
  }
  // Willow Park: broad lawns, pond, story circle, picnic area and play garden.
  box(-59,.04,-54,31,.04,33,'#9fb878');
  // Restore walk surfaces above the lawn, using exactly the compiler segments.
  for(const r of town.roads.filter(r=>r.owner==='venue:civic-park')){
    const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],m=box((r.a[0]+r.b[0])/2,.16,(r.a[1]+r.b[1])/2,r.width,.08,Math.hypot(dx,dz),'#dfcfaa');m.rotation.y=Math.atan2(dx,dz);
  }
  disc(-60,.14,-59,5.1,.18,'#c6c6a2');const pond=disc(-60,.25,-59,4.55,.08,'#70afb0');pond.scale.z=3.35;
  for(let n=0;n<11;n++){const a=n/11*Math.PI*2;orb(-60+Math.sin(a)*4.8,.33,-59+Math.cos(a)*3.6,.3,'#b2b49a');}
  for(const [x,z]of [[-64,-61],[-56,-58],[-58,-61]]){disc(x,.32,z,.45,.035,'#7b9b70');orb(x,.4,z,.13,'#e1b9bd');}
  const ducks=[];for(let n=0;n<3;n++)jobs.push(place('farm-duck',{scale:1.3}).then(o=>{moving.add(o);ducks.push({o,n});}));
  disc(-60,.15,-47,3.8,.1,'#d3be96');
  for(let n=0;n<7;n++){const a=n/7*Math.PI*2;disc(-60+Math.sin(a)*2.8,.4,-47+Math.cos(a)*2.8,.44,.6,'#a68c60');}
  label('WILLOW PARK',-73,2,-39,7,.8,'#567b5c');for(const x of [-75.5,-70.5])box(x,1,-39,.13,2,.13,'#7a805e');
  for(const [x,z,scale]of [[-73,-69,1],[-44.5,-69,1],[-45,-39,1],[-73,-39,.85],[-66,-69,.8],[-54,-69,.85],[-45,-49,.85],[-73,-46,.75],[-66,-38.5,.75],[-98,-42,1],[-88,-42,.9],[-102,-61,.75]])asset('cv-tree-oak',x,z,scale);
  for(const [x,z,rot]of [[-68,-58,Math.PI/2],[-51,-58,-Math.PI/2],[-65,-44,0],[-49,-69,Math.PI],[-86,-40,Math.PI]])asset('cv-bench',x,z,.85,rot);
  // Picnic tables west of the post; play area on the park's eastern lawn.
  for(const z of [-48,-42]){box(-91,1,z,4,.17,1.5,'#b59465');for(const side of [-1,1]){box(-91,.55,z+side*1.1,4,.15,.4,'#b59465');for(const x of [-92.4,-89.6])box(x,.5,z+side*.5,.15,1,.15,'#797d60');}orb(-91,1.2,z,.22,'#cc9162');}
  box(-52,.18,-48,4.4,.16,6,'#cbb48b');
  for(const x of [-53.6,-50.4])for(const z of [-49.5,-46.5])box(x,1.7,z,.16,3.2,.16,'#b79963');box(-52,3.2,-48,3.6,.2,3.4,'#6c9483');
  const slide=box(-52,1.2,-45.7,1.1,.15,3.6,'#ccad64');slide.rotation.x=.6;box(-52,2.2,-48,2.5,.15,2.7,'#b89b69');
  for(let n=0;n<5;n++)box(-53.7,.4+n*.4,-49.2,.6,.12,.17,'#bd9b61');
  for(const x of [-73,-44.8])for(const z of [-64,-43]){box(x,.4,z,1,.5,1,'#b6a37d');for(let n=0;n<3;n++)orb(x+(n-1)*.25,.85,z,.2,['#c68e91','#ead49e','#d4a26e'][n]);}
  for(const v of CIVIC_PARKED.slice(0,3)){
    const object=await packVehicle(vehicleModel(v.model));
    object.name=v.id;object.position.set(v.center[0],.18,v.center[1]);object.rotation.y=v.yaw;moving.add(object);
  }
  // A contained bin fire is resolved visibly by the crew on each authored loop.
  box(-93,.7,-51,1.2,1.2,1,'#697e6c');box(-93,1.35,-51,1.4,.16,1.1,'#83917a');
  const flames=[],smoke=[];for(let n=0;n<5;n++){
    const f=orb(-93,1.6,-51,.3,n%2?'#efb958':'#d58048',moving);flames.push(f);
    const s=orb(-93,2.4,-51,.35,'#a8a89b',moving);smoke.push(s);
  }
  const hoseGeometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:20},(_,i)=>{const u=i/19;return new THREE.Vector3(-91-u*2,1.4+Math.sin(u*Math.PI)*1.1,-50.3-u*.7);}));
  const hose=new THREE.Line(hoseGeometry,new THREE.LineBasicMaterial({color:'#d8eeee'}));moving.add(hose);
  actor('blacksmith','Captain Ellis',-91,-50.3,'firefighter');actor('carpenter','Jo · station crew',-97,-81,'station');
  actor('herbalist','Nurse Sana',-70.1,-82.7,'clinic');actor('elder','Mrs. Bell',-77.4,-82.3,'waiting');
  actor('merchant','Ren · deliveries',-75.25,-81.9,'delivery');actor('watch','Officer Lane',-85,-60,'patrol');
  actor('elder','Mara · librarian',-60,-47,'librarian');
  for(let n=0;n<6;n++)actor('child',['Ari','Sol','Max','Nell','Bo','Zee'][n],-60,-47,'child',n,.95+n%2*.1);
  for(let n=0;n<3;n++)actor(['carpenter','farmhand','shopkeeper'][n],['Evan','Dee','Ollie'][n],-70,-54,'jogger',n,.95);
  actor('innkeeper','A picnic with Rose',-90,-47,'picnic');actor('child','A very tall slide',-52,-47,'play');
  const parcel=new THREE.Group();box(0,.6,0,.5,.5,.5,'#c4a16c',parcel);box(0,.86,0,.1,.02,.5,'#e6d1a2',parcel);moving.add(parcel);
  for(let n=0;n<3;n++)box(-76.75+n*.62,.4,-81.5,.6,.6,.6,'#baa074');
  await Promise.all(jobs);
  // Batch architecture, furniture and owned trees; preserve moving people.
  root.updateMatrixWorld(true);const batches=new Map();root.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+':'+o.material.uuid;if(!batches.has(key))batches.set(key,{source:o,matrices:[]});batches.get(key).matrices.push(o.matrixWorld.clone());});
  for(const {source,matrices}of batches.values()){const m=new THREE.InstancedMesh(source.geometry,source.material,matrices.length);matrices.forEach((v,i)=>m.setMatrixAt(i,v));m.castShadow=source.castShadow;m.receiveShadow=source.receiveShadow;scene.add(m);}
  // streetlights: the avenue posts had bulbs but no ground pool or halo.
  scene.add(buildLampGlow(lampPosts(town).filter(p=>p.source==='civic'),{name:'Civic Green lamps'}).group);
  const venueRecords=town.venues.filter(v=>v.district==='civic-green').map(v=>({type:'venue',data:v,bounds:new THREE.Box3(new THREE.Vector3(v.box.min[0],0,v.box.min[1]),new THREE.Vector3(v.box.max[0],v.height,v.box.max[1]))}));
  let state=civicLifeState(0,10), engine, delivery;
  const position=v=>v?[v.position[0],.215,v.position[1]]:[0,0,0];
  const move=(o,path,u,reverse=false)=>{const p=sampleRoute(path,u);o.position.set(p.x,.18,p.z);o.rotation.y=p.heading+(reverse?Math.PI:0);};
  const parkLoop=[[-70,-54],[-70,-66],[-48,-66],[-48,-42],[-70,-42],[-70,-54]];
  return {venueRecords,stats:{facilities:4,park:1,localPeople:actors.length,vehicles:5},
    setVehicles(vehicles){[engine,delivery]=vehicles;},
    audit:()=>({state:{...state},engine:position(engine),delivery:position(delivery),people:actors.map(a=>({name:a.name,position:a.o.position.toArray(),visible:a.o.visible})),ducks:ducks.map(a=>a.o.position.toArray())}),
    update(t,hour,night){
      const phase=!engine||engine.stoppedAt==='depot'?'ready':engine?.stoppedAt==='destination'?'assisting':engine?.lastStop==='destination'||engine?.returning?'returning':'responding';
      state={...civicLifeState(t,hour),phase,fireVisible:phase==='responding'||phase==='assisting'&&engine.wait>7,waterVisible:phase==='assisting'};
      const deliveryCycle=delivery?.stoppedAt==='depot'?t%18:18;
      flames.forEach((m,n)=>{m.visible=state.fireVisible;m.position.set(-93+Math.sin(t*5+n)*.28,1.5+Math.sin(t*6+n)*.2,-51+Math.cos(n)*.25);m.scale.set(.18,.35+Math.abs(Math.sin(t*7+n))*.5,.18);});
      smoke.forEach((m,n)=>{m.visible=state.fireVisible;const u=(t*.4+n/5)%1;m.position.set(-93+u*.7,2+u*2,-51);m.scale.setScalar(.18+u*.5);});hose.visible=state.waterVisible;
      for(const a of actors){const {o,n,behavior}=a;o.visible=true;o.position.set(a.x,.18,a.z);o.rotation.z=0;
        if(behavior==='firefighter'){o.visible=state.phase==='assisting';o.rotation.y=-1.9;}
        if(behavior==='station'){o.rotation.y=Math.sin(t*.4)*.35;}
        if(behavior==='clinic'||behavior==='waiting')o.visible=hour>=8&&hour<19;
        if(behavior==='delivery'){o.visible=state.deliveryActive&&deliveryCycle<18;o.position.x=-75.25+Math.sin(deliveryCycle/18*Math.PI)*.9;o.position.z=-81.9-Math.sin(deliveryCycle/18*Math.PI)*1.3;o.rotation.y=-2;parcel.position.copy(o.position);parcel.position.y+=.6;}
        if(behavior==='patrol'){move(o,[[-85,-60],[-80,-60],[-80,-54],[-70,-54],[-70,-42],[-48,-42],[-48,-66],[-70,-66],[-70,-54],[-80,-54],[-80,-60],[-85,-60]],(t%160)/160);}
        if(behavior==='child'||behavior==='librarian'){
          o.visible=state.libraryOpen;const local=(t+n*1.4)%160;
          if(!state.storyTime){o.position.set(-57+n*.75,.18,-82.5+(n%2)*.6);o.rotation.y=Math.PI;}
          else if(local<55)move(o,STORY_ROUTE,local/55);
          else if(local>135)move(o,STORY_ROUTE,1-(local-135)/25,true);
          else if(behavior==='child'){const angle=n/6*Math.PI*2;o.position.set(-60+Math.sin(angle)*2.4,.18,-47+Math.cos(angle)*2.4);o.rotation.y=angle+Math.PI;}
          else{o.rotation.y=.4;}
        }
        if(behavior==='jogger'){o.visible=state.parkOpen;move(o,parkLoop,(t/64+n/3)%1);o.position.y+=Math.abs(Math.sin(t*9+n))*.09;}
        if(behavior==='picnic'||behavior==='play'){o.visible=state.parkOpen;if(behavior==='play'){const u=(t%10)/10;o.position.set(-52,2.35-u*2,-48+u*4);}}
        if(o.visible)o.rotation.z=Math.sin(t*4+n)*.015;
      }
      parcel.visible=state.deliveryActive&&deliveryCycle<18;
      ducks.forEach(({o,n})=>{const a=t*.12+n*2;o.position.set(-60+Math.sin(a)*2.7,.3,-59+Math.cos(a)*1.8);o.rotation.y=Math.atan2(Math.cos(a)*2.7,-Math.sin(a)*1.8);});
      lamps.forEach(m=>m.visible=night>.15);
    }
  };
}
