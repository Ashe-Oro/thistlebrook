// OWNER: grok-river lane. Contract: docs/specs/GROK-RIVER.md.
// The Willow River is one channel from a mountain spring to the Gulf, through
// Stillwater Lake; it never runs uphill, never floats or sinks against the
// terrain, every path over it has a bridge, and nothing stands in it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {riverZ} from '../src/compiler/astra.js';
import {insideLandscape} from '../src/compiler/landscape.js';
import {inLake} from '../src/astra/outskirts-layout.js';
import {inRiver,boxInRiver,groundAt,mountainSurface,bridgeDeck,waterClearance} from '../src/compiler/water.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const worlds=new Map([[831,compileWorld(catalog,831)],[0,compileWorld(catalog,0)]]);
const town=worlds.get(831),water=town.water,reach=id=>water.reaches.find(r=>r.id===id);
const near=(a,b,d=.01)=>Math.hypot(a[0]-b[0],a[1]-b[1])<d;
const onBridge=(t,p)=>t.water.bridges.some(b=>{const c=Math.cos(b.yaw),s=Math.sin(b.yaw),dx=p[0]-b.pos[0],dz=p[1]-b.pos[1];return Math.abs(dx*s+dz*c)<=b.length/2&&Math.abs(dx*c-dz*s)<=b.width/2+.05;});

test('river is one continuous channel: mountain spring -> town -> Stillwater Lake -> Gulf',()=>{
 assert.deepEqual(water.reaches.map(r=>r.id),['spring-falls','upper','town','west','outflow']);
 for(const r of water.reaches)for(let i=1;i<r.points.length;i++)assert(Math.hypot(r.points[i][0]-r.points[i-1][0],r.points[i][1]-r.points[i-1][1])<1.6,`gap in ${r.id} at ${i}`);
 for(const [a,b] of [['spring-falls','upper'],['upper','town'],['town','west']])assert(near(reach(a).points.at(-1),reach(b).points[0]),`${a} does not join ${b}`);
 // The meadow reach discharges into the lake and the outflow leaves it.
 assert(inLake(reach('west').points.at(-1),-1));assert(!inLake(reach('west').points[0],2));
 assert(inLake(reach('outflow').points[0],-1));assert(!inLake(reach('outflow').points.at(-1),2));
 // Source is high ground on the Mountain Pass peak; the mouth is open sea.
 const lip=water.source.lip;assert(mountainSurface(lip[0],lip[1])>7,'spring rises high on the mountain');
 const mouth=reach('outflow').points.at(-1);assert(!insideLandscape(mouth),'mouth reaches the Gulf');assert(mouth[2]<=-.43);
 // The original town bed is kept: same course, same bridges.
 for(const p of reach('town').points)assert(Math.abs(p[1]-riverZ(p[0]))<1e-3);
 assert.equal(reach('town').points[0][0],65);assert.equal(reach('town').points.at(-1)[0],-80);
 // Mouths widen into deltas at the lake and at the sea.
 assert(reach('west').points.at(-1)[3]>reach('west').points[10][3]*1.5);
 assert(Math.max(...reach('outflow').points.slice(-30).map(p=>p[3]))>2.4*2.4);
});

