import {PARKING_BAYS} from '../astra/traffic-simulation.js';
import { pointInTown, riverZ } from './astra.js';
import { getAsset, groupAssets, sceneData, assetBox, transformPoint, overlap, edgeGap, pairRule } from '../catalog/library/index.js';
export function compileScene(recipeOrId,center=[0,0],yaw=0,instanceId){
 const recipe=typeof recipeOrId==='string'?sceneData.recipes.find(r=>r.id===recipeOrId):recipeOrId;
 if(!recipe)throw Error('Unknown scene recipe');
 const id=instanceId||recipe.id,members=[];
 for(const spec of recipe.members){
  const asset=getAsset(spec.asset);
  if(!asset.placement.spawnable||asset.kind!=='individual'||asset.placement.mount!=='ground')throw Error(`Not a prop candidate: ${asset.id}`);
  if(sceneData.rules.forbiddenSurfaces[asset.category]?.includes(recipe.surface))throw Error(`Wrong surface: ${asset.id}`);
  const previous=spec.beside&&members.find(m=>m.key===spec.beside);
  if(spec.beside&&!previous)throw Error(`Missing predecessor: ${spec.beside}`);
  const rule=previous&&pairRule(getAsset(previous.asset),asset);
  if(previous&&(spec.gap<(rule?.min??sceneData.rules.minGap)||spec.gap>(rule?.max??Infinity)))throw Error(`Invalid companion gap: ${spec.key}`);
  const x=previous?previous.pos[0]+(getAsset(previous.asset).geometry.size[0]+asset.geometry.size[0])/2+spec.gap:0;
  members.push({key:spec.key,asset:asset.id,pos:[x,0],rot:0});
 }
 const left=Math.min(...members.map(m=>m.pos[0]-getAsset(m.asset).geometry.size[0]/2)),right=Math.max(...members.map(m=>m.pos[0]+getAsset(m.asset).geometry.size[0]/2));
 const maxDepth=Math.max(...members.map(m=>getAsset(m.asset).geometry.size[2]));
 // All fronts align to one aisle. The whole row may rotate, including slots.
 const aisleZ=maxDepth/2+sceneData.rules.frontAisle;
 for(const member of members){
  const asset=getAsset(member.asset),local=[member.pos[0]-(left+right)/2,0,(maxDepth-asset.geometry.size[2])/2];
  const p=transformPoint(local,center,yaw);member.pos=[p[0],p[2]];member.rot=yaw;member.box=assetBox(asset,member.pos,yaw);
  const spec=recipe.members.find(s=>s.key===member.key);
  if(spec.activity&&!['browse','sort'].includes(spec.activity))throw Error(`Unsupported exterior task: ${spec.activity}`);
  // Recipe-authored exterior tasks stand outside the full measured envelope.
  // These never promote an inferred seat, doorway or vehicle boarding pose.
  const templates=spec.activity?[{id:'front',activity:spec.activity,label:spec.label,position:[0,0,asset.geometry.size[2]/2+.7],approach:[0,0,asset.geometry.size[2]/2+1.2],facing:Math.PI,clearance:.38,capacity:1,enabled:true,provenance:'recipe-authored-exterior'}]:asset.interactions.filter(s=>s.enabled);
  member.interactions=templates.map(slot=>{
   const position=transformPoint(slot.position,member.pos,yaw),approach=transformPoint(slot.approach,member.pos,yaw);
   const landing=transformPoint([local[0]+slot.approach[0],0,aisleZ],center,yaw);
   return {...slot,id:`${id}/${member.key}/${slot.id}`,asset:asset.id,scene:id,position,approach,landing:[landing[0],landing[2]],facing:slot.facing+yaw};
  });
 }
 const corners=[[-(right-left)/2-.6,0,-maxDepth/2-.6],[(right-left)/2+.6,0,aisleZ+.6]].flatMap((p,i,arr)=>i===0?[p,[arr[1][0],0,p[2]]]:[p,[arr[0][0],0,p[2]]]).map(p=>transformPoint(p,center,yaw));
 const box={min:[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[2]))],max:[Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[2]))]};
 const ends=[-(right-left)/2,(right-left)/2].map(x=>transformPoint([x,0,aisleZ],center,yaw)).map(p=>[p[0],p[2]]);
 const result={id,name:recipe.name,recipe:recipe.id,group:recipe.group,center,yaw,box,members,aisle:ends,slots:members.flatMap(m=>m.interactions)};
 const errors=checkScene(result);if(errors.length)throw Error(errors.join('; '));return result;
}
export function checkScene(scene){
 const errors=[];
 for(let i=0;i<scene.members.length;i++)for(let j=i+1;j<scene.members.length;j++){
  const a=scene.members[i],b=scene.members[j],rule=pairRule(getAsset(a.asset),getAsset(b.asset));
  if(overlap(a.box,b.box)||edgeGap(a.box,b.box)+1e-6<(rule?.min??sceneData.rules.minGap))errors.push(`Scene clearance: ${a.key}/${b.key}`);
 }
 for(const slot of scene.slots){
  const p=slot.approach,area={min:[p[0]-slot.clearance,p[2]-slot.clearance],max:[p[0]+slot.clearance,p[2]+slot.clearance]};
  if(scene.members.some(m=>overlap(area,m.box)))errors.push(`Blocked interaction: ${slot.id}`);
 }
 return errors;
}
export function compileTownScenes(town){
 const scenes=sceneData.townScenes.map(s=>({...compileScene(s.recipe,s.center,s.entrySide==='north'?Math.PI:0,s.id),district:s.district,street:s.street}));
 // Every district receives a measured rest garden. Candidate fronts follow a
 // real street; both the parcel and the full approach must clear existing lots.
 const regions={willowbank:[-34,-34,34,13],market:[-11,-13,11,11],common:[-40,-104,62,-34],downtown:[-78,-32,-36,12],'civic-green':[-104,-103,-43,-33],works:[-118,-174,-40,-104],sunbeam:[-146,-72,-106,-30]};
 const roadBox=(a,b,pad)=>({min:[Math.min(a[0],b[0])-pad,Math.min(a[1],b[1])-pad],max:[Math.max(a[0],b[0])+pad,Math.max(a[1],b[1])+pad]});
 // Parking bays are reserved ground: a rest garden never lays its aisle or seats through a parked car.
 const bays=PARKING_BAYS.map(b=>{const c=Math.abs(Math.cos(b.yaw)),sn=Math.abs(Math.sin(b.yaw)),hx=(b.length*sn+b.width*c)/2+.5,hz=(b.length*c+b.width*sn)/2+.5;return {min:[b.center[0]-hx,b.center[1]-hz],max:[b.center[0]+hx,b.center[1]+hz]};});
 const lots=[...town.buildings,...town.venues].map(p=>p.box).concat(bays);
 // Carriageways as traffic sees them (motor streets south of the footbridges).
 const carriageways=town.roads.filter(r=>!r.owner&&r.kind!=='pedestrian'&&r.width>=2.4&&Math.min(r.a[1],r.b[1])<4.01).map(r=>({...r,a:[r.a[0],Math.min(4,r.a[1])],b:[r.b[0],Math.min(4,r.b[1])]}));
 for(const district of town.districts.filter(d=>regions[d.id])){
  const [x0,z0,x1,z1]=regions[district.id],candidates=[];
  for(const road of town.roads.filter(r=>!r.owner)){
   const dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],length=Math.hypot(dx,dz);if(length<4||dx&&dz)continue;
   for(let d=2;d<length-1;d+=2)for(const side of [-1,1])for(const offset of [2.2,3.8,5.2]){
    const street=[road.a[0]+dx*d/length,road.a[1]+dz*d/length],normal=[dz/length*side,-dx/length*side],center=street.map((v,i)=>v+normal[i]*offset),yaw=Math.atan2(-normal[0],-normal[1]);
    if(center[0]<x0||center[0]>x1||center[1]<z0||center[1]>z1)continue;
    const scene={...compileScene('neighbourhood-rest',center,yaw,'rest-'+district.id),district:district.id,street,name:district.name+' rest garden'};
    const corners=[scene.box.min,scene.box.max,[scene.box.min[0],scene.box.max[1]],[scene.box.max[0],scene.box.min[1]]];
    if(corners.some(p=>!pointInTown(p,town)||Math.abs(p[1]-riverZ(p[0]))<3.4))continue;
    if([...lots,...scenes.map(s=>s.box)].some(b=>overlap(b,scene.box)))continue;
    if(scene.members.some(m=>town.roads.some(r=>overlap(m.box,roadBox(r.a,r.b,r.width/2+.12)))))continue;
    // The aisle and every seat approach are walking space: keep them off the carriageway.
    if(carriageways.some(r=>overlap(roadBox(scene.aisle[0],scene.aisle.at(-1),.45),roadBox(r.a,r.b,r.width/2))||scene.slots.some(sl=>overlap(roadBox([sl.approach[0],sl.approach[2]],[sl.approach[0],sl.approach[2]],.38),roadBox(r.a,r.b,r.width/2)))))continue;
    const entry=scene.aisle.reduce((a,b)=>Math.hypot(a[0]-street[0],a[1]-street[1])<Math.hypot(b[0]-street[0],b[1]-street[1])?a:b),join=[street[0],entry[1]];
    if([[street,join],[join,entry]].some(([a,b])=>[...lots,...scene.members.map(m=>m.box)].some(box=>overlap(box,roadBox(a,b,.45)))))continue;
    candidates.push({scene,score:Math.hypot(center[0]-district.center[0],center[1]-district.center[1])});
   }
  }
  candidates.sort((a,b)=>a.score-b.score);if(!candidates.length)throw Error('No safe catalog rest garden in '+district.id);scenes.push(candidates[0].scene);
 }
 // Southern promenade meets the existing orchard bridge; no new water crossing.
 town.roads.push({a:[-76,20.5],b:[-22,20.5],width:1.1,kind:'lane',owner:'catalog-promenade'});
 for(const scene of scenes){
  const width=sceneData.rules.walkingWidth,owner=`catalog:${scene.id}`;
  // Access the near end of the reserved aisle, keeping travel outside props.
  const entry=scene.aisle.reduce((a,b)=>Math.hypot(a[0]-scene.street[0],a[1]-scene.street[1])<Math.hypot(b[0]-scene.street[0],b[1]-scene.street[1])?a:b);
  const join=[scene.street[0],entry[1]];
  for(const [a,b] of [[scene.street,join],[join,entry],scene.aisle])if(Math.hypot(a[0]-b[0],a[1]-b[1])>.01)town.roads.push({a,b,width,kind:'catalog',owner});
  for(const slot of scene.slots)town.roads.push({a:slot.landing,b:[slot.approach[0],slot.approach[2]],width:.8,kind:'catalog-slot',owner});
 }
 return scenes;
}

