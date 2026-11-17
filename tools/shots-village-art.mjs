// Local owned-asset audit + Chrome/SwiftShader capture. Build first.
import { chromium } from 'playwright-core';
import { preview, createServer } from 'vite';
import { createServer as createHttpServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const dir=new URL('../shots/village-art/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const videoOnly=process.argv.includes('--video-only');
const lineupOnly=process.argv.includes('--lineup-only');
const evidence=(videoOnly||lineupOnly)?JSON.parse(readFileSync(dir+'evidence.json','utf8')):{errors:[],checks:[],shots:[]};evidence.errors=[];evidence.checks=[];
const checkpoint=()=>writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2));
// Exercise the same runtime planner without rendering. Include rejected placements.
const ssr=await createServer({server:{middlewareMode:true,hmr:{server:createHttpServer()},watch:null},appType:'custom'});
try{
 const {RESOLVED}=await ssr.ssrLoadModule('/src/catalog/loader.js');
 const {compileTown}=await ssr.ssrLoadModule('/src/compiler/compile.js');
 const {validateSpec}=await ssr.ssrLoadModule('/src/compiler/spec.js');
 const {planDressing,auditDressing}=await ssr.ssrLoadModule('/src/life/dressing-runtime.js');
 const hashes={};
 for(const size of ['hamlet','large'])for(const seed of [1,7,19,1234]){
  const spec=validateSpec(JSON.parse(readFileSync(new URL(`../specs/${size}.json`,import.meta.url))),RESOLVED);
  const off=compileTown(spec,RESOLVED,{seed}),before=JSON.stringify(off);assert.deepEqual(planDressing(off),[]);
  hashes[size+seed]=createHash('sha256').update(before).digest('hex');
  if(size==='hamlet')continue;
  const town=compileTown(spec,RESOLVED,{seed,life:true}),snapshot=JSON.stringify(town),rows=planDressing(town);
  assert.deepEqual(rows,planDressing(town));assert.equal(JSON.stringify(town),snapshot);assert(rows.length>50);
  const audit=auditDressing(town,rows);assert.deepEqual(audit.violations,[]);
  const building=town.instances.find(i=>i.kind==='house');
  assert(auditDressing(town,[{...rows[0],pos:building.pos}]).violations.length>0,'Building negative');
  const path=town.instances.find(i=>i.kind==='path');
  assert(auditDressing(town,[{...rows[0],pos:path.pos}]).violations.length>0,'Path negative');
  assert(auditDressing(town,[rows[0],rows[0]]).violations.length>0,'Duplicate negative');
  evidence.checks.push({seed,count:rows.length,zones:Object.fromEntries(['market','yard','street'].map(z=>[z,rows.filter(i=>i.zone===z).length])),deterministic:true,unchanged:true,violations:0,negatives:3});
 }
 const baseline=JSON.parse(readFileSync(new URL('../out/codex-village-art-hashes-before.json',import.meta.url)));
 assert.deepEqual(hashes,baseline);evidence.lifeOffHashes=hashes;
 writeFileSync(new URL('../out/codex-village-art-hashes-after.json',import.meta.url),JSON.stringify(hashes,null,2));
}finally{await ssr.close();checkpoint();}
if(process.argv.includes('--audit-only')){console.log(evidence.checks);process.exit(0);}
const server=await preview({preview:{port:0,strictPort:true,host:'127.0.0.1'}}),base=server.resolvedUrls.local[0].replace(/\/$/,'');let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>{evidence.errors.push(String(e.stack||e));checkpoint();});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))evidence.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`${base}/?size=large&seed=1234&life=1&hour=10&view=overview&prmax=1&shadowMap=512&cam=28,12,1&target=40,1,-14`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:120000});
 await page.addStyleTag({content:'#look {display:none}'});
 evidence.runtime=await page.evaluate(()=>({audit:__villageArt.audit,lampPools:__villageArt.lampPools,rows:__villageArt.rows,people:__town.instances.filter(i=>i.id.startsWith('townsfolk-')).map(i=>i.id)}));
 evidence.meshAudit=await page.evaluate(()=>{
 const result={toon:true,hulls:0,feet:[]};
 __scene.updateMatrixWorld(true);
 __scene.traverse(o=>{if(o.userData.artDressing)o.traverse(m=>{if(!m.isMesh)return;if(m.userData.outline)result.hulls++;else if(!m.material.isMeshToonMaterial)result.toon=false;});if(o.userData.inst?.id.startsWith('townsfolk-'))result.feet.push({id:o.userData.inst.id,y:new __THREE.Box3().setFromObject(o,true).min.y});});
 return result;
 });
 assert(evidence.meshAudit.toon&&evidence.meshAudit.hulls>0);for(const p of evidence.meshAudit.feet)assert(Math.abs(p.y)<.12,`${p.id}: feet ${p.y}`);
 assert.equal(evidence.runtime.people.length,12);assert.deepEqual(evidence.runtime.audit.violations,[]);
 async function pose(pos,target,hour){await page.evaluate(({pos,target,hour})=>{__life.setHour(hour);__stage.camera.position.set(...pos);__stage.controls.target.set(...target);__stage.controls.update();},{pos,target,hour});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
 async function shot(name){const png=await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>r(__renderer.domElement.toDataURL('image/png').split(',')[1]))));writeFileSync(dir+name+'.png',Buffer.from(png,'base64'));evidence.shots.push({name,camera:await page.evaluate(()=>({pos:__stage.camera.position.toArray(),target:__stage.controls.target.toArray(),hour:__life.hour}))});checkpoint();console.log('shot',name);}
 if(!videoOnly){
 if(!lineupOnly){
 await shot('market-dressed');
 // Select the residential lot with the richest accepted additions.
 const yard=await page.evaluate(()=>{const yards=__town.instances.filter(i=>i.kind==='house');let best;for(const b of yards){const rows=__villageArt.rows.filter(i=>i.zone==='yard'&&Math.hypot(i.pos[0]-b.pos[0],i.pos[1]-b.pos[1])<8);if(!best||rows.length>best.count)best={b,count:rows.length};}return best.b;});
 await pose([yard.pos[0]+Math.sin(yard.rotY)*16+7,9,yard.pos[1]+Math.cos(yard.rotY)*16],[yard.pos[0],1,yard.pos[1]],10);await shot('yards');
 await pose([28,8,2],[39,1,-14],21.5);await shot('night-atmosphere');
 }
 // Pose the real residents on the village plaza, retaining the entire town.
 // Preserve measured grounding and restore transforms and camera afterward.
 await page.evaluate(()=>{
  __life.setHour(10);__life.setTimescale(0);
  const people=[];__scene.traverse(o=>{if(o.userData.inst?.id.startsWith('townsfolk-'))people.push(o);});
  window.__portrait={poses:people.map(o=>({o,pos:o.position.clone(),rot:o.rotation.clone()})),camera:__stage.camera.position.clone(),target:__stage.controls.target.clone(),zoom:__stage.camera.zoom,minDistance:__stage.controls.minDistance};
  people.forEach((o,n)=>{o.position.x=-4.5+(n%6)*1.8;o.position.z=3.4+Math.floor(n/6)*3.4;o.rotation.set(0,0,0);});
  __stage.controls.minDistance=1;__stage.camera.zoom=1.3;__stage.camera.updateProjectionMatrix();
  __stage.camera.position.set(0,10,21);__stage.controls.target.set(0,1,5.1);__stage.controls.update();
 });
 evidence.shots=evidence.shots.filter(s=>s.name!=='townsfolk-lineup');
 await shot('townsfolk-lineup');
 evidence.lineup=await page.evaluate(()=>{
  __scene.updateMatrixWorld(true);
  return {inTown:true,sceneHidden:false,temporaryPose:true,people:__portrait.poses.map(({o})=>({id:o.userData.inst.id,position:o.position.toArray(),feet:new __THREE.Box3().setFromObject(o,true).min.y}))};
 });
 assert.equal(evidence.lineup.people.length,12);
 for(const p of evidence.lineup.people)assert(Math.abs(p.feet)<.12,`${p.id}: lineup feet ${p.feet}`);
 await page.evaluate(()=>{for(const {o,pos,rot} of __portrait.poses){o.position.copy(pos);o.rotation.copy(rot);}__stage.camera.position.copy(__portrait.camera);__stage.camera.zoom=__portrait.zoom;__stage.camera.updateProjectionMatrix();__stage.controls.target.copy(__portrait.target);__stage.controls.minDistance=__portrait.minDistance;__stage.controls.update();delete window.__portrait;__life.setHour(10);});
 }
 if(!lineupOnly&&!process.argv.includes('--stills-only')){
  // Retain toon materials and hulls; skip screen-space post for software capture.
  await page.evaluate(()=>{__post.setOptions({post:false});__renderer.shadowMap.enabled=false;window.__videoNow=performance.now();performance.now=()=>window.__videoNow;
   // Hold the application's next RAF and step it once per exported frame.
   // This avoids rendering discarded frames while software readback runs.
   window.requestAnimationFrame=callback=>{window.__artTick=callback;return 0;};
  });
  await page.waitForFunction(()=>typeof window.__artTick==='function',null,{polling:100});
  const frames=dir+'frames/';mkdirSync(frames,{recursive:true});
  for(let frame=0;frame<96;frame++){
   const png=await page.evaluate(frame=>{
    const t=frame/95,angle=-.45+t*.8;window.__videoNow+=1000/8;
    __life.setHour(10+t*.5);__stage.camera.position.set(40+Math.sin(angle)*24,11,-14+Math.cos(angle)*24);__stage.controls.target.set(40,1,-14);__stage.controls.update();
    window.__artTick();
    return __renderer.domElement.toDataURL('image/png').split(',')[1];
   },frame);
   writeFileSync(frames+String(frame).padStart(4,'0')+'.png',Buffer.from(png,'base64'));
   if(frame%16===0)console.log('video frame',frame,'/96');
  }
  execFileSync('ffmpeg',['-y','-framerate','8','-i',frames+'%04d.png','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',dir+'village-art.mp4'],{stdio:'pipe'});
  rmSync(frames,{recursive:true,force:true});evidence.video={seconds:12,frames:96,fps:8,toon:true,hulls:true,post:false,shadows:false};
 }
 assert.deepEqual(evidence.errors,[]);checkpoint();
}finally{checkpoint();await browser?.close();await new Promise(r=>server.httpServer.close(r));}
