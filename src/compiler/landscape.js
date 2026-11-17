import {makeRng} from './rng.js';
import {distanceToSegment} from './astra.js';
import {inRiver} from './water.js';

// A mainland, a coastal peninsula, and a sheltered inlet. The inlet opens south
// of Ocean Drive; Highway 4 crosses its mouth on a proper two-lane bridge.
export const MAINLAND = [
 [-252,-206],[-238,-252],[-180,-277],[-90,-268],[-25,-280],[65,-277],[155,-267],
 [170,-210],[174,-163],[240,-165],[292,-149],[306,-98],[301,-28],[287,27],
 [290,39],[291,68],[294,100],[289,135],[288,159],[265,175],[214,171],
 [201,137],[210,91],[191,52],[151,50],[125,65],[115,84],[141,101],[166,99],
 [172,145],[190,190],[253,205],[290,214],[294,244],[293,285],[294,325],
 [290,363],[266,387],[191,385],[119,373],[98,324],[101,263],[94,220],
 // [25,156]..[2,155.6]: the Stillwater Outflow estuary (src/compiler/water.js)
 // cuts through the beach, so the river meets the Gulf at sea level.
 [72,173],[25,156],[20.5,146.5],[7.5,146.5],[2,155.6],[-42,155],[-106,130],[-158,104],[-217,69],[-245,12],[-250,-95]
];
export function insideLandscape([x,z]) {
 let inside=false;for(let i=0,j=MAINLAND.length-1;i<MAINLAND.length;j=i++) {
  const a=MAINLAND[i],b=MAINLAND[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
}
const separation=(p,line)=>Math.min(...line.slice(1).map((b,i)=>distanceToSegment(p,line[i],b)));

// Regional roads are planned in src/roads/regional.js (one filleted record
// per chain, carriageway centred on the walk graph).
export {planRegionalRoads} from '../roads/regional.js';

export function planLandscape(town) {
 const rng=makeRng(town.seed+7321),random=()=>rng.float(),roads=town.roads.filter(r=>r.kind==='world-link');
 const reserved=([x,z],margin=8)=>town.regions.some(({bounds:b})=>x>b.minX-margin&&x<b.maxX+margin&&z>b.minZ-margin&&z<b.maxZ+margin)
  || x>-154-margin&&x<73+margin&&z>-180-margin&&z<132+margin;
 const roadDistance=p=>Math.min(...town.roads.map(r=>r.centerline?separation(p,r.centerline):distanceToSegment(p,r.a,r.b)));
 const hills=[],models=[];
 for(let i=0;i<240;i++) {
  const p=[-236+random()*520,-252+random()*620],radius=10+random()*16;
  if(!insideLandscape(p)||reserved(p,radius)||roadDistance(p)<radius+8||MAINLAND.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<radius))continue;
  hills.push({pos:p,radius,height:7+random()*25,mountain:i%3===0});
 }
 for(let i=0;i<8500;i++) {
  const p=[-242+random()*540,-263+random()*640];
  if(!insideLandscape(p)||reserved(p,5)||roadDistance(p)<8)continue;
  const shore=separation(p,[...MAINLAND,MAINLAND[0]]);if(shore<7)continue;
  const h=hills.find(h=>Math.hypot(h.pos[0]-p[0],h.pos[1]-p[1])<h.radius+3);if(h)continue;
  const clustered=Math.sin(p[0]*.063)+Math.cos(p[1]*.071)+Math.sin((p[0]+p[1])*.036);
  const asset=i%17===0?'cv-rock-boulder':clustered>-.2?(i%4?'cv-tree-pine':'cv-tree-oak'):(i%3?'nat-tall-grass':'nat-wildflower');
  models.push({asset,pos:p,scale:asset.includes('tree')?.75+random()*.75:1.1+random()*1.4,rot:random()*6.28});
 }
 // Water is filtered after sampling, so the random stream (and every other
 // hill and tree) is unchanged; a hill never stands in or on the river's banks.
 const footprint=h=>[[0,0],...Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8)*.8])].map(([u,v])=>[h.pos[0]+u*h.radius,h.pos[1]+v*h.radius]);
 const dryHills=hills.filter(h=>!footprint(h).some(p=>inRiver(p,6)));
 const dryModels=models.filter(p=>!inRiver(p.pos,p.asset.includes('tree')?2.2:1.2));
 town.landscape={outline:MAINLAND,hills:dryHills,models:dryModels,roads:roads.map(r=>r.regionalId)};
}

// Compiler-owned inventory: each tree, meadow patch, hill, boat and road has a
// stable identity before rendering. No runtime registry exemptions or GLB bytes.
export function registerLandscape(town) {
 const records=[];
 const add=(item,id,name,type,pos,extra={})=>{
  item.registryId=id;const district=town.districts.reduce((a,b)=>Math.hypot(...b.center.map((v,k)=>v-pos[k]))<Math.hypot(...a.center.map((v,k)=>v-pos[k]))?b:a).id;
  records.push({id,name,type,kind:type,pos:[...pos],district,owner:'Astra town',occupants:[],hours:[0,24],capabilities:[],node:null,entryPoints:[],interactionPoints:[],...extra});
 };
 add(town.landscape,'landscape:mainland','Astra continuous mainland','area',[0,0]);
 add({},'landscape:ocean','Astra Gulf · shared ocean','area',[330,180]);
 town.landscape.hills.forEach((h,i)=>add(h,`landscape:hill-${i}`,h.mountain?'Pine ridge':'Rolling meadow hill','landmark',h.pos));
 town.landscape.models.forEach((p,i)=>add(p,`landscape:model-${i}`,p.asset.replaceAll('-',' '),'vegetation',p.pos,{asset:p.asset,scale:p.scale,rot:p.rot}));
 for(const [id,name,pos] of [['ferry','Saltwind coastal ferry',[195,85]],['sail-0','Ocean Drive sailboat',[330,105]],['sail-1','Gulf sailboat',[353,160]]])add({},`landscape:${id}`,name,'vehicle',pos);
 town.registry.places.push(...records);town.landscape.records=records;
}
