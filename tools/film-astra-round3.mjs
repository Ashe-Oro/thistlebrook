import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra/',import.meta.url).pathname,frames=dir+'.frames/round3/';mkdirSync(frames,{recursive:true});
const stops=[
 ['village',10.4,'Thistlebrook, a connected world','18 districts. Follow the roads and see where they lead.'],
 ['works',10.4,'West Works','The morning shift, the station and the electric fleet.'],
 ['roadster',14,'Roadster Proving Ground','A white Roadster, a curved ramp and a crowd for the show.'],
 ['fair',16,'Merrymead Park','The rides are turning beside the picnic lawn.'],
 ['sunbeam',15,'Sunbeam Terrace','Homes above the shops, neighbours in the courtyard.'],
 ['civic',14,'Civic Green','The library, the clinic and a little room to play.'],
 ['downtown',14,'Meet me at the fountain','Bread, books and a new pair of shoes.'],
 ['market',14,'Market Square','Fresh produce and a stop between errands.'],
 ['neighbourhood',15,'Willowbank','Gardens, workshops and familiar streets.'],
 ['orchard',16,'Clover Fields','Apple trees, harvest stalls and the river.'],
 ['outskirts',16,'Stillwater countryside','Cabins by the lake; farms beyond the water.'],
 ['harbor',16.5,'Saltwind Harbor','Fishing boats, the boardwalk and Shell Cove.'],
 ['coast',17,'Coral Coast','The palm promenade, beach volleyball and Ocean Drive.'],
 ['starbase',17.2,'Starbase Texas','The Starfactory, launch tower and offshore recovery.'],
 ['themepark',17.4,'Beyond the mountain pass','Pinecrest coasters climb above the pines.'],
 ['skatepark',17.4,'Switchyard Skate & Bike','Taking turns in the bowl and on the pump track.'],
 ['airport',17.5,'Thistlebrook Municipal Airport','An airliner arrives; club planes head out.'],
 ['campus',18,'Home of the Owls','After-school practice under a honey-coloured sky.'],
 ['quay',20.5,'Lantern Quay','Music, warm windows and an evening by the river.'],
 ['village',21,'Thistlebrook, under the stars','One connected world. A little place to linger.'],
];
const rangeArg=process.argv.find(a=>a.startsWith('--range='));
const [start,end]=(rangeArg?.slice(8)||'0:20').split(':').map(Number);
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];await page.routeWebSocket('**',ws=>ws.close());page.on('pageerror',e=>errors.push(e.stack));await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5200/?capture&view=village');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();for(let i=0;i<1200;i++){__astra.setHour(10.4);__astra.step(.1,false);}__astra.step(0);});
 let frame=0;
 for(const [stop,[view,hour,title,detail]]of stops.entries()){
  const transition=await page.evaluate(({view,hour})=>{const a=__astra,from={...a.controls.state(),hour:a.hour};a.view(view);return {from,to:{...a.controls.state(),hour}};},{view,hour});
  for(let i=0;i<24;i++){
   const path=frames+String(frame++).padStart(4,'0')+'.jpg';
   const render=stop>=start&&stop<end&&(!process.argv.includes('--resume')||!existsSync(path));
   await page.evaluate(({i,transition,title,detail,view,render})=>{const a=__astra,{from,to}=transition,u=Math.min(1,i/5),t=u*u*(3-2*u);a.view({x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t,zoom:from.zoom+(to.zoom-from.zoom)*t});a.setHour(from.hour+(to.hour-from.hour)*t);for(let n=0;n<3;n++)a.step(.1,false);if(i>=5)a.view(view);a.step(0,render);document.activeElement?.blur();document.querySelector('.moment-label').lastChild.textContent=' AROUND ASTRA';document.querySelector('#moment-title').textContent=title;document.querySelector('#moment-detail').textContent=view==='works'?document.querySelector('.work-shift').textContent:detail;},{i,transition,title,detail,view,render});
   if(render)await page.screenshot({path,type:'jpeg',quality:90,timeout:180000,animations:'disabled'});
  }
  if(stop>=start&&stop<end)console.log(`Tour: ${view} (${frame} frames)`);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>__astra.audit().renderRegistryErrors),[]);
 if(rangeArg){writeFileSync(dir+`round3-tour-part-${start}-${end}.json`,JSON.stringify({start,end,errors}));}else{
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','8','-i',frames+'%04d.jpg','-frames:v',String(frame),'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',dir+'95-world-tour-slower.mp4']);
 writeFileSync(dir+'round3-tour-slower-evidence.json',JSON.stringify({duration:frame/8,frames:frame,width:1280,height:900,fps:8,stops,errors},null,2));console.log(`Saved ${frame/8}-second tour.`);
 }
}finally{await browser.close();}
