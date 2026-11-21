import {planRegionalRoads,planLandscape,registerLandscape,MAINLAND,insideLandscape} from './landscape.js';
import {addDistrictFurniture} from '../astra/registry/district-furniture.js';
import {addDistrictActivities} from '../astra/registry/district-activities.js';
import landmarks from '../astra/registry/district-landmarks.json' with {type:'json'};
import {addExpansionModels,expansionModels,addDistrictLandmarks} from '../astra/registry/expansion-placements.js';
import {compileExpansionScenes} from './expansion-scenes.js';
import {compileAssetVignettes} from './asset-vignettes.js';
import {includeLifePlacements} from '../astra/registry/life-placements.js';
import {STARBASE_VIEWS,STARBASE_ORIGIN} from '../astra/starbase-flight.js';
import {addCoastLayout,COAST_VIEWS} from '../astra/coast-plan.js';
import * as THREE from 'three';
import {PARK_ORIGIN,PARK_NODES,PARK_EDGES,APPROACH,THEMEPARK_VIEWS,THEMEPARK_BOUNDS,PARK_VENUES} from '../astra/themepark-plan.js';
import {addParkActivities} from '../astra/registry/park-activities.js';
import {buildRegistry,registryErrors} from '../astra/registry/index.js';
import {SKATEPARK,SKATEPARK_VIEW} from '../astra/skatepark-layout.js';
import {extendOutskirts,OUTSKIRTS_VIEWS} from '../astra/outskirts-layout.js';
import {compileAstra,distanceToSegment} from './astra.js';
import {REGIONAL} from '../roads/regional.js';
import {unifyStraightRuns} from '../roads/town-roads.js';
import {planWater} from './water.js';
import {planWoods,registerWoods} from './woods.js';
import {planNatureEdges} from './nature-edges.js';
import {addRailway,railwayAccessReservations} from './railway.js';
import {addFairground,FAIR_VIEW} from './astra-fair.js';
import {addHarbor,HARBOR_VIEWS} from '../astra/harbor-layout.js';
import {planRegionalLines} from '../roads/regional.js';
import {addMapleHollow,flagMapleHollowRoads,finishMapleHollow,addMapleHollowPlaces,MAPLE_HOLLOW_VIEW} from '../astra/maple-hollow-plan.js';
export const WORLD_OFFSETS={harbor:[100,0],fair:[-140,0],airport:[0,-140],skatepark:[35,-58],'coral-coast':[160,150],roadster:[-140,-110],starbase:[80,230]};
export const move=(p,o)=>[p[0]+o[0],p[1]+o[1]];
export const moveBox=(b,o)=>({min:move(b.min,o),max:move(b.max,o)});
export function moveRecord(p,o){const q={...p};for(const k of ['pos','center','entry','access','door','approach','join'])if(Array.isArray(p[k]))q[k]=move(p[k],o);if(p.box)q.box=moveBox(p.box,o);return q;}
export function rebuildWorldGraph(town){
 const step=.015, nodeCells=new Map();
 const cell=value=>Math.floor(value/step);
 const addNode=(p,i)=>{
  const key=cell(p[0])+','+cell(p[1]);
  let indices=nodeCells.get(key);
  if(!indices)nodeCells.set(key,indices=[]);
  indices.push(i);
 };
 town.nodes.forEach(addNode);
 const node=p=>{
  let first=Infinity;
  for(let x=cell(p[0]-step);x<=cell(p[0]+step);x++)for(let z=cell(p[1]-step);z<=cell(p[1]+step);z++){
   for(const i of nodeCells.get(x+','+z)||[]){
    const v=town.nodes[i];
    if(i<first&&Math.hypot(v[0]-p[0],v[1]-p[1])<step)first=i;
   }
  }
  if(first!==Infinity)return first;
  const i=town.nodes.length,point=p.map(v=>+v.toFixed(5));
  town.nodes.push(point);addNode(point,i);
  return i;
 };
 const roads=town.roads.flatMap(r=>r.walkline?r.walkline.slice(1).map((b,i)=>({...r,a:r.walkline[i],b})):r);
 const split=roads.map(r=>[r.a,r.b]);
 const roadBounds=roads.map(({a,b})=>[
  Math.min(a[0],b[0])-.01,Math.max(a[0],b[0])+.01,
  Math.min(a[1],b[1])-.01,Math.max(a[1],b[1])+.01,
 ]);
 const contains=([minX,maxX,minZ,maxZ],[x,z])=>x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ;
 for(let i=0;i<roads.length;i++)for(let j=i+1;j<roads.length;j++){
  const A=roadBounds[i],B=roadBounds[j];
  if(A[0]>B[1]||B[0]>A[1]||A[2]>B[3]||B[2]>A[3])continue;
  const a=roads[i],b=roads[j],u=[a.b[0]-a.a[0],a.b[1]-a.a[1]],v=[b.b[0]-b.a[0],b.b[1]-b.a[1]],den=u[0]*v[1]-u[1]*v[0];
  if(Math.abs(den)>1e-8){const w=[b.a[0]-a.a[0],b.a[1]-a.a[1]],t=(w[0]*v[1]-w[1]*v[0])/den,s=(w[0]*u[1]-w[1]*u[0])/den;if(t>=0&&t<=1&&s>=0&&s<=1){const p=[a.a[0]+t*u[0],a.a[1]+t*u[1]];split[i].push(p);split[j].push(p);}}
  for(const p of [a.a,a.b])if(distanceToSegment(p,b.a,b.b)<.01)split[j].push(p);
  for(const p of [b.a,b.b])if(distanceToSegment(p,a.a,a.b)<.01)split[i].push(p);
 }
 for(let i=0;i<roads.length;i++)for(const p of town.nodes)if(contains(roadBounds[i],p)&&distanceToSegment(p,roads[i].a,roads[i].b)<.01)split[i].push(p);
 const links=[];split.forEach((points,i)=>{points.sort((a,b)=>Math.hypot(a[0]-roads[i].a[0],a[1]-roads[i].a[1])-Math.hypot(b[0]-roads[i].a[0],b[1]-roads[i].a[1]));const ids=[...new Set(points.map(node))];for(let n=1;n<ids.length;n++)links.push([ids[n-1],ids[n]]);});
 town.edges=town.nodes.map(()=>[]);for(const [a,b]of links){if(!town.edges[a].includes(b))town.edges[a].push(b);if(!town.edges[b].includes(a))town.edges[b].push(a);}
 return node;
}
// Links are authored at the full verge width so everything placed before the
// regional planner (rest stops, props) clears the final road and its verge.
export function connectWorld(town,points,width=REGIONAL.verge){
 const routeGroup=town.regionalRouteCount||0;town.regionalRouteCount=routeGroup+1;
 for(let i=1;i<points.length;i++)town.roads.push({a:points[i-1],b:points[i],width,kind:'world-link',owner:'world-link',routeGroup});
}
// A short pedestrian link from a regional road to an extension's own path.
// Regional asphalt ends at the junction; walkers continue on a footpath.
export function connectFootpath(town,points,width=1.6){
 for(let i=1;i<points.length;i++)town.roads.push({a:points[i-1],b:points[i],width,kind:'walk',owner:'world-path'});
}
export function adoptExtension(town,id,layout,{offset=[0,0],bounds,links=[],paths=[],lanes=[],planKey=id,ground=false}={}){
 const draft=structuredClone(town),counts={roads:town.roads.length,venues:town.venues.length,districts:town.districts.length,nodes:town.nodes.length};layout(draft);
 town.nodes.push(...draft.nodes.slice(counts.nodes).map(p=>move(p,offset)));
 town.roads.push(...draft.roads.slice(counts.roads).map(r=>({...r,a:move(r.a,offset),b:move(r.b,offset),external:id})));
 town.venues.push(...draft.venues.slice(counts.venues).map(p=>moveRecord(p,offset)));
 town.districts.push(...draft.districts.slice(counts.districts).map(p=>moveRecord(p,offset)));
 town.expansionLocal[id]=structuredClone(draft[planKey]||{});town[planKey]=structuredClone(draft[planKey]||{});
 const region={id,offset,bounds:{minX:bounds[0]+offset[0],minZ:bounds[1]+offset[1],maxX:bounds[2]+offset[0],maxZ:bounds[3]+offset[1]},ground};town.regions.push(region);
 for(const [a,b] of lanes)town.roads.push({a,b,width:3.2,kind:'lane'});
 for(const points of links)connectWorld(town,points);
 for(const points of paths)connectFootpath(town,points);
 for(const p of town.venues.slice(counts.venues))if(p.access)town.roads.push({a:p.entry,b:p.access,width:1.4,kind:'walk',owner:'venue:'+p.id,external:id});
 const node=rebuildWorldGraph(town);
 for(const p of town.venues.slice(counts.venues))p.node=node(p.entry);
 if(town[planKey].nodes)for(const [key,index]of Object.entries(town[planKey].nodes)){const n=node(move(draft.nodes[index],offset));town[planKey].nodes[key]=n;town.expansionLocal[id].nodes[key]=n;}
 return region;
}
export const WORLD_VIEWS={railway:{x:-105,z:-216,zoom:.94,rotation:1},...Object.fromEntries(Object.entries(STARBASE_VIEWS).map(([id,v])=>[id,{...v,x:v.x+80,z:v.z+230}])),roadster:{x:-205,z:-172,zoom:2.65},...Object.fromEntries(Object.entries(COAST_VIEWS).map(([id,v])=>[id,{...v,x:v.x+160,z:v.z+150} ])),...THEMEPARK_VIEWS,skatepark:{...SKATEPARK_VIEW,x:87,z:-109},airport:{x:104,z:-188,zoom:1.55},...OUTSKIRTS_VIEWS,fair:{...FAIR_VIEW,x:FAIR_VIEW.x-140},...Object.fromEntries(Object.entries(HARBOR_VIEWS).map(([id,v])=>[id==='beach'?'shell-cove':id,{...v,x:v.x+100}])),'maple-hollow':{...MAPLE_HOLLOW_VIEW}};
export function compileWorld(catalog,seed=831,{capture=false}={}){
 const town=compileAstra(catalog,seed);unifyStraightRuns(town);town.regions=[];town.expansionLocal={};
 // The harbor approach squeezes between the bandstand and the farm fence, so it
 // stays a town lane there; the regional road starts once it has room.
 adoptExtension(town,'harbor',addHarbor,{offset:WORLD_OFFSETS.harbor,bounds:[16,27,111,91],links:[[[66,34],[100,34],[112,30],[146,30]]],lanes:[[[46,30],[46,34]],[[46,34],[66,34]]]});
 adoptExtension(town,'fair',addFairground,{offset:WORLD_OFFSETS.fair,bounds:[-79,-103,-41,-25],ground:true,links:[[[-144,-52],[-174,-52],[-174,-33]],[[-174,-52],[-174,-69]]],paths:[[[-174,-69],[-176,-69]]]});
 extendOutskirts(town,catalog);town.expansionLocal.outskirts=town.outskirts;
 town.venues.push(...town.outskirts.destinations.map(v=>({...v,box:{min:[v.pos[0]-2,v.pos[1]-2],max:[v.pos[0]+2,v.pos[1]+2]}})));rebuildWorldGraph(town);
 town.regions.push({id:'airport',offset:[0,-140],bounds:{minX:65,maxX:146,minZ:-253,maxZ:-126}});
 town.districts.push({id:'airport',name:'Thistlebrook Municipal Airport',type:'transport',center:[104,-188]});
 connectWorld(town,[[64,-69],[64,-184],[77,-184]]);connectFootpath(town,[[60,-69],[64,-69]]);
 const airportNode=rebuildWorldGraph(town)([77,-184]);town.venues.push({id:'airport-terminal',district:'airport',name:'Thistlebrook Municipal Airport',type:'airport',pos:[77,-202],entry:[77,-184],node:airportNode,box:{min:[69,-214],max:[86,-189]},height:5,story:'Airliners, club planes and a helicopter share a busy municipal airfield. Follow the public approach to the terminal; boarding and service traffic stay on the apron.'});
 adoptExtension(town,'skatepark',draft=>{draft.venues.push({...structuredClone(SKATEPARK),district:'skatepark',story:'Helmeted skaters take turns in the bowl while BMX riders circle the pump track. The entrance path leads to spectator benches, a water tap and the bike rack.'});draft.districts.push({id:'skatepark',name:'Switchyard Skate & Bike Park',type:'recreation',center:[52,-51]});},{offset:WORLD_OFFSETS.skatepark,bounds:[40.5,-67,63.5,-25.5],ground:true,links:[[[64,-91],[81,-91]]]});
 town.regions.push({id:'themepark',offset:[0,0],bounds:THEMEPARK_BOUNDS});town.districts.push({id:'themepark',name:'Pinecrest Adventure Park',type:'recreation',center:PARK_ORIGIN});
 const approach=new THREE.CatmullRomCurve3(APPROACH.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(100).map(p=>[p.x,p.z]);
 const parkRoad=(a,b)=>town.roads.push({a,b,width:2,kind:'park',owner:'themepark',external:'themepark'});
 for(let i=1;i<approach.length;i++)parkRoad(approach[i-1],approach[i]);
 const pp=key=>move(PARK_NODES[key],PARK_ORIGIN);parkRoad(approach.at(-1),pp('gate'));for(const [a,b]of PARK_EDGES)parkRoad(pp(a),pp(b));
 const pn=rebuildWorldGraph(town);for(const [id,name,key]of PARK_VENUES){const p=pp(key);town.venues.push({id,name,type:'themepark',district:'themepark',pos:p,entry:p,node:pn(p),box:{min:p.map(v=>v-1),max:p.map(v=>v+1)},height:3,story:'Follow the midway from the entrance, with signed paths to the rides and shaded picnic gardens.'});}
 adoptExtension(town,'coral-coast',addCoastLayout,{offset:WORLD_OFFSETS['coral-coast'],bounds:[62,-114,194,52],links:[[[146,30],[152,30],[164,26],[216,26],[216,117]]],paths:[[[216,81],[220,81]]]});
 town.regions.push({id:'roadster',offset:WORLD_OFFSETS.roadster,ground:true,bounds:{minX:-228,maxX:-170,minZ:-193,maxZ:-151}});town.districts.push({id:'roadster',name:'Roadster Proving Ground',type:'recreation',center:[-205,-172]});
 connectWorld(town,[[-115,-139],[-174,-139],[-174,-179],[-182,-179]]);connectWorld(town,[[-174,-139],[-174,-69]]);
 const rn=rebuildWorldGraph(town)([-182,-179]);town.venues.push({id:'roadster-arena',name:'Roadster Proving Ground',district:'roadster',type:'attraction',pos:[-205,-172],entry:[-182,-179],node:rn,height:16,box:{min:[-228,-193],max:[-182,-151]},story:'One white Roadster takes the suction ramp, vaults the five-car lineup and lands on its hover pad. The grandstand overlooks the complete 87-second show.'});
 town.regions.push({id:'starbase',offset:WORLD_OFFSETS.starbase,bounds:{minX:126,maxX:366,minZ:214,maxZ:370}});town.districts.push({id:'starbase',name:'Starbase Texas',type:'spaceport',center:[225,280]});
 connectWorld(town,[[216,117],[216,210],[126,210],[126,260]]);
 const sg=[[-99,-20],[-99,-12],[-77,-12],[-66,0],[-46,0],[-46,32],[-42,39]].map(p=>move(move(p,STARBASE_ORIGIN),WORLD_OFFSETS.starbase));
 for(let i=1;i<sg.length;i++)town.roads.push({a:sg[i-1],b:sg[i],width:2,kind:'visitor-walk',owner:'starbase',external:'starbase'});
 const sn=rebuildWorldGraph(town)(sg.at(-1));town.venues.push({id:'starbase-garden',name:'Starbase Visitor Garden',district:'starbase',type:'spaceport',pos:sg.at(-1),entry:sg.at(-1),node:sn,height:5,box:{min:[171,312],max:[195,326]},story:'A public viewing garden beside Highway 4. Watch the launch tower, returning boosters and offshore recovery ship from outside the working range.'});
 town.modelPlacements=expansionModels(town,catalog);
 const stops=capture?[]:compileExpansionScenes(town,pointInWorld);
 // Maple is deterministic and needs to be present for the platform reservations.
 addMapleHollow(town);
 if(!capture)stops.push(...compileAssetVignettes(town,catalog,pointInWorld,railwayAccessReservations()));
 rebuildWorldGraph(town);planRegionalRoads(town);flagMapleHollowRoads(town,planRegionalLines);planLandscape(town);town.water=planWater(town);planWoods(town);planNatureEdges(town);addRailway(town,catalog);
 const market=town.venues.find(v=>v.id==='work-station');
 Object.assign(market,{name:'West Works Market Hall',type:'market',story:'The old station hall now serves the West Works market and its workshops.'});
 const stopNode=rebuildWorldGraph(town);finishMapleHollow(town,stopNode);
 for(const st of town.railway.stations){const v=town.venues.find(p=>p.id===st.venue);v.node=st.node=stopNode(v.entry);}
 for(const scene of stops)for(const slot of scene.slots){slot.node=stopNode([slot.approach[0],slot.approach[2]]);town.interactions.push(slot);}
 town.registry=buildRegistry(town,catalog);registerLandscape(town);registerWoods(town);addExpansionModels(town,catalog);addDistrictLandmarks(town,landmarks);addDistrictActivities(town);addParkActivities(town);addDistrictFurniture(town);includeLifePlacements(town);addMapleHollowPlaces(town);const errors=registryErrors(town);if(errors.length)throw Error(errors.join('; '));return finishWorld(town);
}
export function finishWorld(town){
 const points=[...town.outline,...town.regions.flatMap(r=>[[r.bounds.minX,r.bounds.minZ],[r.bounds.maxX,r.bounds.maxZ]])];town.worldOutline=town.landscape?[...MAINLAND,[390,390],...(town.railway?.samples.map(q=>q.p)??[])]:points;
 town.worldBounds={minX:Math.min(...town.worldOutline.map(p=>p[0])),maxX:Math.max(...town.worldOutline.map(p=>p[0])),minZ:Math.min(...town.worldOutline.map(p=>p[1])),maxZ:Math.max(...town.worldOutline.map(p=>p[1]))};
 const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const n of town.edges[queue[i]])if(!seen.has(n)){seen.add(n);queue.push(n);}
 town.report={...town.report,districts:town.districts.length,venues:town.venues.length,connectedNodes:seen.size,ok:seen.size===town.nodes.length,errors:seen.size===town.nodes.length?[]:['Disconnected world graph']};const review=checkWorld(town);town.report.ok=review.ok;town.report.errors=review.errors;if(!review.ok)throw Error(review.errors.join('; '));return town;
}

