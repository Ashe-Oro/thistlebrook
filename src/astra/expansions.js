import {buildStarbase} from './starbase.js';
import {buildCoast} from './coast.js';
import {buildThemePark} from './themepark.js';
import {tagAssembly} from './registry/render-tags.js';
import {buildSkatepark} from './skatepark.js';
import {buildAirport} from './airport/index.js';
import {buildOutskirts} from './outskirts.js';
import * as THREE from 'three';
import {move,moveRecord,WORLD_OFFSETS} from '../compiler/world-plan.js';
import {buildFairground} from './fairground.js';
import {buildHarbor} from './harbor.js';
import {buildFairLot} from './fair-lot.js';
export async function buildInFrame(builder,scene,town,id,offset=WORLD_OFFSETS[id]||[0,0]){
 const inverse=offset.map(v=>-v),root=new THREE.Group();root.name=id;root.position.set(offset[0],0,offset[1]);scene.add(root);
 const local={...town,registryOffset:offset,renderedModels:town.renderedModels??(town.renderedModels=[]),nodes:town.nodes.map(p=>move(p,inverse)),roads:town.roads.map(r=>({...r,a:move(r.a,inverse),b:move(r.b,inverse)}))};
 for(const key of ['buildings','venues','trees','props','districts'])local[key]=town[key].map(p=>moveRecord(p,inverse));
 local[id]=town.expansionLocal[id]||town[id];
 const result=await builder(root,local);root.updateMatrixWorld(true);const registryId=town.districts.find(d=>d.id===id)?.registryId;tagAssembly(root,registryId);
 for(const record of result.selectables||result.venueRecords||[]){record.bounds.translate(root.position);record.data={...record.data,district:id};}
 return {...result,root};
}
export async function buildExpansions(scene,town){
 const harbor=await buildInFrame(buildHarbor,scene,town,'harbor');
 const fair=await buildInFrame(buildFairground,scene,town,'fair');
 const outskirts=await buildInFrame(buildOutskirts,scene,town,'outskirts');
 const airport=await buildInFrame(buildAirport,scene,town,'airport');
 const skatepark=await buildInFrame(buildSkatepark,scene,town,'skatepark');
 const themepark=await buildInFrame(buildThemePark,scene,town,'themepark');
 const fairlot=await buildFairLot(scene,town);
 const coast=await buildInFrame(buildCoast,scene,town,'coral-coast');
 const starbase=await buildInFrame(buildStarbase,scene,town,'starbase');
 return {harbor,fair,outskirts,airport,skatepark,themepark,fairlot,coast,starbase,get people(){return [...harbor.life.people,...outskirts.life.people];},selectables:[...outskirts.selectables,...themepark.selectables,...fairlot.selectables,...coast.selectables,...starbase.selectables],update(t,hour,night,day,people=[]){harbor.update(t,hour,night);fairlot.update(t,hour,night,people);fair.update(t,hour,night,day);outskirts.update(t,night,hour);airport.update(t,night);skatepark.update(t,hour,night);themepark.update(t,night);coast.update(t,night,hour);starbase.update(t,night,hour);starbase.selectables.find(r=>r.data.id==='drone-ship').bounds.translate(starbase.root.position);},audit(){return {harbor:harbor.audit(),fair:fair.audit(),outskirts:outskirts.audit(),airport:airport.audit(),skatepark:skatepark.audit(),themepark:themepark.audit(),fairlot:fairlot.audit(),coast:coast.audit(),starbase:starbase.audit()};}};
}
