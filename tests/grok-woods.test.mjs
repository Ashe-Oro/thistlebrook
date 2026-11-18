// OWNER: grok-woods lane. Contract: docs/specs/GROK-WOODS.md.
// Pinewood: Ashe's empty meadow west of town is now woods on a foothill
// ridge, with dirt trails that hug the terrain and hikers by day only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {distanceToSegment,pointInTown} from '../src/compiler/astra.js';
import {insideLandscape} from '../src/compiler/landscape.js';
import {waterClearance,inRiver,bridgeDeck} from '../src/compiler/water.js';
import {ridgeHeight,ridgeMeshY,terrainY,distanceToPolyline,TRAIL,GROUND_TOP,POND} from '../src/compiler/woods.js';
import {hikerRoster,hikerPose,HIKE_HOURS} from '../src/astra/woods-hikers.js';
import {buildPedestrianGraph} from '../src/roads/pedestrian.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const worlds=new Map([[831,compileWorld(catalog,831)],[0,compileWorld(catalog,0)]]);
const town=worlds.get(831),woods=town.woods;
// Ashe's frame (/workspace/refs/roads/ashe-emptyfield.png): the empty field
// between the Pine ridge peaks, the river's west loop and downtown.
const ASHE={minX:-160,maxX:-90,minZ:-20,maxZ:75};
const inAshe=([x,z])=>x>ASHE.minX&&x<ASHE.maxX&&z>ASHE.minZ&&z<ASHE.maxZ;
const trailDist=p=>Math.min(...woods.trails.map(t=>distanceToPolyline(p,t.points)));
const carriageways=t=>t.roads.flatMap(r=>{const line=r.centerline||[r.a,r.b],half=r.centerline?2.9:(r.width||2)/2;return line.slice(1).map((b,i)=>({a:line[i],b,half,kind:r.kind}));});

test('the meadow in Ashe\'s frame is wooded: >= 3.5 trees per 100 m2 of plantable ground',()=>{
 for(const [seed,t] of worlds){
  const trees=t.landscape.models.filter(m=>m.asset.includes('tree')&&inAshe(m.pos));
  // Plantable = not trail corridor, glade, river, town or the existing peaks.
  let open=0;for(let x=ASHE.minX;x<ASHE.maxX;x+=2)for(let z=ASHE.minZ;z<ASHE.maxZ;z+=2){const p=[x+1,z+1];if(pointInTown(p,t)||waterClearance(p)<3||!insideLandscape(p)||trailDist(p)<3.1||t.woods.glades.some(g=>Math.hypot(g.center[0]-p[0],g.center[1]-p[1])<g.r)||t.landscape.hills.some(h=>Math.hypot(h.pos[0]-p[0],h.pos[1]-p[1])<h.radius+1))continue;open+=4;}
  const density=trees.length/open*100;
  assert(density>=3.5,`seed ${seed}: ${trees.length} trees over ${open} m2 = ${density.toFixed(2)} per 100 m2`);
  assert(t.woods.counts.trees>=500,`seed ${seed}: only ${t.woods.counts.trees} woods trees`);
  const pines=trees.filter(m=>m.asset==='cv-tree-pine').length;assert(pines>trees.length*.3&&pines<trees.length*.85,'mixed forest: pines and broadleaf');
  for(const g of t.woods.glades)assert(!trees.some(m=>Math.hypot(m.pos[0]-g.center[0],m.pos[1]-g.center[1])<g.r-1),`glade ${g.id} stays open`);
 }
});

test('woods stay out of water, roads, town, buildings, trails and the pond',()=>{
 for(const [seed,t] of worlds){
  const roads=carriageways(t),boxes=[...t.buildings.map(b=>b.box),...t.venues.filter(v=>v.box).map(v=>v.box)];
  for(const m of t.landscape.models.filter(m=>m.woods)){
   const p=m.pos,tag=`seed ${seed}: ${m.asset} at ${p.map(v=>v.toFixed(1))}`;
   assert(waterClearance(p)>1.5,tag+' in the river');
   assert(!pointInTown(p,t)&&insideLandscape(p),tag+' off the mainland or in town');
   assert(!roads.some(r=>distanceToSegment(p,r.a,r.b)<r.half+1),tag+' on a road or path');
   assert(!boxes.some(b=>p[0]>b.min[0]-1&&p[0]<b.max[0]+1&&p[1]>b.min[1]-1&&p[1]<b.max[1]+1),tag+' in a building or venue');
   if(m.woods==='tree')assert(trailDist(p)>=3,tag+' crowds a trail');
   if(!m.feature)assert(((p[0]-POND.center[0])/(POND.rx+1))**2+((p[1]-POND.center[1])/(POND.rz+1))**2>1,tag+' in the pond');
   // Seated on the ground: never floating, never sunk more than a trunk base.
   const ground=terrainY(...p)-GROUND_TOP;assert((m.y||0)<=ground+.01&&(m.y||0)>=ground-.2,tag+` y ${m.y} vs ground ${ground.toFixed(2)}`);
  }
 }
});

