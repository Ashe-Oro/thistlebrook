import {activityCopy,readableAssetName} from '../life/activity-copy.js';
import {cozyBenchSeats} from './asset-points.js';
import { baseballInteraction, proceduralSeatCandidates } from './authored-activities.js';
import { interactionErrors } from './interaction-schema.js';
import { supplementalPlacements, proceduralPlacements } from './placements.js';

const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
export const isOpen=(hours,h)=>hours[0]===0&&hours[1]===24||hours[0]<hours[1]&&h>=hours[0]&&h<hours[1]||hours[0]>hours[1]&&(h>=hours[0]||h<hours[1]);
const title=s=>s.replace(/^(cv|farm)-/,'').replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());
const names=['Mabel','Bram','Rose','Finn','Hazel','Oswin','Clover','Rowan','Pip','Ada','Fern','Hugh','Wren','Tilly','Jasper','Olive','Nico','Bea','Theo','Iris','Kit','Luca','Alma','Jules','Elsie','June','Arthur','Blythe','Milo','Daisy','Lily','Seth','Nell','Otis','Cleo','Rafi','Mae','Sol','Zara','Emil'];
const proprietors={'The Little Mill':'Oswin','Flour & Fern':'Mabel','Bram’s Workshop':'Bram','The Copper Kettle':'Rose','Thistlebrook Provisions':'Finn','Clover Farm':'Clover','The Nightjar':'Luca','The Reading Room':'Blythe','Sole & Stitch':'Milo','Sunrise Bakehouse':'Daisy','Petal & Stem':'Lily','The Post Office':'Seth','Thistlebrook High School':'June'};
function service(name,kind){
 if(kind==='home')return {capabilities:['walkTo','visit','rest'],hours:[0,24]};
 if(/Nightjar|Lantern Room/.test(name))return {capabilities:['walkTo','visit','work','buy','eat','rest'],hours:[17,1]};
 if(/Town Hall|Post Office/.test(name))return {capabilities:['walkTo','visit','work','payBill'],hours:[9,17]};
 if(/School/.test(name))return {capabilities:['walkTo','visit','work'],hours:[7,18]};
 if(/Flour|Bakehouse|Kettle|Café|Gelateria/.test(name))return {capabilities:['walkTo','visit','work','buy','eat'],hours:[7,21]};
 return {capabilities:['walkTo','visit','work','buy','sell'],hours:[8,18]};
}
function activityFor(asset){
 if(/bench|chair|bleacher|stand/.test(asset)&&!/produce|bandstand|notice/.test(asset))return 'sit';
 if(/table|cup/.test(asset))return 'picnic';
 if(/stall|produce|cart|notice|directional/.test(asset))return 'browse';
 return 'work';
}
function intersects(a,b,box,pad=.32){
 let lo=0,hi=1;
 for(let k=0;k<2;k++){
  const d=b[k]-a[k],min=box.min[k]-pad,max=box.max[k]+pad;
  if(Math.abs(d)<1e-8){if(a[k]<min||a[k]>max)return false;}
  else {const u=(min-a[k])/d,v=(max-a[k])/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return false;}
 }
 return true;
}
const riverZ=x=>15+Math.sin(x*.095)*1.7;
function modelBox(p,catalog){
 const b=catalog.get(p.asset||p.id)?.bounds;
 if(!b)return {min:p.pos.map(v=>v-.6),max:p.pos.map(v=>v+.6)};
 const yaw=p.rot||0,scale=p.scale||1,pts=[];
 for(const x of [b.min[0],b.max[0]])for(const z of [b.min[2],b.max[2]])pts.push([p.pos[0]+scale*(x*Math.cos(yaw)+z*Math.sin(yaw)),p.pos[1]+scale*(-x*Math.sin(yaw)+z*Math.cos(yaw))]);
 return {min:[0,1].map(k=>Math.min(...pts.map(p=>p[k]))),max:[0,1].map(k=>Math.max(...pts.map(p=>p[k])))};
}
export function clearApproach(town,a,b,obstacles){
 if(obstacles.some(box=>intersects(a,b,box)))return false;
 const count=Math.max(1,Math.ceil(distance(a,b)/.25));
 for(let n=0;n<=count;n++){
  const p=a.map((v,k)=>v+(b[k]-v)*n/count);
  let inside=false;const poly=town.outline;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>p[1])!==(poly[j][1]>p[1])&&p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])inside=!inside;
  if(!inside||Math.abs(p[1]-riverZ(p[0]))<3.3)return false;
 }
 return true;
}

