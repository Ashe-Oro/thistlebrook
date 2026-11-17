import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const phase=process.argv[2]||'after'; const errors=[];mkdirSync('shots/sol-integrate',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.routeWebSocket('**',ws=>ws.close());
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 await page.goto('http://localhost:5201/?capture&seed=831&view=harbor');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});
 assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 const coverage=await page.evaluate(()=>{
  const a=__astra,r=a.registry,seen=new Set();a.scene.traverse(o=>{for(const id of o.userData.registryIds||[o.userData.registryId])if(id)seen.add(id);});
  const missing=a.town.modelPlacements.filter(p=>!seen.has(p.id));
  const furniture=a.town.districtFurniture.filter(p=>!seen.has(p.id));
  const destinations=[...a.town.buildings,...a.town.venues,...a.town.districts,...a.world.selectables.map(s=>s.data)].filter(p=>p?.name);
  const named=destinations.filter(p=>!r.findPlace(p.name)||!r.walkTo(p.name,{fromNode:0}).ok);
  const navigation=[...document.querySelectorAll('.world-menu button')].filter(b=>!r.walkTo(b.dataset.view,{fromNode:0}).ok||!r.walkTo(b.textContent,{fromNode:0}).ok).map(b=>b.textContent);
  const slots=r.places.filter(p=>p.interaction).flatMap(p=>p.interaction.slots.filter(s=>!r.walkTo(p.id,{fromNode:0,slot:s.id}).ok).map(s=>p.id+'/'+s.id));
  return {expected:a.town.modelPlacements.length,rendered:a.town.renderedModels.length,missing:missing.map(p=>p.id),missingFurniture:furniture.map(p=>p.id),named:named.map(p=>p.name),slots,navigation,renderErrors:a.audit().renderRegistryErrors,rejected:a.residents.life.registry.rejected};
 });
 console.log(JSON.stringify(coverage,null,2));assert.deepEqual(coverage.missing,[]);assert.deepEqual(coverage.missingFurniture,[]);assert.deepEqual(coverage.named,[]);assert.deepEqual(coverage.navigation,[]);assert.deepEqual(coverage.slots,[]);assert.deepEqual(coverage.renderErrors,[]);assert.deepEqual(coverage.rejected,[]);
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();__astra.setPaused(true);__astra.setHour(16);});
 const journeys=await page.evaluate(()=>{
  const a=__astra,assignments={Mabel:'harbor',Bram:'fair',Finn:'skatepark',Ada:'fair',Theo:'fair'},targets={};
  for(const [name,district]of Object.entries(assignments))targets[name]=a.registry.places.find(p=>p.id.startsWith('activity:stop-'+district+'/'))?.id;
  targets.Ada=a.registry.places.find(p=>p.id.startsWith('activity:lawn-fair-tea/'))?.id;
  targets.Theo=a.registry.places.find(p=>p.id.startsWith('activity:lawn-fair-music/'))?.id;
  a.residents.life.setBrain(({self})=>{const target=targets[self.name]||self.assets.home;return {tool:self.location.place===target?'visit':'walkTo',args:{target},reason:targets[self.name]?'A rest at the district supply stop':'Rest at home during route verification'};});
  const distances={};for(const name of Object.keys(assignments))distances[name]=0;
  for(let t=1;t<=800;t++){
   const before=a.residents.people.filter(p=>assignments[p.name]).map(p=>({name:p.name,pos:[...p.context.location.position]}));
   a.residents.update(1,t,16);
   for(const b of before){const p=a.residents.people.find(p=>p.name===b.name),d=Math.hypot(...p.context.location.position.map((v,k)=>v-b.pos[k]));if(d>p.context.personality.pace+.0001)throw Error('Resident teleported: '+p.name);distances[p.name]+=d;}
   if(Object.entries(targets).every(([name,target])=>a.residents.people.find(p=>p.name===name).context.location.place===target))break;
  }
  a.residents.update(1,801,16);
  return Object.entries(targets).map(([name,target])=>{const p=a.residents.people.find(p=>p.name===name);return {name,target,place:p.context.location.place,slot:p.context.location.slot,position:p.object.position.toArray(),distance:distances[name],pose:p.actor.pose};});
 });
 console.log(journeys);for(const j of journeys){assert(j.target);assert.equal(j.place,j.target);assert(j.slot);assert(j.distance>20);}
 for(const [name,file]of [['Mabel','harbor-resident'],['Bram','fair-resident'],['Finn','skatepark-resident']]){
  await page.evaluate(name=>{const a=__astra,p=a.residents.people.find(p=>p.name===name);a.view(p.destination.district);a.controls.view({x:p.object.position.x,z:p.object.position.z,zoom:5,rotation:0},true);a.selectPerson(p);a.step(0);},name);
  await page.screenshot({path:`shots/sol-integrate/${phase}-${file}.png`,timeout:60000});
 }
 await page.evaluate(()=>{const a=__astra;a.view({x:255,z:101,zoom:5.5});a.step(0);});await page.screenshot({path:`shots/sol-integrate/${phase}-coast-dining.png`,timeout:60000});
 await page.evaluate(()=>{__astra.view('fair');__astra.step(0);});
 await page.screenshot({path:`shots/sol-integrate/${phase}-fair.png`,timeout:60000});
 await page.evaluate(()=>{__astra.view({x:-190,z:-31,zoom:5});__astra.step(0);});
 await page.screenshot({path:`shots/sol-integrate/${phase}-fair-lawn.png`,timeout:60000});
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://localhost:5201/?capture&seed=831',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();__astra.step(0);});
 await page.screenshot({path:`shots/sol-integrate/${phase}-mobile.png`,timeout:60000});
 const mobile=await page.evaluate(()=>{const intro=document.querySelector('.intro').getBoundingClientRect(),nav=document.querySelector('.world-navigation').getBoundingClientRect();return {introTop:intro.top,navBottom:nav.bottom,background:getComputedStyle(document.querySelector('.world-navigation')).backgroundColor};});
 assert(mobile.introTop>=mobile.navBottom+16,JSON.stringify(mobile));
 await page.locator('.world-nav summary').click();
 assert.equal(await page.locator('.intro').evaluate(o=>getComputedStyle(o).visibility),'hidden');
 await page.screenshot({path:`shots/sol-integrate/${phase}-mobile-menu.png`,timeout:60000});
 await page.setViewportSize({width:1440,height:1000});
 const variedSeeds=[];
 for(const seed of [0,99]){
  await page.goto(`http://localhost:5201/?capture&seed=${seed}&view=market`);
  await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});
  assert.equal(await page.evaluate(()=>window.__astraError),undefined);
  const check=await page.evaluate(()=>({models:__astra.town.modelPlacements.length,rendered:__astra.town.renderedModels.length,errors:__astra.audit().renderRegistryErrors}));assert.equal(check.models,check.rendered);assert.deepEqual(check.errors,[]);variedSeeds.push({seed,...check});
 }
 assert.deepEqual(errors,[]);writeFileSync(`shots/sol-integrate/${phase}-evidence.json`,JSON.stringify({coverage,journeys,mobile,variedSeeds,errors},null,2)+'\n');
}finally{await browser.close();}
