import {chromium} from 'playwright-core';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-tesla/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const frames=mkdtempSync(join(tmpdir(),'astra-roadster-demo-')),fps=12;
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 const url=new URL(process.env.ASTRA_URL||'http://localhost:5194/');url.searchParams.set('capture','1');await page.goto(url.href);
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();__astra.controls.maxZoom=12;const caption=document.createElement('div');caption.id='film-caption';caption.style='position:fixed;left:24px;top:116px;z-index:1000;padding:14px 20px;background:#fffcf0ed;color:#294448;border-radius:12px;font:600 17px system-ui;pointer-events:none';document.body.append(caption);});
 const segments=[
  {from:2,to:15,title:'01 / SUCTION RAMP — FIRST CLIMB',view:{x:-78,z:-65,y:4,zoom:5.7,elevation:32}},
  {from:18,to:34,title:'02 / SECOND CLIMB — RAMP EXIT & BARREL ROLL',view:{x:-78,z:-65,y:4,zoom:5.7,elevation:32}},
  {from:42,to:55,rate:1,title:'03 / KICKFLIP OVER THE ENTIRE LINEUP',view:{x:-61,z:-60.5,y:6,zoom:4.9,elevation:80,azimuth:Math.PI/4}},
  {from:62,to:71,title:'04 / STANDING FLIP & THRUSTER LANDING',view:{x:-69,z:-47,y:3,zoom:6.5,elevation:75}},
 ];
 let n=0;const phases=new Set();
 for(const segment of segments){
  await page.evaluate(s=>{__astra.view(s.view);if(s.view.azimuth!==undefined){const a=s.view.azimuth,c=__astra.controls.target;__astra.camera.position.set(c.x+Math.sin(a)*110,c.y+s.view.elevation,c.z+Math.cos(a)*110);__astra.camera.lookAt(c);__astra.controls.update();}document.querySelector('#film-caption').textContent=s.title;},segment);
  for(let t=segment.from;t<segment.to-1e-6;t+=(segment.rate||2)/fps){
   const phase=await page.evaluate(time=>{let left=time-__astra.elapsed;while(left>1e-7){const dt=Math.min(.05,left);__astra.step(dt,false);left-=dt;}__astra.step(0);return __astra.tesla.roadster.phase;},t);phases.add(phase);
   await page.screenshot({path:join(frames,String(n).padStart(4,'0')+'.jpg'),type:'jpeg',quality:92,timeout:60000});n++;
  }
  console.log(`Recorded ${segment.title} (${n} frames)`);
 }
 assert.deepEqual(errors,[]);assert(phases.has('Kickflip over the entire lineup')&&phases.has('Inverted hold · second run')&&phases.has('Standing flip'));
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',join(frames,'%04d.jpg'),'-frames:v',String(n),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',dir+'22-roadster-ramp-and-lineup.mp4']);
 writeFileSync(dir+'demo-film-evidence.json',JSON.stringify({file:'22-roadster-ramp-and-lineup.mp4',frames:n,fps,durationSeconds:n/fps,playbackRate:"2x ramp/hover, 1x lineup",segments,phases:[...phases],errors},null,2));console.log(`Saved ${n/fps}-second Roadster demo film.`);
}finally{await browser.close();rmSync(frames,{recursive:true,force:true});}
