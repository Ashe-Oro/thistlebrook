import {chromium} from 'playwright-core';
import {mkdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir='shots/astra-themepark/',frames=dir+'.frames/';mkdirSync(frames,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5196/?capture=1&view=parkcoasters');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();document.querySelector('.intro').style.display='none';for(let i=0;i<70;i++)__astra.step(.1,false);__astra.step(0);});
 for(let i=0;i<60;i++){
  await page.evaluate(i=>{const a=__astra;a.view('parkcoasters');a.step(.1,false);a.step(0);},i);
  await page.screenshot({path:frames+String(i).padStart(4,'0')+'.jpg',type:'jpeg',quality:88,timeout:60000});if(i%30===0)console.log(`Coasters: frame ${i}/60`);
 }
 assert.deepEqual(errors,[]);execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','10','-i',frames+'%04d.jpg','-frames:v','60','-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',dir+'08-coasters-running.mp4']);rmSync(frames,{recursive:true});console.log('Saved 6-second coaster film.');
}finally{await browser.close();}
