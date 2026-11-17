import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/village-iso/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const stillsOnly=process.argv.includes('--stills-only'),videoOnly=process.argv.includes('--video-only');
assert(!(stillsOnly&&videoOnly));
const evidence=existsSync(dir+'evidence.json')?JSON.parse(readFileSync(dir+'evidence.json','utf8')):{};
evidence.errors=[];
const checkpoint=()=>writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2));
const server=await preview({preview:{port:0,host:'127.0.0.1'}});
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 page.on('pageerror',e=>{evidence.errors.push(String(e));checkpoint();});
 page.on('console',m=>{if(m.type()==='error')evidence.errors.push(m.text());});
 await page.goto(`${server.resolvedUrls.local[0]}?size=medium&seed=1234&life=1&hour=10&timescale=0&prmax=1&shadowMap=1024#12.50,-8.00,2.7500,h90`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:120000,polling:200});
 console.log('iso ready');
 evidence.startupHash=await page.evaluate(()=>__iso.state);assert(Math.abs(evidence.startupHash.x-12.5)<1e-6);assert.equal(evidence.startupHash.zoom,2.75);assert.equal(evidence.startupHash.heading,90);
 await page.evaluate(()=>{const b=__iso.bounds;__iso.setView({x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2,zoom:1,heading:0},{immediate:true});});
 const audit=()=>page.evaluate(()=>({camera:__stage.camera.type,state:__iso.state,bounds:__iso.bounds,people:__iso.interact.records.filter(r=>r.person).length,post:{...__post.options},hash:location.hash,interior:__life.interior,clock:document.querySelector('#iso-clock').textContent,diorama:__stage.scene.userData.isoDiorama,gardens:__stage.scene.userData.isoGardens,forestTrees:__stage.scene.userData.isoForestTrees,fog:__stage.scene.fog,shadow:{left:__stage.sun.shadow.camera.left,right:__stage.sun.shadow.camera.right,near:__stage.sun.shadow.camera.near,far:__stage.sun.shadow.camera.far},neighbours:__stage.scene.children.filter(o=>o.name==='iso-neighbour').length}));
 const render=()=>page.evaluate(()=>{__life.step(0);__post.render(__stage.camera);});
 const view=async s=>{await page.evaluate(s=>__iso.setView(s,{immediate:true}),s);await render();};
 const shot=async name=>{await page.screenshot({path:dir+name+'.png'});console.log('shot',name);return {name,...await audit()};};
 const start=await audit();assert.equal(start.fog,null);assert(start.gardens>0);assert(start.forestTrees>0);assert.equal(start.neighbours,12);assert.equal(start.camera,'OrthographicCamera');assert.equal(start.people,12);
 evidence.initial=start;
 if(!videoOnly){
 evidence.checks=await page.evaluate(()=>{
  const camera=__iso,initial=camera.state;
  const point=camera.ground(790,390).clone();camera.zoomAt(1.7,790,390);for(let i=0;i<120;i++)camera.update(1/60);const error=point.distanceTo(camera.ground(790,390));
  camera.setView({x:1e7,z:-1e7,zoom:1e9,heading:90},{immediate:true});const clamped=camera.state;
  __stage.setMode('persp');const forcedIso=__stage.camera.isOrthographicCamera;
  camera.setView(initial,{immediate:true});
  const d=__stage.camera.position.clone().sub(__stage.controls.target);return {cursorError:error,clamped,forcedIso,elevation:Math.atan2(d.y,Math.hypot(d.x,d.z))*180/Math.PI,lookHidden:getComputedStyle(document.querySelector('#look')).display==='none'};
 });
 assert(evidence.checks.cursorError<1e-6,JSON.stringify(evidence.checks));assert(evidence.checks.forcedIso);assert(evidence.checks.lookHidden);assert(Math.abs(evidence.checks.elevation-35.26438968)<1e-6);assert.equal(evidence.checks.clamped.zoom,8);
 // Actual input paths: wheel, right drag, Q/E, F, and an NPC ray hit.
 await page.mouse.move(640,360);await page.mouse.wheel(0,-180);
 await page.evaluate(()=>{for(let i=0;i<100;i++)__life.step(1/60);});
 assert((await audit()).state.zoom>start.state.zoom);
 await page.keyboard.press('q');await page.evaluate(()=>{for(let i=0;i<100;i++)__life.step(1/60);});assert.equal((await audit()).state.heading,270);
 await page.keyboard.press('f');assert.equal(await page.evaluate(()=>__life.hour),13);await page.evaluate(()=>__life.setHour(10));
 await page.mouse.move(600,360);await page.mouse.down({button:'right'});await page.mouse.move(700,400,{steps:8});await page.mouse.up({button:'right'});await page.evaluate(()=>{for(let i=0;i<100;i++)__life.step(1/60);});
 evidence.afterInput=await audit();
 await view({...start.state,zoom:2});
 const client=await page.context().newCDPSession(page);
 const touchBefore=(await audit()).state.zoom;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:540,y:360},{x:740,y:360}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:500,y:360},{x:780,y:360}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.evaluate(()=>{for(let i=0;i<100;i++)__life.step(1/60);});
 evidence.touchZoom=(await audit()).state.zoom;assert(evidence.touchZoom>touchBefore);
 await page.evaluate(()=>{location.hash='#12.50,-8.00,2.7500,h90';});
 await page.waitForFunction(()=>__iso.state.heading===90);
 await page.evaluate(()=>{for(let i=0;i<100;i++)__life.step(1/60);});
 const loaded=(await audit()).state;assert(Math.abs(loaded.x-12.5)<1e-5);assert(Math.abs(loaded.zoom-2.75)<1e-5);
 evidence.hashChange=loaded;
 const npcPoint=await page.evaluate(()=>{
  for(const r of __iso.interact.records.filter(r=>r.person)){
   __iso.setView({x:r.object.position.x,z:r.object.position.z,zoom:6,heading:0},{immediate:true});
   const p=r.object.position.clone();p.y+=1;p.project(__stage.camera);const x=(p.x+1)*640,y=(1-p.y)*360;
   if(__iso.pick(x,y)?.person===r.person)return {x,y,id:r.instance.id,name:r.name};
  }return null;
 });
 assert(npcPoint,'A resident is clickable');
 await page.mouse.move(npcPoint.x,npcPoint.y);
 assert.equal(await page.locator('#iso-tooltip').textContent(),npcPoint.name);
 await page.mouse.click(npcPoint.x,npcPoint.y);
 assert.equal(await page.evaluate(()=>__iso.following?.userData.inst.id),npcPoint.id);
 await page.evaluate(()=>{__life.step(.1);});
 assert((await page.locator('#iso-card').textContent()).includes(npcPoint.name));
 await page.getByRole('button',{name:'Close inspection'}).click();
 assert.equal(await page.evaluate(()=>__iso.following),null);
 evidence.pointerNpc=npcPoint;
 await page.mouse.move(5,5);
 }
 const cluster={x:20,z:-36};
 if(!videoOnly){
  evidence.shots=[];
  await view({...start.state,zoom:1,heading:0});evidence.shots.push(await shot('overview'));
  await view({...cluster,zoom:2.6,heading:0});evidence.shots.push(await shot('mid-zoom'));
  await view({...cluster,x:28,z:-24,zoom:5,heading:0});evidence.shots.push(await shot('close'));
  // Select through the same hit record used by pointer clicks.
  await page.evaluate(()=>{const r=__iso.interact.records.find(r=>r.person&&r.instance.id==='townsfolk-baker');__iso.select(r);for(let i=0;i<100;i++)__life.step(1/60);});await render();
  assert(await page.evaluate(()=>!!__iso.following));evidence.shots.push(await shot('npc-card'));
  await page.evaluate(()=>{__iso.cancel();const r=__iso.interact.records.find(r=>r.instance.id==='cv-bakery');__iso.select(r);});await render();
  assert.equal((await audit()).interior.id,'bakery');evidence.shots.push(await shot('building-peek'));
  await page.getByRole('button',{name:'Close inspection'}).click();assert.equal((await audit()).interior,null);
 }
 checkpoint();
 if(!stillsOnly){
  // Post remains on for the film; deterministic on-demand steps avoid live-frame contention.
  const frames=dir+'frames/';
  const resume=videoOnly&&evidence.video?.renderedKeyframes===96&&Array.from({length:96},(_,f)=>frames+String(f).padStart(4,'0')+'.png').every(p=>existsSync(p)&&readFileSync(p).subarray(-12).equals(Buffer.from('0000000049454e44ae426082','hex')));
  if(!resume)rmSync(frames,{recursive:true,force:true});mkdirSync(frames,{recursive:true});
  if(resume)console.log('reusing 96 complete post-rendered keyframes');
  evidence.video={file:'village-iso.mp4',post:true,fps:24,frames:576,renderedKeyframes:96,keyframeFps:4,interpolation:'ffmpeg minterpolate motion compensation',seconds:24};
  await page.mouse.move(5,5);
  await page.evaluate(()=>{__life.setHour(10);__life.setTimescale(12);});
  const beforePeople=await page.evaluate(()=>__iso.interact.records.filter(r=>r.person).map(r=>r.object.position.toArray()));
  for(let f=0;f<96;f++){
   const t=f/95,ease=t*t*(3-2*t);
   await page.evaluate(f=>__life.step(.25, f*.25),f);
   const state={x:start.state.x+(28-start.state.x)*ease,z:start.state.z+(-24-start.state.z)*ease,zoom:1+4*ease,heading:0};
   if(resume)await page.evaluate(s=>{__iso.setView(s,{immediate:true});__life.step(0);},state);
   else{await view(state);await page.screenshot({path:frames+String(f).padStart(4,'0')+'.png'});}
   if(f%4===0){console.log('video keyframe',f,'/96');checkpoint();}
  }
  evidence.video.timescale=await page.evaluate(()=>__life.timescale);
  evidence.video.movingResidents=await page.evaluate(before=>__iso.interact.records.filter(r=>r.person).filter((r,n)=>r.object.position.toArray().some((v,k)=>Math.abs(v-before[n][k])>.01)).length,beforePeople);assert(evidence.video.movingResidents>0);
  checkpoint();
  execFileSync('ffmpeg',['-y','-framerate','4','-i',frames+'%04d.png','-vf','minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,setpts=PTS-STARTPTS,fps=24,tpad=stop_mode=clone:stop=24','-t','24','-frames:v','576','-r','24','-fps_mode','cfr','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',dir+'village-iso.mp4'],{stdio:'pipe'});
  evidence.video.probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height,pix_fmt,duration,nb_frames','-of','json',dir+'village-iso.mp4'],{encoding:'utf8'}));
  const s=evidence.video.probe.streams[0];assert.equal(s.width,1280);assert.equal(s.height,720);assert.equal(s.codec_name,'h264');assert.equal(s.pix_fmt,'yuv420p');assert.equal(Number(s.duration),24);assert.equal(Number(s.nb_frames),576);rmSync(frames,{recursive:true,force:true});
 }
 assert.equal(evidence.errors.length,0,JSON.stringify(evidence.errors));
}finally{checkpoint();await browser?.close();await new Promise(r=>server.httpServer.close(r));}
