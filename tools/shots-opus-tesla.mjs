// Evidence for the Tesla lineup rebuild and the Roadster rest-stop removal.
//   node tools/shots-opus-tesla.mjs --tag before|after [--only lineup,cars,reststop,clip]
// Needs a running dev server (ASTRA_URL, default http://localhost:5194/).
// Writes shots/opus-tesla/: lineup-<tag>.png, reststop-<tag>.png,
// car-<kind>-<tag>.png (3/4 front, in-app cel pipeline), lineup-jump.mp4 and
// metrics-<tag>.json (frame draw calls, lineup meshes/draw calls, triangles).
import {chromium} from 'playwright-core';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {lineupApexTime,LINEUP_JUMP} from '../src/astra/tesla/demo-motion.js';
const args=process.argv.slice(2),arg=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
const tag=arg('tag','after'),kinds=arg('kinds',null)?.split(','),only=new Set(arg('only','lineup,cars,reststop,clip').split(','));
const dir=new URL('../shots/opus-tesla/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 const url=new URL(process.env.ASTRA_URL||'http://localhost:5194/');url.searchParams.set('capture','1');await page.goto(url.href);
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:600000,polling:500});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();__astra.setHour(11);__astra.controls.maxZoom=40;__astra.step(0);});
 const to=async time=>page.evaluate(time=>{let left=time-__astra.elapsed;while(left>1e-7){const dt=Math.min(.05,left);__astra.step(dt,false);left-=dt;}__astra.step(0);},time);
 // Orthographic camera placed on an arbitrary azimuth/elevation around a target.
 // Orthographic camera on an arbitrary azimuth/elevation around a target. The
 // map controls own the camera during step(), so render the skin chain after.
 const aim=v=>page.evaluate(v=>{__astra.view({x:v.x,z:v.z,zoom:4},true);__astra.step(0,false);const cam=__astra.camera,c=new cam.position.constructor(v.x,v.y||0,v.z),r=v.r||150,e=v.elevation*Math.PI/180;
  cam.position.set(c.x+Math.sin(v.azimuth)*Math.cos(e)*r,c.y+Math.sin(e)*r,c.z+Math.cos(v.azimuth)*Math.cos(e)*r);cam.up.set(0,1,0);cam.lookAt(c);cam.zoom=v.zoom;cam.updateProjectionMatrix();cam.updateMatrixWorld(true);
  __astra.skin.render(0,__astra.elapsed,__astra.hour);},v);
 const shot=async name=>{await page.screenshot({path:dir+name+'.png',timeout:300000});console.log('saved',name);};
 const metrics={tag,errors};
 const ui=on=>page.evaluate(on=>{for(const e of document.querySelectorAll('body *'))e.style.visibility=on?'':'hidden';if(!on)for(const c of document.querySelectorAll('canvas'))c.style.visibility='visible';},on);
 if(only.has('lineup')){
  // The arena camera: the "Roadster arena" view button, at a parked moment.
  await to(43);
  await page.evaluate(()=>{__astra.view('roadster',true);__astra.step(0);});await shot('lineup-'+tag);
  metrics.arenaFrame=await page.evaluate(()=>{__astra.renderer.info.reset();__astra.step(0);const i=__astra.renderer.info.render;return {calls:i.calls,triangles:i.triangles};});
  await aim({x:-201,z:-170.5,zoom:9,azimuth:Math.PI*.18,elevation:28,y:1});await ui(false);await shot('lineup-close-'+tag);await ui(true);
  metrics.lineup=await page.evaluate(()=>__astra.tesla.arena.lineup.map(o=>{let meshes=0,triangles=0,visible=0;o.traverse(m=>{if(!m.isMesh)return;meshes++;if(m.visible)visible++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});const b=new (__astra.camera.position.constructor)();return {kind:o.userData.kind,meshes,triangles,size:o.userData.dimensions};}));
  metrics.lineupMeshes=metrics.lineup.reduce((a,v)=>a+v.meshes,0);
  // Draw calls attributable to the lineup: render with and without it.
  metrics.lineupDrawCalls=await page.evaluate(()=>{__astra.view('roadster',true);const r=__astra.renderer,count=()=>{r.info.reset();__astra.step(0);return r.info.render.calls;};const all=count();__astra.tesla.arena.lineup.forEach(o=>o.visible=false);const none=count();__astra.tesla.arena.lineup.forEach(o=>o.visible=true);return {withLineup:all,withoutLineup:none,lineup:all-none};});
 }
 if(only.has('cars')){
  await to(43);await ui(false);
  const cars=await page.evaluate(()=>__astra.tesla.arena.lineup.map(o=>{const p=o.getWorldPosition(o.position.clone());return {kind:o.userData.kind,x:p.x,z:p.z,h:o.userData.dimensions.height};}));
  for(const c of cars.filter(c=>!kinds||kinds.includes(c.kind))){
   // Only this car visible, camera 14m out with a near plane so the row and
   // trees behind the camera never occlude the profile.
   await page.evaluate(k=>{__astra.tesla.arena.lineup.forEach(o=>o.visible=o.userData.kind===k);__astra.camera.userData.near??=__astra.camera.near;__astra.camera.near=.1;},c.kind);
   await aim({x:c.x,z:c.z,y:c.h*.45,r:14,zoom:c.kind==='semi'?26:36,azimuth:Math.PI*.22,elevation:14});await shot(`car-${c.kind}-${tag}`);
   await aim({x:c.x,z:c.z,y:c.h*.45,r:14,zoom:c.kind==='semi'?21:36,azimuth:Math.PI*.5,elevation:2});await shot(`car-${c.kind}-side-${tag}`);
   await page.evaluate(()=>{__astra.tesla.arena.lineup.forEach(o=>o.visible=true);__astra.camera.near=__astra.camera.userData.near;__astra.camera.updateProjectionMatrix();});
  }
  await ui(true);
 }
 if(only.has('reststop')){
  // Ashe's camera: default isometric bearing, close on the arena's east gate.
  await page.evaluate(()=>{__astra.view({x:-179,z:-181.5,zoom:11},true);__astra.step(0);});await ui(false);await shot('reststop-'+tag);await ui(true);
  metrics.reststop=await page.evaluate(()=>__astra.town.catalogScenes.filter(s=>s.district==='roadster').map(s=>s.id));
 }
 if(only.has('clip')){
  const frames=mkdtempSync(join(tmpdir(),'opus-tesla-jump-')),fps=15;let n=0;
  await page.setViewportSize({width:1280,height:720});await ui(false);
  for(let t=LINEUP_JUMP.start-2;t<LINEUP_JUMP.end+1.5;t+=1/fps){
   await to(t);await aim({x:-201,z:-170.5,y:4,zoom:6.2,azimuth:Math.PI*.12,elevation:16});
   await page.screenshot({path:join(frames,String(n).padStart(4,'0')+'.jpg'),type:'jpeg',quality:90,timeout:300000});n++;
  }
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',join(frames,'%04d.jpg'),'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',dir+'lineup-jump.mp4']);
  rmSync(frames,{recursive:true,force:true});metrics.clip={frames:n,fps,apex:lineupApexTime()};console.log('saved lineup-jump.mp4',n,'frames');
 }
 writeFileSync(dir+`metrics-${tag}.json`,JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,1));
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
