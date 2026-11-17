import {chromium} from 'playwright-core';
import {mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra/',import.meta.url).pathname,frames=dir+'.frames/round2/';mkdirSync(frames,{recursive:true});
const stops=[
 ['village',10.4,'Thistlebrook, together','Nine districts. Forty neighbours. One living town.',16],
 ['works',10.4,'The western branch','The morning shift, the station and the West Loop bus.',16],
 ['sunbeam',10.4,'Sunbeam Terrace','Homes above the shops. A courtyard for neighbours.',16],
 ['civic',10.4,'Civic Green','The library, the clinic and a little room to play.',16],
 ['downtown',14,'Meet me at the fountain','Bread, books and a game of chess.',16],
 ['neighbourhood',15,'Willowbank','Cottages, bicycles and familiar streets.',16],
 ['market',16,'Market Square','Pick up something fresh. Find a place to pause.',16],
 ['orchard',17,'Across the river','Apple trees, a campfire and the harvest stall.',16],
 ['campus',17.4,'Home of the Owls','Practice after class, under a honey-coloured sky.',16],
 ['village',18.4,'The golden hour','The town slows down as the lanterns come on.',16],
 ['quay',21,'One more song','Warm windows, music and an evening by the river.',16],
 ['village',21,'Thistlebrook, under the stars','A little place to linger.',16],
];
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5173/?capture=1&view=village');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();for(let i=0;i<2500;i++){__astra.setHour(10.4);__astra.step(.1,false);}});
 await page.getByRole('button',{name:'Change simulation speed'}).click();
 let frame=0;
 for(const [view,hour,title,detail,count]of stops){
  const transition=await page.evaluate(({view,hour})=>{const a=__astra,from={x:a.controls.target.x,z:a.controls.target.z,zoom:a.camera.zoom,hour:a.hour};a.view(view);const to={x:a.controls.target.x,z:a.controls.target.z,zoom:a.camera.zoom,hour};return {from,to};},{view,hour});
  for(let i=0;i<count;i++){
   await page.evaluate(({i,transition,title,detail})=>{
    const a=__astra,{from,to}=transition,u=Math.min(1,i/6),t=u*u*(3-2*u);
    a.view({x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t,zoom:from.zoom+(to.zoom-from.zoom)*t});
    a.setHour(from.hour+(to.hour-from.hour)*t);a.step(.1,false);a.step(0);document.activeElement?.blur();
    document.querySelector('.moment-label').lastChild.textContent=' AROUND ASTRA';
    document.querySelector('#moment-title').textContent=title;document.querySelector('#moment-detail').textContent=detail;
   },{i,transition,title,detail});
   const path=frames+String(frame++).padStart(4,'0')+'.jpg';
   if(!process.argv.includes('--resume')||!existsSync(path))await page.screenshot({path,type:'jpeg',quality:90,timeout:60000,animations:'disabled'});
  }
  console.log(`Tour: ${view} (${frame} frames)`);
 }
 assert.deepEqual(errors,[]);
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','8','-i',frames+'%04d.jpg','-frames:v',String(frame),'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',dir+'64-astra-town-tour.mp4']);
 console.log(`Saved ${frame/8}-second tour: shots/astra/64-astra-town-tour.mp4`);
}finally{await browser.close();}
