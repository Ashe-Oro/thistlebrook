// Pinecrest is intentionally independent of the town parcel compiler. Its local
// pedestrian graph owns paths, queues, and arrivals; only the approach meets town.
// Everything inside the fence is laid out on a 4 m path grid (RollerCoaster
// Tycoon style) and dressed with the Fairground & Amusement Park pack.
import {layCoaster} from './themepark-coaster.js';

export const PARK_ORIGIN = [220, -52];
export const THEMEPARK_BOUNDS = {minX:65,maxX:286,minZ:-148,maxZ:35};
export const THEMEPARK_VIEWS = {
 themepark:{x:222,z:-56,zoom:1.13},
 mountainpass:{x:133,z:-22,zoom:1.7},
 parkcoasters:{x:216,z:-78,zoom:1.65},
 countryside:{x:75,z:-60,zoom:.49},
};
export const APPROACH = [[46,-14.5],[61,-14.5],[77,-17],[90,-27],[102,-35],[115,-29],[124,-12],[141,-8],[154,-21],[163,-24],[162,1],[178,16],[200,18],[215,12],[220,5]];
export const PATH_TILE = 4;

// Path junctions (park-local metres, +z faces the entrance). Every edge is an
// axis-aligned run of 4 m midway tiles, so the tile map is derived from it.
export const PARK_NODES = {
 gate:[0,52],entry:[0,44],plazaW:[-12,44],plazaE:[12,44],midway:[0,32],hub:[0,24],court:[0,20],
 games:[-12,32],gamesW:[-24,32],food:[12,32],foodE:[24,32],
 promW:[-8,24],bumpers:[-20,24],wheel:[-36,24],promE:[8,24],chairs:[20,24],drop:[36,24],
 northW:[-8,0],northE:[8,0],copper:[-24,0],lookout:[24,0],bigtop:[32,0],
};
export const PARK_EDGES = [
 ['gate','entry'],['entry','midway'],['entry','plazaW'],['entry','plazaE'],['midway','hub'],['hub','court'],
 ['midway','games'],['games','gamesW'],['midway','food'],['food','foodE'],
 ['hub','promW'],['promW','bumpers'],['bumpers','wheel'],['hub','promE'],['promE','chairs'],['chairs','drop'],
 ['promW','northW'],['promE','northE'],['northW','northE'],['northW','copper'],['northE','lookout'],['lookout','bigtop'],
];
// Wide plazas (tile rectangles, inclusive tile centres).
export const PLAZAS = [
 {from:[-12,44],to:[12,48],tile:'paved_midway_tile'},
 {from:[-4,52],to:[4,52],tile:'road_plaza_tile'},
];
// Signature fixtures that own their own paving.
export const COURTS = [
 {id:'fountain-court',asset:'fountain_court',x:0,z:12,rot:0},
 {id:'game-row',asset:'game_booth_row',x:-14,z:40,rot:Math.PI},
 {id:'food-row',asset:'food_stall_cluster',x:14,z:40,rot:Math.PI},
];

