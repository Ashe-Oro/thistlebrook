import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../shots/astra-life/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5184/?seed=831&capture=1&hour=10.4');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>document.querySelector('.loading').remove());
 const shot=async(name,view)=>{await page.evaluate(view=>{__astra.view(view);__astra.step(0);},view);await page.screenshot({path:dir+name+'.png',timeout:60000,animations:'disabled'});console.log(name);};
 // Pick a real rendered resident with the pointer, then use the existing card.
 const pick=await page.evaluate(()=>{for(const person of __astra.residents.people){__astra.view({x:person.object.position.x,z:person.object.position.z,zoom:4});__astra.step(0);const v=person.object.position.clone();v.y+=.8;v.project(__astra.camera);const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;if(__astra.pick(x,y)?.person===person)return {x,y,name:person.name};}return null;});assert(pick);
 await page.mouse.click(pick.x,pick.y);await page.evaluate(()=>__astra.step(0));assert.equal(await page.locator('.card h2').textContent(),pick.name);assert(await page.locator('.life-panel').isVisible());await page.getByRole('button',{name:'Close details',exact:true}).click();
 for(const expected of [3,8,1]){await page.getByRole('button',{name:'Change simulation speed',exact:true}).click();assert.equal(await page.evaluate(()=>__astra.speed),expected);}
 assert(await page.evaluate(()=>__astra.residents.people.every(p=>!p.bubble)));
 await shot('01-routines-begin','village');
 const meals=await page.evaluate(()=>{
  const life=__astra.residents.life;for(let i=0;i<6500;i++){__astra.step(.1,false);const diners=life.actors.filter(a=>a.context.location.place==='life:picnic'&&a.action?.tool==='eat');if(diners.length){const p=__astra.residents.people.find(p=>p.actor===diners[0]);__astra.selectPerson(p);__astra.step(0);return {name:p.name,hour:__astra.hour,events:p.actor.history};}}return null;
 });assert(meals,'A resident should use the picnic table for a meal');
 await shot('02-picnic-lunch',{x:-57,z:-10,zoom:5});
 await page.getByRole('button',{name:'Close details',exact:true}).click();
 const chess=await page.evaluate(()=>{
  const life=__astra.residents.life;for(let i=0;i<8500;i++){__astra.step(.1,false);const players=life.actors.filter(a=>a.context.location.place==='life:chess'&&a.game?.ready);if(players.length===2){__astra.selectPerson(__astra.residents.people.find(p=>p.actor===players[0]));__astra.step(0);return {names:players.map(a=>a.context.name),hour:__astra.hour,game:life.games.get('life:chess')};}}return null;
 });assert(chess,'Two residents should actually arrive and play chess');
 await shot('03-chess-on-the-square',{x:-59,z:-1,zoom:5});
 await page.getByRole('button',{name:'Close details',exact:true}).click();
 const baseball=await page.evaluate(()=>{
  const life=__astra.residents.life;for(let i=0;i<14000;i++){__astra.step(.1,false);const players=life.actors.filter(a=>a.context.location.place==='baseball'&&a.game?.ready);if(players.length===3&&players[0].game.elapsed%36>4&&players[0].game.elapsed%36<6){__astra.selectPerson(__astra.residents.people.find(p=>p.actor===players[0]));__astra.step(0);return {names:players.map(a=>a.context.name),hour:__astra.hour,game:life.games.get('baseball'),positions:players.map(a=>[a.context.name,__astra.residents.people.find(p=>p.actor===a).object.position.toArray()])};}}return null;
 });assert(baseball,'Three named residents should arrive and run batting practice');
 await shot('04-baseball-in-play',{x:-22,z:-82,zoom:4});
 await page.getByRole('button',{name:'Pause village',exact:true}).click();const frozen=await page.evaluate(()=>JSON.stringify(__astra.residents.life.audit()));await page.evaluate(()=>{for(let i=0;i<50;i++)__astra.step(.1,false)});assert.equal(await page.evaluate(()=>JSON.stringify(__astra.residents.life.audit())),frozen);
 await page.getByRole('button',{name:'Follow their day',exact:false}).click();await page.evaluate(()=>{for(let i=0;i<30;i++)__astra.step(.1,false);__astra.step(0)});assert(await page.evaluate(()=>!!__astra.following));
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>__astra.step(0));await page.screenshot({path:dir+'05-mobile-follow.png',timeout:60000});
 const mobile=await page.evaluate(()=>{const r=document.querySelector('.life-card').getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};});assert(mobile.left>=0&&mobile.right<=mobile.width&&mobile.bottom<=mobile.height-80);
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Close details',exact:true}).click();
 await page.evaluate(()=>{__astra.setPaused(false);__astra.setHour(23);for(let i=0;i<3500;i++)__astra.step(.1,false);__astra.step(0);});
 const home=await page.evaluate(()=>__astra.residents.life.actors.filter(a=>a.context.location.place===a.context.assets.home).length);assert(home>=24,'Residents return home at night');
 await shot('06-home-after-dark','neighbourhood');
 assert.deepEqual(errors,[]);
 const audit=await page.evaluate(()=>__astra.residents.life.audit());writeFileSync(dir+'evidence.json',JSON.stringify({meals,chess,baseball,mobile,home,errors,audit,checks:['pointer picks a rendered resident and opens live context','speed cycles 1/3/8','no speech bubbles','natural lunch arrival and seated meal','two-player chess','three-player batting practice','pause freezes context and games','follow resident','mobile card fits','night home arrivals','no browser errors']},null,2));
}finally{await browser.close();}
