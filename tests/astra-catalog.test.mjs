import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { inventory,sceneData,semantics,getAsset,assetBox,overlap } from '../src/catalog/library/index.js';
import { validateLibrary } from '../src/catalog/library/validate.js';
import { compileScene,checkScene,compileGroupScene } from '../src/compiler/library-scenes.js';
import { compileAstra,shortestPath } from '../src/compiler/astra.js';
import { resolveAll } from '../src/catalog/resolve-all.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
test('every model and alternate export has a unique, complete metadata record',()=>{
 assert.deepEqual(validateLibrary(inventory,sceneData,semantics),[]);
 const root=process.env.ASTRA_ASSET_ROOT||'/workspace/threejs-assets';
 if(existsSync(root)){
  const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(join(dir,d.name)):[join(dir,d.name).slice(root.length+1)]);
  const fairground=new URL('../public/licensed/fairground',import.meta.url).pathname;
  const extra=existsSync(fairground)?walk(fairground).map(f=>'fairground/'+f.slice(fairground.length-root.length)):[];
  const files=[...walk(root),...extra].filter(f=>/\.(glb|gltf|obj|fbx)$/.test(f)).sort();
  assert.deepEqual([...inventory.assets.map(a=>a.path),...inventory.aliases.map(a=>a.path)].sort(),files);
 }
 assert.equal(inventory.assets.length,634);assert.equal(inventory.assets.filter(a=>a.kind==='individual').length,534);
 assert.equal(inventory.assets.filter(a=>a.pack==='fairground').length,73);assert.equal(getAsset('fairground/ferris_wheel').category,'ride');
 assert.equal(getAsset('farm/stable').category,'building');assert.equal(getAsset('autumn/bushel_basket').category,'storage');
});
test('normalization preserves geometry footprint, including offset origins and rotation',()=>{
 for(const a of inventory.assets){const b=assetBox(a,[10,-4],Math.PI/2);assert(Math.abs(b.max[0]-b.min[0]-a.geometry.size[2])<1e-7);assert(Math.abs(b.max[1]-b.min[1]-a.geometry.size[0])<1e-7);}
});
test('recipes obey measured companion gaps and transform activity slots with the scene',()=>{
 for(const recipe of sceneData.recipes){const a=compileScene(recipe),b=compileScene(recipe,[12,-9],Math.PI/2);assert.deepEqual(checkScene(a),[]);assert.deepEqual(checkScene(b),[]);
  for(let i=0;i<a.slots.length;i++){assert(Math.abs(b.slots[i].position[0]-(12+a.slots[i].position[2]))<1e-7);assert(Math.abs(b.slots[i].position[2]-(-9-a.slots[i].position[0]))<1e-7);}
 }
 const wrongGap=structuredClone(sceneData.recipes[1]);wrongGap.members[1].gap=.1;assert.throws(()=>compileScene(wrongGap),/gap/);
 const tooFar=structuredClone(sceneData.recipes[1]);tooFar.members[2].gap=5;assert.throws(()=>compileScene(tooFar),/gap/);
 const duplicate=compileScene('harvest-stall');duplicate.members[1].box=structuredClone(duplicate.members[0].box);assert(checkScene(duplicate).some(e=>e.includes('clearance')));
 const blocked=compileScene('lantern-tea');blocked.slots[0].approach=[...blocked.members[0].pos.slice(0,1),0,blocked.members[0].pos[1]];assert(checkScene(blocked).some(e=>e.includes('Blocked interaction')));
 assert.throws(()=>compileScene({...sceneData.recipes[0],members:[{key:'reference',asset:inventory.assets.find(a=>a.kind==='pack-scene').id}]}));
});
test('compiled activity approaches are reachable and scenes reserve tree space across seeds',()=>{
 for(const seed of [0,1,42,831,9999]){const town=compileAstra(catalog,seed);assert.equal(town.catalogScenes.length,10);assert.equal(town.interactions.length,14);
  for(const slot of town.interactions)assert(shortestPath(town,0,slot.node).length>0);
  for(const scene of town.catalogScenes)for(const tree of town.trees){const a=catalog.get(tree.id),c=Math.cos(tree.rot),s=Math.sin(tree.rot),points=[];for(const x of [a.bounds.min[0],a.bounds.max[0]])for(const z of [a.bounds.min[2],a.bounds.max[2]])points.push([tree.pos[0]+tree.scale*(x*c+z*s),tree.pos[1]+tree.scale*(-x*s+z*c)]);const b={min:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],max:[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]};assert(!overlap(scene.box,b));}
 }
});
test('schema rejects stale aliases, nonfinite geometry and unreviewed enabled interactions',()=>{
 const broken=structuredClone(inventory);broken.aliases[0].canonical='missing';broken.assets[0].geometry.bounds.min[0]=NaN;const interactive=broken.assets.find(a=>a.interactions.length);interactive.interactions[0].enabled=true;interactive.interactions[0].provenance='bounds-inferred';
 const errors=validateLibrary(broken,sceneData,semantics);assert(errors.some(e=>e.includes('alias')));assert(errors.some(e=>e.includes('bounds')));assert(errors.some(e=>e.includes('unreviewed')));
});

test('group rules select deterministic compatible variants and reject missing special anchors',()=>{
 const a=compileGroupScene('harvest-market',{seed:831,pack:'autumn'});
 assert.deepEqual(compileGroupScene('harvest-market',{seed:831,pack:'autumn'}),a);
 assert(a.members.length>1);assert(a.members.every(m=>getAsset(m.asset).pack==='autumn'));
 assert.notDeepEqual(compileGroupScene('harvest-market',{seed:832,pack:'autumn'}).members,a.members);
 assert.throws(()=>compileGroupScene('weather'),/anchors/);assert.throws(()=>compileGroupScene('cottage-interior'),/floor/);
 assert.throws(()=>compileGroupScene('scene-reference'),/family/);
});
