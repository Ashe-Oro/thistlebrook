// Local evidence: post remains ON throughout; 24 seconds at 8 fps.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/village-life/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const server=await preview({preview:{port:0,strictPort:true,host:'127.0.0.1'}});
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
const videoOnly=process.argv.includes('--video-only'),stillsOnly=process.argv.includes('--stills-only');
const evidence=existsSync(dir+'evidence.json')?JSON.parse(readFileSync(dir+'evidence.json','utf8')):{shots:[],errors:[]};
evidence.errors=[];
const save=()=>writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2));
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>{evidence.errors.push(String(e.stack||e));save();});
 await page.goto(`${base}/?size=large&seed=1234&life=1&prmax=1&shadowMap=512&kuwahara=2&labels=1&view=overview&hour=9.021&weekday=wed&weather=clear`,{timeout:60000});
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:120000});
 assert.equal(await page.evaluate(()=>__post.options.post),true,'post stack must remain on');
 evidence.post=await page.evaluate(()=>({...__post.options}));
 const poses=()=>{const result=[];__scene.updateMatrixWorld(true);__scene.traverse(o=>{if(!o.userData.inst?.id.startsWith('townsfolk-'))return;const box=new __THREE.Box3().setFromObject(o,true),pos=o.getWorldPosition(new __THREE.Vector3());const inside=__town.instances.filter(i=>['house','landmark'].includes(i.kind)).some(i=>{let root;__scene.traverse(r=>{if(r.userData.inst===i)root=r;});const p=root.worldToLocal(pos.clone()),f=root.userData.entry.footprint;return p.x>=f.min[0]&&p.x<=f.max[0]&&p.z>=f.min[1]&&p.z<=f.max[1];});result.push({id:o.userData.inst.id,x:pos.x,y:pos.y,z:pos.z,feet:box.min.y,inside});});return result;};
 const assertPoses=rows=>{assert.equal(rows.length,12);for(const r of rows){assert(Math.abs(r.feet)<.12,`${r.id}: feet ${r.feet}`);assert(!r.inside,`${r.id}: inside footprint`);}};

 async function focus(id,hour,offset=[-6.5,3.4,.6]){
  await page.evaluate(({id,hour,offset})=>{__life.setHour(hour);const p=__life.context(id).location;__stage.camera.position.set(p[0]+offset[0],offset[1],p[1]+offset[2]);__stage.controls.target.set(p[0],1.4,p[1]);__stage.controls.update();},{id:'townsfolk-'+id,hour,offset});
  await page.waitForFunction(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))));
 }
 const beats=[['morning-work','baker',8,[-4,3.5,-7]],['smithy-greeting','baker',9.021,[-3,3.6,-7]],['plaza-stories','elder',12.021,[-6.5,3.4,.6]],['inn-meal','farmhand',12.021,[-5,3.6,5]],['flowers-for-fern','farmhand',16.5,[-6.5,3.4,.6]],['lamplighter','watch',20.5,[6,4,5]]];
 if(!videoOnly){evidence.shots=[];for(const [name,id,hour,offset] of beats){
  await focus(id,hour,offset);const people=await page.evaluate(poses);assertPoses(people);
  const contexts=await page.evaluate(()=>__life.contexts());assert.equal(contexts.length,12);assert(contexts.every(c=>c.currentAction));
  await page.screenshot({path:dir+name+'.png'});evidence.shots.push({name,hour,people,contexts,events:await page.evaluate(()=>__life.activities())});save();console.log('shot',name);
 }
 evidence.hooks=await page.evaluate(()=>({weekday:__life.weekday,weather:__life.weather,planner:__life.planner.kind,tools:__life.tools().map(t=>t.name)}));save();}
 if(!stillsOnly){
  const frames=dir+'frames/';mkdirSync(frames,{recursive:true});
  await page.evaluate(()=>{window.__videoNow=performance.now();performance.now=()=>window.__videoNow;__life.setTimescale(.25);});
  const resume=process.argv.includes('--resume');
  let start=0;if(resume)while(start<192&&existsSync(frames+String(start).padStart(4,'0')+'.png'))start++;
  if(!resume)evidence.video={seconds:24,fps:8,post:true,samples:[]};
  const limit=Number(process.argv.find(a=>a.startsWith('--frames='))?.split('=')[1]??192),end=Math.min(192,start+limit);
  for(let frame=start;frame<end;frame++){
   const section=Math.floor(frame/64),beat=beats[[1,2,4][section]];
   if(frame%64===0||frame===start)await focus(beat[1],beat[2]+(frame%64)/8*.25/60,beat[3]);
   const png=await page.evaluate(({frame,offset,id})=>{const p=__life.context('townsfolk-'+id).location,t=(frame%64)/63,angle=(t-.5)*.18,dx=offset[0]*Math.cos(angle)-offset[2]*Math.sin(angle),dz=offset[0]*Math.sin(angle)+offset[2]*Math.cos(angle);__stage.camera.position.set(p[0]+dx,offset[1]+t*.25,p[1]+dz);__stage.controls.target.set(p[0],1.5,p[1]);__stage.controls.update();window.__videoNow+=125;return new Promise(resolve=>requestAnimationFrame(()=>resolve(__renderer.domElement.toDataURL('image/png').split(',')[1])));},{frame,offset:beat[3],id:beat[1]});
   writeFileSync(frames+String(frame).padStart(4,'0')+'.png',Buffer.from(png,'base64'));
   if(frame%32===0){const people=await page.evaluate(poses);assertPoses(people);evidence.video.samples.push({frame,people,contexts:await page.evaluate(()=>__life.contexts()),events:await page.evaluate(()=>__life.activities())});save();console.log('video',frame,'/192');}
  }
  if(end<192){save();console.log('checkpoint',end,'/192; continue with --video-only --resume');}else{
  execFileSync('ffmpeg',['-y','-framerate','8','-i',frames+'%04d.png','-vf','scale=1280:720','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',dir+'village-life.mp4'],{stdio:'pipe'});
  for(const [name,frame] of [['start','0000'],['mid','0096'],['end','0191']])writeFileSync(dir+'video-'+name+'.png',readFileSync(frames+frame+'.png'));
  rmSync(frames,{recursive:true,force:true});save();
  }
 }
 assert.equal(evidence.errors.length,0);console.log('village life evidence complete');
}finally{save();await browser?.close();await new Promise(r=>server.httpServer.close(r));}
