import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra/regression/civic/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5173/?view=civic&seed=831&capture=1');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();__astra.step(0);});
 const shot=async(name,view,hour)=>{await page.evaluate(({view,hour})=>{__astra.view(view);__astra.setHour(hour);for(let n=0;n<120;n++)__astra.step(0,false);__astra.step(0);},{view,hour});await page.screenshot({path:dir+name+'.png',timeout:60000});console.log(name);};
 await shot('01-civic-morning','civic',10.4);
 if(process.argv.includes('--first'))process.exitCode=0;
 else {
  await page.evaluate(()=>{for(let n=0;n<440;n++)__astra.step(.1,false);});
  await shot('02-fire-crew',{x:-89,z:-66,zoom:3.5},10.4);
  const assisting=await page.evaluate(()=>__astra.world.civicQuarter.audit());assert.equal(assisting.state.phase,'assisting');assert(assisting.state.waterVisible);
  await page.evaluate(()=>{for(let n=0;n<500;n++)__astra.step(.1,false);});
  await shot('03-library-and-park',{x:-57,z:-65,zoom:2.9},15.5);
  await shot('04-civic-afternoon','civic',15.5);
  await shot('05-town-connected','village',15.5);
  await shot('06-civic-evening','civic',20.5);
  const night=await page.evaluate(()=>__astra.world.civicQuarter.audit());assert(!night.state.libraryOpen);assert(!night.state.deliveryActive);assert(night.people.filter(a=>['Ari','Sol','Max','Nell','Bo','Zee'].includes(a.name)).every(a=>!a.visible));
  await page.evaluate(()=>{__astra.setHour(15.5);__astra.setPaused(true);__astra.step(0,false);});
  const frozen=await page.evaluate(()=>__astra.world.civicQuarter.audit());await page.evaluate(()=>{for(let n=0;n<40;n++)__astra.step(.1,false);});assert.deepEqual(await page.evaluate(()=>__astra.world.civicQuarter.audit()),frozen);
  await page.evaluate(()=>{__astra.setPaused(false);for(let n=0;n<40;n++)__astra.step(.1,false);});assert.notDeepEqual(await page.evaluate(()=>__astra.world.civicQuarter.audit()),frozen);
  for(const id of ['fire-station','clinic','library','police-post','civic-park']){
   const point=await page.evaluate(id=>{const v=__astra.town.venues.find(v=>v.id===id);__astra.view({x:v.pos[0],z:v.pos[1],zoom:4});__astra.step(0);const p=__astra.camera.position.clone().set(v.pos[0],v.height*.6,v.pos[1]).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,name:v.name};},id);
   await page.mouse.click(point.x,point.y);assert.equal(await page.locator('.card h2').textContent(),point.name);assert((await page.locator('.card p').textContent()).length>60);await page.getByRole('button',{name:'Close details',exact:true}).click();
  }
  await page.getByRole('button',{name:'Civic Green',exact:true}).click();await page.evaluate(()=>{for(let n=0;n<100;n++)__astra.step(.1,false);});assert.equal(await page.locator('[data-view="civic"]').getAttribute('class'),'active');
  // Observe arrivals in the shared graph, not only intended destinations.
  const arrivals=await page.evaluate(()=>{__astra.setHour(9);const found=new Set();for(let n=0;n<9000;n++){__astra.residents.update(.1,n*.1,10);for(const p of __astra.residents.people)if(!p.route.length&&p.destination?.node===p.node&&p.destination?.district==='civic-green')found.add(p.destination.id);}return [...found];});
  for(const id of ['fire-station','clinic','library','police-post','civic-park'])assert(arrivals.includes(id),'No resident arrival: '+id);
  await page.setViewportSize({width:390,height:844});await shot('07-civic-mobile','civic',15.5);
  const tab=page.getByRole('button',{name:'Civic Green',exact:true});await tab.scrollIntoViewIfNeeded();await tab.click();
  const audit=await page.evaluate(()=>__astra.audit());assert(audit.report.ok);assert.equal(audit.civicActivities.facilities,4);assert.deepEqual(errors,[]);
  writeFileSync(dir+'evidence.json',JSON.stringify({audit,arrivals,assisting,night,errors,checks:['all 5 civic parcels selectable','pause freezes civic activity','resume moves civic activity','fire crew arrives and water is visible','library closes at night','deliveries stop at night','actual residents arrive at all civic venues','Civic Green tab','mobile view']},null,2));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
