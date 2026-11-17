import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-traffic/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5191/?capture=1&seed=831');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();for(let i=0;i<50;i++)__astra.step(.1,false);});
 const shot=async(name,view,hour=10.4)=>{await page.evaluate(({view,hour})=>{__astra.view(view);__astra.setHour(hour);for(let n=0;n<120;n++)__astra.step(0,false);__astra.step(0);},{view,hour});await page.screenshot({path:dir+name+'.png',timeout:60000,animations:'disabled'});console.log(name);};
 await shot('01-downtown-progress','downtown');await shot('02-high-street-bus',{x:-55,z:-15,zoom:5});await shot('03-town-roads','village');
 await page.evaluate(()=>{__astra.view({x:-55,z:-15,zoom:5});__astra.step(0);});
 const busPoint=await page.evaluate(()=>{const p=__astra.traffic.objects[0].position.clone();p.y+=1;p.project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
 await page.mouse.click(busPoint.x,busPoint.y);assert.equal(await page.locator('.card h2').textContent(),'Thistlebrook Town Loop');
 await page.screenshot({path:dir+'08-route-details.png'});await page.getByRole('button',{name:'Close details',exact:true}).click();
 // Speed is shared with the town clock and residents.
 await page.locator('#speed').click();await page.locator('#speed').click();
 const beforeFast=await page.evaluate(()=>__astra.traffic.audit().time);await page.evaluate(()=>__astra.step(.1,false));
 assert(Math.abs((await page.evaluate(()=>__astra.traffic.audit().time))-beforeFast-.8)<.001);
 await page.locator('#speed').click();
 // Freeze and resume the actual runtime, not a separate simulation instance.
 await page.evaluate(()=>__astra.setPaused(true));const frozen=await page.evaluate(()=>__astra.traffic.audit());await page.evaluate(()=>{for(let i=0;i<30;i++)__astra.step(.1,false);});assert.deepEqual(await page.evaluate(()=>__astra.traffic.audit()),frozen);
 await page.evaluate(()=>{__astra.setPaused(false);for(let i=0;i<30;i++)__astra.step(.1,false);});assert.notDeepEqual(await page.evaluate(()=>__astra.traffic.audit()),frozen);
 for(const [id,name,view] of [['campus','04-campus-stop',{x:0,z:-32,zoom:4}],['quay','05-quay-delivery',{x:44,z:-7,zoom:4}]]){
  const arrived=await page.evaluate(id=>{for(let i=0;i<4000;i++){__astra.step(.1,false);if(__astra.traffic.simulation.vehicles[0].stoppedAt===id)return true;}return false;},id);assert(arrived,`Bus must reach ${id} with live pedestrians`);await shot(name,view);
 }
 const audit=await page.evaluate(()=>{for(let i=0;i<9000;i++)__astra.step(.1,false);return __astra.audit();});
 assert.equal(audit.traffic.vehicles.length,16);for(const id of ['high-street','campus','quay','market','town-hall'])assert(audit.traffic.events.busArrivals.some(s=>s.stop===id),'No actual arrival: '+id);
 assert(audit.traffic.events.pedestrianYields>0);assert(audit.traffic.events.deliveries>0);
 await shot('06-downtown-evening','downtown',20.5);
 await page.setViewportSize({width:390,height:844});await shot('07-mobile','downtown');
 assert.deepEqual(errors,[]);writeFileSync(dir+'evidence.json',JSON.stringify({audit,errors,checks:['all five bus stops reached with live residents','traffic yields to residents','deliveries complete','pause freezes traffic','resume moves traffic','desktop and mobile render','bus pointer selection shows route','8x speed advances traffic with the town']},null,2));
}finally{await browser.close();}