// Queue lanes: road_queue_lane tiles with the switchbacks walked in order.
// `tiles` run from the path node toward the ride; `board` is the loading point.
export const RIDE_QUEUES = {
 copperhead:{node:'copper',dir:[0,-1],tiles:[[-24,-4],[-24,-8]],board:[-24,-11.6],exit:[-20.5,-11.2]},
 'skyline-wheel':{node:'wheel',dir:[0,-1],tiles:[[-36,20]],board:[-36,17.4],exit:[-31.5,18]},
 'pine-bumpers':{node:'bumpers',dir:[0,-1],tiles:[[-20,20]],board:[-20,17.6],exit:[-16.5,18]},
 'swinging-pines':{node:'chairs',dir:[0,-1],tiles:[[20,20]],board:[20,17.4],exit:[23.5,18]},
 pinefall:{node:'drop',dir:[0,-1],tiles:[[36,20]],board:[36,16.8],exit:[39.5,18]},
 carousel:{node:'gamesW',dir:[-1,0],tiles:[[-28,32]],board:[-31.2,35.6],exit:[-27,37]},
 'teacup-twirl':{node:'foodE',dir:[1,0],tiles:[[28,32]],board:[31.4,35.8],exit:[27,37]},
 'little-racers':{node:'plazaW',dir:[-1,0],tiles:[[-16,44]],board:[-18.6,44.6],exit:[-17,47.6]},
 'pinecrest-express':{node:'northE',dir:[0,1],tiles:[],board:[11,3.5],exit:[6,3.5]},
};
// Zig-zag through one queue tile entering at local +z and leaving at -z.
const ZIGZAG = [[1.55,2],[1.55,1.05],[-1.55,1.05],[-1.55,0],[1.55,0],[1.55,-1.05],[-1.55,-1.05],[-1.55,-2]];
export function queueTileYaw(dir){return Math.atan2(-dir[0],-dir[1]);}
export function queuePath(id){
 const q=RIDE_QUEUES[id],points=[PARK_NODES[q.node]];
 for(const [x,z]of q.tiles){const yaw=queueTileYaw(q.dir),c=Math.cos(yaw),s=Math.sin(yaw);for(const [lx,lz]of ZIGZAG)points.push([+(x+lx*c+lz*s).toFixed(3),+(z-lx*s+lz*c).toFixed(3)]);}
 points.push(q.board);
 return points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>1e-6);
}
export const QUEUES = Object.fromEntries(Object.keys(RIDE_QUEUES).map(id=>[id,queuePath(id)]));

// Copperhead: a 30-piece circuit of the snap-together kit. Station → six-piece
// chain lift → 180° turn at the top → long drop → camelback → back to station.
export const COPPERHEAD_SEQUENCE = ['ST','ST','S','U0','LIFT','LIFT','LIFT','LIFT','LIFT','LIFT','U1','A','S','S','A','D0','D','D','D','D','D','D1','U0','U1','D0','D1','A','D0','D1','A'];
export const COPPERHEAD = layCoaster({origin:[-30,-14],heading:[1,0],sequence:COPPERHEAD_SEQUENCE});

/**
 * Rides: model, local position/rotation/scale, ride cycle (s) and seat count.
 * `cycle` includes loading; flat rides share one dispatch per cycle.
 */
export const RIDES = [
 {id:'copperhead',name:'Copperhead',kind:'coaster',x:-2,z:-29,w:90,d:36,h:24,cycle:null,seats:36,story:'Thirty pieces of snap-together track: a chain lift that climbs 21 m beside the midway, a 180° turn over the pines, a long copper drop and a camelback hop home. Two trains, eighteen riders each.'},
 {id:'skyline-wheel',name:'Skyline Wheel',kind:'wheel',asset:'ferris_wheel',x:-36,z:12,rot:0,scale:2,cycle:64,seats:32,w:22,d:9,h:24,story:'Sixteen gondolas stay level as the wheel turns above the forest. Riders board at the bottom and ride one slow revolution.'},
 {id:'pine-bumpers',name:'Pine Bumpers',kind:'bumpers',asset:'bumper_car_pavilion',x:-20,z:12,rot:0,scale:1.8,cycle:42,seats:7,w:10,d:10,h:5.2,story:'Seven dodgems weave under a striped canopy. Every round ends with a polite pile-up near the entrance.'},
 {id:'swinging-pines',name:'Swingin’ Pines',kind:'swings',asset:'chair_o_plane',x:20,z:12,rot:0,scale:1.7,cycle:40,seats:12,w:10,d:10,h:8,story:'A chair-o-plane: the canopy spins up, the chairs fly out over the promenade, then settle for the next riders.'},
 {id:'pinefall',name:'Pinefall',kind:'drop',asset:'drop_tower',x:36,z:12,rot:0,scale:2.6,cycle:30,seats:8,w:7,d:7,h:28.5,story:'Load, lift, wait… drop. Eight riders rise slowly to the treetops before a quick plunge back to the midway.'},
 {id:'carousel',name:'Woodland Carousel',kind:'carousel',asset:'gallopers_carousel',x:-36,z:40,rot:0,scale:1.6,cycle:44,seats:16,w:11,d:11,h:7.2,story:'Gallopers bob on brass poles beneath a red and white canopy. The organ never quite stops.'},
 {id:'teacup-twirl',name:'Teacup Twirl',kind:'teacups',asset:'teacups',x:36,z:40,rot:0,scale:1.8,cycle:38,seats:18,w:9,d:9,h:4.6,story:'Six cups spin on a turning saucer. The middle wheel is for riders who want it faster.'},
 {id:'little-racers',name:'Little Racers',kind:'kiddie',asset:'kiddie_ride_car',x:-22,z:46,rot:0,scale:1.25,cycle:34,seats:5,w:7,d:7,h:2,story:'Five smiling cars circle a little track for the youngest guests. Parents watch from the picnic tables.'},
 {id:'pinecrest-express',name:'Pinecrest Express',kind:'tram',asset:'park_tram',x:0,z:3.5,rot:0,scale:1.5,cycle:70,seats:8,w:64,d:4,h:3,story:'A little steam-style tram shuttles along the north walk between the coaster and the big top.'},
];
// Seats held back for town residents (the highest seat numbers of each ride).
export const residentSeats=ride=>Math.max(1,Math.min(4,Math.floor(ride.seats/6)));
export const TRAM_LINE = {z:3.5,from:-30,to:30};
export const BIG_TOP = {id:'big-top',name:'Pinecrest Big Top',asset:'big_top_tent',x:40,z:-2,rot:-Math.PI/2,scale:1.7};

