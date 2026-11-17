import * as THREE from 'three';

// All times are simulation seconds, so town pause/speed controls apply without
// wall-clock timers. Each slot reserves the entire runway, including rollout.
export const PERIOD = 210;
export const AIRPORT = { x: 105, z: -49, view: { x: 104, z: -48, zoom: 1.55 }, bounds: { minX: 65, maxX: 146, minZ: -113, maxZ: 14 } };
export const FLEET = [
  { id: 'AT201', name: 'Astra Air · AT201', kind: 'commercial', gate: -65, offset: 0, color: '#3a8185' },
  { id: 'CL104', name: 'Clover Flying Club · CL104', kind: 'light', gate: -43, offset: 70, color: '#d48b48' },
  { id: 'CL108', name: 'Clover Flying Club · CL108', kind: 'light', gate: -20, offset: 140, color: '#b76055' },
];
const point = (x,y,z) => new THREE.Vector3(x,y,z);
const ground = (x,z) => [x,.22,z];
const curve = points => new THREE.CatmullRomCurve3(points.map(p=>point(...p)),false,'centripetal');
const smooth = u=>u*u*(3-2*u);
const lerp = (a,b,u)=>a+(b-a)*u;

export function createFlightPlan(spec) {
  const g=spec.gate;
  return [
    { name:'At stand', start:0,end:20, points:[ground(94,g),ground(94,g)], stop:true },
    { name:'Pushback',start:20,end:25,path:curve([ground(94,g),ground(103,g)]),reverse:true },
    { name:'Taxi out',start:25,end:40, path:curve([ground(103,g),ground(109,g+8),ground(109,-5),ground(113,3),ground(120,3),ground(124,-3),ground(124,-8)]) },
    { name:'Takeoff',start:40,end:52, sample:u=>point(124,.22+Math.max(0,(u-.53)/.47)**1.5*12,lerp(-8,-103,u*u)), runway:true },
    { name:'Climb',start:52,end:64,path:curve([[124,12.22,-103],[124,25,-151],[110,36,-180]]) },
    { name:'Over town',start:64,end:138,path:curve([[110,36,-180],[62,42,-195],[-28,43,-150],[-62,37,-85],[-26,34,-25],[35,36,40],[98,45,128],[124,50,120]]) },
    // Hold above Pinecrest's ridge before descending north of the mountain feet.
    { name:'Approach',start:138,end:154,path:curve([[124,50,120],[124,50,90],[124,38,55],[124,4,25]]) },
    { name:'Landing',start:154,end:164,sample:u=>point(124,.22+3.78*(1-smooth(Math.min(1,u/.72))),lerp(25,-10,u)),runway:true },
    { name:'Rollout',start:164,end:175,sample:u=>point(124,.22,lerp(-10,-77,1-(1-u)**1.55)),runway:true },
    { name:'Taxi in',start:175,end:200,path:curve([ground(124,-77),ground(119,-84),ground(108,-84),ground(102,-77),ground(102,g),ground(97,g),ground(94,g)]) },
    { name:'At stand',start:200,end:210,points:[ground(94,g),ground(94,g)],stop:true },
  ];
}
const plans = new Map(FLEET.map(spec=>[spec.id,createFlightPlan(spec)]));
export function sampleFlight(spec,t) {
  const local=((t+spec.offset)%PERIOD+PERIOD)%PERIOD;
  const phase=plans.get(spec.id).find(s=>local>=s.start&&local<s.end);
  const u=(local-phase.start)/(phase.end-phase.start);
  const sample = v=>phase.path?phase.path.getPointAt(v):phase.sample?phase.sample(v):point(...phase.points[0]);
  const position=sample(u),before=sample(Math.max(0,u-.002)),after=sample(Math.min(1,u+.002));
  const tangent=after.clone().sub(before);
  let heading=phase.stop||phase.reverse?-Math.PI/2:Math.atan2(tangent.x,tangent.z);
  if(phase.name==='Taxi out'&&local<27){const blend=smooth((local-25)/2),delta=Math.atan2(Math.sin(heading+Math.PI/2),Math.cos(heading+Math.PI/2));heading=-Math.PI/2+delta*blend;}
  let bank=0;
  if(phase.name==='Over town'||phase.name==='Climb'){
    const a=sample(Math.max(0,u-.025)),b=sample(Math.min(1,u+.025));
    const h1=Math.atan2(position.x-a.x,position.z-a.z),h2=Math.atan2(b.x-position.x,b.z-position.z);
    bank=THREE.MathUtils.clamp(Math.atan2(Math.sin(h2-h1),Math.cos(h2-h1))*(-1.5),-.28,.28);
  }
  return {id:spec.id,kind:spec.kind,phase:phase.name,local,position,heading,bank,pitch:phase.stop?0:-Math.atan2(tangent.y,Math.hypot(tangent.x,tangent.z)),runway:!!phase.runway,gear:position.y<6};
}
const heliPath=curve([[80,14,-102],[66,25,-117],[10,29,-95],[-14,27,-50],[20,25,-18],[70,24,-20],[91,20,-60],[80,14,-102]]);
export function sampleHelicopter(t) {
  const local=((t+8)%100+100)%100;
  let phase,position,heading=0,pitch=0;
  if(local<10){phase='On helipad';position=point(80,.22,-102);}
  else if(local<20){phase='Lift off';position=point(80,lerp(.22,14,smooth((local-10)/10)),-102);}
  else if(local<80){phase='Town patrol';const u=(local-20)/60;position=heliPath.getPointAt(u);const d=heliPath.getTangentAt(u);heading=Math.atan2(d.x,d.z);pitch=.065;}
  else if(local<92){phase='Set down';position=point(80,lerp(14,.22,smooth((local-80)/12)),-102);}
  else{phase='On helipad';position=point(80,.22,-102);}
  return {id:'AIR1',kind:'helicopter',phase,local,position,heading,pitch};
}
