import * as THREE from 'three';
import { TOWNSFOLK } from '../catalog/townsfolk.js';
export function createIsoInteract(stage,town,people,camera,hud,api) {
 const ray=new THREE.Raycaster(),roots=[],records=new Map();
 stage.scene.traverse(o=>{const i=o.userData.inst;if(!i||o.userData.outline)return;const p=people.people.find(p=>p.o===o);const place=town.registry?.places?.find(p=>town.instances[p.instanceIndex]===i);
 if(p||place?.building||['house','landmark'].includes(i.kind)){roots.push(o);records.set(o,{object:o,person:p,place,instance:i,name:p?TOWNSFOLK.find(n=>n.id===i.id)?.name:place?.name||i.id.replace(/^cv-/,'').replaceAll('-',' ')});}});
 camera.pick=(x,y)=>{const r=stage.renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),stage.camera);for(const hit of ray.intersectObjects(roots,true)){if(hit.object.userData.outline)continue;let o=hit.object;while(o&&!records.has(o))o=o.parent;if(o&&o.visible)return records.get(o);}return null;};
 let selected=null;
 camera.select=hit=>{camera.cancel();if(!hit)return;selected=hit;if(hit.person)camera.follow(hit.person.o);else if(!api.interiors?.enterBuilding(hit.instance.id)){camera.setView({x:hit.instance.pos[0],z:hit.instance.pos[1],zoom:4});hud.card(hit.name,'A closer look at the village.','Drag ground or close to release');}selected=hit;};
 camera.onCancel=()=>{selected=null;api.interiors?.exit();hud.card(null);};hud.close.onclick=()=>camera.cancel();
 document.addEventListener('keydown',e=>{if(e.code==='Escape')camera.cancel();});
 stage.renderer.domElement.addEventListener('pointermove',e=>{const hit=camera.pick(e.clientX,e.clientY);hud.tooltip(hit?.name,e.clientX,e.clientY);stage.renderer.domElement.style.cursor=hit?'pointer':'grab';});
 stage.renderer.domElement.addEventListener('pointerleave',()=>hud.tooltip(null));
 return {records:[...records.values()],update(){if(!selected?.person)return;const p=selected.person,active=api.activities().find(a=>a.ids.includes(p.i.id));hud.card(selected.name,active?.type||p.o.userData.activity||'Enjoying village life','Following resident · drag ground or close to release');}};
}

// Uses the existing interiors builder; no alternate room assets or walking rig.
export async function createIsoInteriors(stage,town,camera,api,q,{plan,buildRoom}) {
 const rooms=await Promise.all(plan.map(p=>buildRoom(p,stage.scene)));
 // Lift each existing room out of the distant storage row into a roofless model.
 // Near-side shell and overhead beams are omitted; fixtures and furniture stay.
 for(const r of rooms)for(const o of r.group.children){const b=new THREE.Box3().setFromObject(o);const local=b.clone().translate(new THREE.Vector3(-r.origin[0],0,-r.origin[1]));if(local.max.y>4.1||local.min.x>5.5||local.min.z>4.65)o.visible=false;}
 let active=null,previous=null;
 const interiors={rooms,plan,enterBuilding(id){const r=rooms.find(r=>r.building===id);return r?interiors.enter(r.id):false;},enter(id){const r=rooms.find(r=>r.id===id);if(!r)return false;if(active)interiors.exit();previous=camera.state;active=r;r.group.visible=true;camera.setView({x:r.origin[0],z:r.origin[1],zoom:7,heading:0},{immediate:true,interior:true});hudCard();return true;},exit(){if(!active)return false;active.group.visible=false;active=null;camera.setView(previous,{immediate:true});return true;}};
 function hudCard(){api.hud.card(active.name,active.subtitle,'Roofless room peek · close or click empty ground to return');}
 api.interiors=interiors;Object.defineProperty(api,'interior',{get:()=>active?{id:active.id,name:active.name}:null});
 window.__post?.setHullVisible(window.__post.options.hull);
 if(q.has('interior'))interiors.enter(q.get('interior'));
 return interiors;
}
