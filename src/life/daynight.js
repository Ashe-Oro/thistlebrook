import { makeCloud } from '../builders.js';
import * as THREE from 'three';
import { PALETTE } from '../toon.js';
import { RESOLVED } from '../catalog/loader.js';
export function createDayNight(stage,town){
 const {scene,sun}=stage,hemis=[],ambient=[],skies=[],clouds=[],windows=[],lamps=[];
 for(const [x,y,z,size] of [[-50,35,-65,1.8],[18,41,-82,2],[70,38,-30,1.5]]){const c=makeCloud(size);c.position.set(x,y,z);c.name='life-cloud';scene.add(c);clouds.push(c);}
 scene.traverse(o=>{if(o.isHemisphereLight)hemis.push(o);if(o.isAmbientLight)ambient.push(o);if(o.material?.uniforms?.top&&o.material.uniforms.bottom)skies.push(o.material);});
 // Raycast the actual imported facade so glow rests on the wall, rather than
 // the conservative footprint which includes steps and roof overhangs.
 const ray=new THREE.Raycaster(),front=new THREE.Vector3(),origin=new THREE.Vector3();
 const buildings=[];scene.traverse(o=>{if(['house','landmark'].includes(o.userData.inst?.kind)&&o.userData.inst.district!=='edo')buildings.push(o);});
 scene.updateMatrixWorld(true);
 for(const root of buildings){const i=root.userData.inst,e=RESOLVED.get(i.id);if(!e.door)continue;const bounds=e.bounds,w=bounds.max[0]-bounds.min[0],height=Math.min((e.eaveY||bounds.max[1]*.55)*.65,2.1);front.set(Math.sin(i.rotY),0,Math.cos(i.rotY));
  const locals=[-w*.25,w*.25];for(const x of locals){origin.set(x,height,bounds.max[2]+2).applyAxisAngle(new THREE.Vector3(0,1,0),i.rotY).add(root.position);ray.set(origin,front.clone().negate());const hits=ray.intersectObject(root,true).filter(h=>!h.object.userData.outline&&h.object.material?.isMeshToonMaterial);if(!hits.length)continue;const hit=hits[0];
   const mat=new THREE.MeshBasicMaterial({color:'#ffca75',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});const pane=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(.62,w*.15),.66),mat);pane.position.copy(hit.point).addScaledVector(front,.025);pane.rotation.y=i.rotY;scene.add(pane);windows.push(mat);
   // Window mullions keep the warm patches recognizable from street level.
   const frameMat=new THREE.MeshBasicMaterial({color:'#61452b'});for(const [a,b] of [[.045,.68],[Math.min(.64,w*.15),.045]]){const bar=new THREE.Mesh(new THREE.BoxGeometry(a,b,.025),frameMat);bar.position.copy(pane.position).addScaledVector(front,.015);bar.rotation.y=i.rotY;scene.add(bar);}
  }
 }
 for(const i of town.instances.filter(i=>i.id==='cv-streetlamp')){const e=RESOLVED.get(i.id);const y=e.bounds.max[1]-.32;const light=new THREE.PointLight('#ffc477',0,8,2);light.position.set(i.pos[0],y,i.pos[1]);light.castShadow=false;if(lamps.length<10)scene.add(light);
  // A small emissive lens is attached at the fixture's measured lantern head.
  const lens=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),new THREE.MeshBasicMaterial({color:'#ffd389',transparent:true,opacity:0}));lens.position.copy(light.position);scene.add(lens);lamps.push({light,lens});
 }
 const grasses=[];const grassColors=[new THREE.Color(PALETTE.grass),new THREE.Color(PALETTE.grassDark)];
 scene.traverse(o=>{if(o.material?.color&&grassColors.some(c=>c.equals(o.material.color))){o.material=o.material.clone();grasses.push({material:o.material,day:o.material.color.clone()});}});
 const nightGrass=new THREE.Color('#485957');
 const dayTop=new THREE.Color('#86c6e0'),nightTop=new THREE.Color('#172844'),dayBottom=new THREE.Color('#d8e9da'),nightBottom=new THREE.Color('#445878'),warm=new THREE.Color('#ffc18a'),white=new THREE.Color('#fff1d0'),moon=new THREE.Color('#a7c9ff');
 function update(hour){const angle=(hour-6)/24*Math.PI*2,elevation=Math.sin(angle),day=THREE.MathUtils.smoothstep(elevation,-.16,.35),night=1-THREE.MathUtils.smoothstep(elevation,-.10,.18),gold=1-THREE.MathUtils.smoothstep(Math.abs(elevation),.08,.65);
  for(const g of grasses)g.material.color.copy(nightGrass).lerp(g.day,day);
  sun.position.set(Math.cos(angle)*65,Math.max(18,Math.abs(elevation)*70),24);sun.target.position.set(0,0,-15);sun.color.copy(moon).lerp(white,day).lerp(warm,gold*day*.75);sun.intensity=.42+day*1.25;
  for(const h of hemis){h.color.copy(nightBottom).lerp(dayTop,day);h.groundColor.set(day>.5?'#71854c':'#394966');h.intensity=.61+day*.08;}for(const a of ambient){a.color.set(day>.4?'#fff5e5':'#b4c6e8');a.intensity=.40+day*.03;}
  const horizon=nightBottom.clone().lerp(dayBottom,day).lerp(warm,gold*day*.22);if(scene.fog)scene.fog.color.copy(horizon);stage.renderer.setClearColor(horizon);for(const m of skies){m.uniforms.top.value.copy(nightTop).lerp(dayTop,day);m.uniforms.bottom.value.copy(horizon);}
  for(const c of clouds){c.traverse(o=>{if(o.material?.isMeshToonMaterial)o.material.color.set('#687b9d').lerp(new THREE.Color('#fff5e2'),day);});}
  for(const m of windows)m.opacity=night*.92;for(const l of lamps){l.light.intensity=night*12;l.lens.material.opacity=night;}
 }
 return {update,windows,lamps};
}
import { withLightingPolish } from './lighting-polish.js'; createDayNight = withLightingPolish(createDayNight); // WORKTREE-HOOK lighting
