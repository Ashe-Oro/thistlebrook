import { createIsoDiorama } from './iso-diorama.js';
import { updateIsoShadows } from './iso-shadows.js';
import { createIsoCamera } from './iso-camera.js';
import { createIsoHud } from './iso-hud.js';
import { createIsoInteract } from './iso-interact.js';
import { createDayNight } from './daynight.js';
import { createPeople } from './people.js';
import { createSocial } from './social.js';
import { createInteriors } from './interiors.js';
export async function createIsoLife(stage,town,q) {
 const camera=createIsoCamera(stage,town),lighting=createDayNight(stage,town),people=createPeople(town,stage.scene),social=createSocial(stage,town,people,q),hud=createIsoHud(q);
 // WORKTREE-HOOK art — runtime only, after the original lighting and navigation.
 await (await import('./atmosphere.js')).createAtmosphere(stage,town,lighting);
 const diorama=createIsoDiorama(stage,town,people);
 const normalize=h=>((h%24)+24)%24;
 let hour=normalize(Number(q.get('hour')??9)),timescale=Number(q.get('timescale')??(q.has('hour')?0:1));if(!Number.isFinite(hour))hour=9;if(!Number.isFinite(timescale))timescale=1;
 const api={camera,hud,get hour(){return hour;},get mode(){return 'iso';},get timescale(){return timescale;},setHour(h){if(Number.isFinite(Number(h))){hour=normalize(Number(h));people.seek(hour);social.seek(hour);lighting.update(hour);hud.clock(hour);}},setTimescale(s){if(Number.isFinite(Number(s)))timescale=Math.max(0,Number(s));},activities:()=>social.activities()};window.__life=api;
 await import('./routine-runtime.js').then(m=>m.installRoutines({town,people,social,api,q,stage})); // WORKTREE-HOOK life-routines
 api.setHour(hour);
 // WORKTREE-HOOK interiors
 await createInteriors(stage,town,camera,api,q);
 await (await import('./props-interact.js')).createProps(stage,town,camera,api); // WORKTREE-HOOK props
 const interact=createIsoInteract(stage,town,people,camera,hud,api);camera.interact=interact;
 document.addEventListener('keydown',e=>{if(e.code==='KeyF'&&!e.repeat&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))api.setHour(hour+3);});
 // Keep the three-step toon ramp and hulls, reducing painterly blur for small props.
 stage.scene.userData.isoPost=(cam,u,size)=>{if(cam.isOrthographicCamera)u.uDepthThreshOrtho.value=Math.max(.25,(2.5+2*(post?.options.inkWidth??1.2))*(cam.top-cam.bottom)/cam.zoom/size.y);};
 const post=window.__post;if(post){const render=post.render;post.render=(cam=stage.camera)=>render(cam);const opts={};if(!q.has('kuwahara'))opts.kuwahara=2;if(!q.has('quant'))opts.quant=0;if(!q.has('inkWidth'))opts.inkWidth=1.2;if(!q.has('normalWeight'))opts.normalWeight=.35;post.setOptions(opts);}
 // Cap each shared hull's screen width across zooms without changing its mesh.
 const hulls=[],materials=new Map();stage.scene.updateMatrixWorld(true);
 stage.scene.traverse(o=>{const original=o.material;if(!o.userData.outline||!original?.uniforms?.uThickness)return;const scale=o.matrixWorld.getMaxScaleOnAxis()||1,key=original.uuid+':'+scale.toFixed(6);let m=materials.get(key);if(!m){m=original.clone();materials.set(key,m);hulls.push({m,base:original.uniforms.uThickness.value,scale});}o.material=m;});
 function tuneHulls(){const pixels=stage.renderer.domElement.height*stage.camera.zoom/(stage.camera.top-stage.camera.bottom);for(const {m,base,scale} of hulls)m.uniforms.uThickness.value=Math.min(base,.85/pixels/scale);}
 let last=performance.now()/1000;
 function step(dt,seconds=performance.now()/1000){hour=normalize(hour+dt*timescale/60);people.update(dt,hour,seconds);stage.sun.target.position.set(0,0,-15);lighting.update(hour);camera.update(dt,seconds);diorama.update(dt,seconds);updateIsoShadows(stage);social.update(hour,seconds);interact.update();hud.clock(hour);tuneHulls();}
 api.step=step;
 return {camera,people,lighting,render:social.render,update(){const now=performance.now()/1000,dt=Math.min(.2,Math.max(0,now-last));last=now;step(dt,now);}};
}