// Stalls, booths and stands (local; rot 0 faces +z).
export const STALLS = [
 {id:'cotton-candy',asset:'cotton_candy_stall',x:5.5,z:28,rot:0,kind:'eat',label:'Buying cotton candy'},
 {id:'popcorn',asset:'popcorn_stall',x:10,z:28,rot:0,kind:'eat',label:'A bag of warm popcorn'},
 {id:'ice-cream',asset:'ice_cream_stand',x:14.5,z:28,rot:0,kind:'eat',label:'An ice cream at the stand'},
 {id:'hot-dogs',asset:'hot_dog_cart',x:19,z:28,rot:0,kind:'eat',label:'Hot dogs from the cart'},
 {id:'balloons',asset:'balloon_cart',x:23,z:28,rot:0,kind:'watch',label:'Choosing a balloon'},
 {id:'hoopla',asset:'hoopla_booth',x:-5.5,z:28,rot:0,kind:'play',label:'Hoopla at the booth'},
 {id:'ring-toss',asset:'ring_toss_booth',x:-10,z:28,rot:0,kind:'play',label:'Ring toss'},
 {id:'shooting-gallery',asset:'shooting_gallery_booth',x:-14.5,z:28,rot:0,kind:'play',label:'A round at the shooting gallery'},
 {id:'prize-shelf',asset:'prize_shelf',x:-19,z:28,rot:0,kind:'play',label:'Claiming a prize'},
 {id:'hot-dogs-north',asset:'hot_dog_cart',x:21,z:-3.6,rot:0,kind:'eat',label:'Hot dogs by the coaster'},
 {id:'popcorn-north',asset:'popcorn_stall',x:-14,z:-3.6,rot:0,kind:'eat',label:'Popcorn beside the coaster queue'},
];
export const PICNIC_TABLES = [[5,37],[9,46.5],[14,46.5],[19,46.5],[28,45],[28,49],[-28,48],[17,-5],[29,-5.5],[30,6]];
// Benches: [x,z,rot]; watchers face the rides.
export const BENCHES = [
 [-28,27.2,0],[-12,27.2,0],[14,21,Math.PI],[28,21,Math.PI],[-4,21,0],[4,21,0],
 [-30,-2.4,Math.PI],[-18,-2.4,Math.PI],[0,-2.4,Math.PI],[4,-2.4,Math.PI],[-4,-2.4,Math.PI],
 [-6,48.6,0],[6,48.6,0],[-30,44,Math.PI/2],[31,49,0],[22,37,0],
];

