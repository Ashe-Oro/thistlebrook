import { Quaternion, Euler, Vector3, CatmullRomCurve3 } from 'three';

// All dimensions are local to a separate northwest annex. The car never uses
// the old rooftop path. Rendering and collision tests share these exact data.
export const DEMO = Object.freeze({x:-65,z:-62,width:46,depth:42,ground:.24,carScale:1.3,period:87});
export const RAMP = Object.freeze({x:-13,z:-6,radius:5.5,width:3.4,hold:165*Math.PI/180,end:185*Math.PI/180});
export const ROW_AXIS=Object.freeze({z:1.5,firstX:-4,centerX:4,lastX:12});
export const LINEUP = Object.freeze([
  {kind:'cybercab',label:'CYBERCAB',x:-4,z:ROW_AXIS.z,color:'#e3bd65'},
  {kind:'cybertruck',label:'CYBERTRUCK',x:0,z:ROW_AXIS.z,color:'#bbc9c8'},
  {kind:'semi',label:'SEMI',x:4,z:ROW_AXIS.z,color:'#eeeadd'},
  {kind:'crossover',label:'MODEL Y',x:8,z:ROW_AXIS.z,color:'#bd5348'},
  {kind:'sedan',label:'MODEL 3',x:12,z:ROW_AXIS.z,color:'#426d98'},
]);
export const LINEUP_JUMP=Object.freeze({start:44,end:54,takeoffX:-7.4,landingX:18,z:ROW_AXIS.z,apexX:ROW_AXIS.centerX,apex:14});
export const HOVER_PAD=Object.freeze({x:-4,z:15});
export const ROADSTER_PERIOD=DEMO.period;
export const ROADSTER_HOME=Object.freeze([DEMO.x-13,DEMO.z+9]);
export const STUNT_SEAMS=Object.freeze([0,2,5,9,11,15,18,21,25,27,28,34,42,44,54,62,64,70,72,84,87]);
const TAU=Math.PI*2,COM=.43*DEMO.carScale,GROUND=DEMO.ground+.05;
export const ease=t=>{t=Math.max(0,Math.min(1,t));return Math.max(0,Math.min(1,t*t*t*(t*(t*6-15)+10)));};
const mix=(a,b,u)=>a+(b-a)*u;
const q=(yaw=0,pitch=0,roll=0)=>new Quaternion().setFromEuler(new Euler(0,yaw,0)).multiply(new Quaternion().setFromEuler(new Euler(pitch,0,roll,'XYZ')));
export function rampContact(angle){return {x:RAMP.x,y:DEMO.ground+RAMP.radius*(1-Math.cos(angle)),z:RAMP.z-RAMP.radius*Math.sin(angle)};}
function rampCar(angle){const p=rampContact(angle),normal=new Vector3(0,Math.cos(angle),Math.sin(angle));return {x:p.x,y:p.y+(COM+.05)*normal.y-COM,z:p.z+(COM+.05)*normal.z,orientation:q(Math.PI,-angle),angle};}
const road=(points)=>new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x,GROUND,z)),false,'centripetal');
const toJump=road([[-13,9],[-13,12],[-19,12],[-19,ROW_AXIS.z],[-13,ROW_AXIS.z]]);
const toPad=road([[LINEUP_JUMP.landingX,ROW_AXIS.z],[19,ROW_AXIS.z],[19,9],[10,15],[0,15],[-4,15]]);
const toHome=road([[-4,15],[-8,15],[-13,14],[-13,9]]);
function drive(path,u){const p=path.getPointAt(ease(u)),v=path.getTangentAt(ease(u));return {x:p.x,z:p.z,orientation:q(Math.atan2(v.x,v.z)),distance:path.getLength()*ease(u)};}

