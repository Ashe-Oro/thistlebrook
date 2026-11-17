import {tagAssembly,renderCoverage} from './registry/render-tags.js';
import {mountWorldNavigation} from './navigation.js';
import {placeInfo,worldMoment} from './place-info.js';
import {createTeslaTown} from './tesla/index.js';
import {WORLD_OFFSETS} from '../compiler/world-plan.js';
import {createWorldRegistry} from './registry/index.js';
import {compileWorld,WORLD_VIEWS} from '../compiler/world-plan.js';
import { overview } from './overview.js';
import { CIVIC_VIEW } from './civic-quarter-plan.js';
import { SUNBEAM_VIEW } from './sunbeam-layout.js';
import { WORK_VIEWS, mountWorkUI } from './work-ui.js';
import { createAstraLighting } from './lighting.js';
import { createSkinRuntime } from './skin/index.js';
import { mountSkinPicker } from './skin/picker.js';
import { skinFromQuery } from '../skins/index.js';
import { createLightControls } from './light-controls.js';
import { createLifePanel } from './life/panel.js';
import { createTraffic } from './traffic.js';
import * as THREE from 'three';
import { createMapCamera, cameraBounds } from './camera.js';
import { createCameraUI } from './camera-ui.js';
import { createSelection } from './selection.js';
import { compileAstra } from '../compiler/astra.js';
import { RESOLVED } from '../catalog/loader.js';
import { buildAstra } from './world.js';
import { createResidents } from './residents.js';
import { createUI, icon } from './ui.js';
import {crossingClear} from '../roads/collisions.js';
const q=new URLSearchParams(location.search);
const loading=document.createElement('div');loading.className='loading';loading.innerHTML='<div class="sprout">❧</div><h1>A little world awaits.</h1><p>Opening the shutters, putting the kettle on…</p>';document.body.append(loading);
start().catch(error=>{console.error(error);loading.innerHTML='<h1>The village is taking a moment.</h1><p>Could not load the village. Check that the private asset library is available.</p>';window.__astraError=String(error);});
async function start(){
 const seed=Number(q.get('seed')??831);const town=compileWorld(RESOLVED,Number.isFinite(seed)?seed:831,{capture:q.has('registryCapture')});
 town.captureRegistry=q.has('registryCapture');const scene=new THREE.Scene();scene.background=new THREE.Color('#e8ede3');
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:q.has('capture'),powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;document.querySelector('#app').append(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-60,60,40,-40,.1,3000);camera.position.set(90,90,110);camera.lookAt(0,0,0);
 let hour=Number(q.get('hour')??10.4),paused=false,speed=1,elapsed=0,following=null,selected=null,last=performance.now(),lastMoment=-1,nextPerson=0,night=0;
 if(!Number.isFinite(hour))hour=10.4;hour=((hour%24)+24)%24;
 const world=await buildAstra(scene,town),residents=await createResidents(scene,town,{hour});
 world.districts.civic.setActivityOwner?.('baseball',true);
 const traffic=await createTraffic(scene,town,residents,world);tagAssembly(traffic.root,'market');
 // grok-roads: residents look both ways before a crossing; regional cars also
 // see town traffic. Both read the same pure simulations the tests use.
 residents.life.setCrossingGuard((a,b)=>crossingClear(a,b,[...traffic.simulation.vehicles,...(world.landscape?.traffic?.vehicles||[])]));
 world.landscape?.setOtherVehicles?.(()=>traffic.simulation.vehicles);
 const tesla=createTeslaTown(scene,town,{traffic,residents});tesla.root.position.set(WORLD_OFFSETS.roadster[0],0,WORLD_OFFSETS.roadster[1]);tagAssembly(tesla.root,'roadster');for(const item of tesla.adapter.installed)tagAssembly(item.object,'market');
 const raycaster=new THREE.Raycaster();
 let ui, cameraUI,activeView=null;
 const selection=createSelection(scene);
 const controls=createMapCamera(camera,renderer.domElement,{bounds:cameraBounds(town),
  onRotate(){if(activeView==='village')setView('village',true);},
  onInteract(kind){if(kind!=='rotate')activeView=null;following=null;ui?.view('');ui?.tooltip(null);},
  onTap:inspectPoint,
  onHover(point){const hit=point?pick(point.x,point.y):null;ui?.tooltip(hit?.name,point?.x,point?.y);renderer.domElement.style.cursor=hit?'pointer':'grab';},
  onChange(state){cameraUI?.update(state);}
 });
 const setView=(v,immediate=false)=>{following=null;selected=null;selection.select(null);if(ui){ui.root.querySelector('.card').classList.remove('open');cameraUI?.activity(null,false);}activeView=typeof v==='string'?v:null;const views={...WORLD_VIEWS,sunbeam:{...SUNBEAM_VIEW,zoom:innerWidth<600?4.4:SUNBEAM_VIEW.zoom},...WORK_VIEWS,works:{...WORK_VIEWS.works,zoom:innerWidth<600?2.7:WORK_VIEWS.works.zoom},civic:{...CIVIC_VIEW,zoom:innerWidth<600?3.4:CIVIC_VIEW.zoom},village:overview(town,innerWidth,innerHeight,Math.PI/4+controls.state().rotation*Math.PI/2),downtown:{x:-57,z:-6,zoom:innerWidth<600?3.5:3.1},campus:{x:8,z:-70,zoom:1.8},stadium:{x:30,z:-84,zoom:2.8},baseball:{x:-22,z:-84,zoom:3.8},neighbourhood:{x:-3,z:-9,zoom:2.4},common:{x:8,z:-66,zoom:1.8},quay:{x:53,z:-1,zoom:2.3},market:{x:1,z:0,zoom:2.5},orchard:{x:-8,z:23,zoom:2.4},harvest:{x:-48,z:26.5,zoom:3.8},camp:{x:-68,z:26.5,zoom:3.8},tea:{x:55,z:-43,zoom:3.8}},dest=typeof v==='string'?views[v]:v;controls.view(dest,immediate);ui?.view(typeof v==='string'?v:'');};
 const lighting=createAstraLighting({scene,camera,controls,renderer,town});
 const skins=createSkinRuntime({renderer,scene,camera,world,lighting,quality:q.get('quality')||'med',initial:skinFromQuery(q)});
 const setHour=h=>{if(Number.isFinite(h)){hour=((h%24)+24)%24;residents.setHour(hour);}};
 const zoom=factor=>controls.zoom(factor);
 const togglePause=()=>{paused=!paused;ui.paused(paused);};
 let audioContext=null,audioOn=false;
 const sound=()=>{audioOn=!audioOn;ui.root.querySelector('#sound').classList.toggle('active',audioOn);ui.root.querySelector('#sound').setAttribute('aria-pressed',String(audioOn));ui.root.querySelector('#sound').setAttribute('aria-label',audioOn?'Disable ambient sound':'Enable ambient sound');if(audioOn){audioContext??=new AudioContext();audioContext.resume();chirp();}else audioContext?.suspend();};
 const chirp=()=>{if(!audioOn)return;const t=audioContext.currentTime;for(let i=0;i<3;i++){const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(1200+i*340,t+i*.13);o.frequency.exponentialRampToValueAtTime(2100+i*100,t+i*.13+.08);g.gain.setValueAtTime(0,t+i*.13);g.gain.linearRampToValueAtTime(.018,t+i*.13+.02);g.gain.exponentialRampToValueAtTime(.0001,t+i*.13+.13);o.connect(g).connect(audioContext.destination);o.start(t+i*.13);o.stop(t+i*.13+.15);}};
 const showPerson=p=>{following=null;selected=p;selection.select({type:'person',person:p});ui.card(p.name,p.role,p.story,()=>{if(following===p){following=null;controls.cancel();}else{controls.cancel();controls.zoom(Math.max(3,camera.zoom)/camera.zoom);following=p;}});ui.root.querySelector('.portrait').innerHTML=icon('person');cameraUI.activity(p,false);};
 const closeDetails=()=>{ui.root.querySelector('.card').classList.remove('open');following=null;selected=null;selection.select(null);cameraUI.activity(null,false);};
 ui=createUI(town,{zoom,rotate:()=>controls.rotate(),view:setView,pause:togglePause,speed(){speed=speed===1?3:speed===3?8:1;ui.speed(speed);},hour:setHour,resident(){showPerson(residents.people[nextPerson++%residents.people.length]);},sound,unfollow:closeDetails});
 cameraUI=createCameraUI(ui.root,controls,camera);
 for(const [id,label]of [['harbor','Saltwind Harbor']]){const b=document.createElement('button');b.dataset.view=id;b.textContent=label;b.onclick=()=>setView(id);ui.root.querySelector('.view-tabs').append(b);}
 const lifePanel=createLifePanel(ui,residents),lightControls=createLightControls(ui.root,setHour),workUI=mountWorkUI(ui.root,{view:setView});mountSkinPicker(ui.root,skins);
 mountWorldNavigation(ui,setView);
 // Resizing clears the drawing buffer; redraw even when capture has stopped RAF.
 const resize=()=>{renderer.setSize(innerWidth,innerHeight);const aspect=innerWidth/innerHeight,half=Math.max(70,108/aspect);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();if(activeView==='village')setView('village',true);step(0);};window.addEventListener('resize',resize);resize();if(controls.restore())ui.view('');else setView(q.get('view')&&['village','downtown','campus','stadium','baseball','common','market','neighbourhood','quay','orchard','sunbeam','civic','harvest','camp','tea',...Object.keys(WORLD_VIEWS),...Object.keys(WORK_VIEWS)].includes(q.get('view'))?q.get('view'):'village',true);
 function pick(x,y){raycaster.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);let person=residents.pick(raycaster.ray);let personDistance=person?raycaster.ray.origin.distanceTo(person.object.getWorldPosition(new THREE.Vector3())):Infinity;for(const p of world.expansions.people){if(!p.object?.visible)continue;const center=p.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.8,0)),hit=raycaster.ray.intersectSphere(new THREE.Sphere(center,.8),new THREE.Vector3());if(hit&&hit.distanceTo(raycaster.ray.origin)<personDistance){person=p;personDistance=hit.distanceTo(raycaster.ray.origin);}}let best=null,distance=Infinity;for(const b of world.selectables){const hit=raycaster.ray.intersectBox(b.bounds,new THREE.Vector3());if(hit&&raycaster.ray.origin.distanceTo(hit)<distance){best=b;distance=raycaster.ray.origin.distanceTo(hit);}}
  const vehicle=traffic.pick(raycaster.ray);if(vehicle&&vehicle.distance<distance){best=vehicle;distance=vehicle.distance;}
  if(person){const d=raycaster.ray.origin.distanceTo(person.object.getWorldPosition(new THREE.Vector3()));if(!best||d<distance+1.8)return {type:'person',person,name:person.name};}return best?{...best,name:best.data.name}:null;
 }
 function inspectPoint(x,y){const hit=pick(x,y);if(!hit){closeDetails();return;}following=null;selected=null;selection.select(hit);cameraUI.activity(null,false);ui.root.querySelector('.portrait').innerHTML=icon('home');if(hit.type==='person'){showPerson(hit.person);return;}const info=placeInfo(hit.data,town);ui.card(info.name,hit.type==='traffic'?hit.data.detail:info.badge,info.story,null);}
 document.addEventListener('keydown',e=>{if(e.code==='Escape'){closeDetails();ui.root.querySelector('.help').classList.remove('open');ui.root.querySelector('#help').setAttribute('aria-expanded','false');return;}if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input, textarea, select, button, a, [contenteditable="true"]'))return;if(e.code==='Space'){e.preventDefault();togglePause();}if(e.code==='KeyH'||e.code==='Home'){e.preventDefault();setView('village');}});
 function step(dt,render=true){dt=Math.max(0,Math.min(dt,.1));if(!paused){elapsed+=dt*speed;hour=(hour+dt*speed/90)%24;residents.update(dt*speed,elapsed,hour);traffic.update(dt*speed);}if(following){controls.target.lerp(following.object.getWorldPosition(new THREE.Vector3()).setY(0),1-Math.exp(-dt*5));}
 controls.update(dt);selection.update();cameraUI.activity(selected,following===selected);lifePanel.update(selected,elapsed);
 ui.root.classList.toggle('exploring',activeView!=='village'||camera.zoom>1.4);night=lighting.update(hour);tesla.update(elapsed,night);world.update(elapsed,night,hour,residents.people,(4+residents.life.day)%7);workUI.update(world.works,controls,hour,camera.zoom);ui.clock(hour);lightControls.update(hour);const moment=worldMoment(town,world,tesla,controls.target,camera.zoom,activeView,hour),key=moment.join('|');if(key!==lastMoment){lastMoment=key;ui.moment(...moment);if(audioOn)chirp();}if(render)skins.render(night,elapsed,hour);}
 window.__astra={skin:skins,setSkin:id=>skins.setSkin(id).id,tesla,registry:createWorldRegistry(town),town,scene,camera,renderer,controls,residents,world,traffic,lighting,selection,get hour(){return hour;},get paused(){return paused;},get elapsed(){return elapsed;},get following(){return following?.name;},get speed(){return speed;},setHour,step,view:(v)=>setView(v,true),selectPerson:showPerson,pick,setPaused(v){paused=v;ui.paused(v);},audit(){return {landscape:world.landscape.audit(),report:town.report,renderRegistryErrors:renderCoverage(scene,town),tesla:tesla.audit(),expansions:world.expansions.audit(),people:residents.people.length,cityActivities:world.districts.stats,civicActivities:world.civicQuarter.stats,works:world.works.audit(),sunbeam:world.sunbeam.stats,life:residents.life.audit(),traffic:traffic.audit(),catalog:world.catalogActivities.audit(),lighting:{...lighting.state},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,positions:residents.people.map(p=>[p.name,p.object.position.x,p.object.position.z,p.activity]),hour,paused,zoom:camera.zoom,camera:controls.state()};}};
 step(0);loading.classList.add('done');window.__ready=true;
 function frame(now){const dt=(now-last)/1000;last=now;step(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
