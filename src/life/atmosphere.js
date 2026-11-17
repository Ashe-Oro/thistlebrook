import * as THREE from 'three';
import { createDressing } from './dressing-runtime.js';
// Complement existing day/night lighting; never recolor ground or alter post.
export async function createAtmosphere(stage,town,lighting){
 const dressing=await createDressing(stage,town),pools=[];
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#ffcb7880');g.addColorStop(.45,'#ffd48d40');g.addColorStop(1,'#ffd48d00');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 for(const lamp of lighting.lamps){const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});const pool=new THREE.Mesh(new THREE.PlaneGeometry(5.2,5.2),material);pool.rotation.x=-Math.PI/2;pool.position.set(lamp.light.position.x,.035,lamp.light.position.z);pool.name='art-lamp-pool';stage.scene.add(pool);pools.push(pool);}
 const fill=new THREE.HemisphereLight('#ffe3bc','#514b61',.08);fill.name='art-street-fill';stage.scene.add(fill);
 const update=lighting.update;
 lighting.update=hour=>{update(hour);const elevation=Math.sin((hour-6)/24*Math.PI*2),night=1-THREE.MathUtils.smoothstep(elevation,-.10,.18);for(const p of pools)p.material.opacity=night*.52;fill.intensity=.025+(1-night)*.065;};
 window.__villageArt={rows:dressing.rows,audit:dressing.audit,lampPools:pools.length};
 return {dressing,pools,fill};
}
