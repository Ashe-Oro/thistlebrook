// OWNER: grok-woods lane (village/grok-woods). Contract: docs/specs/GROK-WOODS.md.
// Pinewood: the empty meadow west of town (between the Pine ridge peaks, the
// Willow River's west loop and downtown) becomes a mixed forest on a new
// foothill ridge, with dirt hiking trails, a summit lookout and a cairn.
// Pure plan: terrain height, trails, trees and features. The renderer
// (src/astra/woods.js), hikers (src/astra/woods-hikers.js) and tests read it.
import * as THREE from 'three';
import {makeRng} from './rng.js';
import {distanceToSegment,pointInTown} from './astra.js';
import {insideLandscape,MAINLAND} from './landscape.js';
import {waterClearance,riverSystem} from './water.js';
import {inLake} from '../astra/outskirts-layout.js';

export const GROUND_TOP=-.09; // mainland slab top (landscape.js)
export const TRAIL={width:1.7,lift:.045};
// Ground direction that reads as screen-up in the default camera (rotation 0).
export const CAMERA_BACK=[-.77,-.64];
// Pinewood Ridge spine: [x, z, height m, half-width m]. Foothills that tie the
// two existing Pine ridge peaks into one range; summit at the second point.
export const RIDGE=[[-167,2,7,20],[-158,28,15,31],[-151,51,9,25],[-146,73,12,25],[-140,88,5,18]];
// The area the woods fill (plan polygon, generous; exclusions do the rest).
export const WOODS_AREA=[[-196,-24],[-86,-24],[-86,10],[-93,22],[-93,38],[-80,48],[-72,56],[-72,104],[-90,120],[-130,124],[-176,96],[-200,60]];
// West fringe: the strip between the woods' west edge and the coast. Thinner
// woods that fade out towards the beach, so the forest has no hard edge.
export const FRINGE_AREA=[[-248,-24],[-196,-24],[-200,60],[-176,96],[-158,104],[-217,69],[-245,12]];
export const GLADES=[
 {id:'pond',name:'Pinewood Pond glade',center:[-113,70],r:11},
 {id:'picnic',name:'Fern Hollow picnic glade',center:[-104,12],r:8.5},
 {id:'meadow-north',name:'Foxglove meadow',center:[-130,-10],r:9},
 {id:'meadow-south',name:'Bluebell meadow',center:[-100,100],r:8},
 {id:'lookout',name:'Pinewood Lookout clearing',center:[-157.5,27.5],r:5.5},
 {id:'cairn',name:'South Knob cairn clearing',center:[-146,73],r:3.6},
 {id:'trailhead',name:'Pinewood Trailhead clearing',center:[-103.5,-24],r:6.5},
];
export const POND={center:[-111,72],rx:5.2,rz:3.6};
export const LOOKOUT={pos:[-157.5,27.5],facing:Math.atan2(1,-.15)}; // looks east over the woods to town
export const CAIRN={pos:[-146,73]};
// Trails: named control lines (plan metres), smoothed and draped on terrain.
// North trailhead sits off the south sidewalk of the Fair Lane (z=-33);
// the River trailhead is the west end of the riverside path by Willow Camp.
const SPINE_PATH=(from,to,step=3.5)=>{const out=[];for(let i=from;i<to;i++){const a=RIDGE[i],b=RIDGE[i+1],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step);for(let k=i===from?0:1;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return out;};
function trailLines(){
 const lookout=[-156.8,27.2],foot=[-127.5,19],knobFoot=[-121.5,76],cairn=[-146.6,71.6];
 const saddle=[-151,51],down=switchback(saddle,lookout,{half:5}).reverse(),up=switchback(saddle,cairn,{half:5});
 const ridge=Object.assign([...down,...up.slice(1)],{dense:true});
 return [
  {id:'north',name:'Pinewood Trail',points:[[-104,-30],[-104,-28.2],[-105,-21],[-108,-13],[-114,-5],[-118,4],[-123,12],foot]},
  {id:'switchbacks',name:'Lookout switchbacks',points:switchback(foot,lookout,{half:7.5})},
  {id:'ridge',name:'Ridge walk',points:ridge},
  {id:'descent',name:'Knob descent',points:Object.assign([...switchback(knobFoot,cairn,{half:6}).reverse(),...smooth([knobFoot,[-118,72.5],[-114.5,67]],.5).slice(1)],{dense:true})},
  {id:'river',name:'Willow River trail',points:[[-77.6,21],[-82,22.6],[-86.8,24.6],[-91.5,26],[-96,30],[-100,37],[-104,44.5]]},
  {id:'pond-link',name:'Pond path',points:[[-104,44.5],[-107,52],[-110,59],[-114.5,67]]},
  {id:'south',name:'Pinewood South Trail',points:[[-104,119],[-103,102],[-101,88],[-104,79],[-114.5,67]]},
  {id:'meadow-link',name:'Meadow cut',points:[[-104,44.5],[-110,38],[-117,30],[-122.5,23.5],foot]},
 ];
}
export const TRAILHEADS=[{id:'north',name:'Pinewood Trailhead',pos:[-104,-30],trail:'north',sign:[-102,-27.4]},{id:'river',name:'Willow River Trailhead',pos:[-77.6,21],trail:'river',sign:[-78.6,22.6]},{id:'south',name:'Pinewood South Trailhead',pos:[-104,119],trail:'south',sign:[-101.5,119]}];
// Hiker routes: lists of [trail, reversed]. 'outback' routes return the same way.
export const ROUTES=[
 {id:'summit',kind:'outback',start:'north',legs:[['north',0],['switchbacks',0]],rest:'lookout'},
 {id:'ridge',kind:'outback',start:'north',legs:[['north',0],['switchbacks',0],['ridge',0]],rest:'cairn'},
 {id:'loop',kind:'loop',start:'north',legs:[['north',0],['switchbacks',0],['ridge',0],['descent',0],['pond-link',1],['meadow-link',0],['north',1]],rest:'lookout'},
 {id:'river-pond',kind:'outback',start:'river',legs:[['river',0],['pond-link',0]],rest:'pond'},
 {id:'river-summit',kind:'outback',start:'river',legs:[['river',0],['meadow-link',0],['switchbacks',0]],rest:'lookout'},
];

const smoothstep=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
// Height of the ridge above the mainland top, metres. Zero outside its
// footprint, so roads, the river, the coast and the fair stay flat.
export function ridgeHeight(x,z){
 let best=0,sum=0;
 for(let i=1;i<RIDGE.length;i++){
  const a=RIDGE[i-1],b=RIDGE[i],dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz;
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L)),px=a[0]+dx*t,pz=a[1]+dz*t;
  const s=t*t*(3-2*t),h=a[2]+(b[2]-a[2])*s,r=a[3]+(b[3]-a[3])*s,u=Math.hypot(x-px,z-pz)/r;
  if(u<1){const v=h*(1-u*u)*(1-u*u);sum+=v**4;}
 }
 // Soft union of the spine pieces (4-norm): no crease where they meet.
 best=sum**.25;if(!best)return 0;
 // Gentle lumps so the flanks read as land, not a lathe; fade at the foot.
 const lump=1+.07*Math.sin(x*.23+z*.11)*Math.sin(z*.19-x*.08)+.025*Math.sin(x*.41-z*.33);
 return best*lump*smoothstep(.02,.6,best);
}
const RIDGE_BOX={minX:-196,maxX:-112,minZ:-24,maxZ:110};
export const ridgeBounds=()=>({...RIDGE_BOX});
// The rendered ridge is a RIDGE_STEP grid (two triangles a-d-c, c-d-e per
// cell) sunk RIDGE_SINK below the analytic height; this is its exact surface.
export const RIDGE_STEP=1.2,RIDGE_SINK=.025;
// Visible ground height: the ridge mesh where it rises, else the mainland top.
export function terrainY(x,z){const b=RIDGE_BOX;if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)return GROUND_TOP;return Math.max(GROUND_TOP,ridgeMeshY(x,z)+RIDGE_SINK);}
export function ridgeMeshY(x,z){
 const b=RIDGE_BOX,fx=(x-b.minX)/RIDGE_STEP,fz=(z-b.minZ)/RIDGE_STEP,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
 const h=(ii,jj)=>ridgeHeight(b.minX+ii*RIDGE_STEP,b.minZ+jj*RIDGE_STEP);
 const a=h(i,j),c=h(i+1,j),d=h(i,j+1),e=h(i+1,j+1);
 const y=u+v<=1?a+(c-a)*u+(d-a)*v:e+(d-e)*(1-u)+(c-e)*(1-v);
 return GROUND_TOP+y-RIDGE_SINK;
}

