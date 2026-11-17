import * as THREE from 'three';

export const ISO_ELEVATION = Math.atan(1 / Math.sqrt(2));
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function parseHash(hash) {
  const m = /^#?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?),h?(-?\d+)$/.exec(hash);
  if (!m) return null;
  const [x,z,zoom,heading] = m.slice(1).map(Number);
  return [x,z,zoom,heading].every(Number.isFinite) && zoom > 0 && heading % 90 === 0 ? {x,z,zoom,heading} : null;
}
export const serializeHash = s => `#${s.x.toFixed(2)},${s.z.toFixed(2)},${s.zoom.toFixed(4)},h${((s.heading%360)+360)%360}`;

export function isoPresentationBox(scene) {
 const box=new THREE.Box3();
 scene.traverse(o=>{const i=o.userData.inst;if(!i||o.userData.outline)return;
 // Decorative woodland rocks far beyond town must not inflate the hero view.
 if(i.district==='woodland'&&i.kind!=='tree')return;
 if(['tree','bush','villager'].includes(i.kind))return;
 if(o.userData.batchPivot){const b=o.userData.entry.bounds;o.updateWorldMatrix(true,false);box.union(new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max)).applyMatrix4(o.matrixWorld));}
 else box.union(new THREE.Box3().setFromObject(o,true));
 });
 return box;
}

