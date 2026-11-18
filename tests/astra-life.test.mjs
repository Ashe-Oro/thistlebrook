import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileAstra} from '../src/compiler/astra.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {createLife} from '../src/astra/life/runtime.js';
import {buildLifeRegistry,interactionErrors,distance,TOOLS} from '../src/astra/life/registry.js';
import {baseballFrame,chessFrame} from '../src/astra/life/activities.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const town=compileAstra(catalog,831);
const call=(tool,target,extra={})=>({tool,args:{target,...extra},reason:'Test the action contract'});
function tick(life,seconds,hour=life.hour){for(let i=0;i<seconds*4;i++)life.update(.25,hour);}
function arrive(life,a,target,slot){assert.equal(life.execute(a,call('walkTo',target,slot?{slot}:{})).ok,true);for(let n=0;n<3000&&a.action;n++)life.update(.25,life.hour);assert.equal(a.context.location.place,target);}

test('registry is additive, JSON serializable, uniquely identified and has valid interaction metadata',()=>{
 const before=JSON.stringify(town),registry=buildLifeRegistry(town);
 assert.equal(JSON.stringify(town),before);assert.deepEqual(JSON.parse(JSON.stringify(registry)),registry);
 assert.equal(new Set(registry.places.map(p=>p.id)).size,registry.places.length);
 for(const p of registry.places.filter(p=>p.interaction))assert.deepEqual(interactionErrors(p.interaction,town),[],p.id);
 assert(registry.places.some(p=>p.interaction?.activity==='sit'));
 const tagged=structuredClone(registry.places.find(p=>p.id==='life:picnic'));tagged.id='registry:park-table';
 assert(buildLifeRegistry(town,[tagged]).places.some(p=>p.id===tagged.id));
 tagged.interaction.slots[1].id=tagged.interaction.slots[0].id;tagged.interaction.entryNode=-1;
 const broken=structuredClone(tagged);broken.id='bad:null-slot';broken.interaction.slots=[null];assert.doesNotThrow(()=>buildLifeRegistry(town,[null,broken]));
 const overlapping=structuredClone(registry.places.find(p=>p.id==='life:picnic').interaction);overlapping.slots[1].position=[...overlapping.slots[0].position];assert(interactionErrors(overlapping,town).includes('interaction slots overlap'));
 const bad=buildLifeRegistry(town,[tagged]);assert.equal(bad.rejected.length,1);assert(!bad.places.some(p=>p.id===tagged.id));
});

test('only the executor changes context; invalid actions have no effects',()=>{
 const life=createLife(town,{brain:()=>null}),a=life.actors[0],before=structuredClone(a.context);
 for(const action of [call('talkTo','resident:bram'),call('buy','missing'),call('work','parcel-12'),call('payBill','parcel-24',{bill:'household'}),call('teleport','parcel-1')])assert.equal(life.execute(a,action).ok,false);
 assert.deepEqual(a.context,before);assert.equal(a.action,null);
 const snapshot=life.snapshot(a);assert(Object.isFrozen(snapshot.self.assets.inventory));assert.throws(()=>snapshot.self.money=999999);
 life.setBrain(ctx=>{ctx.self.money=0;return null;});tick(life,1);assert.equal(a.context.money,before.money);assert(a.history.some(e=>e.detail.includes('read only')));
});

test('seats are reserved atomically; occupied slots reject and departure reverses the approach',()=>{
 const life=createLife(town,{brain:()=>null}),[a,b,c]=life.actors;
 assert(life.execute(a,call('walkTo','life:picnic',{slot:'north'})).ok);
 assert(!life.execute(b,call('walkTo','life:picnic',{slot:'north'})).ok);
 assert(life.execute(b,call('walkTo','life:picnic',{slot:'south'})).ok);
 assert(!life.execute(c,call('walkTo','life:picnic')).ok);
 tick(life,250);assert.equal(a.context.location.slot,'north');assert.equal(b.context.location.slot,'south');
 assert(life.execute(a,call('eat','life:picnic')).ok);const oldFood=a.context.assets.inventory.meal;tick(life,34);assert.equal(a.context.assets.inventory.meal,oldFood-1);
 const local=structuredClone(a.localPath);assert(life.execute(a,call('walkTo',a.context.assets.home)).ok);
 assert.deepEqual(a.route[0].pos,local.at(-2));assert.equal(life.reservations.get('life:picnic/north'),undefined);
 assert(life.execute(c,call('walkTo','life:picnic',{slot:'north'})).ok);
});

