import {assetInteractionPoints} from './asset-points.js';
import {seedModelPlacements} from './seed-models.js';
import manifest from './district-models.json' with {type:'json'};
import {modelPlacementId} from './model-id.js';
import {FESTIVAL_STALLS} from '../festival-plan.js';
import {inventory,assetGroups,getAsset} from '../../catalog/library/index.js';

export function expansionModels(town,catalog){
 const districts=new Set(town.districts.map(d=>d.id));
 const rows=manifest.filter(p=>districts.has(p.district));
 const fair=town.regions.find(r=>r.id==='fair');
 if(fair)for(const {asset,position,scale,elevation} of FESTIVAL_STALLS){
  const model=getAsset('fairground/'+asset);
  rows.push({asset:model.id,district:'fair',pos:position.map((v,i)=>v+fair.offset[i]),
   scale,rot:0,size:model.geometry.size.map(v=>v*scale),elevation,path:model.path});
 }
 // Woodland scatter belongs to the seed's compiler, never the reference capture.
 rows.push(...seedModelPlacements(town,catalog));
 return rows.map(p=>({...p,id:modelPlacementId(p.district,p.asset,p.pos,p.scale,p.rot,p.ordinal)}));
}
const canonicalByPath=new Map(inventory.assets.map(a=>[a.path,a.id]));
export function canonicalAsset(asset,catalog,path){
 if(inventory.assets.some(a=>a.id===asset))return asset;
 const source=path||catalog.get(asset)?.path;
 if(!source)return null;
 const file=source.split('/').at(-1).replace(/\.glb$/,'');
 const pack=source.includes('astra-outskirts')||source.includes('/nature/')||asset.startsWith('nat-')?'nature':asset.startsWith('farm-')?'farm':asset.startsWith('cv-')||asset.startsWith('townsfolk-')?'cozy-village':null;
 return canonicalByPath.get(source)||inventory.assets.find(a=>a.name===file&&(!pack||a.pack===pack))?.id||null;
}
export function addExpansionModels(town,catalog){
 town.modelPlacements=expansionModels(town,catalog);
 for(const p of town.modelPlacements){
  const activity=/bench|chair/.test(p.asset)?'sit':/table/.test(p.asset)?'picnic':/stall|crate|sign/.test(p.asset)?'browse':'work';
  const canonical=canonicalAsset(p.asset,catalog,p.path),model=inventory.assets.find(a=>a.id===canonical),seats=model?assetInteractionPoints(p,catalog,model):[];
  town.registry.places.push({...p,type:/tree|birch|willow/.test(p.asset)?'vegetation':/deer|duck/.test(p.asset)?'animal':'prop',kind:'prop',name:`${p.asset.split('/').at(-1).replace(/^(cv|nat|farm)-/,'').replaceAll(/[-_]/g,' ')} · ${p.district} (${p.id.split(':').at(-1)})`,owner:p.district,occupants:[],hours:[0,24],capabilities:[],node:null,entryPoints:[],interactionPoints:seats,canonicalAsset:canonical,activity:{enabled:false,activity,animation:activity==='sit'?'sit':activity==='picnic'?'eat':activity==='work'?'work':'idle',slots:seats,reason:'Scenery or equipment: no authored pedestrian access'}});
 }
 // Size/type and canonical library link are part of every model's place record.
 for(const p of town.registry.places.filter(p=>p.asset)){
  p.canonicalAsset??=canonicalAsset(p.asset,catalog,p.path);
  const metadata=inventory.assets.find(a=>a.id===p.canonicalAsset);
  if(metadata)p.assetMetadata={type:metadata.category,groups:assetGroups(metadata),animation:metadata.animation,interactionTemplates:metadata.interactions};
  if(!p.size){const b=catalog.get(p.asset)?.bounds,a=inventory.assets.find(a=>a.id===p.asset);p.size=b?[0,1,2].map(k=>(b.max[k]-b.min[k])*(p.scale||1)):a?.geometry.size;}
 }
}

// Restricted attractions resolve at their authored public viewing point. The
// model position remains inspectable, but walking never enters an active apron.
export function addDistrictLandmarks(town,landmarks){
 const publicEntries={starbase:'starbase-garden',roadster:'roadster-arena',airport:'airport-terminal',themepark:'pinecrest','coral-coast':'coast-beach',outskirts:'outskirts-trailhead'};
 for(const p of landmarks){
  if(town.registry.places.some(q=>q.id===p.id||q.name===p.name))continue;
  const entry=town.registry.places.find(q=>q.id===publicEntries[p.district]);if(!entry)throw Error('No public access for '+p.name);
  town.registry.places.push({...p,type:'landmark',kind:'landmark',owner:p.district,occupants:[],hours:[0,24],capabilities:['walkTo','visit'],node:entry.node,entryPoints:structuredClone(entry.entryPoints),interactionPoints:[],accessPolicy:'public-viewpoint',viewpoint:entry.id,activity:{enabled:false,activity:'browse',animation:'idle',slots:[],reason:'Observe from the registered public viewpoint; equipment is restricted'}});
 }
 const aliases={village:'market',neighbourhood:'willowbank',campus:'common',stadium:'football',civic:'civic-green',beach:'coast-beach',strip:'coral-coast',coast:'coral-coast',lake:'outskirts-dock',campground:'outskirts-tent-1',woods:'outskirts-lookout',farmland:'outskirts-farm','shell-cove':'harbor-beach',pier:'harbor-pier',launch:'starship-pad',recovery:'LZ-1',offshore:'drone-ship',starfactory:'STARFACTORY',parkcoasters:'pinecrest',mountainpass:'themepark'};
 const labels={'The whole world':'market','Downtown':'downtown','Thistlebrook High':'common','Stillwater countryside':'outskirts','Stillwater Lake':'outskirts-dock','Farms & orchards':'outskirts-farm','Switchyard Skate & Bike':'skatepark','Coral Beach':'coast-beach','Ocean Drive':'coral-coast','Municipal Airport':'airport-terminal','Mountain Pass':'themepark','Pinecrest coasters':'pinecrest','Launch tower':'starship-pad','Landing zones':'LZ-1','Offshore recovery':'drone-ship'};
 for(const [alias,id]of Object.entries({...aliases,...labels})){const p=town.registry.places.find(p=>p.id===id);if(p)p.aliases=[...(p.aliases||[]),alias];}
}
