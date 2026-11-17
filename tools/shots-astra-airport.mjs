import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-airport/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const film=process.argv.includes('--film');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5193/?view=airport&seed=831&capture=1');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>document.querySelector('.loading').remove());
 const shot=async(name,t,view='airport',hour=10.4)=>{if(process.argv.includes('--verify-only'))return;await page.evaluate(({t,view,hour})=>{__astra.view(view);__astra.setHour(hour);for(let i=0;i<100;i++)__astra.step(0,false);__astra.world.airport.update(t,hour>19?1:0);__astra.renderer.render(__astra.scene,__astra.camera);},{t,view,hour});await page.screenshot({path:dir+name+'.png',timeout:60000});console.log(name);};
 await shot('01-airport-overview',0);
 if(process.argv.includes('--draft'))process.exitCode=0;
 else {
  await shot('02-commercial-departure',50,{x:117,z:-81,zoom:2.5});
  await shot('03-helicopter-lift',8,{x:81,z:-98,zoom:3.4});
  await shot('04-over-the-town',104,{x:15,z:-29,zoom:.82});
  await shot('05-evening-airfield',157,'airport',20.5);
  await page.getByRole('button',{name:'Airport',exact:true}).click();await page.evaluate(()=>{for(let i=0;i<40;i++)__astra.step(.1,false);__astra.step(0);});
  await page.getByRole('button',{name:'Pause village',exact:true}).click();await page.evaluate(()=>__astra.step(0));const frozen=await page.evaluate(()=>__astra.world.airport.audit());await page.evaluate(()=>{for(let i=0;i<20;i++)__astra.step(.1,false);});assert.deepEqual(await page.evaluate(()=>__astra.world.airport.audit()),frozen);
  await page.getByRole('button',{name:'Resume village',exact:true}).click();await page.evaluate(()=>{for(let i=0;i<20;i++)__astra.step(.1,false);});assert.notDeepEqual(await page.evaluate(()=>__astra.world.airport.audit()),frozen);
  const target=await page.evaluate(()=>{__astra.view('airport');__astra.step(0);const p=__astra.camera.position.clone().set(77,4.5,-62).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
  await page.mouse.click(target.x,target.y);assert.equal(await page.locator('.card h2').textContent(),'Thistlebrook Municipal Airport');await page.getByRole('button',{name:'Close details',exact:true}).click();
  await page.getByRole('button',{name:'Change simulation speed',exact:true}).click();const start=await page.evaluate(()=>__astra.elapsed);await page.evaluate(()=>__astra.step(.1,false));assert(Math.abs(await page.evaluate(()=>__astra.elapsed)-start-.3)<1e-8);await page.getByRole('button',{name:'Change simulation speed',exact:true}).click();await page.getByRole('button',{name:'Change simulation speed',exact:true}).click();
  const report=await page.evaluate(()=>{const phases={};let maxRunway=0,minSeparation=Infinity;for(let t=0;t<=420;t+=.25){__astra.world.airport.update(t);const states=__astra.world.airport.audit();maxRunway=Math.max(maxRunway,states.filter(s=>s.runway).length);for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)minSeparation=Math.min(minSeparation,Math.hypot(...states[a].position.map((v,i)=>v-states[b].position[i])));for(const s of states){(phases[s.id]??=[]);if(!phases[s.id].includes(s.phase))phases[s.id].push(s.phase);}}return {phases,maxRunway,minSeparation,drawCalls:__astra.renderer.info.render.calls};});assert.equal(report.maxRunway,1);assert(report.minSeparation>13);assert.deepEqual(errors,[]);
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>__astra.renderer.domElement.width===Math.floor(innerWidth*__astra.renderer.getPixelRatio()),null,{polling:100});await shot('06-mobile-airport',48,{x:117,z:-65,zoom:1.1});await page.setViewportSize({width:1280,height:800});await page.waitForFunction(()=>__astra.renderer.domElement.width===Math.floor(innerWidth*__astra.renderer.getPixelRatio()),null,{polling:100});
  writeFileSync(dir+'evidence.json',JSON.stringify({report,errors,checks:['Airport tab opens','terminal selection opens details','speed controls advance aviation clock','all flight phases complete','single runway occupancy','pause freezes aviation','resume advances aviation','day and evening render','mobile capture']},null,2));
  if(film){const frames=dir+'.frames/';mkdirSync(frames,{recursive:true});
   const scenes=[{t:26,view:{x:115,z:-53,zoom:1.8},duration:30,follow:'AT201'},{t:-5,view:{x:81,z:-99,zoom:2.5},duration:25,follow:'AIR1'},{t:145,view:{x:113,z:-36,zoom:1.45},duration:40,follow:'AT201'},{t:90,view:{x:5,z:-35,zoom:.95},duration:30}];
   let n=0;for(const clip of scenes){for(let i=0;i<48;i++,n++){await page.evaluate(({t,view,follow})=>{__astra.world.airport.update(t,0);const subject=__astra.world.airport.audit().find(a=>a.id===follow);if(subject&&(follow==='AIR1'||t>46)){view={x:subject.position[0],z:subject.position[2],zoom:view.zoom};}__astra.view(view);__astra.setHour(10.4);__astra.step(0);if(subject)__astra.view(view);__astra.world.airport.update(t,0);__astra.renderer.render(__astra.scene,__astra.camera);},{t:clip.t+i/47*clip.duration,view:clip.view,follow:clip.follow});await page.screenshot({path:frames+String(n).padStart(4,'0')+'.png',timeout:60000});}console.log('Film clip '+n+'/192');}
   execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','12','-i',frames+'%04d.png','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',dir+'07-airport-in-motion.mp4']);rmSync(frames,{recursive:true});
  }
 }
} finally {await browser.close();}
