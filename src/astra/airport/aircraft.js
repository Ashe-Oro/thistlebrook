import * as THREE from 'three';
import { toonMaterial, toon } from '../../toon.js';
const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,12,8);
function part(parent,geo,color,x,y,z,sx=1,sy=1,sz=1,ink=false){const m=ink?toon(geo,color,{thickness:.025}):new THREE.Mesh(geo,toonMaterial(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const box=(p,c,x,y,z,w,h,d)=>part(p,cube,c,x,y,z,w,h,d);
function wing(parent,points,y,color){const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:false});const m=part(parent,geo,color,0,y,0,1,1,1,true);m.rotation.x=-Math.PI/2;return m;}
export function makeAircraft(spec){
 const root=new THREE.Group(),body=new THREE.Group(),gear=new THREE.Group();root.add(body);body.add(gear);
 const jet=spec.kind==='commercial',c=spec.color,L=jet?7:3.7,Y=jet?1.8:1.15;
 part(body,sphere,'#f2ead6',0,Y,0,jet?.92:.52,jet?.94:.55,L,true);
 // Painted belly, cockpit and passenger windows make the airliner readable.
 part(body,sphere,c,0,Y-.35,0,jet?.94:.54,jet?.5:.3,L*.89);
 part(body,sphere,'#456675',0,Y+.42,L*.66,jet?.77:.46,.38,jet?1.5:.8);
 if(jet)for(const s of [-1,1])for(let n=0;n<10;n++)box(body,'#425c65',s*.88,Y+.23,-3.7+n*.72,.055,.29,.36);
 wing(body,jet?[[-.4,1.7],[-7.7,-1.7],[-7.5,-3],[-.5,-1.2]]:[[-.3,.9],[-4.8,.55],[-4.8,-.7],[-.3,-.8]],jet?1.45:1.85,c);
 wing(body,jet?[[.4,1.7],[7.7,-1.7],[7.5,-3],[.5,-1.2]]:[[.3,.9],[4.8,.55],[4.8,-.7],[.3,-.8]],jet?1.45:1.85,c);
 wing(body,[[-.3,-L*.65],[-(jet?2.8:1.8),-L*.9],[-(jet?2.8:1.8),-L],[.3,-L],[jet?2.8:1.8,-L],[jet?2.8:1.8,-L*.9],[.3,-L*.65]],Y+.2,c);
 const finShape=new THREE.Shape();finShape.moveTo(0,0);finShape.lineTo(2.8,0);finShape.lineTo(2.8,2.4);finShape.lineTo(1.7,2.4);finShape.closePath();
 const fin=part(body,new THREE.ExtrudeGeometry(finShape,{depth:.18,bevelEnabled:false}),c,-.09,Y,-L*.63,1,1,1,true);fin.rotation.y=Math.PI/2;fin.scale.setScalar(jet?1:.58);
 const wheels=[];
 for(const [x,z] of [[-.7,-.7],[.7,-.7],[0,L*.56]]){box(gear,'#77858a',x,.6,z,.1,.7,.1);const w=part(gear,new THREE.CylinderGeometry(.26,.26,.22,10),'#303c42',x,.28,z);w.rotation.z=Math.PI/2;wheels.push(w);}
 const props=[];
 if(jet){for(const s of [-1,1]){const e=part(body,new THREE.CylinderGeometry(.55,.43,2.1,12), '#e8ddc6',s*2.7,1.1,.05);e.rotation.x=Math.PI/2;const intake=part(body,new THREE.CylinderGeometry(.38,.38,.06,12),'#34494e',s*2.7,1.1,1.12);intake.rotation.x=Math.PI/2;box(body,c,s*7.45,1.9,-2.4,.13,.8,.65);}}
 else{const rotor=new THREE.Group();rotor.position.set(0,Y,L);body.add(rotor);box(rotor,'#3f5158',0,0,0,.13,2.35,.09);part(rotor,sphere,c,0,0,.08,.24,.24,.22);props.push(rotor);}
 const lights=[];for(const [x,color]of [[jet?-7.6:-4.8,'#e87562'],[jet?7.6:4.8,'#83ca9c']]){const m=part(body,sphere,color,x,jet?1.55:1.95,jet?-2:.1,.12,.12,.12);m.material=new THREE.MeshBasicMaterial({color});lights.push(m);}
 return {root,body,gear,props,lights,wheels};
}
export function makeHelicopter(){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 part(body,sphere,'#d9aa52',0,1.4,0,1.15,1.15,2.1,true);
 part(body,sphere,'#466c79',0,1.65,1.05,.98,.84,1.05,true);
 const tail=part(body,new THREE.CylinderGeometry(.18,.48,4.5,10),'#d9aa52',0,1.55,-3.5);tail.rotation.x=Math.PI/2;
 box(body,'#d9aa52',0,2.1,-5.5,.2,1.9,1.1);
 for(const s of [-1,1]){box(body,'#3e5358',s*.9,.2,0,.12,.12,3.7);for(const z of [-.9,.9])box(body,'#51626a',s*.9,.65,z,.12,1,.12);}
 box(body,'#556568',0,2.8,0,.17,.75,.17);
 const rotor=new THREE.Group();rotor.position.set(0,3.1,0);body.add(rotor);box(rotor,'#34494f',0,0,0,9.2,.07,.23);box(rotor,'#34494f',0,0,0,.23,.07,9.2);
 const tailRotor=new THREE.Group();tailRotor.position.set(.25,2.3,-5.5);body.add(tailRotor);box(tailRotor,'#34494f',0,0,0,.1,1.7,.14);box(tailRotor,'#34494f',0,0,0,.1,.14,1.7);
 return {root,body,rotor,tailRotor};
}
