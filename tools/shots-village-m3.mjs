// Local-only M3 evidence. Build first; private assets stay in public/licensed.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { compileTown } from '../src/compiler/compile.js';
import { validateSpec } from '../src/compiler/spec.js';
const dir=new URL('../shots/village-m3/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const videoOnly=process.argv.includes('--video-only'),stillsOnly=process.argv.includes('--stills-only');
const evidence=videoOnly&&existsSync(dir+'evidence.json')?JSON.parse(readFileSync(dir+'evidence.json','utf8')):{shots:[],errors:[],runtime:[],video:{}};
const checkpoint=()=>writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2)+'\n');
// Frozen in this worktree before M3. Parity also checks the earlier fixtures.
const baseline=new URL('../out/codex-village-m3-baseline.json',import.meta.url);
const cat=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
evidence.lifeOffHashes={};
for(const size of ['hamlet','large'])for(const seed of [1,7,19,1234]){
 const spec=validateSpec(JSON.parse(readFileSync(new URL(`../specs/${size}.json`,import.meta.url))),cat);
 evidence.lifeOffHashes[size+seed]=createHash('sha256').update(JSON.stringify(compileTown(spec,cat,{seed}))).digest('hex');
}
if(existsSync(baseline))assert.deepEqual(evidence.lifeOffHashes,JSON.parse(readFileSync(baseline)),'life-off hashes unchanged');
const server=await preview({preview:{port:0,strictPort:true,host:'127.0.0.1'}}),base=server.resolvedUrls.local[0].replace(/\/$/,'');
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>{evidence.errors.push(String(e.stack||e));checkpoint();});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))evidence.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`${base}/?size=large&seed=1234&life=1&hour=16&timescale=0&prmax=1&shadowMap=512&post=0`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:120000});
 await page.evaluate(()=>{document.getElementById('look')?.classList.add('collapsed');window.__captureNow=performance.now();performance.now=()=>window.__captureNow;});
 // Advance the live update loop using M2's deterministic recording clock.
 async function tick(n=1){for(let i=0;i<n;i++)await page.evaluate(()=>{window.__captureNow+=1000/12;return new Promise(resolve=>requestAnimationFrame(()=>resolve(true)));});}
 async function press(code){await page.keyboard.press(code);await tick();}
 async function pose(x,z,yaw=0){await page.evaluate(({x,z,yaw})=>{const c=__life.interiors,r=c.rooms.find(r=>r.id===__life.interior.id);c.player.position.set(r.origin[0]+x,0,r.origin[1]+z);c.player.rotation.y=yaw+Math.PI;c.view(yaw);},{x,z,yaw});await tick();}
 async function outside(id,offset=0){await page.evaluate(({id,offset})=>{const c=__life.interiors,d=c.plan.find(r=>r.id===id);c.player.position.set(d.trigger[0]+Math.sin(d.rotation)*offset,0,d.trigger[1]+Math.cos(d.rotation)*offset);},{id,offset});await tick(3);}
 const inspect=()=>page.evaluate(()=>__life.interiors.inspect());
 async function exit(){await pose(0,4.25);assert.equal((await inspect()).prompt,'exit');await press('e');await tick(8);assert.equal(await page.evaluate(()=>__life.interior),null);}
 async function enter(id){await outside(id);assert.equal((await inspect()).prompt,'door');await press('e');await tick(8);assert.equal(await page.evaluate(()=>__life.interior?.id),id);}
 async function shot(name){
  await page.evaluate(()=>__post.setOptions({post:true,hull:true}));await tick(2);await page.screenshot({path:dir+name+'.png'});
  evidence.shots.push({name,...await inspect(),camera:await page.evaluate(()=>({position:__stage.camera.position.toArray(),quaternion:__stage.camera.quaternion.toArray()}))});checkpoint();console.log('shot',name);
  await page.evaluate(()=>__post.setOptions({post:false}));await tick();
 }
 assert.equal(await page.evaluate(()=>__life.interiors.plan.length),4);
 const fixtures=await page.evaluate(()=>__life.interiors.inspect().fixtures);assert.equal(fixtures.length,8);assert(fixtures.every(f=>f.fixture&&f.on&&f.light>0));
 if(!videoOnly){
  evidence.shots=[];evidence.runtime=[];
  for(const id of ['bakery','inn','store','smithy']){
   await enter(id);
   await press('Tab');assert.equal(await page.evaluate(()=>__life.mode),'walk','overview key keeps indoor camera safe');
   await page.evaluate(()=>__stage.setMode('iso'));assert.equal(await page.evaluate(()=>__life.mode),'walk','Look mode keeps indoor camera safe');
   // Walk against the side wall; furniture is checked separately below.
   await pose(5.2,0);await page.keyboard.down('d');await tick(8);await page.keyboard.up('d');
   const wall=await inspect();assert(wall.local[0]<=5.65&&wall.local[0]>5.4,'room wall collision');
   if(id==='bakery'||id==='store'){
    await pose(-.6,.5);await page.keyboard.down('w');await tick(12);await page.keyboard.up('w');
    const counter=await inspect();assert(counter.local[1]>=-.44,'counter collision');assert.equal(counter.prompt,'counter');await press('e');
   }
   await tick(31);await pose(0,2.1);await shot(id);
   const feet=await page.evaluate(()=>new __THREE.Box3().setFromObject(__life.interiors.player).min.y);assert(Math.abs(feet)<.12,`${id}: grounded feet ${feet}`);
   evidence.runtime.push({id,keyboardEntry:true,roomWallCollision:true,counterCollision:['bakery','store'].includes(id),feet});
   if(id==='bakery'){
    await pose(-3.5,2.7,.45);assert.equal((await inspect()).prompt,'lamp');
    await press('e');let f=(await inspect()).fixtures.find(f=>f.room==='bakery');assert(!f.on&&f.light===0,'lantern off');
    await press('e');f=(await inspect()).fixtures.find(f=>f.room==='bakery');assert(f.on&&f.light>0,'lantern on');await shot('lantern');
    await pose(0,3.4,Math.PI);await tick(31);await shot('doorway');
   }
   await exit();const after=await inspect(),door=await page.evaluate(id=>__life.interiors.plan.find(r=>r.id===id).trigger,id);assert(Math.hypot(after.player[0]-door[0],after.player[2]-door[1])<.01,'safe exterior return');
   evidence.runtime.at(-1).keyboardExit=true;
  }
  // Verify the original exterior footprint still stops walking at a facade.
  await outside('bakery');await page.keyboard.down('w');await tick(18);await page.keyboard.up('w');
  const exterior=await page.evaluate(()=>{const c=__life.interiors,p=c.player.position,i=__town.instances.find(i=>i.id==='cv-bakery');let entry;__scene.traverse(o=>{if(o.userData.inst===i)entry=o.userData.entry;});const dx=p.x-i.pos[0],dz=p.z-i.pos[1],x=dx*Math.cos(i.rotY)-dz*Math.sin(i.rotY),z=dx*Math.sin(i.rotY)+dz*Math.cos(i.rotY),f=entry.footprint;return {player:p.toArray(),inside:x>f.min[0]&&x<f.max[0]&&z>f.min[1]&&z<f.max[1],interior:__life.interior};});
  assert(!exterior.inside&&exterior.interior===null,'exterior wall still solid');evidence.exteriorWall=exterior;
  // A real market stall exposes a use prompt outdoors.
  await page.evaluate(()=>{const s=__town.instances.find(i=>i.id==='cv-market-stall');__life.interiors.player.position.set(s.pos[0],0,s.pos[1]+2);});await tick();assert.equal((await inspect()).prompt,'stall');await press('e');evidence.stallUse=true;
  // Direct capture URL: hooks and immediate room entry survive a fresh load.
  const direct=await browser.newPage({viewport:{width:640,height:360}});direct.on('pageerror',e=>evidence.errors.push(String(e)));
  await direct.goto(`${base}/?size=large&seed=1234&life=1&interior=store&post=0&prmax=1&shadowMap=256`,{waitUntil:'domcontentloaded'});await direct.waitForFunction(()=>window.__ready===true,null,{timeout:120000});assert.equal(await direct.evaluate(()=>__life.interior?.id),'store');evidence.directInteriorQuery=true;await direct.close();
  checkpoint();console.log('M3 keyboard, collision, fixture, feet and query checks passed');
 }
 if(!stillsOnly){
  await page.evaluate(()=>{__post.setOptions({post:false,hull:false});__renderer.shadowMap.enabled=false;});
  await outside('bakery',2.4);await tick(12);
  const frames=dir+'frames/';mkdirSync(frames,{recursive:true});evidence.video={samples:[],lanternOff:false,lanternOn:false};
  for(let frame=0;frame<144;frame++){
   // Actual WASD/E input in one uninterrupted street → bakery → lantern tour.
   if(frame===0)await page.keyboard.down('w');
   if(frame===18){await page.keyboard.up('w');await page.keyboard.press('e');}
   if(frame===30)await page.keyboard.down('w');
   if(frame===47)await page.keyboard.up('w');
   if(frame===48)await page.keyboard.press('e');
   if(frame===60)await page.keyboard.down('s');
   if(frame===68)await page.keyboard.up('s');
   if(frame===70)await page.keyboard.down('a');
   if(frame===85)await page.keyboard.up('a');
   if(frame===88||frame===100)await page.keyboard.press('e');
   if(frame===105)await page.keyboard.down('d');
   if(frame===118)await page.keyboard.up('d');
   if(frame===120)await page.keyboard.down('s');
   if(frame===137)await page.keyboard.up('s');
   await tick(); // Include the real DOM fade and interaction prompts in the movie.
   writeFileSync(frames+String(frame).padStart(4,'0')+'.png',await page.screenshot());
   if(frame%12===0||[88,100,143].includes(frame)){
    const sample=await inspect();evidence.video.samples.push({frame,...sample});if(frame===88)evidence.video.lanternOff=!sample.fixtures.find(f=>f.room==='bakery').on;if(frame===100)evidence.video.lanternOn=sample.fixtures.find(f=>f.room==='bakery').on;checkpoint();console.log('video frame',frame,'/144',sample.active,sample.prompt);
   }
  }
  assert(evidence.video.samples.some(s=>s.active==='bakery'),'movie entered bakery');assert(evidence.video.samples.some(s=>s.active===null),'movie includes street');
  assert(evidence.video.lanternOff&&evidence.video.lanternOn,'movie lights and extinguishes a fixture');
  assert.equal(evidence.video.samples.at(-1).active,null,'movie walks through the exit');evidence.video.automaticExit=true;
  execFileSync('ffmpeg',['-y','-framerate','12','-i',frames+'%04d.png','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',dir+'village-interiors.mp4'],{stdio:'pipe'});
  for(const [name,frame] of [['start','0000'],['transition','0021'],['inside','0048'],['lantern','0100'],['end','0143']])writeFileSync(dir+'video-'+name+'.png',readFileSync(frames+frame+'.png'));
  evidence.video.format=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',dir+'village-interiors.mp4'],{encoding:'utf8'}));
  const stream=evidence.video.format.streams.find(s=>s.codec_type==='video');assert.equal(stream.width,1280);assert.equal(stream.height,720);assert.equal(stream.pix_fmt,'yuv420p');assert.equal(Number(evidence.video.format.format.duration),12);
  rmSync(frames,{recursive:true,force:true});
 }
 assert.equal(evidence.errors.length,0,JSON.stringify(evidence.errors));checkpoint();console.log('M3 evidence complete');
}finally{checkpoint();await browser?.close();await new Promise(r=>server.httpServer.close(r));}
