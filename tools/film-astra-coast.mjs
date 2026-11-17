import {chromium} from 'playwright-core';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-coast/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const frames=mkdtempSync(join(tmpdir(),'astra-coast-film-'));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1120,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5197/?capture=1&view=beach&hour=13&seed=831');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();for(let i=0;i<600;i++){__astra.setHour(13);__astra.step(.1,false);}__astra.step(0);});
 let frame=0;
 const stops=[['beach',13,50],['strip',13,35],['strip',21,50],['coast',21,30]];
 for(const [view,hour,count]of stops){
  await page.evaluate(({view,hour})=>{__astra.view(view);__astra.setHour(hour);for(let n=0;n<150;n++)__astra.step(0,false);},{view,hour});
  for(let i=0;i<count;i++){
   await page.evaluate(({view,i,hour})=>{const a=__astra;a.setHour(hour);for(let n=0;n<2;n++)a.step(.1,false);if(view==='beach')a.view({x:124,z:-49+i*.09,zoom:2.85});if(view==='strip')a.view({x:92,z:-47+i*.075,zoom:2.75});a.step(0);},{view,i,hour});
   await page.screenshot({path:join(frames,String(frame++).padStart(4,'0')+'.jpg'),type:'jpeg',quality:88,timeout:120000});
   if(i%10===0)console.log(`${view} ${hour}: frame ${frame}`);
  }
 }
 assert.deepEqual(errors,[]);
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','10','-i',join(frames,'%04d.jpg'),'-frames:v',String(frame),'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',dir+'08-coral-coast-life.mp4']);
 writeFileSync(dir+'film-evidence.json',JSON.stringify({frames:frame,fps:10,duration:frame/10,viewport:{width:1120,height:800},stops,errors},null,2));
 console.log(`Saved ${frame/10}s of beach and strip life.`);
}finally{await browser.close();rmSync(frames,{recursive:true,force:true});}