function polygonContains(poly,[x,z]){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
const smooth=(points,step=1)=>{const c=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');return c.getSpacedPoints(Math.max(2,Math.ceil(c.getLength()/step))).map(p=>[p.x,p.z]);};
// Switchbacks: from a foot point, climb towards a goal at a steady grade,
// turning back across the fall line whenever a leg strays `half` metres
// from the straight foot-goal line. Returns plan control points.
export function switchback(foot,goal,{grade=.2,half=6,step=.3,turn=.7}={}){
 const pts=[foot.slice()],[gx,gz]=goal,ax=gx-foot[0],az=gz-foot[1],al=Math.hypot(ax,az),u=[ax/al,az/al];
 let p=foot.slice(),side=1,guard=0,cur=null;const hGoal=ridgeHeight(gx,gz);
 const lateral=q=>(q[0]-foot[0])*-u[1]+(q[1]-foot[1])*u[0];
 while(Math.hypot(gx-p[0],gz-p[1])>1.2&&guard++<6000){
  const e=.25,hx=(ridgeHeight(p[0]+e,p[1])-ridgeHeight(p[0]-e,p[1]))/(2*e),hz=(ridgeHeight(p[0],p[1]+e)-ridgeHeight(p[0],p[1]-e))/(2*e),g=Math.hypot(hx,hz);
  const toGoal=[(gx-p[0])/Math.hypot(gx-p[0],gz-p[1]),(gz-p[1])/Math.hypot(gx-p[0],gz-p[1])];
  let d;
  // Near the goal, or where the slope is already gentle, head straight there.
  if(g<grade*1.05||Math.abs(ridgeHeight(...p)-hGoal)<.35+grade*Math.hypot(gx-p[0],gz-p[1])*.5&&Math.hypot(gx-p[0],gz-p[1])<6)d=toGoal;
  else{const up=[hx/g,hz/g],c=grade/g,sn=Math.sqrt(1-c*c),perp=[-up[1]*side,up[0]*side];d=[up[0]*c+perp[0]*sn,up[1]*c+perp[1]*sn];
   const lat=lateral(p),next=lateral([p[0]+d[0]*step*4,p[1]+d[1]*step*4]);
   if(Math.abs(next)>half&&Math.abs(next)>Math.abs(lat)){side=-side;const perp2=[-up[1]*side,up[0]*side];d=[up[0]*c+perp2[0]*sn,up[1]*c+perp2[1]*sn];}}
  // Limit the turn per step: hairpins become ~2 m radius bends, not folds.
  if(cur){const a=Math.atan2(cur[1],cur[0]),b=Math.atan2(d[1],d[0]);let da=b-a;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;const k=a+Math.max(-turn,Math.min(turn,da));d=[Math.cos(k),Math.sin(k)];}
  cur=d;p=[p[0]+d[0]*step,p[1]+d[1]*step];pts.push(p.slice());
 }
 pts.push(goal.slice());pts.dense=true;return pts;
}
// Sampled trail line: [x, y(surface), z] every ~0.8 m, draped on terrain.
const resample=(points,step)=>{const out=[points[0]];let carry=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);let d=step-carry;while(d<=l){out.push([a[0]+(b[0]-a[0])*d/l,a[1]+(b[1]-a[1])*d/l]);d+=step;}carry=l-(d-step);}if(Math.hypot(out.at(-1)[0]-points.at(-1)[0],out.at(-1)[1]-points.at(-1)[1])>.2)out.push(points.at(-1));return out;};
function drape(points){return (points.dense?resample(points,.8):smooth(points,.8)).map(([x,z])=>[+x.toFixed(3),+(terrainY(x,z)+TRAIL.lift).toFixed(4),+z.toFixed(3)]);}
const lengthOf=pts=>pts.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-pts[i][0],p[2]-pts[i][2]),0);
export function distanceToPolyline(p,pts){let d=Infinity;for(let i=1;i<pts.length;i++)d=Math.min(d,distanceToSegment(p,[pts[i-1][0],pts[i-1][2]],[pts[i][0],pts[i][2]]));return d;}

