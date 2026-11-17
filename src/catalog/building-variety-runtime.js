import * as THREE from 'three';
import { RESOLVED, instantiate } from './loader.js';
import { resolveEntry } from './schema.js';
import { TOWNSFOLK_VARIANTS } from './townsfolk-variants.js';
import BOUNDS from './building-variety-bounds.json';
import { rectForInst } from '../compiler/compile.js';
import { obbFromRect, obbOverlap } from '../compiler/geometry.js';

// Reuse owned, measured catalog meshes instead of widening placement pools.
export const HOUSE_LOOKS=['farm-farmhand-cottage','aut-farm-cottage','farm-farmhouse','cv-home-townhouse'];
export const EXTRA_PROPS=['aut-cider-press-shed','aut-autumn-garden-shed','aut-harvest-pavilion','aut-autumn-root-cellar','aut-bushel-basket','aut-apple-crate','aut-cornucopia','aut-garden-cart','aut-mums-in-pot','aut-orchard-signpost','aut-farm-stand-sign','aut-harvest-lantern'];
const at=i=>({x:i.pos[0],z:i.pos[1],rotY:i.rotY||0});

export async function applyBuildingVariety(){
 const scene=window.__scene,town=window.__town;
 const evidence={ready:false,houses:[],civic:[],props:[],villagers:[],error:null};window.__variety=evidence;
 if(!scene||!town)throw Error('Variety requires the compiled town page');
 // Hold onto each original pivot: life movement, labels, entry nodes and doors
 // continue to reference the same objects and original compiled instances.
 const roots=[];scene.traverse(o=>{if(o.userData.inst&&o.userData.entry)roots.push(o);});
 let index=0;
 for(const root of roots.filter(o=>o.userData.inst.kind==='house'&&o.userData.inst.district==='residential')){
  const id=HOUSE_LOOKS[index++%HOUSE_LOOKS.length],replacement=await instantiate(id),old=root.userData.entry,next=RESOLVED.get(id);
  // Stay within the original architecture envelope; align front step and floor.
  const size=e=>e.bounds.max.map((v,k)=>v-e.bounds.min[k]);const a=size(old),b=size(next);
  const scale=Math.min(a[0]/b[0],a[2]/b[2],1);
  replacement.scale.setScalar(scale);
  replacement.position.set(0,old.bounds.min[1]-next.bounds.min[1]*scale,old.bounds.max[2]-next.bounds.max[2]*scale);
  root.clear();root.add(replacement);
  evidence.houses.push({lot:root.userData.inst.lot,original:root.userData.inst.id,appearance:id,scale,pos:root.position.toArray()});
 }
 // A restrained warm/cool palette variation on civic roofs and plaster.
 for(const root of roots.filter(o=>o.userData.inst.kind==='landmark')){
  const tint=new THREE.Color(['#e9c8a1','#bdd7cd','#d4c5dd'][evidence.civic.length%3]);
  root.traverse(o=>{if(!o.isMesh||o.userData.outline)return;o.material=o.material.clone();o.material.color.multiply(tint);});
  evidence.civic.push(root.userData.inst.id);
 }
 // Deliberate farmyard / residential dressing, collision checked against the
 // frozen town (including paths), then against each accepted extra object.
 const occupied=town.instances.filter(i=>RESOLVED.has(i.id)&&i.kind!=='villager').map(i=>obbFromRect(rectForInst(i,RESOLVED),at(i),i.scale||1));
 const placeExtra=async(id,x,z)=>{
  const e=RESOLVED.get(id),inst={id,pos:[x,z],rotY:0,scale:1};
  const box=obbFromRect({min:[e.bounds.min[0]-.4,e.bounds.min[2]-.4],max:[e.bounds.max[0]+.4,e.bounds.max[2]+.4]},at(inst));
  if(town.area.shape==='circle'&&Math.hypot(Math.abs(x)+Math.max(Math.abs(e.bounds.min[0]),Math.abs(e.bounds.max[0])),Math.abs(z)+Math.max(Math.abs(e.bounds.min[2]),Math.abs(e.bounds.max[2])))>town.area.radius-1)return false;
  if(occupied.some(b=>obbOverlap(box,b,.2)))return false;
  const obj=await instantiate(id);obj.position.set(x,-e.bounds.min[1]+.025,z);obj.userData.varietyProp=id;scene.add(obj);occupied.push(box);
  evidence.props.push({id,pos:obj.position.toArray()});return true;
 };
 if(town.instances.some(i=>i.district==='farm'))for(const id of EXTRA_PROPS){
  let placed=false;
  for(let z=-38;z<=25&&!placed;z+=5)for(let x=76;x<=101&&!placed;x+=5)placed=await placeExtra(id,x,z);
 }
 for(const v of TOWNSFOLK_VARIANTS){
  const root=roots.find(o=>o.userData.inst.id===v.id);if(!root)continue;
  const entry={id:v.variantId,name:v.id+' · variety',source:'mesh',path:v.path,license:'tja-commercial',scale:1,groundY:.15,eaveY:null,door:null,tags:{category:'prop',style:['cozy-townsfolk','villager','building-variety']}};
  RESOLVED.set(v.variantId,resolveEntry(entry,BOUNDS[v.variantId]));
  const replacement=await instantiate(v.variantId);
  replacement.position.y=root.userData.entry.bounds.min[1]-RESOLVED.get(v.variantId).bounds.min[1];
  root.clear();root.add(replacement);evidence.villagers.push({id:v.id,appearance:v.variantId,path:v.path});
 }
 window.__post?.setHullVisible(window.__post.options.hull);
 evidence.ready=true;
}
