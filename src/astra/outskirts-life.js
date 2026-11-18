import { createVillagerMixer } from '../life/villager-mixer.js';
import { animationPlan, CLIP } from '../life/animation-plan.js';
import {bridgeDeck} from '../compiler/water.js';
import * as THREE from 'three';
import {place} from '../catalog/loader.js';
import {shortestPath} from '../compiler/astra.js';
import {toonMaterial} from '../toon.js';

// The same graph that connects town doors also carries these visitors. Each
// stop has a real arrival, a dwell activity, and a next errand; no dialogue.
export async function createOutskirtsLife(scene,town){
 const places=new Map(town.outskirts.destinations.map(d=>[d.id.replace('outskirts-',''),d]));
 places.set('market',{name:'Market Square',node:town.buildings.find(b=>b.id==='cv-store').node,activity:'Picking up supplies in town'});
 const specs=[
  ['Sylvie','Hiker','herbalist',['trailhead','lookout','cabin-1','dock','ranger']],
  ['Robin','Hiker','carpenter',['lookout','cabin-2','fire','trailhead']],
  ['Ellis','Hiker','merchant',['ranger','dock','lookout','market','trailhead']],
  ['Moss','Trail ranger','watch',['ranger','tent-0','lookout','dock','trailhead']],
  ['Kitty','Camper','shopkeeper',['tent-0','fire','dock','tent-0']],
  ['Sage','Camper','innkeeper',['tent-1','fire','lookout','tent-1']],
  ['Otto','Camper','miller',['tent-2','fire','cabin-2','tent-2']],
  ['Willa','Cabin guest','elder',['cabin-1','dock','trailhead','cabin-1']],
  ['Linden','Cabin guest','baker',['cabin-2','fire','cabin-1','cabin-2']],
  ['Ember','Farm worker','farmhand',['field','farm','orchard','farm']],
  ['Reed','Farm worker','carpenter',['orchard','farm','field','farm']],
  ['Nora','Farm worker','merchant',['farm','field','orchard','farm']],
  ['Alden','Angler','shopkeeper',['dock','cabin-1','dock','ranger']],
 ];
 const people=[],arrivals=[];let last=0;
 const segment=(a,b)=>[a.join(','),b.join(',')].sort().join('/');
 const trails=new Set(town.outskirts.roads.filter(r=>r.kind==='trail').map(r=>segment(r.a,r.b)));
 const poleGeometry=new THREE.CylinderGeometry(.021,.023,1.16,7),poleMaterial=toonMaterial('#796248');
 const up=new THREE.Vector3(0,1,0),grip=new THREE.Vector3(),aim=new THREE.Vector3();
 await Promise.all(specs.map(async([name,role,model,stops],i)=>{
  const object=await place('townsfolk-'+model,{scale:1.08,animated:true});scene.add(object);
  const start=places.get(stops[0]),pos=town.nodes[start.node];object.position.set(pos[0],.18,pos[1]);
  const mixer=createVillagerMixer(object,i);
  let pack=null,crate=null,rod=null,poles=[];
  if(mixer&&role==='Hiker')poles=mixer.hands.map(()=>{
   const pole=new THREE.Mesh(poleGeometry,poleMaterial);pole.visible=false;object.add(pole);return pole;
  });
  if(role==='Hiker'||role==='Trail ranger'){
   pack=new THREE.Mesh(new THREE.BoxGeometry(.46,.6,.23),toonMaterial(i%2?'#b78049':'#6e8893'));pack.position.set(0,1,-.3);object.add(pack);
  }
  if(role==='Farm worker'){
   crate=new THREE.Mesh(new THREE.BoxGeometry(.65,.38,.46),toonMaterial('#b28b51'));crate.position.set(0,.75,.42);crate.visible=false;object.add(crate);
   for(let n=0;n<5;n++){const apple=new THREE.Mesh(new THREE.IcosahedronGeometry(.11,1),toonMaterial('#bc7351'));apple.position.set((n%3-1)*.17,.24,Math.floor(n/3)*.15-.08);crate.add(apple);}
  }
  if(role==='Angler'){
   rod=new THREE.Group();const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,2.7,5),toonMaterial('#775d42'));shaft.rotation.x=-.65;shaft.position.set(.28,1.6,1);rod.add(shaft);
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.28,2.68,1.82),new THREE.Vector3(.28,-.05,2.5)]),new THREE.LineBasicMaterial({color:'#687d77'}));rod.add(line);object.add(rod);
  }
  people[i]={name,role,story:role==='Farm worker'?'There are rows to tend, apples to pick, and crates to carry home.':'A familiar face on the paths around Stillwater.',object,mixer,poles,stops,index:0,node:start.node,route:[],destination:start,wait:3+i*.7,speed:role==='Hiker'?1.48:1.15,activity:start.activity,visits:0,crate,rod,phase:i*2};
 }));
 function choose(p,hour){
  let key;
  if(hour>=21||hour<6)key=p.role==='Farm worker'?'farm':p.role==='Trail ranger'?'ranger':p.stops.find(s=>s.startsWith('tent')||s.startsWith('cabin'))||'ranger';
  else if(hour>=18&&p.role==='Camper')key=p.visits%2?'fire':p.stops[0];
  else key=p.stops[++p.index%p.stops.length];
  p.destination=places.get(key);p.route=shortestPath(town,p.node,p.destination.node).slice(1);
  p.activity=p.route.length?`Walking to ${p.destination.name}`:p.destination.activity;
  if(!p.route.length)p.wait=15;
 }
 return {people,arrivals,update(t,hour){
  const dt=Math.max(0,t-last);last=t;if(!dt)return;
  for(const p of people){const o=p.object;
   const animate=(distance=0,trail=false)=>{
    if(!p.mixer)return;
    const fishing=p.role==='Angler'&&!distance&&p.destination.id==='outskirts-dock'&&p.node===p.destination.node;
    const plan=animationPlan({tool:fishing?'work':distance?'walkTo':p.role==='Farm worker'?'work':undefined,
      role:p.role==='Hiker'?'hiker':fishing?'fisherman':undefined,place:{kind:trail?'trail':fishing?'pier':undefined},
      moving:distance>0,variant:p.phase});
    o.rotation.z=0;
    p.mixer.update(plan,{dt,distance});
    for(const [i,pole] of p.poles.entries()){
     pole.visible=plan.clip===CLIP.hike;
     if(!pole.visible)continue;
     p.mixer.hands[i].getWorldPosition(grip);o.worldToLocal(grip);
     aim.set(0,1,.18).normalize();
     pole.position.copy(grip).addScaledVector(aim,-.49);
     pole.quaternion.setFromUnitVectors(up,aim);
    }
   };
   if(p.wait>0){p.wait=Math.max(0,p.wait-dt);o.rotation.z=p.role==='Farm worker'&&p.destination.id==='outskirts-field'?-.18+Math.sin(t*2)*.04:Math.sin(t*.8+p.phase)*.015;if(p.rod){p.rod.visible=p.destination.id==='outskirts-dock';o.rotation.y=0;}animate();if(p.wait===0)choose(p,hour);continue;}
   if(!p.route.length){choose(p,hour);animate();continue;}
   if(p.rod)p.rod.visible=false;if(p.crate)p.crate.visible=p.destination.id==='outskirts-farm';
   // Consume the time budget over multiple short segments, even at 8x speed.
   let budget=dt*p.speed;const startBudget=budget,trail=trails.has(segment(town.nodes[p.node],town.nodes[p.route[0]]));
   while(budget>0&&p.route.length){const next=town.nodes[p.route[0]],dx=next[0]-o.position.x,dz=next[1]-o.position.z,d=Math.hypot(dx,dz),step=Math.min(d,budget);if(d>.0001){o.position.x+=dx/d*step;o.position.z+=dz/d*step;o.rotation.y=Math.atan2(dx,dz);}budget-=step;
    if(d<=step+.0001){p.node=p.route.shift();if(!p.route.length){p.visits++;p.wait=p.role==='Angler'&&p.destination.id==='outskirts-dock'?30:p.role==='Farm worker'?9:12;p.activity=p.destination.activity;arrivals.push({person:p.name,destination:p.destination.name,node:p.node,time:+t.toFixed(2)});if(arrivals.length>250)arrivals.shift();o.rotation.z=0;if(p.crate)p.crate.visible=false;break;}}
   }
   // Boardwalk is the only allowed lake crossing, and has a raised deck.
   const deck=Math.abs(o.position.x+10)<.8&&o.position.z>=49&&o.position.z<=56,bridge=bridgeDeck(town,[o.position.x,o.position.z]);
   o.position.y=(deck?.46:bridge??.18)+(p.mixer?0:Math.abs(Math.sin(t*7+p.phase))*.035);
   if(p.mixer)animate(startBudget-budget,trail);else if(p.route.length)o.rotation.z=Math.sin(t*7+p.phase)*.025;
  }
 },pick(ray){let best=null,distance=Infinity;for(const p of people){const center=p.object.position.clone().add(new THREE.Vector3(0,.9,0)),hit=ray.intersectSphere(new THREE.Sphere(center,.7),new THREE.Vector3());if(hit&&ray.origin.distanceTo(hit)<distance){distance=ray.origin.distanceTo(hit);best=p;}}return best;},audit(){return people.map(p=>({name:p.name,role:p.role,node:p.node,position:p.object.position.toArray(),activity:p.activity,destination:p.destination.name,walking:!!p.route.length,visits:p.visits}));}};
}
