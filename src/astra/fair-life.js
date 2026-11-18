import {FAIR_SLOTS as SLOTS,fairApproach} from './registry/district-activities.js';
import * as THREE from 'three';
import { place } from '../catalog/loader.js';
import { shortestPath } from '../compiler/astra.js';
import { weatherPlan } from './weather-plan.js';
import { fairSchedule } from '../compiler/astra-fair.js';

const ROLES = ['child','herbalist','carpenter','merchant','elder','baker','farmhand','shopkeeper'];
const DWELL = {'fair-wheel':25,'fair-carousel':22,'fair-pond':35,'fair-picnic':50,'fair-band':55,'fair-food':12};
const ACTIVITIES = {'fair-wheel':'Waiting for a gondola','fair-carousel':'Watching the ponies','fair-pond':'Watching the ducks','fair-picnic':'Taking a picnic break','fair-band':'Listening to the band','fair-food':'Buying a picnic'};

// People travel along the compiled town graph, then along authored unobstructed
// approaches to capacity-limited activity slots. Closing sends them to the gate.
export async function createFairLife(scene,town) {
  const root=new THREE.Group();root.name='Merrymead visitors';scene.add(root);
  const gate=town.nodes.findIndex(p=>p[0]===-42&&p[1]===-33);
  const venues=town.venues.filter(v=>v.district==='fair');
  const people=await Promise.all(Array.from({length:30},async(_,n)=>{
    const object=await place('townsfolk-'+ROLES[n%ROLES.length],{scale:n%8===0?.85:1.04});
    root.add(object);object.visible=false;
    const snack=new THREE.Mesh(new THREE.CylinderGeometry(.12,.09,.24,8),new THREE.MeshToonMaterial({color:'#f3ba70'}));snack.position.set(.4,.8,.35);snack.visible=false;object.add(snack);
    return {object,snack,n,node:gate,phase:'away',path:[],wait:n*.5,visits:0,slot:null,venue:null,activity:'Arriving at the park',speed:1.15+n%5*.09};
  }));
  let lastTime=null,schedule=fairSchedule(4,10),arrivals=0;
  const gatePoint=()=>town.nodes[gate];
  const route=(p,points)=>{p.path=points.map(v=>[...v]);};
  const release=p=>{p.slot=null;};
  const choose=p=>{
    const available=venues.filter(v=>schedule.open||['fair-pond','fair-picnic'].includes(v.type));
    const choices=schedule.concert?[...available,venues.find(v=>v.type==='fair-band')]:available.filter(v=>v.type!=='fair-band');
    for(let i=0;i<choices.length;i++){
      const v=choices[(p.n+p.visits*3+i)%choices.length];
      const slot=SLOTS[v.id].findIndex((_,k)=>!people.some(other=>other!==p&&other.venue===v&&other.slot===k));
      if(slot<0)continue;
      p.venue=v;p.slot=slot;p.phase='walking';p.activity='Walking to '+v.name;
      route(p,shortestPath(town,p.node,v.node).slice(1).map(i=>town.nodes[i]));
      p.path.push(...approach(v,SLOTS[v.id][slot]));return;
    }
    p.wait=2;
  };
  const approach=(v,slot)=>fairApproach(v.id,slot);
  function depart(p,leaving){
    const v=p.venue,slot=SLOTS[v.id][p.slot];
    const back=approach(v,slot).slice(0,-1).reverse();
    route(p,[...back,v.entry]);p.phase=leaving?'leaving-activity':'returning';
    p.snack.visible=false;release(p);
  }
  return {people,update(t,hour,day,weather){
    const dt=lastTime===null?0:Math.max(0,Math.min(t-lastTime,2));lastTime=t;schedule=fairSchedule(day,hour);
    const plan=weatherPlan(weather);
    if(dt===0)return; // Pausing also freezes decisions and activity transitions.
    for(const p of people){
      const wanted=p.n<Math.ceil(schedule.visitors*plan.fairAttendance);
      if(p.phase==='away'){
        if(!wanted)continue;p.wait=Math.max(0,p.wait-dt);if(p.wait>0)continue;
        p.object.position.set(gatePoint()[0],.15,gatePoint()[1]);p.object.visible=true;p.node=gate;p.phase='ready';
      }
      if(p.phase==='ready'){
        if(!wanted){p.phase='exiting';route(p,shortestPath(town,p.node,gate).slice(1).map(i=>town.nodes[i]));}
        else if(p.wait>0)p.wait-=dt;else choose(p);
      }
      if(p.phase==='activity'){
        p.wait-=dt;p.object.rotation.z=Math.sin(t*1.6+p.n)*.025;
        if(p.venue.id==='fair-pond')p.object.rotation.x=Math.sin(t*.7+p.n)*.08;
        if(p.wait<=0||!wanted||(!schedule.open&&!['fair-pond','fair-picnic'].includes(p.venue.id)))depart(p,!wanted);
        else continue;
      }
      let remaining=dt*p.speed*plan.pace;
      while(p.path.length&&remaining>0){
        const target=p.path[0],dx=target[0]-p.object.position.x,dz=target[1]-p.object.position.z,d=Math.hypot(dx,dz),step=Math.min(d,remaining);
        if(d>.0001){p.object.position.x+=dx/d*step;p.object.position.z+=dz/d*step;p.object.rotation.y=Math.atan2(dx,dz);}
        remaining-=step;if(d<=step+.0001)p.path.shift();else break;
      }
      p.object.rotation.x=0;p.object.position.y=.15+(p.path.length?Math.abs(Math.sin(t*8+p.n))*.045:0);
      p.object.rotation.z=p.path.length?Math.sin(t*8+p.n)*.03:0;
      if(!p.path.length){
        if(p.phase==='walking'){
          p.node=p.venue.node;p.phase='activity';p.wait=(DWELL[p.venue.id]+p.n%5*2)*(p.venue.id==='fair-picnic'?plan.fairAttendance:1);p.visits++;arrivals++;p.activity=ACTIVITIES[p.venue.id];
          p.object.rotation.y=p.venue.id==='fair-picnic'||p.venue.id==='fair-food'?Math.PI/2:Math.PI;
          p.snack.visible=['fair-picnic','fair-food'].includes(p.venue.id);
        }else if(p.phase==='returning'){p.phase='ready';}
        else if(p.phase==='leaving-activity'){p.phase='exiting';route(p,shortestPath(town,p.node,gate).slice(1).map(i=>town.nodes[i]));}
        else if(p.phase==='exiting'){p.phase='away';p.node=gate;p.object.visible=false;p.wait=p.n*.35;release(p);}
      }
    }
  },audit(){return {schedule,arrivals,visible:people.filter(p=>p.object.visible).length,activities:people.filter(p=>p.phase==='activity').map(p=>({venue:p.venue.id,slot:p.slot})),people:people.map(p=>({phase:p.phase,venue:p.venue?.id,position:p.object.position.toArray(),visits:p.visits}))};}};
}
