import * as THREE from 'three';
import { instantiate, RESOLVED } from '../catalog/loader.js';
import { toonMaterial, outlineMaterial } from '../toon.js';
import { createInteriorPlan, checkInteriorPlan } from './doors.js';

const WOOD='#715037', DARK='#45372e', CREAM='#eddbb5', BRASS='#c2934d';
const radius=.3;
// Room-local rectangles are shared by movement and capture audits.
export function roomBlocked(room,x,z){
 if(x< -5.65||x>5.65||z< -4.65||z>5.7)return true;
 if(z>4.65&&Math.abs(x)>.78)return true; // the front wall has a real opening
 return room.solids.some(b=>x>b[0]-radius&&x<b[2]+radius&&z>b[1]-radius&&z<b[3]+radius);
}
function mesh(parent,geometry,color,x,y,z,ink=.012){
 const m=new THREE.Mesh(geometry,toonMaterial(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);
 if(ink){const hull=new THREE.Mesh(geometry,outlineMaterial(ink));hull.userData.outline=true;m.add(hull);}return m;
}
const box=(p,w,h,d,c,x,y,z,ink)=>mesh(p,new THREE.BoxGeometry(w,h,d),c,x,y,z,ink);
function oval(p,x,y,z,sx,sy,sz,color){const m=mesh(p,new THREE.SphereGeometry(1,12,8),color,x,y,z,.008);m.scale.set(sx,sy,sz);return m;}
function sign(parent,text,x,y,z,width=3.8,color=CREAM){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const c=canvas.getContext('2d');
 c.fillStyle=WOOD;c.fillRect(0,0,768,128);c.strokeStyle='#d4b279';c.lineWidth=6;c.strokeRect(10,10,748,108);c.fillStyle=color;c.font='600 40px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(text,384,65,720);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/6),new THREE.MeshBasicMaterial({map:tex}));m.position.set(x,y,z);parent.add(m);return m;
}
function table(room,x,z,w=2.3,d=1.4){
 box(room.group,w,.16,d,'#b98b55',x,1.03,z);
 for(const dx of [-w/2+.18,w/2-.18])for(const dz of [-d/2+.15,d/2-.15])box(room.group,.14,.95,.14,WOOD,x+dx,.47,z+dz);
 room.solids.push([x-w/2,z-d/2,x+w/2,z+d/2]);
}
function chair(room,x,z,rot=0){
 const p=new THREE.Group();p.position.set(x,0,z);p.rotation.y=rot;room.group.add(p);
 box(p,.7,.12,.68,'#a7804d',0,.57,0);
 for(const dx of [-.26,.26])for(const dz of [-.24,.24])box(p,.09,.55,.09,WOOD,dx,.275,dz);
 for(const dx of [-.27,0,.27])box(p,.07,.62,.07,WOOD,dx,.95,.28);
 box(p,.7,.12,.10,WOOD,0,1.25,.28);room.solids.push([x-.34,z-.34,x+.34,z+.34]);
}
function loaf(p,x,y,z){oval(p,x,y,z,.30,.15,.20,'#d69d4d');for(let n=-1;n<=1;n++){const cut=box(p,.025,.025,.25,'#f2d293',x+n*.13,y+.133,z,0);cut.rotation.z=-.3;}}
function shelf(room,x,z,goods){
 const p=room.group;box(p,2.7,2.6,.13,WOOD,x,1.3,z-.25);
 for(const dx of [-1.35,1.35])box(p,.13,2.6,.65,DARK,x+dx,1.3,z);
 for(let row=0;row<3;row++){const y=.3+row*.8;box(p,2.7,.13,.7,'#a57a4a',x,y,z);
  for(let n=0;n<7;n++){const xx=x-1.05+n*.35;if(goods==='bread')loaf(p,xx,y+.20,z+.03);
   else if(goods==='books'){const colors=['#65897b','#b16b46','#bca065','#566a7b'];const b=box(p,.22,.4+(n%3)*.1,.32,colors[n%4],xx,y+.32,z);b.rotation.z=(n%3-1)*.06;box(p,.23,.025,.025,BRASS,xx,y+.35,z+.17,0);}
   else{mesh(p,new THREE.CylinderGeometry(.12,.16,.3,10),'#a8885d',xx,y+.22,z);box(p,.22,.06,.22,DARK,xx,y+.4,z);}}
 }
 room.solids.push([x-1.45,z-.4,x+1.45,z+.45]);
}
function lantern(room,x,z,index){
 const p=new THREE.Group();p.position.set(x,0,z);p.name=`life-interiors-lantern-${room.id}-${index}`;p.userData.fixture=true;room.group.add(p);
 box(p,.15,2.5,.15,DARK,0,1.25,0);box(p,.65,.12,.14,DARK,.25,2.45,0);
 const lamp=new THREE.Group();lamp.position.set(.5,1.95,0);p.add(lamp);
 box(lamp,.48,.1,.44,BRASS,0,-.29,0);mesh(lamp,new THREE.ConeGeometry(.39,.26,4),DARK,0,.4,0).rotation.y=Math.PI/4;
 const glass=new THREE.Mesh(new THREE.BoxGeometry(.32,.48,.30),new THREE.MeshToonMaterial({color:'#ffd181',emissive:'#ffc66a',emissiveIntensity:.65}));lamp.add(glass);
 for(const dx of [-.21,.21])for(const dz of [-.19,.19])box(lamp,.045,.6,.045,DARK,dx,0,dz);
 mesh(lamp,new THREE.TorusGeometry(.12,.025,6,12),BRASS,0,.59,0);
 const light=new THREE.PointLight('#ffb654',14,10,2);light.position.set(.5,2,0);p.add(light);
 const state={id:p.name,room:room.id,position:[x,z],on:true,fixture:p,light,glass};
 state.toggle=()=>{state.on=!state.on;light.intensity=state.on?14:0;glass.material.emissiveIntensity=state.on?.65:0;glass.material.color.set(state.on?'#ffd181':'#655746');};
 return state;
}
function hearth(room,smith=false){
 const p=room.group,x=3.6,z=-3.95;
 box(p,2.2,.16,1.7,'#77736a',x,.08,z+.3);box(p,2.1,3.5,.6,'#827c72',x,1.75,z-.4);
 for(const dx of [-.82,.82])box(p,.43,1.65,1.1,'#928672',x+dx,.83,z);
 box(p,2.3,.35,1.25,'#b1a18a',x,1.7,z);box(p,1.24,1.4,.06,'#332e2d',x,.75,z-.07);
 box(p,1.3,.16,.55,DARK,x,.22,z+.25);
 for(let n=0;n<5;n++){const m=mesh(p,new THREE.ConeGeometry(.12+n%2*.04,.42+n%3*.1,5),'#ed9b43',x-.45+n*.22,.48,z+.3);m.material=toonMaterial(n%2?'#ffcb69':'#d67836');}
 const light=new THREE.PointLight('#ff9e46',8,7,2);light.position.set(x,1,z+1);p.add(light);
 sign(p,smith?'FORGE • MIND THE HEARTH':'THE HEARTH IS ALWAYS WARM',x,2.3,z-.05,1.8);
 room.solids.push([x-1.3,z-.8,x+1.3,z+1.2]);
}
async function prop(room,id,x,z,size=1,y=0,rot=0){
 const o=await instantiate(id);const b=new THREE.Box3().setFromObject(o),dim=b.getSize(new THREE.Vector3()),s=size/Math.max(dim.x,dim.y,dim.z);o.scale.setScalar(s);o.position.set(x-(b.min.x+b.max.x)*s/2,y-b.min.y*s,z-(b.min.z+b.max.z)*s/2);o.rotation.y=rot;room.group.add(o);
 // Conservative square keeps rotated props solid too.
 const half=Math.max(dim.x,dim.z)*s/2;room.solids.push([x-half,z-half,x+half,z+half]);return o;
}
async function buildRoom(plan,scene){
 const room={...plan,group:new THREE.Group(),solids:[],fixtures:[]},p=room.group;p.name=`life-interiors-${room.id}`;p.position.set(plan.origin[0],0,plan.origin[1]);p.visible=false;scene.add(p);
 // Planks meet the grounded player at y=0. Wall panels, beams and a ceiling
 // create a complete room, including a physical 2m exit opening at the front.
 box(p,12,.18,10,DARK,0,-.1,0,0);
 for(let n=0;n<20;n++)box(p,11.8,.055,.48,n%3?'#ba925f':'#ad824e',0,-.027,-4.75+n*.5,.004);
 box(p,12,4.5,.20,CREAM,0,2.25,-5);box(p,.20,4.5,10,CREAM,-6,2.25,0);box(p,.20,4.5,10,CREAM,6,2.25,0);
 for(const x of [-3.55,3.55])box(p,4.9,4.5,.20,CREAM,x,2.25,5);
 box(p,2.2,1.5,.20,CREAM,0,3.75,5);box(p,12,.15,10,'#a78a64',0,4.55,0);
 for(const x of [-5.8,-2.8,0,2.8,5.8]){box(p,.18,4.5,.24,WOOD,x,2.25,-4.8);box(p,.17,.2,10,WOOD,x,4.35,0);}
 for(const z of [-4.8,0,4.8]){box(p,12,.22,.2,DARK,0,4.15,z);for(const x of [-5.8,5.8])box(p,.2,4.4,.2,WOOD,x,2.2,z);}
 for(const x of [-5.83,5.83]){box(p,.12,.85,9.8,room.accent,x,.425,0);box(p,.17,.1,9.8,WOOD,x,.9,0);}
 box(p,11.8,.8,.14,room.accent,0,.4,-4.83);box(p,11.8,.1,.19,WOOD,0,.87,-4.8);
 // Window panes and mullions are fixtures rather than floating light sources.
 for(const x of [-3.8,3.8]){box(p,1.5,1.35,.08,'#9ec9c4',x,2.35,-4.84);for(const dx of [-.78,0,.78])box(p,.07,1.5,.12,WOOD,x+dx,2.35,-4.74);for(const y of [1.62,2.35,3.08])box(p,1.65,.07,.12,WOOD,x,y,-4.74);}
 box(p,2.1,.025,2.2,room.accent,0,.015,2.5,.002);for(const x of [-.96,.96])box(p,.045,.03,2.05,'#e3c690',x,.035,2.5,0);
 for(const x of [-1.1,1.1])box(p,.2,3.0,.3,WOOD,x,1.5,4.95);box(p,2.4,.18,.3,WOOD,0,3.0,4.95);
 const exitSign=sign(p,'E  •  WILLOWMERE  →',0,3.35,4.82,2.6);exitSign.rotation.y=Math.PI;
 // A lit vestibule beyond the doorway makes the exit read clearly.
 box(p,3,.12,2.3,'#c1af8b',0,-.06,6);box(p,3,3.5,.1,'#a7c9bd',0,1.75,6.9);sign(p,'RETURN TO THE VILLAGE',0,1.9,6.83,2.7); // Room identity is already displayed by the fixed HUD title.
 room.fixtures=room.lanterns.map(([x,z],i)=>lantern(room,x,z,i));
 for(const [x,z] of room.lanterns)room.solids.push([x-.15,z-.2,x+.85,z+.2]);
 const fill=new THREE.PointLight('#ffe2ad',18,16,2);fill.position.set(0,3.8,-1);p.add(fill);
 if(room.id==='bakery'||room.id==='store'){
  box(p,4.8,1.12,.95,room.accent,-.6,.56,-1.35);box(p,5.05,.16,1.14,'#bc8d54',-.6,1.2,-1.35);
  for(const x of [-2.7,-1.3,.1,1.5])box(p,.055,.85,.03,BRASS,x,.58,-.855,0);
  room.solids.push([-3.15,-1.95,2,-.73]);room.counter=[-.6,.1];
  sign(p,room.id==='bakery'?'BREAD • BUNS • WARM WELCOMES':'PROVISIONS • BOOKS • SMALL WONDERS',-.6,.63,-.85,3.7);
  shelf(room,-3.7,-4.15,room.id==='bakery'?'bread':'books');shelf(room,-4.95,-1.7,room.id==='bakery'?'jars':'books');
  if(room.id==='bakery'){
   for(let n=0;n<6;n++)loaf(p,-2.55+n*.68,1.47,-1.35);hearth(room);
   await prop(room,'farm-grain-sacks',3.6,-.8,1.3);await prop(room,'cv-barrel',4.6,-2,1.05);
   table(room,3.9,2.8,1.45,1.05);loaf(p,3.9,1.25,2.8);chair(room,3.9,3.85);
  }else{
   shelf(room,2,-4.15,'jars');await prop(room,'farm-produce-crates',3.8,-1.2,1.6);await prop(room,'cv-barrel',4.7,-3.6,1.1);await prop(room,'cv-crate',3.4,3.6,.8);
   for(let n=0;n<4;n++){mesh(p,new THREE.CylinderGeometry(.13,.17,.35,10),'#9c7150',-2+n*.6,1.46,-1.35);box(p,.25,.08,.25,CREAM,-2+n*.6,1.67,-1.35);}
  }
 }else if(room.id==='inn'){
  hearth(room);shelf(room,-3.8,-4.15,'jars');
  box(p,2.7,1.1,.85,room.accent,-3.8,.55,-2.9);box(p,2.9,.14,1,WOOD,-3.8,1.17,-2.9);room.solids.push([-5.25,-3.45,-2.3,-2.3]);
  for(const [x,z] of [[-3,0],[2,-.5]]){table(room,x,z);chair(room,x,z+1.2);chair(room,x,z-1.2,Math.PI);
   for(const dx of [-.65,.65]){mesh(p,new THREE.CylinderGeometry(.27,.27,.035,16),'#eee1bc',x+dx,1.14,z);mesh(p,new THREE.CylinderGeometry(.10,.10,.23,12),'#668a83',x+dx+.35,1.23,z+.05);}loaf(p,x,1.27,z);}
  await prop(room,'cv-barrel',-5,2.8,1.05);await prop(room,'cv-bench',3.2,3.5,2);
  sign(p,'ROOMS & SUPPER • REST A WHILE',-3.8,2.9,-4.7,3.4);
 }else{
  hearth(room,true);shelf(room,-3.8,-4.15,'jars');table(room,-3.7,-1.6,3,1.1);
  for(let n=0;n<4;n++){box(p,.5,.14,.2,'#69717a',-4.6+n*.6,1.24,-1.6);box(p,.08,.08,.55,WOOD,-4.6+n*.6,1.3,-1.3);}
  // Anvil on a timber stump: horn, waist and wide foot, all grounded.
  mesh(p,new THREE.CylinderGeometry(.6,.72,.7,10),WOOD,.7,.35,.1);box(p,1.05,.18,.7,'#4b5158',.7,.78,.1);box(p,.5,.45,.45,'#606771',.7,1,.1);box(p,1.2,.24,.6,'#777e88',.7,1.34,.1);
  const horn=mesh(p,new THREE.ConeGeometry(.24,.85,8),'#777e88',1.65,1.34,.1);horn.rotation.z=-Math.PI/2;room.solids.push([-.1,-.65,2.15,.85]);
  await prop(room,'cv-firewood-stack',3.9,2.9,1.8);await prop(room,'cv-barrel',-4.6,2.7,1.1);await prop(room,'cv-crate',-3.4,2.9,.85);
  sign(p,'REPAIRS • TOOLS • SHARPENING',-3.8,3,-4.7,3.3);
 }
 return room;
}

export async function createInteriors(stage,town,camera,api,q){
 if(camera.mode==='iso')return (await import('./iso-interact.js')).createIsoInteriors(stage,town,camera,api,q,{plan:createInteriorPlan(town,RESOLVED),buildRoom}); // WORKTREE-HOOK iso — reuse rooms without the walking rig
 const plan=createInteriorPlan(town,RESOLVED),check=checkInteriorPlan(plan,town,RESOLVED);
 // Hamlet/life-off is deliberately untouched; M3's four rooms belong to large.
 if(!plan.length){Object.defineProperty(api,'interior',{get:()=>null});return null;}
 if(!check.ok)throw Error('life-interiors: '+check.failures.join(', '));
 const rooms=await Promise.all(plan.map(p=>buildRoom(p,stage.scene))),player=camera.player,keys=new Set();
 const view=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.08,120),originalUpdate=camera.update;
 let active=null,yaw=0,pitch=.28,returnPosition=null,outsideCamera=null,transition=0,pending=null,notice='',noticeUntil=0,nearest=null;
 const panel=document.createElement('div');panel.id='interior-prompt';panel.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:24px;max-width:410px;padding:14px 20px;background:#2e3029ef;color:#fff0cf;border:1px solid #d4b279;border-radius:10px;font:15px/1.6 system-ui;z-index:35;pointer-events:none;display:none';document.body.append(panel);
 const title=document.createElement('div');title.style.cssText='position:fixed;top:24px;left:50%;transform:translateX(-50%);padding:10px 24px;background:#382f27e8;border:1px solid #c9ab73;border-radius:8px;color:#ffe5b8;text-align:center;font:22px Georgia;z-index:32;display:none;pointer-events:none';document.body.append(title);
 const fade=document.createElement('div');fade.id='interior-fade';fade.style.cssText='position:fixed;inset:0;background:#201d1a;opacity:0;pointer-events:none;z-index:70';document.body.append(fade);
 const local=()=>active?[player.position.x-active.origin[0],player.position.z-active.origin[1]]:null;
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 function message(text,seconds=2.5){notice=text;noticeUntil=performance.now()/1000+seconds;}
 function snapView(){
  if(!active)return;const [x,z]=local(),ox=active.origin[0],oz=active.origin[1];
  // Short shoulder camera stays inside the walls; mouse look rotates it.
  view.position.set(ox+THREE.MathUtils.clamp(x+Math.sin(yaw)*3.3,-5.65,5.65),2.85+pitch*1.7,oz+THREE.MathUtils.clamp(z+Math.cos(yaw)*3.3,-4.65,4.62));
  view.lookAt(ox+x-Math.sin(yaw)*2.6,1.1,oz+z-Math.cos(yaw)*2.6);stage.camera=view;stage.controls.enabled=false;
 }
 function enterNow(room){
  outsideCamera=stage.camera;returnPosition=player.position.clone();active=room;notice='';noticeUntil=0;room.group.visible=true;yaw=0;pitch=.28;
  player.position.set(room.origin[0]+room.spawn[0],0,room.origin[1]+room.spawn[1]);player.rotation.y=Math.PI;player.visible=true;snapView();
  title.innerHTML=`${room.name}<br><span style="font:13px system-ui;opacity:.8">${room.subtitle}</span>`;title.style.display='block';
 }
 function exitNow(){
  const room=active;if(!room)return;room.group.visible=false;active=null;player.position.copy(returnPosition);player.position.y=0;stage.camera=outsideCamera;stage.controls.enabled=camera.mode==='overview';title.style.display='none';message('Back in Willowmere');
 }
 function change(fn){if(pending||transition)return false;pending=fn;transition=.6;return true;}
 function enter(id,{immediate=false}={}){
  if(active)return false;const room=rooms.find(r=>r.id===id);if(!room)return false;
  if(camera.mode!=='walk')document.dispatchEvent(new KeyboardEvent('keydown',{code:'Tab',bubbles:true}));
  // Capture URL entry returns to the same safe exterior doorstep.
  if(immediate){player.position.set(room.trigger[0],0,room.trigger[1]);enterNow(room);return true;}return change(()=>enterNow(room));
 }
 function exit(){return active?change(exitNow):false;}
 function action(){
  if(api.props?.handleInteriorAction(nearest))return; // WORKTREE-HOOK props
  if(transition)return;if(!nearest)return;if(nearest.type==='door')enter(nearest.room.id);else if(nearest.type==='exit')exit();else if(nearest.type==='lamp'){nearest.fixture.toggle();message(nearest.fixture.on?'Lantern lit':'Lantern extinguished');}else message(nearest.type==='stall'?'Browse the market stall · fresh village produce':active.id==='bakery'?'At the bakery counter · today’s bread is ready':'At the counter · browse the village provisions');}
 document.addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(active&&['Tab','KeyM'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();message('Return through the doorway with E to use the overview.');return;}
  keys.add(e.code);if(e.code==='KeyE'&&!e.repeat){e.preventDefault();action();}
 },true);
 document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
 document.addEventListener('mousemove',e=>{if(active&&document.pointerLockElement===stage.renderer.domElement){e.stopImmediatePropagation();yaw-=e.movementX*.0025;pitch=THREE.MathUtils.clamp(pitch+e.movementY*.0025,-.15,.75);}},true);
 const setMode=stage.setMode;stage.setMode=mode=>{if(active){message('Return through the doorway with E to use the overview.');return;}setMode(mode);};
 window.addEventListener('resize',()=>{view.aspect=innerWidth/innerHeight;view.updateProjectionMatrix();});
 camera.update=(dt,seconds)=>{
  if(transition){transition=Math.max(0,transition-dt);if(transition<=.3&&pending){const fn=pending;pending=null;fn();}fade.style.opacity=String(1-Math.abs(transition-.3)/.3);if(!transition)fade.style.opacity='0';}
  nearest=null;
  if(active){
   player.visible=true;const [x,z]=local();let dx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),dz=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);const length=Math.hypot(dx,dz);
   if(length&&!transition){dx/=length;dz/=length;const vx=(Math.cos(yaw)*dx-Math.sin(yaw)*dz)*3.2*dt,vz=(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)*3.2*dt,steps=Math.max(1,Math.ceil(3.2*dt/.1));let px=x,pz=z;
    for(let n=0;n<steps;n++){if(!roomBlocked(active,px+vx/steps,pz))px+=vx/steps;if(!roomBlocked(active,px,pz+vz/steps))pz+=vz/steps;}player.position.set(active.origin[0]+px,0,active.origin[1]+pz);player.rotation.y=Math.atan2(vx,vz);
   }
   player.position.y=0;const p=local();
   if(dist(p,active.exit)<1.5)nearest={type:'exit',text:'E · Return to Willowmere'};
   for(const fixture of active.fixtures)if(dist(p,fixture.position)<1.65)nearest={type:'lamp',fixture,text:`E · ${fixture.on?'Extinguish':'Light'} lantern`};
   if(['bakery','store'].includes(active.id)&&dist(p,active.counter)<1.6)nearest={type:'counter',text:'E · Use the counter'};
   if(p[1]>5.15&&Math.abs(p[0])<.78&&!transition)exit();snapView();
  }else{
   originalUpdate(dt,seconds);if(camera.mode==='walk'){
    const p=[player.position.x,player.position.z];for(const room of rooms)if(dist(p,room.trigger)<2)nearest={type:'door',room,text:`E · Enter ${room.id==='inn'?'the inn':'the '+room.id}`};
    if(!nearest)for(const stall of town.instances.filter(i=>i.id==='cv-market-stall'))if(dist(p,stall.pos)<2.8)nearest={type:'stall',text:'E · Browse market stall'};
   }
  }
  const text=noticeUntil>seconds?notice:nearest?.text;
  panel.style.display=text||active?'block':'none';panel.textContent=text||'WASD · Walk   |   Click + mouse · Look   |   E · Door / counter / lantern';
  const hud=document.getElementById('life-hud');if(hud)hud.style.display=active?'none':'';
 };
 Object.defineProperty(api,'interior',{get:()=>active?{id:active.id,name:active.name}:null});
 api.interiors={plan,rooms,player,enter,exit,get fixtures(){return rooms.flatMap(r=>r.fixtures);},get prompt(){return nearest?.type||null;},get transitioning(){return transition>0;},view(a=0,p=.28){yaw=a;pitch=p;snapView();},inspect(){return {check,active:active?.id||null,player:player.position.toArray(),local:local(),prompt:nearest?.type||null,fixtures:rooms.flatMap(r=>r.fixtures.map(f=>({id:f.id,room:f.room,on:f.on,fixture:!!f.fixture.userData.fixture,light:f.light.intensity}))) };}};
 if(q.has('interior'))enter(q.get('interior'),{immediate:true});
 return api.interiors;
}
