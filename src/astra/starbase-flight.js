// Authored demonstration clock, in seconds. All motion derives from the shared
// town elapsed time: pause/speed and deterministic capture therefore agree.
export const STARBASE_ORIGIN = [145, 50];
export const STARBASE_VIEWS = {
  starbase: {x:168,z:40,zoom:.92},
  launch: {x:158,z:17,zoom:2.2},
  recovery: {x:163,z:85,zoom:2.1},
  offshore: {x:230,z:80,zoom:3},
  starfactory: {x:101,z:10,zoom:2.6},
};
export const CYCLE = 192;
const clamp = t => Math.max(0,Math.min(1,t));
const lerp = (a,b,t) => a+(b-a)*clamp(t);
const smooth = t => {t=clamp(t);return t*t*(3-2*t);};
const craft = (x,y,z,visible=true,burn=0,tilt=0,legs=0) => ({x,y,z,visible,burn,tilt,legs});
export function flightState(elapsed) {
 const t=((elapsed%CYCLE)+CYCLE)%CYCLE;
 let title='Fueling the stainless giants', detail='Cryogenic vents drift across the tank farm. Launch in '+Math.ceil(10-t)+'s.';
 const booster=craft(20,3,-24),ship=craft(20,21.4,-24),f9=craft(48,2,12),upper=craft(48,15,12);
 const sides=[craft(45.8,2,12,false),craft(50.2,2,12,false)];
 let arms=1,armY=18,smoke=0,mode='starship',gate=true,droneX=lerp(73,96,smooth((t-58)/22)),droneZ=lerp(68,35,smooth((t-58)/22));
 if(t>=134){droneX=73;droneZ=68;}
 if(t>=47){booster.x=4;booster.z=-12;}
 if(t>=69)ship.y=3;
 if(t>=10&&t<23){const u=(t-10)/13,h=70*u*u;booster.y+=h;ship.y+=h;booster.burn=1;smoke=1-u*.5;title='Starship · liftoff';detail='Thirty-three engines. One bright trail over the Gulf.';}
 if(t>=23&&t<37){const u=(t-23)/14;booster.x=20+Math.sin(u*Math.PI)*10;booster.y=lerp(73,8,1-(1-u)**2);booster.burn=u>.18?.65:0;ship.x=20+u*42;ship.y=91.4+u*55;ship.burn=1;arms=1-smooth((u-.7)/.3);armY=24;title='Super Heavy · return burn';detail='Grid fins steer the booster between the open chopsticks.';}
 if(t>=37&&t<47){booster.y=lerp(8,3,smooth((t-39)/7));armY=booster.y+16;booster.x=lerp(20,4,smooth((t-44)/3));booster.z=lerp(-24,-12,smooth((t-44)/3));arms=t>44?1:0;ship.visible=false;title='Super Heavy · caught';detail='Engines out. The tower lowers the booster onto its launch mount.';}
 if(t>=47&&t<62){const u=(t-47)/15;booster.y=3;ship.x=lerp(66,20,smooth(u));ship.y=lerp(74,14, u);ship.tilt=Math.PI/2;ship.z=lerp(-7,-24,u);armY=10.5;title='Starship · belly-flop';detail='Heat shield down. Four flaps hold the returning ship broadside.';}
 if(t>=62&&t<69){const u=(t-62)/7;ship.y=lerp(14,3,smooth(u));ship.tilt=lerp(Math.PI/2,0,smooth(u));ship.burn=u<.93?.7:0;armY=10.5;arms=1-smooth(u);title='Starship · flip & recovery';detail='The Raptors relight. The ship turns upright above the launch mount.';}
 if(t>=69&&t<80){arms=0;armY=10.5;title='Both stages home';detail='Both vehicles recovered. The booster rolls clear and the ship rests on the mount.';gate=false;}
 if(t>=80){mode='falcon9';title='Falcon 9 · terminal count';detail='The offshore drone ship is on station. Strongback retracting.';}
 if(t>=88&&t<100){const u=(t-88)/12;f9.y=2+65*u*u;upper.y=f9.y+13;f9.burn=1;smoke=1;title='Falcon 9 · liftoff';detail='Nine Merlins carry the payload toward orbit.';}
 if(t>=100&&t<116){const u=(t-100)/16;f9.x=lerp(48,96,smooth(u));f9.z=lerp(12,35,smooth(u));f9.y=lerp(67,1.2,1-(1-u)**2);f9.burn=u>.3?.65:0;f9.legs=smooth((u-.6)/.3);upper.y=80+u*70;upper.x=48+u*40;upper.burn=1;title='Falcon 9 · offshore landing';detail='Grid fins steer. Four legs unfold above the drone ship’s X.';}
 if(t>=116&&t<134){const u=smooth((t-119)/13);droneX=lerp(96,73,u);droneZ=lerp(35,68,u);f9.x=droneX;f9.z=droneZ;f9.y=1.2;f9.legs=1;upper.visible=false;gate=false;title='Drone ship · bringing it home';detail='Booster secured. A tug tows the floating landing pad back to port.';}
 if(t>=134){mode='heavy';sides.forEach(s=>s.visible=true);title='Falcon Heavy · countdown';detail='Two side boosters will return together to LZ-1 and LZ-2.';}
 if(t>=142&&t<154){const u=(t-142)/12;f9.y=2+68*u*u;upper.y=f9.y+13;f9.burn=1;sides.forEach(s=>{s.y=f9.y;s.burn=1;});smoke=1;title='Falcon Heavy · liftoff';detail='Three cores rise from the Falcon launch pad.';}
 if(t>=154&&t<172){const u=(t-154)/18;f9.y=70+u*100;upper.y=f9.y+13;f9.burn=1;sides.forEach((s,i)=>{s.x=lerp(45.8+i*4.4,i?27:-8,smooth(u));s.z=lerp(12,i?55:43,smooth(u));s.y=lerp(70,.65,1-(1-u)**2);s.burn=u>.3?.6:0;s.legs=smooth((u-.63)/.3);});title='Side boosters · synchronized return';detail='Two landing burns. Two concrete targets. Coming home together.';}
 if(t>=172){f9.visible=false;upper.visible=false;sides.forEach((s,i)=>{s.x=i?27:-8;s.z=i?55:43;s.y=.65;s.legs=1;});gate=false;title='LZ-1 + LZ-2 · touchdown';detail='Both side boosters are upright. Recovery crews leave the shelter.';}
 if(t>=184){ship.y=lerp(3,21.4,smooth((t-184)/3));booster.x=lerp(4,20,smooth((t-187)/4));booster.z=lerp(-12,-24,smooth((t-187)/4));armY=ship.y+7.5;arms=0;title='Restacking for the next flight';detail='The tower raises the ship while the recovered booster rolls back to its mount.';}
 return {t,title,detail,mode,booster,ship,f9,upper,sides,arms,armY,smoke,gate,droneX,droneZ};
}
// Constant speed along paved waypoints, with a short dwell at every stop.
export function routeAt(points,t,speed=1,dwell=2) {
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
 const duration=lengths.reduce((a,b)=>a+b/speed+dwell,0);let phase=((t%duration)+duration)%duration;
 for(let i=0;i<lengths.length;i++){const duration=lengths[i]/speed;if(phase<=duration+dwell){const u=Math.min(1,phase/duration);return {x:lerp(points[i][0],points[i+1][0],u),z:lerp(points[i][1],points[i+1][1],u),heading:Math.atan2(points[i+1][0]-points[i][0],points[i+1][1]-points[i][1]),walking:phase<duration};}phase-=duration+dwell;}
 return {x:points[0][0],z:points[0][1],heading:0,walking:false};
}
