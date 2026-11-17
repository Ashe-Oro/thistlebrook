import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {sceneData,groupAssets} from '../src/catalog/library/index.js';
const dir=new URL('../shots/astra-catalog/groups/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const audit=[];
try{
 for(const group of sceneData.groups){
  const pages=Math.ceil(groupAssets(group.id).length/24);
  for(let n=0;n<pages;n++){
   const page=await browser.newPage({viewport:{width:1600,height:1300}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
   await page.goto(`http://localhost:5187/catalog.html?group=${group.id}&page=${n}`);await page.waitForFunction(()=>window.__ready||window.__atlasError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__atlasError),undefined);
   await page.evaluate(()=>__atlas.render());await page.screenshot({path:`${dir}${group.id}-${n+1}.png`});
   await page.locator('.asset').first().click();await assert.doesNotReject(()=>page.locator('dialog[open]').waitFor());assert((await page.locator('dialog pre').textContent()).includes('geometry'));assert.deepEqual(errors,[]);
   audit.push({...await page.evaluate(()=>({ids:__atlas.ids,group:__atlas.group,page:__atlas.page})),errors});await page.close();console.log(`${group.id} ${n+1}/${pages}`);
  }
 }
 assert.equal(audit.flatMap(a=>a.ids).length,561);writeFileSync(dir+'coverage.json',JSON.stringify(audit,null,2));
}finally{await browser.close();}