// Registry-backed activity points. One source drives the life registry, the
// Pinecrest crowd and the visuals; positions are park-local.
export const PARK_ACTIVITIES = buildActivities();
function buildActivities(){
 const list=[],dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const walkTo=(node,target)=>[PARK_NODES[node],target];
 for(const ride of RIDES){
  const q=RIDE_QUEUES[ride.id],path=QUEUES[ride.id],board=q.board;
  // Queue points: evenly along the lane, nearest the ride first.
  const queueSlots=[];let total=0;const lengths=[0];for(let i=1;i<path.length;i++){total+=dist(path[i-1],path[i]);lengths.push(total);}
  for(let d=total-1.1,k=0;d>2.5&&k<10;d-=1.6,k++){let i=1;while(i<path.length-1&&lengths[i]<d)i++;const a=path[i-1],b=path[i],u=(d-lengths[i-1])/(lengths[i]-lengths[i-1]||1),p=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];queueSlots.push({position:p.map(v=>+v.toFixed(3)),facing:Math.atan2(b[0]-a[0],b[1]-a[1]),approach:path.slice(1,i).concat([a]).filter((v,j,arr)=>j===0||dist(v,arr[j-1])>1e-6)});}
  list.push({id:`pinecrest:queue:${ride.id}`,ride:ride.id,activity:'queue',name:`${ride.name} queue`,label:`Queueing for ${ride.name}`,node:q.node,duration:40,animation:'idle',kind:'standing',slots:queueSlots});
  // Ride seats reserved for residents: distinct loading marks beside the platform.
  const across=[-q.dir[1],q.dir[0]],seats=[];
  const reserved=residentSeats(ride);for(let k=0;k<reserved;k++){const off=(k-(reserved-1)/2)*.62;seats.push({position:[+(board[0]+across[0]*off).toFixed(3),+(board[1]+across[1]*off).toFixed(3)],facing:Math.atan2(q.dir[0],q.dir[1]),approach:path.slice(1,-1),seat:ride.seats-1-k});}
  list.push({id:`pinecrest:ride:${ride.id}`,ride:ride.id,activity:'ride',name:ride.name,label:`Riding ${ride.name}`,node:q.node,duration:ride.kind==='coaster'?100:Math.max(60,(ride.cycle||40)*2),animation:'idle',kind:'standing',slots:seats});
 }
 for(const s of STALLS){
  const yaw=s.rot,front=[Math.sin(yaw),Math.cos(yaw)],side=[Math.cos(yaw),-Math.sin(yaw)],node=nearestNode([s.x+front[0]*3,s.z+front[1]*3]);
  const slots=[-.7,.7].map(o=>{const p=[s.x+front[0]*2.1+side[0]*o,s.z+front[1]*2.1+side[1]*o];return {position:p.map(v=>+v.toFixed(3)),facing:yaw+Math.PI,approach:[]};});
  list.push({id:`pinecrest:${s.kind}:${s.id}`,stall:s.id,activity:s.kind==='eat'?'picnic':s.kind,name:s.label,label:s.label,node,duration:s.kind==='play'?36:28,animation:s.kind==='play'?'work':s.kind==='eat'?'eat':'idle',kind:'standing',slots});
 }
 for(const [n,[x,z]]of PICNIC_TABLES.entries()){
  const node=nearestNode([x,z]);
  list.push({id:`pinecrest:picnic:${n}`,activity:'picnic',name:'Pinecrest picnic table',label:'Lunch at a Pinecrest picnic table',node,duration:45,animation:'eat',kind:'seat',seatHeight:.45,slots:[[-1,0],[1,0]].map(([sx],k)=>({position:[+(x).toFixed(3),+(z+sx*.62).toFixed(3)],facing:sx>0?Math.PI:0,approach:[[x+1.6,z+sx*.62]]}))});
 }
 for(const [n,[x,z,rot]]of BENCHES.entries()){
  const node=nearestNode([x,z]),front=[Math.sin(rot),Math.cos(rot)],side=[Math.cos(rot),-Math.sin(rot)];
  const watching=z<0||Math.abs(z-21)<1||z===27.2;
  list.push({id:`pinecrest:watch:bench-${n}`,activity:'watch',name:'Pinecrest bench',label:watching?'Watching the rides from a bench':'A rest on a Pinecrest bench',node,duration:40,animation:'sit',kind:'seat',seatHeight:.46,slots:[-.42,.42].map(o=>({position:[+(x+side[0]*o+front[0]*.05).toFixed(3),+(z+side[1]*o+front[1]*.05).toFixed(3)],facing:rot,approach:[[x+side[0]*o+front[0]*1,z+side[1]*o+front[1]*1]]}))});
 }
 // Watching: the lift hill rail, the fountain, the big top show.
 const lookout=[[10.5,-3],[12.7,-3],[14.9,-3],[24.5,-3],[26.7,-3]].map(p=>({position:p,facing:Math.PI,approach:[[p[0],-.8]]}));
 list.push({id:'pinecrest:watch:coaster-lookout',activity:'watch',name:'Copperhead lookout',label:'Watching Copperhead climb the lift',node:'lookout',duration:34,animation:'idle',kind:'standing',slots:lookout});
 const show=[];for(let r=0;r<3;r++)for(let c=0;c<4;c++)show.push({position:[37+r*1.6,-5+c*1.7],facing:Math.PI/2,approach:[[34.6,-2],[35.8,-2]]});
 list.push({id:'pinecrest:watch:big-top',activity:'watch',name:'Pinecrest Big Top',label:'Watching the circus in the Big Top',node:'bigtop',duration:60,animation:'sit',kind:'seat',seatHeight:.5,slots:show,hidden:true});
 const fountain=[[-3.6,8.6],[3.6,8.6],[-4.8,12],[4.8,12]].map(p=>({position:p,facing:Math.atan2(-p[0],12-p[1]),approach:[[p[0]*1.2,17]]}));
 list.push({id:'pinecrest:watch:fountain',activity:'watch',name:'Fountain court',label:'Watching the fountain',node:'court',duration:30,animation:'idle',kind:'standing',slots:fountain});
 for(const a of list){a.node??='hub';for(const s of a.slots)s.position=s.position.map(v=>+(+v).toFixed(3));}
 return list;
}
function nearestNode(p){return Object.entries(PARK_NODES).filter(([k])=>k!=='gate').sort((a,b)=>Math.hypot(a[1][0]-p[0],a[1][1]-p[1])-Math.hypot(b[1][0]-p[0],b[1][1]-p[1]))[0][0];}