test('buy, sell, work and bills have bounded integer effects and reject unaffordable or repeated payments',()=>{
 const life=createLife(town,{brain:()=>null,hour:10}),a=life.actors[0];
 arrive(life,a,a.context.job.workplace);const before=a.context.money,stock=a.context.assets.inventory.bread;
 assert(life.execute(a,call('work',a.context.job.workplace)).ok);tick(life,46);assert.equal(a.context.money,before+a.context.job.wage);assert.equal(a.context.assets.inventory.bread,stock+1);
 assert(life.execute(a,call('sell',a.context.job.workplace,{item:'bread'})).ok);tick(life,9);assert.equal(a.context.assets.inventory.bread,stock);
 const food=a.context.assets.inventory.meal,cash=a.context.money;assert(life.execute(a,call('buy',a.context.job.workplace)).ok);tick(life,7);assert.equal(a.context.money,cash-300);assert.equal(a.context.assets.inventory.meal,food+2);
 for(const item of ['__proto__','constructor','missing'])assert(!life.execute(a,call('sell',a.context.job.workplace,{item})).ok);
 a.context.money=100;assert(!life.execute(a,call('buy',a.context.job.workplace)).ok);assert(!life.execute(a,call('payBill',a.context.job.workplace,{bill:'household'})).ok);
 a.context.money=1000;assert(life.execute(a,call('payBill',a.context.job.workplace,{bill:'household'})).ok);tick(life,8);const paid=a.context.money;assert(!life.execute(a,call('payBill',a.context.job.workplace,{bill:'household'})).ok);assert.equal(a.context.money,paid);
});

test('chess waits for an actual second arrival and shared activity strengthens relationships',()=>{
 const life=createLife(town,{brain:()=>null,hour:16}),[a,b]=life.actors;
 arrive(life,a,'life:chess','white');assert(life.execute(a,call('visit','life:chess')).ok);tick(life,4);assert.equal(a.action.elapsed,0);assert.equal(a.game.ready,false);
 assert(life.execute(b,call('walkTo','life:chess',{slot:'black'})).ok);
 for(let n=0;n<2000&&b.action;n++)life.update(.1,16);
 assert(life.execute(b,call('visit','life:chess')).ok);tick(life,4);assert(a.game.ready&&b.game.ready);assert.equal(a.game.elapsed,b.game.elapsed);assert(a.context.relationships.find(r=>r.id===b.context.id).sharedActivities>0);
 assert.equal(chessFrame(0).side,'white');assert.equal(chessFrame(6).side,'black');
});

test('baseball uses shared pitch/hit/field/return phases and ordered bases',()=>{
 const p=buildLifeRegistry(town).places.find(p=>p.id==='baseball'),i=p.interaction;
 assert.equal(baseballFrame(i,1).phase,'Wind-up');assert.equal(baseballFrame(i,2.4).phase,'Pitch');assert.equal(baseballFrame(i,4).phase,'Hit into the outfield');assert.equal(baseballFrame(i,6.5).phase,'Field the ball');assert.equal(baseballFrame(i,7.5).phase,'Return to the mound');
 for(let n=0;n<4;n++){const t=3.3+19.7*n/4;assert(distance(baseballFrame(i,t).positions.batter,i.game.bases[n])<1e-6);}
 assert(distance(baseballFrame(i,23).positions.batter,i.game.bases[0])<1e-6);
 for(const t of [2,2.8,3,3.3,6,7,8.4,11,23,24.5,36]){const before=baseballFrame(i,t-.0001),after=baseballFrame(i,t);for(const role of ['batter','pitcher','fielder'])assert(distance(before.positions[role],after.positions[role])<.002,'continuous '+role+' at '+t);assert(Math.hypot(...before.ball.map((v,k)=>v-after.ball[k]))<.002,'continuous ball at '+t);}
 assert.deepEqual(baseballFrame(i,36),baseballFrame(i,0));
});

