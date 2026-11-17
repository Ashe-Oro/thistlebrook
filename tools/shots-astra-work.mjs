import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra/regression/work/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_CERT_AUTHORITY_INVALID'))errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5173/?capture=1&view=works&seed=831');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();__astra.step(0);});
 const shot=async(name,view,hour)=>{await page.evaluate(({view,hour})=>{__astra.view(view);if(hour!==undefined)__astra.setHour(hour);for(let n=0;n<120;n++)__astra.step(0,false);__astra.step(0);},{view,hour});await page.screenshot({path:dir+name+'.png',timeout:60000,animations:'disabled'});console.log(name);};
 await shot('01-west-works-first-look','works',10.4);
 if(process.argv.includes('--first')){assert.deepEqual(errors,[]);process.exitCode=0;}else{
 const arrivals=await page.evaluate(()=>{const reached=new Set();for(let n=0;n<3600;n++){__astra.setHour(9);__astra.step(.1,false);for(const p of __astra.residents.people)if(p.workplace&&p.node===p.workplace.node&&!p.route.length)reached.add(p.name);}__astra.step(0);return [...reached];});
 assert.equal(arrivals.length,6,'All six assigned workers must arrive through the pedestrian graph');
 const audit=await page.evaluate(()=>__astra.audit());assert(audit.works.shipped>0);assert(audit.works.collections>0);assert.equal(audit.works.workers,6);
 await shot('02-west-works-in-motion','works',9);await page.evaluate(()=>{while(!__astra.world.works.audit().train.atPlatform)__astra.step(.1,false)});await shot('03-union-station','station',9);await shot('04-market-gardens','gardens',9);await shot('05-timber-works','timber',9);await shot('06-freight-exchange','freight',9);await shot('07-town-expansion','village',10.4);
 for(const [id,view]of [['work-station','station'],['work-farm','gardens'],['work-timber','timber'],['work-depot','freight']]){
  const point=await page.evaluate(({id,view})=>{__astra.view(view);__astra.step(0);const v=__astra.town.venues.find(v=>v.id===id),p=__astra.camera.position.clone().set(v.pos[0],3,v.pos[1]).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,name:v.name};},{id,view});await page.mouse.click(point.x,point.y);assert.equal(await page.locator('.card h2').textContent(),point.name);await page.getByRole('button',{name:'Close details',exact:true}).click();
 }
 // A worker must be selectable inside a workplace, then followable.
 const worker=await page.evaluate(()=>{const p=__astra.residents.people.find(p=>p.name==='Rowan');__astra.view('timber');__astra.step(0);const v=p.object.position.clone();v.y+=.9;v.project(__astra.camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};});
 await page.mouse.click(worker.x,worker.y);assert.equal(await page.locator('.card h2').textContent(),'Rowan');await page.getByRole('button',{name:'Follow their day'}).click();assert.equal(await page.evaluate(()=>__astra.following),'Rowan');await page.getByRole('button',{name:'Close details',exact:true}).click();
 await page.getByRole('button',{name:'West Works',exact:true}).click();await page.evaluate(()=>{for(let i=0;i<120;i++)__astra.step(.1,false);__astra.step(0)});assert.equal(await page.locator('[data-view="works"]').getAttribute('class'),'active');
 await page.evaluate(()=>__astra.setPaused(true));const frozen=await page.evaluate(()=>__astra.world.works.audit());await page.evaluate(()=>{for(let i=0;i<30;i++)__astra.step(.1,false)});assert.deepEqual(await page.evaluate(()=>__astra.world.works.audit()),frozen);
 await page.evaluate(()=>{__astra.setPaused(false);for(let i=0;i<30;i++)__astra.step(.1,false)});assert.notDeepEqual(await page.evaluate(()=>__astra.world.works.audit()),frozen);
 const lunch=await page.evaluate(()=>{for(let i=0;i<3500;i++){__astra.setHour(12.5);__astra.step(.1,false);}return __astra.residents.people.filter(p=>p.workplace).map(p=>({name:p.name,atLunch:p.destination?.id==='fountain'&&p.node===p.destination.node&&!p.route.length}));});assert(lunch.every(p=>p.atLunch));
 const home=await page.evaluate(()=>{for(let i=0;i<3500;i++){__astra.setHour(18);__astra.step(.1,false);}return __astra.residents.people.filter(p=>p.workplace).map(p=>({name:p.name,atHome:p.node===p.home&&!p.route.length}));});assert(home.every(p=>p.atHome));
 const overnight=await page.evaluate(()=>{__astra.setHour(22);__astra.step(0,false);const before=__astra.world.works.audit();for(let i=0;i<100;i++)__astra.step(.1,false);return {before,after:__astra.world.works.audit()};});assert.equal(overnight.before.produce,overnight.after.produce);assert.equal(overnight.before.timber,overnight.after.timber);assert.equal(overnight.after.train.open,false);
 await shot('08-station-evening','station',20.5);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await shot('09-west-works-mobile','works',9);
 assert(await page.locator('[data-view="works"]').isVisible());assert.match(await page.locator('.work-shift').textContent(),/neighbours at work/);
 assert.deepEqual(errors,[]);writeFileSync(dir+'evidence.json',JSON.stringify({audit,arrivals,lunch,home,errors,checks:['four workplace selections','worker pointer selection and follow','West Works navigation','all six actual worker arrivals','staffed production','freight collections','pause freezes production and railway','resume','lunch commute','return home','no overnight production','train overnight closure','mobile render']},null,2));
 }
}finally{await browser.close();}
