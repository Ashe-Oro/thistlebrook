import {chromium} from 'playwright-core';
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const shots=[
 ['70-world-day','village',10.4,1],['71-world-golden','village',17.5,1],['72-world-night','village',21,1],
 ['73-town-center','downtown',14,0],['74-saltwind-harbor','harbor',16,0],['75-merrymead-fair','fair',17.5,0],
 ['76-stillwater','outskirts',10.4,0],['77-municipal-airport','airport',14,0],['78-switchyard','skatepark',16,0],
 ['79-pinecrest','themepark',17,0],['80-coral-coast','coast',17.5,0],['81-ocean-drive-night','strip',21,0],
 ['82-roadster-proving-ground','roadster',16,0],['83-starbase-texas','starbase',17,0],['84-launch-tower','launch',17,0],
 ['85-west-works','works',10.4,0],['86-sunbeam-terrace','sunbeam',10.4,0],['87-civic-green','civic',14,0],
 ['88-astra-high','campus',17.5,0],['89-lantern-quay','quay',21,0],['90-willowbank','neighbourhood',14,0],
 ['91-market-square','market',14,0],['92-clover-fields','orchard',17,0],['93-world-original-angle','village',10.4,0],
];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[],evidence=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.status()+' '+r.url());});await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://localhost:5173/?capture&view=village&hour=10.4');await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();for(let i=0;i<1000;i++){__astra.setHour(10.4);__astra.step(.1,false);}__astra.step(0);});
 for(const [name,view,hour,rotation]of shots.filter(s=>!process.argv.slice(2).length||process.argv.slice(2).includes(s[0]))){
  const state=await page.evaluate(({view,hour,rotation})=>{const a=__astra;a.controls.view({...a.controls.state(),rotation},true);a.view(view);a.setHour(hour);for(let i=0;i<40;i++)a.step(.1,false);if(view==='roadster'){const to=(48.73-a.elapsed%87+87)%87;for(let i=0;i<Math.ceil(to*10);i++)a.step(.1,false);}a.setHour(hour);a.step(0);document.activeElement?.blur();return {camera:a.controls.state(),hour:a.hour,elapsed:a.elapsed,moment:document.querySelector('#moment-title').textContent,renderRegistryErrors:a.audit().renderRegistryErrors};},{view,hour,rotation});
  assert.deepEqual(state.renderRegistryErrors,[]);await page.screenshot({path:`shots/astra/${name}.png`,timeout:180000});evidence.push({file:name+'.png',view,...state});console.log(name);
 }
 assert.deepEqual(errors,[]);const evidencePath='shots/astra/round3-capture-evidence.json',previous=process.argv.length>2&&existsSync(evidencePath)?JSON.parse(readFileSync(evidencePath)).shots:[];writeFileSync(evidencePath,JSON.stringify({shots:[...previous.filter(s=>!evidence.some(e=>e.file===s.file)),...evidence].sort((a,b)=>a.file.localeCompare(b.file)),errors,audit:await page.evaluate(()=>__astra.audit())},null,2));
}finally{await browser.close();}
