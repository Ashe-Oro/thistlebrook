import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-starbase/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);await page.goto('http://localhost:5198/?view=starbase&seed=831&capture=1');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);await page.evaluate(()=>document.querySelector('.loading').remove());
 const shot=async(name,view,t)=>{await page.evaluate(({view,t})=>{__astra.view(view);__astra.step(0);__astra.world.starbase.update(t,0,10);__astra.renderer.render(__astra.scene,__astra.camera);const s=__astra.world.starbase.audit();document.querySelector('.starbase-phase').textContent=s.title;document.querySelector('.starbase-detail').textContent=s.detail;document.querySelector('#moment-title').textContent=s.title;document.querySelector('#moment-detail').textContent=s.detail;},{view,t});await page.screenshot({path:dir+name+'.png',timeout:60000});console.log(name);return page.evaluate(()=>__astra.world.starbase.audit());};
 const states={};states.coast=await shot('01-coastal-starbase','starbase',5);
 if(process.argv.includes('--first')){assert.deepEqual(errors,[]);}else{
 states.launch=await shot('02-starship-liftoff','launch',15);states.catch=await shot('03-super-heavy-caught','launch',38);states.belly=await shot('04-starship-belly-flop',{x:174,z:30,zoom:1.9},57);states.ship=await shot('05-starship-home','launch',70);states.drone=await shot('06-offshore-touchdown','offshore',118.1);states.tow=await shot('07-tug-home',{x:219,z:119,zoom:2.9},132);states.dual=await shot('08-twin-touchdown','recovery',176);states.factory=await shot('09-starfactory','starfactory',7);await shot('10-town-road',{x:82,z:44,zoom:1.1},5);
 assert.equal(states.catch.booster.burn,0);assert.equal(states.ship.ship.tilt,0);assert.equal(states.drone.f9.legs,1);assert.equal(states.drone.f9.x,states.drone.droneX);assert.equal(states.dual.sides[0].y,states.dual.sides[1].y);
 // Shared controls actually freeze, resume and accelerate all district activity.
 await page.evaluate(()=>{__astra.step(0);__astra.setPaused(true);});const before=await page.evaluate(()=>__astra.world.starbase.audit());await page.evaluate(()=>{for(let i=0;i<10;i++)__astra.step(.1,false);});assert.deepEqual(await page.evaluate(()=>__astra.world.starbase.audit()),before);
 await page.evaluate(()=>{__astra.setPaused(false);__astra.step(.1);});assert.notDeepEqual(await page.evaluate(()=>__astra.world.starbase.audit()),before);
 await page.getByRole('button',{name:'Starbase Texas',exact:true}).click();await page.evaluate(()=>{for(let i=0;i<100;i++)__astra.step(.1,false);});await page.getByRole('button',{name:'Drone ship',exact:true}).click();await page.evaluate(()=>{for(let i=0;i<100;i++)__astra.step(.1,false);});assert(Math.abs(await page.evaluate(()=>__astra.controls.target.x )-230)<.1);
 // Real pointer selection at the orbital tower.
 const point=await page.evaluate(()=>{__astra.view('launch');__astra.step(0);const p=__astra.camera.position.clone().set(156,30,26).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});await page.mouse.click(point.x,point.y);assert.equal(await page.locator('.card h2').textContent(),'Starship & Mechazilla');await page.getByRole('button',{name:'Close details',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await shot('11-mobile-coast','starbase',5);await shot('12-mobile-launch','launch',5);
 assert.deepEqual(errors,[]);writeFileSync(dir+'evidence.json',JSON.stringify({states,errors,checks:['full flight snapshots','shared pause and resume','camera button','pointer tower selection','mobile'],audit:await page.evaluate(()=>__astra.audit())},null,2));
 }
}finally{await browser.close();}