// Assemble a small variation from one group's pool and its declared companions.
// Special surfaces (shorelines, tiled roads, interiors and attachment sockets)
// must be supplied explicitly by higher-level planners; never scatter them as props.
export function compileGroupScene(groupId,{seed=1,pack,limit=4,center=[0,0],yaw=0,surface='outdoors'}={}){
 const group=sceneData.groups.find(g=>g.id===groupId);
 if(!group||group.referenceOnly)throw Error(`Not a scene family: ${groupId}`);
 if(group.surface&&group.surface!=='interior')throw Error(`Authored ${group.surface} anchors required: ${groupId}`);
 if(group.surface==='interior'&&surface!=='interior')throw Error(`Interior floor required: ${groupId}`);
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const eligible=a=>a.placement.spawnable&&a.placement.mount==='ground'&&(!pack||a.pack===pack)&&!sceneData.rules.forbiddenSurfaces[a.category]?.includes(surface)&&Math.max(a.geometry.size[0],a.geometry.size[2])+sceneData.rules.frontAisle+1.2<=group.radius*2;
 const own=groupAssets(groupId).filter(eligible),companions=group.companions.flatMap(g=>groupAssets(g).filter(eligible));
 if(!own.length)throw Error(`No grounded candidates: ${groupId}`);
 const choose=pool=>pool[Math.floor(random()*pool.length)],picked=[choose(own)],members=[{key:'anchor',asset:picked[0].id}];
 const pool=[...own,...companions].filter((a,i,arr)=>arr.findIndex(b=>b.id===a.id)===i);
 while(members.length<limit){
  const available=pool.filter(a=>!picked.includes(a));if(!available.length)break;
  const asset=choose(available),previous=picked.at(-1),rule=pairRule(previous,asset),gap=Math.max(sceneData.rules.minGap,rule?.min??.5);
  const member={key:`companion-${members.length}`,asset:asset.id,beside:members.at(-1).key,gap};
  const recipe={id:`${groupId}-${seed}`,name:group.name,group:groupId,surface,members:[...members,member]};
  let candidate;try{candidate=compileScene(recipe,center,yaw);}catch{pool.splice(pool.indexOf(asset),1);continue;}
  if(Math.max(candidate.box.max[0]-candidate.box.min[0],candidate.box.max[1]-candidate.box.min[1])>group.radius*2){pool.splice(pool.indexOf(asset),1);continue;}
  members.push(member);picked.push(asset);
 }
 return compileScene({id:`${groupId}-${seed}`,name:group.name,group:groupId,surface,members},center,yaw);
}
