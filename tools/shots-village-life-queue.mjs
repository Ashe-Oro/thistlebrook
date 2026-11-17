// Local source-server evidence; post stays enabled. Run Vite on port 5178.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/village-life-queue/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
const evidence={errors:[],shots:[]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>evidence.errors.push(String(e.stack||e)));
 await page.goto('http://127.0.0.1:5178/?size=large&seed=1234&life=1&weekday=wed&weather=clear&hour=16.5&prmax=1&shadowMap=512&kuwahara=2&labels=1&view=overview');
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:120000});
 for(const [name,hour,id] of [['plaza',16.5,'townsfolk-elder'],['family-supper',18.75,'townsfolk-innkeeper'],['lunch',12.021,'townsfolk-farmhand']]){
  await page.evaluate(({hour,id})=>{__life.setHour(hour);const c=__life.context(id),node=__town.life.graph.nodes[c.destination],place=__town.registry.places.find(p=>p.id===node.placeId),f=place.points.find(p=>p.node===node.entryNode)?.facing??[0,1],group=__life.contexts().filter(p=>__town.life.graph.nodes[p.destination].placeId===place.id),pos=[0,0];for(const p of group){pos[0]+=p.location[0]/group.length;pos[1]+=p.location[1]/group.length;}__stage.camera.position.set(pos[0]+f[0]*10+f[1]*4,8,pos[1]+f[1]*10-f[0]*4);__stage.controls.target.set(pos[0],1,pos[1]);__stage.controls.update();},{hour,id});
  await page.waitForTimeout(150);
  const data=await page.evaluate(()=>{
   const contexts=__life.contexts(),poses=[];
   __scene.traverse(o=>{if(o.userData.inst?.id.startsWith('townsfolk-'))poses.push({id:o.userData.inst.id,pos:[o.position.x,o.position.z]});});
   return {contexts,poses,events:__life.activities(),post:__post.options.post};
  });
  assert.equal(data.post,true);assert.equal(data.poses.length,12);
  for(const c of data.contexts){assert.notEqual(c.currentAction.tool,'walkTo');assert.deepEqual(data.poses.find(p=>p.id===c.id).pos,c.location);}
  for(let a=0;a<data.poses.length;a++)for(let b=a+1;b<data.poses.length;b++)assert(Math.hypot(...data.poses[a].pos.map((v,k)=>v-data.poses[b].pos[k]))>=.95);
  const first=data.contexts;
  await page.evaluate(hour=>__life.setHour(hour),hour);
  assert.deepEqual(await page.evaluate(()=>__life.contexts()),first);
  assert(data.events.some(e=>e.type===(name==='plaza'?'chat':'eat')));
  if(name==='lunch')for(const type of ['chat','shop','eat','play'])assert(data.events.some(e=>e.type===type));
  await page.screenshot({path:dir+name+'.png',timeout:120000});
  evidence.shots.push({name,hour,...data});console.log('captured',name);
 }
 assert.deepEqual(evidence.errors,[]);
}finally{writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2)+'\n');await browser.close();}
