import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { mediumFailures } from '../src/compiler/medium.js';
import { compileTown } from '../src/compiler/compile.js';
import { nearestNode, route, distance } from '../src/life/graph.js';
import { registryFailures, nearestEntryNode } from '../src/world/registry.js';
const read = p => JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const catalog = resolveAll(read('src/catalog/bounds.json'));
const spec = read('specs/medium.json');
const baseline = compileTown(read('specs/large.json'),catalog,{seed:1234});
for (const seed of [1,7,1234]) {
  const town = compileTown(spec,catalog,{seed,life:true});
  assert(town.ok,JSON.stringify(town.report.checks.filter(c=>!c.ok)));
  assert(town.report.stats.houses > baseline.report.stats.houses);
  const graph=town.life.graph;
  assert.deepEqual(registryFailures(town.registry,graph,town,catalog),[]);
  for (const id of ['cv-chapel','farm-farmhouse','farm-big-red-barn']) {
    const places=town.registry.places.filter(p=>p.catalogId===id);
    assert(places.length,id);
    assert(places.every(p=>nearestEntryNode(town.registry,graph,p.id)>=0),id+' entry');
  }
  assert(town.instances.some(i=>/crop-row-field|tilled-field|garden-plot|pumpkin-patch/.test(i.id)));
  assert(town.instances.filter(i=>i.id==='cv-water-stream').length>=20);
  const bridge=town.instances.find(i=>i.id==='cv-road-stone-footbridge'&&i.district==='riverside');
  assert(bridge);
  const a=nearestNode(graph,[58,44]),b=nearestNode(graph,[58,52]);
  assert(distance(graph.nodes[a].pos,[58,44])<.7);
  assert(distance(graph.nodes[b].pos,[58,52])<.7);
  const crossing=route(graph,a,b);
  assert.equal(crossing.at(-1),b);
  assert(crossing.some(n=>distance(graph.nodes[n].pos,bridge.pos)<.7),'bridge carries walk graph');
  // Registry-only and life-off stay available; medium must not mutate inputs.
  if(seed===1234){
    const broken=structuredClone(town);
    broken.instances.find(i=>i.id==='cv-road-stone-footbridge'&&i.district==='riverside').pos[1]+=12;
    assert(mediumFailures(broken,catalog).length,'bridge off water rejected');
    const dry=structuredClone(town);
    dry.instances.find(i=>i.id==='cv-water-stream').rotY=0;
    assert(mediumFailures(dry,catalog).length,'disconnected stream orientation rejected');
    const severed=structuredClone(town);
    severed.instances=severed.instances.filter(i=>i.streetId!=='riverside-walk');
    assert(mediumFailures(severed,catalog).length,'missing crossing path rejected');
    assert.equal(compileTown(spec,catalog).seed,1234);
    assert(!compileTown(spec,catalog).registry);
    assert(compileTown(spec,catalog,{registry:true}).ok);
  }
  console.log(`medium ${seed}: ${town.report.stats.houses} homes, chapel/farm entries and connected bridge OK`);
}
// Same module graph as the browser, through Vite's transform pipeline.
const { createServer } = await import('vite');
const { createServer: httpServer } = await import('node:http');
const hmr=httpServer();
const vite=await createServer({server:{middlewareMode:true,hmr:{server:hmr},watch:null},appType:'custom'});
try {
  const browser=await vite.ssrLoadModule('/src/compiler/compile.js');
  const browserCatalog=await vite.ssrLoadModule('/src/catalog/resolve-all.js');
  const resolved=browserCatalog.resolveAll(read('src/catalog/bounds.json'));
  for(const flags of [{},{life:true}]) assert.equal(JSON.stringify(browser.compileTown(spec,resolved,{seed:1234,...flags})),JSON.stringify(compileTown(spec,catalog,{seed:1234,...flags})),'medium browser/Node parity');
  console.log('medium browser/Node full JSON parity OK (default + life)');
} finally { await vite.close(); }
