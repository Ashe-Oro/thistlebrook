import {seedModelPlacements} from '../src/astra/registry/seed-models.js';
import {chromium} from 'playwright-core';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {compileWorld} from '../src/compiler/world-plan.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.routeWebSocket('**',ws=>ws.close());
 page.on('pageerror',e=>console.error(e.stack));
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto(`http://localhost:${process.env.PORT||5201}/?registryCapture&capture&seed=831`);
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});
 const result=await page.evaluate(()=>{if(window.__astraError)throw Error(__astraError);return {models:__astra.town.renderedModels,selectables:__astra.world.selectables.map(s=>({data:s.data,min:s.bounds.min.toArray(),max:s.bounds.max.toArray()}))};});
 mkdirSync('out/astra',{recursive:true});writeFileSync('out/astra/district-capture.json',JSON.stringify(result,null,2)+'\n');console.log('Captured',result.models.length,'models');
 if(process.argv.includes('--write')){
  const catalog=resolveAll(JSON.parse(readFileSync('src/catalog/bounds.json'))),town=compileWorld(catalog,831,{capture:true});
  const models=result.models.filter(p=>!seedModelPlacements(town,catalog).some(t=>t.asset===p.asset&&Math.hypot(t.pos[0]-p.pos[0],t.pos[1]-p.pos[1])<.001));
  models.sort((a,b)=>a.id.localeCompare(b.id));
  const unique=new Map(models.map(p=>[p.id,p]));if(unique.size!==models.length)throw Error('Duplicate captured placement');
  writeFileSync('src/astra/registry/district-models.json',JSON.stringify(models,null,2)+'\n');
  console.log('Wrote',models.length,'static model records; woodland scatter remains seed-authored.');
 }
}finally{await browser.close();}
