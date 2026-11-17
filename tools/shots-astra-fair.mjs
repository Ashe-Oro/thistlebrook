import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-fair/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5189/?capture=1&view=fair&day=5&hour=16&seed=831');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});
 assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();for(let n=0;n<1400;n++)__astra.step(.1,false);__astra.step(0);});
 async function shot(name,view='fair',hour=16,day=5){
   await page.evaluate(({view,hour,day})=>{__astra.setHour(hour);__astra.setDay(day);__astra.view(view);for(let i=0;i<120;i++)__astra.step(0,false);__astra.step(0);},{view,hour,day});
   await page.screenshot({path:dir+name+'.png',timeout:60000});console.log(name);
 }
 await shot(process.argv.includes('--draft')?'01-first-park-pass':'02-saturday-afternoon');
 if(process.argv.includes('--draft')){console.log(JSON.stringify(await page.evaluate(()=>__astra.world.fair.audit())));}
 else {
   await shot('03-skywheel-and-picnic',{x:-61,z:-89,zoom:3.8});
   await shot('04-pond-and-carousel',{x:-62,z:-67,zoom:3.8});
   await shot('05-bandshell-and-pantry',{x:-62,z:-46,zoom:4},18);
   await shot('06-saturday-evening','fair',20);
   await shot('07-town-with-merrymead','village',16);
   const weekend=await page.evaluate(()=>__astra.world.fair.audit());
   assert.equal(weekend.schedule.visitors,30);assert(weekend.arrivals>25);assert(weekend.activities.length>0);
   const frozen=await page.evaluate(()=>{__astra.setPaused(true);return __astra.world.fair.audit();});
   await page.evaluate(()=>{for(let n=0;n<30;n++)__astra.step(.1,false);});
   assert.deepEqual(await page.evaluate(()=>__astra.world.fair.audit()),frozen,'Pause freezes fair rides, ducks and visitors');
   await page.evaluate(()=>{__astra.setPaused(false);for(let n=0;n<30;n++)__astra.step(.1,false);});
   assert.notEqual(await page.evaluate(()=>__astra.world.fair.audit().rideAngle),frozen.rideAngle);
   const routing=await page.evaluate(()=>{
     const fair=__astra.world.fair;const reached=new Set(),residentArrivals=new Set();let overlaps=0,wet=0;
     for(let i=0;i<5000;i++){
       __astra.step(.1,false);const a=fair.audit();const slots=new Set();
       for(const p of __astra.residents.people)if(!p.route.length&&p.destination?.node===p.node&&p.destination?.district==='fair')residentArrivals.add(p.destination.id);
       for(const v of a.activities){reached.add(v.venue);const key=v.venue+v.slot;if(slots.has(key))overlaps++;slots.add(key);}
       for(const p of a.people){const [x,,z]=p.position;if(p.phase!=='away'&&((x+67)/7.5)**2+((z+68)/5.7)**2<1)wet++;}
     }
     return {reached:[...reached],residentArrivals:[...residentArrivals],overlaps,wet};
   });
   assert.equal(routing.reached.length,6);assert(routing.residentArrivals.length>=3,'Named town residents reach the fair too');assert.equal(routing.overlaps,0);assert.equal(routing.wet,0);
   await page.getByRole('button',{name:'Advance day of week',exact:true}).click();
   assert.equal(await page.evaluate(()=>__astra.day),6);
   await page.evaluate(()=>{__astra.setDay(4);__astra.setHour(23);for(let i=0;i<3000;i++)__astra.step(.1,false);});
   const closed=await page.evaluate(()=>__astra.world.fair.audit());assert.equal(closed.visible,0,'All park visitors walk out after closing');
   const stopped=closed.rideAngle;await page.evaluate(()=>{for(let i=0;i<30;i++)__astra.step(.1,false);});assert.equal(await page.evaluate(()=>__astra.world.fair.audit().rideAngle),stopped);
   await page.evaluate(()=>{__astra.setDay(1);__astra.setHour(16);for(let i=0;i<1500;i++)__astra.step(.1,false);});
   const weekday=await page.evaluate(()=>__astra.world.fair.audit());assert.equal(weekday.visible,12);
   await shot('08-weekday-afternoon','fair',16,1);
   await page.evaluate(()=>{__astra.setDay(5);__astra.setHour(16);for(let i=0;i<1500;i++)__astra.step(.1,false);});
   await page.getByRole('button',{name:'Merrymead Park',exact:true}).click();
   await page.evaluate(()=>{for(let i=0;i<120;i++)__astra.step(.1,false);});
   assert.equal(await page.locator('[data-view="fair"]').getAttribute('class'),'active');
   const point=await page.evaluate(()=>{__astra.view('fair');__astra.step(0);const v=__astra.town.venues.find(v=>v.id==='fair-carousel');const p=__astra.camera.position.clone().set(v.pos[0],2,v.pos[1]).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
   await page.mouse.click(point.x,point.y);assert.equal(await page.locator('.card h2').textContent(),'Meadow Carousel');
   await page.getByRole('button',{name:'Close details',exact:true}).click();
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.locator('[data-view="fair"]').scrollIntoViewIfNeeded();await shot('09-park-mobile','fair',16,5);
   const mobilePixel=await page.evaluate(()=>{__astra.step(0);const gl=__astra.renderer.getContext(),p=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p];});
   assert.equal(mobilePixel[3],255);assert(Math.abs(mobilePixel[0]-232)+Math.abs(mobilePixel[1]-237)+Math.abs(mobilePixel[2]-227)>20,'Mobile canvas contains the park');
   await page.evaluate(()=>{__astra.setHour(23.9999);__astra.setDay(6);__astra.step(.1,false);});
   assert.equal(await page.evaluate(()=>__astra.day),0,'Sunday rolls over to Monday');
   assert.deepEqual(errors,[]);
   writeFileSync(dir+'evidence.json',JSON.stringify({weekend,weekday,closed,routing,mobilePixel,errors,checks:['park view and click','weekday/weekend demand','all six activities reached','named town residents arrive at the fair','capacity-limited activity slots','no walkers in pond','visitors walk home after closing','rides stop when closed','pause and resume','day control','weekly rollover','mobile rendering']},null,2));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