test('water runs downhill or level everywhere and agrees with the terrain',()=>{
 const levels=water.reaches.flatMap(r=>r.points.map(p=>p[2]));
 for(let i=1;i<levels.length;i++)assert(levels[i]<=levels[i-1]+1e-9,`uphill at sample ${i}: ${levels[i-1]} -> ${levels[i]}`);
 assert(reach('west').points.at(-1)[2]>=water.lake.level&&water.lake.level>=reach('outflow').points[0][2]);
 // Falls: the sheet sits 10 cm proud of the real mountain faces, and the
 // gully is clean: across the sheet the rock varies by under half a metre.
 for(const [i,p] of reach('spring-falls').points.entries()){
  const r=reach('spring-falls').points,a=r[Math.max(0,i-1)],b=r[Math.min(r.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1]),g=s=>mountainSurface(p[0]-(b[1]-a[1])/l*s*p[3],p[1]+(b[0]-a[0])/l*s*p[3])??-.09;
  assert(p[2]>=g(0)+.05-1e-9,'falls sink into the rock');if(p[2]>.075)assert(p[2]<=g(0)+.2,'falls float off the rock');
  for(const s of [-1,1])assert(Math.abs(g(s)-g(0))<.5,`falls twist onto a boulder at ${i}`);
 }
 assert(reach('spring-falls').points[0][2]-reach('spring-falls').points.at(-1)[2]>6,'a real drop from high ground');
 // Reaches: never below the ground they cross, never floating more than 20 cm,
 // except the final run from the beach ledge down onto the Gulf surface.
 for(const id of ['upper','town','west','outflow'])for(const p of reach(id).points){
  if(inLake(p,-.5))continue;const g=groundAt(town,p);
  assert(p[2]>=g+(g<-.4?.005:.03),`${id} water hidden under the ground at ${p[0].toFixed(1)},${p[1].toFixed(1)}`);
  if(g>-.4)assert(p[2]-g<=.2,`${id} water floats ${(p[2]-g).toFixed(2)} at ${p[0].toFixed(1)},${p[1].toFixed(1)}`);
 }
 const run=reach('outflow').points.filter(p=>groundAt(town,p)<-.4);assert(run.length>=4);assert(Math.abs(run.at(-1)[2]+.44)<.01);
 // The estuary is cut into the beach: the channel leaves dry land well inside
 // the old shoreline (z 155.6), and the run to the sea is open water both sides.
 const cut=reach('outflow').points.find(p=>!insideLandscape(p));assert(cut[1]<150,'river passes through the beach, not over it');
 for(const p of run)for(const s of [-1,1])assert(!insideLandscape([p[0]+s*p[3],p[1]]),'the sea run is not laid over land');
});

test('every road or path crossing the river has a bridge; walkers use the deck',()=>{
 for(const [seed,t] of worlds){
  assert.equal(t.water.bridges.filter(b=>b.existing).length,t.bridges.length,'the three town bridges stay');
  assert(t.water.bridges.filter(b=>!b.existing).length>=2,'new reaches get footbridges');
  for(const r of t.roads){
   const line=r.centerline||[r.a,r.b];
   for(let k=1;k<line.length;k++){const a=line[k-1],b=line[k],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*4);
    for(let i=0;i<=n;i++){const p=[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n];if(inRiver(p))assert(onBridge(t,p),`seed ${seed}: ${r.kind} ${r.owner||''} enters the river at ${p.map(v=>v.toFixed(1))} without a bridge`);}}
  }
  for(const b of t.water.bridges){
   const s=Math.sin(b.yaw),c=Math.cos(b.yaw);for(const e of [-1,1])assert(!inRiver([b.pos[0]+s*e*b.length/2,b.pos[1]+c*e*b.length/2]),`bridge ${b.id} ends in the water`);
   assert(bridgeDeck(t,b.pos)>=.5);
   if(!b.existing)assert(t.registry.places.some(p=>p.id==='built:'+b.id),`bridge ${b.id} unregistered`);
  }
 }
});