// A footbridge for every trail crossing of the river (same shape as the
// water plan's bridges, so the river renderer draws it and walkers use it).
function trailBridges(trails,existing=[]){
 const s=riverSystem(),out=[],base=existing.filter(b=>!b.existing).length;
 for(const tr of trails)for(let k=1;k<tr.points.length;k++){
  const a=[tr.points[k-1][0],tr.points[k-1][2]],b=[tr.points[k][0],tr.points[k][2]],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  if(waterClearance(mid)>0)continue;
  if(out.some(o=>Math.hypot(o.pos[0]-mid[0],o.pos[1]-mid[1])<6))continue;
  // Span the whole wet run (plus banks) along the trail direction.
  let reach=null,near=Infinity;for(const r of s.reaches)for(const p of r.points){const d=Math.hypot(p[0]-mid[0],p[1]-mid[1]);if(d<near){near=d;reach={r,p};}}
  const yaw=Math.atan2(b[0]-a[0],b[1]-a[1]),dir=[Math.sin(yaw),Math.cos(yaw)];
  let lo=0,hi=0;while(waterClearance([mid[0]-dir[0]*lo,mid[1]-dir[1]*lo],{bank:true})<0&&lo<20)lo+=.1;while(waterClearance([mid[0]+dir[0]*hi,mid[1]+dir[1]*hi],{bank:true})<0&&hi<20)hi+=.1;
  const centre=[mid[0]+dir[0]*(hi-lo)/2,mid[1]+dir[1]*(hi-lo)/2];
  out.push({id:`water-bridge-${base+out.length}`,existing:false,reach:reach.r.id,road:null,roadKind:'trail',trail:tr.id,pos:centre.map(v=>+v.toFixed(3)),yaw,length:+(lo+hi+2.2).toFixed(2),width:2.2,deck:.5});
 }
 return out;
}

