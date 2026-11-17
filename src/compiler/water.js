// OWNER: grok-river lane (village/grok-river). Contract: docs/specs/GROK-RIVER.md.
// Astra's single hydrological plan. The Willow River rises as a cascade on
// the Mountain Pass peak, keeps its original bed through town, runs through
// the western meadow into Stillwater Lake, and leaves the lake as the
// Stillwater Outflow for a small delta beach on the Gulf. Rendering, foliage
// exclusion, bridges, walker deck heights and tests all read this one plan.
import * as THREE from 'three';
import {riverZ,distanceToSegment,pointInTown} from './astra.js';
import {insideLandscape,MAINLAND} from './landscape.js';
import {PARK_MOUNTAINS} from '../astra/themepark-plan.js';
import {LAKE,inLake} from '../astra/outskirts-layout.js';

// Water surface levels (world y). The town slab is at -0.02, open mainland
// at -0.09 and the Gulf at -0.45; every reach is level or falls downstream.
export const WATER_LEVEL={plunge:.075,townEast:.06,townWest:.05,lake:.04,coast:.036,sea:-.44};
export const BANK=.5;
// Authored river line (plan metres). Control points, not mesh: reaches are
// smoothed and resampled below. Trunk = the original town bed (riverZ).
// Bearing 328 deg is the one clean gully between the peak's boulder ring.
const SPRING={mountain:[105,0],bearing:328,from:3.3,to:9.6};
// The upper reach bends north of Highway 4's scenic pull-out at (80.5,17).
const UPPER=[[96.5,10.1],[90.5,10.3],[84,9.7],[78,10.1],[72,12.1]];
const TRUNK={east:65,west:-80};
const WEST=[[-84.5,15.6],[-87,21],[-86.5,29],[-82,36],[-74,42],[-63,46.5],[-52,50],[-42,53.6],[-33,57.5],[-26.5,61.5]];
const OUTFLOW=[[5,80.5],[12.5,81.8],[18,84.2],[23,88],[27,91],[33,93.5],[38.5,98],[41,106],[41,116],[35.5,125.5],[25.5,133.5],[17.5,140],[14.5,147],[14,153],[14,158.5]];

const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(points,step=1)=>{
 const c=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
 return c.getSpacedPoints(Math.max(2,Math.ceil(c.getLength()/step))).map(p=>[p.x,p.z]);
};
const arc=points=>{const d=[0];for(let i=1;i<points.length;i++)d.push(d[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));return d;};

// The cascade drapes over the real Mountain Pass mesh (same transform as
// themepark.js), so the falls can never float off or sink into the rock.
let mountainCache=null;
function mountainMesh(){
 if(mountainCache)return mountainCache;
 const [x,z,w,h]=PARK_MOUNTAINS.find(([x,z])=>x===SPRING.mountain[0]&&z===SPRING.mountain[1]);
 const g=new THREE.Group(),cone=new THREE.Mesh(new THREE.ConeGeometry(1,1,7,1));cone.position.set(x,h/2-.2,z);cone.scale.set(w,h,w*.8);cone.rotation.y=x;g.add(cone);
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2,r=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0));r.position.set(x+Math.sin(a)*w*.8,2,z+Math.cos(a)*w*.65);r.scale.set(4,3,4);g.add(r);}
 g.updateMatrixWorld(true);const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),from=new THREE.Vector3();
 mountainCache={x,z,w,h,surface(px,pz){from.set(px,60,pz);ray.set(from,down);const hit=ray.intersectObject(g,true)[0];return hit?hit.point.y:null;}};
 return mountainCache;
}
export const mountainSurface=(x,z)=>mountainMesh().surface(x,z);

