import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from '../../toon.js';

// A tall, six-wheeled, streamlined tractor: panoramic windshield, tapered
// nose, roof fairing, twin rear axles and exposed fifth-wheel chassis.
export function createTeslaSemi({color='#eeeadd',scale=1}={}){
 const root=new THREE.Group();root.name='Tesla Semi look-alike';root.scale.setScalar(scale);
 const parts=new Map(),owned=[],cube=new THREE.BoxGeometry(1,1,1);
 const box=(x,y,z,w,h,d,c,tilt=0)=>{const g=cube.clone().scale(w,h,d).rotateX(tilt).translate(x,y,z);const a=parts.get(c)||[];a.push(g);parts.set(c,a);};
 const dark='#29414a',glass='#345b69';
 box(0,.48,-.15,1.22,.25,4.2,dark);box(0,1.27,.94,1.36,1.65,2.15,color);
 box(0,2.12,.5,1.33,.65,1.7,color);box(0,2.37,.84,1.28,.12,1.38,color);
 box(0,1.69,1.97,1.13,.7,.035,glass,.13);box(0,.88,2.07,1.18,.37,.1,color);
 for(const side of [-1,1]){box(side*.689,1.75,1.15,.02,.63,1.22,glass);box(side*.68,.78,.74,.035,.06,1.35,'#9aa9a8');box(side*.65,.56,.2,.12,.15,.8,'#788d90');box(side*.49,.98,2.13,.27,.045,.035,'#f5efd7');box(side*.72,1.55,1.78,.045,.28,.12,dark);}
 box(0,.68,-.84,.91,.12,.91,'#6d8181');box(0,.77,-.84,.53,.08,.53,dark);
 for(const [c,gs] of parts){const g=mergeGeometries(gs);const m=new THREE.Mesh(g,toonMaterial(c));m.castShadow=true;m.receiveShadow=true;root.add(m);owned.push(g);gs.forEach(g=>g.dispose());}cube.dispose();
 const wheelGeo=new THREE.CylinderGeometry(.32,.32,.18,12).rotateZ(Math.PI/2),capGeo=new THREE.CylinderGeometry(.2,.2,.02,10).rotateZ(Math.PI/2);owned.push(wheelGeo,capGeo);
 const wheels=[];for(const side of [-1,1])for(const z of [1.27,-1.02,-1.76]){const w=new THREE.Group();w.position.set(side*.64,.32,z);root.add(w);wheels.push(w);const rubber=new THREE.Mesh(wheelGeo,toonMaterial(dark));rubber.castShadow=true;w.add(rubber);const hub=new THREE.Mesh(capGeo,toonMaterial('#b9c8c7'));hub.position.x=side*.1;w.add(hub);}
 root.userData={kind:'semi',wheels,wheelRadius:.32*scale,jets:new THREE.Group(),dimensions:{width:1.5*scale,length:4.5*scale,height:2.5*scale},animate({distance=0}={}){wheels.forEach(w=>w.rotation.x=distance/(.32*scale));},dispose(){owned.forEach(g=>g.dispose());root.removeFromParent();}};
 return root;
}
