import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir='shots/astra-themepark/';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 let page=await browser.newPage({viewport:{width:1600,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5196/?view=themepark&seed=831&capture=1');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();for(let i=0;i<135;i++)__astra.step(.1,false);__astra.step(0);});
 const shot=async(name,view,hour=10.4)=>{await page.evaluate(({view,hour})=>{__astra.view(view);__astra.setHour(hour);for(let i=0;i<100;i++)__astra.step(0,false);__astra.step(0);},{view,hour});await page.screenshot({path:dir+name+'.png'});console.log(name);};
 await shot('01-park-progress','themepark');
 if(!process.argv.includes('--first')){
  await shot('02-coaster-ridge','parkcoasters');await shot('03-mountain-road','mountainpass');await shot('04-larger-landscape','countryside');await shot('05-midway',{x:220,z:-19,zoom:2.9});await shot('06-evening','themepark',20.5);
  const before=await page.evaluate(()=>__astra.world.themepark.audit());await page.evaluate(()=>{for(let i=0;i<30;i++)__astra.step(.1,false);});const after=await page.evaluate(()=>__astra.world.themepark.audit());assert.notDeepEqual(before.coasters,after.coasters);assert.notDeepEqual(before.guests.positions,after.guests.positions);
  await page.evaluate(()=>__astra.setPaused(true));const frozen=await page.evaluate(()=>__astra.world.themepark.audit());await page.evaluate(()=>{for(let i=0;i<20;i++)__astra.step(.1,false);});assert.deepEqual(await page.evaluate(()=>__astra.world.themepark.audit()),frozen);await page.evaluate(()=>__astra.setPaused(false));
  await page.getByRole('button',{name:'Pinecrest Park',exact:true}).click();await page.evaluate(()=>{for(let i=0;i<90;i++)__astra.step(.1,false);__astra.step(0);});assert.equal(await page.locator('[data-view="themepark"]').getAttribute('class'),'active');
  // Select the entrance using the same raycast/pointer path as a visitor.
  const point=await page.evaluate(()=>{__astra.view({x:220,z:-3,zoom:3});__astra.step(0);const p=__astra.camera.position.clone().set(220,5.6,-2.4).project(__astra.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
  await page.mouse.click(point.x,point.y);assert.equal(await page.locator('.card h2').textContent(),'Pinecrest Adventure Park');await page.getByRole('button',{name:'Close details',exact:true}).click();
  // Use a fresh portrait page. Disabling requestAnimationFrame for deterministic
  // capture also suppresses the browser's resize repaint in a reused page.
  await page.close();page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errors.push(String(e)));await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
  await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
  await page.goto('http://localhost:5196/?view=themepark&capture=1&seed=831');
  await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
  await page.evaluate(()=>document.querySelector('.loading').remove());await shot('07-mobile','themepark');
  assert(await page.evaluate(()=>!__astra.renderer.getContext().isContextLost()&&__astra.renderer.info.render.calls>100));
  assert.deepEqual(errors,[]);writeFileSync(dir+'evidence.json',JSON.stringify({before,after,errors,checks:['trains move on both tracks','visitors move between activities','pause freezes all park activity','Pinecrest navigation tab','entrance selection opens park details','mobile render']},null,2));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
