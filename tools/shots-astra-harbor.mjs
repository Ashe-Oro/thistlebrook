import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir=new URL('../shots/astra-harbor/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
  page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
  await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
  const url=new URL(process.env.ASTRA_URL||'http://localhost:5188/');
  url.searchParams.set('view','harbor');url.searchParams.set('capture','1');url.searchParams.set('hour','6.2');url.searchParams.set('seed','831');
  await page.goto(url.href);await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});
  assert.equal(await page.evaluate(()=>window.__astraError),undefined);
  await page.evaluate(async()=>{document.querySelector('.loading').remove();await document.fonts.ready;});
  const advance=async(seconds,hour)=>page.evaluate(({seconds,hour})=>{__astra.setHour(hour);for(let i=0;i<seconds*10;i++){__astra.step(.1,false);__astra.setHour(hour);}for(let i=0;i<140;i++)__astra.step(0,false);__astra.step(0);},{seconds,hour});
  const shot=async(name,view)=>{await page.evaluate(v=>{__astra.view(v);__astra.step(0);},view);await page.screenshot({path:dir+name+'.png',timeout:60000,animations:'disabled'});console.log(name);};
  await advance(3,6.2);await shot('02-dawn-harbor','harbor');await shot('03-dawn-fishing','pier');
  const dawn=await page.evaluate(()=>__astra.world.harbor.audit());assert(dawn.people.filter(p=>p.role==='Fisher').every(p=>p.activity==='Fishing at dawn'));checks.push('Dawn fishing on pier');
  await advance(95,10);await shot('04-morning-fish-market',{x:62,z:41,zoom:4});
  const morning=await page.evaluate(()=>__astra.world.harbor.audit());
  const market=await page.evaluate(()=>__astra.town.harbor.nodes.market);assert(morning.people.filter(p=>p.role==='Fisher').every(p=>p.arrivals.includes(market)));checks.push('Actual catch deliveries at fish market');
  await advance(22,14);await shot('05-shell-cove-swimmers','beach');await shot('06-harbor-afternoon','harbor');
  assert((await page.evaluate(()=>__astra.world.harbor.audit())).swimmersInWater>0);checks.push('Swimmers physically enter cove');
  // Pointer selection uses the real scene raycast, including imported people.
  for(const [id,view,height] of [['harbor-market',{x:57,z:40,zoom:4},4],['harbor-lighthouse',{x:91,z:51,zoom:4},6],['harbor-pier','pier',.2]]){
    const point=await page.evaluate(({id,view,height})=>{__astra.view(view);__astra.step(0);const v=__astra.town.venues.find(v=>v.id===id),p=__astra.camera.position.clone().set(v.pos[0],height,v.pos[1]).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,name:v.name};},{id,view,height});
    await page.mouse.click(point.x,point.y);assert.equal(await page.locator('.card h2').textContent(),point.name);await page.getByRole('button',{name:'Close details',exact:true}).click();checks.push('Click '+point.name);
  }
  await page.getByRole('button',{name:'Dawn fishing',exact:true}).click();await advance(120,6.2);
  const personPoint=await page.evaluate(()=>{
    __astra.view('pier');__astra.step(0);const person=__astra.world.harbor.life.people[0],p=person.object.position.clone();p.y+=1;p.project(__astra.camera);
    return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
  });
  await page.mouse.click(personPoint.x,personPoint.y);assert.equal(await page.locator('.card h2').textContent(),'Maren');
  await page.getByRole('button',{name:'Follow their day',exact:false}).click();assert.equal(await page.evaluate(()=>__astra.following),'Maren');checks.push('Click and follow harbor resident');
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  await advance(180,20.5);await shot('07-lighthouse-night','harbor');
  const night=await page.evaluate(()=>__astra.world.harbor.audit());assert(night.lighthouseOn);assert.equal(night.swimmersInWater,0);checks.push('Night beacon and swimmers return ashore');
  await page.evaluate(()=>__astra.setPaused(true));const frozen=await page.evaluate(()=>__astra.world.harbor.audit());
  await page.evaluate(()=>{for(let i=0;i<20;i++)__astra.step(.1,false);});assert.deepEqual(await page.evaluate(()=>__astra.world.harbor.audit()),frozen);
  await page.evaluate(()=>{__astra.setPaused(false);for(let i=0;i<20;i++)__astra.step(.1,false);});assert.notEqual((await page.evaluate(()=>__astra.world.harbor.audit())).beaconAngle,frozen.beaconAngle);checks.push('Pause/resume freezes and resumes harbor');
  await advance(1,14);await shot('08-town-with-harbor','village');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  await shot('09-harbor-mobile','harbor');
  assert(await page.getByRole('button',{name:'Dawn fishing',exact:true}).isVisible());
  const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,zoom:__astra.camera.zoom}));assert(!mobile.overflow);checks.push('Mobile harbor and clock controls');
  assert.deepEqual(errors,[]);
  writeFileSync(dir+'evidence.json',JSON.stringify({report:await page.evaluate(()=>__astra.town.report),checks,errors,dawn,morning,night,mobile},null,2));
}finally{await browser.close();}