export function roadsterPose(time){
 const t=((time%DEMO.period)+DEMO.period)%DEMO.period;
 let p={x:-13,z:9,y:GROUND,orientation:q(Math.PI)},phase='Ready at the ramp',stage='ramp',contact=false,angle=null,thrust=0,distance=0;
 const ramp=(a)=>{p=rampCar(a);angle=a;contact=true;distance=15+RAMP.radius*a;};
 if(t<2){}
 else if(t<5){p.z=mix(9,-6,ease((t-2)/3));distance=9-p.z;phase='First approach';}
 else if(t<9){ramp(RAMP.hold*ease((t-5)/4));phase='Suction climb · first run';}
 else if(t<11){ramp(RAMP.hold);phase='Inverted hold · first run';}
 else if(t<15){ramp(RAMP.hold*(1-ease((t-11)/4)));phase='Reversing down the curve';}
 else if(t<18){p.z=mix(-6,2,ease((t-15)/3));distance=15-(p.z+6);phase='Backing up for another run';}
 else if(t<21){p.z=mix(2,-6,ease((t-18)/3));distance=7+2-p.z;phase='Second approach';}
 else if(t<25){ramp(RAMP.hold*ease((t-21)/4));phase='Suction climb · second run';}
 else if(t<27){ramp(RAMP.hold);phase='Inverted hold · second run';}
 else if(t<28){ramp(mix(RAMP.hold,RAMP.end,ease(t-27)));phase='Driving off the lip';}
 else if(t<34){
  const u=ease((t-28)/6),start=rampCar(RAMP.end);p.x=-13;p.z=mix(start.z,9,u);p.y=mix(start.y,GROUND,u)+2*Math.sin(Math.PI*u);
  // Recover from the inverted surface while adding a full barrel roll.
  p.orientation=start.orientation.clone().slerp(q(0),u).multiply(q(0,0,TAU*ease(((t-28)/6-.1)/.7)));
  phase=t<32?'Ramp exit · barrel roll':'Thruster-assisted landing';thrust=.85;distance=33;
 }else if(t<42){Object.assign(p,drive(toJump,(t-34)/8));phase='Driving to the lineup';stage='transfer';distance+=40;}
 else if(t<44){p.x=mix(-13,LINEUP_JUMP.takeoffX,ease((t-42)/2));p.z=ROW_AXIS.z;p.orientation=q(Math.PI/2);phase='Rolling start';stage='lineup';distance=65+p.x+13;}
 else if(t<54){
  const u=(t-LINEUP_JUMP.start)/(LINEUP_JUMP.end-LINEUP_JUMP.start),s=ease(u);
  p.x=mix(LINEUP_JUMP.takeoffX,LINEUP_JUMP.landingX,s);p.z=LINEUP_JUMP.z;
  // A broad high arc: the car remains well above BOTH end cars. Roll only
  // over the middle three, with the inverted apex directly above the Semi.
  const sideProgress=p.x<=LINEUP_JUMP.apexX?(p.x-LINEUP_JUMP.takeoffX)/(LINEUP_JUMP.apexX-LINEUP_JUMP.takeoffX):(LINEUP_JUMP.landingX-p.x)/(LINEUP_JUMP.landingX-LINEUP_JUMP.apexX);
  p.y=GROUND+LINEUP_JUMP.apex*Math.pow(Math.max(0,Math.sin(Math.PI/2*sideProgress)),.35);
  p.orientation=q(Math.PI/2,-.08*Math.sin(TAU*u),TAU*ease((p.x+1)/10));
  phase='Kickflip over the entire lineup';stage='lineup';thrust=.95;distance=69;
 }
 else if(t<62){Object.assign(p,drive(toPad,(t-54)/8));phase='Rolling to the hover pad';stage='transfer';distance+=96;}
 else if(t<64){p.x=HOVER_PAD.x;p.z=HOVER_PAD.z;p.orientation=q(-Math.PI/2);phase='Standing start';stage='standing';distance=135;}
 else if(t<70){const u=(t-64)/6,s=ease(u);p.x=HOVER_PAD.x;p.z=HOVER_PAD.z;p.y=GROUND+6*Math.sin(Math.PI*s);p.orientation=q(-Math.PI/2,0,TAU*ease((u-.15)/.65));phase=u<.65?'Standing flip':'Hovering down on thrusters';stage='standing';thrust=.9;distance=135;}
 else if(t<72){p.x=HOVER_PAD.x;p.z=HOVER_PAD.z;p.orientation=q(-Math.PI/2);phase='Touchdown';stage='standing';distance=135;}
 else if(t<84){Object.assign(p,drive(toHome,(t-72)/12));phase='Returning to the ramp';stage='transfer';distance+=135;}
 else phase='Ready for the next show';
 return {x:p.x+DEMO.x,z:p.z+DEMO.z,y:p.y,localX:p.x,localZ:p.z,altitude:p.y-GROUND,orientation:p.orientation.toArray(),phase,stage,contact,rampAngle:angle,thrust,distance,cycle:t};
}

export function lineupApexTime(){
 const fraction=(LINEUP_JUMP.apexX-LINEUP_JUMP.takeoffX)/(LINEUP_JUMP.landingX-LINEUP_JUMP.takeoffX);
 let lo=0,hi=1;for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(ease(mid)<fraction)lo=mid;else hi=mid;}
 return LINEUP_JUMP.start+(LINEUP_JUMP.end-LINEUP_JUMP.start)*(lo+hi)/2;
}
