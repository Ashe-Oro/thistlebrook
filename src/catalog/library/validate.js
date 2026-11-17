// Schema validation is deliberately independent of Three.js and disk access.
export function validateLibrary(inventory,sceneData,semantics){
 const errors=[],ids=new Set(),paths=new Set(),groups=new Set(sceneData.groups.map(g=>g.id));
 const finite=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
 const error=(id,message)=>errors.push(`${id}: ${message}`);
 for(const a of inventory.assets){
  if(ids.has(a.id)||paths.has(a.path))error(a.id,'duplicate identity');ids.add(a.id);paths.add(a.path);
  if(!a.path.startsWith(a.pack+'/')||a.path.includes('..')||!a.path.endsWith('.glb'))error(a.id,'unsafe source path');
  if(!a.category||!a.tags?.length||!a.groups?.length||a.groups.some(g=>!groups.has(g)))error(a.id,'missing semantics');
  if(!/^[a-f0-9]{64}$/.test(a.sha256))error(a.id,'invalid content hash');
  if(!finite(a.placement.origin,3)||!(a.placement.scale>0))error(a.id,'invalid normalization');
  const b=a.geometry.bounds;
  if(!finite(b.min,3)||!finite(b.max,3)||b.min.some((v,k)=>v>b.max[k]))error(a.id,'invalid measured bounds');
  if(!finite(a.geometry.size,3)||a.geometry.size.some(v=>v<0)||a.geometry.size.every(v=>v===0))error(a.id,'empty geometry');
  if(a.geometry.footprint.length<3||a.geometry.footprint.some(p=>!finite(p,2)))error(a.id,'invalid footprint');
  if(a.kind!=='individual'&&a.placement.spawnable)error(a.id,'reference is spawnable');
  if(a.animation.skinned&&a.geometry.pose!=='bind-pose')error(a.id,'missing skin measurement caveat');
  const slots=new Set();
  for(const s of a.interactions){
   if(slots.has(s.id))error(a.id,'duplicate slot');slots.add(s.id);
   if(!semantics.activityProfiles[s.activity]||!finite(s.position,3)||!finite(s.approach,3)||!Number.isFinite(s.facing)||s.capacity!==1||s.clearance<=0)error(a.id,'invalid activity slot');
   if(s.enabled&&s.provenance==='bounds-inferred')error(a.id,'unreviewed active slot');
  }
 }
 for(const a of inventory.assets)if(a.canonical&&!ids.has(a.canonical))error(a.id,'missing canonical model');
 for(const a of inventory.aliases)if(!ids.has(a.canonical)||paths.has(a.path))error(a.path,'invalid format alias');
 for(const g of sceneData.groups)if(g.companions.some(c=>!groups.has(c)))error(g.id,'missing companion group');
 for(const r of sceneData.recipes){if(!groups.has(r.group))error(r.id,'unknown recipe group');for(const m of r.members)if(m.asset&&!ids.has(m.asset))error(r.id,'unknown member '+m.asset);}
 if(inventory.counts.glb!==inventory.assets.length||inventory.counts.alternateFormats!==inventory.aliases.length)errors.push('Count mismatch');
 return errors;
}
