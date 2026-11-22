import {buildStarbase} from './starbase.js';
import {buildCoast} from './coast.js';
import {buildThemePark} from './themepark.js';
import {tagAssembly} from './registry/render-tags.js';
import {buildSkatepark} from './skatepark.js';
import {buildAirport} from './airport/index.js';
import {buildOutskirts,buildStillwaterSurface} from './outskirts.js';
import * as THREE from 'three';
import {move,moveRecord,WORLD_OFFSETS} from '../compiler/world-plan.js';
import {buildFairground} from './fairground.js';
import {districtPlaceholder} from './district-placeholder.js';
import {buildHarbor} from './harbor.js';
import {buildFairLot} from './fair-lot.js';
import {PARK_ORIGIN,PARK_NODES,RIDES} from './themepark-plan.js';
export async function buildInFrame(builder,scene,town,id,offset=WORLD_OFFSETS[id]||[0,0]){
 const inverse=offset.map(v=>-v),root=new THREE.Group();root.name=id;root.position.set(offset[0],0,offset[1]);scene.add(root);
 const local={...town,registryOffset:offset,renderedModels:town.renderedModels??(town.renderedModels=[]),nodes:town.nodes.map(p=>move(p,inverse)),roads:town.roads.map(r=>({...r,a:move(r.a,inverse),b:move(r.b,inverse)}))};
 for(const key of ['buildings','venues','trees','props','districts'])local[key]=town[key].map(p=>moveRecord(p,inverse));
 local[id]=town.expansionLocal[id]||town[id];
 const result=await builder(root,local);root.updateMatrixWorld(true);const registryId=town.districts.find(d=>d.id===id)?.registryId;tagAssembly(root,registryId);
 for(const record of result.selectables||result.venueRecords||[]){record.bounds.translate(root.position);record.data={...record.data,district:id};}
 return {...result,root};
}
export async function buildExpansions(scene,town,{hy3dModels,stream,isOpening,onDistrict,detail}={}){
 const districts={};
 let cameraVolume,sun;
 // The crowds use instancing, so each district can skip their render buffers
 // together while their simulations continue. Leave room for cast shadows.
 const parkPoints=[...Object.values(PARK_NODES),...RIDES.flatMap(({x,z,w,d})=>[[x-w/2,z-d/2],[x+w/2,z+d/2]])];
 const worldPark=parkPoints.map(([x,z])=>[x+PARK_ORIGIN[0],z+PARK_ORIGIN[1]]);
 const park={minX:Math.min(...worldPark.map(p=>p[0])),maxX:Math.max(...worldPark.map(p=>p[0])),
  minZ:Math.min(...worldPark.map(p=>p[1])),maxZ:Math.max(...worldPark.map(p=>p[1]))};
 const coastal=town.regions.find(region=>region.id==='coral-coast')?.bounds;
 const crowdVolume=(b,height)=>b&&new THREE.Box3(new THREE.Vector3(b.minX-4,-4,b.minZ-4),
  new THREE.Vector3(b.maxX+4,height,b.maxZ+4));
 const parkCrowd=crowdVolume(park,Math.max(...RIDES.map(r=>r.h))+4);
 const coastalCrowd=crowdVolume(coastal,34);
 const sweptBounds=new THREE.Box3(),lightRay=new THREE.Vector3();
 function nearCrowd(bounds){
  if(!cameraVolume||!bounds)return true;
  sweptBounds.copy(bounds);
  if(sun){
   lightRay.subVectors(sun.target.position,sun.position);
   const reach=(bounds.max.y-bounds.min.y)/Math.max(1,-lightRay.y);
   sweptBounds.min.x+=Math.min(0,lightRay.x*reach);
   sweptBounds.max.x+=Math.max(0,lightRay.x*reach);
   sweptBounds.min.z+=Math.min(0,lightRay.z*reach);
   sweptBounds.max.z+=Math.max(0,lightRay.z*reach);
  }
  return cameraVolume.intersectsBox(sweptBounds);
 }
 if(stream){
  const surface=buildStillwaterSurface(new THREE.Group());
  tagAssembly(surface,town.districts.find(d=>d.id==='outskirts').registryId);
  scene.add(surface);
 }
 const outskirtsBounds={minX:-75,maxX:63,minZ:38,maxZ:123};
 const builders=[
  ['harbor',buildHarbor],['fair',buildFairground],['outskirts',(root,local)=>buildOutskirts(root,local,{detail})],['airport',buildAirport],
  ['skatepark',buildSkatepark],['themepark',(root,local)=>buildThemePark(root,local,{detail})],['coral-coast',buildCoast],
  ['starbase',async (root,local)=>buildStarbase(root,local,{hy3d:await hy3dModels})],
 ];
 for(const [id,builder] of builders){
  const bounds=id==='outskirts'?outskirtsBounds:town.regions.find(region=>region.id===id)?.bounds;
  if(stream&&bounds){
   const placeholder=districtPlaceholder(town,id,scene,bounds);
   stream.add(id,bounds,{
    opening:isOpening(bounds),
    load:()=>buildInFrame(builder,new THREE.Group(),town,id),
    attach(result){
     scene.add(result.root);
     placeholder.removeFromParent();
     districts[id]=result;
     onDistrict?.(result);
    },
   });
  }else districts[id]=await buildInFrame(builder,scene,town,id);
 }
 const fairlot=await buildFairLot(scene,town);
 return {
  get harbor(){return districts.harbor;},get fair(){return districts.fair;},get outskirts(){return districts.outskirts;},
  get airport(){return districts.airport;},get skatepark(){return districts.skatepark;},get themepark(){return districts.themepark;},
  get coast(){return districts['coral-coast'];},get starbase(){return districts.starbase;},fairlot,
  get people(){return [...(districts.harbor?.life.people||[]),...(districts.outskirts?.life.people||[])];},
  get selectables(){return [...Object.values(districts).flatMap(d=>d.selectables||[]),...fairlot.selectables];},
   setViewVolume(view,keyLight){cameraVolume=view;sun=keyLight;},
  update(t,hour,night,day,people=[],weather){
   const {harbor,fair,outskirts,airport,skatepark,themepark,'coral-coast':coast,starbase}=districts;
   harbor?.update(t,hour,night);fairlot.update(t,hour,night,people,cameraVolume);fair?.update(t,hour,night,day,weather);
   outskirts?.update(t,night,hour);airport?.update(t,night);skatepark?.update(t,hour,night);
   themepark?.update(t,night,hour,nearCrowd(parkCrowd));coast?.update(t,night,hour,weather,nearCrowd(coastalCrowd));
   if(starbase){starbase.update(t,night,hour);starbase.selectables.find(r=>r.data.id==='drone-ship').bounds.translate(starbase.root.position);}
  },
  audit(){return Object.fromEntries([...builders.map(([id])=>[id==='coral-coast'?'coast':id,districts[id]?.audit()]),['fairlot',fairlot.audit()]]);}
 };
}
