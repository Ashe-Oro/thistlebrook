import {chromium} from 'playwright-core';
import {mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra/',import.meta.url).pathname,frames=dir+'.frames/merged/';mkdirSync(frames,{recursive:true});
const stops=[
 ['village',10.4,'One living town','Nine districts, connected by everyday life.',25],
 ['works',10.4,'The morning shift','Grow it. Make it. Send it by rail.',30],
 ['civic',15.5,'Civic Green','A town that looks after its own.',25],
 ['sunbeam',15.5,'Sunbeam Terrace','Upstairs homes. Downstairs neighbours.',25],
 ['downtown',10.4,'Meet me at the fountain','Bread, books, shoes and a familiar face.',30],
 ['neighbourhood',10.4,'Willowbank','The cottages where the town began.',20],
 ['market',10.4,'Market Square','Flowers, fresh produce and a little gossip.',20],
 ['orchard',10.4,'Across the river','Orchards, chickens and three little bridges.',20],
 ['campus',15.5,'School’s out','The Owls have practice after class.',30],
 ['stadium',20.5,'Friday-night lights','A whole town cheering from the stands.',30],
 ['quay',20.5,'One more song','Lanterns, friends and the riverside band.',30],
 ['village',20.5,'Astra, after dark','A little place to linger.',30],
];
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5173/?capture=1&view=village');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();for(let i=0;i<4500;i++){__astra.setHour(10.4);__astra.step(.1,false);}});
 await page.getByRole('button',{name:'Change simulation speed'}).click();
 let frame=0;
 for(const [view,hour,title,detail,count]of stops){
  const transition=await page.evaluate(({view,hour})=>{const a=__astra,from={x:a.controls.target.x,z:a.controls.target.z,zoom:a.camera.zoom};a.view(view);const to={x:a.controls.target.x,z:a.controls.target.z,zoom:a.camera.zoom};a.setHour(hour);return {from,to};},{view,hour});
  for(let i=0;i<count;i++){
   await page.evaluate(({i,transition,title,detail})=>{
    const a=__astra,{from,to}=transition,u=Math.min(1,i/9),t=u*u*(3-2*u);
    a.view({x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t,zoom:from.zoom+(to.zoom-from.zoom)*t});
    a.step(.1,false);a.step(0);
    document.querySelector('.moment-label').lastChild.textContent=' AROUND ASTRA';
    document.querySelector('#moment-title').textContent=title;document.querySelector('#moment-detail').textContent=detail;
   },{i,transition,title,detail});
   const path=frames+String(frame++).padStart(4,'0')+'.jpg';
   if(!process.argv.includes('--resume')||!existsSync(path))await page.screenshot({path,type:'jpeg',quality:90,timeout:60000,animations:'disabled'});
  }
  console.log(`Tour: ${view} (${frame} frames)`);
 }
 assert.deepEqual(errors,[]);
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','10','-i',frames+'%04d.jpg','-frames:v',String(frame),'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',dir+'44-one-living-town.mp4']);
 console.log(`Saved ${frame/10}-second tour: shots/astra/44-one-living-town.mp4`);
}finally{await browser.close();}
