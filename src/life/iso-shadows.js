import * as THREE from 'three';

export function updateIsoShadows(stage) {
 const cam=stage.camera,sun=stage.sun,target=stage.controls.target;
 const direction=sun.position.clone().sub(sun.target.position).normalize();
 const points=[];const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
 for(const x of [-1,1])for(const y of [-1,1]){ray.setFromCamera(new THREE.Vector2(x,y),cam);const p=ray.ray.intersectPlane(plane,new THREE.Vector3());if(p)points.push(p);}
 const center=target.clone(),distance=Math.max(180,...points.map(p=>p.distanceTo(center)*2));
 sun.target.position.copy(center);sun.position.copy(center).addScaledVector(direction,distance);sun.target.updateMatrixWorld();sun.updateMatrixWorld();
 const shadow=sun.shadow.camera;shadow.position.copy(sun.position);shadow.lookAt(center);shadow.updateMatrixWorld();
 const box=new THREE.Box3();for(const p of points)for(const h of [0,20])box.expandByPoint(p.clone().setY(h).applyMatrix4(shadow.matrixWorldInverse));
 Object.assign(shadow,{left:box.min.x-5,right:box.max.x+5,bottom:box.min.y-5,top:box.max.y+5,near:1,far:distance*3});shadow.updateProjectionMatrix();sun.shadow.normalBias=.035;sun.shadow.bias=-.00003;
}