/** Plain serializable compiler output; metadata never mutates the measured catalog. */
export function buildRegistry(town,catalog){
 const places=[],byId=new Map();
 const nearestNode=pos=>town.nodes.reduce((best,p,i)=>distance(p,pos)<distance(town.nodes[best],pos)?i:best,0);
 const districtAt=pos=>town.districts.reduce((best,d)=>distance(d.center,pos)<distance(best.center,pos)?d:best).id;
 const add=(source,id,type,name,pos,options={})=>{
  if(byId.has(id))throw Error(`Duplicate registry id: ${id}`);
  const node=options.node??null;
  const record={id,type,kind:type,name,district:options.district||byId.get(options.owner)?.district||districtAt(pos),owner:options.owner||'Thistlebrook town',occupants:options.occupants||[],hours:[0,24],capabilities:node===null?[]:['walkTo','visit'],pos:[...pos],node,entryPoints:node===null?[]:[{node,position:[...town.nodes[node]],approach:[]}],interactionPoints:[],...options};
  places.push(record);byId.set(id,record);if(source)source.registryId=id;return record;
 };
 for(const b of town.buildings){
  const occupants=names.filter((_,n)=>n%town.buildings.length===town.buildings.indexOf(b));
  add(b,b.key,'building',b.name,b.pos,{...service(b.name,b.kind),kind:b.kind,asset:b.id,node:b.node,district:b.district,owner:proprietors[b.name]||occupants[0]||'Thistlebrook town',occupants});
 }
 for(const v of town.venues)add(v,v.id,v.type==='school'?'building':'area',v.name,v.pos,{node:v.node,district:v.district||(['tennis','basketball','playground','baseball','football','school'].includes(v.type)?'common':'quay'),kind:v.type,capabilities:['walkTo','visit','rest',...(v.type==='school'?['work']:[])],hours:v.type==='music'?[17,1]:v.district==='fair'&&!['fair-pond','fair-picnic'].includes(v.type)?[15,22]:[6,22],owner:proprietors[v.name]||'Thistlebrook town'});
 const field=town.venues.find(v=>v.type==='baseball');
 if(field){const r=byId.get(field.id),interaction=baseballInteraction(field);r.interaction=interaction;r.hours=[...interaction.hours];r.interactionPoints=interaction.slots;r.activity={enabled:true,activity:'baseball',animation:'field',slots:interaction.slots};}
 for(const d of town.districts)add(d,byId.has(d.id)?'district:'+d.id:d.id,'district',d.name,d.center,{node:nearestNode(d.center),district:d.id});
 town.supplemental=supplementalPlacements(town);
 for(const p of town.supplemental){if(p.asset==='cv-rock-stone-pile'||p.asset==='farm-duck')p.pos[1]=riverZ(p.pos[0])+(p.asset==='cv-rock-stone-pile'?3:0);}
 const physical=[...town.props,...town.trees,...town.supplemental];
 for(const [i,p] of physical.entries()){
  const id=p.key||(i<town.props.length?`prop-${i}`:`tree-${i-town.props.length}`),asset=p.asset||p.id;
  const r=add(p,id,/duck|chicken$/.test(asset)?'animal':town.trees.includes(p)?'vegetation':'prop',`${title(asset)} (${id})`,p.pos,{asset,rot:p.rot||0,scale:p.scale||1,owner:p.owner||'Thistlebrook town'});
  const activity=activityFor(asset);
  const seats=asset==='cv-bench'?cozyBenchSeats(p):[];
  r.interactionPoints=seats;
  r.activity={enabled:false,activity,animation:activity==='sit'?'sit':activity==='picnic'?'eat':activity==='browse'?'idle':'work',slots:seats,reason:'No verified pedestrian approach; decorative placement'};
 }
 for(const [i,g] of town.gardens.entries())g.registryId=`built:garden-${i}`;
 town.procedural=proceduralPlacements(town);
 town.roads.forEach((r,i)=>r.registryId=`built:road-${i}`);
 town.courtyards.forEach((r,i)=>r.registryId=`built:terrace-${i}`);
 for(const p of town.procedural){const r=add(p,p.key,p.kind,p.name,p.pos,{owner:p.owner||'Thistlebrook town',rendering:p.rendering});const seats=proceduralSeatCandidates(p,town);r.activity={enabled:false,activity:seats.length?'sit':activityFor(p.name.toLowerCase()),animation:seats.length?'sit':'idle',slots:seats,reason:'Assembly component; no authored activity access'};if(p.key.startsWith('built:chair-'))r.activity={enabled:false,activity:'sit',animation:'sit',slots:[{id:'seat',kind:'seat',position:[...p.pos],facing:p.key.endsWith('--1')?0:Math.PI,seatHeight:.48,animation:'sit',approach:[]}],reason:'Seat measured from procedural furniture; circulation approach not yet verified'};}
 // Scene members use their compiler-authored graph connectors, never nearest-node spurs.
 for(const scene of town.catalogScenes){
  const first=scene.slots[0];
  add(scene,scene.id,'area',scene.name,scene.center,{node:first?.node??null,district:scene.district});
  for(const member of scene.members){
   const slots=member.interactions;
   const r=add(member,`${scene.id}/${member.key}`,'prop',readableAssetName(member.asset),member.pos,{asset:member.asset,owner:scene.id,district:scene.district,node:slots[0]?.node??null});
   r.activity={enabled:false,activity:'work',animation:'work',slots:[],reason:'No enabled catalog slot'};
   // One place per independently reservable catalog slot avoids mixing activities.
   for(const s of slots.filter(s=>s.enabled)){
    const activity=s.activity==='sit'?'sit':s.activity==='eat'?'picnic':s.activity==='browse'?'browse':'work';
    const slot={id:s.id,kind:activity==='sit'?'seat':'standing',position:[s.position[0],s.position[2]],facing:s.facing,animation:activity==='sit'?'sit':activity==='picnic'?'eat':activity==='browse'?'idle':'work',approach:[],...(activity==='sit'?{seatHeight:s.position[1]}:{})};
    const interaction={version:1,activity,label:s.label||(scene.id.startsWith('stop-')?'Resting at '+scene.name:activityCopy(s.activity,member.asset)),tools:activity==='sit'?['rest','visit']:activity==='picnic'?['eat','rest','visit']:['visit'],duration:30,minParticipants:1,entryNode:s.node,approach:[],slots:[slot],hours:[0,24]};
    const record=add(s,`activity:${s.id}`,'prop',interaction.label,slot.position,{node:s.node,owner:r.id,district:scene.district,capabilities:['walkTo',...interaction.tools],interaction,activity:{enabled:true,activity,animation:slot.animation,slots:[slot],catalogActivity:s.activity}});
    record.interactionPoints=interaction.slots;
    // Discover affordances on the physical prop; reserve only its child place.
    r.interactionPoints.push(slot);
   }
  }
 }
 // Conservative adapter for existing street benches; reserved parcels are obstacles.
 const boxes=physical.map(p=>modelBox(p,catalog));
 for(const p of town.props.filter(p=>p.id==='cv-bench')){
  const r=byId.get(p.registryId),yaw=p.rot||0,front=[Math.sin(yaw),Math.cos(yaw)],entry=p.pos.map((v,k)=>v+front[k]*1.3);
  const obstacles=[...town.buildings.map(b=>b.box),...town.venues.map(v=>v.box),...town.catalogScenes.map(s=>s.box),...town.courtyards,...physical.flatMap((other,i)=>other===p?[]:[boxes[i]])];
  const slots=cozyBenchSeats(p).map(({candidate,enabled,...slot})=>slot);
  const candidates=town.nodes.map((pos,node)=>({pos,node,d:distance(pos,entry)})).filter(c=>c.d<8&&town.edges[c.node].length>1).sort((a,b)=>a.d-b.d||a.node-b.node);
  const c=candidates.find(c=>clearApproach(town,c.pos,entry,obstacles)&&slots.every(s=>clearApproach(town,entry,s.approach[0],obstacles)&&clearApproach(town,s.approach[0],s.position,obstacles)));
  if(!c)continue;
  r.node=c.node;r.capabilities=['walkTo','rest','eat','visit'];r.entryPoints=[{node:c.node,position:[...c.pos],approach:[entry]}];
  r.interaction={version:1,activity:'sit',label:'A rest on the bench',tools:['rest','eat','visit'],duration:24,minParticipants:1,entryNode:c.node,approach:[entry],slots,hours:[0,24]};
  r.interactionPoints=slots;r.activity={enabled:true,activity:'sit',animation:'sit',slots};
  // The life adapter skips its inferred bench fallback and replaces incoming IDs.
  p.key=r.id;p.interaction=r.interaction;
 }
 return {version:1,places};
}