let cache=null;
// Every point: [x, z, level, halfWidth, bank]. Reaches run source -> mouth.
export function riverSystem(){
 if(cache)return cache;
 const m=mountainMesh(),a=SPRING.bearing*Math.PI/180,dx=Math.sin(a),dz=Math.cos(a);
 const falls=[];
 for(let r=SPRING.from;r<=SPRING.to+1e-6;r+=.25){
  const x=m.x+dx*r,z=m.z+dz*r,half=lerp(.55,.8,(r-SPRING.from)/(SPRING.to-SPRING.from));
  falls.push([x,z,Math.max((m.surface(x,z)??-.09)+.1,WATER_LEVEL.plunge),half,.15]);
 }
 const foot=falls.at(-1);
 const upperLine=smooth([[foot[0],foot[1]],...UPPER,[TRUNK.east,riverZ(TRUNK.east)]]),ud=arc(upperLine);
 const upper=upperLine.map(([x,z],i)=>{const t=ud[i]/ud.at(-1);return [x,z,lerp(WATER_LEVEL.plunge,WATER_LEVEL.townEast,t),lerp(1.1,2.65,Math.min(1,t*1.6)),BANK];});
 const town=[];for(let n=0;n<=145;n++){const x=lerp(TRUNK.east,TRUNK.west,n/145);town.push([x,riverZ(x),lerp(WATER_LEVEL.townEast,WATER_LEVEL.townWest,n/145),2.65,BANK]);}
 const westLine=smooth([[TRUNK.west,riverZ(TRUNK.west)],...WEST]),wd=arc(westLine);
 // The lake mouth fans out into a sandy inflow delta over its last 9 m.
 const west=westLine.map(([x,z],i)=>{const t=wd[i]/wd.at(-1),toEnd=wd.at(-1)-wd[i],fan=Math.max(0,1-toEnd/9);return [x,z,lerp(WATER_LEVEL.townWest,WATER_LEVEL.lake,t),2.65+fan*1.9,BANK+fan*1.6];});
 const outLine=smooth(OUTFLOW),od=arc(outLine),total=od.at(-1);
 // Level to the beach ledge (4.5 m inside the estuary cut in MAINLAND), then
 // a run down to the Gulf surface. The last 18 m before the cut widen into a
 // braided delta; inside the cut the beach itself is the bank.
 const headIndex=outLine.findIndex(p=>!insideLandscape(p)),head=od[headIndex],ledge=head+4.5;
 const outflow=outLine.map(([x,z],i)=>{
  const d=od[i],exit=Math.max(0,1-d/7),mouth=Math.min(1,Math.max(0,1-(head-d)/18)),past=Math.max(0,Math.min(1,(d-head)/4.5));
  const level=d<=ledge?lerp(WATER_LEVEL.lake,WATER_LEVEL.coast,d/ledge):lerp(WATER_LEVEL.coast,WATER_LEVEL.sea,Math.min(1,(d-ledge)/Math.max(1,total-ledge-1.5)));
  return [x,z,level,lerp(2.4+exit*1.4+mouth*3.6,4,past),(BANK+mouth*2.6)*(1-past)];
 });
 cache={
  reaches:[
   {id:'spring-falls',name:'Willow Spring Falls',kind:'cascade',points:falls},
   {id:'upper',name:'Upper Willow',kind:'river',points:upper},
   {id:'town',name:'Willow River',kind:'river',points:town},
   {id:'west',name:'Willow River · meadow reach',kind:'river',points:west,into:'lake'},
   {id:'outflow',name:'Stillwater Outflow',kind:'river',points:outflow,from:'lake',into:'sea'}
  ],
  pools:[{id:'plunge',x:foot[0]-.6,z:foot[1]+.9,r:2.3,level:WATER_LEVEL.plunge}],
  lake:{...LAKE,level:WATER_LEVEL.lake},
  source:{mountain:SPRING.mountain,bearing:SPRING.bearing,lip:falls[0]},
  mouth:{pos:outflow.at(-1).slice(0,2),shore:outLine[headIndex],headIndex,ledge:outLine[outLine.findIndex((p,i)=>od[i]>=ledge)]}
 };
 const all=cache.reaches.flatMap(r=>r.points);
 cache.bounds={minX:Math.min(...all.map(p=>p[0]-p[3]-p[4])),maxX:Math.max(...all.map(p=>p[0]+p[3]+p[4])),minZ:Math.min(...all.map(p=>p[1]-p[3]-p[4])),maxZ:Math.max(...all.map(p=>p[1]+p[3]+p[4]))};
 return cache;
}

// Segment grid: compile-time foliage and vignette checks stay cheap.
const CELL=6,REACH_PAD=6;let grid=null;
function segmentGrid(){
 if(grid)return grid;grid=new Map();const s=riverSystem();
 const add=(seg,x0,z0,x1,z1)=>{for(let i=Math.floor(x0/CELL);i<=Math.floor(x1/CELL);i++)for(let j=Math.floor(z0/CELL);j<=Math.floor(z1/CELL);j++){const k=i+','+j;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(seg);}};
 for(const r of s.reaches)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],c=r.points[i],pad=Math.max(a[3],c[3])+Math.max(a[4],c[4])+REACH_PAD,seg={a,c,half:Math.max(a[3],c[3]),bank:Math.max(a[4],c[4])};add(seg,Math.min(a[0],c[0])-pad,Math.min(a[1],c[1])-pad,Math.max(a[0],c[0])+pad,Math.max(a[1],c[1])+pad);}
 for(const q of s.pools)add({pool:q},q.x-q.r-REACH_PAD,q.z-q.r-REACH_PAD,q.x+q.r+REACH_PAD,q.z+q.r+REACH_PAD);
 return grid;
}
// Distance from p to the river's water edge (negative = in the water). Exact
// within REACH_PAD metres of the channel; beyond that it reports Infinity.
export function waterClearance(p,{bank=false}={}){
 let best=Infinity;
 for(const seg of segmentGrid().get(Math.floor(p[0]/CELL)+','+Math.floor(p[1]/CELL))||[]){
  if(seg.pool){best=Math.min(best,Math.hypot(p[0]-seg.pool.x,p[1]-seg.pool.z)-seg.pool.r);continue;}
  best=Math.min(best,distanceToSegment(p,seg.a,seg.c)-seg.half-(bank?seg.bank:0));
 }
 return best;
}
export const inRiver=(p,margin=0)=>{if(margin>REACH_PAD)throw Error('inRiver margin above '+REACH_PAD);return waterClearance(p)<margin;};
// Lake or river, with a margin beyond the water's edge.
export const inWater=(p,margin=0)=>inRiver(p,margin)||inLake(p,margin);
// Axis-aligned footprint overlap (corners, edges and centre are sampled).
export function boxInRiver(box,margin=0){
 const [x0,z0]=box.min,[x1,z1]=box.max,pts=[];
 const nx=Math.max(1,Math.ceil((x1-x0)/1.5)),nz=Math.max(1,Math.ceil((z1-z0)/1.5));
 for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++)pts.push([lerp(x0,x1,i/nx),lerp(z0,z1,j/nz)]);
 return pts.some(p=>inRiver(p,margin));
}
// Water surface level at a point on the river (null when dry).
export function riverLevelAt(p){
 const s=riverSystem();let best=null,bd=Infinity;
 for(const r of s.reaches)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],c=r.points[i],d=distanceToSegment(p,a,c);if(d<bd&&d<Math.max(a[3],c[3])){bd=d;best=Math.max(a[2],c[2]);}}
 return best;
}

