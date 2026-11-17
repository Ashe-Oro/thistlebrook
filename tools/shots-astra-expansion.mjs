import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {resolve,sep} from 'node:path';
const dir=resolve(process.env.ASTRA_SHOTS_DIR||new URL('../shots/astra/',import.meta.url).pathname)+sep;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 const captureURL=new URL(process.env.ASTRA_URL||'http://localhost:5173/');captureURL.searchParams.set('capture','1');await page.goto(captureURL.href);await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading').remove();for(let i=0;i<100;i++)__astra.step(.1,false);__astra.step(0);});
 const shot=async(name,view,hour)=>{await page.evaluate(({view,hour})=>{__astra.view(view);if(hour!==undefined)__astra.setHour(hour);for(let n=0;n<120;n++)__astra.step(0,false);__astra.step(0);},{view,hour});await page.screenshot({path:dir+name+'.png',timeout:60000,animations:'disabled'});console.log(name);};
 await shot('19-downtown','downtown',10.4);await shot('20-high-school-campus','campus',15.5);await shot('21-owls-stadium','stadium',15.5);await shot('22-baseball','baseball',15.5);await shot('23-growing-town','village',10.4);await shot('24-school-entrance',{x:0,z:-60,zoom:4},15.5);await shot('25-main-street-evening','downtown',20.5);await shot('26-friday-night-lights','stadium',20.5);
 const audit=await page.evaluate(()=>__astra.audit());assert.equal(audit.people,40);assert(audit.report.ok);assert.equal(audit.report.districts,9);assert.equal(audit.report.venues,17);assert.equal(audit.report.buildings,35);
 for(const [id,view]of [['school','campus'],['football','stadium'],['baseball','baseball'],['fountain','downtown']]){
  const point=await page.evaluate(({id,view})=>{__astra.view(view);__astra.step(0);const v=__astra.town.venues.find(v=>v.id===id),p=__astra.camera.position.clone().set(v.pos[0],v.type==='school'?5:.4,v.pos[1]).project(__astra.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,name:v.name};},{id,view});await page.mouse.click(point.x,point.y);assert.equal(await page.locator('.card h2').textContent(),point.name);await page.getByRole('button',{name:'Close details',exact:true}).click();
 }
 await page.getByRole('button',{name:'After school',exact:true}).click();await page.evaluate(()=>__astra.step(0));assert.equal(await page.evaluate(()=>__astra.hour),15.5);
 // Pause covers the new sports, students and water as well as residents.
 await page.evaluate(()=>__astra.setPaused(true));const frozen=await page.evaluate(()=>__astra.world.districts.civic.audit());await page.evaluate(()=>{for(let i=0;i<30;i++)__astra.step(.1,false)});assert.deepEqual(await page.evaluate(()=>__astra.world.districts.civic.audit()),frozen);await page.evaluate(()=>{__astra.setPaused(false);for(let i=0;i<30;i++)__astra.step(.1,false)});assert.notDeepEqual(await page.evaluate(()=>__astra.world.districts.civic.audit()),frozen);
 // Accelerate ordinary movement, recording actual arrivals rather than just
 // requested destinations. Teachers, the cobbler and neighbours must arrive.
 const arrivals=await page.evaluate(()=>{__astra.setHour(9);const reached=new Set();for(let i=0;i<6000;i++){__astra.step(.1,false);for(const p of __astra.residents.people)if(!p.route.length&&p.destination?.node===p.node)reached.add(p.destination.name);}return [...reached];});
 for(const name of ['Astra High School','Sole & Stitch','Founders Fountain','Owls Memorial Stadium'])assert(arrivals.includes(name),'No actual resident arrival: '+name);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await shot('27-downtown-mobile','downtown',10.4);
 const mobilePixel=await page.evaluate(()=>{__astra.step(0);const gl=__astra.renderer.getContext(),p=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p];});assert.equal(mobilePixel[3],255);assert(Math.abs(mobilePixel[0]-232)+Math.abs(mobilePixel[1]-237)+Math.abs(mobilePixel[2]-227)>20,'Mobile canvas must contain the fountain, not an empty background');
 assert.deepEqual(errors,[]);writeFileSync(dir+'expansion-evidence.json',JSON.stringify({audit,arrivals,mobilePixel,errors,checks:['campus and downtown render','all districts connected','school click','football click','baseball click','fountain click','after-school clock control','mobile downtown','pause freezes sports and water','sports and water resume','actual school arrivals','actual cobbler arrivals','actual fountain arrivals','actual stadium arrivals']},null,2));
}finally{await browser.close();}
