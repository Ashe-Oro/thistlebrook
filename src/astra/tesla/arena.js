import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from '../../toon.js';
import { createTeslaVehicle } from './models.js';
import { DEMO, RAMP, LINEUP, ROW_AXIS, LINEUP_JUMP, HOVER_PAD, rampContact, roadsterPose } from './demo-motion.js';
import { buildArenaLights } from './arena-lights.js';
import { buildChargingBay } from './charging-bay.js';

// Self-contained annex: no edits to the town compiler or shared licensed assets.
export function createDemoArena(parent,{residents=null,hy3d,roadster}={}){
 const root=new THREE.Group();root.name='Roadster proving ground';root.position.set(DEMO.x,0,DEMO.z);parent.add(root);
 const batches=new Map(),owned=[],textures=[],spectators=[],lineup=[],signs=[];
 let standTransform=null;const grandstandBounds=new THREE.Box3();
 const add=(g,c)=>{if(standTransform){g.applyMatrix4(standTransform);g.computeBoundingBox();grandstandBounds.union(g.boundingBox);}const parts=batches.get(c)||[];parts.push(g);batches.set(c,parts);};
 const box=(x,y,z,w,h,d,c)=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),c);
 const beam=(a,b,w,c)=>{const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.BoxGeometry(w,v.length(),w);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate(...new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5).toArray());add(g,c);};
 const label=(text,x,y,z,w,h,{flat=false,back=false,color='#efe7ce',background='#294448',sign=false}={})=>{
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
  const material=new THREE.MeshBasicMaterial({map:texture,side:standTransform?THREE.FrontSide:THREE.DoubleSide});const geometry=new THREE.PlaneGeometry(w,h);owned.push(geometry,material);if(sign)signs.push(material);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);if(flat)mesh.rotation.x=-Math.PI/2;if(back)mesh.rotation.y=Math.PI;if(standTransform)mesh.applyMatrix4(standTransform);root.add(mesh);
  const write=t=>{ctx.fillStyle=background;ctx.fillRect(0,0,1024,128);ctx.fillStyle=color;ctx.font='bold 66px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,512,66,970);texture.needsUpdate=true;};write(text);return write;
 };
 const ink='#304b4c',cream='#eee3c4',amber='#d7aa55',steel='#6f8985';
 box(0,-1.25,0,46,2.5,42,'#b1b98d');box(0,.09,0,44,.18,40,cream);box(0,.205,0,42.8,.07,38.8,'#607477');
 // The east world-link road meets the lot edge directly; no connector slab
 // (it used to lie across that road's crosswalk and asphalt).
 for(const side of [-1,1]){box(side*21.65,.36,0,.22,.3,39.5,cream);box(0,.36,side*19.7,43.5,.3,.22,cream);}
 for(let z=-5;z<10;z+=2.3)box(-13,.25,z,.12,.02,1,cream);
 // Continuous curved surface with illuminated edges; 185 degrees curls past vertical.
 const ribbon=(x0,x1,c,offset=0)=>{const vertices=[],indices=[];for(let i=0;i<=80;i++){const a=RAMP.end*i/80,p=rampContact(a);for(const x of [x0,x1])vertices.push(x,p.y+offset*Math.cos(a),p.z+offset*Math.sin(a));if(i<80){const k=i*2;indices.push(k,k+1,k+3,k,k+3,k+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();add(g,c);};
 ribbon(-14.7,-11.3,'#859694');ribbon(-14.7,-11.3,ink,-.25);
 for(const x of [-14.66,-11.34])ribbon(x-.055,x+.055,cream,.025);
 for(let i=0;i<=16;i++){const a=RAMP.end*i/16,p=rampContact(a),q={y:p.y-.3*Math.cos(a),z:p.z-.3*Math.sin(a)};beam([-14.8,q.y,q.z],[-11.2,q.y,q.z],.13,ink);
  if(i%2===0&&i>0)for(const x of [-14.9,-11.1]){beam([x,.25,q.z],[x,q.y,q.z],.15,steel);beam([x,.25,q.z-1.6],[x,q.y,q.z],.1,steel);}
 }
 for(const x of [-14.9,-11.1])beam([x,.28,-12],[x,.28,-5.2],.22,ink);
 label('01  /  SUCTION RAMP',-13,.26,12,7,.9,{flat:true});
 // Five separated parking bays, with a tall six-wheel Semi as the centre anchor.
 for(const item of LINEUP){
  const car=createTeslaVehicle(item.kind,{color:item.color,scale:DEMO.carScale,hy3d});car.position.set(item.x,DEMO.ground,item.z);root.add(car);lineup.push(car);
  for(const x of [item.x-1.7,item.x+1.7])box(x,.25,1.5,.08,.02,7,cream);
  box(item.x,.25,-2,3.4,.02,.08,cream);box(item.x,.34,4.65,1.6,.18,.23,amber);
  label(item.label,item.x,.265,5.5,3.2,.65,{flat:true});
 }
 label('02  /  LINEUP KICKFLIP',5,.26,7.1,15,1,{flat:true});
 // Paint and choreography use the same row axis; no diagonal approach spline.
 for(let x=-13;x<19;x+=1)box(x,.252,ROW_AXIS.z,.45,.024,.07,amber);
 box(LINEUP_JUMP.takeoffX,.255,ROW_AXIS.z,.16,.03,2.6,cream);
 label('TAKEOFF',-9,.265,4.1,4,.6,{flat:true});
 // The touchdown box is visibly beyond the last parked Model 3.
 for(const z of [.25,2.75])box(18,.25,z,4.4,.02,.09,cream);
 for(let i=0;i<6;i++)box(15.7,.255,.25+i*.5,.22,.025,.27,i%2?amber:cream);
 label('TOUCHDOWN',18,.265,4.1,4.2,.6,{flat:true});
 const ring=new THREE.RingGeometry(2.55,2.68,64);ring.rotateX(-Math.PI/2);ring.translate(HOVER_PAD.x,.26,HOVER_PAD.z);add(ring,amber);
 label('03  /  HOVER',HOVER_PAD.x,.27,HOVER_PAD.z,4,.8,{flat:true});
 // Compact the sixteen-person stand and turn it 90 degrees onto the EAST
 // sideline. Its actual generated geometry bounds are exposed for path tests.
 standTransform=new THREE.Matrix4().makeTranslation(18,0,-11.5)
  .multiply(new THREE.Matrix4().makeRotationY(-Math.PI/2))
  .multiply(new THREE.Matrix4().makeScale(.6,1,.85))
  .multiply(new THREE.Matrix4().makeTranslation(-8.5,0,15.3));
 box(8.5,.46,-15.3,23,.45,7,ink);
 for(let row=0;row<2;row++){
  const y=.75+row*.85,z=-13.8-row*2.4;
  box(8.5,y-.12,z,22,.24,2.1,'#a8b7ac');box(8.5,y+.3,z-.2,22,.22,.65,amber);
  for(let i=0;i<8;i++){
   const source=residents?.people[(i*3+row*7)%(residents?.people.length||1)]?.object;
   if(!source)continue;
   const person=source.clone(true);person.name='Roadster spectator';person.traverse(o=>{if(o.isSprite)o.visible=false;});
   person.position.set(-1+i*2.7,y+.43,z-.1).applyMatrix4(standTransform);person.rotation.set(0,0,0);root.add(person);
   spectators.push({object:person,y:person.position.y,seed:i+row*8,baseScale:person.scale.clone()});
  }
 }
 for(const z of [-18.5,-11.8]){beam([-3,.9,z],[20,.9,z],.085,cream);for(let x=-3;x<=20;x+=2.875)beam([x,.25,z],[x,.9,z],.07,cream);}
 for(let i=0;i<4;i++)box(-4.1,.25+i*.19,-12.5-i*.6,1.4,.35+i*.38,.6,'#a8b7ac');
 box(8.5,4.5,-19,21,1.9,.25,ink);beam([-1,.2,-19],[-1,4.6,-19],.18,steel);beam([18,.2,-19],[18,4.6,-19],.18,steel);
 label('ROADSTER PROVING GROUND',8.5,4.9,-18.85,19,.75,{sign:true});
 const writePhase=label('NEXT SHOW: THE SUCTION RAMP',8.5,4.1,-18.84,19,.48,{color:'#e3be71',sign:true});
 label('ROADSTER PROVING GROUND',8.5,4.9,-19.15,19,.75,{back:true,sign:true});
 const writePhaseBack=label('NEXT SHOW: THE SUCTION RAMP',8.5,4.1,-19.16,19,.48,{back:true,color:'#e3be71',sign:true});
 standTransform=null;
 const charging=buildChargingBay(root,hy3d,{box,label});
 for(const [color,parts] of batches){const flat=parts.map(g=>{g.deleteAttribute('uv');const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();return n;});const geometry=mergeGeometries(flat),material=toonMaterial(color).clone();material.side=THREE.DoubleSide;const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;root.add(m);owned.push(geometry,material);flat.forEach(g=>g.dispose());}
 // Reconstruct short-lived cold-gas clouds from absolute simulation time. This
 // stays deterministic when paused, sped up, scrubbed, or captured out of order.
 const gasGeometry=new THREE.IcosahedronGeometry(1,1);owned.push(gasGeometry);
 const gas=Array.from({length:48},(_,i)=>{const mat=new THREE.MeshBasicMaterial({color:i%2?'#e8f5ec':'#cfdfde',transparent:true,opacity:0,depthWrite:false});owned.push(mat);const mesh=new THREE.Mesh(gasGeometry,mat);root.add(mesh);return mesh;});
 // Night landmarks (TOWN-28): masts, cones, LEDs and sign glow, outside the toon batches.
 const lights=buildArenaLights(root,{signs,lineup,roadster,charging:charging.cars});
 let phase='';
 function update(time,pose,night=0){
  if(phase!==pose.phase){phase=pose.phase;writePhase?.(phase.toUpperCase());writePhaseBack?.(phase.toUpperCase());}
  const cheer=pose.thrust>0||pose.phase.includes('hold');
  for(const s of spectators){const o=s.object;o.rotation.y=Math.atan2(pose.localX-o.position.x,pose.localZ-o.position.z);o.rotation.z=cheer?.055*Math.sin(time*8+s.seed):.012*Math.sin(time*1.5+s.seed);o.position.y=s.y+(cheer?.13*Math.max(0,Math.sin(time*7+s.seed)):0);}
  gas.forEach((m,i)=>{const side=i%4,age=((time+i/48*.9)%.9+.9)%.9,emitted=roadsterPose(time-age);m.visible=emitted.thrust>0&&age<.78;if(!m.visible)return;const q=new THREE.Quaternion().fromArray(emitted.orientation),x=side<2?-1:1,z=side%2?-.65:.65;
   const p=new THREE.Vector3(x*.54,.18-.43,z).multiplyScalar(DEMO.carScale).applyQuaternion(q);
   const velocity=new THREE.Vector3(x*1.7,-1.6,z*.65).applyQuaternion(q);p.addScaledVector(velocity,age);
   m.position.set(emitted.localX+p.x,emitted.y+.43*DEMO.carScale+p.y,emitted.localZ+p.z);m.position.y=Math.max(.35,m.position.y);m.scale.setScalar(.09+age*.64);m.material.opacity=(1-age/.78)*.68;
  });
  lineup.forEach(o=>o.userData.animate({night,stage:true}));
  charging.update(night);lights.update(time,pose,night);
 }
 return {root,lineup,spectators,grandstandBounds,charging,lights,update,audit:()=>({lineup:LINEUP.map(v=>v.label),spectators:spectators.length,grandstandBounds:{min:grandstandBounds.min.toArray(),max:grandstandBounds.max.toArray()},chargingBay:charging.bounds,rampDegrees:185,bounds:{x:[-88,-42],z:[-83,-41]}}),dispose(){lights.dispose();charging.dispose();lineup.forEach(o=>o.userData.dispose());owned.forEach(o=>o.dispose());textures.forEach(t=>t.dispose());root.removeFromParent();}};
}
