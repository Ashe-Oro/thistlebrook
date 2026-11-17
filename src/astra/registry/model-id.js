// Content-derived identities survive loader completion order and draw batching.
export function modelPlacementId(district,asset,pos,scale,rot,ordinal){
 const key=[asset,...pos,scale,rot,...(ordinal===undefined?[]:[ordinal])].map(v=>typeof v==='number'?v.toFixed(4):v).join('|');
 let hash=2166136261;for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return `model:${district}:${(hash>>>0).toString(16)}`;
}
