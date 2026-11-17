import {tagDistrictModels} from './registry/district-models.js';
import * as THREE from 'three';
import { place } from '../catalog/loader.js';
import { primitives, rocket, batchStatic } from './starbase-models.js';
import { STARBASE_ORIGIN, flightState, routeAt } from './starbase-flight.js';

export async function buildStarbase(scene,town){
 const root=new THREE.Group();root.name='Starbase Texas';root.position.set(STARBASE_ORIGIN[0],0,STARBASE_ORIGIN[1]);scene.add(root);
 const statics=new THREE.Group(),moving=new THREE.Group();root.add(moving);
 const {box,cylinder,orb,beam,ring,label,mesh}=primitives(statics),jobs=[],selectables=[],people=[],waves=[];
 const asset=(id,x,z,scale=1,rotY=0,parent=statics)=>{const promise=place(id,{x,z,scale,rotY}).then(o=>{parent.add(o);return o;});jobs.push(promise);return promise;};
 const selectable=(id,name,x,z,w,d,h,story)=>selectables.push({type:'venue',data:{id,name,type:'starbase',district:'starbase',story},bounds:new THREE.Box3(new THREE.Vector3(x-w/2+STARBASE_ORIGIN[0],0,z-d/2+STARBASE_ORIGIN[1]),new THREE.Vector3(x+w/2+STARBASE_ORIGIN[0],h,z+d/2+STARBASE_ORIGIN[1]))});
 // A separate coastal shelf, well clear of the town's existing parcels.
 box(1,-1.35,12,130,2.6,137,'#b5a98d');box(0,-.08,12,128,.18,135,'#b2b98b');
 box(66,-.25,12,8,.35,137,'#e9d4a6');
 for(let n=0;n<55;n++){const x=72+(n*17.13)%63,z=-60+(n*31.43)%147;const m=box(x,-.65,z,2+n%5,.018,.12,'#c3e5df',moving);waves.push({m,x,z,n});}
 // Tidal pools and scrub occupy the margins; roads and work aprons stay clear.
 for(let n=0;n<75;n++){const x=-59+(n*17.91)%118,z=-49+(n*29.73)%124;if(z>-42&&z<65&&x>-51&&x<60)continue;orb(x,.25,z,.5+(n%4)*.2,['#849a6b','#9eac79','#7e956c'][n%3]);}
 for(const [x,z,r]of [[-51,64,5],[-45,72,3],[-57,-41,4],[54,-47,5]]){const pool=cylinder(x,.025,z,r,.025,'#86b6af');pool.scale.z*=.6;}
 const road=(a,b,width=4)=>{const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,length=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=Math.atan2(b[0]-a[0],b[1]-a[1]);const r=box(x,.075,z,width,.12,length,'#737f7b');r.rotation.y=angle;for(let d=2;d<length;d+=5){const u=d/length,m=box(a[0]+(b[0]-a[0])*u,.145,a[1]+(b[1]-a[1])*u,.1,.015,2,'#e9d7aa');m.rotation.y=angle;}};
 // Highway 4 reaches the east end of the existing Quay road, on a raised causeway.
 const highway=[[-99,-20],[-99,-12],[-77,-12],[-66,0],[-46,0],[57,0]];
 for(let i=1;i<highway.length;i++){const a=highway[i-1],b=highway[i];const foundation=box((a[0]+b[0])/2,-1.25,(a[1]+b[1])/2,7,2.5,Math.hypot(b[0]-a[0],b[1]-a[1])+1,'#b4ae8d');foundation.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);road(a,b,5.5);}
 road([-46,0],[-46,-35]);road([20,0],[20,-24]);road([48,0],[48,12]);road([-19,0],[-19,55]);road([-19,43],[-8,43]);road([-19,55],[27,55]);road([-46,9],[-46,38],2);
 label('HIGHWAY 4  /  STARBASE →',-60,.18,-1.6,15,1.5,'#647671',statics,true);
 // Starfactory: ribbed high bays, open dark hangar portals, cranes and aprons.
 for(const [x,z,w,h,d,name]of [[-39,-27,19,22,23,'MEGABAY 01'],[-13,-34,16,17,19,'HIGH BAY'],[-38,20,22,6,14,'STARFACTORY']]){
  box(x,.15,z,w+5,.25,d+5,'#c8c7b2');box(x,h/2,z,w,h,d,'#eee9d9');box(x,h+.3,z,w+.6,.6,d+.6,'#c3d0cc');
  for(let i=0;i<w;i+=1.2)box(x-w/2+i,h/2,z+d/2+.03,.07,h,.08,'#bac8c6');
  box(x,h*.43,z+d/2+.1,w*.66,h*.82,.12,'#354c53');box(x,h*.43,z+d/2+.2,w*.48,h*.79,.1,'#23353f');
  for(const dx of [-w*.34,w*.34])box(x+dx,h*.43,z+d/2+.3,.45,h*.85,.5,'#d0d3c3');
  label(name,x,h-.9,z+d/2+.42,w*.9,1.3);box(x,h+1,z,1,1.5,d*.8,'#879d9e');
  selectable(name,name,x,z,w,d,h,'Assembly halls along Highway 4. Transporters collect completed stainless-steel vehicles here and roll them to the orbital launch site.');
 }
 for(const [x,z,kind]of [[-24,-15,'ship'],[-9,-17,'booster'],[0,-34,'ship']]){const r=rocket(kind);r.root.position.set(x,.3,z);statics.add(r.root);r.flame.visible=false;cylinder(x,.15,z,2.4,.3,'#7f9492');}
 label('ROCKET GARDEN',-12,.22,-11,15,1.9,'#637d78',statics,true);
 // Launch mount with clamps and a flame trench pointing away from the road.
 cylinder(20,.25,-24,10.5,.5,'#c8c8b7');ring(20,.52,-24,9.7,.13,'#eee3b9');
 box(20,.55,-34,6,.4,20,'#485659');for(const x of [16.5,23.5])box(x,1,-34,.7,1.6,20,'#b4bdb4');
 const diverter=box(20,1.3,-26,5,.4,6,'#82979c');diverter.rotation.x=-.35;
 for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(20+Math.sin(a)*2,1.4,-24+Math.cos(a)*2,.35,2.6,'#6b8188');box(20+Math.sin(a)*1.6,2.9,-24+Math.cos(a)*1.6,.7,.4,.7,'#394c56');}
 ring(20,2.6,-24,2,.55,'#425963');box(4,.18,-12,6,.35,6,'#bbc3b7');
 // Mechazilla lattice: four columns, horizontal platforms and X bracing.
 const tx=11,tz=-24;
 for(const dx of [-2,2])for(const dz of [-2,2])box(tx+dx,18,tz+dz,.6,36,.6,'#526b77');
 for(let y=2;y<36;y+=4){box(tx,y,tz,4.8,.3,4.8,'#84999b');for(const side of [-1,1]){beam([tx-2,y,tz+side*2],[tx+2,y+4,tz+side*2],.22,'#657d87');beam([tx+2,y,tz+side*2],[tx-2,y+4,tz+side*2],.22,'#657d87');beam([tx+side*2,y,tz-2],[tx+side*2,y+4,tz+2],.22,'#657d87');}}
 box(tx,36.5,tz,5.8,1.2,5.8,'#d3d6c7');box(tx,37.3,tz,3,.5,3,'#849ca3');
 const carriage=new THREE.Group();carriage.position.set(tx,18,tz);moving.add(carriage);box(0,0,0,5,1.2,5,'#435d68',carriage);
 const arms=[];for(const side of [-1,1]){const g=new THREE.Group();g.position.z=side*2;carriage.add(g);box(5.4,0,0,11.2,.6,.8,'#d3b56e',g);for(let n=0;n<5;n++)beam([n*2,.1,-.35],[n*2+2,1,.35],.16,'#485d63',g);box(9.1,.45,0,2,.3,1.1,'#4e6066',g);arms.push(g);}
 label('STARSHIP  /  OLP-1',20,.56,-12,18,2,'#607b7b',statics,true);
 selectable('starship-pad','Starship & Mechazilla',17,-24,22,24,38,'Watch the complete loop: hot staging, Super Heavy return and chopstick catch, then Starship’s belly-flop, engine flip and recovery onto the cleared launch mount.');
 // Cryogenic tank farm between the launch pads, with transfer plumbing.
 box(35,.2,-7,20,.4,14,'#c6c8b7');
 for(let i=0;i<6;i++){const x=28+(i%3)*5,z=-11+Math.floor(i/3)*7;cylinder(x,3.1,z,1.8,6,'#e8eade');cylinder(x,6.15,z,1.8,.5,'#b6c7c4',statics,1.3);ring(x,.45,z,1.9,.1,'#779294');label(['LOX','CH4','LN2'][i%3],x,3.7,z+1.82,2.2,.7);box(x,1,z+2.2,2,1,1,'#86a8aa');}
 for(let i=0;i<3;i++){const m=cylinder(30+i*4,1.4,-19,1.25,6,'#e9e9d9');m.rotation.x=Math.PI/2;for(const z of [-21,-17])box(30+i*4,.6,z,2.4,.8,.6,'#8a9b99');}
 for(const x of [25,44])beam([x,.6,-23],[x,.6,1],.25,'#bed3d1');beam([20,.6,-23],[44,.6,-23],.25,'#bed3d1');
 selectable('tank-farm','Cryogenic tank farm',35,-10,22,22,7,'Liquid oxygen, methane and nitrogen tanks feed insulated pipes, pumps and subcoolers. Frost and white vapor build before ignition.');
 // Falcon launch apron and hinged strongback.
 cylinder(48,.3,12,10,.6,'#c5c4b2');box(48,.7,12,5,1,5,'#445d65');
 const strongback=new THREE.Group();strongback.position.set(48,.7,9.5);moving.add(strongback);
 for(const x of [-.7,.7])box(x,9,0,.25,18,.3,'#52717a',strongback);for(let y=1;y<18;y+=2){beam([-.7,y,0],[.7,y+2,0],.18,'#819b9f',strongback);box(0,y,0,1.6,.18,.5,'#627d84',strongback);}
 for(const [x,z]of [[39,7],[57,7],[57,20]]){cylinder(x,10,z,.13,20,'#a6b8b5');box(x,20.5,z,.12,1,.12,'#d6bb80');}
 label('FALCON  /  LC-2',48,.64,23,17,1.8,'#607b7b',statics,true);
 selectable('falcon-pad','Falcon launch complex',48,12,22,24,23,'Falcon 9 flies to the offshore landing ship. The following Falcon Heavy-style flight separates two side boosters for a synchronized return to LZ-1 and LZ-2.');
 const target=(x,z,r,name,parent=statics,y=.35)=>{cylinder(x,y/2,z,r,y,'#c9cabb',parent);cylinder(x,y+.015,z,r*.84,.025,'#52686b',parent);ring(x,y+.05,z,r*.7,.12,'#f2e9c8',parent);for(const a of [-.7,.7]){const mark=box(x,y+.065,z,.5,.025,r*1.05,'#f8efcf',parent);mark.rotation.y=a;}label(name,x,y+.09,z+r*.48,r*.8,r*.14,'#52686b',parent,true);};
 for(const [x,z,name]of [[-8,43,'LZ-1'],[27,55,'LZ-2']]){target(x,z,11,name);for(let n=0;n<12;n++){const a=n*Math.PI/6;orb(x+Math.sin(a)*11.3,.45,z+Math.cos(a)*11.3,.16,'#dfbb62');}selectable(name,name+' · Falcon recovery',x,z,23,23,16,'A circular concrete landing zone with the large X target. On Heavy flights, both side boosters descend together, deploy four legs and touch down upright.');}
 // Drone ship is a moving parent; a landed booster uses its exact deck position.
 const drone=new THREE.Group();moving.add(drone);box(0,-.2,0,12,1.2,21,'#334d59',drone);box(0,.48,0,11.5,.18,20.5,'#607a7c',drone);target(0,0,5,'X',drone,.63);
 for(const x of [-5.5,5.5])for(let z=-10;z<=10;z+=2)box(x,.63,z,.2,.06,1.1,'#e4c071',drone);
 for(const z of [-8.7,8.7]){box(0,1.1,z,5,1,1.8,'#ebe7d5',drone);box(0,1.85,z,3,.5,1.5,'#9eb5b7',drone);}
 label('JUST READ THE INSTRUCTIONS',0,.65,6.5,10,1,'#506e74',drone,true);
 const tug=new THREE.Group();moving.add(tug);box(0,-.1,0,3,1,6,'#a65f4f',tug);box(0,.5,0,2.6,.3,5.5,'#d9b574',tug);box(0,1.3,0,2,1.5,2,'#eee6ce',tug);box(0,1.5,1.05,1.6,.55,.08,'#446b7a',tug);cylinder(.6,2.4,-1,.23,2,'#4b5f66',tug);
 const rope=beam([0,0,0],[0,1,0],.07,'#bcbba2',moving);
 box(64,.15,68,17,1,9,'#a4a99a');for(const z of [64,72])box(64,.8,z,17,.3,.3,'#6d8281');label('RECOVERY DOCK',64,.7,68,13,1.4,'#526f73',statics,true);
 selectable('drone-ship','Autonomous drone ship',96,35,13,22,16,'The floating X target receives a Falcon 9 booster offshore. After touchdown, the tug takes the barge and secured booster back to the recovery dock.');
 // Viewing garden and a sheltered worker compound beside the factory.
 box(-42,.18,39,24,.32,13,'#d1c19e');for(const z of [43,45])for(let i=0;i<4;i++)asset('cv-bench',-51+i*6,z,.9,Math.PI);
 for(const x of [-54,-30]){asset('cv-tree-fruit',x,39,.8);box(x,1,32,.12,2,.12,'#6a7f71');}
 label('STARBASE',-42,4.2,32,21,3,'#355c66');label('TEXAS  ·  GATEWAY TO THE GULF',-42,2.3,32,21,.9,'#6c8785');
 box(-31,1.6,6,8,3.2,5,'#d7dcca');box(-31,3.3,6,8.6,.3,5.6,'#6e878b');label('CREW / RANGE CONTROL',-31,2.3,8.55,7,.6);
 const gate=box(-21,1.6,0,.18,.18,6,'#e7b765',moving);
 for(let i=0;i<16;i++){const x=-53+i*2;box(x,.9,30,.08,1.8,.08,'#7f8f80');}box(-38,1.5,30,31,.08,.08,'#7f8f80');
 // Licensed townsfolk get routed along the visitor walk and sheltered work lanes.
 const workerRoutes=[ [[-33,9],[-24,9],[-24,-3],[-45,-3],[-45,-13],[-45,-3],[-33,9]], [[-33,9],[-24,9],[-24,3],[-48,3],[-48,18],[-48,3],[-24,3],[-24,9],[-33,9]] ];
 for(let i=0;i<16;i++){const worker=i<6;asset('townsfolk-'+(worker?'farmhand':['elder','merchant','child','innkeeper'][i%4]),0,0,worker?.9:.92,0,moving).then(o=>{const route=worker?workerRoutes[i%2]:i>=12?[[-51+(i-12)*5,38],[-51+(i-12)*5,42],[-51+(i-12)*5,38]]:[[-99,-20],[-99,-12],[-77,-12],[-66,0],[-46,0],[-46,32],[-53+(i-6)*2,38],[-46,32],[-46,0],[-66,0],[-77,-12],[-99,-12],[-99,-20]];if(worker){const hat=cylinder(0,1.75,0,.3,.18,'#e4b75b',o);hat.position.y=1.75;}people.push({o,i,worker,route});});}
 // A modular transporter circulates on the paved factory-to-pad service road.
 const transporter=new THREE.Group();moving.add(transporter);box(0,.55,0,4,.6,7,'#c9a35a',transporter);box(0,.9,0,3.7,.18,6.8,'#637d82',transporter);
 for(const x of [-1.85,1.85])for(let i=0;i<7;i++){const w=cylinder(x,.32,-2.7+i*.9,.32,.3,'#354a4c',transporter);w.rotation.z=Math.PI/2;}
 const recoveryDolly=new THREE.Group();moving.add(recoveryDolly);box(0,1.4,0,4.5,2.7,4.5,'#566d73',recoveryDolly);for(const x of [-2.2,2.2])for(const z of [-1.4,0,1.4]){const w=cylinder(x,.4,z,.4,.35,'#30454c',recoveryDolly);w.rotation.z=Math.PI/2;}
 const cargo=rocket('ship');cargo.root.position.y=1.1;transporter.add(cargo.root);
 // Reusable actors, exhaust, pool of smoke puffs: no per-frame scene allocation.
 const vehicles={booster:rocket('booster'),ship:rocket('ship'),f9:rocket('falcon'),upper:rocket('upper'),sides:[rocket('falcon'),rocket('falcon')]};
 for(const v of [vehicles.booster,vehicles.ship,vehicles.f9,vehicles.upper,...vehicles.sides])moving.add(v.root);
 const smoke=[];for(let i=0;i<38;i++){const m=orb(0,0,0,1,'#e2e2cd',moving);m.castShadow=false;smoke.push(m);}
 const vents=[];for(let i=0;i<12;i++){const m=orb(0,0,0,.3,'#eaf2e4',moving);m.castShadow=false;vents.push(m);}
 await Promise.all(jobs);tagDistrictModels(statics,town,'starbase',STARBASE_ORIGIN);people.sort((a,b)=>a.i-b.i);batchStatic(statics,root);
 let state=flightState(0),time=0;
 const api={selectables,stats:{launchPads:2,landingPads:2,droneShips:1,workers:6,spectators:10},
  audit(){return { ...state,transporter:transporter.position.toArray(),people:people.map(p=>({worker:p.worker,position:p.o.position.toArray(),visible:p.o.visible})),vehiclePositions:Object.fromEntries(['booster','ship','f9','upper'].map(k=>[k,vehicles[k].root.position.toArray()])),drone:drone.position.toArray()};},
  update(t,night=0,hour=10){time=t;state=flightState(t);for(const key of ['booster','ship','f9','upper'])vehicles[key].apply(state[key],t);vehicles.sides.forEach((v,i)=>v.apply(state.sides[i],t));
   recoveryDolly.visible=state.t>=44;recoveryDolly.position.set(state.booster.x,0,state.booster.z);carriage.position.y=state.armY;arms.forEach((a,i)=>a.rotation.y=(i?1:-1)*state.arms*.28);strongback.rotation.x=state.t>=87&&state.t<134||state.t>=141?-.42:0;gate.rotation.x=state.gate?0:-Math.PI/2;
   drone.position.set(state.droneX,0,state.droneZ);tug.position.set(state.droneX+3,0,state.droneZ+16);rope.position.set(state.droneX+1.5,.65,state.droneZ+11.8);rope.scale.y=6;rope.rotation.x=Math.PI/2;
   const record=selectables.find(s=>s.data.id==='drone-ship');record.bounds.set(new THREE.Vector3(state.droneX+STARBASE_ORIGIN[0]-6.5,0,state.droneZ+STARBASE_ORIGIN[1]-11),new THREE.Vector3(state.droneX+STARBASE_ORIGIN[0]+6.5,17,state.droneZ+STARBASE_ORIGIN[1]+11));
   smoke.forEach((m,i)=>{const launch=state.smoke>0,landing=(state.t>33&&state.t<39)||(state.t>111&&state.t<118)||(state.t>167&&state.t<174);m.visible=launch||landing;if(!m.visible)return;const u=((t*.3+i/38)%1),a=i*2.399;const x=launch?(state.mode==='starship'?20:48):state.t<40?20:state.t<120?state.droneX:i%2?27:-8;const z=launch?(state.mode==='starship'?-24:12):state.t<40?-24:state.t<120?state.droneZ:i%2?55:43;m.position.set(x+Math.cos(a)*u*(launch?15:7),.5+u*3,z+Math.sin(a)*u*(launch?15:7));m.scale.setScalar((.8+u*2.5)*(1-u*.6));});
   vents.forEach((m,i)=>{const u=(t*.21+i/12)%1;m.position.set(28+(i%3)*5+u*2,5+u*3,-11+Math.floor(i/6)*7);m.scale.setScalar(.15+u*.7);m.visible=state.t<11||state.t>78&&state.t<90||state.t>133&&state.t<143;});
   const tr=routeAt([[-45,-12],[-45,0],[4,0],[4,-6],[4,0],[-45,0],[-45,-12]],t,1.4,8);transporter.position.set(tr.x,0,tr.z);transporter.rotation.y=tr.heading;
   people.forEach(p=>{p.o.visible=p.worker||hour>=6&&hour<22;const route=p.route;const v=routeAt(route,t+p.i*9,p.worker?1.1:.75,p.worker?4:14);p.o.position.set(v.x,.12+(v.walking?Math.sin(t*8+p.i)*.035:0),v.z);p.o.rotation.y=v.walking?v.heading:Math.atan2(20-v.x,-24-v.z);});
   waves.forEach(({m,x,n})=>{m.position.x=x+Math.sin(t*.4+n)*.5;m.scale.x=2+n%5+Math.sin(t*.6+n)*.4;});
  },get time(){return time;}};
 api.update(0);return api;
}