export function planWoods(town){
 const rng=makeRng(town.seed+5113),random=()=>rng.float();
 const trails=trailLines().map(t=>({id:t.id,name:t.name,width:TRAIL.width,points:drape(t.points)}));
 trails.forEach(t=>t.length=+lengthOf(t.points).toFixed(1));
 const bridges=trailBridges(trails,town.water.bridges);
 // On a bridge the walking surface is the deck, not the terrain.
 for(const b of bridges)for(const t of trails)for(const p of t.points){const c=Math.cos(b.yaw),s=Math.sin(b.yaw),dx=p[0]-b.pos[0],dz=p[2]-b.pos[1];const along=dx*s+dz*c;if(Math.abs(along)<b.length/2&&Math.abs(dx*c-dz*s)<b.width/2+.6){p.onBridge=true;p[1]=b.deck;p[0]=+(b.pos[0]+s*along).toFixed(3);p[2]=+(b.pos[1]+c*along).toFixed(3);}}
 town.water.bridges.push(...bridges);
 // Everything the woods must keep clear of.
 const lines=[];for(const r of town.roads){const line=r.centerline||[r.a,r.b],half=(r.centerline?6:(r.width||2)/2+1.6);for(let i=1;i<line.length;i++)lines.push({a:line[i-1],b:line[i],half});}
 const near=lines.filter(l=>Math.min(l.a[0],l.b[0])<-60&&Math.max(l.a[1],l.b[1])>-50&&Math.min(l.a[1],l.b[1])<140);
 const boxes=[...town.buildings.map(b=>b.box),...town.venues.filter(v=>v.box).map(v=>v.box),...(town.catalogScenes||[]).map(s=>s.box)].filter(Boolean);
 const points=[...town.props,...town.trees,...(town.supplemental||[]),...(town.modelPlacements||[]),...(town.outskirts?.trees||[]),...(town.outskirts?.props||[])].map(p=>p.pos).filter(Boolean);
 const shore=[...MAINLAND,MAINLAND[0]];
 const hills=town.landscape.hills;
 const allTrails=trails.map(t=>t.points);
 const occludesTrail=(p,asset,scale)=>{const h=(asset==='cv-tree-pine'?5.2:4.6)*scale,crown=(asset==='cv-tree-pine'?1.2:1.9)*scale;
  for(const k of [.35,.6,.85,1.1]){const q=[p[0]+CAMERA_BACK[0]*h*k,p[1]+CAMERA_BACK[1]*h*k];if(trailDistance(q)<crown+TRAIL.width/2)return true;
   if(((q[0]-POND.center[0])/(POND.rx+crown+.8))**2+((q[1]-POND.center[1])/(POND.rz+crown+.8))**2<1)return true;}return false;};
 const trailDistance=p=>Math.min(...allTrails.map(pts=>distanceToPolyline(p,pts)));
 const blocked=(p,pad,area=WOODS_AREA)=>{
  if(!polygonContains(area,p)||!insideLandscape(p)||pointInTown(p,town))return true;
  if(town.regions.some(({bounds:b})=>p[0]>b.minX-4&&p[0]<b.maxX+4&&p[1]>b.minZ-4&&p[1]<b.maxZ+4))return true;
  if(near.some(l=>distanceToSegment(p,l.a,l.b)<l.half+pad))return true;
  if(waterClearance(p)<2.5+pad||inLake(p,6))return true;
  if(Math.min(...shore.slice(1).map((b,i)=>distanceToSegment(p,shore[i],b)))<8)return true;
  if(hills.some(h=>Math.hypot(h.pos[0]-p[0],h.pos[1]-p[1])<h.radius+1))return true;
  if(boxes.some(b=>p[0]>b.min[0]-2-pad&&p[0]<b.max[0]+2+pad&&p[1]>b.min[1]-2-pad&&p[1]<b.max[1]+2+pad))return true;
  if(points.some(q=>Math.abs(q[0]-p[0])<1.6&&Math.abs(q[1]-p[1])<1.6))return true;
  return false;
 };
 const inGlade=(p,extra=0)=>GLADES.find(g=>Math.hypot(g.center[0]-p[0],g.center[1]-p[1])<g.r+extra);
 const existing=town.landscape.models.map(m=>m.pos);
 const models=[],taken=[];
 const spaced=(p,d)=>!taken.some(q=>Math.abs(q[0]-p[0])<d&&Math.abs(q[1]-p[1])<d&&Math.hypot(q[0]-p[0],q[1]-p[1])<d)&&!existing.some(q=>Math.abs(q[0]-p[0])<d*.8&&Math.abs(q[1]-p[1])<d*.8);
 const add=(asset,p,scale,rot,role)=>{models.push({asset,pos:[+p[0].toFixed(3),+p[1].toFixed(3)],scale:+scale.toFixed(3),rot:+rot.toFixed(3),woods:role});taken.push(p);};
 // 1) Trees: jittered grid, density from a cluster field, thinning to
 // clearings, glade edges and trail corridors. Pines climb; broadleaf below.
 const cell=2.3;
 for(let x=-198;x<-70;x+=cell)for(let z=-26;z<126;z+=cell){
  const p=[x+random()*cell,z+random()*cell],r1=random(),r2=random(),r3=random();
  const cluster=.5+.28*Math.sin(p[0]*.071+1.3)*Math.cos(p[1]*.064-.4)+.22*Math.sin((p[0]-p[1])*.043);
  const glade=inGlade(p,3.5);if(glade&&Math.hypot(glade.center[0]-p[0],glade.center[1]-p[1])<glade.r+.5)continue;
  const edge=glade?.45:1,td=trailDistance(p);if(td<3.1)continue;
  const H=ridgeHeight(...p),alpine=1-.7*smoothstep(7,15,H),density=Math.min(.95,(.31+cluster*.62)*edge*(td<4.6?.55:1)*alpine);
  if(r1>density||blocked(p,1.2)||!spaced(p,1.9))continue;
  const pineOdds=.48+H*.07+(p[0]<-140?.15:0)-(p[0]>-105?.15:0);
  const asset=r2<pineOdds?'cv-tree-pine':'cv-tree-oak';
  const scale=asset==='cv-tree-pine'?.72+r3*.82:.7+r3*.65;
  // Keep the tread readable from the default camera: a crown hides the
  // ground behind it (screen-up), so no crown may sit over a trail there.
  if(occludesTrail(p,asset,scale))continue;
  add(asset,p,scale,random()*6.283,'tree');
 }
 // 2) Understory: bushes along edges, boulders (more on the heights), mossy
 // logs, grass and wildflowers in glades.
 for(let i=0;i<5200;i++){
  const p=[-198+random()*128,-26+random()*152],r=random(),H=ridgeHeight(...p),glade=inGlade(p,2),td=trailDistance(p);
  if(td<1.5||blocked(p,0))continue;
  let asset=null,scale=1;
  if(glade){const d=Math.hypot(glade.center[0]-p[0],glade.center[1]-p[1]);if(d<glade.r-1.2)continue;if(d<glade.r+1.5&&r<.25&&!['lookout','cairn'].includes(glade.id)){asset='cv-bush-round';scale=.7+random()*.5;}}
  else if(r<.035+H*.006){asset='cv-rock-boulder';scale=.42+random()*.5;}
  else if(r<.11){asset='cv-bush-round';scale=.7+random()*.6;}
  else if(r<.125&&td>3){asset='nat-fallen-log-mossy';scale=.8+random()*.4;}
  else if(r<.16&&td<3.4){asset='cv-bush-round';scale=.6+random()*.5;}
  if((asset==='cv-rock-boulder'||asset==='nat-fallen-log-mossy')&&td<2.8)continue;
  if(!asset||!spaced(p,asset==='nat-wildflower'||asset==='nat-tall-grass'?.9:1.5))continue;
  add(asset,p,scale,random()*6.283,'understory');
 }
 // 2b) West fringe to the coast: its own seed so the main woods above are
 // unchanged; density fades from the woods edge to the beach.
 {const fr=makeRng(town.seed+5114),rnd=()=>fr.float(),shoreDist=p=>Math.min(...shore.slice(1).map((b,i)=>distanceToSegment(p,shore[i],b)));
  for(let x=-248;x<-156;x+=cell)for(let z=-26;z<106;z+=cell){
   const p=[x+rnd()*cell,z+rnd()*cell],r1=rnd(),r2=rnd(),r3=rnd();
   if(!polygonContains(FRINGE_AREA,p)||polygonContains(WOODS_AREA,p))continue;
   const cluster=.5+.28*Math.sin(p[0]*.071+1.3)*Math.cos(p[1]*.064-.4)+.22*Math.sin((p[0]-p[1])*.043);
   const density=(.18+cluster*.5)*smoothstep(9,26,shoreDist(p));
   if(r1>density||blocked(p,1.2,FRINGE_AREA)||!spaced(p,2.1))continue;
   const asset=r2<.62?'cv-tree-pine':'cv-tree-oak',scale=asset==='cv-tree-pine'?.7+r3*.75:.7+r3*.6;
   if(occludesTrail(p,asset,scale))continue;
   add(asset,p,scale,rnd()*6.283,'tree');
  }
  for(let i=0;i<900;i++){const p=[-248+rnd()*92,-26+rnd()*132],r=rnd();
   if(!polygonContains(FRINGE_AREA,p)||polygonContains(WOODS_AREA,p)||blocked(p,0,FRINGE_AREA))continue;
   const asset=r<.25?'cv-rock-boulder':r<.75?'cv-bush-round':null;if(!asset||!spaced(p,1.5))continue;
   add(asset,p,asset==='cv-rock-boulder'?.42+rnd()*.45:.65+rnd()*.55,rnd()*6.283,'understory');}
 }
 // 3) Features: trail furniture and landmarks (instanced owned kit).
 const feature=(asset,p,rot,scale,role)=>{models.push({asset,pos:p.map(v=>+v.toFixed(3)),scale,rot:+rot.toFixed(3),woods:role,feature:true});taken.push(p);};
 const L=LOOKOUT.pos,f=LOOKOUT.facing;
 feature('cv-bench',[L[0]+Math.sin(f)*1.6-Math.cos(f)*1.3,L[1]+Math.cos(f)*1.6+Math.sin(f)*1.3],f+Math.PI,.9,'lookout-bench');
 feature('cv-bench',[L[0]+Math.sin(f)*1.6+Math.cos(f)*1.3,L[1]+Math.cos(f)*1.6-Math.sin(f)*1.3],f+Math.PI,.9,'lookout-bench');
 feature('cv-rock-stone-pile',[CAIRN.pos[0]+1.2,CAIRN.pos[1]+.6],.4,1.7,'cairn');
 feature('nat-log-bench',[-108.6,66.6],2.2,1,'pond-bench');
 feature('nat-log-bench',[-101.5,14.5],-.9,1,'picnic-bench');
 feature('nat-log-bench',[-106.5,9.6],.6,1,'picnic-bench');
 feature('nat-cattails',[POND.center[0]-POND.rx-.4,POND.center[1]+.8],0,1.1,'pond-reeds');
 feature('nat-cattails',[POND.center[0]+POND.rx+.3,POND.center[1]-.9],1,1,'pond-reeds');
 feature('nat-cattails',[POND.center[0]+1.5,POND.center[1]+POND.rz+.3],2,1.2,'pond-reeds');
 for(const m of models){const H=terrainY(...m.pos)-GROUND_TOP;m.y=+(H>0?H-(m.asset.includes('tree')?.12:.06):0).toFixed(3);}
 // Existing landscape vegetation inside the ridge footprint rides on it too.
 for(const m of town.landscape.models){const H=terrainY(...m.pos)-GROUND_TOP;if(H>0)m.y=+(H-.1).toFixed(3);}
 const added=models;town.landscape.models.push(...added);
 town.woods={area:WOODS_AREA,ridge:{spine:RIDGE,bounds:ridgeBounds(),summit:[RIDGE[1][0],RIDGE[1][1]]},trails,trailheads:TRAILHEADS,routes:ROUTES,glades:GLADES,pond:POND,lookout:LOOKOUT,cairn:CAIRN,bridges:bridges.map(b=>b.id),
  counts:{trees:added.filter(m=>m.woods==='tree').length,understory:added.filter(m=>m.woods==='understory').length,features:added.filter(m=>m.feature).length,trailMetres:+trails.reduce((s,t)=>s+t.length,0).toFixed(1)}};
}

