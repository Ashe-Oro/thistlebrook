// WORKTREE-HOOK building-variety: private M2 Chrome + SwiftShader harness.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/village-buildings/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:0}});
const propsOnly=process.argv.includes('--props-only');
let browser;const evidence=propsOnly?JSON.parse(readFileSync(dir+'evidence.json','utf8')):{errors:[],shots:[]};
try{
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>evidence.errors.push(String(e.stack||e)));
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))evidence.errors.push(`${r.status()} ${r.url()}`);});
 const base=server.resolvedUrls.local[0];
 await page.goto(base+'?size=large&seed=1234&life=1&variety=1&hour=12.021&timescale=0&view=overview&prmax=1&shadowMap=512&post=0&cam=0,16,-20&target=0,0,-46',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__variety?.ready||window.__variety?.error,null,{timeout:180000});
 evidence.runtime=await page.evaluate(()=>window.__variety);
 console.log('variety ready');await page.evaluate(()=>{__renderer.shadowMap.enabled=false;});assert.equal(evidence.runtime.error,null);assert(evidence.runtime.houses.length>=10);assert.equal(evidence.runtime.villagers.length,12);assert.equal(evidence.runtime.props.length,12);
 const compiledJson=await page.evaluate(()=>JSON.stringify(__town));
 async function focus(name,pos,target){await page.evaluate(({pos,target})=>{__stage.camera.position.fromArray(pos);__stage.controls.target.fromArray(target);__stage.controls.update();},{pos,target});await page.waitForTimeout(300);await page.screenshot({path:dir+name+'.png',timeout:120000});evidence.shots=evidence.shots.filter(s=>s.name!==name);evidence.shots.push({name,pos,target});console.log('shot',name);}
 if(propsOnly){
  await focus('props',[112,14,-12],[90,1,-31]);
  const [px,,pz]=evidence.runtime.props.find(p=>p.id==='aut-harvest-pavilion').pos;await focus('harvest-yard',[px+15,12,pz+17],[px,1,pz]);
 }else{
 await focus('houses',[-19,13,-22],[-20,2,-47]);
 await focus('props',[112,14,-12],[90,1,-31]);
 const [px,,pz]=evidence.runtime.props.find(p=>p.id==='aut-harvest-pavilion').pos;await focus('harvest-yard',[px+15,12,pz+17],[px,1,pz]);
 await focus('props-stock',[106,15,-10],[81,2,-27]);
 await focus('civic',[-28,13,9],[-28,2,30]);
 // Bring the live cast briefly into an inspectable lineup for appearance
 // evidence only; no compiled instance / life state is changed.
 evidence.people=await page.evaluate(()=>{const roots=[];__scene.traverse(o=>{if(o.userData.inst?.id.startsWith('townsfolk-'))roots.push(o);});return roots.map(o=>({id:o.userData.inst.id,pos:o.position.toArray(),rot:o.rotation.y}));});
 await page.evaluate(()=>{__life.setTimescale(0);let n=0;__scene.traverse(o=>{if(!o.userData.inst?.id.startsWith('townsfolk-'))return;const i=n++;o.position.set(-10+(i%6)*2.2,o.position.y,8+Math.floor(i/6)*3);o.rotation.set(0,0,0);});});
 await focus('villagers',[-3,6,23],[-4,1,9]);
 evidence.appearances=await page.evaluate(()=>{const people=[];__scene.updateMatrixWorld(true);__scene.traverse(o=>{if(!o.userData.inst?.id.startsWith('townsfolk-'))return;const box=new __THREE.Box3().setFromObject(o);let toons=0,hulls=0;o.traverse(m=>{if(m.material?.isMeshToonMaterial)toons++;if(m.userData.outline)hulls++;});people.push({id:o.userData.inst.id,feet:box.min.y,toons,hulls});});return people;});
 for(const p of evidence.appearances){assert(Math.abs(p.feet)<.12,p.id+' feet');assert(p.toons>0&&p.hulls>0);}
 // Low-cost eight-second orbit, 8fps at 640x360, post disabled.
 if(!process.argv.includes('--stills-only')){
  await page.setViewportSize({width:640,height:360});
  const frames=dir+'frames/';mkdirSync(frames,{recursive:true});
  for(let i=0;i<64;i++){const angle=(i/63-.5)*.5;await page.evaluate(a=>{__stage.camera.position.set(-4+Math.sin(a)*15,5,9+Math.cos(a)*15);__stage.controls.target.set(-4,1,9);__stage.controls.update();},angle);const png=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve(__renderer.domElement.toDataURL('image/png').split(',')[1]))));writeFileSync(frames+String(i).padStart(4,'0')+'.png',Buffer.from(png,'base64'));if(i%16===0)console.log('video frame',i,'/64');}
  execFileSync('ffmpeg',['-y','-framerate','8','-i',frames+'%04d.png','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',dir+'variety.mp4'],{stdio:'pipe'});rmSync(frames,{recursive:true,force:true});evidence.video={seconds:8,fps:8,width:640,height:360};
 }
 // Release the rendered scene before checking the default page; keeping two
 // large SwiftShader scenes alive can starve a second navigation.
 await page.goto('about:blank');
 await page.goto(base+'?size=large&seed=1234&life=1&hour=12.021&timescale=0&post=0&prmax=0.5',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
 assert.equal(await page.evaluate(()=>JSON.stringify(__town)),compiledJson);
 assert.equal(await page.evaluate(()=>window.__variety),undefined);
 evidence.compiledJsonIdentical=true;
 }
 assert.equal(evidence.errors.length,0);
}finally{writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2)+'\n');await browser?.close();await new Promise(r=>server.httpServer.close(r));}