// Venues that join the world graph (registry areas + info cards).
export const PARK_VENUES = [
 ['pinecrest','Pinecrest Adventure Park','entry'],['copperhead','Copperhead','copper'],['skyline-wheel','Skyline Wheel','wheel'],['pinefall','Pinefall','drop'],['carousel','Woodland Carousel','gamesW'],['pinecrest-food','Pinecrest Food Court','food'],
 ['teacup-twirl','Teacup Twirl','foodE'],['swinging-pines','Swingin’ Pines','chairs'],['pine-bumpers','Pine Bumpers','bumpers'],['pinecrest-midway','Pinecrest Midway Games','games'],['big-top','Pinecrest Big Top','bigtop'],['little-racers','Little Racers','plazaW'],
];

export function parkRoute(start,end){
 const distance={[start]:0},previous={},open=new Set(Object.keys(PARK_NODES));
 while(open.size){let u=[...open].sort((a,b)=>(distance[a]??Infinity)-(distance[b]??Infinity))[0];if(u===end)break;open.delete(u);
  for(const [a,b]of PARK_EDGES){const v=a===u?b:b===u?a:null;if(!v||!open.has(v))continue;const p=PARK_NODES[u],q=PARK_NODES[v],d=distance[u]+Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<(distance[v]??Infinity)){distance[v]=d;previous[v]=u;}}
 }
 const result=[end];while(result[0]!==start){const p=previous[result[0]];if(!p)throw Error(`Disconnected park path ${start} → ${end}`);result.unshift(p);}return result.map(k=>PARK_NODES[k]);
}
export function sampleWalk(points,distance){
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1e-9)continue;if(distance<=length)return{x:a[0]+(b[0]-a[0])*distance/length,z:a[1]+(b[1]-a[1])*distance/length,yaw:Math.atan2(b[0]-a[0],b[1]-a[1])};distance-=length;}
 const p=points.at(-1),q=points.at(-2)||p;return{x:p[0],z:p[1],yaw:Math.atan2(p[0]-q[0],p[1]-q[1])||0};
}
export const routeLength=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);