// Registry records for the woods' procedural parts (trees are registered by
// registerLandscape with the rest of the vegetation).
export function registerWoods(town){
 const w=town.woods;if(!w)return;
 const near=pos=>town.districts.reduce((a,b)=>Math.hypot(...b.center.map((v,k)=>v-pos[k]))<Math.hypot(...a.center.map((v,k)=>v-pos[k]))?b:a).id;
 const rec=(id,name,type,pos)=>({id,name,type,kind:type,pos:[...pos],district:near(pos),owner:'Pinewood',occupants:[],hours:[0,24],capabilities:[],node:null,entryPoints:[],interactionPoints:[]});
 const records=[rec('woods:ridge','Pinewood Ridge','landmark',w.ridge.summit),rec('woods:pond','Pinewood Pond','landmark',w.pond.center),rec('woods:lookout','Pinewood Lookout','landmark',w.lookout.pos),rec('woods:hikers','Pinewood hikers','person',w.trailheads[0].pos)];
 for(const t of w.trails)records.push(rec(`woods:trail-${t.id}`,t.name,'infrastructure',[t.points[0][0],t.points[0][2]]));
 for(const h of w.trailheads)records.push(rec(`woods:trailhead-${h.id}`,h.name,'infrastructure',h.pos));
 town.registry.places.push(...records);w.registryIds=records.map(r=>r.id);
}
