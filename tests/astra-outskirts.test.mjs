import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileAstra,checkAstra,shortestPath,pointInTown,distanceToSegment} from '../src/compiler/astra.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {extendOutskirts,inLake} from '../src/astra/outskirts-layout.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
test('100 countryside seeds connect to town without crossing lake, lots or canopies',()=>{
 for(let seed=0;seed<100;seed++){
  const town=compileAstra(catalog,seed),existing=structuredClone(town.nodes),o=extendOutskirts(town,catalog);
  assert(checkAstra(town).ok,checkAstra(town).errors.join('; '));assert.deepEqual(town.nodes.slice(0,existing.length),existing,'Existing district node IDs stay stable');
  assert.equal(o.destinations.length,13);assert(o.trees.length>110);assert.equal(town.districts.length,10);
  for(const dest of o.destinations){const route=shortestPath(town,town.buildings[0].node,dest.node);assert.equal(route.at(-1),dest.node);assert.equal(route[0],town.buildings[0].node);}
  for(const r of o.roads)for(let i=0;i<=25;i++){
   const p=[r.a[0]+(r.b[0]-r.a[0])*i/25,r.a[1]+(r.b[1]-r.a[1])*i/25];assert(pointInTown(p,town));
   if(inLake(p,1))assert(Math.abs(p[0]+10)<.01&&p[1]>=49&&p[1]<=55,'Only the fishing jetty enters the lake');
  }
  for(const tree of o.trees){assert(!inLake(tree.pos,3.3));for(const r of o.roads)assert(distanceToSegment(tree.pos,r.a,r.b)>r.width/2+tree.radius+.39);for(const x of [-1,1])for(const z of [-1,1])assert(pointInTown([tree.pos[0]+x*tree.radius,tree.pos[1]+z*tree.radius],town));}
  const dock=o.destinations.find(d=>d.id==='outskirts-dock');assert.deepEqual(town.nodes[dock.node],[-10,55]);
 }
});
test('outskirts are deterministic and applying the extension twice is harmless',()=>{
 const a=compileAstra(catalog,831),b=compileAstra(catalog,831);extendOutskirts(a,catalog);extendOutskirts(b,catalog);assert.deepEqual(a,b);const before=structuredClone(a);extendOutskirts(a,catalog);assert.deepEqual(a,before);
});
test('every countryside crossing is a navigable junction',()=>{
 const town=compileAstra(catalog),o=extendOutskirts(town,catalog);
 for(const a of o.roads)for(const b of o.roads){if(a===b)continue;const u=[a.b[0]-a.a[0],a.b[1]-a.a[1]],v=[b.b[0]-b.a[0],b.b[1]-b.a[1]],den=u[0]*v[1]-u[1]*v[0];if(Math.abs(den)<1e-8)continue;const w=[b.a[0]-a.a[0],b.a[1]-a.a[1]],t=(w[0]*v[1]-w[1]*v[0])/den,s=(w[0]*u[1]-w[1]*u[0])/den;if(t<0||t>1||s<0||s>1)continue;const p=[a.a[0]+t*u[0],a.a[1]+t*u[1]];assert(town.nodes.some(n=>Math.hypot(n[0]-p[0],n[1]-p[1])<.01),'Unsplit crossing at '+p);}
});

test('trail corridors clear the measured cabin, tent, hut and barn footprints',()=>{
 const town=compileAstra(catalog),o=extendOutskirts(town,catalog),bounds=JSON.parse(readFileSync(new URL('../src/astra/outskirts-bounds.json',import.meta.url)));
 const structures=[['log_cabin',-43,60,1.5,0],['log_cabin',-43,78,1.5,0],['ranger_hut',20,45,1.25,0],...[-24,-13,-2].map((x,i)=>['camp_tent',x,101,1.35,i===1?.14:-.08]),['barn',52,83,1,-Math.PI/2]];
 for(const [id,x,z,scale,rotation]of structures){
  const b=id==='barn'?catalog.get('farm-big-red-barn').bounds:bounds[id];
  for(const r of o.roads)for(let i=0;i<=100;i++){
   const dx=r.a[0]+(r.b[0]-r.a[0])*i/100-x,dz=r.a[1]+(r.b[1]-r.a[1])*i/100-z;
   const lx=(dx*Math.cos(rotation)-dz*Math.sin(rotation))/scale,lz=(dx*Math.sin(rotation)+dz*Math.cos(rotation))/scale,pad=r.width/2/scale;
   assert(!(lx>b.min[0]-pad&&lx<b.max[0]+pad&&lz>b.min[2]-pad&&lz<b.max[2]+pad),`Trail enters ${id} at ${x},${z}`);
  }
 }
});
