import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-outskirts/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.url().includes('licensed/astra-outskirts/'))requests.push({path:new URL(r.url()).pathname,status:r.status()});});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5190/?capture=1&view=outskirts');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();const style=document.createElement('style');style.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.append(style);for(let i=0;i<50;i++)__astra.step(.1,false);__astra.step(0);});
 const shot=async(name,view,hour=10.4)=>{await page.evaluate(({view,hour})=>{__astra.view(view);__astra.setHour(hour);for(let n=0;n<150;n++)__astra.step(0,false);__astra.step(0);},{view,hour});await page.screenshot({path:dir+name+'.png',timeout:90000});console.log(name);};
 await shot('01-stillwater-first-pass','outskirts');
 if(process.argv.includes('--first-pass')){console.log(JSON.stringify({errors,stats:await page.evaluate(()=>__astra.world.outskirts.stats)},null,2));}
 else{
  await shot('02-lake-and-cabins','lake');await shot('03-campground','campground');await shot('04-farms-and-orchards','farmland');await shot('05-woodland-trail','woods');await shot('06-town-to-countryside','village');await shot('07-campfire-evening','campground',20.5);
  // Use the actual tab, and ensure the camera follows the public control.
  await page.getByRole('button',{name:'Stillwater',exact:true}).click();await page.evaluate(()=>{for(let i=0;i<140;i++)__astra.step(.1,false);__astra.step(0);});assert(Math.abs(await page.evaluate(()=>__astra.controls.target.z)-72)<.1);
  // A roof click opens the cabin's own description.
  const target=await page.evaluate(()=>{__astra.view('lake');__astra.step(0);const p=__astra.camera.position.clone().set(-43,3,60).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});await page.mouse.click(target.x,target.y);assert.equal(await page.locator('.card h2').textContent(),'Pinecone Cabin');await page.getByRole('button',{name:'Close details',exact:true}).click();
  await page.evaluate(()=>__astra.setPaused(true));const frozen=await page.evaluate(()=>__astra.world.outskirts.audit());await page.evaluate(()=>{for(let i=0;i<20;i++)__astra.step(.1,false);});assert.deepEqual(await page.evaluate(()=>__astra.world.outskirts.audit()),frozen);
  await page.evaluate(()=>{__astra.setPaused(false);__astra.setHour(10);for(let i=0;i<6000;i++){__astra.setHour(10);__astra.step(.1,false);}});
  const evidence=await page.evaluate(()=>({outskirts:__astra.world.outskirts.audit(),townArrivals:__astra.residents.people.filter(p=>p.destination?.id?.startsWith('outskirts-')).map(p=>({name:p.name,destination:p.destination.name})),drawCalls:__astra.renderer.info.render.calls,triangles:__astra.renderer.info.render.triangles}));
  assert(evidence.outskirts.people.every(p=>p.visits>1));for(const name of ['Stillwater Landing','The Campfire','Hinterland Farm','The Kitchen Fields','South Orchard','Birch Hollow','Market Square'])assert(evidence.outskirts.arrivals.some(a=>a.destination===name),'No arrival at '+name);
  // Select an isolated hiker with a pointer, then use the ordinary follow UI.
  const walker=await page.evaluate(()=>{const people=__astra.world.outskirts.life.people,p=people.find(p=>people.every(q=>q===p||q.object.position.distanceTo(p.object.position)>2));__astra.view({x:p.object.position.x,z:p.object.position.z,zoom:4.5});__astra.step(0);const v=p.object.position.clone();v.y+=1;v.project(__astra.camera);return {name:p.name,x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};});await page.mouse.click(walker.x,walker.y);assert.equal(await page.locator('.card h2').textContent(),walker.name);await page.getByRole('button',{name:'Follow their day ↗',exact:true}).click();assert.equal(await page.evaluate(()=>__astra.following),walker.name);await page.getByRole('button',{name:'Close details',exact:true}).click();
  await page.evaluate(()=>{__astra.setHour(18.5);for(let i=0;i<1800;i++){__astra.setHour(18.5);__astra.step(.1,false);}});assert(await page.evaluate(()=>__astra.world.outskirts.life.arrivals.some(a=>a.time>600&&a.destination==='The Campfire')));await shot('09-evening-gathering','campground',20.5);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await shot('08-mobile-lake','lake');
  const mobilePixel=await page.evaluate(()=>{const gl=__astra.renderer.getContext(),p=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p];});assert.equal(mobilePixel[3],255);assert(Math.abs(mobilePixel[0]-232)+Math.abs(mobilePixel[1]-237)+Math.abs(mobilePixel[2]-227)>20,'Mobile canvas must show the lake');
  await page.getByRole('button',{name:'Stillwater',exact:true}).click();assert(await page.locator('[data-view="outskirts"]').isVisible());
  assert.deepEqual(errors,[]);assert(requests.every(r=>r.status===200));writeFileSync(dir+'evidence.json',JSON.stringify({checks:['private Nature models loaded','Stillwater tab','cabin roof click','pause freezes visitors, canoe and wildlife','all 13 visitors reach multiple destinations','angler reaches dock','workers reach fields, barn and orchard','hiker reaches town market','mobile view','pointer select and follow outskirts visitor','evening camper arrivals'],requests,errors,mobilePixel,...evidence},null,2));
 }
}finally{await browser.close();}