export function createIsoCamera(stage, town) {
  stage.setMode('iso');
  const camera = stage.camera, canvas = stage.renderer.domElement;
  stage.scene.traverse(o=>{if(o.material?.uniforms?.top&&o.material.uniforms.bottom)o.visible=false;});camera.far=Math.max(camera.far,1600);
  stage.controls.dispose(); stage.controls.enabled = false;
  stage.setMode = () => {}; // life has exactly one camera, including the debug Look panel
  const box = isoPresentationBox(stage.scene);
  const center = box.getCenter(new THREE.Vector3()), extent = box.getSize(new THREE.Vector3());
  const bounds = { minX:box.min.x, maxX:box.max.x, minZ:box.min.z, maxZ:box.max.z };
  const target = new THREE.Vector3(center.x,0,center.z), desired = target.clone();
  let zoom=1, wantedZoom=1, heading=0, wantedHeading=0, anchor=null, follow=null, peek=false, hashTimer=null, lastSaved='';
  const D = Math.max(180, extent.length()*2), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0,1,0),0);
  let halfHeight=40;
  const api = { mode:'iso', camera, bounds, minZoom:.85, maxZoom:8, onCancel:null,
    get state(){return {x:target.x,z:target.z,zoom,heading:((Math.round(wantedHeading/90)*90%360)+360)%360};},
    get following(){return follow;},
    ground(x,y){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),camera);return ray.ray.intersectPlane(plane,new THREE.Vector3());},
    cancel(){follow=null;api.onCancel?.();},
    follow(object){api.cancel();follow=object;wantedZoom=Math.max(wantedZoom,4);anchor=null;},
    setView(s,{immediate=false,interior=false}={}){peek=interior;anchor=null;if(Number.isFinite(s.x))desired.x=s.x;if(Number.isFinite(s.z))desired.z=s.z;if(Number.isFinite(s.zoom))wantedZoom=clamp(s.zoom,api.minZoom,api.maxZoom);if(Number.isFinite(s.heading))wantedHeading=Math.round(s.heading/90)*90;limit();if(immediate){target.copy(desired);zoom=wantedZoom;heading=wantedHeading;apply();}return api.state;},
    zoomAt(factor,x=innerWidth/2,y=innerHeight/2){api.cancel();anchor={x,y,point:api.ground(x,y)};wantedZoom=clamp(wantedZoom*factor,api.minZoom,api.maxZoom);},
    rotate(step){anchor=null;wantedHeading+=step*90;},
    update(dt){if(follow){desired.set(follow.position.x,0,follow.position.z);}limit();const a=1-Math.exp(-Math.max(0,dt)*10);target.lerp(desired,a);zoom+=(wantedZoom-zoom)*a;heading+=(wantedHeading-heading)*a;apply();if(anchor?.point){const p=api.ground(anchor.x,anchor.y);if(p){const d=anchor.point.clone().sub(p);target.add(d);desired.add(d);limit();target.x=clamp(target.x,bounds.minX,bounds.maxX);target.z=clamp(target.z,bounds.minZ,bounds.maxZ);apply();}if(Math.abs(wantedZoom-zoom)<1e-10)anchor=null;}save();},
    resize(){fit();apply();},
  };
  function limit(){if(!peek){desired.x=clamp(desired.x,bounds.minX,bounds.maxX);desired.z=clamp(desired.z,bounds.minZ,bounds.maxZ);}}
  function apply(){const yaw=Math.PI/4+heading*Math.PI/180;camera.position.copy(target).add(new THREE.Vector3(Math.sin(yaw)*Math.cos(ISO_ELEVATION),Math.sin(ISO_ELEVATION),Math.cos(yaw)*Math.cos(ISO_ELEVATION)).multiplyScalar(D));camera.lookAt(target);camera.zoom=zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);stage.controls.target.copy(target);}
  function fit(){// Fit all core corners at the classic angle, independent of the stage's 30° framing.
    const oldHeading=heading;heading=0;apply();let xx=0,yy=0;
    for(let i=0;i<8;i++){const p=new THREE.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).sub(new THREE.Vector3(center.x,0,center.z));const right=new THREE.Vector3(1,0,-1).normalize(),up=new THREE.Vector3(-1,2,-1).normalize();xx=Math.max(xx,Math.abs(p.dot(right)));yy=Math.max(yy,Math.abs(p.dot(up)));}
    halfHeight=Math.max(yy,xx/(innerWidth/innerHeight))*1.1;heading=oldHeading;
    camera.left=-halfHeight*innerWidth/innerHeight;camera.right=-camera.left;camera.top=halfHeight;camera.bottom=-halfHeight;
  }
  function save(){if(peek)return;const value=serializeHash(api.state);if(value===lastSaved)return;lastSaved=value;clearTimeout(hashTimer);hashTimer=setTimeout(()=>history.replaceState(null,'',location.pathname+location.search+value),180);}
  fit();api.setView(parseHash(location.hash)||{}, {immediate:true});
  window.addEventListener('hashchange',()=>{const s=parseHash(location.hash);if(s){api.cancel();api.setView(s);}});
  window.addEventListener('resize',api.resize);
  canvas.style.touchAction='none';canvas.addEventListener('contextmenu',e=>e.preventDefault());
  let space=false,gesture=null;const pointers=new Map();
  const typing=e=>/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable;
  document.addEventListener('keydown',e=>{if(typing(e))return;if(e.code==='Space'){space=true;e.preventDefault();}if(!e.repeat&&['KeyQ','KeyE'].includes(e.code)){api.rotate(e.code==='KeyQ'?-1:1);e.preventDefault();}});
  document.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});window.addEventListener('blur',()=>{space=false;pointers.clear();gesture=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();api.zoomAt(Math.exp(-e.deltaY*(e.deltaMode===1?.04:.0015)),e.clientX,e.clientY);},{passive:false});
  const pinch=()=>{const [a,b]=[...pointers.values()];return {distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
  canvas.addEventListener('pointerdown',e=>{if(![0,2].includes(e.button))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(pointers.size===2){api.cancel();gesture={pinch:pinch()};return;}const hit=api.pick?.(e.clientX,e.clientY);gesture={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,hit,pan:e.button===2||space||e.pointerType==='touch'||!hit,moved:false};});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=pinch();if(gesture.pinch){api.zoomAt(p.distance/Math.max(1,gesture.pinch.distance),p.x,p.y);}gesture={pinch:p,moved:true};return;}if(gesture.pinch)return;if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>5)gesture.moved=true;if(gesture.pan&&gesture.moved){api.cancel();anchor=null;const a=api.ground(gesture.lastX,gesture.lastY),b=api.ground(e.clientX,e.clientY);if(a&&b){desired.add(a.sub(b));limit();}}gesture.lastX=e.clientX;gesture.lastY=e.clientY;});
  canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(gesture&&!gesture.moved&&!gesture.pinch&&e.button===0&&!space)api.select?.(gesture.hit);gesture=null;});
  canvas.addEventListener('pointercancel',()=>{pointers.clear();gesture=null;});
  window.__iso=api;return api;
}
