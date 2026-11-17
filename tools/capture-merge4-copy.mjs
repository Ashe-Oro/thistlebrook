import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const phase=process.argv[2]||'after',dir='shots/sol-merge4';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],evidence={};
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await page.routeWebSocket('**',ws=>ws.close());await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 if(phase==='before')for(const file of ['src/astra/registry/index.js','src/astra/life/runtime.js','src/astra/life/planner.js','src/astra/life/registry.js']){const body=execFileSync('git',['show',`5e9d64c:${file}`],{encoding:'utf8'});await page.route(`**/${file}*`,r=>r.fulfill({contentType:'application/javascript',body}));}
 async function load(hour){console.log('Loading',phase,hour);await page.goto('http://localhost:5204/?capture&seed=831&view=neighbourhood');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);await page.evaluate(hour=>{document.querySelector('.loading')?.remove();__astra.setPaused(true);__astra.setHour(hour);},hour);}
 await load(7);
 console.log('Ready for morning');
 evidence.morning=await page.evaluate(()=>{const a=__astra;for(let t=1;t<=60;t++)a.residents.update(1,t,7);const people=a.residents.people.map(p=>({name:p.name,activity:p.actor.activity,target:p.actor.action?.target}));const p=a.residents.people.find(p=>/Washhouse/.test(p.actor.activity))||a.residents.people[0];a.controls.view({x:p.object.position.x,z:p.object.position.z,zoom:3,rotation:0},true);a.selectPerson(p);a.step(0);return people;});
 await page.screenshot({path:`${dir}/${phase}-morning.png`,timeout:120000,animations:'disabled'});
 await load(21);
 evidence.meal=await page.evaluate(()=>{const a=__astra,p=a.residents.people[0],life=a.residents.life;life.setBrain(()=>null);life.setHour(21);const result=life.execute(p.actor,{tool:'eat',args:{target:p.context.assets.home},reason:'An evening meal at home'});a.residents.update(.01,1,21);a.controls.view({x:p.object.position.x,z:p.object.position.z,zoom:5,rotation:0},true);a.selectPerson(p);a.step(0);return {result,activity:p.actor.activity};});
 assert(evidence.meal.result.ok);if(phase==='after')assert.equal(evidence.meal.activity,'Enjoying supper');
 await page.screenshot({path:`${dir}/${phase}-supper.png`,timeout:120000,animations:'disabled'});
 await load(16);
 evidence.music=await page.evaluate(()=>{const a=__astra,p=a.residents.people.find(p=>p.name==='Theo'),scene=a.town.catalogScenes.find(s=>s.id==='lawn-fair-music'),slot=scene.slots.find(s=>s.activity==='play-music'),target='activity:'+slot.id; a.residents.life.setBrain(({self})=>self.name==='Theo'?{tool:self.location.place===target?'visit':'walkTo',args:{target},reason:'An afternoon at the drum'}:null);for(let t=1;t<=1400;t++){a.residents.update(1,t,16);if(p.context.location.place===target&&p.actor.action?.tool==='visit')break;}a.controls.view({x:p.object.position.x,z:p.object.position.z,zoom:5,rotation:0},true);a.selectPerson(p);a.step(0);return {target,place:p.context.location.place,activity:p.actor.activity};});
 assert.equal(evidence.music.place,evidence.music.target);if(phase==='after')assert.equal(evidence.music.activity,'Playing the taiko drum');
 await page.screenshot({path:`${dir}/${phase}-music.png`,timeout:120000,animations:'disabled'});
 assert.deepEqual(errors,[]);writeFileSync(`${dir}/${phase}-copy-evidence.json`,JSON.stringify({...evidence,errors},null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close();}