test('the ridge is flat (zero) on every road, the river, the coast and other districts',()=>{
 for(const r of carriageways(town)){const n=Math.ceil(Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1]));for(let i=0;i<=n;i++){const p=[r.a[0]+(r.b[0]-r.a[0])*i/n,r.a[1]+(r.b[1]-r.a[1])*i/n];assert.equal(ridgeHeight(...p),0,`${r.kind} at ${p.map(v=>v.toFixed(1))} climbs the ridge`);}}
 for(const reach of town.water.reaches)for(const p of reach.points)assert.equal(ridgeHeight(p[0],p[1]),0,'river on the ridge');
 for(const r of town.regions)for(let x=r.bounds.minX;x<=r.bounds.maxX;x+=2)for(const z of [r.bounds.minZ,r.bounds.maxZ])assert.equal(ridgeHeight(x,z),0,`ridge in ${r.id}`);
 for(let x=-200;x<-100;x+=1)for(let z=-30;z<120;z+=1)if(!insideLandscape([x,z]))assert.equal(ridgeHeight(x,z),0,'ridge in the sea');
 const top=Math.max(...woods.trails.flatMap(t=>t.points.map(p=>p[1])));assert(top>12,'the lookout is up a real climb ('+top.toFixed(1)+' m)');
});

test('trails follow the terrain: never buried, never floating, and only cross water on a bridge',()=>{
 let samples=0;
 for(const tr of woods.trails)for(const p of tr.points){
  if(p.onBridge){assert(bridgeDeck(town,[p[0],p[2]])>=.5,'trail bridge deck');continue;}
  const mesh=Math.max(GROUND_TOP,ridgeMeshY(p[0],p[2])),gap=p[1]-mesh;samples++;
  assert(gap>.02&&gap<.12,`${tr.id} at ${p[0].toFixed(1)},${p[2].toFixed(1)}: ${gap.toFixed(3)} m above the visible ground`);
  assert(!inRiver([p[0],p[2]]),`${tr.id} wades the river at ${p[0].toFixed(1)},${p[2].toFixed(1)}`);
 }
 assert(samples>350,'trails are sampled densely');
 // Ribbon edges are draped too (same rule at the tread's edge).
 for(const tr of woods.trails)for(let i=1;i<tr.points.length;i+=7){const a=tr.points[i-1],b=tr.points[i];if(a.onBridge||b.onBridge)continue;const dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;for(const s of [-1,1]){const x=b[0]-dz/l*s*TRAIL.width/2,z=b[2]+dx/l*s*TRAIL.width/2;assert(terrainY(x,z)+TRAIL.lift-Math.max(GROUND_TOP,ridgeMeshY(x,z))>.02,'edge buried');}}
 assert(woods.bridges.length>=1&&town.registry.places.some(p=>p.id==='built:'+woods.bridges[0]),'the river trail has a registered footbridge');
 const total=woods.trails.reduce((s,t)=>s+t.length,0);assert(total>300,'trail network length '+total);
 // Switchback legs stay walkable: 90% of 0.8 m steps under 35% grade.
 for(const id of ['switchbacks','ridge','descent']){const t=woods.trails.find(t=>t.id===id),g=[];for(let i=1;i<t.points.length;i++){const a=t.points[i-1],b=t.points[i];g.push(Math.abs(b[1]-a[1])/Math.hypot(b[0]-a[0],b[2]-a[2]));}g.sort((x,y)=>x-y);assert(g[Math.floor(g.length*.9)]<.35,`${id} p90 grade ${g[Math.floor(g.length*.9)].toFixed(2)}`);}
});

test('trails meet roads only at their trailheads, never on a carriageway',()=>{
 const roads=carriageways(town).filter(r=>!['trail','walk','catalog','catalog-slot','door','visitor-walk','boardwalk'].includes(r.kind));
 for(const tr of woods.trails)for(const p of tr.points)for(const r of roads)assert(distanceToSegment([p[0],p[2]],r.a,r.b)>r.half+.3,`${tr.id} touches a ${r.kind} at ${p[0].toFixed(1)},${p[2].toFixed(1)}`);
});

test('hikers: on the trails by day (more at weekends), none at night, off the trails by dusk',()=>{
 const graph=buildPedestrianGraph(town),surf=graph.index;
 for(const weekday of [0,2,4,5,6]){
  const roster=hikerRoster(woods,weekday),weekend=weekday>=5,last=weekend?HIKE_HOURS.weekendLastOffTrail:HIKE_HOURS.lastOffTrail;
  const at=h=>roster.map(x=>hikerPose(x,woods,h,0)).filter(Boolean);
  const midday=Math.max(...[11,12,13,14].map(h=>at(h).length));
  assert(midday>=(weekend?10:5),`weekday ${weekday}: only ${midday} hikers at midday`);
  for(const h of [0,3,6,7.9,last,last+.01,19,21,23.5])assert.equal(at(h).length,0,`weekday ${weekday}: hikers out at ${h}`);
  for(let h=8;h<last;h+=.05)for(const p of at(h)){
   const tag=`weekday ${weekday} ${h.toFixed(2)} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`;
   if(p.walking)assert(trailDist([p.x,p.z])<TRAIL.width/2+.1,tag+' walking off the trail');
   else assert(trailDist([p.x,p.z])<3.2,tag+' resting far from the trail');
   const deck=bridgeDeck(town,[p.x,p.z]),ground=terrainY(p.x,p.z)+TRAIL.lift;
   assert(Math.abs(p.y-ground)<.1||deck&&Math.abs(p.y-deck)<.1,tag+` y ${p.y.toFixed(2)} vs ground ${ground.toFixed(2)}`);
   assert(surf.depth([p.x,p.z])<=.05,tag+' on a carriageway');
   assert(!inRiver([p.x,p.z])||deck,tag+' in the river');
   assert(((p.x-POND.center[0])/POND.rx)**2+((p.z-POND.center[1])/POND.rz)**2>1,tag+' in the pond');
  }
 }
 assert(hikerRoster(woods,5).length>hikerRoster(woods,2).length,'more hikers at weekends');
});
