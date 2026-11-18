import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activityCopy,mealCopy,walkingCopy} from '../src/astra/life/activity-copy.js';
import {scriptedPlanner} from '../src/astra/life/planner.js';
import {createLife} from '../src/astra/life/runtime.js';
import {compileAstra} from '../src/compiler/astra.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const town=compileAstra(catalog,831);
test('follow copy describes activities and meals without leaking catalog keys',()=>{
 assert.equal(activityCopy('play-music','edo-village/taiko_drum'),'Playing the taiko drum');
 for(const [activity,asset] of [['sit','nature/log_bench'],['eat','edo-village/tea_table'],['browse','edo-village/yatai_food_stall']]){
  const label=activityCopy(activity,asset);assert(!/[_/:]/.test(label));assert.equal(walkingCopy({interaction:{label}}),'Heading over · '+label);
 }
 assert.deepEqual([7,12,19,21,23,2].map(mealCopy),['Enjoying breakfast','Enjoying lunch','Enjoying supper','Enjoying supper','Enjoying a late snack','Enjoying a late snack']);
 const life=createLife(town,{brain:()=>null,hour:21}),a=life.actors[0];
 assert(life.execute(a,{tool:'eat',args:{target:a.context.assets.home},reason:'Supper at home'}).ok);assert.equal(a.activity,'Enjoying supper');
});
test('morning restocking is staggered and homes do not sell packed meals',()=>{
 const life=createLife(town,{hour:7});
 const homes=life.registry.places.filter(p=>p.kind==='home');assert(homes.length);assert(homes.filter(p=>town.buildings.find(b=>b.key===p.id)?.shop!=='grocer').every(p=>!p.capabilities.includes('buy')));
 assert(life.registry.places.find(p=>p.name.includes('Nell’s Corner')).capabilities.includes('buy'));
 assert(!life.registry.places.find(p=>p.name.includes('Washhouse')).capabilities.includes('buy'));
 const starts=[];
 for(const a of life.actors){
  const snapshot=structuredClone(life.snapshot(a));snapshot.self.assets.inventory.meal=1;snapshot.self.needs.hunger=100;snapshot.self.needs.energy=90;
  snapshot.self.job.shift=[16,22];snapshot.self.job.commute=0;snapshot.self.memory.lastBreak=0;
  snapshot.self.bills=[];snapshot.self.job.product=null;
  for(let h=7;h<=11;h+=.05){snapshot.clock.hour=h;const action=scriptedPlanner(snapshot);if(action?.reason==='Restock the lunch bag'){starts.push(h);break;}}
 }
 assert(starts.length>30);assert(starts.every(h=>h>=8));assert(Math.max(...starts)-Math.min(...starts)>2);
});
