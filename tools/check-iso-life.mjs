// Run after npm run build. Checks the real iso startup path without capturing film.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import assert from 'node:assert/strict';

const server=await preview({preview:{port:0,host:'127.0.0.1'}});
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 for(const size of ['large','medium']){
  await page.goto(`${server.resolvedUrls.local[0]}?size=${size}&seed=1234&life=1&hour=9.021&timescale=0&weekday=wed&weather=clear&prmax=1&shadowMap=1024`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000,polling:200});
  const startup=await page.evaluate(()=>({mode:__life.mode,camera:__stage.camera.type,player:!!__life.camera.player,hud:!!__life.hud,methods:['step','setHour','setTimescale','activities'].map(k=>typeof __life[k]),contexts:__life.contexts(),props:__life.props.inspect(),group:!!__stage.scene.getObjectByName('life-props')}));
  assert.equal(startup.mode,'iso');assert.equal(startup.camera,'OrthographicCamera');assert.equal(startup.player,false);assert(startup.hud);assert(startup.methods.every(t=>t==='function'));
  assert.equal(startup.contexts.length,12);assert(startup.contexts.every(c=>c.currentAction&&c.currentAction.tool!=='walkTo'));
  assert(startup.group&&startup.props.meal&&startup.props.bellPlaceId);assert.equal(startup.props.doors.length,4);
  const types=new Set();
  for(const hour of [9.021,12.021]){
   const result=await page.evaluate(hour=>{
    __life.setHour(hour);const first=__life.contexts();__life.setHour(hour);
    const repeatable=JSON.stringify(first)===JSON.stringify(__life.contexts());
    __life.step(0,hour*3600);__post.render(__stage.camera);
    const people=__iso.interact.records.filter(r=>r.person).map(r=>({id:r.person.i.id,tool:r.person.o.userData.tool,speech:r.person.o.userData.speech,path:r.person.path}));
    return {repeatable,people,activities:__life.activities(),history:__life.history()};
   },hour);
   assert(result.repeatable);assert.equal(result.people.length,12);assert(result.people.every(p=>p.tool&&p.path.length===0));
   for(const event of result.activities){types.add(event.type);assert(event.ids.every(id=>result.people.some(p=>p.id===id&&p.tool)));}
   assert(result.history.some(h=>h.tool==='talkTo'));
   if(hour===12.021){assert(result.history.some(h=>h.tool==='buy'));assert(result.history.some(h=>h.tool==='visit'&&h.args.activity==='play'));}
   console.log(JSON.stringify({size,hour,activities:[...new Set(result.activities.map(a=>a.type))],tools:[...new Set(result.people.map(p=>p.tool))],repeatable:result.repeatable}));
  }
  for(const type of ['greet','chat','shop','play'])assert(types.has(type),`${size}: missing ${type}`);
  const state=await page.evaluate(()=>__iso.state);
  await page.keyboard.press('w');await page.keyboard.press('Tab');
  assert.deepEqual(await page.evaluate(()=>{__life.step(.1,1);return __iso.state;}),state);
  assert(await page.evaluate(()=>{const ok=__life.interiors.enter('inn');__life.step(0,1);__post.render(__stage.camera);return ok&&__life.interior.id==='inn'&&__life.interiors.exit();}));
 }
 assert.deepEqual(errors,[]);console.log('iso life startup, routine seeks, props, room peek and camera checks passed');
} finally {
 await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));
}
