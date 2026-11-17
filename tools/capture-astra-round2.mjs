import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],failed=[],captures=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5173/?capture&view=village&hour=10.4');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>document.querySelector('.loading').remove());
 const advance=(hour,seconds)=>page.evaluate(({hour,seconds})=>{__astra.setPaused(false);for(let n=0;n<seconds*10;n++){__astra.setHour(hour);__astra.step(.1,false);}__astra.step(0);},{hour,seconds});
 const shot=async(name,view,hour)=>{
  await page.evaluate(({view,hour})=>{document.activeElement?.blur();__astra.view(view);__astra.setHour(hour);__astra.step(0);},{view,hour});
  await page.screenshot({path:dir+name+'.png',timeout:60000,animations:'disabled'});captures.push({name,view,hour});console.log(name);
 };
 await advance(10.4,250);
 for(const [name,view]of [['50-town-day','village'],['55-west-works','works'],['56-sunbeam-terrace','sunbeam'],['54-civic-green','civic'],['57-willowbank','neighbourhood'],['58-market-square','market'],['61-clover-fields','orchard']])await shot(name,view,10.4);
 await advance(16,200);
 const practice=await page.evaluate(()=>{const a=__astra;for(let n=0;n<4000;n++){if(a.residents.life.actors.filter(p=>p.context.location.place==='baseball'&&p.game?.ready).length===3)break;a.setHour(16);a.step(.1,false);}for(let n=0;n<27;n++){a.setHour(16);a.step(.1,false);}return a.residents.life.actors.filter(p=>p.context.location.place==='baseball'&&p.game?.ready).map(p=>p.context.name);});
 assert.equal(practice.length,3,'Wait for an actual, naturally assembled practice');
 await shot('59-astra-high','campus',16);await shot('62-owls-practice','baseball',16);
 await advance(17.4,90);await shot('51-town-golden-hour','village',17.4);await shot('53-downtown-golden-hour','downtown',17.4);
 await advance(21,180);await shot('52-town-night','village',21);await shot('60-lantern-quay-night','quay',21);
 await page.setViewportSize({width:390,height:844});await shot('63-sunbeam-mobile','sunbeam',17.4);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const audit=await page.evaluate(()=>__astra.audit());for(const stop of ['high-street','campus','quay','market','town-hall','union-station','civic-green','sunbeam','market-gardens'])assert(audit.traffic.events.busArrivals.some(e=>e.stop===stop),stop+' served with live pedestrians');
 writeFileSync(dir+'round2-final-evidence.json',JSON.stringify({captures,practice,errors,failed,audit},null,2));
}finally{await browser.close();}
