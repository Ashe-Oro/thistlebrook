import {chromium} from 'playwright-core';
import {mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const expansion=process.argv.includes('--expansion'),count=expansion?120:96;
const dir=new URL('../shots/astra/',import.meta.url).pathname,frames=dir+'.frames/';mkdirSync(frames,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});await page.addInitScript(()=>window.requestAnimationFrame=()=>0);const captureURL=new URL(process.env.ASTRA_URL||'http://localhost:5173/');captureURL.searchParams.set('capture','1');await page.goto(captureURL.href);await page.waitForFunction(()=>window.__ready,null,{timeout:120000,polling:200});await page.evaluate(()=>document.querySelector('.loading').remove());
 for(let n=0;n<count;n++){
  await page.evaluate(({n,expansion})=>{if(expansion){if(n===0)__astra.view('downtown');if(n===24){__astra.view('campus');__astra.setHour(15.5);}if(n===48)__astra.view('baseball');if(n===72)__astra.view('stadium');if(n===96){__astra.setHour(20.5);for(let j=0;j<130;j++)__astra.step(0,false);}}else{if(n===0)__astra.view('village');if(n===16)__astra.view({x:17,z:-44,zoom:2.3});if(n===48){__astra.view({x:53,z:5,zoom:2});__astra.setHour(20.5);for(let j=0;j<130;j++)__astra.step(0,false);}if(n===72)__astra.view({x:54,z:25,zoom:3});}__astra.step(.0625,false);__astra.step(.0625,false);__astra.step(0);},{n,expansion});
  await page.screenshot({path:frames+String(n).padStart(4,'0')+'.png',timeout:60000});if(n%24===0)console.log(`Film frame ${n}/${count}`);
 }
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','8','-i',frames+'%04d.png','-frames:v',String(count),'-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',dir+(expansion?'28-town-and-campus.mp4':'18-life-around-town.mp4')]);console.log('Saved '+(expansion?'15-second town-and-campus':'12-second village')+' film.');
}finally{await browser.close();}
