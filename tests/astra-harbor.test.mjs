import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileAstra, shortestPath, distanceToSegment } from '../src/compiler/astra.js';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { addHarbor } from '../src/astra/harbor-layout.js';
import { createHarborRoutines, harborSwimGraph } from '../src/astra/harbor-routines.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const make=seed=>addHarbor(compileAstra(catalog,seed));

test('100 harbor layouts preserve the old graph and connect every new destination',()=>{
  for(let seed=0;seed<100;seed++){
    const base=compileAstra(catalog,seed),oldNodes=structuredClone(base.nodes),town=addHarbor(base);
    assert(town.report.ok,JSON.stringify(town.report));assert.equal(town.report.districts,10);
    assert.deepEqual(town.nodes.slice(0,oldNodes.length),oldNodes);
    for(const v of town.harbor.venues)for(const b of town.buildings){
      const path=shortestPath(town,b.node,v.node);assert.equal(path.at(-1),v.node);
      assert(path.includes(town.harbor.anchor),'All trips from town use the actual quay landing');
    }
    const snapshot=JSON.stringify(town);assert.equal(JSON.stringify(addHarbor(town)),snapshot,'Extension is idempotent');
  }
});

test('fishers work the pier at dawn and physically deliver catch to market',()=>{
  const town=make(831),r=createHarborRoutines(town),fishers=r.people.filter(p=>p.role==='Fisher');
  for(let i=0;i<100;i++)r.update(.1,6.2);
  for(const p of fishers)assert.equal(p.activity,'Fishing at dawn');
  let carrying=0;
  for(let i=0;i<2200;i++){
    const before=r.people.map(p=>[p.x,p.z]);r.update(.1,10);
    for(const p of r.people){
      assert(Math.hypot(p.x-before[p.index][0],p.z-before[p.index][1])<=p.speed*.1+.0001,'No schedule teleports');
      if(p.role!=='Swimmer')assert(town.roads.some(road=>distanceToSegment([p.x,p.z],road.a,road.b)<.01),'Walkers stay on compiled paths');
    }
    carrying+=fishers.filter(p=>p.carrying&&p.route.length).length;
  }
  assert(carrying>100);
  for(const p of fishers){assert(p.arrivals.includes(town.harbor.nodes.market));assert(p.arrivals.includes(town.harbor.nodes[p.start]));}
});

test('swimming paths are private and swimmers walk back ashore after closing',()=>{
  const town=make(831),oldCount=town.nodes.length,{graph,water}=harborSwimGraph(town);
  assert.equal(town.nodes.length,oldCount);assert(water.every(n=>n>=oldCount));
  for(const n of water)assert(shortestPath(graph,town.harbor.nodes.changing,n).includes(town.harbor.nodes.beach));
  const r=createHarborRoutines(town),swimmers=r.people.filter(p=>p.role==='Swimmer');let wet=0;
  for(let i=0;i<1500;i++){r.update(.1,14);wet+=swimmers.filter(p=>p.y<-.4).length;}
  assert(wet>100,'Swimmers actually reach the cove');
  for(let i=0;i<1800;i++)r.update(.1,20.5);
  for(const p of swimmers){assert.equal(p.node,town.harbor.nodes.changing);assert(p.y>0);assert.equal(p.route.length,0);}
  const frozen=JSON.stringify(r.people);for(let i=0;i<20;i++)r.update(0,20.5);assert.equal(JSON.stringify(r.people),frozen);
});
