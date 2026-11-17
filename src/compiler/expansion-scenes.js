import {SWITCHYARD_REST} from '../astra/skatepark-layout.js';
import {districtFurniture} from '../astra/registry/district-furniture.js';
import landmarks from '../astra/registry/district-landmarks.json' with {type:'json'};
import {inLake} from '../astra/outskirts-layout.js';
import {boxInRiver} from './water.js';
import {compileScene,checkScene} from './library-scenes.js';
import {overlap,sceneData} from '../catalog/library/index.js';
import {distanceToSegment} from './astra.js';
import {REGIONAL} from '../roads/regional.js';

// Public rest stops pair a verified seat with small context props. Distances are
// measured envelope edges; the 0.9m aisle and 0.38m actor clearance stay reserved.
// Setbacks are from a 3.6m road; wider regional links push the stop out by the extra half-width.
const roadBox=(a,b,pad)=>({min:[Math.min(a[0],b[0])-pad,Math.min(a[1],b[1])-pad],max:[Math.max(a[0],b[0])+pad,Math.max(a[1],b[1])+pad]});
export function compileExpansionScenes(town,pointInWorld){
 const physical=town.modelPlacements.concat(districtFurniture(town),landmarks.filter(p=>p.district==='themepark'&&p.id!=='pinecrest')).map(p=>({min:[p.pos[0]-p.size[0]/2,p.pos[1]-p.size[2]/2],max:[p.pos[0]+p.size[0]/2,p.pos[1]+p.size[2]/2]}));
 const scenes=[];
 for(const spec of sceneData.districtScenes){
  const {district,recipe:recipeId}=spec;
  const obstacles=[...town.buildings,...town.venues.filter(v=>district!=='skatepark'||v.id!=='skatepark')].map(p=>p.box).concat(physical);
  const recipe=sceneData.recipes.find(r=>r.id===recipeId),name=recipe.name;
  const d=town.districts.find(d=>d.id===district),region=town.regions.find(r=>r.id===district)?.bounds;
  const candidates=[];
  for(const road of district==='skatepark'?[]:town.roads.filter(r=>!r.owner?.startsWith('catalog:'))){
   const length=Math.hypot(road.b[0]-road.a[0],road.b[1]-road.a[1]);if(length<3)continue;
   const mid=road.a.map((v,k)=>(v+road.b[k])/2);
   if(district==='outskirts'&&(mid[1]<40||mid[1]>122))continue;
   if(Math.hypot(mid[0]-d.center[0],mid[1]-d.center[1])>80)continue;
   const dx=(road.b[0]-road.a[0])/length,dz=(road.b[1]-road.a[1])/length;
   for(let dist=1.5;dist<length-1;dist+=(spec.bounds ? 0.5 : 3))for(const side of [-1,1])for(const base of [3.8,5.4,7]){const setback=base+(road.kind==='world-link'?Math.max(0,(road.width-3.6)/2):0);
    const street=[road.a[0]+dx*dist,road.a[1]+dz*dist],normal=[dz*side,-dx*side],center=street.map((v,k)=>v+normal[k]*setback),yaw=Math.round(Math.atan2(-normal[0],-normal[1])/(Math.PI/2))*Math.PI/2;
    if(region&&(center[0]<region.minX||center[0]>region.maxX||center[1]<region.minZ||center[1]>region.maxZ))continue;
    const scene={...compileScene(recipe,center,yaw,spec.id||'stop-'+district),district,street,name};
    if(spec.bounds&&[scene.box.min,scene.box.max].some(p=>p[0]<spec.bounds.min[0]||p[0]>spec.bounds.max[0]||p[1]<spec.bounds.min[1]||p[1]>spec.bounds.max[1]))continue;
    const corners=[scene.box.min,scene.box.max,[scene.box.min[0],scene.box.max[1]],[scene.box.max[0],scene.box.min[1]]];
    if(corners.some(p=>!pointInWorld(p,town)||district==='outskirts'&&inLake(p,2.2)||district==='harbor'&&(p[0]<122||p[0]>195||p[1]<34||p[1]>45))||boxInRiver(scene.box,.8))continue;
    if(obstacles.concat(scenes.map(s=>s.box),town.catalogScenes.map(s=>s.box)).some(b=>overlap(b,scene.box,.15)))continue;
    if(scene.members.some(m=>town.roads.some(r=>distanceToSegment(m.pos,r.a,r.b)<3&&overlap(m.box,roadBox(r.a,r.b,r.width/2+.15)))))continue;
    // The aisle is a footpath: it stays off the carriageway (regional kerb line).
    if(town.roads.some(r=>(r.kind==='world-link'||r.kind==='avenue'||r.kind==='lane'&&!r.owner)&&overlap(roadBox(r.a,r.b,r.kind==='world-link'?REGIONAL.kerb:r.width/2+.15),roadBox(scene.aisle[0],scene.aisle.at(-1),.45))))continue;
    const entry=scene.aisle.reduce((a,b)=>Math.hypot(a[0]-street[0],a[1]-street[1])<Math.hypot(b[0]-street[0],b[1]-street[1])?a:b);
    if(obstacles.some(box=>overlap(box,roadBox(street,entry,.45))))continue;
    candidates.push({scene,entry,score:Math.hypot(center[0]-d.center[0],center[1]-d.center[1])});
   }
  }
  if(district==='skatepark'){
   const venue=town.venues.find(v=>v.id==='skatepark');
   const center=SWITCHYARD_REST.center.map((v,k)=>v+venue.pos[k]);
   const scene={...compileScene(recipe,center,0,'stop-skatepark'),district,street:venue.entry,name,elevation:SWITCHYARD_REST.elevation};
   const bounds={min:SWITCHYARD_REST.bounds.min.map((v,k)=>v+venue.pos[k]),max:SWITCHYARD_REST.bounds.max.map((v,k)=>v+venue.pos[k])};
   if([scene.box.min,scene.box.max].some(p=>p.some((v,k)=>v<bounds.min[k]||v>bounds.max[k]))||obstacles.some(b=>overlap(b,scene.box,.15)))throw Error('Blocked Switchyard pedestrian rest area');
   const entry=scene.aisle.reduce((a,b)=>Math.hypot(a[0]-scene.street[0],a[1]-scene.street[1])<Math.hypot(b[0]-scene.street[0],b[1]-scene.street[1])?a:b);
   if(obstacles.some(b=>overlap(b,roadBox(scene.street,entry,.45))))throw Error('Blocked Switchyard entrance connector');
   for(const slot of scene.slots)slot.position[1]+=scene.elevation;
   candidates.push({scene,entry,score:0});
  }
  candidates.sort((a,b)=>a.score-b.score);const chosen=candidates[0];
  if(!chosen)throw Error('No clear expansion rest stop: '+(spec.id||district));
  const {scene,entry}=chosen;if(checkScene(scene).length)throw Error('Invalid expansion scene '+district);
  const owner='catalog:'+scene.id,add=(a,b,width)=>{if(Math.hypot(a[0]-b[0],a[1]-b[1])>.01)town.roads.push({a,b,width,kind:'catalog',external:district,owner});};
  add(scene.street,entry,.9);add(...scene.aisle,.9);
  for(const slot of scene.slots)add(slot.landing,[slot.approach[0],slot.approach[2]],.8);
  scenes.push(scene);
 }
 town.catalogScenes.push(...scenes);return scenes;
}
