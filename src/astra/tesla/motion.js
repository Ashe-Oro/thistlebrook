export { roadsterPose, ROADSTER_PERIOD, ROADSTER_HOME } from './demo-motion.js';

// Independent preview loop: existing downtown avenues only, inside their
// paving, no residential doorways, bridges, campus paths or playing fields.
export function createPreviewLoop(){
  const points=[],corners=[[-65.35,-15.35],[-48.65,-15.35],[-48.65,3.35],[-65.35,3.35]],r=.85;
  for(let i=0;i<4;i++){
    const c=corners[i],prev=corners[(i+3)%4],next=corners[(i+1)%4];
    const before=Math.hypot(prev[0]-c[0],prev[1]-c[1]),after=Math.hypot(next[0]-c[0],next[1]-c[1]);
    const a=[c[0]+(prev[0]-c[0])*r/before,c[1]+(prev[1]-c[1])*r/before],b=[c[0]+(next[0]-c[0])*r/after,c[1]+(next[1]-c[1])*r/after];
    for(let j=0;j<=16;j++){const t=j/16;points.push([(1-t)**2*a[0]+2*t*(1-t)*c[0]+t*t*b[0],(1-t)**2*a[1]+2*t*(1-t)*c[1]+t*t*b[1]]);}
  }
  const lengths=[0];for(let i=0;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[(i+1)%points.length][0]-points[i][0],points[(i+1)%points.length][1]-points[i][1]));
  const length=lengths.at(-1);
  return {length,sample(distance){const d=((distance%length)+length)%length;let i=0;while(i<points.length-1&&lengths[i+1]<=d)i++;const a=points[i],b=points[(i+1)%points.length],u=(d-lengths[i])/(lengths[i+1]-lengths[i]),dx=b[0]-a[0],dz=b[1]-a[1];return {x:a[0]+dx*u,z:a[1]+dz*u,yaw:Math.atan2(dx,dz)};}};
}

export const PREVIEW_STYLES=Object.freeze(['sedan','cybercab','crossover','cybercab','cybertruck','sedan','cybercab']);
export function createPreviewFleetSimulation(){
  const path=createPreviewLoop(),vehicles=PREVIEW_STYLES.map((kind,i)=>({kind,distance:i*path.length/PREVIEW_STYLES.length,speed:0,status:'Cruising'}));
  const sync=v=>Object.assign(v,path.sample(v.distance));vehicles.forEach(sync);
  return {path,vehicles,update(dt,pedestrians=[]){
    if(!Number.isFinite(dt)||dt<=0)return;
    let left=Math.min(dt,1);
    while(left>1e-8){const step=Math.min(left,1/30);left-=step;
      for(const v of vehicles){
        const front=vehicles[(vehicles.indexOf(v)+1)%vehicles.length];
        let clearance=((front.distance-v.distance)%path.length+path.length)%path.length-3.1;
        v.status=clearance<5?'Following traffic':'Cruising';
        for(let ahead=0;ahead<5;ahead+=.4){
          const p=path.sample(v.distance+ahead);
          if(pedestrians.some(person=>Math.hypot(person.x-p.x,person.z-p.z)<.85)){
            const gap=Math.max(0,ahead-1.65);if(gap<clearance){clearance=gap;v.status='Yielding to a neighbour';}break;
          }
        }
        const wanted=Math.min(2.5,Math.sqrt(Math.max(0,4*clearance)));
        v.speed=Math.max(0,Math.min(wanted,v.speed+step*1.5));
        v.distance+=Math.max(0,Math.min(v.speed*step,clearance));sync(v);
      }
    }
  }};
}
