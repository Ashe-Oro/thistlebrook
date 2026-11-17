import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const directory='shots/sol-merge4/assets';mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await page.routeWebSocket('**',ws=>ws.close());
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.route('**/favicon.ico',r=>r.fulfill({status:204}));
 page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://localhost:5204/?capture&seed=831&view=orchard');
 await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:180000,polling:200});
 assert.equal(await page.evaluate(()=>window.__astraError),undefined);
 const coverage=await page.evaluate(()=>{
  const a=__astra,seen=new Set();a.scene.traverse(o=>{for(const id of o.userData.registryIds||[o.userData.registryId])if(id)seen.add(id);});
  const scenes=a.town.catalogScenes.filter(s=>s.id.startsWith('vignette-'));
  return {scenes:scenes.map(s=>({id:s.id,name:s.name,district:s.district,center:s.center,members:s.members.map(m=>({id:m.registryId,asset:m.asset})),slots:s.slots.length})),
   missing:scenes.flatMap(s=>s.members.filter(m=>!seen.has(m.registryId)).map(m=>m.registryId)),
   unreachable:scenes.flatMap(s=>s.slots.filter(slot=>!a.registry.walkTo('activity:'+slot.id,{fromNode:0,slot:slot.id}).ok).map(s=>s.id)),
   rejected:a.residents.life.registry.rejected,renderErrors:a.audit().renderRegistryErrors};
 });
 assert.deepEqual(coverage.missing,[]);assert.deepEqual(coverage.unreachable,[]);assert.deepEqual(coverage.rejected,[]);assert.deepEqual(coverage.renderErrors,[]);
 await page.evaluate(()=>{document.querySelector('.loading')?.remove();__astra.setPaused(true);__astra.setHour(16);});
 const journeys=await page.evaluate(()=>{
  const a=__astra,assignments={Mabel:['vignette-garden-exchange','browse'],Bram:['vignette-woodcutters','sort'],Finn:['vignette-hay-delivery','sort']},targets={};
  for(const [name,[id,activity]]of Object.entries(assignments)){
   const scene=a.town.catalogScenes.find(s=>s.id===id),slot=scene.slots.find(s=>s.activity===activity);targets[name]='activity:'+slot.id;
  }
  a.residents.life.setBrain(({self})=>{const target=targets[self.name]||self.assets.home;return {tool:self.location.place===target?(targets[self.name]?'visit':'rest'):'walkTo',args:{target},reason:'Inspect the new town corners'};});
  const distances=Object.fromEntries(Object.keys(assignments).map(n=>[n,0]));
  for(let t=1;t<=1400;t++){
   const before=a.residents.people.filter(p=>assignments[p.name]).map(p=>({name:p.name,pos:[...p.context.location.position]}));
   a.residents.update(1,t,16);
   for(const b of before){const p=a.residents.people.find(p=>p.name===b.name),d=Math.hypot(...p.context.location.position.map((v,k)=>v-b.pos[k]));if(d>p.context.personality.pace+.0001)throw Error('Resident teleported: '+p.name);distances[p.name]+=d;}
   if(Object.entries(targets).every(([name,target])=>{const p=a.residents.people.find(p=>p.name===name);return p.context.location.place===target&&p.actor.action?.tool==='visit';}))break;
  }
  return Object.entries(targets).map(([name,target])=>{const p=a.residents.people.find(p=>p.name===name);return {name,target,place:p.context.location.place,slot:p.context.location.slot,position:p.object.position.toArray(),distance:distances[name],pose:p.actor.pose,reserved:[...a.residents.life.reservations].some(([key,id])=>id===p.context.id&&key.startsWith(target+'/'))};});
 });
 for(const j of journeys){assert.equal(j.place,j.target);assert(j.slot);assert(j.reserved);assert(j.distance>10);assert.equal(j.pose,j.name==='Mabel'?'idle':'work');}
 for(const scene of coverage.scenes){
  await page.evaluate(id=>{const a=__astra,s=a.town.catalogScenes.find(s=>s.id===id);a.view(s.district==='civic-green'?'civic':s.district);a.controls.view({x:s.center[0],z:s.center[1],zoom:6,rotation:0},true);a.step(0);},scene.id);
  await page.screenshot({path:`${directory}/${process.argv[2]||'after'}-${scene.id}.png`,timeout:120000,animations:'disabled'});
 }
 const cycles=await page.evaluate(()=>{
  const a=__astra;
  for(let t=1;t<=36;t++)a.residents.update(1,1500+t,16);
  return a.residents.life.actors.filter(p=>['Mabel','Bram','Finn'].includes(p.context.name)).map(p=>({name:p.context.name,completed:p.history.filter(e=>e.tool==='visit'&&e.status==='completed'&&e.args.target.startsWith('activity:vignette-')).length}));
 });
 for(const c of cycles)assert(c.completed>0,c.name+' completed an activity');
 assert.deepEqual(errors,[]);
 writeFileSync(`${directory}/${process.argv[2]||'after'}-evidence.json`,JSON.stringify({coverage,journeys,cycles,errors},null,2)+'\n');
 console.log(JSON.stringify({scenes:coverage.scenes.length,props:coverage.scenes.reduce((n,s)=>n+s.members.length,0),errors},null,2));
}finally{await browser.close();}
