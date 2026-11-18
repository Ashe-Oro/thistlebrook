import { animationPlan, CLIP } from './animation-plan.js';
import { createVillagerMixer } from './villager-mixer.js';
import { activityAt } from './schedules.js';
import { nearestNode, route, distance, blockers, blocked } from './graph.js';
import { RESOLVED } from '../catalog/loader.js';
import { createArrivalSlots } from './arrival-slots.js';
// Townsfolk have independent state. Seeking time reconstructs a sensible pose;
// ordinary ticking changes goals and walks every waypoint without teleporting.
export function createPeople(town,scene){
 const graph=town.life.graph,boxes=blockers(town,RESOLVED),people=[];
 scene.traverse(o=>{if(o.userData.inst?.id.startsWith('townsfolk-'))people.push({o,i:o.userData.inst,path:[],goal:-1,node:0,baseY:.03-RESOLVED.get(o.userData.inst.id).bounds.min[1]*(o.userData.inst.scale||1)});});
 // Ground from measured feet, never inherit a placement/parent height.
 for(const [index,p] of people.entries()){
  scene.attach(p.o);p.o.position.y=p.baseY;
  p.mixer=createVillagerMixer(p.o,index);p.variant=index;
 }
 const places=new Map(town.registry?.places.map(place=>[place.id,place]));
 const activities={greet:'talkTo',chat:'talkTo',work:'work',shop:'buy',eat:'eat',play:'visit'};
 function pose(p,activity,dt,distance=0,immediate=false){
  const tool=p.o.userData.tool||activities[activity];
  const place=places.get(p.o.userData.destination);
  const plan=animationPlan({tool,place,position:[p.o.position.x,p.o.position.z],moving:distance>0,variant:p.variant,
   role:p.i.id.slice('townsfolk-'.length)});
  if(plan.clip===CLIP.wave){
   if(p.lastActivity!==activity||p.lastTool!==tool||immediate)p.wave=1.25;
   p.wave-=dt;
   if(p.wave<=0)plan.clip=CLIP.idle;
  }
  p.lastActivity=activity;p.lastTool=tool;
  p.mixer.update(plan,{dt,distance,immediate});
 }
 const warned=new Set();
 function setGoal(p,goal){p.goal=goal;p.node=nearestNode(graph,[p.o.position.x,p.o.position.z]);p.path=route(graph,p.node,goal).slice(1);if(!p.path.length&&p.node!==goal&&!warned.has(p.i.id)){console.warn(`[life] ${p.i.id}: unreachable destination; snapped to nearest walk node`);warned.add(p.i.id);p.o.position.set(graph.nodes[p.node].pos[0],p.baseY,graph.nodes[p.node].pos[1]);}}
 function seek(hour){for(const p of people){const s=activityAt(p.i,hour);p.node=s.node;p.goal=s.node;p.path=[];const pos=graph.nodes[s.node].pos;p.o.position.set(pos[0],p.baseY,pos[1]);p.o.userData.activity=s.activity;if(p.mixer)pose(p,s.activity,0,0,true);}}
 function update(dt,hour,seconds){for(const p of people){const s=activityAt(p.i,hour);p.o.userData.activity=s.activity;if(s.node!==p.goal)setGoal(p,s.node);let budget=dt*p.i.motion.speed;const walking=p.path.length>0;const budgetStart=budget;
  while(budget>0&&p.path.length){const n=p.path[0],pos=graph.nodes[n].pos,dx=pos[0]-p.o.position.x,dz=pos[1]-p.o.position.z,d=Math.hypot(dx,dz);if(d<.001){p.node=n;p.path.shift();continue;}const step=Math.min(budget,d);p.o.position.x+=dx/d*step;p.o.position.z+=dz/d*step;p.o.rotation.y=Math.atan2(dx,dz);budget-=step;if(step>=d){p.node=n;p.path.shift();}}
  // Offset only the visual child, preserving exact navigation centerlines.
  const visual=p.o.children[0];if(visual){const lane=p.i.motion.lane;const yaw=p.o.rotation.y;const side=[p.o.position.x+Math.cos(yaw)*lane,p.o.position.z-Math.sin(yaw)*lane];visual.position.x=blocked(side,boxes,.3)?0:lane;}
  if(p.mixer){pose(p,s.activity,dt,budgetStart-budget);continue;}
  p.o.position.y=p.baseY+(walking?Math.abs(Math.sin(seconds*9+p.i.motion.phase))*.045:0);p.o.rotation.z=Math.sin(seconds*(walking?4.5:1.25)+p.i.motion.phase)*(walking?.022:.01);
 }}
 return {seek,update,people,installArrivalSlots:targets=>createArrivalSlots(town,RESOLVED,targets)}; // WORKTREE-HOOK life-queue
}