const cross=(a,b,c,d)=>{
 const den=(b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]);if(Math.abs(den)<1e-12)return null;
 const t=((c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]))/den,u=((c[0]-a[0])*(b[1]-a[1])-(c[1]-a[1])*(b[0]-a[0]))/den;
 return t>=0&&t<=1&&u>=0&&u<=1?{p:[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],t,u}:null;
};
// Every road/path segment that crosses a reach gets a bridge. The three
// original Willow River bridges keep their world.js geometry (existing).
export function planBridges(town){
 const s=riverSystem(),bridges=[];
 for(const [roadIndex,road] of town.roads.entries()){
  const line=road.centerline||[road.a,road.b];
  for(let k=1;k<line.length;k++)for(const reach of s.reaches){
   if(reach.kind==='cascade')continue;
   for(let i=1;i<reach.points.length;i++){
    const a=reach.points[i-1],b=reach.points[i],hit=cross(line[k-1],line[k],a,b);if(!hit)continue;
    const rx=b[0]-a[0],rz=b[1]-a[1],ry=Math.atan2(line[k][0]-line[k-1][0],line[k][1]-line[k-1][1]);
    const sin=Math.abs(Math.sin(Math.atan2(rx,rz)-ry))||1,half=Math.max(a[3],b[3])+Math.max(a[4],b[4]);
    if(bridges.some(b=>Math.hypot(b.pos[0]-hit.p[0],b.pos[1]-hit.p[1])<1))continue;
    const existing=reach.id==='town'?town.bridges.findIndex(x=>Math.abs(x-hit.p[0])<1.6):-1;
    bridges.push({id:existing>=0?`bridge-${existing}`:`water-bridge-${bridges.filter(b=>!b.existing).length}`,existing:existing>=0,reach:reach.id,road:roadIndex,roadKind:road.kind,
     pos:hit.p.map(v=>+v.toFixed(3)),yaw:ry,length:existing>=0?7.4:+(2*half/sin+1.6).toFixed(2),width:existing>=0?3.3:+Math.max(2.1,road.width+.7).toFixed(2),deck:existing>=0?.53:.5});
   }
  }
 }
 return bridges;
}
// Raised deck height when a walker stands on any bridge, else null.
export function bridgeDeck(town,[x,z]){
 for(const b of town.water?.bridges||[]){
  const c=Math.cos(b.yaw),s=Math.sin(b.yaw),dx=x-b.pos[0],dz=z-b.pos[1],along=dx*s+dz*c,across=dx*c-dz*s;
  if(Math.abs(along)<b.length/2&&Math.abs(across)<(b.existing?1.6:b.width/2+.1))return b.deck;
 }
 if(!town.water)for(const x0 of town.bridges||[])if(Math.abs(x-x0)<1.6&&Math.abs(z-riverZ(x0))<3.8)return .53;
 return null;
}
// Top of whatever terrain is under (x,z): town slab, district pads, mainland,
// beach ledge or open Gulf. Matches the world.js / landscape.js slab heights.
export function groundAt(town,[x,z]){
 if(pointInTown([x,z],town))return -.02;
 if((town.regions||[]).some(r=>r.ground&&x>r.bounds.minX-1.5&&x<r.bounds.maxX+1.5&&z>r.bounds.minZ-1.5&&z<r.bounds.maxZ+1.5))return -.03;
 if(insideLandscape([x,z]))return -.09;
 const shore=[...MAINLAND,MAINLAND[0]],d=Math.min(...shore.slice(1).map((b,i)=>distanceToSegment([x,z],shore[i],b)));
 return d<4.5?-.095:-.45;
}
export function planWater(town){
 const s=riverSystem();
 return {reaches:s.reaches.map(r=>({...r,points:r.points.map(p=>p.map(v=>+v.toFixed(4)))})),pools:s.pools,lake:s.lake,source:s.source,mouth:s.mouth,bounds:s.bounds,bridges:planBridges(town)};
}
