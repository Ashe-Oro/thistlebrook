import {verifyMerged} from './verify-astra-merged.mjs';
import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],failed=[],models=new Set();
 page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);if(r.status()===200&&/\.glb(?:\?|$)/.test(r.url()))models.add(r.url());});
 page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error'&&!/fonts.google/.test(m.text()))errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5173/?capture=1&view=village');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});
 assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();for(let n=0;n<120;n++)__astra.step(.1,false);__astra.step(0);});
 const verification=process.argv.includes('--shots-only')?null:await verifyMerged(page);
 if(verification){await page.reload();await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);await page.evaluate(()=>document.querySelector('.loading').remove());}
 // Show a settled working morning, with actual residents at their workplaces.
 await page.evaluate(()=>{for(let n=0;n<5000;n++){__astra.setHour(10.4);__astra.step(.1,false);}});
 const shot=async(name,view,hour)=>{await page.evaluate(({view,hour})=>{__astra.view(view);__astra.setHour(hour);if(view==='works')for(let n=0;n<5000;n++){__astra.setHour(hour);__astra.step(.1,false);}for(let i=0;i<130;i++)__astra.step(0,false);__astra.step(0);},{view,hour});await page.screenshot({path:dir+name+'.png',animations:'disabled',timeout:60000});console.log(name);};
 for(const [name,view,hour]of [
  ['29-united-town-day','village',10.4],['30-united-town-evening','village',20.5],
  ['31-downtown','downtown',10.4],['32-civic-green','civic',15.5],['33-west-works','works',10.4],['34-sunbeam-terrace','sunbeam',15.5],
  ['35-willowbank','neighbourhood',10.4],['36-market-square','market',10.4],['37-astra-high','campus',15.5],['38-lantern-quay','quay',20.5],['39-clover-fields','orchard',10.4],['40-owls-friday-night','stadium',20.5]
 ])await shot(name,view,hour);
 const audit=await page.evaluate(()=>__astra.audit());assert.equal(audit.people,40);assert.equal(audit.report.districts,9);assert.equal(audit.report.venues,17);assert.equal(audit.report.buildings,35);assert(audit.report.ok);assert.deepEqual(errors,[]);
 assert.deepEqual(failed,[]);
 const mobile=[];
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
 for(const [i,view]of ['sunbeam','civic','works'].entries()){
  await shot(String(41+i)+'-'+view+'-mobile',view,10.4);
  const sample=await page.evaluate(()=>{const gl=__astra.renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(gl.drawingBufferWidth/2,gl.drawingBufferHeight/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return {width:document.documentElement.scrollWidth,pixel:[...pixel]};});
  assert.equal(sample.width,390);assert.equal(sample.pixel[3],255);assert.notDeepEqual(sample.pixel.slice(0,3),[232,237,227]);mobile.push({view,...sample});
 }
 const evidencePath=dir+(verification?'merged-evidence.json':'merged-visual-evidence.json');
 writeFileSync(evidencePath,JSON.stringify({audit,verification,mobile,modelsLoaded:models.size,errors,failed},null,2));
}finally{await browser.close();}
