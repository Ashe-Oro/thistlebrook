// Local preview evidence; no hosting or asset downloads.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/village-medium/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const server=await preview({preview:{port:0,host:'127.0.0.1'}});
const overviewOnly=process.argv.includes('--overview-only');
const evidence=overviewOnly&&existsSync(dir+'evidence.json')?JSON.parse(readFileSync(dir+'evidence.json')):{url:'/?size=medium&seed=1234&life=1',errors:[],shots:[]};
let browser;
try {
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>{evidence.errors.push(String(e));console.error('browser error',String(e));});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico')){evidence.errors.push(`${r.status()} ${r.url()}`);console.error('asset error',r.status(),r.url());}});
 await page.goto(server.resolvedUrls.local[0]+evidence.url+'&view=overview&hour=15&timescale=0&prmax=1&shadowMap=512&post=0&kuwahara=2',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__ready,null,{timeout:180000});
 console.log('medium browser ready');
 evidence.town=await page.evaluate(()=>({seed:__town.seed,ok:__town.ok,stats:__town.report.stats,checks:__town.report.checks.map(c=>({name:c.name,ok:c.ok})),places:__town.registry.places.length,people:__town.instances.filter(i=>i.kind==='villager').length}));
 assert(evidence.town.ok);
 await page.evaluate(()=>{document.getElementById('look')?.classList.add('collapsed');__stage.controls.enableDamping=false;__stage.controls.maxDistance=500;window.__captureRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;__post.setOptions({post:true,hull:true});});
 async function pose(pos,target){await page.evaluate(({pos,target})=>{__stage.camera.position.set(...pos);__stage.controls.target.set(...target);__stage.camera.lookAt(...target);__stage.controls.update();__post.render(__stage.camera);},{pos,target});await page.evaluate(()=>new Promise(r=>__captureRAF(()=>__captureRAF(r))));}
 async function shot(name,pos,target){await pose(pos,target);await page.screenshot({path:dir+name+'.png',timeout:180000});evidence.shots=evidence.shots.filter(s=>s.name!==name);evidence.shots.push({name,pos,target,post:true,fog:[250,600]});console.log('shot',name);}
 await page.evaluate(()=>{if(__scene.fog){__scene.fog.near=250;__scene.fog.far=600;}});
 await shot('overview',[115,140,150],[12,0,-25]);
 if(!overviewOnly){
 await shot('farms',[126,69,56],[75,0,-31]);
 await shot('river-bridge',[95,48,98],[51,0,44]);
 await shot('chapel',[20,29,65],[-5,1,26]);
 }
 if(process.argv.includes('--video')){
  const frames=dir+'frames/';mkdirSync(frames,{recursive:true});
  for(let n=0;n<80;n++){const a=.55+n/80*.65;await pose([12+230*Math.sin(a),150,-25+230*Math.cos(a)],[12,0,-25]);await page.screenshot({path:frames+String(n).padStart(4,'0')+'.png'});}
  execFileSync('ffmpeg',['-y','-framerate','8','-i',frames+'%04d.png','-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',dir+'overview-orbit.mp4'],{stdio:'pipe'});
  rmSync(frames,{recursive:true,force:true});evidence.video={file:'overview-orbit.mp4',seconds:10,fps:8};
 }
 assert.deepEqual(evidence.errors,[]);
} finally {
 writeFileSync(dir+'evidence.json',JSON.stringify(evidence,null,2)+'\n');
 await browser?.close();await new Promise(r=>server.httpServer.close(r));
}
