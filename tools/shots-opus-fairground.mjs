// Pinecrest Fairground evidence: day / sunset / night stills, a ride film and
// a browser audit. Uses port 5207 only: npm run dev -- --port 5207 --strictPort
import {chromium} from 'playwright-core';
import {mkdirSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const port=process.env.PORT||5207,dir='shots/opus-fairground/',frames=dir+'.frames/';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:process.argv.includes('--film-only')?{width:1280,height:800}:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.status()+' '+r.url());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto(`http://localhost:${port}/?view=themepark&seed=831&capture=1`);
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:400000,polling:500});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();const intro=document.querySelector('.intro');if(intro)intro.style.display='none';for(let i=0;i<80;i++)__astra.step(.1,false);__astra.step(0);});
 const views={
  overview:'themepark',midway:{x:216,z:-20,zoom:3.1},coaster:{x:212,z:-72,zoom:2.4},rides:{x:206,z:-42,zoom:3.3},entrance:{x:220,z:-6,zoom:4.2},
 };
 const shots=[['01-day-overview','overview',10.4],['02-day-midway','midway',11],['03-day-coaster','coaster',12],['04-day-rides','rides',13],['05-sunset-overview','overview',18.6],['06-sunset-midway','midway',18.4],['07-night-overview','overview',21.8],['08-night-midway','midway',22],['09-night-rides','rides',22.4],['10-night-entrance','entrance',21.4]];
 const filmOnly=process.argv.includes('--film-only');
 for(const [name,view,hour]of filmOnly?[]:shots){await page.evaluate(({view,hour})=>{__astra.view(view);__astra.setHour(hour);for(let i=0;i<25;i++)__astra.step(.1,false);__astra.step(0);},{view:views[view],hour});await page.screenshot({path:dir+name+'.png',timeout:180000});console.log(name);}
 // Audit: rides move, guests change state, everything is registered.
 const audit=()=>page.evaluate(()=>__astra.world.expansions.themepark.audit());
 const before=await audit();await page.evaluate(()=>{for(let i=0;i<40;i++)__astra.step(.1,false);});const after=await audit();
 assert.notDeepEqual(before.rides.copperhead.trains,after.rides.copperhead.trains,'Copperhead trains move');
 assert.notDeepEqual(before.positions,after.positions,'guests move');
 for(const s of ['walking','queueing','riding'])assert(after.guests.states[s]>0,s);
 const registry=await page.evaluate(async()=>{const {renderCoverage}=await import('/src/astra/registry/render-tags.js');const t=__astra.town,park=t.renderedModels.filter(m=>m.district==='themepark'&&m.asset.startsWith('fairground/'));
  return {errors:renderCoverage(__astra.scene,t).slice(0,10),fairgroundModels:park.length,distinctAssets:new Set(park.map(m=>m.asset)).size,activityPlaces:t.registry.places.filter(p=>p.kind?.startsWith('pinecrest-')).length,unregistered:park.filter(m=>!t.registry.places.some(p=>p.id===m.id)).length};});
 assert.deepEqual(registry.errors,[]);assert.equal(registry.unregistered,0);
 await page.evaluate(()=>__astra.setPaused(true));const frozen=await audit();await page.evaluate(()=>{for(let i=0;i<10;i++)__astra.step(.1,false);});assert.deepEqual((await audit()).rides,frozen.rides,'pause freezes rides');await page.evaluate(()=>__astra.setPaused(false));
 // Ride film: 7 s at 12 fps of Copperhead, the wheel and the midway at dusk.
 mkdirSync(frames,{recursive:true});
 await page.evaluate(()=>{__astra.setHour(19.6);});
 for(let i=0;i<84;i++){await page.evaluate(i=>{const a=__astra;a.view({x:208-i*.05,z:-46+i*.06,zoom:2.15});a.step(1/12,false);a.step(0);},i);for(let attempt=0;;attempt++){try{await page.screenshot({path:frames+String(i).padStart(4,'0')+'.jpg',type:'jpeg',quality:86,timeout:300000});break;}catch(e){if(attempt>=2)throw e;console.log('retry frame',i);}}if(i%24===0)console.log('film',i);}
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','12','-i',frames+'%04d.jpg','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',dir+'rides.mp4']);rmSync(frames,{recursive:true});
 if(!filmOnly||!existsSync(dir+'evidence.json'))writeFileSync(dir+'evidence.json',JSON.stringify({port,registry,before:{guests:before.guests},after:{rides:after.rides,guests:after.guests},errors},null,1)+'\n');
 assert.deepEqual(errors,[]);console.log('ok',JSON.stringify(registry));
}finally{await browser.close();}
