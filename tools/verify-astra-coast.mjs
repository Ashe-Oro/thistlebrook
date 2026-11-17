import {captureCoastMobile} from './coast-capture-mobile.mjs';
import {chromium} from 'playwright-core';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-coast/',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5197/?capture=1&view=strip&seed=831');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();for(let n=0;n<100;n++)__astra.step(.1,false);__astra.step(0);});
 const hit=await page.evaluate(()=>{for(let y=180;y<720;y+=8)for(let x=300;x<900;x+=8){const p=__astra.pick(x,y);if(p?.data?.id==='coast-front-3')return {x,y,name:p.name};}return null;});assert(hit,'Cafe has a selectable front');
 await page.mouse.click(hit.x,hit.y);assert.equal(await page.locator('.card h2').textContent(),hit.name);assert.equal(await page.locator('.card .badge').textContent(),'Around Coral Coast');await page.locator('.card .close').click();
 const before=await page.evaluate(()=>__astra.camera.zoom);await page.mouse.move(650,450);await page.mouse.wheel(0,-150);await page.waitForTimeout(150);await page.evaluate(()=>__astra.step(0));const after=await page.evaluate(()=>__astra.camera.zoom);assert(after>before,'Wheel zoom works');
 await page.getByRole('button',{name:'Beach & surf',exact:true}).click();await page.evaluate(()=>{for(let n=0;n<160;n++)__astra.step(.1,false);__astra.step(0);});assert(Math.abs(await page.evaluate(()=>__astra.controls.target.x)-124)<.1);
 const desktop=await page.evaluate(()=>({drawCalls:__astra.renderer.info.render.calls,triangles:__astra.renderer.info.render.triangles}));
 const mobile=await captureCoastMobile(browser,dir);assert.deepEqual(errors,[]);
 writeFileSync(dir+'interaction-evidence.json',JSON.stringify({selected:hit.name,wheelZoom:{before,after},desktop,mobile,errors},null,2));console.log('Venue click, wheel zoom, view button and mobile render passed',mobile);
}finally{await browser.close();}
