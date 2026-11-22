/** Attach a logical asset ID before batching; preserve the ID of every instance.
 * Component geometry inherits its assembly's metadata rather than becoming a shop.
 */
export function tagObject(object,id){
 object.traverse(o=>{o.userData.registryId=id;});return object;
}
export function tagComponents(root,town,source){
 const known=new Set(town.registry.places.map(p=>p.id));
 root.traverse(o=>{
  if(o.userData.registryExempt||!o.isMesh&&!o.isLine)return;
  const ids=o.userData.registryIds||[o.userData.registryId];
  if(!ids?.length||ids.some(id=>!known.has(id)))throw Error(`Missing registry metadata in ${source}: ${o.name||o.type}`);
  o.userData.registrySource=source;
 });
}
export function tagBatch(batch,ids){
 if(ids.length!==batch.instanceMatrix.count||ids.some(id=>!id))throw Error('Missing per-instance registry metadata');
 batch.userData.registryIds=[...ids];
}
export function renderCoverage(scene,town,{complete=false}={}){
 const known=new Set(town.registry.places.map(p=>p.id)),errors=[],seen=new Set();
 scene.traverse(o=>{
  if(o.userData.registryExempt||!o.isMesh&&!o.isLine)return;
  for(const id of o.userData.registryIds||[o.userData.registryId])seen.add(id);
  if(o.isInstancedMesh){if(o.userData.registryIds?.length!==o.instanceMatrix.count||o.userData.registryIds.some(id=>!known.has(id)))errors.push(`Unregistered instances: ${o.name||o.type}`);}
  else if(o.userData.registryIds ? !o.userData.registryIds.length||o.userData.registryIds.some(id=>!known.has(id)) : !known.has(o.userData.registryId))errors.push(`Unregistered geometry: ${o.name||o.type}`);
 });
 for(const p of [...(town.modelPlacements||[]),...(town.districtFurniture||[])])if(!seen.has(p.id))errors.push(`Placement has no rendered metadata: ${p.id}`);
 if(complete)for(const p of [...town.buildings,...town.props,...town.trees,...town.supplemental,...(town.landscape?.models||[]),...(town.landscape?.hills||[]),...town.catalogScenes.flatMap(s=>s.members),...town.procedural.filter(p=>p.rendering!=='reservation')])if(!seen.has(p.registryId))errors.push(`Placement has no rendered metadata: ${p.registryId}`);
 return errors;
}

// Explicit module ownership for newer district assemblies. Never infer identity
// from proximity: existing per-model/per-instance identities are preserved.
export function tagAssembly(root,id){
 if(!id)throw Error('An assembly needs a registered owner');
 root.traverse(o=>{
  if(o.userData.registryExempt)return;
  if(o.isInstancedMesh)tagBatch(o,Array.from({length:o.instanceMatrix.count},(_,i)=>o.userData.registryIds?.[i]||id));
  else if(o.userData.registryIds)o.userData.registryIds=[...new Set(o.userData.registryIds.map(value=>value||id))];
  else if((o.isMesh||o.isLine)&&!o.userData.registryId)o.userData.registryId=id;
 });
 return root;
}
export async function buildAssembly(builder,scene,town,id){
 const before=new Set(scene.children),result=await builder(scene,town);
 for(const child of scene.children)if(!before.has(child))tagAssembly(child,id);
 return result;
}
