import assert from 'node:assert/strict';

export async function verifyMerged(page) {
 const checks=[],result={};
 const stage=label=>{checks.push(label);console.log('Verified: '+label);};
 // Selection must use world-space bounds after district relocation.
 for(const id of ['fire-station','clinic','library','police-post','civic-park','work-station','work-farm','work-timber','work-depot','sunbeam-0','sunbeam-5','school','football','fountain']){
  const point=await page.evaluate(id=>{
   const a=__astra,v=[...a.town.venues,...a.town.buildings].find(v=>v.id===id||v.key===id);
   a.view({x:v.pos[0],z:v.pos[1],zoom:3.6});a.step(0);
   const p=a.camera.position.clone().set(v.pos[0],v.custom?6.9:(v.height||1)*.65,v.pos[1]+(v.custom?3.27:0)).project(a.camera);
   return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,name:v.name,district:v.district};
  },id);
  await page.mouse.click(point.x,point.y);
  assert.equal(await page.locator('.card h2').textContent(),point.name,id+' pointer selection');
  if(point.district==='works')assert.match(await page.locator('.card .badge').textContent(),/West Works/);
  if(point.district==='civic-green')assert.match(await page.locator('.card .badge').textContent(),/Civic Green/);
  await page.getByRole('button',{name:'Close details',exact:true}).click();
 }
 stage('14 civic, workplace, school and relocated home pointer selections');
 for(const view of ['civic','sunbeam','downtown','campus','quay','works','market','orchard']){
  await page.locator(`[data-view="${view}"]`).click();
  await page.evaluate(()=>{for(let n=0;n<110;n++)__astra.step(.1,false);});
  assert.equal(await page.locator(`[data-view="${view}"]`).getAttribute('class'),'active');
  assert.equal(await page.locator('.work-panel').isVisible(),view==='works');
 }
 stage('all district tabs and correctly scoped activity panel');
 result.work=await page.evaluate(()=>{
  const a=__astra,reached=new Set();
  for(let n=0;n<5000;n++){a.setHour(9);a.step(.1,false);for(const p of a.residents.people)if(p.workplace&&p.node===p.workplace.node&&!p.route.length)reached.add(p.name);}
  return {arrived:[...reached],...a.world.works.audit()};
 });
 assert.equal(result.work.arrived.length,6);assert.equal(result.work.workers,6);assert(result.work.shipped>0);assert(result.work.collections>0);
 stage('six real work commutes, staffed production and train collection');
 // Verify a moving resident remains selectable near the relocated workplace.
 const worker=await page.evaluate(()=>{
  const a=__astra,p=a.residents.people.find(p=>p.name==='Rowan');a.view({x:p.object.position.x,z:p.object.position.z,zoom:4});a.step(0);
  const v=p.object.position.clone();v.y+=.9;v.project(a.camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
 });
 await page.mouse.click(worker.x,worker.y);assert.equal(await page.locator('.card h2').textContent(),'Rowan');
 await page.getByRole('button',{name:'Follow their day'}).click();assert.equal(await page.evaluate(()=>__astra.following),'Rowan');
 await page.getByRole('button',{name:'Close details',exact:true}).click();
 stage('worker pointer selection and following');
 const snapshot=()=>page.evaluate(()=>({people:__astra.audit().positions,work:__astra.world.works.audit(),civic:__astra.world.civicQuarter.audit(),homes:__astra.world.sunbeam.audit(),crowd:__astra.world.districts.downtown.audit(),sports:__astra.world.districts.civic.audit()}));
 await page.evaluate(()=>{__astra.setHour(20.5);__astra.step(0,false);__astra.setPaused(true);});
 const frozen=await snapshot();await page.evaluate(()=>{for(let i=0;i<30;i++)__astra.step(.1,false);});assert.deepEqual(await snapshot(),frozen);
 await page.evaluate(()=>{__astra.setPaused(false);for(let i=0;i<30;i++)__astra.step(.1,false);});assert.notDeepEqual(await snapshot(),frozen);
 stage('shared pause/resume across residents, services, train, homes, crowds and sports');
 result.evening=await page.evaluate(()=>__astra.world.districts.downtown.audit().visible);
 assert(result.evening.game>200&&result.evening.night>40);assert.equal(result.evening.day,0);
 await page.evaluate(()=>{__astra.setHour(2);__astra.step(0,false);});
 assert.deepEqual(await page.evaluate(()=>__astra.world.districts.downtown.audit().visible),{day:0,night:0,game:0});
 assert.equal(await page.evaluate(()=>__astra.world.works.audit().train.open),false);
 stage('packed Friday game, evening bar street and overnight closure');
 result.lunch=await page.evaluate(()=>{
  const a=__astra;for(let n=0;n<5000;n++){a.setHour(12.5);a.step(.1,false);}
  return a.residents.people.filter(p=>p.workplace).map(p=>({name:p.name,arrived:p.destination?.id==='fountain'&&p.node===p.destination.node&&!p.route.length}));
 });assert(result.lunch.every(p=>p.arrived));
 stage('all six workers walk downtown for lunch');
 result.visits=await page.evaluate(()=>{
  const a=__astra,civic=new Set(),away=new Set(),places=new Set();
  for(let n=0;n<15000;n++){
   a.setHour(10);a.step(.1,false);
   for(const p of a.residents.people)if(!p.route.length&&p.destination?.node===p.node){
    if(p.destination.district==='civic-green')civic.add(p.destination.id);
    if(p.local){places.add(p.destination.name);if(p.destination.district!=='sunbeam')away.add(p.name);}
   }
  }
  return {civic:[...civic],away:[...away],places:[...places]};
 });
 assert.equal(result.visits.civic.length,5);assert.equal(result.visits.away.length,8);
 for(const name of ['Nell’s Corner & upstairs flats','The Washhouse & upstairs flats','Astra High School','The Reading Room'])assert(result.visits.places.includes(name),name);
 stage('all civic destinations visited; all eight terrace residents reach shops and school');
 result.home=await page.evaluate(()=>{
  const a=__astra;for(let n=0;n<9000;n++){a.setHour(23);a.step(.1,false);}
  return a.residents.people.filter(p=>p.local||p.workplace).map(p=>({name:p.name,arrived:p.node===p.home&&!p.route.length}));
 });assert(result.home.every(p=>p.arrived));
 const closed=await page.evaluate(()=>{const a=__astra,before=a.world.works.audit();for(let i=0;i<100;i++)a.step(.1,false);return {before,after:a.world.works.audit()};});
 assert.equal(closed.before.produce,closed.after.produce);assert.equal(closed.before.timber,closed.after.timber);
 stage('workers and terrace residents return to real homes; no overnight production');
 return {...result,checks};
}
