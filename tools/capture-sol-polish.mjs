import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {writeFileSync,copyFileSync} from 'node:fs';
const phase=process.argv[2]||'after',baseURL=process.env.ASTRA_URL||'http://localhost:5201',outDir=process.env.ASTRA_SHOTS||'shots/sol-polish';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];await page.routeWebSocket('**',ws=>ws.close());
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('pageerror',e=>errors.push(String(e)));await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto(`${baseURL}/?capture&seed=831&view=village&hour=10.4`);await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});
 if(await page.evaluate(()=>window.__astraError))throw Error(await page.evaluate(()=>window.__astraError));
 await page.evaluate(()=>document.querySelector('.loading')?.remove());
 const evidence=[];
 for(const [name,view,hour] of [['fair','fair',17],['works','works',10.4],['coast-day','coast',17],['coast-night','coast',21],['overview-rotation1','village',10.4]]) {
  const state=await page.evaluate(({name,view,hour})=>{const a=__astra;a.controls.view({...a.controls.state(),rotation:name.includes('rotation')?1:0},true);a.view(view);a.setHour(hour);a.step(0);return {camera:a.controls.state(),works:a.world.works.audit(),moment:document.querySelector('#moment-detail').textContent,registryErrors:a.audit().renderRegistryErrors,umbrellas:a.world.expansions.coast.audit().beachUmbrellas};},{name,view,hour});
  await page.screenshot({path:`${outDir}/${phase}-${name}.png`,timeout:180000});evidence.push({name,...state});assert.deepEqual(state.registryErrors,[]);if(phase==='after'&&name==='coast-night')assert.equal(state.umbrellas.open,0);if(phase==='after'&&name==='coast-day')assert.equal(state.umbrellas.open,state.umbrellas.total);console.log(phase,name,JSON.stringify(state.camera));
  if(phase==='after'&&name==='overview-rotation1'&&outDir==='shots/sol-polish')copyFileSync(`${outDir}/${phase}-${name}.png`,'shots/astra/round3-overview-rotation1.png');
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{__astra.view('village');__astra.step(0);document.querySelector('.world-nav').open=true;});
 await page.screenshot({path:`${outDir}/${phase}-mobile-menu.png`,timeout:180000});
 if(phase==='after'){
  const checks=await page.evaluate(()=>{
   const a=__astra,results=[];
   // Exercise resize itself: it must render even with RAF disabled.
   for(let rotation=0;rotation<4;rotation++){
    a.controls.view({...a.controls.state(),rotation},true);a.view('village');
    dispatchEvent(new Event('resize'));
    const gl=a.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,colors=new Set(),pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    for(let y=.25;y<.8;y+=.05)for(let x=.1;x<.9;x+=.05){const offset=(Math.floor(h*y)*w+Math.floor(w*x))*4;colors.add([...pixels.slice(offset,offset+4)].join(','));}
    results.push({rotation,colors:colors.size});
   }
   for(const hour of [6.99,7,18.99,19,21,10.4]){a.setHour(hour);a.step(0);results.push({hour,umbrellas:a.world.expansions.coast.audit().beachUmbrellas});}
   a.view('works');a.setHour(10.4);a.step(0);
   results.push({staffingAgrees:document.querySelector('.work-shift').textContent===document.querySelector('#moment-detail').textContent});
   a.setPaused(false);for(let i=0;i<6500;i++){a.setHour(10.4);a.step(.1,false);}a.step(0);
   results.push({production:a.world.works.audit()});return results;
  });
  for(const result of checks.filter(r=>'colors' in r))assert(result.colors>20,JSON.stringify(result));
  for(const {hour,umbrellas}of checks.filter(r=>'umbrellas' in r))assert.equal(umbrellas.open,hour>=7&&hour<19?umbrellas.total:0);
  assert(checks.find(r=>'staffingAgrees' in r).staffingAgrees);
  assert(checks.at(-1).production.shipped>0,'real residents must generate and ship goods');
  evidence.push({checks});
  await page.setViewportSize({width:1600,height:1050});
  await page.evaluate(()=>{document.querySelector('.world-nav').open=false;__astra.view('works');dispatchEvent(new Event('resize'));});
  await page.screenshot({path:`${outDir}/${phase}-works-producing.png`,timeout:180000});
 }
 assert.deepEqual(errors,[]);
 writeFileSync(`${outDir}/${phase}-evidence.json`,JSON.stringify({errors,evidence},null,2));
} finally {await browser.close();}
