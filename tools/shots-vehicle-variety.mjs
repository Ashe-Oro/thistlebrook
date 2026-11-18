// Vehicle & street variety stills: node tools/shots-vehicle-variety.mjs --prefix before|after [--port 5252]
import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const prefix=arg('prefix','after'),port=arg('port','5252'),only=arg('only','');
const dir=new URL('../shots/vehicle-variety/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
export const VIEWS={
 downtown:{view:{x:-58,z:-14,zoom:6.2},hour:10.4,warm:40},
 residential:{view:{x:-8,z:-5,zoom:6},hour:10.6,warm:40},
 harbor:{view:{x:166,z:60,zoom:3.6},hour:10.2,warm:10},
 coast:{view:{x:292,z:100,zoom:2.6},hour:11,warm:10},
 avenue:{view:{x:-90,z:-72,zoom:5.4},hour:10.4,warm:40},
 pier:{view:{x:169,z:62,zoom:10},hour:10.4,warm:40},
};
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const probes={};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto(`http://localhost:${port}/?capture=1&seed=831`);
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:900000,polling:1000});
 const err=await page.evaluate(()=>window.__astraError);if(err)throw Error(err);
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();for(let i=0;i<50;i++)__astra.step(.1,false);});
 const bytes=await page.evaluate(()=>performance.getEntriesByType('resource').reduce((s,e)=>s+(e.transferSize||e.encodedBodySize||0),0));
 probes.downloadBytes=bytes;
 for(const [name,v] of Object.entries(VIEWS)){if(only&&!only.split(',').includes(name))continue;
  const stats=await page.evaluate(({view,hour,warm})=>{__astra.setHour(hour);for(let n=0;n<warm*10;n++)__astra.step(.1,false);__astra.view(view);for(let n=0;n<60;n++)__astra.step(0,false);__astra.step(0);const a=__astra.audit();return {drawCalls:a.drawCalls,triangles:a.triangles,fleet:__astra.traffic.audit?.().fleet};},v);
  await page.screenshot({path:`${dir}${prefix}-${name}.png`,timeout:90000,animations:'disabled'});
  probes[name]=stats;console.log(prefix,name,JSON.stringify({drawCalls:stats.drawCalls,triangles:stats.triangles}));
 }
 probes.errors=errors;writeFileSync(`${dir}${prefix}-probes.json`,JSON.stringify(probes,null,2));
 if(errors.length)console.log('errors',errors.slice(0,5));
}finally{await browser.close();}
