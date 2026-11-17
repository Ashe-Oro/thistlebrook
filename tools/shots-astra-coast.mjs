import {captureCoastMobile} from './coast-capture-mobile.mjs';
import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-coast/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.status()>=400&&!/fonts|favicon/.test(r.url()))failed.push([r.status(),r.url()]);});
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5197/?capture=1&view=coast&seed=831');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();for(let i=0;i<350;i++){__astra.setHour(13);__astra.step(.1,false);}__astra.step(0);});
 for(const [name,view,hour]of [['01-coast-day','coast',13],['02-beach-life','beach',13],['03-ocean-drive-day','strip',13],['04-ocean-drive-night','strip',21],['05-coast-night','coast',21],['06-connected-town','village',13]]){
  await page.evaluate(({view,hour})=>{__astra.view(view);__astra.setHour(hour);for(let i=0;i<140;i++)__astra.step(0,false);__astra.step(0);},{view,hour});
  await page.screenshot({path:dir+name+'.png',timeout:120000});console.log(name);
 }
 console.log('Checking activity');
 const before=await page.evaluate(()=>__astra.world.coast.audit());
 await page.evaluate(()=>{for(let i=0;i<2400;i++){__astra.setHour(21);__astra.step(.1,false);}__astra.step(0);});
 const after=await page.evaluate(()=>__astra.world.coast.audit());assert(after.arrivals>before.arrivals+20);assert(after.rooftopArrivals>0);
 await page.evaluate(()=>{__astra.view('beach');__astra.setHour(13);for(let i=0;i<140;i++)__astra.step(0,false);__astra.step(0);});
 const day=await page.evaluate(()=>__astra.world.coast.audit());assert.equal(day.swimmers,12);assert.equal(day.sunbathers,24);
 await page.evaluate(()=>{__astra.setPaused(true);window.__coastFrozen=JSON.stringify(__astra.world.coast.audit().people);for(let i=0;i<30;i++)__astra.step(.1,false);});
 assert(await page.evaluate(()=>__coastFrozen===JSON.stringify(__astra.world.coast.audit().people)),'Pause preserves the crowd positions');
 await page.evaluate(()=>__astra.setPaused(false));
 const mobile=await captureCoastMobile(browser,dir);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 writeFileSync(dir+'evidence.json',JSON.stringify({report:await page.evaluate(()=>__astra.town.report),before,after,day,mobile,errors,failed},null,2));
 console.log('Coast activity, pause, mobile and asset checks passed');
}finally{await browser.close();}