test('nothing sits in the water: buildings, props, trees, hills, crops, NPC paths, roads',()=>{
 const skip=/^(built:(road-|bridge-|water-bridge-|river|island)|landscape:(mainland|ocean))/;
 for(const [seed,t] of worlds){
  const bad=[];
  // Building boxes are eave-to-eave; walls stand 0.9 m inside them.
  const walls=b=>({min:b.box.min.map(v=>v+.9),max:b.box.max.map(v=>v-.9)});
  for(const b of [...t.buildings,...t.venues])if(b.box&&boxInRiver(walls(b)))bad.push('building/venue '+(b.name||b.key));
  for(const s of t.catalogScenes||[])for(const m of s.members)if(boxInRiver(m.box))bad.push('scene '+m.key);
  // Footprints must stay dry; bank stones only need a dry centre (they sit on
  // the bank edge by design). Buildings are checked by their walls above.
  // Ducks are the one thing meant to be in the river.
  for(const p of t.registry.places){if(!p.pos||skip.test(p.id)||p.type==='area'||p.type==='building'||/duck/.test(p.asset||p.id))continue;const r=p.size?Math.min(p.size[0],p.size[2]??p.size[1])*.5:.3;if(inRiver(p.pos,Math.max(0,Math.min(r,5)*(/bank-rock/.test(p.id)?0:1))))bad.push(`${p.type} ${p.id} @${p.pos.map(v=>v.toFixed(1))}`);}
  // Hills and mountains stand well off the banks, not just out of the water.
  for(const h of t.landscape.hills)for(let i=0;i<16;i++)if(inRiver([h.pos[0]+Math.cos(i*Math.PI/8)*h.radius,h.pos[1]+Math.sin(i*Math.PI/8)*h.radius*.8],5.5))bad.push('hill '+h.registryId);
  for(const f of t.outskirts.fields)if(boxInRiver({min:[f.x-f.w/2,f.z-f.d/2],max:[f.x+f.w/2,f.z+f.d/2]},.5))bad.push('field '+f.crop);
  for(const tree of [...t.trees,...t.outskirts.trees])if(inRiver(tree.pos,.5))bad.push('tree '+tree.pos);
  // NPC navigation: every graph node is dry unless it is on a bridge deck.
  for(const p of t.nodes)if(inRiver(p)&&!onBridge(t,p))bad.push('path node '+p.map(v=>v.toFixed(1)));
  for(const s of t.interactions||[]){const p=[s.approach[0],s.approach[2]];if(inRiver(p,.3))bad.push('activity '+s.id);}
  assert.deepEqual(bad,[],`seed ${seed}`);
 }
});

test('foliage and scenery keep a dry margin; the plan is static across seeds',()=>{
 assert.deepEqual(worlds.get(0).water.reaches,water.reaches);
 for(const p of town.landscape.models)assert(waterClearance(p.pos)>1);
});

test('negative: the checks catch a missing bridge, a road in the river and uphill water',()=>{
 const t={...town,water:{...water,bridges:water.bridges.filter(b=>b.id!=='water-bridge-0')}};
 const wet=t.roads.some(r=>{const a=r.a,b=r.b,n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*4);for(let i=0;i<=n;i++){const p=[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n];if(inRiver(p)&&!onBridge(t,p))return true;}return false;});
 assert(wet,'removing the meadow footbridge must expose a wet path');
 const levels=water.reaches.flatMap(r=>r.points.map(p=>p[2]));levels.splice(300,0,levels[299]+.01);
 assert(levels.some((v,i)=>i&&v>levels[i-1]+1e-9),'an inserted rise must read as uphill');
 assert(boxInRiver({min:[-1,14],max:[1,16]}),'a box in the town bed is wet');assert(!boxInRiver({min:[-1,-5],max:[1,-3]}));
});

test("Highway 4's scenic pull-outs stay dry (landscape.js bay formula)",()=>{
 for(const r of town.roads.filter(r=>r.centerline)){
  const c=new THREE.CatmullRomCurve3(r.centerline.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');if(c.getLength()<=48)continue;
  const p=c.getPointAt(.35),tg=c.getTangentAt(.35),x=p.x+tg.z*7,z=p.z-tg.x*7,yaw=Math.atan2(tg.x,tg.z);
  for(const u of [-1,0,1])for(const v of [-1,0,1])assert(!inRiver([x+Math.sin(yaw)*u*5+Math.cos(yaw)*v*3,z+Math.cos(yaw)*u*5-Math.sin(yaw)*v*3],.3),`scenic bay of road ${r.regionalId} is wet`);
 }
});
