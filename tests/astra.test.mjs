import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileAstra, checkAstra, shortestPath, riverZ, pointInTown } from '../src/compiler/astra.js';
import { resolveAll } from '../src/catalog/resolve-all.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
test('100 seeded maps have clear parcels and one connected street network',()=>{
 for(let seed=0;seed<100;seed++){
  const town=compileAstra(catalog,seed);assert(town.report.ok);assert.equal(town.districts.length,9);assert.equal(town.venues.length,17);assert.equal(town.buildings.length,35);
  for(const v of town.venues)for(const p of [v.box.min,v.box.max])assert(pointInTown(p,town),v.name+' stays on land');
  for(const r of town.roads)for(let k=0;k<=4;k++)assert(pointInTown([r.a[0]+(r.b[0]-r.a[0])*k/4,r.a[1]+(r.b[1]-r.a[1])*k/4],town),'Road stays on land');
  assert(town.trees.length>=15,'Tree reservations leave a leafy border');
  for(const b of town.buildings){assert(pointInTown(b.pos,town));assert(b.box.min[0]>town.bounds.minX&&b.box.max[0]<town.bounds.maxX);assert(b.box.min[1]>town.bounds.minZ&&b.box.max[1]<town.bounds.maxZ);}
  const destinations=[...town.buildings,...town.venues];
  for(let a=0;a<destinations.length;a++)for(let b=0;b<destinations.length;b++){
   const from=destinations[a].node,to=destinations[b].node,path=shortestPath(town,from,to);assert.equal(path[0],from);assert.equal(path.at(-1),to);
   for(let n=1;n<path.length;n++)assert(town.edges[path[n-1]].includes(path[n]));
  }
  // Every pedestrian segment that enters the river stays on a bridge.
  for(const road of town.roads)for(let n=0;n<=20;n++){const t=n/20,x=road.a[0]+t*(road.b[0]-road.a[0]),z=road.a[1]+t*(road.b[1]-road.a[1]);if(Math.abs(z-riverZ(x))<2.65)assert(town.bridges.some(b=>Math.abs(b-x)<1.6),`Water crossing outside bridge, seed ${seed}`);}
 }
});
test('seed is repeatable without mutating the catalog',()=>{const before=JSON.stringify([...catalog]);const a=compileAstra(catalog,831);compileAstra(catalog,72);assert.deepEqual(compileAstra(catalog,831),a);assert.equal(JSON.stringify([...catalog]),before);assert.notDeepEqual(compileAstra(catalog,832).trees,a.trees);});
test('checker rejects disconnected routes, parcel collisions and streets through homes',()=>{
 const disconnected=compileAstra(catalog);disconnected.nodes.push([100,100]);disconnected.edges.push([]);assert(checkAstra(disconnected).errors.includes('Disconnected pedestrian graph'));
 const overlap=compileAstra(catalog);overlap.buildings[1].box=structuredClone(overlap.buildings[0].box);assert(checkAstra(overlap).errors.includes('Overlapping parcels'));
 const street=compileAstra(catalog),b=street.buildings[0];street.roads.push({a:[b.pos[0]-5,b.pos[1]],b:[b.pos[0]+5,b.pos[1]],width:3,kind:'lane'});assert(checkAstra(street).errors.some(e=>e.startsWith('Street crosses')));
});
test('missing licensed catalog entries fail clearly',()=>{const c=new Map(catalog);c.delete('cv-windmill');assert.throws(()=>compileAstra(c),/Missing catalog entry: cv-windmill/);});

test('the campus and downtown are meaningful, separate accessible districts',()=>{
 const town=compileAstra(catalog),campus=town.venues.filter(v=>['school','football','baseball','basketball','tennis'].includes(v.type));assert.equal(campus.length,5);
 const shops=town.buildings.filter(b=>b.district==='downtown');assert(shops.some(b=>b.name==='Sole & Stitch'));assert(shops.some(b=>b.name==='Sunrise Bakehouse'));assert.equal(town.venues.find(v=>v.type==='fountain').district,'downtown');
 const corrupted=structuredClone(town);corrupted.venues[4].box=structuredClone(corrupted.venues[0].box);assert(checkAstra(corrupted).errors.some(e=>e.startsWith('Overlapping venues:')));
 const field=structuredClone(town);field.roads.push({a:[10,-84],b:[50,-84],width:3,kind:'lane'});assert(checkAstra(field).errors.some(e=>e==='Street crosses venue: Owls Memorial Stadium'));
 assert(pointInTown([-70,-80],town),'Civic Green fills the former northwest corner');
});
