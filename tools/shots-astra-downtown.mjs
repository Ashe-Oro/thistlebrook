import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra/regression/downtown/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.stack));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
  await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
  await page.goto('http://localhost:5173/?seed=831&capture=1');
  await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});
  assert.equal(await page.evaluate(()=>window.__astraError),undefined);
  await page.evaluate(()=>document.querySelector('.loading').remove());
  async function shot(name,view,hour) {
    await page.evaluate(({view,hour})=>{__astra.view(view);__astra.setHour(hour);for(let n=0;n<140;n++)__astra.step(0,false);__astra.step(0);},{view,hour});
    await page.screenshot({path:dir+name+'.png',timeout:60000});console.log(name);
  }
  await shot('01-downtown-day','downtown',10.4);
  const day=await page.evaluate(()=>__astra.world.districts.downtown.audit());
  assert.equal(day.rooftops.length,7);assert(day.visible.day>0);assert.equal(day.visible.night,0);assert.equal(day.visible.game,0);
  await shot('02-lantern-quay','quay',20.5);
  await shot('03-friday-night','stadium',20.5);
  const evening=await page.evaluate(()=>__astra.world.districts.downtown.audit());
  assert(evening.visible.game>200);assert(evening.visible.night>40);assert.equal(evening.visible.day,0);
  await shot('04-downtown-evening','downtown',20.5);
  await shot('05-the-bar-street',{x:53,z:-11,zoom:3.8},20.5);
  await shot('06-town-at-night','village',20.5);
  // New activity follows the same pause contract as the rest of the town.
  await page.evaluate(()=>__astra.setPaused(true));
  const frozen=await page.evaluate(()=>__astra.world.districts.downtown.audit());
  await page.evaluate(()=>{for(let n=0;n<20;n++)__astra.step(.1,false);});
  assert.deepEqual(await page.evaluate(()=>__astra.world.districts.downtown.audit()),frozen);
  await page.evaluate(()=>{__astra.setPaused(false);for(let n=0;n<35;n++)__astra.step(.1,false);});
  assert.notDeepEqual(await page.evaluate(()=>__astra.world.districts.downtown.audit().sample),frozen.sample);
  await shot('07-crowd-in-motion','stadium',20.5);
  await page.evaluate(()=>{__astra.setHour(2);__astra.step(0,false);});
  const closed=await page.evaluate(()=>__astra.world.districts.downtown.audit().visible);
  assert.deepEqual(closed,{day:0,night:0,game:0});
  const boundaries=[];
  for(const hour of [17,18,22,1]) {
    boundaries.push(await page.evaluate(hour=>{__astra.setHour(hour);__astra.step(0,false);return {hour,...__astra.world.districts.downtown.audit().visible};},hour));
  }
  assert.equal(boundaries[0].game,0);assert(boundaries[0].night>40);
  assert(boundaries[1].game>200);assert.equal(boundaries[2].game,0);
  assert.equal(boundaries[3].night,0);
  await shot('10-stadium-daytime','stadium',10.4);
  // Visible roof markers must not prevent picking their original shops.
  await page.evaluate(()=>{__astra.view('downtown');__astra.setHour(10.4);__astra.step(0);});
  const point=await page.evaluate(()=>{const b=__astra.town.buildings.find(b=>b.name==='Sole & Stitch'),p=__astra.camera.position.clone().set(b.pos[0],2,b.pos[1]).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
  await page.mouse.click(point.x,point.y);assert.equal(await page.locator('.card h2').textContent(),'Sole & Stitch');
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  const roofPoint=await page.evaluate(()=>{const r=__astra.world.districts.downtown.landmarkRecords.find(r=>r.data.name==='Sole & Stitch'),p=r.bounds.getCenter(__astra.camera.position.clone()).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
  await page.mouse.click(roofPoint.x,roofPoint.y);assert.equal(await page.locator('.card h2').textContent(),'Sole & Stitch');
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  await shot('08-mobile-downtown','downtown',10.4);
  await shot('09-mobile-game','stadium',20.5);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const audit=await page.evaluate(()=>__astra.audit());
  writeFileSync(dir+'evidence.json',JSON.stringify({audit,day,evening,closed,boundaries,errors,failed,checks:['all seven rooftop identities','day and evening crowds','200+ additional game visitors','night crowd closes at 1am','game crowd closes at 10pm','pause/resume','shop and rooftop picking','mobile renders','private asset requests successful']},null,2));
  console.log(JSON.stringify({stats:evening.stats,drawCalls:audit.drawCalls,triangles:audit.triangles,errors,failed}));
} finally { await browser.close(); }
