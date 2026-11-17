// Prerequisite: npm run build. No remote browser, API keys or deployment.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/village-m1/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const server=await preview({preview:{port:0,strictPort:true,host:'127.0.0.1'}});
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
let browser;
const videoOnly=process.argv.includes('--video-only');
const evidence=videoOnly?JSON.parse(readFileSync(dir+'evidence.json','utf8')):{shots:[],errors:[],video:{}};
evidence.video={};
const checkpoint=()=>writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2));
try {
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>evidence.errors.push(String(e.stack||e)));
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))evidence.errors.push(`${r.status()} ${r.url()}`);});
 async function open(name,query){
  const start=evidence.errors.length;
  try { await page.goto(`${base}/?size=large&seed=1234&life=1&prmax=1&shadowMap=512&${query}`,{waitUntil:'domcontentloaded',timeout:60000}); } catch(e) { await page.screenshot({path:dir+name+'-failed.png'});throw e; }
  try{await page.waitForFunction(()=>window.__ready===true,null,{timeout:120000});}catch(e){await page.screenshot({path:dir+name+'-failed.png'});throw e;}
  assert.equal(evidence.errors.length,start,`${name}: page/asset errors`);
 }
 // Check actual world geometry, including GLB offsets and parent transforms.
 const poses=()=>{const result=[];__scene.updateMatrixWorld(true);__scene.traverse(o=>{
  if(!o.userData.inst?.id.startsWith('townsfolk-'))return;
  const box=new __THREE.Box3().setFromObject(o,true),pos=o.getWorldPosition(new __THREE.Vector3());
  const inside=__town.instances.filter(i=>['house','landmark'].includes(i.kind)).some(i=>{
   let root;__scene.traverse(r=>{if(r.userData.inst===i)root=r;});
   const p=root.worldToLocal(pos.clone()),f=root.userData.entry.footprint;
   return p.x>=f.min[0]&&p.x<=f.max[0]&&p.z>=f.min[1]&&p.z<=f.max[1];
  });
  result.push({id:o.userData.inst.id,x:pos.x,y:pos.y,z:pos.z,feet:box.min.y,top:box.max.y,inside});
 });return result;};
 const assertPoses=rows=>{assert.equal(rows.length,12);for(const r of rows){assert(Math.abs(r.feet)<.12,`${r.id}: feet ${r.feet}`);assert(!r.inside,`${r.id}: inside footprint`);}};
 const shots=[
  ['day-overview','hour=11&view=overview'],
  ['street-level','hour=11&view=walk&cam=30,3.4,-21&target=38.6,1,-27'],
  ['market-day','hour=11&view=overview&cam=20,12,15&target=42,1,-13'],
  ['golden-hour','hour=17.5&view=overview&cam=78,40,57&target=7,1,-15'],
  ['night-windows','hour=21.5&view=overview&cam=-6,10,5&target=-26,1,27'],
  ['npcs-work','hour=11&view=overview&cam=34,5,-32&target=39.5,1,-27'],
 ];
 if(!videoOnly){
 for(const [name,query] of shots){await open(name,query);await page.screenshot({path:dir+name+'.png'});const result=await page.evaluate(()=>({hour:__life.hour,mode:__life.mode,residents:__town.instances.filter(i=>i.id.startsWith('townsfolk-')).length,checks:__town.report.checks.filter(c=>!c.warn&&!c.ok)}));const people=await page.evaluate(poses);assertPoses(people);assert.equal(result.checks.length,0);evidence.shots.push({name,...result,people});checkpoint();console.log('shot',name);}
 // Test actual player translation and overview toggle on the same entry point.
 await open('controls','hour=11&view=walk');
 const before=await page.evaluate(()=>__stage.camera.position.toArray());
 await page.keyboard.down('KeyW');
 await page.waitForFunction(p=>Math.hypot(__stage.camera.position.x-p[0],__stage.camera.position.z-p[2])>.25,before,{timeout:30000});
 await page.keyboard.up('KeyW');
 const after=await page.evaluate(()=>__stage.camera.position.toArray());assert(Math.hypot(after[0]-before[0],after[2]-before[2])>.2,'W must translate the walk camera');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>__life.mode),'overview');
 }
 // The video uses the supported post=0 switch; stills retain the full stack.
 // Read the preserved canvas directly to avoid extra compositor renders.
 // Deterministic stepping produces a 16s, 12fps movie even on SwiftShader.
 // The RAF remains the real runtime; controlled performance.now lets a slow
 // renderer record the same game duration, without speeding up NPCs separately.
 await open('video','post=0&hour=15&timescale=30&view=overview&cam=16,16,28&target=34,1,-12');
 await page.evaluate(()=>{window.__life.setTimescale(30);window.__videoNow=performance.now();window.__nativeNow=performance.now.bind(performance);performance.now=()=>window.__videoNow;});
 evidence.video.poseSamples=[];
 const frames=dir+'frames/';mkdirSync(frames,{recursive:true});
 const positions=()=>{const result=[];window.__scene.traverse(o=>{if(o.userData.inst?.id.startsWith('townsfolk-'))result.push([o.userData.inst.id,o.position.x,o.position.z]);});return result;};
 evidence.video.before={hour:await page.evaluate(()=>__life.hour),people:await page.evaluate(positions)};
 for(let frame=0;frame<192;frame++){
  const png=await page.evaluate(()=>{window.__videoNow+=1000/12;return new Promise(resolve=>requestAnimationFrame(()=>resolve(__renderer.domElement.toDataURL('image/png').split(',')[1])));});
  writeFileSync(frames+String(frame).padStart(4,'0')+'.png',Buffer.from(png,'base64'));
  if(frame%24===0){const people=await page.evaluate(poses);assertPoses(people);evidence.video.poseSamples.push({frame,hour:await page.evaluate(()=>__life.hour),people});checkpoint();console.log('video frame',frame,'/192');}
 }
 evidence.video.after={hour:await page.evaluate(()=>__life.hour),people:await page.evaluate(positions)};
 assert(evidence.video.before.people.some((p,n)=>Math.hypot(p[1]-evidence.video.after.people[n][1],p[2]-evidence.video.after.people[n][2])>1),'Video must show translating residents');
 assert(Math.abs(evidence.video.after.hour-evidence.video.before.hour)>5,'Video clock must advance');
 execFileSync('ffmpeg',['-y','-framerate','12','-i',frames+'%04d.png','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',dir+'village-life.mp4'],{stdio:'pipe'});
 for(const [name,frame] of [['start','0000'],['dusk','0060'],['night','0120'],['end','0191']])writeFileSync(dir+'video-'+name+'.png',await import('node:fs').then(fs=>fs.readFileSync(frames+frame+'.png')));
 rmSync(frames,{recursive:true,force:true});
 assert.equal(evidence.errors.length,0,'No browser or asset errors');
 console.log('village M1 captures complete');
} finally {
 writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2));
 await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));
}
