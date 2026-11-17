import inventory from './assets.json' with {type:'json'};
import sceneData from './scenes.json' with {type:'json'};
import semantics from './semantics.json' with {type:'json'};
export { inventory, sceneData, semantics };
export const library=new Map(inventory.assets.map(a=>[a.id,a]));
export function getAsset(id){const a=library.get(id);if(!a)throw Error(`Unknown owned asset: ${id}`);return a;}
// Explicit recipes also declare family membership, so new district groups stay
// selectable without rewriting the measured geometry inventory.
export function assetGroups(asset){return [...new Set([...asset.groups,...sceneData.recipes.filter(r=>r.members.some(m=>m.asset===asset.id)).map(r=>r.group)])];}
export function groupAssets(id){return inventory.assets.filter(a=>assetGroups(a).includes(id));}
// Source footprint is retained for tighter polygon solvers; this compiler uses
// its conservative bounding box so overhanging roofs and canopies stay clear.
export function assetBox(asset,position=[0,0],yaw=0){
 const [w,,d]=asset.geometry.size,c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw)),x=(w*c+d*s)/2,z=(w*s+d*c)/2;
 return {min:[position[0]-x,position[1]-z],max:[position[0]+x,position[1]+z]};
}
export function transformPoint(p,position,yaw=0){return [position[0]+p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),p[1],position[1]-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw)];}
export const overlap=(a,b,pad=0)=>a.min[0]<b.max[0]+pad&&a.max[0]>b.min[0]-pad&&a.min[1]<b.max[1]+pad&&a.max[1]>b.min[1]-pad;
export const edgeGap=(a,b)=>Math.hypot(Math.max(0,a.min[0]-b.max[0],b.min[0]-a.max[0]),Math.max(0,a.min[1]-b.max[1],b.min[1]-a.max[1]));
export function pairRule(a,b,rules=sceneData.rules){return rules.pairGaps.find(r=>r.categories.includes(a.category)&&r.categories.includes(b.category)&& (a.category!==b.category||r.categories[0]===r.categories[1]));}
