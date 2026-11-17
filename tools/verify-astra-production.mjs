import {chromium} from 'playwright-core';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const privateFiles=paths=>paths.filter(p=>/\.(glb|gltf|fbx|blend)$/i.test(p)||p.startsWith('public/licensed'));
assert.deepEqual(privateFiles(readdirSync('dist',{recursive:true})),[],'No licensed models in build');
assert.deepEqual(privateFiles(execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0')),[],'No licensed models tracked');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],models=new Set(),bundles=new Set();
 page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.url().includes('/licensed/')&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);if(r.status()===200&&/\.glb(?:\?|$)/.test(r.url()))models.add(r.url());if(r.url().includes('/assets/')&&r.url().endsWith('.js'))bundles.add(r.url());});
 await page.goto('http://localhost:5173/?capture=1');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 assert.equal(await page.locator('[data-view="downtown"]').getAttribute('class'),'active');
 assert(bundles.size>0,'Serving production bundles');
 const start=await page.evaluate(()=>__astra.elapsed);await page.waitForFunction(start=>__astra.elapsed>start,start,{timeout:30000,polling:250});
 await page.evaluate(()=>{__astra.setPaused(true);window.requestAnimationFrame=()=>0;});
 const framing=[];
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(100);
  await page.evaluate(()=>__astra.view('village'));
  for(let turn=0;turn<4;turn++){
   await page.keyboard.press('e');
   const frame=await page.evaluate(()=>{__astra.step(0);const a=__astra,points=a.town.outline.flatMap(([x,z])=>[0,13].map(y=>a.camera.position.clone().set(x,y,z).project(a.camera)));return {x:Math.max(...points.map(p=>Math.abs(p.x))),y:Math.max(...points.map(p=>Math.abs(p.y))),width:document.documentElement.scrollWidth};});
   assert(frame.x<.94&&frame.y<.9,JSON.stringify(frame));assert.equal(frame.width,viewport.width);framing.push({viewport,turn,...frame});
  }
 }
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 const manualZoom=await page.evaluate(()=>__astra.camera.zoom);
 await page.getByRole('button',{name:'Rotate village',exact:true}).click();
 assert.equal(await page.evaluate(()=>__astra.camera.zoom),manualZoom,'Rotation preserves manual zoom');
 const audit=await page.evaluate(()=>__astra.audit());assert.equal(audit.people,40);assert(audit.report.ok);assert(models.size>=60);assert.deepEqual(errors,[]);
 const path='shots/astra/merged-evidence.json',evidence=JSON.parse(readFileSync(path));
 evidence.production={passed:true,port:5173,privateModelsLoaded:models.size,privateModelsExcludedFromBuild:true,privateModelsUntracked:true,liveAnimation:true,manualZoomPreserved:true,framing,errors};
 writeFileSync(path,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence.production));
}finally{await browser.close();}
