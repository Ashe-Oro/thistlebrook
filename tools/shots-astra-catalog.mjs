import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-catalog/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5187/?capture=1&view=village');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();__astra.setPaused(true);__astra.step(0);});
 for(const [name,view] of [['01-town',{x:-7,z:-30,zoom:1}],['02-harvest',{x:-48,z:26,zoom:5}],['03-camp',{x:-68,z:26,zoom:5}],['04-tea',{x:55,z:-43,zoom:5}]]){
  await page.evaluate(view=>{__astra.view(view);__astra.step(0)},view);await page.screenshot({path:dir+name+'.png'});
 }
 const before=await page.evaluate(()=>__astra.world.catalogActivities.audit());
 await page.evaluate(()=>{__astra.setPaused(false);for(let i=0;i<650;i++)__astra.step(.1,false);__astra.step(0);});
 const after=await page.evaluate(()=>__astra.world.catalogActivities.audit());
 assert.equal(after.scenes,3);assert.equal(after.props,14);assert.equal(after.actors,7);assert(after.states.every(s=>s.bones>0&&s.completed>0));assert.equal(new Set(after.leases).size,after.leases.length);
 await page.screenshot({path:dir+'05-tea-activities.png'});
 await page.evaluate(()=>__astra.setPaused(true));const frozen=await page.evaluate(()=>__astra.world.catalogActivities.audit());await page.evaluate(()=>{for(let i=0;i<30;i++)__astra.step(.1,false);});assert.deepEqual(await page.evaluate(()=>__astra.world.catalogActivities.audit()),frozen);
 // The added view tabs work through the actual UI, including a narrow screen.
 await page.getByRole('button',{name:'Camp',exact:true}).click();await page.evaluate(()=>{for(let i=0;i<100;i++)__astra.step(.1,false);__astra.step(0);});assert(Math.abs(await page.evaluate(()=>__astra.controls.target.x)+68)<.1);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Tea court',exact:true}).click();await page.evaluate(()=>{for(let i=0;i<100;i++)__astra.step(.1,false);__astra.step(0);});assert(Math.abs(await page.evaluate(()=>__astra.controls.target.x)-55)<.1);await page.screenshot({path:dir+'06-tea-mobile.png'});
 assert.equal(await page.evaluate(()=>__astra.residents.people.some(p=>p.bubble||p.activity.startsWith('Saying hello'))),false);
 assert.deepEqual(errors,[]);writeFileSync(dir+'evidence.json',JSON.stringify({before,after,errors,report:await page.evaluate(()=>__astra.town.report)},null,2));
 console.log('Catalog scenes rendered; rigged prop activities cycle and pause; no browser errors.');
}finally{await browser.close();}
