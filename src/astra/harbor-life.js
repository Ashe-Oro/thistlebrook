import * as THREE from 'three';
import { place } from '../catalog/loader.js';
import { harborGeometry } from './harbor-geometry.js';
import { createHarborRoutines } from './harbor-routines.js';

export async function createHarborLife(scene,town) {
  const routines=createHarborRoutines(town),{box,orb,cylinder,line,ring}=harborGeometry(scene);
  const stories={Fisher:'Carries the morning catch from the pier to the fish market.',Fishmonger:'Sets out the silver catch while the town is waking up.',Boatwright:'Checks every rope before taking a break at the net loft.','Lighthouse keeper':'Keeps the lantern turning after the last swimmers have come ashore.','Boardwalk walker':'Always takes the long way home, along the sea.',Swimmer:'Changes at the beach huts and enters the cove through the shallows.'};
  await Promise.all(routines.people.map(async p=>{
    let object;
    if(p.role==='Swimmer'){
      object=new THREE.Group();const skin=['#d7a37a','#a97656','#e2b88f'][p.index%3],color=['#b96d5c','#679798','#d8b264'][p.index%3];
      cylinder(0,.9,0,.25,.55,skin,object,.3);box(0,.59,0,.5,.28,.32,color,object);
      orb(0,1.45,0,.23,skin,object);orb(0,1.58,-.02,.225,color,object).scale.set(.23,.14,.23);
      p.arms=[-1,1].map(side=>{const arm=new THREE.Group();arm.position.set(side*.28,1.08,0);object.add(arm);cylinder(0,-.24,0,.075,.53,skin,arm);return arm;});
      p.legs=[-1,1].map(side=>cylinder(side*.14,.28,0,.09,.55,skin,object));
      p.wake=ring(0,-.2,0,.65,.025,'#c0ddd1');p.wake.castShadow=false;
    }else object=await place('townsfolk-'+p.model,{scale:1.05});
    scene.add(object);p.object=object;p.story=stories[p.role];object.position.set(p.x,p.y,p.z);
    if(p.role==='Fisher'){
      const rod=new THREE.Group();rod.position.set(.5,1,.4);object.add(rod);p.rod=rod;
      line([[0,0,0],[.1,.7,.6],[.15,1.2,1.5],[.15,1.3,2.8]],'#4e5d52',rod);
      line([[.15,1.3,2.8],[.15,-1.3,3.5]],'#c7c9a7',rod);orb(.15,-1.3,3.5,.08,'#b96c55',rod);
      const crate=new THREE.Group();crate.position.set(0,.8,.55);object.add(crate);p.crate=crate;
      box(0,0,0,.85,.45,.6,'#b39b73',crate);for(let n=0;n<3;n++)box(0,-.13+n*.13,.31,.85,.035,.025,'#6f7966',crate);
      for(let n=0;n<3;n++)orb(-.2+n*.2,.28,0,.13,'#bacdca',crate).scale.set(.2,.06,.1);
    }
  }));
  return {
    people:routines.people,
    update(dt,t,hour){
      routines.update(dt,hour);
      for(const p of routines.people){
        const walking=p.route.length>0,swimming=p.role==='Swimmer'&&p.y<-.4,o=p.object;
        o.position.set(p.x,p.y+(walking&&!swimming?Math.abs(Math.sin(t*7+p.index))*.035:0),p.z);
        o.rotation.y=p.heading;o.rotation.z=walking&&!swimming?Math.sin(t*7+p.index)*.025:0;
        if(p.rod){
          const fishing=p.activity==='Fishing at dawn'&&!walking;p.rod.visible=fishing;
          p.crate.visible=p.carrying&&walking;
          if(fishing){o.rotation.y=p.index===0?-Math.PI/2:Math.PI/2;p.rod.rotation.x=Math.sin(t*.7+p.index)*.07;}
        }
        if(p.arms){
          o.rotation.x=swimming?-.85:0;
          p.arms.forEach((a,i)=>{a.rotation.x=swimming?t*3+i*Math.PI+p.index:walking?Math.sin(t*6+i*Math.PI)*.4:0;a.rotation.z=swimming?(i?-.5:.5):0;});
          p.legs.forEach((a,i)=>a.rotation.x=walking?Math.sin(t*6+i*Math.PI)*.2:0);
          p.wake.visible=swimming;p.wake.position.set(p.x,p.z>64?-.41:-.2,p.z);p.wake.scale.setScalar(.8+(Math.sin(t*2+p.index)+1)*.12);
          o.visible=hour>=8&&hour<20||walking||swimming;
        }
      }
    },
    pick(ray){let person=null,best=Infinity;for(const p of routines.people){if(!p.object.visible)continue;const center=p.object.position.clone().add(new THREE.Vector3(0,.8,0)),hit=ray.intersectSphere(new THREE.Sphere(center,.7),new THREE.Vector3());if(hit){const d=ray.origin.distanceTo(hit);if(d<best){person=p;best=d;}}}return person;},
    audit(){return {people:routines.people.map(p=>({name:p.name,role:p.role,node:p.node,position:[p.x,p.y,p.z],activity:p.activity,route:[...p.route],arrivals:[...p.arrivals],carrying:p.carrying})),swimmersInWater:routines.people.filter(p=>p.role==='Swimmer'&&p.y<-.4).length};},
  };
}
