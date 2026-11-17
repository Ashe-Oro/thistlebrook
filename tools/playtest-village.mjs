// Local Chrome / SwiftShader playtest. Run npm run build first.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const before=process.argv.includes('--before'),dir='shots/village-playtest/';
mkdirSync(dir,{recursive:true});
const proofOnly=process.argv.includes('--proof-only');
const evidence={before,errors:[],checks:{},labels:[]};
const server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});
let browser;
try {
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>evidence.errors.push(String(e.stack||e)));
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))evidence.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(server.resolvedUrls.local[0]+'?size=large&seed=1234&life=1&hour=9.021&timescale=0&prmax=1&shadowMap=256&post=0',{waitUntil:'domcontentloaded'});
 console.log('loaded document');
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:120000});
 console.log('ready');
 await page.evaluate(()=>{document.getElementById('look')?.classList.add('collapsed');window.__captureNow=performance.now();performance.now=()=>window.__captureNow;});
 async function tick(n=2){for(let i=0;i<n;i++)await page.evaluate(()=>{__captureNow+=1000/12;return new Promise(r=>requestAnimationFrame(r));});}
 async function shot(name){console.log('capture',name);await tick();await page.screenshot({timeout:120000,path:dir+(before?'before-':'')+name+'.png'});}
 const inspect=()=>page.evaluate(()=>__life.interiors.inspect());
 async function pose(x,z,yaw=0){await page.evaluate(({x,z,yaw})=>{const c=__life.interiors,r=c.rooms.find(r=>r.id===__life.interior.id);c.player.position.set(r.origin[0]+x,0,r.origin[1]+z);c.view(yaw);},{x,z,yaw});await tick();}
 if(proofOnly){
  await page.keyboard.press('Tab');
  await page.evaluate(()=>{__life.setHour(12.021);const [x,z]=__life.activities().find(e=>e.type==='chat').pos,a=2*Math.PI/6;__stage.camera.position.set(x+Math.sin(a)*8,3.4,z+Math.cos(a)*8);__stage.controls.target.set(x,1.5,z);__stage.controls.update();});
  await shot('labels-wall');
  await page.evaluate(()=>__life.interiors.enter('bakery',{immediate:true}));await pose(0,2.1);await shot('interior-sign');
  assert.equal((await inspect()).active,'bakery');evidence.checks.finalBuildProof=true;
 } else {
 evidence.checks.registry=await page.evaluate(()=>({count:__town.registry.places.length,names:__town.registry.places.map(p=>p.name)}));
 for(const name of ['The Flour & Fern','The Copper Kettle','Willowmere Provisions',"Bram's Workshop"])assert(evidence.checks.registry.names.includes(name),name);
 const start=(await inspect()).player;
 await page.keyboard.down('w');await tick(6);await page.keyboard.up('w');
 const end=(await inspect()).player;assert(Math.hypot(end[0]-start[0],end[2]-start[2])>.1);evidence.checks.walk={start,end};await shot('walk');
 await page.evaluate(()=>__life.setHour(21));await tick();await shot('night');
 await page.keyboard.press('f');await tick();assert.equal(await page.evaluate(()=>__life.hour),0);evidence.checks.hourKey=true;
 await page.evaluate(()=>__life.setHour(9.021));await tick();
 evidence.checks.greeting=await page.evaluate(()=>__life.activities());assert(evidence.checks.greeting.some(e=>e.type==='greet'));
 // Inspect rendered sprites at real social locations; record anchors and camera poses.
 await page.keyboard.press('Tab');await tick();
 await page.evaluate(()=>{const e=__life.activities().find(e=>e.type==='greet'),[x,z]=e.pos;__stage.camera.position.set(x-3,3.6,z-7);__stage.controls.target.set(x,1.5,z);__stage.controls.update();});
 await tick();await shot('greeting');
 await page.evaluate(()=>__life.setHour(12.021));
 await page.evaluate(()=>{const e=__life.activities().find(e=>e.type==='chat'),[x,z]=e.pos;__stage.camera.position.set(x-6.5,3.4,z+.6);__stage.controls.target.set(x,1.5,z+.63);__stage.controls.update();});await tick();
 async function audit(){return page.evaluate(()=>{const result=[],render=__renderer.render;__renderer.render=function(scene,camera){if(scene!==__scene)scene.traverse(o=>{if(o.isSprite&&o.visible&&o.userData.resident){let p;__scene.traverse(r=>{if(r.userData.inst?.id===o.userData.resident)p=r;});result.push({id:o.userData.resident,kind:o.userData.kind,position:o.position.toArray(),anchorError:Math.hypot(o.position.x-p.position.x,o.position.z-p.position.z)});}});return render.call(this,scene,camera);};return new Promise(r=>requestAnimationFrame(()=>{__renderer.render=render;r(result);}));});}
 evidence.labels=await audit();assert(evidence.labels.length);assert(evidence.labels.every(l=>l.anchorError<.001));await shot('labels');
 // Sweep real viewpoints around the chat, looking for scenery between labels and camera.
 evidence.checks.occlusionSweep=[];
 for(let k=0;k<12;k++){
  await page.evaluate(k=>{const e=__life.activities().find(e=>e.type==='chat'),[x,z]=e.pos,a=k*Math.PI/6;__stage.camera.position.set(x+Math.sin(a)*8,3.4,z+Math.cos(a)*8);__stage.controls.target.set(x,1.5,z);__stage.controls.update();},k);await tick();
  const labels=await audit();
  const blocked=await page.evaluate(labels=>{const ray=new __THREE.Raycaster(),meshes=[];__scene.updateMatrixWorld(true);__scene.traverse(o=>{if(!o.isMesh||o.userData.outline)return;let r=o;while(r){if(!r.visible||r.userData.inst?.kind==='villager')return;r=r.parent;}meshes.push(o);});return labels.filter(l=>{const p=new __THREE.Vector3(...l.position),d=p.distanceTo(__stage.camera.position);ray.set(__stage.camera.position,p.sub(__stage.camera.position).normalize());ray.far=d-.15;return ray.intersectObjects(meshes,false).length;});},labels);
  evidence.checks.occlusionSweep.push({k,visible:labels.length,blocked});
  if(blocked.length||k===2)await shot('occluded-'+k);
 }
 if(!before)assert(evidence.checks.occlusionSweep.every(s=>!s.blocked.length),'no rendered text through scenery');
 await page.keyboard.press('Tab');await tick();
 for(const id of ['bakery','inn','store','smithy']){
  await page.evaluate(id=>{const c=__life.interiors,d=c.plan.find(r=>r.id===id);c.player.position.set(d.trigger[0],0,d.trigger[1]);},id);await tick();assert.equal((await inspect()).prompt,'door');
  await page.keyboard.press('e');await tick(10);assert.equal((await inspect()).active,id);await pose(0,2.1);await shot(id==='bakery'?'interior-sign':'interior-'+id);
  if(id==='bakery'){
   await pose(-3.5,2.7,.45);assert.equal((await inspect()).prompt,'lamp');await page.keyboard.press('e');await tick();assert(!(await inspect()).fixtures.find(f=>f.room===id).on);
   await page.keyboard.press('e');await tick();assert((await inspect()).fixtures.find(f=>f.room===id).on);evidence.checks.lantern=true;await shot('lantern');
  }
  await pose(0,4.25);assert.equal((await inspect()).prompt,'exit');await page.keyboard.press('e');await tick(10);assert.equal((await inspect()).active,null);
 }
 evidence.checks.interiors=['bakery','inn','store','smithy'];
 await page.evaluate(()=>{const s=__town.instances.find(i=>i.id==='cv-market-stall');__life.interiors.player.position.set(s.pos[0],0,s.pos[1]+2);});await tick();assert.equal((await inspect()).prompt,'stall');await page.keyboard.press('e');await tick();await shot('stall');evidence.checks.stall=true;
 }
 assert.deepEqual(evidence.errors,[]);
 console.log(JSON.stringify(evidence));
} finally {
 writeFileSync(`out/codex-village-playtest-${proofOnly?'proof':before?'before':'evidence'}.json`,JSON.stringify(evidence,null,2)+'\n');
 await browser?.close();await server.close();
}
