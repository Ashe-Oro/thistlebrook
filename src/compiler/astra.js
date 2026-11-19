import {buildRegistry} from '../astra/registry/index.js';
import { compileTownScenes, checkScene } from './library-scenes.js';
import { overlap as libraryOverlap } from '../catalog/library/index.js';
import { placeDistrict, moveBox, DISTRICT_OFFSETS } from './astra-placement.js';
// Astra's layout is data, not scene geometry. Reserve streets before parcels,
// use the measured catalog bounds, and connect every doorstep to one graph.
import { planCivicQuarter } from '../astra/civic-quarter-plan.js';
import { makeRng } from './rng.js';
import { boxInRiver } from './water.js';
import { addWorkingDistrict } from './astra-work.js';
import { addSunbeamLayout } from '../astra/sunbeam-layout.js';
export const riverZ = x => 15 + Math.sin(x * .095) * 1.7;
export const distanceToSegment = (p,a,b) => {
 const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
};
export function compileAstra(catalog, seed=831) {
 const rng=makeRng(seed),random=()=>rng.float(),pick=a=>a[Math.floor(random()*a.length)];
 const town={version:'astra-4',seed,bounds:{minX:-147,maxX:65,minZ:-174,maxZ:34},riverBounds:{minX:-80,maxX:65},roads:[],buildings:[],props:[],trees:[],gardens:[],nodes:[],edges:[],bridges:[-22,22,46],rejected:0};
 town.outline=[[-118,-174],[-40,-174],[-40,-104],[65,-104],[65,34],[-80,34],[-80,-29],[-147,-29],[-147,-73],[-118,-73]];
 town.civicAprons=[{min:[18,-67],max:[24,-55]}];
 town.districts=[
  {id:'willowbank',name:'Willowbank',type:'neighbourhood',center:[-12,-13]},
  {id:'market',name:'Market Square',type:'civic',center:[1,3]},
  {id:'common',name:'Thistlebrook High Campus',type:'education',center:[8,-66]},
  {id:'quay',name:'Lantern Quay',type:'nightlife',center:[52,-4]},
  {id:'orchard',name:'Clover Fields',type:'agriculture',center:[-7,25]},
  {id:'downtown',name:'Old Town Centre',type:'commercial',center:[-57,-6]}
 ];
 town.venues=[
  {id:'tennis',name:'Common Tennis Club',type:'tennis',pos:[1,-44],box:{min:[-12,-53],max:[14,-35]},entry:[1,-33]},
  {id:'basketball',name:'The Neighbourhood Court',type:'basketball',pos:[28,-44],box:{min:[18,-53],max:[38,-35]},entry:[28,-33]},
  {id:'playground',name:'Little Oak Playground',type:'playground',pos:[-26,-44],box:{min:[-35,-53],max:[-17,-35]},entry:[-26,-33]},
  {id:'school',name:'Thistlebrook High School',type:'school',district:'common',height:12,pos:[-2,-61],box:{min:[-16,-67],max:[14,-55]},entry:[-2,-54.5],access:[16,-54.5]},
  {id:'baseball',name:'Thistlebrook Owls Baseball',type:'baseball',district:'common',pos:[-22,-84],box:{min:[-40,-101],max:[-4,-71]},entry:[-22,-69],access:[-22,-71]},
  {id:'football',name:'Owls Memorial Stadium',type:'football',district:'common',pos:[30,-84],box:{min:[0,-101],max:[61,-70]},entry:[30,-69],access:[30,-71]},
  {id:'fountain',name:'Founders Fountain',type:'fountain',district:'downtown',pos:[-57,-6],box:{min:[-64,-13],max:[-50,1]},entry:[-57,-1],access:[-57,4]},
  {id:'bandstand',name:'The Riverside Sessions',type:'music',pos:[55,26],box:{min:[49,21],max:[62,32]},entry:[46,26]}
 ];
 const roads=town.roads;
 const road=(a,b,width=2.4,kind='lane',owner=null)=>roads.push({a,b,width,kind,owner});
 for(const z of [-15,4]) for(let k=0;k<2;k++)road([[-22,0,22][k],z],[[-22,0,22][k+1],z],3);
 for(const x of [-22,-7,22])road([x,-15],[x,4],2.6);
 for(const x of [-22,22]) {road([x,4],[x,20.5],2.6);}
 road([-22,20.5],[22,20.5],2.2);
 for(const z of [-15,4]){road([-32,z],[-22,z]);road([22,z],[32,z]);}
 // District spines are authored before parcels, furnishing and foliage.
 for(const x of [-22,22])road([x,-33],[x,-15],2.6);
 road([-34,-33],[46,-33],3);
 road([46,-33],[46,30],3.2);
 for(const z of [-15,4])road([32,z],[46,z],3.2);
 road([22,20.5],[22,30],2.2);road([22,30],[46,30],2.2);
 // Campus paths fit between the reserved courts; commercial streets frame
 // the plaza. Explicit access points prevent shortcuts through playing fields.
 road([16,-69],[16,-33],1.5);road([-36,-69],[60,-69],1.5);
 road([-76,-16],[-36,-16],3,'avenue');road([-36,-16],[-36,-15],3,'avenue');road([-36,-15],[-32,-15],3,'avenue');
 road([-66,4],[-36,4],3,'avenue');road([-36,4],[-32,4],2.4,'avenue');for(const x of [-66,-48])road([x,-16],[x,4],2.8,'avenue');
 planCivicQuarter(town);
 const workRoadStart=roads.length;addWorkingDistrict(town,road);placeDistrict(town,'works',workRoadStart);
 // Civic Avenue connects the station approach, services and school without
 // cutting through the sports fields or the fire station forecourt.
 road([-42,-103],[-80,-103],3,'avenue');road([-80,-103],[-80,-77],1.5);
 road([-111,-139],[-115,-139],3,'avenue');road([-115,-139],[-115,-73],3,'avenue');
 road([-115,-73],[-105,-73],3,'avenue');road([-105,-73],[-105,-52],3,'avenue');
 for(const v of town.venues)road(v.entry,v.access||(v.type==='music'?[49,26]:[v.pos[0],-35]),1.8,'venue','venue:'+v.id);
 const overlap=(a,b,pad=.0)=>a.min[0]<b.max[0]+pad&&a.max[0]>b.min[0]-pad&&a.min[1]<b.max[1]+pad&&a.max[1]>b.min[1]-pad;
 const box=(id,x,z,rot=0,scale=1)=>{const e=catalog.get(id);if(!e)throw Error(`Missing catalog entry: ${id}`);const pts=[];for(const px of [e.bounds.min[0],e.bounds.max[0]])for(const pz of [e.bounds.min[2],e.bounds.max[2]])pts.push([x+scale*(px*Math.cos(rot)+pz*Math.sin(rot)),z+scale*(-px*Math.sin(rot)+pz*Math.cos(rot))]);return {min:[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1]))],max:[Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))]};};
 const reservations=[...town.venues.map(v=>v.box),...town.civicAprons];
 const reserve=(id,x,z,rot=0,scale=1,pad=.25)=>{const b=box(id,x,z,rot,scale);if(![b.min,[b.min[0],b.max[1]],b.max,[b.max[0],b.min[1]]].every(p=>pointInTown(p,town)))return null;if(reservations.some(a=>overlap(a,b,pad)))return null;reservations.push(b);return b;};
 const homes=['cv-home-cottage','cv-home-thatched','cv-home-timber','cv-home-townhouse'];
 const slots=[
 [-28,-24,'cv-windmill','The Little Mill'],[-17,-24,null,'Clover Cottage'],[-7,-24,null,'Honeycomb House'],[4,-24,null,'Bluebell House'],[15,-24,'cv-chapel','Saint Willow’s'],[27,-24,null,'Foxglove Cottage'],
 [-29,-5,'cv-bakery','Flour & Fern'],[-15,-5,null,'Rosemary Cottage'],[0,-6,'cv-tavern','The Copper Kettle'],[13,-5,'cv-store','Thistlebrook Provisions'],[29,-5,null,'Juniper House'],
 [-30,9,null,'Riverside Cottage'],[30,9,'cv-blacksmith','Bram’s Workshop'],[-29,25,'farm-farmhand-cottage','Orchard House'],[12,25,'farm-hay-barn','Clover Farm'],[30,25,'farm-farmhouse','The Farmhouse'],[55,-23,'cv-tavern','The Nightjar'],[55,-7,'cv-market-hall','The Lantern Room'],[55,4,'cv-store','Moonrise Gelateria'],
 [-71,-24,'cv-bakery','Sunrise Bakehouse'],[-59,-24,'cv-store','Sole & Stitch'],[-47,-24,'cv-home-townhouse','The Reading Room'],
 [-73,-6,'cv-tavern','Corner Cup Café'],[-42,-6,'cv-store','Petal & Stem'],[-57,9.5,'cv-home-timber','Thistlebrook Town Hall'],[-73,6,'cv-home-cottage','The Post Office']
 ];
 for(const [i,s] of slots.entries()) {
  const [sx,sz,fixed,name]=s,id=fixed||pick(homes),x=sx+(random()-.5)*.7,z=sz+(random()-.5)*.6;
  // Rear bank buildings face their closest lane, not the camera. Farm doors
  // face north; door clearance and routes follow the same rotation.
  const downtown=sx< -38;
  const rot=downtown?(sz< -18?0:sx< -68?Math.PI/2:sx> -46?-Math.PI/2:Math.PI):sx>40?0:sz>20?Math.PI:sz>0?(sx<0?Math.PI/2:-Math.PI/2):0,b=reserve(id,x,z,rot,1,.6);if(!b)throw Error(`Parcel collision: ${name}`);
  const e=catalog.get(id),d=e.door?.pos||[0,0,2.4],door=[x+d[0]*Math.cos(rot)+d[2]*Math.sin(rot),z-d[0]*Math.sin(rot)+d[2]*Math.cos(rot)];
  const approach=[door[0]+Math.sin(rot)*1.15,door[1]+Math.cos(rot)*1.15];
  // Explicit street frontage keeps connectors straight and outside neighbours.
  const streetZ=sz< -18?-15:sz>20?20.5:sz>0?4:4;
  let join=sz>0&&sz<20?[sx<0?-22:22,approach[1]]:[approach[0],streetZ];
  // Farm front doors face north onto a short access lane, joined at the side.
  const spur=!downtown&&sz>20?[sx<0?-22:22,approach[1]]:null;
  if(downtown)join=sz< -18?[approach[0],-16]:sx< -68?[-66,approach[1]]:sx> -46?[-48,approach[1]]:[approach[0],4];
  if(spur)join=spur;if(sx>40)join=[approach[0],sz< -15?-14.5:sz<0?-.5:9.5];
  const bld={key:`parcel-${i}`,id,name,pos:[x,z],rot,box:b,door,approach,join,kind:fixed?'civic':'home',district:downtown?'downtown':sx>40?'quay':sz>20?'orchard':'willowbank'};
  town.buildings.push(bld);road(door,approach,1.25,'door',bld.key);road(approach,join,1.25,'door',bld.key);
  if(downtown&&sz>4&&sx< -68)road(join,[-66,4],1.25,'door',bld.key);
  if(sx>40)road(join,[46,join[1]],1.25,'door',bld.key);
  if(spur)road(spur,[spur[0],20.5],1.5,'door',bld.key);
  // Side gardens leave the front and its access corridor completely open.
  if(!downtown&&sz<0 && sx!==0 && sx<40)town.gardens.push({x:b.max[0]+1.3,z,owner:bld.key,width:1.7,depth:4.3});
 }
 const sunbeamRoadStart=roads.length,sunbeamCourt=addSunbeamLayout(town);placeDistrict(town,'sunbeam',sunbeamRoadStart);
 reservations.push(moveBox(sunbeamCourt,DISTRICT_OFFSETS.sunbeam));
 road([-105,-52],[-94,-52],2.4);road([-99,-33],[-80,-33],2.4);
 // A perimeter bus loop serves the west without driving through the terrace court.
 for(const r of roads){if(r.a[0]===-42&&r.b[0]===-42)r.width=3;if(r.a[1]===-33&&r.b[1]===-33&&Math.min(r.a[0],r.b[0])<=-80)r.width=3;}
 for(const [a,b] of [[[-80,-103],[-105,-103]],[[-105,-103],[-105,-77]],[[-105,-77],[-100,-77]],[[-126,-33],[-144,-33]],[[-144,-33],[-144,-70]],[[-144,-70],[-115,-70]],[[-115,-70],[-115,-73]]])road(a,b,3,'avenue');
 for(const r of roads)if(r.a[1]===-52&&r.b[1]===-52&&Math.min(r.a[0],r.b[0])< -105)r.kind='pedestrian';
 town.catalogScenes=compileTownScenes(town);reservations.push(...town.catalogScenes.map(s=>s.box));
 town.interactions=town.catalogScenes.flatMap(s=>s.slots);
 // Props never stand in the river (a doorstep flower bed once landed in it).
 const prop=(id,x,z,rot=0,scale=1)=>{const candidate=box(id,x,z,rot,scale);if(boxInRiver(candidate)||roads.some(r=>overlap(candidate,{min:[Math.min(r.a[0],r.b[0])-r.width/2,Math.min(r.a[1],r.b[1])-r.width/2],max:[Math.max(r.a[0],r.b[0])+r.width/2,Math.max(r.a[1],r.b[1])+r.width/2]}))){town.rejected++;return false;}const b=reserve(id,x,z,rot,scale,.18);if(b){town.props.push({id,pos:[x,z],rot,scale});return true;}town.rejected++;return false;};
 // Plant the station walk and connect its lighting to the town's dusk cycle.
 for(const z of [-126,-114,-102,-90,-78])prop('cv-streetlamp',-113,z,0,1);
 for(const z of [-100,-89,-79]){const id='cv-tree-oak',x=-110,scale=.75;if(reserve(id,x,z,0,scale,.4))town.trees.push({id,pos:[x,z],rot:0,scale});}
 prop('cv-bench',-109,-103,0,.9);prop('cv-directional-post',-103,-49,0,1.1);
 prop('cv-well',-2.6,.6);prop('cv-market-stall',4.4,1.1);prop('cv-market-stall',7.1,1.1);prop('farm-produce-stand',7.2,6.8,Math.PI);
 prop('cv-flower-cart',-4.5,7.4,1.5);prop('cv-bench',-4.8,.5,-Math.PI/2);prop('cv-notice-board',-7,7.4);prop('cv-directional-post',-20,2);
 for(const b of town.buildings){if(b.custom||b.pos[1]>20)continue;prop('cv-plant-potted',b.door[0]+1.1,b.door[1]+.65,0,.9);prop('cv-flower-bed',b.pos[0]-1,b.box.max[1]+.7,0,.8);if(b.pos[0]<0)prop('cv-barrel',b.box.min[0]-.8,b.pos[1]+1,0,.8);}
 for(const [x,z] of [[-20,-13],[20,-13],[-20,6],[20,6],[-2,-13],[2,7]])prop('cv-streetlamp',x,z,0,.9);
 for(const x of [-14,-9,-4,1])for(const z of [23,28])prop('farm-apple-tree',x,z,random()*6,1.05);
 for(const x of [27,31])prop('farm-crop-row-field',x,19.8,0,.7);
 prop('farm-chicken-coop',18,29,Math.PI,.9);prop('farm-hay-bale-round',8,29);prop('cv-hand-cart',10,20,.6,.85);
 for(const [x,z] of [[43,-30],[43,-17],[43,-2],[43,8],[48,20],[48,30],[-15,-35],[16,-35],[39,-35]])prop('cv-streetlamp',x,z,0,1.1);
 for(const [x,z] of [[-14,-40],[-14,-48],[16,-40],[16,-48],[40,-40],[40,-48],[39,-8],[39,1]])prop('cv-bench',x,z,-Math.PI/2,.9);
 for(const [x,z] of [[-64,-14],[-50,-14],[-64,2],[-50,2],[-60,0],[-54,0],[14,-57],[18,-57],[-35,-70],[59,-70]])prop('cv-streetlamp',x,z,0,1);
 // Dining terraces are reserved against foliage as well as parcel geometry.
 town.courtyards=[];for(const x of [50.4,60.5])for(const z of [-17,-12.5,-3,2]){const area={centre:[x,z],min:[x-1.35,z-1.95],max:[x+1.35,z+1.95]};reservations.push(area);town.courtyards.push(area);}
 // Canopies, rather than just trunks, must clear every street, parcel and water.
 for(let i=0;i<1600;i++){
  const x=-78+random()*140,z=-102+random()*134;
  if((x< -42&&z< -34)||Math.abs(z-riverZ(x))<5||x>62.5||x< -77.5||z< -101.5||z>31.5)continue;
  if(x>-11&&x<10&&z>-12&&z<10)continue;
  const scale=.65+random()*.4,radius=2.5*scale;
  if(roads.some(r=>distanceToSegment([x,z],r.a,r.b)<r.width/2+radius))continue;
  if(town.gardens.some(g=>Math.abs(x-g.x)<3&&Math.abs(z-g.z)<4))continue;
  const id=pick(['cv-tree-oak','cv-tree-oak','cv-tree-pine','cv-tree-fruit']),rot=random()*6,b=reserve(id,x,z,rot,scale,.4);
  if(b)town.trees.push({id,pos:[x,z],rot,scale});
 }
 // Split every crossing, T junction and door landing into a walkable graph.
 const node=p=>{let i=town.nodes.findIndex(v=>Math.hypot(v[0]-p[0],v[1]-p[1])<.015);if(i<0){i=town.nodes.length;town.nodes.push(p.map(v=>+v.toFixed(5)));town.edges.push([]);}return i;};
 const split=roads.map(r=>[r.a,r.b]);
 for(let i=0;i<roads.length;i++)for(let j=i+1;j<roads.length;j++){
  const a=roads[i],b=roads[j],u=[a.b[0]-a.a[0],a.b[1]-a.a[1]],v=[b.b[0]-b.a[0],b.b[1]-b.a[1]],den=u[0]*v[1]-u[1]*v[0];
  if(Math.abs(den)>1e-8){const w=[b.a[0]-a.a[0],b.a[1]-a.a[1]],t=(w[0]*v[1]-w[1]*v[0])/den,s=(w[0]*u[1]-w[1]*u[0])/den;if(t>=0&&t<=1&&s>=0&&s<=1){const p=[a.a[0]+t*u[0],a.a[1]+t*u[1]];split[i].push(p);split[j].push(p);}}
  for(const p of [a.a,a.b])if(distanceToSegment(p,b.a,b.b)<.01)split[j].push(p);
  for(const p of [b.a,b.b])if(distanceToSegment(p,a.a,a.b)<.01)split[i].push(p);
 }
 split.forEach((points,i)=>{points.sort((a,b)=>Math.hypot(a[0]-roads[i].a[0],a[1]-roads[i].a[1])-Math.hypot(b[0]-roads[i].a[0],b[1]-roads[i].a[1]));const ids=[...new Set(points.map(node))];for(let j=1;j<ids.length;j++){const a=ids[j-1],b=ids[j];if(!town.edges[a].includes(b))town.edges[a].push(b);if(!town.edges[b].includes(a))town.edges[b].push(a);}});
 town.buildings.forEach(b=>b.node=node(b.door));town.venues.forEach(v=>v.node=node(v.entry));
 town.workstations?.forEach(s=>s.node=node(s.entry));
 for(const slot of town.interactions)slot.node=node([slot.approach[0],slot.approach[2]]);
 town.report=checkAstra(town);if(!town.report.ok)throw Error(town.report.errors.join('; '));town.registry=buildRegistry(town,catalog);return town;
}
export function checkAstra(town){
 const errors=[],seen=new Set([0]),queue=[0];while(queue.length){for(const n of town.edges[queue.shift()])if(!seen.has(n)){seen.add(n);queue.push(n);}}
 if(seen.size!==town.nodes.length)errors.push('Disconnected pedestrian graph');
 for(const v of town.venues){if(!seen.has(v.node))errors.push(`Unreachable venue: ${v.name}`);for(const b of town.buildings)if(b.box.min[0]<v.box.max[0]&&b.box.max[0]>v.box.min[0]&&b.box.min[1]<v.box.max[1]&&b.box.max[1]>v.box.min[1])errors.push(`Building in venue: ${v.name}`);}
 for(const a of town.venues)for(const b of town.venues){if(a.id>=b.id)continue;if(a.box.min[0]<b.box.max[0]&&a.box.max[0]>b.box.min[0]&&a.box.min[1]<b.box.max[1]&&a.box.max[1]>b.box.min[1])errors.push(`Overlapping venues: ${a.name} / ${b.name}`);}
 for(const b of town.buildings){if(!seen.has(b.node))errors.push(`Unreachable door: ${b.name}`);if(Math.abs(b.pos[1]-riverZ(b.pos[0]))<5)errors.push(`Building in river: ${b.name}`);}
 for(let i=0;i<town.buildings.length;i++)for(let j=i+1;j<town.buildings.length;j++){const a=town.buildings[i].box,b=town.buildings[j].box;if(a.min[0]<b.max[0]&&a.max[0]>b.min[0]&&a.min[1]<b.max[1]&&a.max[1]>b.min[1])errors.push('Overlapping parcels');}
 for(const b of town.buildings)for(const r of town.roads.filter(r=>r.owner!==b.key)){const min=[Math.min(r.a[0],r.b[0])-r.width/2,Math.min(r.a[1],r.b[1])-r.width/2],max=[Math.max(r.a[0],r.b[0])+r.width/2,Math.max(r.a[1],r.b[1])+r.width/2];if(b.box.min[0]<max[0]&&b.box.max[0]>min[0]&&b.box.min[1]<max[1]&&b.box.max[1]>min[1])errors.push(`Street crosses ${b.name}`);}
 for(const v of town.venues)for(const r of town.roads.filter(r=>r.owner!=='venue:'+v.id)){const min=[Math.min(r.a[0],r.b[0])-r.width/2,Math.min(r.a[1],r.b[1])-r.width/2],max=[Math.max(r.a[0],r.b[0])+r.width/2,Math.max(r.a[1],r.b[1])+r.width/2];if(v.box.min[0]<max[0]&&v.box.max[0]>min[0]&&v.box.min[1]<max[1]&&v.box.max[1]>min[1])errors.push(`Street crosses venue: ${v.name}`);}
 for(const scene of town.catalogScenes||[]){
  for(const parcel of [...town.buildings,...town.venues])if(libraryOverlap(scene.box,parcel.box))errors.push(`Catalog scene crosses parcel: ${scene.id}/${parcel.name}`);
  errors.push(...checkScene(scene));
  for(const other of town.catalogScenes)if(scene.id<other.id&&libraryOverlap(scene.box,other.box))errors.push(`Catalog scenes overlap: ${scene.id}/${other.id}`);
  for(const member of scene.members)for(const x of [member.box.min[0],member.box.max[0]])if(member.box.min[1]<riverZ(x)+3.4&&member.box.max[1]>riverZ(x)-3.4)errors.push(`Catalog prop in river: ${member.key}`);
  if(![scene.box.min,[scene.box.min[0],scene.box.max[1]],scene.box.max,[scene.box.max[0],scene.box.min[1]]].every(p=>pointInTown(p,town)))errors.push(`Catalog scene outside island: ${scene.id}`);
  for(const member of scene.members){
   for(const road of town.roads){const b={min:[Math.min(road.a[0],road.b[0])-road.width/2,Math.min(road.a[1],road.b[1])-road.width/2],max:[Math.max(road.a[0],road.b[0])+road.width/2,Math.max(road.a[1],road.b[1])+road.width/2]};if(libraryOverlap(member.box,b))errors.push(`Street crosses catalog prop: ${member.key}`);}
  }
 }
 for(const slot of town.interactions||[])if(!seen.has(slot.node))errors.push(`Unreachable activity: ${slot.id}`);
 return {ok:!errors.length,errors,catalogScenes:town.catalogScenes?.length||0,activitySlots:town.interactions?.length||0,buildings:town.buildings.length,districts:town.districts.length,venues:town.venues.length,trees:town.trees.length,connectedNodes:seen.size};
}

export function shortestPath(town,start,end){
 const distance=town.nodes.map(()=>Infinity),previous=town.nodes.map(()=>-1),open=new Set(town.nodes.map((_,i)=>i));distance[start]=0;
 while(open.size){let u=-1;for(const i of open)if(u<0||distance[i]<distance[u])u=i;if(!Number.isFinite(distance[u])||u===end)break;open.delete(u);for(const v of town.edges[u]){const a=town.nodes[u],b=town.nodes[v],d=distance[u]+Math.hypot(a[0]-b[0],a[1]-b[1]);if(d<distance[v]){distance[v]=d;previous[v]=u;}}}
 const path=[];for(let i=end;i!==-1;i=previous[i])path.unshift(i);return path[0]===start?path:[];
}

export function pointInTown([x,z],town){
 let inside=false;const p=town.outline;
 for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;}
 return inside;
}
