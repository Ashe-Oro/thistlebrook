import { createTeslaVehicle, TESLA_STYLES } from './models.js';
import { PREVIEW_STYLES } from './motion.js';

// Works with village/astra-traffic's public {simulation, objects, root} API.
// Replace existing car visuals, so no duplicate agents or new collision rules
// are introduced. The traffic engine retains all vehicle state and transforms.
export function installTeslaTraffic(traffic,{count=7}={}){
  if(!traffic?.simulation?.vehicles||!traffic.objects||!traffic.root)throw Error('Tesla adapter requires traffic.simulation.vehicles, objects and root');
  const installed=[];
  for(const [i,v] of traffic.simulation.vehicles.entries()){
    if(v.kind!=='car'||installed.length>=count)continue;
    const kind=PREVIEW_STYLES[installed.length%PREVIEW_STYLES.length],spec=TESLA_STYLES[kind];
    // Keep the exact existing traffic collision envelope; do not resize the
    // simulation's cars after its spacing and yield distances are computed.
    const scale=Math.min(v.width/spec.width,v.length/spec.length);
    const object=createTeslaVehicle(kind,{scale}),previous=traffic.objects[i];
    object.position.copy(previous.position);object.quaternion.copy(previous.quaternion);
    object.userData.trafficId=v.id;previous.removeFromParent();traffic.root.add(object);traffic.objects[i]=object;
    installed.push({i,v,object,previous});
  }
  return {installed,update(night=0){for(const {v,object} of installed)object.userData.animate({distance:v.distance,braking:v.speed<.5,night});},
    dispose(){for(const {i,object,previous} of installed){previous.position.copy(object.position);previous.quaternion.copy(object.quaternion);object.userData.dispose();traffic.objects[i]=previous;traffic.root.add(previous);}installed.length=0;},
  };
}
