import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = new URL('../shots/astra-light/', import.meta.url).pathname;
mkdirSync(dir, {recursive:true});
const url = new URL(process.env.ASTRA_URL || 'http://localhost:5185/');
url.searchParams.set('capture','1'); url.searchParams.set('seed','831');
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const errors = [], requests = [];
 page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)requests.push({url:r.url(),status:r.status()});});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 // Deterministic time and actors, including on slow software WebGL runners.
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto(url.href);
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});
 assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();__astra.setPaused(true);__astra.step(0);});
 const captures=[];
 const shot = async (name,view,hour) => {
  const data = await page.evaluate(({view,hour})=>{
   __astra.view(view);__astra.setHour(hour);__astra.step(0);
   const a=__astra, gl=a.renderer.getContext(), pixels=new Uint8Array(4);
   gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   return {hour:a.hour,period:a.lighting.state.period,night:a.lighting.state.night,drawCalls:a.renderer.info.render.calls,triangles:a.renderer.info.render.triangles,programs:a.renderer.info.programs.length,pixel:[...pixels],key:a.lighting.key.position.toArray(),shadowSpan:a.lighting.state.shadowSpan};
  },{view,hour});
  await page.screenshot({path:dir+name+'.png',animations:'disabled',timeout:60000});
  const alpha=await page.evaluate(()=>{const gl=__astra.renderer.getContext(),p=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return p[3];});
  assert.equal(alpha,255,'Screenshot must retain the rendered frame after resize');
  assert.equal(data.pixel[3],255);
  assert(Math.abs(data.pixel[0]-232)+Math.abs(data.pixel[1]-237)+Math.abs(data.pixel[2]-227)>20,'Canvas must contain town geometry, not the empty background');
  captures.push({name,view,...data}); console.log(name);
 };
 await shot('10-downtown-dawn','downtown',6.3);
 await shot('11-downtown-daylight','downtown',10.4);
 await shot('12-downtown-golden-hour','downtown',17.4);
 await shot('13-downtown-dusk','downtown',19.3);
 await shot('14-downtown-moonlight','downtown',22);
 await shot('15-town-golden-hour','village',17.4);
 await shot('16-town-moonlight','village',22);
 await shot('17-quay-dusk','quay',19.3);
 await shot('18-campus-dawn','campus',6.3);
 // Exercise real controls and keyboard input, including existing shortcuts.
 await page.getByRole('button',{name:'Choose time of day',exact:true}).click();
 for (const [label,hour] of [['Dawn',6.3],['Daylight',10.4],['Golden hour',17.4],['Dusk',19.3],['Moonlight',22]]) {
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.evaluate(()=>__astra.step(0));
  assert(Math.abs(await page.evaluate(()=>__astra.hour)-hour)<1e-6);
  assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>{__astra.setPaused(false);__astra.step(.1,false);__astra.setPaused(true);});
  assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');
  const expected={Dawn:'shutters',Daylight:'lovely day','Golden hour':'honey',Dusk:'Lanterns',Moonlight:'stars'}[label];
  assert((await page.locator('.weather').textContent()).includes(expected));
 }
 const slider=page.getByRole('slider',{name:'Time of day',exact:true});
 await slider.fill('1439');await page.evaluate(()=>__astra.step(0));
 assert.match(await slider.getAttribute('aria-valuetext'),/11:59 pm/);
 await slider.focus();await page.keyboard.press('Home');await page.evaluate(()=>__astra.step(0));
 assert.equal(await page.evaluate(()=>__astra.hour),0);
 await page.keyboard.press('End');await page.evaluate(()=>__astra.step(0));
 assert(Math.abs(await page.evaluate(()=>__astra.hour)-1439/60)<1e-6);
 await page.keyboard.press('Escape');assert(await page.locator('#astra-light-picker').isHidden());
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Choose time of day');
 for (const [label,hour] of [['Morning',10.4],['After school',15.5],['Evening',20.5]]) {
  await page.getByRole('button',{name:label,exact:true}).click();await page.evaluate(()=>__astra.step(0));
  assert.equal(await page.evaluate(()=>__astra.hour),hour);
 }
 await page.getByRole('button',{name:'Choose time of day',exact:true}).click();
 await page.getByRole('button',{name:'Golden hour',exact:true}).click();
 await shot('19-time-picker','downtown',17.4);
 await page.getByRole('button',{name:'Close time picker',exact:true}).click();
 // Sampling a full day must neither compile a new shader nor depend on dt.
 const cycle = await page.evaluate(()=>{
  const a=__astra, before=a.renderer.info.programs.length, samples=[];
  for(let hour=0;hour<24;hour+=.25){a.setHour(hour);a.step(0,Number.isInteger(hour));samples.push({hour,night:a.lighting.state.night,intensity:a.lighting.key.intensity});}
  a.setHour(22);a.step(0);const first={...a.lighting.state};for(let i=0;i<20;i++)a.step(0,false);
  return {before,after:a.renderer.info.programs.length,samples,first,last:{...a.lighting.state}};
 });
 const windowShader=await page.evaluate(()=>__astra.renderer.info.programs.some(p=>{const u=p.getUniforms().seq.map(x=>x.id);return u.includes('uAstraNight')&&u.includes('uAstraShade');}));
 assert(windowShader,'Window emission and toon polish must coexist in a compiled shader');
 assert.equal(cycle.before,cycle.after);assert.deepEqual(cycle.first,cycle.last);
 assert(cycle.samples.every(s=>Number.isFinite(s.night)&&s.night>=0&&s.night<=1&&s.intensity>0));
 const pausedHour=await page.evaluate(()=>__astra.hour);
 await page.evaluate(()=>{for(let i=0;i<15;i++)__astra.step(.1,false);});
 assert.equal(await page.evaluate(()=>__astra.hour),pausedHour);
 await page.evaluate(()=>{__astra.setPaused(false);for(let i=0;i<15;i++)__astra.step(.1,false);});
 assert.notEqual(await page.evaluate(()=>__astra.hour),pausedHour);
 await page.evaluate(()=>__astra.setPaused(true));
 await page.setViewportSize({width:390,height:844});
 // RAF is deliberately disabled; dispatch the same resize event that the
 // browser would deliver on its next animation frame, then explicitly render.
 await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
 assert(await page.evaluate(()=>__astra.renderer.domElement.width===Math.floor(innerWidth*__astra.renderer.getPixelRatio())&&__astra.camera.top>200));
 await shot('20-mobile-moonlight','downtown',22);
 await page.getByRole('button',{name:'Choose time of day',exact:true}).click();
 await page.getByRole('button',{name:'Dawn',exact:true}).click();await page.evaluate(()=>__astra.step(0));
 await page.screenshot({path:dir+'21-mobile-time-picker.png',animations:'disabled'});
 const bounds=await page.locator('#astra-light-picker').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 writeFileSync(dir+'evidence.json',JSON.stringify({url:url.href,captures,cycle,errors,requests,checks:['five lighting presets rendered','window emission and toon polish coexist in compiled shader','all time-picker buttons and live clock boundary','range input and Home/End keys','Escape restores clock focus','existing time shortcuts','24-hour finite cycle','no shader recompiles across cycle','dt-independent lighting','pause/resume','mobile render and time picker']},null,2));
} finally { await browser.close(); }
