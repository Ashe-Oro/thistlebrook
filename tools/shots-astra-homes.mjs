import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra/regression/homes/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('fonts.googleapis'))errors.push(m.text());});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
  await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
  await page.goto('http://localhost:5173/?capture=1&view=sunbeam&seed=831');
  await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});
  assert.equal(await page.evaluate(()=>window.__astraError),undefined);
  await page.evaluate(()=>{document.querySelector('.loading').remove();for(let i=0;i<50;i++)__astra.step(.1,false);__astra.step(0);});
  const shot=async(name,view,hour=10.4)=>{
    await page.evaluate(({view,hour})=>{__astra.view(view);__astra.setHour(hour);for(let i=0;i<120;i++)__astra.step(0,false);__astra.step(0);},{view,hour});
    await page.screenshot({path:dir+name+'.png',timeout:60000,animations:'disabled'});console.log(name);
  };
  if(process.argv.includes('--progress')) {await shot('02-terraces-first-pass','sunbeam');}
  else {
    await shot('03-sunbeam-terrace','sunbeam');
    await shot('04-courtyard-life',{x:-129,z:-54,zoom:4.8});
    await shot('05-seven-district-town','village');
    await shot('06-windows-at-dusk','sunbeam',20.5);
    await page.keyboard.press('KeyE');await shot('08-washhouse-side','sunbeam',10.4);await page.keyboard.press('KeyQ');
    // Actual pointer selection at a visible upper-storey facade.
    const point=await page.evaluate(()=>{__astra.view('sunbeam');__astra.step(0);const p=__astra.camera.position.clone().set(-138,6.9,-58.8).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
    await page.mouse.click(point.x,point.y);assert.equal(await page.locator('.card h2').textContent(),'Nell’s Corner & upstairs flats');
    await page.getByRole('button',{name:'Close details',exact:true}).click();
    await page.getByRole('button',{name:'Sunbeam Terrace',exact:true}).click();
    assert(await page.getByRole('button',{name:'Sunbeam Terrace',exact:true}).evaluate(b=>b.classList.contains('active')));
    await page.evaluate(()=>__astra.setPaused(true));const frozen=await page.evaluate(()=>__astra.world.sunbeam.audit());
    await page.evaluate(()=>{for(let i=0;i<30;i++)__astra.step(.1,false);});assert.deepEqual(await page.evaluate(()=>__astra.world.sunbeam.audit()),frozen);
    await page.evaluate(()=>{__astra.setPaused(false);for(let i=0;i<30;i++)__astra.step(.1,false);});assert.notDeepEqual(await page.evaluate(()=>__astra.world.sunbeam.audit()),frozen);
    const visits=await page.evaluate(()=>{
      __astra.setHour(10);const arrived=new Set(),away=new Set();
      for(let i=0;i<6000;i++){
        __astra.step(.1,false);
        for(const p of __astra.residents.people.filter(p=>p.local))if(!p.route.length&&p.destination?.node===p.node){arrived.add(p.destination.name);if(p.destination.district!=='sunbeam')away.add(p.name);}
      }
      return {arrived:[...arrived],away:[...away]};
    });
    for(const name of ['Nell’s Corner & upstairs flats','The Washhouse & upstairs flats','Astra High School','The Reading Room'])assert(visits.arrived.includes(name),'No arrival at '+name);
    assert.equal(visits.away.length,8,'Every new resident reaches the wider town');
    const night=await page.evaluate(()=>{__astra.setHour(23);for(let i=0;i<9000;i++){__astra.setHour(23);__astra.step(.1,false);}return __astra.residents.people.filter(p=>p.local).map(p=>({name:p.name,home:p.node===p.home&&!p.route.length}));});
    assert(night.every(p=>p.home),'All new residents return to their own home');
    await page.evaluate(()=>{__astra.setHour(10);__astra.selectPerson(__astra.residents.people.find(p=>p.name==='Nell'));});
    await page.getByRole('button',{name:'Follow their day'}).click();assert.equal(await page.evaluate(()=>__astra.following),'Nell');
    await page.getByRole('button',{name:'Close details',exact:true}).click();
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
    await shot('07-sunbeam-mobile','sunbeam',10.4);
    const mobile=await page.evaluate(()=>{const gl=__astra.renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return {pixel:[...pixel],width:document.documentElement.scrollWidth};});
    assert.equal(mobile.width,390);assert.equal(mobile.pixel[3],255);
    const audit=await page.evaluate(()=>__astra.audit());assert.equal(audit.people,40);assert(audit.report.ok);assert.equal(audit.report.districts,9);assert.equal(audit.report.buildings,35);
    assert.deepEqual(errors,[]);
    writeFileSync(dir+'evidence.json',JSON.stringify({audit,visits,night,mobile,errors,checks:['Sunbeam camera and tab','pointer selection of Nell’s Corner','pause/resume courtyard activity','eight residents reach wider town','local shop and laundry arrivals','school and bookshop arrivals','eight residents return home at night','follow Nell','mobile render','rotated washhouse view']},null,2));
  }
} finally {await browser.close();}
