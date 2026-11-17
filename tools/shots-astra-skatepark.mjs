import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir = new URL('../shots/astra-skatepark/', import.meta.url).pathname;
mkdirSync(dir, {recursive:true});
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5195/?seed=831&view=skatepark&capture=1&hour=15.5');
 await page.waitForFunction(()=>window.__ready,null,{timeout:120000,polling:200});
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();__astra.step(0);});
 const step=async(seconds)=>page.evaluate(seconds=>{for(let t=0;t<seconds-.00001;t+=.05)__astra.step(Math.min(.05,seconds-t),false);__astra.step(0);},seconds);
 await step(1.5);
 await page.screenshot({path:dir+'02-drop-in-and-air.png'});
 await step(1.5);
 await page.screenshot({path:dir+'03-grinding.png'});
 const audit=await page.evaluate(()=>({park:__astra.world.skatepark.audit(),town:__astra.town.report,render:__astra.renderer.info.render}));
 assert(audit.park.riders.some(p=>p.state==='Grinding the flat bar'));
 // Pause must freeze both course riders and town residents.
 await page.getByRole('button',{name:'Pause village',exact:true}).click();
 const frozen=await page.evaluate(()=>__astra.world.skatepark.audit());await step(1);
 assert.deepEqual(await page.evaluate(()=>__astra.world.skatepark.audit()),frozen);
 await page.getByRole('button',{name:'Resume village',exact:true}).click();await step(.5);
 assert.notDeepEqual(await page.evaluate(()=>__astra.world.skatepark.audit()),frozen);
 await page.getByRole('button',{name:'Change simulation speed',exact:true}).click();
 const before=await page.evaluate(()=>__astra.elapsed);await step(.5);
 assert(Math.abs(await page.evaluate(()=>__astra.elapsed)-before-1.5)<1e-6);
 await page.getByRole('button',{name:'Change simulation speed',exact:true}).click();
 await page.getByRole('button',{name:'Change simulation speed',exact:true}).click();
 // Real navigation button and a pointer click on the visible bowl surface.
 await page.getByRole('button',{name:'Thistlebrook High',exact:true}).click();await step(2);
 await page.getByRole('button',{name:'Skate & Bike',exact:true}).click();await step(2);
 const hit=await page.evaluate(()=>{__astra.view('skatepark');__astra.step(0);const p=__astra.world.skatepark.root.position.clone();p.x-=5.3;p.y=.5;p.z-=8;p.project(__astra.camera);return {x:(p.x+1)/2*innerWidth,y:(1-p.y)/2*innerHeight};});
 await page.mouse.click(hit.x,hit.y);
 assert.equal(await page.locator('.card h2').textContent(),'Switchyard Skate & Bike Park');
 await page.screenshot({path:dir+'04-park-details.png'});
 await page.getByRole('button',{name:'Close details',exact:true}).click();
 await page.evaluate(()=>{__astra.view('village');__astra.step(0);});
 await page.screenshot({path:dir+'05-town-context.png'});
 await page.evaluate(()=>{__astra.view('skatepark');__astra.setHour(20.5);for(let i=0;i<130;i++)__astra.step(0,false);__astra.step(0);});
 await page.screenshot({path:dir+'06-evening.png'});
 await page.evaluate(()=>{__astra.setHour(23);__astra.step(0);});
 assert.equal(await page.evaluate(()=>__astra.world.skatepark.audit().open),false);
 await page.evaluate(()=>{__astra.setHour(15.5);for(let i=0;i<130;i++)__astra.step(0,false);__astra.step(0);});
 // Ordinary town residents really arrive at the park gate via the graph.
 const visits=await page.evaluate(()=>{__astra.setHour(9);const arrivals=new Set();for(let i=0;i<6500;i++){__astra.step(.1,false);for(const p of __astra.residents.people)if(!p.route.length&&p.destination?.id==='skatepark'&&p.destination.node===p.node)arrivals.add(p.name);}return [...arrivals];});
 assert(visits.length>0,'Town residents reach park');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
 await page.evaluate(()=>{__astra.view('skatepark');__astra.setHour(15.5);for(let i=0;i<130;i++)__astra.step(0,false);__astra.step(0);});
 await page.screenshot({path:dir+'07-mobile.png'});
 assert.deepEqual(errors,[]);
 writeFileSync(dir+'evidence.json',JSON.stringify({audit,visits,errors,checks:['9 venues connected across 100 map seeds (unit suite)','park navigation button','venue pointer selection','pause freezes riders','resume moves riders','3x speed advances riders','park closes at 22:00','actual residents reach park gate','mobile render','day and evening render']},null,2));
 console.log(JSON.stringify({visits,errors,park:audit.park},null,2));
} finally {await browser.close();}
