import {tagAssembly,renderCoverage} from './registry/render-tags.js';
import {mountWorldNavigation} from './navigation.js';
import {placeInfo} from './place-info.js';
import {createTeslaTown} from './tesla/index.js';
import {loadHy3dModels} from './hy3d/index.js';
import {WORLD_OFFSETS} from '../compiler/world-plan.js';
import {createWorldRegistry} from './registry/index.js';
import {compileWorld,WORLD_VIEWS} from '../compiler/world-plan.js';
import { isTownOpening, mapHalfHeight, openingSceneryWindow, overview, townOpening } from './overview.js';
import { CIVIC_VIEW } from './civic-quarter-plan.js';
import { SUNBEAM_VIEW } from './sunbeam-layout.js';
import { WORK_VIEWS, mountWorkUI } from './work-ui.js';
import { createCalendar } from '../life/calendar.js';
import { createWeather, mountWeatherControl } from './weather.js';
import { createAstraLighting } from './lighting.js';
import { createSkinRuntime } from './skin/index.js';
import { mountSkinPicker } from './skin/picker.js';
import { skinFromQuery } from '../skins/index.js';
import { createLightControls } from './light-controls.js';
import { createLifePanel } from './life/panel.js';
import { createTraffic } from './traffic.js';
import * as THREE from 'three';
import { createMapCamera, cameraBounds, readCameraHash } from './camera.js';
import { districtPlaceholder } from './district-placeholder.js';
import { configureGLTFTextures } from '../gltf-loader.js';
import { createDistrictStream } from './district-stream.js';
import { createModelDetail, setModelDetail } from './model-detail.js';
import { createCameraUI } from './camera-ui.js';
import { createSelection } from './selection.js';
import { compileAstra } from '../compiler/astra.js';
import { RESOLVED } from '../catalog/loader.js';
import { buildAstra } from './world.js';
import { createResidents } from './residents.js';
import { createUI, icon } from './ui.js';
import {crossingClear} from '../roads/collisions.js';
import { createSchoolEntry } from './school-interior.js';
import { weekdayOf } from './school-plan.js';
const q=new URLSearchParams(location.search);
const loading=document.createElement('div');loading.className='loading';loading.innerHTML='<div class="sprout">❧</div><h1>A little world awaits.</h1><p>Opening the shutters, putting the kettle on…</p>';document.body.append(loading);
const viewsFor=(town,rotation=0)=>({...WORLD_VIEWS,home:townOpening(town,innerWidth,innerHeight),railway:{...WORLD_VIEWS.railway,zoom:Math.min(.94,innerWidth/1200)},sunbeam:{...SUNBEAM_VIEW,zoom:innerWidth<600?4.4:SUNBEAM_VIEW.zoom},...WORK_VIEWS,works:{...WORK_VIEWS.works,zoom:innerWidth<600?2.7:WORK_VIEWS.works.zoom},civic:{...CIVIC_VIEW,zoom:innerWidth<600?3.4:CIVIC_VIEW.zoom},village:overview(town,innerWidth,innerHeight,Math.PI/4+rotation*Math.PI/2),downtown:{x:-57,z:-6,zoom:innerWidth<600?3.5:3.1},campus:{x:8,z:-70,zoom:1.8},stadium:{x:30,z:-84,zoom:2.8},baseball:{x:-22,z:-84,zoom:3.8},neighbourhood:{x:-3,z:-9,zoom:2.4},common:{x:8,z:-66,zoom:1.8},quay:{x:53,z:-1,zoom:2.3},market:{x:1,z:0,zoom:2.5},orchard:{x:-8,z:23,zoom:2.4},harvest:{x:-48,z:26.5,zoom:3.8},camp:{x:-68,z:26.5,zoom:3.8},tea:{x:55,z:-43,zoom:3.8}});
start().catch(error=>{console.error(error);loading.innerHTML='<h1>The village is taking a moment.</h1><p>Could not load the village. Check that the private asset library is available.</p>';window.__astraError=String(error);});
async function start(){
 const seed=Number(q.get('seed')??831);const town=compileWorld(RESOLVED,Number.isFinite(seed)?seed:831,{capture:q.has('registryCapture')});
 town.captureRegistry=q.has('registryCapture');const scene=new THREE.Scene();scene.background=new THREE.Color('#e8ede3');
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:q.has('capture'),powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;document.querySelector('#app').append(renderer.domElement);
 configureGLTFTextures(renderer);
 const camera=new THREE.OrthographicCamera(-60,60,40,-40,.1,3000);camera.position.set(90,90,110);camera.lookAt(0,0,0);
 let hour=Number(q.get('hour')??10.4),paused=false,speed=1,elapsed=0,following=null,selected=null,last=performance.now(),night=0;
 if(!Number.isFinite(hour))hour=10.4;hour=((hour%24)+24)%24;
 const calendar=createCalendar(town.seed,q);
 const dayQuery=q.has('day')?Number(q.get('day')):-1;
 const initialDay=Number.isInteger(dayQuery)&&dayQuery>=0&&dayQuery<7?(dayQuery+3)%7:0;
 const initialViews=viewsFor(town);
 const startView=Object.hasOwn(initialViews,q.get('view'))?q.get('view'):'home';
 const initialCamera=readCameraHash(location.hash,initialViews.home.zoom)||initialViews[startView];
 const opensAtHome=isTownOpening(initialCamera,initialViews.home);
 const initial=initialCamera.zoom>1?initialCamera:{x:0,z:0};
 // The square is built with the core town. Only its immediate dressing gates
 // Home readiness. Linked views still warm the area around their destination.
 const openingRadius=opensAtHome?24:initialCamera.zoom>1?85:innerWidth<=600?16:24;
 const isOpening=bounds=>Math.hypot(Math.max(bounds.minX-initial.x,0,initial.x-bounds.maxX),Math.max(bounds.minZ-initial.z,0,initial.z-bounds.maxZ))<=openingRadius;
 let lighting,skins;
 const enabled=window.__districtStreaming && !q.has('registryCapture');
 const stream=enabled?createDistrictStream({initial,onAttach(result){
  for(const object of Array.isArray(result)?result:[result.root])if(object)lighting?.register(object);
  if(result.root)skins?.refresh();
 }}):null;
 const detail=enabled?createModelDetail(initialCamera,{deferFull:opensAtHome}):null;
 setModelDetail(detail);
 const hy3dModels={then(resolve,reject){return loadHy3dModels().then(resolve,reject);}};
 const sceneryInFrame=opensAtHome?openingSceneryWindow(initialCamera,innerWidth/innerHeight):null;
 const buildWorld=()=>buildAstra(scene,town,{hy3dModels,stream,isOpening,detail,sceneryInFrame});
 const buildResidents=parent=>createResidents(parent,town,{hour,day:initialDay,weather:calendar.weather});
 // Keep resident meshes out of the world's registry traversal until it
 // finishes tagging the static assembly.
 const residentRoot=new THREE.Group();
 const [world,residents]=stream
  ?await Promise.all([buildWorld(),buildResidents(residentRoot)])
  :[await buildWorld(),await buildResidents(residentRoot)];
 scene.add(residentRoot);
 world.districts.civic.setActivityOwner?.('baseball',true);
 const traffic=await createTraffic(scene,town,residents,world);tagAssembly(traffic.root,'market');
 // grok-roads: residents look both ways before a crossing; regional cars also
 // see town traffic. Both read the same pure simulations the tests use.
 const townVehicles=()=>[...traffic.simulation.vehicles,...traffic.simulation.parked];
 const lotVehicles=()=>world.expansions.fairlot.sim.vehicles();
 world.expansions.fairlot.setOtherVehicles(()=>[...townVehicles(),...world.landscape.traffic.vehicles]);
 const clearRoad=(a,b)=>crossingClear(a,b,[...townVehicles(),...world.landscape.traffic.vehicles,...lotVehicles()]);
 residents.life.setCrossingGuard(clearRoad);
 residents.life.setLocalWalkGuard(world.expansions.fairlot.sim.clearWalk);
 world.landscape?.setOtherVehicles?.(()=>[...townVehicles(),...lotVehicles()]);
 // railway-loop: residents wait at a level crossing while its barriers are down.
 const railway=world.railway?.service;
 if(railway){residents.life.setRailGuard(railway.clear);railway.setCrossingGuard(clearRoad);}
 // Maple Hollow (opus-suburb): kids board and leave the school bus through the life runtime.
 if(world.landscape?.traffic?.transit)residents.life.setTransit(world.landscape.traffic.transit);
 let tesla;
 function buildTesla(parent,hy3d){
  const result=createTeslaTown(parent,town,{traffic,residents,hy3d});
  result.root.position.set(WORLD_OFFSETS.roadster[0],0,WORLD_OFFSETS.roadster[1]);tagAssembly(result.root,'roadster');
  for(const item of result.adapter.installed)tagAssembly(item.object,'market');
  return result;
 }
 if(stream){
  const bounds=town.regions.find(region=>region.id==='roadster').bounds;
  const placeholder=districtPlaceholder(town,'roadster',scene,bounds);
  stream.add('roadster',bounds,{opening:isOpening(bounds),
   load:async()=>buildTesla(new THREE.Group(),await hy3dModels),
   attach(result){scene.add(result.root);placeholder.removeFromParent();tesla=result;}
  });
 }else tesla=buildTesla(scene,await hy3dModels);
 const opening=stream?.opening();
 const raycaster=new THREE.Raycaster();
 let ui, cameraUI,activeView=null;
 const selection=createSelection(scene);
 const controls=createMapCamera(camera,renderer.domElement,{bounds:cameraBounds(town),hashZoom:()=>townOpening(town,innerWidth,innerHeight).zoom,
  onRotate(){if(activeView==='home'||activeView==='village')setView(activeView,true);},
  onInteract(kind){if(kind!=='rotate')activeView=null;following=null;ui?.view('');ui?.tooltip(null);},
  onTap:inspectPoint,
  onHover(point){const hit=point&&!window.__astra?.school?.active?pick(point.x,point.y):null;ui?.tooltip(hit?.name,point?.x,point?.y);renderer.domElement.style.cursor=hit?'pointer':'grab';},
  onChange(state){cameraUI?.update(state);detail?.update(state);const focus=controls.destination()||state;if(focus.zoom>1)stream?.prioritize(focus,80);}
 });
 const setView=(v,immediate=false)=>{following=null;selected=null;selection.select(null);if(ui){ui.root.querySelector('.card').classList.remove('open');cameraUI?.activity(null,false);}activeView=typeof v==='string'?v:null;const dest=typeof v==='string'?viewsFor(town,controls.state().rotation)[v]:v;if(dest?.zoom>1){stream?.prioritize(dest,100);detail?.preload(dest);}controls.view(dest,immediate);ui?.view(typeof v==='string'?v:'');};
 const weather=createWeather({scene,town,world,residents,renderer});
 lighting=createAstraLighting({scene,camera,controls,renderer,town});
 skins=createSkinRuntime({renderer,scene,camera,world,lighting,quality:q.get('quality')||'med',initial:skinFromQuery(q)});
 const setHour=h=>{if(Number.isFinite(h)){hour=((h%24)+24)%24;residents.setHour(hour);}};
 const zoom=factor=>controls.zoom(factor);
 const togglePause=()=>{paused=!paused;ui.paused(paused);};
 const showPerson=p=>{following=null;selected=p;selection.select({type:'person',person:p});ui.card(p.name,p.role,p.story,()=>{if(following===p){following=null;controls.cancel();}else{controls.cancel();controls.zoom(Math.max(3,camera.zoom)/camera.zoom);following=p;}});ui.root.querySelector('.portrait').innerHTML=icon('person');cameraUI.activity(p,false);};
 const closeDetails=()=>{ui.root.querySelector('.card').classList.remove('open');following=null;selected=null;selection.select(null);cameraUI.activity(null,false);};
 ui=createUI(town,{zoom,rotate:()=>controls.rotate(),view:setView,hour:setHour,unfollow:closeDetails});
 cameraUI=createCameraUI(ui.root,controls,camera);
 for(const [id,label]of [['harbor','Saltwind Harbor']]){const b=document.createElement('button');b.dataset.view=id;b.textContent=label;b.onclick=()=>setView(id);ui.root.querySelector('.view-tabs').append(b);}
 const lifePanel=createLifePanel(ui,residents),lightControls=createLightControls(ui.root,setHour,{pause:togglePause,speed(){speed=speed===1?3:speed===3?8:1;ui.speed(speed);}}),workUI=mountWorkUI(ui.root,{view:setView});mountSkinPicker(lightControls.section('skin'),skins);
 const showWeather=mountWeatherControl(lightControls.section('weather'),calendar.weather,setWeather);
 function setWeather(type){
  const next=residents.life.setWeather(type);
  if(next===type){
   const url=new URL(location.href);
   url.searchParams.set('weather',next);
   history.replaceState(history.state,'',url);
  }
  showWeather(next);
  return next;
 }
 mountWorldNavigation(ui,setView);
 // school-day: click Thistlebrook High during lessons to look into Room 4.
 const schoolDay=world.districts.civic.school;
 const school=createSchoolEntry({renderer,controls,root:ui.root,plan:schoolDay.plan,liveState:()=>schoolDay.state});
 const weekday=()=>weekdayOf(residents.life.day);
 // Resizing clears the drawing buffer; redraw even when capture has stopped RAF.
 const resize=(redraw=true)=>{renderer.setSize(innerWidth,innerHeight);world.landscape.resizeOcean(innerWidth<=600);school?.resize();const aspect=innerWidth/innerHeight,half=mapHalfHeight(aspect);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();if(activeView==='home'||activeView==='village')setView(activeView,true);if(redraw)step(0);};window.addEventListener('resize',()=>resize());resize(false);if(controls.restore())ui.view('');else setView(startView,true);
 function pick(x,y){raycaster.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);let person=residents.pick(raycaster.ray);let personDistance=person?raycaster.ray.origin.distanceTo(person.object.getWorldPosition(new THREE.Vector3())):Infinity;for(const p of world.expansions.people){if(!p.object?.visible)continue;const center=p.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.8,0)),hit=raycaster.ray.intersectSphere(new THREE.Sphere(center,.8),new THREE.Vector3());if(hit&&hit.distanceTo(raycaster.ray.origin)<personDistance){person=p;personDistance=hit.distanceTo(raycaster.ray.origin);}}let best=null,distance=Infinity;for(const b of world.selectables){const hit=raycaster.ray.intersectBox(b.bounds,new THREE.Vector3());if(hit&&raycaster.ray.origin.distanceTo(hit)<distance){best=b;distance=raycaster.ray.origin.distanceTo(hit);}}
  const vehicle=traffic.pick(raycaster.ray);if(vehicle&&vehicle.distance<distance){best=vehicle;distance=vehicle.distance;}
  if(person){const d=raycaster.ray.origin.distanceTo(person.object.getWorldPosition(new THREE.Vector3()));if(!best||d<distance+1.8)return {type:'person',person,name:person.name};}return best?{...best,name:best.data.name}:null;
 }
 function inspectPoint(x,y){if(school.active)return;const hit=pick(x,y);if(!hit){closeDetails();return;}if(hit.data?.id==='school'&&school.canEnter(hour,weekday())){closeDetails();school.enter(hour,weekday());return;}following=null;selected=null;selection.select(hit);cameraUI.activity(null,false);ui.root.querySelector('.portrait').innerHTML=icon('home');if(hit.type==='person'){showPerson(hit.person);return;}const info=placeInfo(hit.data,town);ui.card(info.name,hit.type==='traffic'?hit.data.detail:info.badge,info.story,null);}
 document.addEventListener('keydown',e=>{if(e.code==='Escape'&&school.leave()){ui.view('campus');activeView='campus';return;}if(e.code==='Escape'){closeDetails();return;}if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input, textarea, select, button, a, [contenteditable="true"]'))return;if(e.code==='Space'){e.preventDefault();togglePause();}if(e.code==='KeyH'||e.code==='Home'){e.preventDefault();setView('home');}});
 let detailTick=0;
 function step(dt,render=true){
  dt=Math.max(0,Math.min(dt,.1));
  const simDt=paused?0:dt*speed;
  if(!paused){elapsed+=simDt;hour=(hour+simDt/90)%24;}
  railway?.update(hour,simDt);
  if(!paused)residents.update(simDt,elapsed,hour);
  schoolDay.update(hour,weekday(),simDt,clearRoad,railway?.clear);
  if(!paused)traffic.update(simDt,hour);
  if(following)controls.target.lerp(following.object.getWorldPosition(new THREE.Vector3()).setY(0),1-Math.exp(-dt*5));
 controls.update(dt);detailTick+=dt;if(detailTick>.3){detail?.update(controls.state());detailTick=0;}selection.update();cameraUI.activity(selected,following===selected);lifePanel.update(selected,elapsed);
 ui.root.classList.toggle('exploring',activeView!=='village'||camera.zoom>1.4);const type=residents.life.weather;night=lighting.update(hour,type);if(tesla)tesla.update(elapsed,night);world.update(elapsed,night,hour,residents.people,weekday(),type);weather.update(type,elapsed,night,camera,controls.target);school.update(dt*(paused?0:speed),hour,weekday());workUI.update(world.works,controls,hour,camera.zoom);ui.clock(hour,weekday());lightControls.update(hour);if(render&&school.drawing)school.render();else
  if(render)skins.render(night,elapsed,hour);}
 window.__astra={get streamed(){return streamed;},stream,detail,viewReady(){const state=controls.state();return Promise.resolve(stream?.nearby(state,state.zoom>1?100:0)).then(()=>detail?.settled());},school,setWeather,get weather(){return residents.life.weather;},skin:skins,setSkin:id=>skins.setSkin(id).id,get tesla(){return tesla;},registry:createWorldRegistry(town),town,scene,camera,renderer,controls,residents,world,traffic,lighting,selection,get hour(){return hour;},get paused(){return paused;},get elapsed(){return elapsed;},get following(){return following?.name;},get speed(){return speed;},setHour,step,view:(v)=>setView(v,true),selectPerson:showPerson,pick,setPaused(v){paused=v;ui.paused(v);},audit(){return {landscape:world.landscape.audit(),report:town.report,renderRegistryErrors:renderCoverage(scene,town),tesla:tesla?.audit(),expansions:world.expansions.audit(),people:residents.people.length,cityActivities:world.districts.stats,civicActivities:world.civicQuarter.stats,works:world.works.audit(),sunbeam:world.sunbeam.stats,mapleHollow:world.mapleHollow?.audit(),life:residents.life.audit(),traffic:traffic.audit(),catalog:world.catalogActivities.audit(),lighting:{...lighting.state},weather:{type:residents.life.weather,...weather.audit()},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,positions:residents.people.map(p=>[p.name,p.object.position.x,p.object.position.z,p.activity]),hour,paused,zoom:camera.zoom,camera:controls.state()};}};
 await opening;
 if(q.get('classroom')==='1')await school.enter(hour,weekday());
 let streamed;
 step(0);
 loading.classList.add('done');window.__readyAt=performance.now();window.__ready=true;
 if(stream)streamed=new Promise(resolve=>setTimeout(()=>{
  resolve(stream.start());
  detail.start();
 },250));
 function frame(now){const dt=(now-last)/1000;last=now;step(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