test('natural days are deterministic, exercise every enabled action and never teleport or double-book',()=>{
 function simulate(){
  const life=createLife(town,{hour:6}),completed=new Set(),activities=new Set();let lastId=0;
  for(let n=0;n<10800;n++){
   const previous=life.actors.map(a=>[...a.context.location.position]);life.update(.25,(6+n*.25/90)%24);
   life.actors.forEach((a,i)=>{assert(distance(previous[i],a.context.location.position)<=a.context.personality.pace*.25+1e-6);assert(Number.isInteger(a.context.money)&&a.context.money>=0);for(const v of Object.values(a.context.needs))assert(v>=0&&v<=100);if(a.game?.ready)activities.add(a.context.location.place);});
   for(const e of life.events.filter(e=>e.id>lastId)){assert.notEqual(e.status,'rejected',e.detail);if(e.status==='completed')completed.add(e.tool);lastId=e.id;}
   const keys=[...life.reservations.keys()];assert.equal(new Set(keys).size,keys.length);
  }
  assert.deepEqual([...completed].sort(),[...TOOLS].sort());assert(activities.has('baseball')&&activities.has('life:chess'));assert.equal(life.day,1);
  return life.audit();
 }
 assert.deepEqual(simulate(),simulate());
});

test('time scrubbing does not advance the day or charge bills; midnight updates schedules once',()=>{
 const life=createLife(town,{hour:23.9,brain:()=>null}),a=life.actors[0],money=a.context.money,old=structuredClone(a.context.schedule);
 life.setHour(8);tick(life,1,8);assert.equal(life.day,0);assert.equal(a.context.money,money);
 life.setHour(23.99);life.update(.1,.001);assert.equal(life.day,1);assert.notDeepEqual(a.context.schedule,old);
 life.update(.1,.002);assert.equal(life.day,1);
});

test('additional seeds retain valid interactions and complete routine navigation',()=>{
 for(const seed of [1,22,331]){const t=compileAstra(catalog,seed),life=createLife(t,{hour:15});for(const p of life.registry.places.filter(p=>p.interaction))assert.deepEqual(interactionErrors(p.interaction,t),[]);tick(life,450,16);assert(life.actors.filter(a=>a.arrivals>0).length>=.9*life.actors.length);
  for(const a of life.actors.filter(a=>!a.arrivals))assert.equal(a.context.location.place,a.context.assets.home);
  assert(!life.events.some(e=>e.status==='rejected'));}
});

test('a passing greeting preserves the current trip, and an occupied bench rises before leaving',()=>{
 const life=createLife(town,{brain:()=>null}),[a,b]=life.actors;
 assert(life.execute(a,call('walkTo','life:fountain-bench-1',{slot:'sit-1'})).ok);
 const route=a.route;
 b.context.location.position=a.context.location.position.map((value,i)=>value+(i===0?1.5:0));
 assert(life.execute(a,call('talkTo',b.context.id)).ok);
 assert(a.greetingUntil>life.elapsed&&b.greetingUntil>life.elapsed);
 assert.equal(a.route,route);
 assert(!life.execute(a,call('talkTo',b.context.id)).ok);
 tick(life,250);
 assert.equal(a.context.location.slot,'sit-1');
 assert(life.execute(a,call('walkTo',a.context.assets.home)).ok);
 const position=[...a.context.location.position];
 life.update(.1);
 assert.deepEqual(a.context.location.position,position);
 life.update(.3);
 assert.notDeepEqual(a.context.location.position,position);
});