export function shortestRoutes(town,start){
 if(!Number.isInteger(start)||!town.nodes[start])throw Error('Unknown start node');
 const distances=town.nodes.map(()=>Infinity),previous=town.nodes.map(()=>-1),open=new Set([start]);distances[start]=0;
 while(open.size){let u=-1;for(const n of open)if(u<0||distances[n]<distances[u])u=n;open.delete(u);
  for(const v of town.edges[u]){const next=distances[u]+distance(town.nodes[u],town.nodes[v]);if(next<distances[v]){distances[v]=next;previous[v]=u;open.add(v);}}
 }
 return {distances,path(end){if(!Number.isFinite(distances[end]))return [];const path=[];for(let n=end;n!==-1;n=previous[n])path.unshift(n);return path;}};
}

/** Queries return stable metadata. Routes begin at an actual reached graph node. */
export function createWorldRegistry(town){
 const places=town.registry.places,ids=new Map(places.map(p=>[p.id,p]));
 const findPlace=query=>{
  if(typeof query!=='string')return null;
  if(ids.has(query))return ids.get(query);
  const normalize=s=>s.trim().toLowerCase().replaceAll('’',"'");
  const q=normalize(query);
  return places.find(p=>[p.id,p.name,...(p.aliases||[])].some(s=>normalize(s)===q))||null;
 };
 const findAll=({capability,type,district,hour}={})=>places.filter(p=>(!capability||p.capabilities.includes(capability))&&(!type||p.type===type)&&(!district||p.district===district)&&(hour===undefined||isOpen(p.hours,hour)));
 const resolvePath=(start,target,{slot:slotId,hour}={},routes=null)=>{
  const place=findPlace(target);if(!place)return {ok:false,error:'Unknown place'};
  if(!Number.isInteger(start)||!town.nodes[start])return {ok:false,error:'Unknown start node'};
  if(place.node===null||!place.capabilities.includes('walkTo'))return {ok:false,error:'No verified access',place};
  if(hour!==undefined&&!isOpen(place.hours,hour))return {ok:false,error:'Place is closed',place};
  const interaction=place.interaction,slot=slotId===undefined?null:interaction?.slots.find(s=>s.id===slotId);
  if(slotId!==undefined&&!slot)return {ok:false,error:'Unknown slot',place};
  const entry=place.entryPoints[0],end=interaction?.entryNode??entry.node,nodes=(routes||shortestRoutes(town,start)).path(end);
  if(!nodes.length)return {ok:false,error:'Unreachable entry',place};
  const approach=interaction?.approach||entry.approach;
  const points=[...nodes.map(n=>[...town.nodes[n]]),...approach.map(p=>[...p]),...(slot?[...slot.approach.map(p=>[...p]),[...slot.position]]:[])];
  return {ok:true,place,entryNode:end,nodes,points,slot, distance:points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0)};
 };
 const findNearest=(start,capability,filter={})=>{
  if(!Number.isInteger(start)||!town.nodes[start])return null;
  const routes=shortestRoutes(town,start);
  const candidates=findAll({...filter,capability}).filter(p=>p.node!==null&&Number.isFinite(routes.distances[p.node]));
  // Compare complete access distances, rather than straight-line proximity.
  return candidates.map(place=>({place,route:resolvePath(start,place.id,filter,routes)})).filter(c=>c.route.ok).sort((a,b)=>a.route.distance-b.route.distance||a.place.id.localeCompare(b.place.id))[0]?.place||null;
 };
 return {places,findPlace,findAll,findNearest,resolvePath,walkTo:(target,{fromNode,...options}={})=>resolvePath(fromNode,target,options)};
}

