// Build first. Local Chrome + SwiftShader, no network services.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/village-m2/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const server=await preview({preview:{port:0,strictPort:true,host:'127.0.0.1'}});
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
let browser;
const videoOnly=process.argv.includes('--video-only'),stillsOnly=process.argv.includes('--stills-only');
const evidence=(videoOnly||stillsOnly)?JSON.parse(readFileSync(dir+'evidence.json','utf8')):{shots:[],errors:[],video:{}};
const checkpoint=()=>writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2));
try{
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>{evidence.errors.push(String(e.stack||e));checkpoint();});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))evidence.errors.push(`${r.status()} ${r.url()}`);});
 async function open(name,query){try{await page.goto(`${base}/?size=large&seed=1234&life=1&prmax=1&shadowMap=512&labels=1&view=overview&cam=10,5,20&target=0,1,10&${query}`,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__ready===true,null,{timeout:120000});}catch(e){await page.screenshot({path:dir+name+'-failed.png'});throw e;}}
 const poses=()=>{const result=[];__scene.updateMatrixWorld(true);__scene.traverse(o=>{if(!o.userData.inst?.id.startsWith('townsfolk-'))return;const box=new __THREE.Box3().setFromObject(o,true),pos=o.getWorldPosition(new __THREE.Vector3());const inside=__town.instances.filter(i=>['house','landmark'].includes(i.kind)).some(i=>{let root;__scene.traverse(r=>{if(r.userData.inst===i)root=r;});const p=root.worldToLocal(pos.clone()),f=root.userData.entry.footprint;return p.x>=f.min[0]&&p.x<=f.max[0]&&p.z>=f.min[1]&&p.z<=f.max[1];});result.push({id:o.userData.inst.id,x:pos.x,y:pos.y,z:pos.z,feet:box.min.y,inside});});return result;};
 const assertPoses=rows=>{assert.equal(rows.length,12);for(const r of rows){assert(Math.abs(r.feet)<.12,`${r.id}: feet ${r.feet}`);assert(!r.inside,`${r.id}: inside footprint`);}};
 async function focus(type,name=type){await page.evaluate(({type,name})=>{const e=__life.activities().find(e=>e.type===type);if(!e)throw Error('Missing activity '+type);let [x,z]=e.pos;
 const offset=name==='pair-chat'?[-6.5,3.4,.6]:name==='kids-playing'?[4.4,2.7,-3.2]:type==='greet'?[-3,3.6,-7]:type==='shop'?[7,4,5]:type==='eat'?[3,4,-9]:[9,3.8,-4];
 let targetY=1.5;
 if(name==='pair-chat')z+=.63;
 if(name==='names-labels'){const p=__town.life.graph.nodes[__town.instances.find(i=>i.id==='townsfolk-shopkeeper').workplace.node].pos;[x,z]=p;offset.splice(0,3,6,3.4,-4.7);}
 if(name==='smithy-sign'){const smith=__town.instances.find(i=>i.id==='cv-blacksmith');const sign=__town.instances.find(i=>i.id==='cv-aframe-chalkboard'&&i.facadeLot===smith.lot);[x,z]=sign.pos;offset.splice(0,3,-4,2.8,2.6);targetY=.65;}
 __stage.camera.position.set(x+offset[0],offset[1],z+offset[2]);__stage.controls.target.set(x,targetY,z);__stage.camera.lookAt(__stage.controls.target);__stage.controls.update();},{type,name});await page.waitForFunction(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))));}
 // Inspect the actual overlay render: labels must remain above their owner,
 // and every rendered text sprite must have at least 12px type at this viewport.
 async function auditLabels(){return page.evaluate(()=>{const labels=[];const render=__renderer.render;__renderer.render=function(scene,camera){if(scene!==__scene)scene.traverse(o=>{if(!o.isSprite||!o.visible||!o.userData.resident)return;let person;__scene.traverse(p=>{if(p.userData.inst?.id===o.userData.resident)person=p;});const v=o.position.clone().applyMatrix4(camera.matrixWorldInverse);const height=camera.isOrthographicCamera?o.scale.y*2*camera.zoom/(camera.top-camera.bottom):o.scale.y/(-v.z*Math.tan(camera.fov*Math.PI/360));labels.push({id:o.userData.resident,kind:o.userData.kind,anchorError:Math.hypot(o.position.x-person.position.x,o.position.z-person.position.z),typePixels:height*720/6,screen:o.position.clone().project(camera).toArray()});});return render.call(this,scene,camera);};return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{__renderer.render=render;resolve(labels);})));});}
 function assertLabels(labels){for(const l of labels){assert(l.anchorError<.001,`${l.id}: detached label`);assert(l.typePixels>=12,`${l.id}: unreadable text`);}}
 if(!videoOnly){
  evidence.shots=[];
  await open('greeting','hour=9.021');
  evidence.runtime=await page.evaluate(()=>{if(__ready!==true||typeof __life.activities!=='function'||typeof __life.setHour!=='function'||typeof __life.setTimescale!=='function')throw Error('Life hooks broken');const checks=[];for(const h of [9.021,12.021,17,22]){__life.setHour(h);const first=JSON.stringify(__life.activities());__life.setHour(h);if(first!==JSON.stringify(__life.activities()))throw Error('Nonrepeatable seek '+h);const events=__life.activities();if(h===17&&!events.some(e=>e.type==='play'))throw Error('Missing late play');if(h===22&&events.length)throw Error('Night activity did not release');checks.push({hour:h,events,repeatable:true});}return {hooks:true,checks};});checkpoint();
  for(const [name,type,hour] of [['greeting','greet',9.021],['pair-chat','chat',12.021],['shopping','shop',12.021],['inn-meal','eat',12.021],['kids-playing','play',12.021],['names-labels','chat',12.021],['smithy-sign','greet',9.021]]){
   await page.evaluate(h=>__life.setHour(h),hour);await focus(type,name);const labels=await auditLabels();assertLabels(labels);if(name==='pair-chat')assert(labels.some(l=>l.id==='townsfolk-elder'&&l.kind==='name'),'Ada name visible');const events=await page.evaluate(()=>__life.activities());assert(events.some(e=>e.type===type));const people=await page.evaluate(poses);assertPoses(people);await page.screenshot({path:dir+name+'.png'});evidence.shots.push({name,hour,events,people,labels,camera:await page.evaluate(()=>({position:__stage.camera.position.toArray(),target:__stage.controls.target.toArray()}))});checkpoint();console.log('shot',name);
  }
  await page.evaluate(()=>__life.setHour(21.5));await page.evaluate(()=>{__stage.camera.position.set(-6,10,5);__stage.controls.target.set(-26,1,27);__stage.controls.update();});await page.screenshot({path:dir+'night-grass.png'});evidence.shots.push({name:'night-grass',hour:21.5,people:await page.evaluate(poses)});assertPoses(evidence.shots.at(-1).people);checkpoint();assert.equal(evidence.errors.length,0);console.log('village M2 stills complete');
 }
 if(!stillsOnly){
 // Video keeps toon shading, with post/hulls/shadow maps off for SwiftShader.
 // Two live social scenes in one continuous game clock: chat + Pip's ball.
 if(videoOnly)await open('video','post=0&hour=12.021&timescale=0.25');
 await page.evaluate(()=>{__post.setOptions({post:false,hull:false});__renderer.shadowMap.enabled=false;__life.setHour(12.021);__life.setTimescale(.25);});await focus('chat');
 await page.evaluate(()=>{window.__videoNow=performance.now();performance.now=()=>window.__videoNow;});
 evidence.video={poseSamples:[],types:[]};const frames=dir+'frames/';mkdirSync(frames,{recursive:true});
 for(let frame=0;frame<144;frame++){
  const png=await page.evaluate(()=>{window.__videoNow+=1000/12;return new Promise(resolve=>requestAnimationFrame(()=>resolve(__renderer.domElement.toDataURL('image/png').split(',')[1])));});writeFileSync(frames+String(frame).padStart(4,'0')+'.png',Buffer.from(png,'base64'));
  if(frame%24===0){const people=await page.evaluate(poses);assertPoses(people);const labels=await auditLabels();assertLabels(labels);const events=await page.evaluate(()=>__life.activities());evidence.video.types=[...new Set([...evidence.video.types,...events.map(e=>e.type)])];evidence.video.poseSamples.push({frame,hour:await page.evaluate(()=>__life.hour),people,events,labels});checkpoint();console.log('video frame',frame,'/144');}
 }
 assert(evidence.video.types.includes('chat')&&evidence.video.types.includes('play'),'Two social behaviors required');
 execFileSync('ffmpeg',['-y','-framerate','12','-i',frames+'%04d.png','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',dir+'village-life.mp4'],{stdio:'pipe'});
 for(const [name,frame] of [['start','0000'],['mid','0072'],['end','0143']])writeFileSync(dir+'video-'+name+'.png',readFileSync(frames+frame+'.png'));
 rmSync(frames,{recursive:true,force:true});assert.equal(evidence.errors.length,0);console.log('village M2 captures complete');
 }
}finally{checkpoint();await browser?.close();await new Promise(r=>server.httpServer.close(r));}
