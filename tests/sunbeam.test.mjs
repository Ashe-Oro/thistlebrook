import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileAstra, shortestPath, pointInTown, distanceToSegment} from '../src/compiler/astra.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {SUNBEAM_RESIDENTS} from '../src/astra/sunbeam-layout.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
test('Sunbeam sits west of Civic Green, with doors connected to school, downtown and Willowbank',()=>{
  for(const seed of [0,42,831,9999]){
    const town=compileAstra(catalog,seed),homes=town.buildings.filter(b=>b.district==='sunbeam');
    assert.equal(homes.length,9);assert.equal(homes.filter(b=>b.shop).length,2);
    assert(pointInTown([-135,-60],town));assert(!pointInTown([-135,-80],town));
    for(const b of homes){
      for(const corner of [b.box.min,b.box.max])assert(pointInTown(corner,town));
      for(const destination of [town.venues.find(v=>v.type==='school'),town.buildings.find(b=>b.name==='The Reading Room'),town.buildings.find(b=>b.district==='willowbank')]){
        const path=shortestPath(town,b.node,destination.node);assert(path.length>2);assert.equal(path.at(-1),destination.node);
      }
    }
    // The east and south exits remain genuine through routes, not cul-de-sacs.
    for(const p of [[-105,-52],[-126,-33]])assert(town.nodes.some(n=>Math.hypot(n[0]-p[0],n[1]-p[1])<.02));
    // Seeded trees must not grow inside the authored courtyard or on its exits.
    for(const tree of town.trees){const [x,z]=tree.pos;assert(!(x>-144&&x<-108&&z>-69&&z<-34));for(const r of town.roads.filter(r=>r.a[1]<=-33&&r.a[0]<-39))assert(distanceToSegment(tree.pos,r.a,r.b)>r.width/2);}
  }
});
test('each additional neighbour has a real home, a unique name and an owned character role',()=>{
  const town=compileAstra(catalog);assert.equal(new Set(SUNBEAM_RESIDENTS.map(p=>p.name)).size,8);
  for(const p of SUNBEAM_RESIDENTS){assert(town.buildings.find(b=>b.key==='sunbeam-'+p.home));assert(catalog.has('townsfolk-'+p.model));}
});
