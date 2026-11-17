import * as THREE from 'three';
import { TOWNSFOLK } from '../catalog/townsfolk.js';
import { distance } from './graph.js';
import { filterSocialText } from './social-occlusion.js';

// Rasterize short text once. Sprites stay in the renderer (including video),
// with no per-frame canvas work and only nearby names visible.
export function createSocial(stage,town,people,q){
 const overlay=new THREE.Scene();
 const textures=new Map(),tags=new Map(),bubbles=new Map(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2(9,9);
 const material=(text,bubble)=>{const key=`${bubble}:${text}`;if(textures.has(key))return textures.get(key);const canvas=document.createElement('canvas');canvas.height=96;const c=canvas.getContext('2d');c.font='bold 32px system-ui';canvas.width=Math.ceil(c.measureText(text).width)+40;c.fillStyle=bubble?'#fff3d8':'#203341';c.beginPath();c.roundRect(3,3,canvas.width-6,82,22);c.fill();c.strokeStyle='#ca9a55';c.lineWidth=3;c.stroke();c.fillStyle=bubble?'#352d29':'#fff2ce';c.font='bold 32px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(text,canvas.width/2,44);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false});textures.set(key,m);return m;};
 const sprite=(text,bubble)=>{const o=new THREE.Sprite(material(text,bubble));o.scale.set(.48*o.material.map.image.width/96,.48,1);o.renderOrder=100;sceneAdd(o);return o;};
 const sceneAdd=o=>overlay.add(o);
 for(const p of people.people){const name=TOWNSFOLK.find(v=>v.id===p.i.id).name;const tag=sprite(name,false);tag.userData={resident:p.i.id,kind:'name'};tags.set(p.i.id,tag);const b=sprite('Hiya!',true);b.userData={resident:p.i.id,kind:'bubble'};b.visible=false;bubbles.set(p.i.id,b);}
 stage.renderer.domElement.addEventListener('pointermove',e=>{const r=stage.renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);});
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.24,16,10),new THREE.MeshToonMaterial({color:'#ed9952'}));const stripe=new THREE.Mesh(new THREE.TorusGeometry(.235,.025,6,20),new THREE.MeshToonMaterial({color:'#fff0b5'}));ball.add(stripe);stage.scene.add(ball);
 const lines={greet:["Mornin'!",'Hiya!'],chat:['Heard about the mill?','Aye. Wind’s back!'],shop:['Two loaves, please!','I’ll take it!'],eat:['Mmm! Lunch time.','Cheers!'],play:['Catch!','One more round!']};
 let active=[],transient=[],lastHour=0;const cooldown=new Map();
 const get=id=>people.people.find(p=>p.i.id===id);
 function seek(hour){cooldown.clear();transient=[];lastHour=hour;update(hour,hour*3600);}
 function update(hour,seconds){
  const clock=hour*60;
  if(hour<lastHour)cooldown.clear();lastHour=hour;
  active=[];
  for(const e of town.life.reservations){if(hour<e.start||hour>=e.end)continue;const members=e.ids.map(get);if(members.some((p,k)=>!p||p.path.length||distance([p.o.position.x,p.o.position.z],town.life.graph.nodes[e.nodes[k]].pos)>.4))continue;
   active.push({...e,pos:town.life.graph.nodes[e.nodes[0]].pos});
  }
  // Passing commuters also acknowledge a nearby neighbour. Cooldown is keyed
  // by the pair and game time; seeking resets this transient awareness state.
  for(let a=0;a<people.people.length;a++)for(let b=a+1;b<people.people.length;b++){
   const p=people.people[a],r=people.people[b],key=p.i.id+':'+r.i.id;
   if((p.path.length||r.path.length)&&hour>=7&&hour<19&&distance([p.o.position.x,p.o.position.z],[r.o.position.x,r.o.position.z])<1.8&&clock-(cooldown.get(key)??-Infinity)>120){cooldown.set(key,clock);transient.push({type:'greet',ids:[p.i.id,r.i.id],until:clock+5,pos:[p.o.position.x,p.o.position.z]});}
  }
  transient=transient.filter(e=>e.until>clock);active.push(...transient);
  ray.setFromCamera(pointer,stage.camera);const hits=ray.intersectObjects(people.people.map(p=>p.o),true);let hover=null;if(hits[0]){let o=hits[0].object;while(o&&!o.userData.inst)o=o.parent;hover=o?.userData.inst?.id;}
  const closest=[...people.people].sort((a,b)=>stage.camera.position.distanceTo(a.o.position)-stage.camera.position.distanceTo(b.o.position)).slice(0,2).map(p=>p.i.id);
  for(const p of people.people){const tag=tags.get(p.i.id),bubble=bubbles.get(p.i.id),d=stage.camera.position.distanceTo(p.o.position);tag.position.copy(p.o.position).setY(p.baseY+2.05);tag.visible=(closest.includes(p.i.id)||hover===p.i.id||active.some(e=>e.ids.includes(p.i.id)))&&d<(q.get('labels')==='1'?32:18)&&(q.get('labels')==='1'||hover===p.i.id||d<11);bubble.visible=false;}
  ball.visible=false;
  for(const e of active){const phase=(clock%8)/8,turn=Math.floor(clock/4)%e.ids.length;
   if(!e.key||!e.ids.every(id=>get(id)?.o.userData.tool))continue;const speech=e.ids.map(id=>get(id)?.o.userData.speech);if(speech.every(Boolean))lines[e.type]=speech.length===1?[speech[0],speech[0]]:speech; // WORKTREE-HOOK life-routines
   e.ids.forEach((id,k)=>{const p=get(id);if(!p)return;
    const other=get(e.ids[(k+1)%e.ids.length]);
    if(e.type==='shop'||e.type==='eat'){const target=town.instances.find(i=>i.id===e.target);if(target&&!p.path.length)p.o.rotation.y=Math.atan2(target.pos[0]-p.o.position.x,target.pos[1]-p.o.position.z);}if(other&&other!==p&&!p.path.length)p.o.rotation.y=Math.atan2(other.o.position.x-p.o.position.x,other.o.position.z-p.o.position.z);
    if(!p.path.length)p.o.rotation.z=Math.sin(seconds*(e.type==='greet'?7:3)+k)*.035;
    const b=bubbles.get(id);if(k===turn||e.ids.length===1){b.material=material(lines[e.type][e.ids.length===1?Math.floor(clock/4)%2:k%2],true);b.scale.x=.48*b.material.map.image.width/96;b.position.copy(p.o.position).setY(p.baseY+2.85);b.visible=true;b.material.opacity=Math.min(1,phase*12,(1-phase)*12);}
    if(e.type==='play'){ball.visible=true;ball.position.set(p.o.position.x+Math.sin(seconds*2)*.7,.25+Math.abs(Math.sin(seconds*3))*.65,p.o.position.z+.8);ball.rotation.z=seconds*2;p.o.rotation.y=Math.sin(seconds)*.6;}
   });
  }
 }
 // Never move a label away from its resident to resolve a collision.
 // Prefer nearby text; suppress overlaps and text too small to read instead.
 const render=()=>{const occupied=[],camera=stage.camera;camera.updateMatrixWorld();
  const viewport=stage.renderer.getSize(new THREE.Vector2());
  const text=[...bubbles.values(),...tags.values()].sort((a,b)=>a.position.distanceToSquared(camera.position)-b.position.distanceToSquared(camera.position));
  filterSocialText(stage,text); // WORKTREE-HOOK playtest — occlusion before overlap culling
  for(const o of text){if(!o.visible)continue;
   const p=o.position.clone().project(camera),view=o.position.clone().applyMatrix4(camera.matrixWorldInverse);
   const height=camera.isOrthographicCamera?o.scale.y*2*camera.zoom/(camera.top-camera.bottom):o.scale.y/(-view.z*Math.tan(camera.fov*Math.PI/360));
   const width=height*o.scale.x/o.scale.y/(viewport.x/viewport.y);
   // Text occupies 32 of the texture's 96 vertical pixels: require 12px type.
   // Cull partial labels too, so an offscreen speaker cannot leave stray text.
   if(view.z>=0||p.z>1||p.z< -1||height*viewport.y/6<12||Math.abs(p.x)+width/2>1||Math.abs(p.y)+height/2>1||occupied.some(r=>Math.abs(p.x-r.x)<(width+r.w)/2&&Math.abs(p.y-r.y)<(height+r.h)/2+.018)){o.visible=false;continue;}
   occupied.push({x:p.x,y:p.y,w:width,h:height});
  }
  const auto=stage.renderer.autoClear;stage.renderer.autoClear=false;stage.renderer.clearDepth();stage.renderer.render(overlay,camera);stage.renderer.autoClear=auto;};
 return {seek,update,render,activities:()=>active.map(e=>({type:e.type,ids:e.ids,pos:e.pos,target:e.target}))};
}
