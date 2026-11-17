import {chromium} from 'playwright-core';
import {mkdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const dir=new URL('../shots/astra-skatepark/',import.meta.url).pathname,frames=dir+'.frames/';
mkdirSync(frames,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5195/?seed=831&view=skatepark&capture=1&hour=15.5');
 await page.waitForFunction(()=>window.__ready,null,{timeout:120000,polling:200});
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();__astra.view({x:52,z:-51,zoom:4});__astra.step(0);});
 for(let n=0;n<192;n++) {
  await page.evaluate(()=>{__astra.step(1/24,false);__astra.step(1/24);});
  await page.screenshot({path:frames+String(n).padStart(4,'0')+'.jpg',type:'jpeg',quality:92,timeout:60000});
  if(n%24===0)console.log(`Film frame ${n}/192`);
 }
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','12','-i',frames+'%04d.jpg','-frames:v','192','-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',dir+'08-switchyard-in-motion.mp4']);
 rmSync(frames,{recursive:true,force:true});console.log('Saved 16-second film.');
} finally {await browser.close();}
