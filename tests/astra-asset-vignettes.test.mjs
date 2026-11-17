import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileWorld,pointInWorld} from '../src/compiler/world-plan.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {registryCoverage} from '../src/astra/registry/coverage.js';
import {createWorldRegistry} from '../src/astra/registry/index.js';
import {buildLifeRegistry} from '../src/astra/life/registry.js';
import {getAsset,overlap,sceneData} from '../src/catalog/library/index.js';
import {compileScene,checkScene} from '../src/compiler/library-scenes.js';
import {vignetteObstacles,pathBox} from '../src/compiler/asset-vignettes.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));

test('asset vignettes stay on clear public land, with a real approach and exclusive activity for every prop',()=>{
 for(const seed of [0,17,99,831,9999]){
  const town=compileWorld(catalog,seed),registry=createWorldRegistry(town),scenes=town.catalogScenes.filter(s=>s.id.startsWith('vignette-'));
  assert(scenes.length>=10,`seed ${seed}: expected a useful amount of dressing`);
  const obstacles=vignetteObstacles(town,catalog);
  for(const scene of scenes){
   assert(!['airport','roadster','starbase'].includes(scene.district));assert.deepEqual(checkScene(scene),[]);
   assert(!obstacles.some(box=>overlap(scene.box,box,.34)),`${seed}: ${scene.id} obstacle`);
   assert(pointInWorld(scene.box.min,town)&&pointInWorld(scene.box.max,town));
   for(const other of town.catalogScenes.filter(s=>s!==scene))assert(!overlap(scene.box,other.box,.34),`${scene.id} / ${other.id}`);
   for(const [a,b]of scene.connector)assert(!obstacles.some(box=>overlap(box,pathBox(a,b,.45))),scene.id+' connector');
   for(const member of scene.members){
    const asset=getAsset(member.asset),place=registry.findPlace(member.registryId);assert.equal(asset.kind,'individual');assert.equal(asset.placement.mount,'ground');assert(member.interactions.length>0);assert(place.interactionPoints.length>0);
    for(const road of town.roads.filter(r=>r.owner!=='catalog:'+scene.id))assert(!overlap(member.box,pathBox(road.a,road.b,road.width/2+.24)),`${scene.id}: road ${road.owner}`);
    for(const slot of member.interactions){
     const target='activity:'+slot.id,p=registry.findPlace(target);assert(p.interaction);assert.equal(p.interaction.slots.length,1);assert(registry.walkTo(target,{fromNode:0,slot:slot.id}).ok);if(slot.provenance==='recipe-authored-exterior')assert(scene.members.every(m=>!overlap(m.box,pathBox([slot.position[0],slot.position[2]],[slot.approach[0],slot.approach[2]],.38))), slot.id);
    }
   }
  }
  assert.deepEqual(buildLifeRegistry(town).rejected,[]);
  const coverage=registryCoverage(town,catalog);assert.deepEqual(coverage.missing,[]);
  if(seed===831)assert(coverage.unusedIndividualModels<=345,'must bring at least 41 previously unused models into the town');
 }
});

test('vignette recipes stay in compatible scene families and do not enable inferred asset slots',()=>{
 for(const spec of sceneData.vignettes){
  const recipe=sceneData.recipes.find(r=>r.id===spec.recipe),group=sceneData.groups.find(g=>g.id===recipe.group);
  for(const member of recipe.members){
   const asset=getAsset(member.asset);assert(asset.groups.some(g=>[group.id,...group.companions].includes(g)),`${spec.id}: ${asset.id} family`);
   assert(asset.interactions.every(s=>!s.enabled||s.provenance!=='bounds-inferred'));
  }
  for(const slot of compileScene(recipe).slots)assert(slot.enabled&&slot.capacity===1);
 }
});