export function registryErrors(town){
 const errors=[],seen=new Set();
 for(const p of town.registry.places){
  if(!p.id||seen.has(p.id))errors.push('Duplicate or missing id');seen.add(p.id);
  if(!p.name||!p.type||!p.owner||!Array.isArray(p.occupants)||!town.districts.some(d=>d.id===p.district)||!point(p.pos)||(!Array.isArray(p.hours)||p.hours.length!==2||!p.hours.every(Number.isFinite)||p.hours[0]<0||p.hours[0]>=24||p.hours[1]<0||p.hours[1]>24||p.hours[0]===p.hours[1])||!Array.isArray(p.capabilities)||!Array.isArray(p.entryPoints)||!Array.isArray(p.interactionPoints))errors.push(`Incomplete metadata: ${p.id}`);
  if(p.node!==null&&(!Number.isInteger(p.node)||!town.nodes[p.node]||p.entryPoints[0]?.node!==p.node))errors.push(`Invalid entry: ${p.id}`);
  if(p.type==='prop'&&!p.activity)errors.push(`Missing activity: ${p.id}`);
  if(p.interaction){errors.push(...interactionErrors(p.interaction,town).map(e=>`${p.id}: ${e}`));const i=p.interaction;if(i.version!==1||!town.nodes[i.entryNode]||!i.slots.length||!i.slots.every(s=>point(s.position)&&Array.isArray(s.approach)&&Number.isFinite(s.facing)&&(['seat','standing','player'].includes(s.kind))&&(s.kind!=='seat'||Number.isFinite(s.seatHeight))))errors.push(`Invalid interaction: ${p.id}`);}
 }
 for(const item of [...town.buildings,...town.venues,...town.districts,...town.props,...town.trees,...town.gardens,...town.roads,...town.courtyards,...town.supplemental,...town.procedural,...town.catalogScenes,...town.catalogScenes.flatMap(s=>s.members),...town.interactions,...(town.landscape?.models||[]),...(town.landscape?.hills||[]),...(town.modelPlacements||[]).concat(town.districtFurniture||[]).map(p=>({...p,registryId:p.id}))])if(!seen.has(item.registryId))errors.push(`Unregistered placement: ${item.key||item.id||'garden'}`);
 return errors;
}