// World membership includes dry mainland, road crossings, and the original
// coastal venue extents (including swimming areas). insideLandscape is dry land.
export function pointInWorld(p,town){
 if(town.landscape&&(insideLandscape(p)||town.roads.some(r=>r.walkline&&r.walkline.slice(1).some((b,i)=>distanceToSegment(p,r.walkline[i],b)<5))))return true;
 let inside=false;const poly=town.outline;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>p[1])!==(poly[j][1]>p[1])&&p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])inside=!inside;
 return inside||town.regions.some(({bounds:b})=>p[0]>=b.minX&&p[0]<=b.maxX&&p[1]>=b.minZ&&p[1]<=b.maxZ)||town.roads.some(r=>r.kind==='world-link'&&distanceToSegment(p,r.a,r.b)<r.width/2+2.5);
}
export function checkWorld(town){
 const errors=registryErrors(town),seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const n of town.edges[queue[i]]||[])if(!seen.has(n)){seen.add(n);queue.push(n);}
 if(seen.size!==town.nodes.length)errors.push('Disconnected world graph');
 for(const v of [...town.buildings,...town.venues])if(!Number.isInteger(v.node)||!town.nodes[v.node]||!seen.has(v.node))errors.push('Unreachable destination: '+v.name);
 // Authored district paths are validated by their dedicated geometry tests.
 // Cross-world links and newly introduced unowned roads must clear parcels.
 for(const r of town.roads.filter(r=>r.kind==='world-link'||!r.external&&!r.owner&&r.kind==='park').flatMap(r=>r.walkline?r.walkline.slice(1).map((b,i)=>({...r,a:r.walkline[i],b})):[r]))for(const v of [...town.buildings,...town.venues]){
  const entry=v.entry||town.nodes[v.node];if([r.a,r.b].some(p=>Math.hypot(p[0]-entry[0],p[1]-entry[1])<.02))continue;
  const length=Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1]);let crossed=false;
  for(let n=0;n<=Math.ceil(length*2);n++){const t=n/Math.max(1,Math.ceil(length*2)),x=r.a[0]+t*(r.b[0]-r.a[0]),z=r.a[1]+t*(r.b[1]-r.a[1]),b=v.box;if(x>b.min[0]-.1&&x<b.max[0]+.1&&z>b.min[1]-.1&&z<b.max[1]+.1){crossed=true;break;}}
  if(crossed)errors.push('Street crosses venue: '+v.name);
 }
 return {ok:!errors.length,errors,connectedNodes:seen.size,districts:town.districts.length,venues:town.venues.length};
}
