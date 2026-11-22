import {compileScene} from './library-scenes.js';
import {sceneData,overlap} from '../catalog/library/index.js';
import {riverZ} from './astra.js';
import {inLake} from '../astra/outskirts-layout.js';
import {boxInRiver} from './water.js';
import {indexBoxes} from './box-index.js';
import {districtFurniture} from '../astra/registry/district-furniture.js';
import {supplementalPlacements} from '../astra/registry/placements.js';
import landmarks from '../astra/registry/district-landmarks.json' with {type:'json'};

// Deliberately public, quiet districts. None of these sites can select the
// airport apron, Roadster circuit, Starbase range or their approach corridors.
const zones={
 orchard:[-78,21,40,38],works:[-122,-174,-40,-104],
 outskirts:[-77,38,59,121],'civic-green':[-104,-103,-43,-33],
 quay:[38,-51,72,31],market:[-15,-17,15,11],sunbeam:[-146,-72,-106,-30]
};
export const pathBox=(a,b,pad)=>({min:[Math.min(a[0],b[0])-pad,Math.min(a[1],b[1])-pad],max:[Math.max(a[0],b[0])+pad,Math.max(a[1],b[1])+pad]});
const movedBox=(box,p)=>({min:box.min.map((v,k)=>v+p[k]),max:box.max.map((v,k)=>v+p[k])});
const overlaps=boxes=>{
 const near=indexBoxes(boxes);
 return (box,pad=0)=>near(box,pad,other=>overlap(other,box,pad));
};
const corners=b=>[b.min,b.max,[b.min[0],b.max[1]],[b.max[0],b.min[1]]];
export function vignetteObstacles(town,catalog){
 const kit=[...town.props,...town.trees,...supplementalPlacements(town)].flatMap(p=>{
  const a=catalog.get(p.asset||p.id);if(!a)return [];
  const scale=p.scale??1,c=Math.cos(p.rot||0),s=Math.sin(p.rot||0),points=[];
  // Legacy kit origins are not necessarily centered like the library loader.
  for(const x of [a.bounds.min[0],a.bounds.max[0]])for(const z of [a.bounds.min[2],a.bounds.max[2]])points.push([p.pos[0]+scale*(x*c+z*s),p.pos[1]+scale*(-x*s+z*c)]);
  return [{min:[0,1].map(k=>Math.min(...points.map(p=>p[k]))),max:[0,1].map(k=>Math.max(...points.map(p=>p[k])))}];
 });
 return [...town.buildings,...town.venues].map(p=>p.box).concat(kit,town.courtyards,town.sunbeamReservation?[town.sunbeamReservation]:[],
  (town.outskirts?.fields||[]).map(f=>({min:[f.x-f.w/2,f.z-f.d/2],max:[f.x+f.w/2,f.z+f.d/2]})),
  town.gardens.map(g=>({min:[g.x-g.width/2,g.z-g.depth/2],max:[g.x+g.width/2,g.z+g.depth/2]})),
  town.modelPlacements.concat(districtFurniture(town),landmarks).map(p=>({min:[p.pos[0]-p.size[0]/2,p.pos[1]-p.size[2]/2],max:[p.pos[0]+p.size[0]/2,p.pos[1]+p.size[2]/2]})));
}
export function compileAssetVignettes(town,catalog,pointInWorld,reservations=[]){
 const obstacles=vignetteObstacles(town,catalog).concat(reservations),scenes=[];
 const area=spec=>{const b=compileScene(spec.recipe).box;return (b.max[0]-b.min[0])*(b.max[1]-b.min[1]);};
 for(const spec of [...sceneData.vignettes].sort((a,b)=>area(b)-area(a))){
  const zone=zones[spec.district],district=town.districts.find(d=>d.id===spec.district);
  const templates=[0,1,2,3].map(n=>compileScene(spec.recipe,[0,0],n*Math.PI/2,spec.id));
  const occupied=overlaps(obstacles.concat(town.catalogScenes.map(s=>s.box)));
  const roads=overlaps(town.roads.map(r=>pathBox(r.a,r.b,r.width/2+.25)));
  const carriageways=overlaps(town.roads.filter(r=>r.kind==='avenue'||!r.owner&&r.kind!=='pedestrian'&&r.width>=2.4&&Math.min(r.a[1],r.b[1])<4.01).map(r=>pathBox([r.a[0],r.kind==='avenue'?r.a[1]:Math.min(4,r.a[1])],[r.b[0],r.kind==='avenue'?r.b[1]:Math.min(4,r.b[1])],r.width/2)));
  const candidates=[];
  for(const road of town.roads.filter(r=>!r.owner?.startsWith('catalog')&&r.kind!=='world-link')){
   const dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],length=Math.hypot(dx,dz);
   if(length<3)continue;
   for(let along=1.5;along<length-1;along+=1)for(const side of [-1,1])for(const setback of [3.5,4.5,5.5,6.5,7.5,8.5,10.5,12.5]){
    const street=[road.a[0]+dx*along/length,road.a[1]+dz*along/length],normal=[dz/length*side,-dx/length*side];
    const center=street.map((v,k)=>v+normal[k]*setback);
    if(center[0]<zone[0]||center[0]>zone[2]||center[1]<zone[1]||center[1]>zone[3])continue;
    const yaw=Math.round(Math.atan2(-normal[0],-normal[1])/(Math.PI/2)),template=templates[(yaw+4)%4],box=movedBox(template.box,center);
    if(occupied(box,.35))continue;
    if(corners(box).some(p=>!pointInWorld(p,town)||Math.abs(p[1]-riverZ(p[0]))<3.4||spec.district==='outskirts'&&inLake(p,3))||boxInRiver(box,.8))continue;
    if(template.members.some(m=>roads(movedBox(m.box,center))))continue;
    if(template.slots.some(s=>{
     const point=[s.position[0]+center[0],s.position[2]+center[1]];
     return roads(pathBox(point,point,.38));
    }))continue;
    const aisle=template.aisle.map(p=>p.map((v,k)=>v+center[k]));
    // The exterior aisle is a footpath: it must sit beside the road, not on it.
    if(carriageways(pathBox(aisle[0],aisle.at(-1),.45)))continue;
    const entry=aisle.reduce((a,b)=>Math.hypot(a[0]-street[0],a[1]-street[1])<Math.hypot(b[0]-street[0],b[1]-street[1])?a:b);
    // Leave the road across its width before turning to meet the aisle.
    const join=Math.abs(dz)>Math.abs(dx)?[entry[0],street[1]]:[street[0],entry[1]];
    const segments=[[street,join],[join,entry]].filter(([a,b])=>Math.hypot(a[0]-b[0],a[1]-b[1])>.01);
    if(segments.some(([a,b])=>{
     const steps=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])*2));
     for(let n=0;n<=steps;n++){const p=a.map((v,k)=>v+(b[k]-v)*n/steps);if(!pointInWorld(p,town)||Math.abs(p[1]-riverZ(p[0]))<3.4||spec.district==='outskirts'&&inLake(p,.3))return true;}
     return false;
    }))continue;
    if(segments.some(([a,b])=>occupied(pathBox(a,b,.45))||template.members.some(m=>overlap(movedBox(m.box,center),pathBox(a,b,.45)))))continue;
    candidates.push({center,yaw:template.yaw,street,segments,score:Math.hypot(center[0]-district.center[0],center[1]-district.center[1])+setback*.4});
   }
  }
  candidates.sort((a,b)=>a.score-b.score);
  if(!candidates.length){(town.unplacedVignettes??=[]).push({id:spec.id,reason:'No clear public parcel with a reachable exterior aisle'});continue;}
  const {center,yaw,street,segments}=candidates[0],scene={...compileScene(spec.recipe,center,yaw,spec.id),district:spec.district,street};
  const owner='catalog:'+scene.id;
  const add=(a,b,width)=>{if(Math.hypot(a[0]-b[0],a[1]-b[1])>.01)town.roads.push({a,b,width,kind:'catalog',owner});};
  for(const [a,b]of [...segments,scene.aisle])add(a,b,.9);
  for(const slot of scene.slots)add(slot.landing,[slot.approach[0],slot.approach[2]],.8);
  scene.connector=segments;town.catalogScenes.push(scene);scenes.push(scene);
 }
 return scenes;
}