// Path tiles derived from the edges: each tile knows its open sides.
export function pathTiles(){
 const tiles=new Map(),key=(x,z)=>x+','+z;
 const open=(x,z,side)=>{const k=key(x,z);if(!tiles.has(k))tiles.set(k,{x,z,open:new Set()});if(side)tiles.get(k).open.add(side);};
 for(const [a,b]of PARK_EDGES){
  const p=PARK_NODES[a],q=PARK_NODES[b],dx=Math.sign(q[0]-p[0]),dz=Math.sign(q[1]-p[1]),steps=Math.round(Math.max(Math.abs(q[0]-p[0]),Math.abs(q[1]-p[1]))/PATH_TILE);
  for(let i=0;i<=steps;i++){const x=p[0]+dx*i*PATH_TILE,z=p[1]+dz*i*PATH_TILE;open(x,z);if(i<steps)open(x,z,dx>0?'E':dx<0?'W':dz>0?'S':'N');if(i>0)open(x,z,dx>0?'W':dx<0?'E':dz>0?'N':'S');}
 }
 // Queue lanes and plazas join the tiles they touch.
 for(const q of Object.values(RIDE_QUEUES))if(q.tiles.length){const n=PARK_NODES[q.node],t=tiles.get(key(n[0],n[1]));t?.open.add(q.dir[0]>0?'E':q.dir[0]<0?'W':q.dir[1]>0?'S':'N');}
 const plaza=new Set();for(const p of PLAZAS)for(let x=p.from[0];x<=p.to[0];x+=PATH_TILE)for(let z=p.from[1];z<=p.to[1];z+=PATH_TILE)plaza.add(key(x,z));
 for(const k of plaza)tiles.delete(k);
 for(const c of COURTS)for(const [k,t]of tiles)if(Math.abs(t.x-c.x)<6&&Math.abs(t.z-c.z)<6)tiles.delete(k);
 for(const t of tiles.values())for(const [side,dx,dz]of [['E',4,0],['W',-4,0],['S',0,4],['N',0,-4]])if(plaza.has(key(t.x+dx,t.z+dz)))t.open.add(side);
 return [...tiles.values()].map(t=>({...t,...tileFor(t.open)}));
}
// road_midway_straight runs N–S; corner joins W+S; T is closed on N.
function tileFor(open){
 const has=s=>open.has(s),n=open.size,ROT={N:0,E:-Math.PI/2,S:Math.PI,W:Math.PI/2};
 if(n>=4)return {asset:'road_midway_4way',rot:0};
 if(n===3){const closed=['N','E','S','W'].find(s=>!has(s));return {asset:'road_midway_t',rot:ROT[closed]};}
 if(n===2&&!(has('N')&&has('S'))&&!(has('E')&&has('W'))){
  // Rotate the W+S corner to the open pair.
  const pairs=[[['W','S'],0],[['S','E'],Math.PI/2],[['E','N'],Math.PI],[['N','W'],-Math.PI/2]];
  return {asset:'road_midway_corner',rot:pairs.find(([p])=>p.every(has))[1]};
 }
 return {asset:'road_midway_straight',rot:has('E')||has('W')?Math.PI/2:0};
}
// Shared terrain envelope for rendering and cross-district aircraft clearance.
export const PARK_MOUNTAINS=[[87,-67,18,23],[111,-63,23,34],[137,-58,24,40],[160,-66,23,31],[162,-82,14,28],[213,-131,18,25],[254,-126,18,27],[105,0,10,13],[143,13,10,12]];
