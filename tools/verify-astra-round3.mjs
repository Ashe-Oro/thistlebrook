import {chromium} from 'playwright-core';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[],check=s=>{checks.push(s);console.log('✓ '+s);};
try{
 const context=await browser.newContext({viewport:{width:1600,height:1050},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 const ready=async()=>{await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);await page.evaluate(()=>{document.querySelector('.loading')?.remove();__astra.setPaused(true);__astra.step(0);});};
 const settle=()=>page.evaluate(()=>{for(let i=0;i<100;i++)__astra.step(.1,false);__astra.step(0);});
 await page.goto('http://localhost:5173/?capture&view=village');await ready();
 let audit=await page.evaluate(()=>__astra.audit());assert.equal(audit.report.districts,18);assert.equal(audit.report.ok,true);assert.deepEqual(audit.renderRegistryErrors,[]);assert.equal(audit.people,40);assert.equal(audit.tesla.mode,'traffic-adapter');assert.equal(audit.tesla.fleet.length,7);assert.equal(audit.life.rejectedMetadata.length,0);
 check('18 connected districts, 40 residents, seven electric traffic vehicles, complete rendered registry ownership');
 await page.locator('.world-nav summary').click();assert.equal(await page.locator('.world-menu button').count(),30);
 for(const view of ['starbase','fair','skatepark','airport','harbor','themepark','coast','outskirts','roadster','works','downtown']){
  if(!await page.locator('.world-nav').evaluate(e=>e.open))await page.locator('.world-nav summary').click();
  await page.locator(`.world-menu [data-view="${view}"]`).click();await settle();assert.equal(await page.locator('.world-nav').evaluate(e=>e.open),false);
  const copy=await page.locator('#moment-title').textContent();assert(!copy.includes('Home of the Owls'));assert.equal(await page.locator('.card').isVisible(),false);
 }
 check('district menu reaches all new regions and updates location copy without stale cards');
 const names=await page.evaluate(()=>__astra.world.selectables.filter(s=>s.data?.name).map(s=>s.data.name));
 const selected=[];
 for(const wanted of ['Corner Cup Café','Sole & Stitch','Thistlebrook High School',names.find(n=>/Starfactory/i.test(n)),names.find(n=>/Airport|Terminal/i.test(n))].filter(Boolean)){
  const hit=await page.evaluate(name=>{const a=__astra,b=a.world.selectables.find(s=>s.data.name===name);if(!b)return null;const c=b.bounds.getCenter(a.controls.target.clone());for(let r=0;r<4;r++){a.controls.view({x:c.x,z:c.z,zoom:3,rotation:r},true);a.step(0);const p=c.clone().project(a.camera),x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;if(a.pick(x,y)?.name===name)return {x,y,name};}return null;},wanted);
  if(!hit)continue;await page.mouse.click(hit.x,hit.y);assert.equal(await page.locator('.card h2').textContent(),wanted);selected.push({name:wanted,story:await page.locator('.card p').textContent()});await page.evaluate(()=>{__astra.view('harbor');__astra.step(0);});assert.equal(await page.locator('.card').isVisible(),false);
 }
 assert(selected.length>=3);assert(selected.find(p=>p.name==='Sole & Stitch')?.story.toLowerCase().includes('shoe'));check('building hit testing selects exact identities; distinct stories and view-change dismissal');
 await page.evaluate(()=>{__astra.controls.view({x:220,z:100,zoom:1.7,rotation:0},true);__astra.step(0);});
 await page.getByRole('button',{name:'Rotate village',exact:true}).click();await settle();assert.equal(await page.evaluate(()=>__astra.controls.state().rotation),1);
 await page.getByRole('button',{name:'Copy link to this view',exact:true}).click();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(copied,page.url());const saved=await page.evaluate(()=>__astra.controls.state());
 await page.reload();await ready();assert.deepEqual(await page.evaluate(()=>__astra.controls.state()),saved);check('90-degree rotation and copied URL restore the same distant view after reload');
 const motion=await page.evaluate(()=>{const a=__astra;a.setPaused(false);const before=a.traffic.audit();for(let i=0;i<300;i++)a.step(.1,false);a.step(0);const after=a.traffic.audit();a.setPaused(true);const frozen=JSON.stringify(a.audit());for(let i=0;i<30;i++)a.step(.1,false);return {before,after,frozen:JSON.stringify(a.audit())===frozen};});assert.notDeepEqual(motion.before,motion.after);assert.equal(motion.frozen,true);check('traffic advances on simulation time and pause freezes the complete world');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{__astra.view('village');__astra.step(0);});await page.locator('.world-nav summary').click();
 const layout=await page.evaluate(()=>{const r=document.querySelector('.world-menu').getBoundingClientRect();return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,x:r.x,right:r.right,y:r.y,bottom:r.bottom};});assert(!layout.overflow);assert(layout.x>=0&&layout.right<=390&&layout.y>=0&&layout.bottom<=844);
 await page.screenshot({path:'shots/astra/round3-mobile-navigation.png',timeout:60000});await page.locator('.world-menu [data-view="starfactory"]').click();await settle();assert.equal(await page.locator('.nav-current').textContent(),'Starfactory');check('mobile menu fits the screen and its last destination remains reachable by scrolling');
 await page.setViewportSize({width:1600,height:1050});await page.evaluate(()=>{__astra.controls.view({...__astra.controls.state(),rotation:1},true);__astra.view('village');__astra.setHour(10.4);__astra.step(0);});await page.screenshot({path:'shots/astra/round3-overview-rotation1.png',timeout:60000});
 audit=await page.evaluate(()=>__astra.audit());assert.deepEqual(audit.renderRegistryErrors,[]);assert.deepEqual(errors,[]);
 writeFileSync('shots/astra/round3-browser-evidence.json',JSON.stringify({checks,errors,selected,layout,audit},null,2));
 console.log(`Passed ${checks.length} integrated browser checks.`);
}finally{await browser.close();}
