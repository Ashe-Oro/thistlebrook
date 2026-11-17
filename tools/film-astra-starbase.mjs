import {chromium} from 'playwright-core';
import {mkdirSync,rmSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-starbase/',import.meta.url).pathname,frames='/tmp/astra-starbase-frames/';mkdirSync(frames,{recursive:true});
const clips=[
 ['starbase',5,10,15,'Starbase, Texas','Highway 4 ends at the Gulf. The next journey begins here.'],
 [{x:158,z:2,zoom:1.65},10,21,44,'Starship · liftoff','Super Heavy carries the stainless-steel ship skyward.'],
 ['launch',29,40,44,'Super Heavy · caught','The booster returns to the tower’s waiting chopsticks.'],
 [{x:169,z:7,zoom:1.8},49,70,63,'Starship · home again','Belly-flop, flip, then upright recovery at the orbital pad.'],
 [{x:190,z:49,zoom:1.8},89,98,27,'Falcon 9 · liftoff','The offshore drone ship waits in the Gulf.'],
 ['offshore',109,120,32,'Offshore · touchdown','Four landing legs settle onto the floating X.'],
 [{x:225,z:102,zoom:2.3},119,133,28,'Recovery · under tow','The tug brings the booster and its landing ship back to port.'],
 ['recovery',164,178,44,'LZ-1 + LZ-2 · together','Two side boosters. Two landing burns. Both home.'],
];
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);await page.goto('http://localhost:5198/?capture=1&view=starbase');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();document.querySelector('.starbase-panel').style.display='none';__astra.renderer.shadowMap.autoUpdate=false;});
 let frame=0;
 for(const [view,start,end,count,title,detail]of clips){for(let i=0;i<count;i++){
  if(process.argv.includes('--resume')&&existsSync(frames+String(frame).padStart(4,'0')+'.jpg')){frame++;continue;}
  await page.evaluate(({view,t,title,detail})=>{const a=__astra;a.view(view);a.step(0,false);a.world.starbase.update(t,0,10.4);a.renderer.render(a.scene,a.camera);document.querySelector('#moment-title').textContent=title;document.querySelector('#moment-detail').textContent=detail;document.querySelector('.moment-label').lastChild.textContent=' STARBASE TEXAS';},{view,t:start+(end-start)*i/(count-1),title,detail});
  await page.screenshot({path:frames+String(frame++).padStart(4,'0')+'.jpg',type:'jpeg',quality:88,timeout:60000});
 }console.log(`${title}: ${frame} frames`);}
 assert.deepEqual(errors,[]);execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','12','-i',frames+'%04d.jpg','-frames:v',String(frame),'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',dir+'13-launch-and-return.mp4']);rmSync(frames,{recursive:true,force:true});console.log('Saved '+frame/12+' seconds.');
}finally{await browser.close();}
