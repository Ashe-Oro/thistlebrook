import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const out='shots/sol-terrain',before=process.argv.includes('--before'),film=process.argv.includes('--film');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],evidence=process.argv.includes('--film-only')&&existsSync(`${out}/browser-evidence.json`)?JSON.parse(readFileSync(`${out}/browser-evidence.json`)).evidence:[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5205/?capture&view=village&hour=11&seed=831');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:300000,polling:500});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 for(const [name,view] of (process.argv.includes('--film-only')?[]:[['world','village'],['mid',{x:216,z:140,zoom:.6}],['close',{x:115,z:-32,zoom:1.7}]])){
  const camera=await page.evaluate(view=>{__astra.view(view);__astra.setHour(11);__astra.step(0);return __astra.controls.state();},view);
  await page.screenshot({path:`${out}/${before?'before':'after'}-${name}.png`,timeout:180000});evidence.push({name,camera,hour:11});console.log('still',name);
 }
 if(!before){
  const checks=await page.evaluate(async()=>{
   const a=__astra,{renderCoverage}=await import('/src/astra/registry/render-tags.js'),{registryErrors}=await import('/src/astra/registry/index.js'),{registryCoverage}=await import('/src/astra/registry/coverage.js'),{RESOLVED}=await import('/src/catalog/loader.js');
   const registry=registryErrors(a.town),render=renderCoverage(a.scene,a.town),componentCoverage=renderCoverage(a.scene,a.town,{complete:true}),coverage=registryCoverage(a.town,RESOLVED),districts=[];
   for(const d of a.town.districts){a.view({x:d.center[0],z:d.center[1],zoom:1.5});a.step(0,false);districts.push({id:d.id,entries:a.registry.findAll({district:d.id,capability:'walkTo'}).length});}
   const start=a.world.landscape.audit().vehicles.map(v=>v.distance);for(let i=0;i<80;i++)a.step(.1,false);const motion=a.world.landscape.audit().vehicles.map((v,i)=>v.distance-start[i]);
   const flight=[];for(const target of [16,38,65,88,108,116,128,148,172]){while(a.elapsed<target)a.step(Math.min(.1,target-a.elapsed),false);flight.push(a.world.expansions.starbase.audit());}
   return {registry,render,componentCoverage,coverage,districts,motion,flight,landscape:a.world.landscape.audit(),audit:a.audit()};
  });
  writeFileSync(`${out}/browser-evidence.json`,JSON.stringify({errors,evidence,...checks},null,2));
  assert.deepEqual(checks.registry,[]);assert.deepEqual(checks.render,[]);assert.deepEqual(checks.coverage.missing,[]);assert(!checks.componentCoverage.some(e=>e.includes('landscape:')));assert(checks.districts.every(d=>d.entries>0));assert(checks.motion.every(d=>d>0));assert.equal(checks.districts.length,18);
  writeFileSync(`${out}/browser-evidence.json`,JSON.stringify({errors,evidence,...checks},null,2));console.log('browser checks passed',checks.landscape.ownedPlacements,'owned landscape models');
 }
 assert.deepEqual(errors,[]);
 if(film){
  await page.setViewportSize({width:960,height:600});await page.evaluate(()=>{__astra.renderer.setPixelRatio(1);__astra.renderer.shadowMap.enabled=false;});mkdirSync(`${out}/.frames`,{recursive:true});
  const stops=[['village',1],['fair',2],['downtown',2],['airport',2],['mountainpass',2],['harbor',2],['coast',2],['starbase',2],['offshore',2],['village',1]],fps=2;let index=process.argv.includes('--recovery-only')?30:0;
  for(const [view,seconds]of stops){
   if(process.argv.includes('--recovery-only')&&view!=='offshore')continue;
   if(view==='offshore')await page.evaluate(()=>{const target=__astra.elapsed+(114-__astra.elapsed%192+192)%192;while(__astra.elapsed<target)__astra.step(Math.min(.1,target-__astra.elapsed),false);});
   await page.evaluate(view=>{__astra.view(view);__astra.setHour(16);__astra.renderer.shadowMap.autoUpdate=false;},view);
   for(let frame=0;frame<seconds*fps;frame++){
    const jpg=await page.evaluate(()=>{for(let i=0;i<3;i++)__astra.step(.1,false);__astra.step(0);return __astra.renderer.domElement.toDataURL('image/jpeg',.88).split(',')[1];});
    writeFileSync(`${out}/.frames/${String(index++).padStart(4,'0')}.jpg`,Buffer.from(jpg,'base64'));
   }console.log('film',view,index);
  }
  execFileSync('ffmpeg',['-y','-framerate',String(fps),'-i',`${out}/.frames/%04d.jpg`,'-c:v','libx264','-pix_fmt','yuv420p','-r','24','-movflags','+faststart',`${out}/world-tour.mp4`],{stdio:'ignore'});
 }
}finally{await browser.close();}
