import { villagerObstructions } from '../compiler/villagers.js';
import { TOWNSFOLK } from '../catalog/townsfolk.js';
import { makeRng, deriveSeed } from '../compiler/rng.js';
import { toWorldXZ } from '../compiler/geometry.js';
import { buildWalkGraph, nearestNode, distance, blockers, blocked } from './graph.js';
export function spawnTownsfolk(town,catalog){
 const graph=buildWalkGraph(town,catalog),rng=makeRng(deriveSeed(town.seed,8161));
 // Short, clear market spurs let buyers reach the counter rather than
 // stopping six metres away on the main street. Life-only navigation data.
 const solids=blockers(town,catalog);
 for(const stall of town.instances.filter(i=>i.id==='cv-market-stall')){
  const front=toWorldXZ([0,catalog.get(stall.id).footprint.max[1]+.65],{x:stall.pos[0],z:stall.pos[1],rotY:stall.rotY});
  let previous=nearestNode(graph,front);const from=graph.nodes[previous].pos,steps=Math.ceil(distance(from,front)/.55);
  const points=Array.from({length:steps},(_,k)=>[from[0]+(front[0]-from[0])*(k+1)/steps,from[1]+(front[1]-from[1])*(k+1)/steps]);
  if(points.some(p=>blocked(p,solids,.3)))continue;
  for(const pos of points){const n=graph.nodes.length;graph.nodes.push({pos:pos.map(v=>+v.toFixed(5)),street:'stall-front'});graph.edges.push([previous]);graph.edges[previous].push(n);graph.connected.push(n);previous=n;}
 }
 const homes=town.instances.filter(i=>i.kind==='house'&&i.district!=='edo');
 const buildings=town.instances.filter(i=>['house','landmark'].includes(i.kind)&&i.district!=='edo');
 const used=new Set();
 const destination=(b,unique=false)=>{const snap=catalog.get(b.id).pathSnaps?.[0];const pos=snap?toWorldXZ([snap.pos[0],snap.pos[2]],{x:b.pos[0],z:b.pos[1],rotY:b.rotY}):b.pos;let node=nearestNode(graph,pos);if(unique){const options=graph.connected.filter(n=>!used.has(n)).sort((a,b)=>distance(graph.nodes[a].pos,pos)-distance(graph.nodes[b].pos,pos));node=options.find(n=>[...used].every(u=>distance(graph.nodes[u].pos,graph.nodes[n].pos)>.85))??node;used.add(node);}return {id:b.id,lot:b.lot,node};};
 town.life={graph,reservations:[]};
 for(const [n,v] of TOWNSFOLK.entries()){
  const home=destination(homes[n%homes.length]);const work=destination(buildings.find(i=>i.id===v.work)||buildings.find(i=>i.id==='cv-market-hall'),true);
  const plaza=nearestNode(graph,[n%2?30:(n-6)*.85,n%2?-8-n:6]);const offset=+rng.float(-.45,.45).toFixed(4);
  const schedule=[{hour:0,node:home.node,activity:'home'},{hour:7+offset,node:work.node,activity:'work'},{hour:16+offset,node:plaza,activity:'plaza'},{hour:19+offset,node:home.node,activity:'home'}];
  town.instances.push({id:v.id,kind:'villager',district:'cozy',pos:[...graph.nodes[home.node].pos],rotY:0,scale:1,home,workplace:work,schedule,motion:{mode:'schedule',phase:rng.float(0,6.28),speed:1.3+n*.025,lane:n%2?.12:-.12}});
 }
 // Reservations own activity places, never graph edges: walkers can pass freely.
 const residents=town.instances.filter(i=>i.id.startsWith('townsfolk-'));
 const claimed=[...used];
 const reserve=(type,ids,near,start,end,target)=>{
  const nodes=ids.map(()=>{const n=graph.connected.filter(n=>claimed.every(c=>distance(graph.nodes[n].pos,graph.nodes[c].pos)>1.05)).sort((a,b)=>distance(graph.nodes[a].pos,near)-distance(graph.nodes[b].pos,near))[0];claimed.push(n);return n;});
  const event={key:`${type}-${town.seed}`,type,ids,nodes,start,end,target};town.life.reservations.push(event);
  ids.forEach((id,k)=>{const p=residents.find(p=>p.id===id);const resume=activityAt(p,end);p.schedule=p.schedule.filter(s=>s.hour<=start||s.hour>=end);p.schedule.push({hour:start,node:nodes[k],activity:type,reservation:event.key},{...resume,hour:end});p.schedule.sort((a,b)=>a.hour-b.hour);});
 };
 const front=id=>{const b=town.instances.find(i=>i.id===id);return b?graph.nodes[destination(b).node].pos:[0,10];};
 const names=roles=>roles.map(r=>`townsfolk-${r}`);
 const jitter=+rng.float(0,.08).toFixed(4);
 reserve('greet',names(['baker','blacksmith']),front('cv-blacksmith'),9,9.12,'cv-blacksmith');
 reserve('chat',names(['elder','miller']),[2,10],11.5+jitter,13.5,'plaza');
 reserve('shop',names(['carpenter']),front('cv-market-stall'),10+jitter,13,'cv-market-stall');
 reserve('eat',names(['farmhand']),front('cv-tavern'),12,13.5,'cv-tavern');
 reserve('play',names(['child']),[-3,10],11+jitter,18,'plaza');
}
export function lifeFailures(town,catalog){
 const people=town.instances.filter(i=>i.id.startsWith('townsfolk-')),f=[];
 if(!town.life){if(people.length)f.push({msg:'Townsfolk require life mode'});return f;}
 const g=town.life.graph,boxes=blockers(town,catalog);
 const clearNode=n=>g?.nodes?.[n]&&!blocked(g.nodes[n].pos,boxes,.30);
 if(people.length<12||new Set(people.map(i=>i.id)).size<12)f.push({msg:'Expected twelve distinct townsfolk'});
 for(const i of people){if(!Number.isFinite(i.y??0)||Math.abs((i.y??0)+catalog.get(i.id).bounds.min[1]*(i.scale||1))>.12)f.push({msg:`${i.id} feet above/below ground`});
  if(i.kind!=='villager'||!i.home||!i.workplace||!i.schedule?.length)f.push({msg:`${i.id} needs home, workplace and schedule`});
  if(!g?.nodes?.length||!g.connected.some(n=>distance(g.nodes[n].pos,i.pos)<.03))f.push({msg:`${i.id} off walk graph`,a:i.pos});
  if(blocked(i.pos,boxes,.28) || villagerObstructions(i,town.instances,catalog).some(b=>b.kind!=='gate'))f.push({msg:`${i.id} intersects architecture`,a:i.pos});
  if(i.schedule?.some(s=>!Number.isFinite(s.hour)||s.hour<0||s.hour>=24||!s.activity))f.push({msg:`${i.id} invalid schedule`});
  for(const n of [i.home?.node,i.workplace?.node,...(i.schedule||[]).map(s=>s.node)]){if(!g.connected.includes(n))f.push({msg:`${i.id} unreachable destination`});
   else if(!clearNode(n))f.push({msg:`${i.id} destination inside architecture`,a:g.nodes[n].pos});}
 }
 const events=town.life.reservations||[],keys=new Set();
 for(const type of ['greet','chat','shop','eat','play'])if(!events.some(e=>e.type===type))f.push({msg:`Missing ${type} reservation`});
 for(const e of events){
  if(keys.has(e.key)||!e.key||!(e.start<e.end)||e.start<0||e.end>19||e.ids?.length!==e.nodes?.length||!e.ids?.length)f.push({msg:'Invalid interaction reservation'});keys.add(e.key);
  if(['greet','chat'].includes(e.type)&&new Set(e.ids).size<2)f.push({msg:'Pair interaction needs two residents'});
  if(e.type==='play'&&!e.ids.includes('townsfolk-child')||e.type==='shop'&&e.target!=='cv-market-stall'||e.type==='eat'&&e.target!=='cv-tavern')f.push({msg:'Wrong activity destination'});
  for(const [k,id] of e.ids.entries()){const p=people.find(p=>p.id===id);if(!clearNode(e.nodes[k])||!g.connected.includes(e.nodes[k])||!p?.schedule?.some(s=>s.reservation===e.key&&s.node===e.nodes[k]&&s.activity===e.type&&s.hour===e.start))f.push({msg:'Missing reachable activity slot'});}
  for(const other of events)if(other!==e&&e.start<other.end&&other.start<e.end&&e.nodes.some(n=>other.nodes.includes(n)))f.push({msg:'Interaction reservation conflict'});
 }
 return f;
}
export function activityAt(person,hour){let result=person.schedule[0];for(const s of person.schedule)if(hour>=s.hour)result=s;return result;}
