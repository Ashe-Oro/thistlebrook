// Browser rendering for the traffic scale evidence, using the app's Three.js.
import * as THREE from 'three';
import { FLEET_MODELS, VEHICLE_LENGTH_METRES, vehicleModel } from '../src/astra/traffic-fleet.js';
import { packVehicle } from '../src/astra/vehicle-models.js';

export async function renderFleetLineup(app) {
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#e8e3d0');
  scene.add(new THREE.HemisphereLight('#fcf3d8','#849994',2.25));
  const key=new THREE.DirectionalLight('#fff3d8',2);key.position.set(-7,12,6);scene.add(key);
  const lineup=Object.entries(FLEET_MODELS)
    .sort(([,a],[,b])=>VEHICLE_LENGTH_METRES[a.class]-VEHICLE_LENGTH_METRES[b.class])
    .flatMap(([id,entry])=>id==='sn-school-bus'?[[id,entry,'Town'],[id,entry,'Regional']]:[[id,entry]]);
  const yaw=.93,pixelsPerUnit=43,labels=[];
  let width=1;
  for(const [id,entry,system] of lineup){
    const spec=vehicleModel(id);
    const object=await packVehicle(spec);
    const slot=Math.max(3.7,Math.sin(yaw)*spec.length+Math.cos(yaw)*spec.width+.75);
    object.position.x=width+slot/2;object.rotation.y=yaw;scene.add(object);
    const name=system?`${system} school bus`:entry.name;
    labels.push({x:object.position.x*pixelsPerUnit,name,
      detail:`${entry.class.replaceAll('-',' ')} · ${VEHICLE_LENGTH_METRES[entry.class]} m`});
    width+=slot;
  }
  const height=385, imageWidth=Math.ceil((width+1)*pixelsPerUnit);
  const camera=new THREE.OrthographicCamera(0,imageWidth/pixelsPerUnit,4.2,4.2-height/pixelsPerUnit,.1,150);
  camera.position.set(0,20,47);camera.lookAt(0,0,0);
  const baseline=new THREE.Mesh(new THREE.PlaneGeometry(width,8),new THREE.MeshBasicMaterial({color:'#dfdac7'}));
  baseline.rotation.x=-Math.PI/2;baseline.position.set((width+1)/2,-.015,.6);scene.add(baseline);

  const renderer=app.renderer, size=renderer.getSize(new THREE.Vector2()), ratio=renderer.getPixelRatio();
  renderer.setPixelRatio(1);renderer.setSize(imageWidth,height,false);
  try {
    renderer.render(scene,camera);
    return {image:renderer.domElement.toDataURL('image/png').split(',')[1],labels,height,width:imageWidth};
  } finally { renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false); }
}

export function renderStarbaseTransporter(app) {
  const starbase=app.world.expansions.starbase;
  const width=1440,height=1000,span=13.2;
  const camera=new THREE.OrthographicCamera(-span,span,span*height/width,-span*height/width,.1,280);
  starbase.update(27,0,10.4);
  const [,trailer]=starbase.audit().roadVehicles;
  const x=trailer.position[0]+starbase.root.position.x,z=trailer.position[1]+starbase.root.position.z;
  camera.position.set(x+27,19,z+34);camera.lookAt(x+1.7,7.3,z);
  app.renderer.setPixelRatio(1);app.renderer.setSize(width,height,false);
  app.renderer.render(app.scene,camera);
  return app.renderer.domElement.toDataURL('image/png').split(',')[1];
}
