import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const seed of [831,0,99]){
  await page.goto(`http://localhost:5192/?seed=${seed}`);
  await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000});
  const report=await page.evaluate(async()=>{
   if(window.__astraError)throw Error(window.__astraError);
   const {renderCoverage}=await import('/src/astra/registry/render-tags.js');
   const {registryErrors}=await import('/src/astra/registry/index.js');
   const a=window.__astra,registry=a.registry;
   a.setPaused(true);
   let arrivalCount=0;const visits=a.residents.people.map(p=>p.visits);
   // Exercise the normal resident router with its registry destination lookup.
   for(let n=0;n<1200;n++)a.residents.update(.5,n*.5,12);
   a.residents.people.forEach((p,n)=>{if(p.visits>visits[n])arrivalCount++;});
   const routes=registry.places.filter(p=>p.interaction).flatMap(p=>p.interaction.slots.map(s=>registry.walkTo(p.id,{fromNode:0,slot:s.id}).ok));
   return {seed:a.town.seed,logical:registry.places.length,coverage:renderCoverage(a.scene,a.town,{complete:true}),metadata:registryErrors(a.town),market:registry.walkTo('market',{fromNode:0}).ok,routes,arrivalCount};
  });
  assert.deepEqual(report.coverage,[]);assert.deepEqual(report.metadata,[]);assert(report.market);assert(report.routes.every(Boolean));assert(report.arrivalCount>=28,JSON.stringify(report));
  console.log(JSON.stringify(report));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
