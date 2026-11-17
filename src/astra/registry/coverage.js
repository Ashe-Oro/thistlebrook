import {inventory} from '../../catalog/library/index.js';
import {canonicalAsset} from './expansion-placements.js';

/** Logical placements, not mesh pieces. Actors/effects/reference packs are separate. */
export function registryCoverage(town,catalog){
 const places=new Map(town.registry.places.map(p=>[p.id,p]));
 const models=[...town.buildings.filter(p=>!p.custom),...town.props,...town.trees,...town.supplemental,...town.catalogScenes.flatMap(s=>s.members),...(town.landscape?.models||[])].map(p=>({id:p.registryId,asset:p.asset||p.id})).concat(town.modelPlacements||[]);
 const physical=[...models,...(town.districtFurniture||[]),...town.procedural.map(p=>({id:p.registryId})),...(town.landscape?.hills||[]).map(p=>({id:p.registryId}))];
 const missing=physical.filter(p=>!places.has(p.id)).map(p=>p.id);
 const used=new Set(models.map(p=>places.get(p.id)?.canonicalAsset||canonicalAsset(p.asset,catalog)).filter(Boolean));
 const unused=inventory.assets.filter(a=>!used.has(a.id)).map(a=>({id:a.id,kind:a.kind,category:a.category,groups:a.groups}));
 const perPack=[...new Set(inventory.assets.map(a=>a.pack))].sort().map(pack=>{
  const individuals=inventory.assets.filter(a=>a.pack===pack&&a.kind==='individual');
  const usedIndividuals=individuals.filter(a=>used.has(a.id)).length;
  return {pack,individualModels:individuals.length,usedIndividuals,unusedIndividuals:individuals.length-usedIndividuals};
 });
 const perDistrict=town.districts.map(d=>{
  const rows=models.filter(p=>places.get(p.id)?.district===d.id),entries=town.registry.places.filter(p=>p.district===d.id);
  return {district:d.id,placedModels:rows.length,registeredModels:rows.filter(p=>places.has(p.id)).length,places:entries.length,executableActivities:entries.filter(p=>p.interaction).length,slots:entries.reduce((n,p)=>n+(p.interaction?.slots.length||0),0)};
 });
 return {seed:town.seed,districts:town.districts.length,places:places.size,placedModels:models.length,registeredModels:models.filter(p=>places.has(p.id)).length,logicalPlacements:physical.length,registeredLogicalPlacements:physical.length-missing.length,missing,ownedModels:inventory.assets.length,ownedIndividualModels:inventory.assets.filter(a=>a.kind==='individual').length,usedOwnedModels:used.size,unusedIndividualModels:unused.filter(a=>a.kind==='individual').length,unusedOwnedModels:unused.length,perPack,perDistrict,unused};
}
