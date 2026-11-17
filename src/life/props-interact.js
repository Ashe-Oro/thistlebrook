// M4: runtime affordances only. The compiled town and registry are never mutated.
import * as THREE from 'three';
import { registerTool, executeTool, getTool, precheck } from './tools.js';
import { resolvePlace, findPlace, interactionPoints, nearestEntryNode, isOpen } from '../world/registry.js';
import { nearestNode, route } from './graph.js';
import { toonMaterial } from '../toon.js';

const position = ctx => ctx?.pos || ctx?.location?.pos;
const validPosition = p => Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const point = (world,p,kind) => interactionPoints(world.registry,p.id,kind)[0]?.pos || p.pos;
export function registerPropsTools() {
 const actions={sit:['seat','seat'],drawWater:['well','entry'],ringBell:[null,'entry'],buy:['market','entry'],openDoor:[null,'entry'],closeDoor:[null,'entry'],eat:['tavern','seat']};
 for(const [name,[type,kind]] of Object.entries(actions)) {
  // Player affordances have their own scope; canonical resident tools stay intact.
  if(getTool(name,'props'))continue;
  registerTool({name,argsSchema:{type:'object',properties:{target:{oneOf:[{type:'string'},{type:'object'}]}},required:['target'],additionalProperties:false},resultSchema:{type:'object',properties:{ok:{type:'boolean'},placeId:{type:'string'},action:{type:'string'}}},
   precheck(args,ctx,world){
    if(!args||!['string','object'].includes(typeof args.target)||args.target===null)return 'target must be a place ID or query';
    const p=resolvePlace(world.registry,args.target,{near:position(ctx)});if(!p)return 'place not found';
    if(type&&p.type!==type)return `requires ${type}`;
    if(name==='ringBell'&&p.id!==world.props.bellPlaceId)return 'no bell here';
    if(/Door$/.test(name)&&!world.props.doors.has(p.id))return 'no enterable door';
    if(name==='buy'&&!isOpen(p.hours,world.hour??12))return 'stall is closed';
    const target=world.props.approach(p,name)||point(world,p,kind);
    if(!validPosition(position(ctx))||distance(position(ctx),target)>3.2)return 'too far away; walkTo the place first';
    if(world.props.busy?.())return 'door transition in progress';
    return null;
   },
   execute(args,ctx,world){const p=resolvePlace(world.registry,args.target,{near:position(ctx)});ctx.inventory??={};
    if(name==='buy')ctx.inventory.produce=(ctx.inventory.produce||0)+1;
    if(name==='drawWater')ctx.inventory.water=(ctx.inventory.water||0)+1;
    if(name==='eat')ctx.meals=(ctx.meals||0)+1;
    ctx.action={tool:name,placeId:p.id};
    const result={ok:true,action:name,placeId:p.id,inventory:{...ctx.inventory}};
    world.props.apply(name,p,ctx,result);return result;
   }},'props');
 }
 if(!getTool('walkTo','props'))registerTool({name:'walkTo',argsSchema:{type:'object',properties:{target:{oneOf:[{type:'string'},{type:'object'}]}},required:['target']},resultSchema:{type:'object',properties:{ok:{type:'boolean'},path:{type:'array',items:{type:'integer'}}}},
  precheck(args,ctx,world){if(world.props.isInside?.(ctx))return 'leave the interior first';const p=resolvePlace(world.registry,args?.target,{near:position(ctx)});return !args?.target||!p?'place not found':!validPosition(position(ctx))?'actor position required':nearestEntryNode(world.registry,world.graph,p.id)<0?'no reachable entry':null;},
  execute(args,ctx,world){const p=resolvePlace(world.registry,args.target,{near:position(ctx)}),end=nearestEntryNode(world.registry,world.graph,p.id),path=route(world.graph,nearestNode(world.graph,position(ctx)),end);if(!path.length||path.at(-1)!==end)return {ok:false,error:'no route'};ctx.action={tool:'walkTo',placeId:p.id,path:[...path]};return {placeId:p.id,path:[...path],destination:[...world.graph.nodes[end].pos]};}},'props');
}

export function createProps(stage,town,camera,api) {
 if(!town.registry||!api.interiors)return null;
 registerPropsTools();
 const registry=town.registry,graph=town.life.graph,player=camera.player,interiors=api.interiors;
 const places=findPlace(registry,{});
 const doors=new Map(),history=[];
 const group=new THREE.Group();group.name='life-props';stage.scene.add(group);
 function mesh(parent,geo,color,x,y,z){const m=new THREE.Mesh(geo,toonMaterial(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 const box=(p,w,h,d,c,x,y,z)=>mesh(p,new THREE.BoxGeometry(w,h,d),c,x,y,z);
 for(const room of interiors.rooms){const p=places.find(p=>p.catalogId===room.building);if(!p)continue;
  const hinge=new THREE.Group();hinge.position.set(-1,0,4.95);room.group.add(hinge);
  box(hinge,1.95,2.85,.13,'#795136',.975,1.425,0);
  for(const y of [.65,1.95])box(hinge,1.55,.75,.05,'#aa7948',.975,y,-.09);
  mesh(hinge,new THREE.SphereGeometry(.09,10,8),'#d6ad59',1.72,1.35,-.16);
  const open=api.interior?.id===room.id;hinge.rotation.y=open?-Math.PI*.56:0;doors.set(p.id,{room,hinge,open});
 }
 // Real handled mugs and a soup bowl replace the ambiguous cylindrical cups visually.
 const inn=interiors.rooms.find(r=>r.id==='inn');
 let meal=null;
 if(inn){meal=new THREE.Group();meal.name='life-props-inn-meal';inn.group.add(meal);
  for(const x of [-3.35,1.65]){
   mesh(meal,new THREE.CylinderGeometry(.19,.16,.33,16,true),'#72a39a',x,1.29,.22);
   mesh(meal,new THREE.CylinderGeometry(.155,.155,.015,16),'#704932',x,1.43,.22);
   mesh(meal,new THREE.TorusGeometry(.12,.038,8,16),'#72a39a',x+.21,1.3,.22);
   mesh(meal,new THREE.SphereGeometry(.30,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2),'#e5c58c',x+.57,1.37,.1);
   mesh(meal,new THREE.CylinderGeometry(.285,.285,.02,16),'#be773e',x+.57,1.37,.1);
  }
 }
 const bellHost=findPlace(registry,{type:'chapel'}).find(p=>p.entryNode>=0)||findPlace(registry,{type:'plaza'}).find(p=>p.entryNode>=0)||findPlace(registry,{type:'well'}).find(p=>p.entryNode>=0);
 let bell=null,bellSwing=0;
 if(bellHost){const p=graph.nodes[bellHost.entryNode].pos;bell=new THREE.Group();bell.name='life-props-town-bell';bell.position.set(p[0]+1.6,0,p[1]);group.add(bell);
  for(const x of [-.48,.48])box(bell,.13,2.3,.15,'#72553a',x,1.15,0);box(bell,1.2,.16,.2,'#72553a',0,2.25,0);
  const swing=new THREE.Group();swing.position.y=1.93;bell.add(swing);bell.userData.swing=swing;
  mesh(swing,new THREE.CylinderGeometry(.15,.33,.42,16,1,true),'#d4ac58',0,-.17,0);mesh(swing,new THREE.TorusGeometry(.32,.045,8,20),'#e5bf6b',0,-.38,0).rotation.x=Math.PI/2;
  mesh(swing,new THREE.SphereGeometry(.065,10,8),'#694b2d',0,-.37,0);box(swing,.025,.72,.025,'#c4ab7b',.12,-.7,0);
 }

 // Iso shares the furnished rooms and town props without a walking player rig.
 if(camera.mode==='iso'){
  const props={doors,meal,bell,inspect:()=>({doors:[...doors].map(([placeId,d])=>({placeId,room:d.room.id,open:d.open})),bellPlaceId:bellHost?.id,meal:!!meal,history:[...history]})};
  api.props=props;return props;
 }
 const actor={id:'player',pos:[player.position.x,player.position.z],inventory:{}};
 // The licensed figure is rigid. Bend a private geometry copy at hips/knees;
 // keep the shared asset (and every resident using it) untouched.
 const seatMeshes=[],vertex=new THREE.Vector3();
 player.updateWorldMatrix(true,true);
 player.children[0].traverse(o=>{
  if(!o.isMesh)return;
  const standing=o.geometry,sitting=standing.clone(),a=sitting.attributes.position;
  for(let i=0;i<a.count;i++){
   vertex.fromBufferAttribute(a,i);o.localToWorld(vertex);player.worldToLocal(vertex);
   const y=vertex.y;
   if(y>=.9)vertex.y=y-.2;
   else if(y>=.42){vertex.y=.7;vertex.z+=(.9-y)*.9;}
   else{vertex.y=y*.7/.42;vertex.z+=.432;}
   player.localToWorld(vertex);o.worldToLocal(vertex);a.setXYZ(i,vertex.x,vertex.y,vertex.z);
  }
  sitting.computeVertexNormals();sitting.computeBoundingBox();sitting.computeBoundingSphere();
  seatMeshes.push({o,standing,sitting});
 });
 let visualSeated=false;
 let seated=null,walking=null,captureView=null,notice='',noticeUntil=0;
 const held=new THREE.Group();held.name='life-props-held';player.add(held);held.visible=false;
 mesh(held,new THREE.CylinderGeometry(.22,.18,.34,12),'#8daebb',.45,.85,.3);mesh(held,new THREE.TorusGeometry(.22,.025,6,16),'#d2c19d',.45,1.06,.3).rotation.x=Math.PI/2;
 const panel=document.createElement('div');panel.id='life-props-prompt';panel.style.cssText='position:fixed;bottom:95px;left:50%;transform:translateX(-50%);padding:12px 20px;border:1px solid #dbc086;border-radius:10px;background:#293b34ed;color:#fff0ce;font:16px Georgia;z-index:38;pointer-events:none;display:none';document.body.append(panel);
 const world={registry,graph,get hour(){return api.hour;},props:{doors,bellPlaceId:bellHost?.id,busy:()=>interiors.transitioning,isInside:ctx=>ctx===actor&&!!api.interior,
  approach(p,name){const d=doors.get(p.id);if(d)return api.interior?.id===d.room.id?[d.room.origin[0]+(name==='eat'?-3:0),d.room.origin[1]+(name==='eat'?1.3:4.25)]:d.room.trigger;if(name==='ringBell'&&bell)return [bell.position.x,bell.position.z];return point(world,p,name==='sit'?'seat':'entry');},
  apply(name,p,ctx,result){
   if(name==='sit'&&ctx===actor){seated={pos:[...point(world,p,'seat')],facing:interactionPoints(registry,p.id,'seat')[0]?.facing||[0,1]};walking=null;}
   if(name==='drawWater'&&ctx===actor){held.visible=true;heldUntil=performance.now()/1000+5;}
   if(name==='ringBell'){bellSwing=performance.now()/1000;try{const ac=new (window.AudioContext||window.webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=660;g.gain.setValueAtTime(.14,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+1.8);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+1.8);o.onended=()=>ac.close();}catch{/* Muted browser still gets the visual bell. */}}
   if(/Door$/.test(name)){const d=doors.get(p.id);d.open=name==='openDoor';d.hinge.rotation.y=d.open?-Math.PI*.56:0;if(ctx===actor){if(d.open&&!api.interior)interiors.enter(d.room.id);else if(!d.open&&api.interior)interiors.exit();}result.open=d.open;}
  }}};
 let heldUntil=0;
 const labels={sit:'Sit and rest',drawWater:'Draw cool well water',ringBell:'Ring the village bell',buy:'Buy fresh produce',openDoor:'Open door & enter',closeDoor:'Close door & return',eat:'Enjoy soup & a warm mug'};
 function sync(){actor.pos=[player.position.x,player.position.z];}
 function run(name,target,ctx=actor){sync();const result=executeTool(name,{target},ctx,world);history.push({tool:name,...result});if(history.length>40)history.shift();notice=result.ok?`${labels[name]||name} ✓`:result.error;noticeUntil=performance.now()/1000+3;if(name==='walkTo'&&result.ok&&ctx===actor){walking=[...result.path];seated=null;}return result;}
 function candidates(){sync();if(interiors.transitioning)return [];
  if(api.interior){const d=[...doors.entries()].find(([,d])=>d.room.id===api.interior.id);const room=d?.[1].room;if(!room)return [];const local=[player.position.x-room.origin[0],player.position.z-room.origin[1]];const out=[];if(distance(local,room.exit)<1.6)out.push({tool:'closeDoor',placeId:d[0],pos:room.exit,distance:distance(local,room.exit)});if(room.id==='inn'&&distance(local,[-3,1.3])<2)out.push({tool:'eat',placeId:d[0],distance:distance(local,[-3,1.3])});return out;}
  const out=[];
  for(const p of places){let tool=p.type==='seat'?'sit':p.type==='well'?'drawWater':p.type==='market'?'buy':doors.has(p.id)?'openDoor':null;if(tool){const pos=world.props.approach(p,tool),d=distance(actor.pos,pos);if(d< (tool==='openDoor'?2:3))out.push({tool,placeId:p.id,pos,distance:d});}}
  if(bell){const pos=[bell.position.x,bell.position.z],d=distance(actor.pos,pos);if(d<2)out.push({tool:'ringBell',placeId:bellHost.id,pos,distance:d});}
  return out.filter(c=>!precheck(c.tool,{target:c.placeId},actor,world)).sort((a,b)=>a.distance-b.distance);
 }
 const props={world,actor,doors,history,meal,bell,run,candidates,view(options=null){captureView=options;},get seated(){return !!seated;},handleInteriorAction(nearest){const c=candidates()[0];if(nearest?.type==='lamp'&&api.interior){const room=interiors.rooms.find(r=>r.id===api.interior.id),local=[player.position.x-room.origin[0],player.position.z-room.origin[1]];if(distance(local,nearest.fixture.position)<(c?.distance??Infinity))return false;}if(seated){seated=null;player.position.y=0;notice='Back on your feet';noticeUntil=performance.now()/1000+2;return true;}if(!c)return false;run(c.tool,c.placeId);return true;},inspect(){return {actor:JSON.parse(JSON.stringify(actor)),seated:!!seated,walking:!!walking,candidates:candidates(),doors:[...doors].map(([placeId,d])=>({placeId,room:d.room.id,open:d.open})),bellPlaceId:bellHost?.id,meal:!!meal,history:[...history]};}};
 api.props=props;
 document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){seated=null;walking=null;player.position.y=0;}if(e.code==='KeyO'&&!e.repeat){const d=props.inspect().doors.find(d=>d.room===api.interior?.id);if(d){run(d.open?'closeDoor':'openDoor',d.placeId);}}});
 const original=camera.update;camera.update=(dt,seconds)=>{
  if(walking?.length){let budget=dt*4;while(budget>0&&walking.length){const p=graph.nodes[walking[0]].pos,d=distance([player.position.x,player.position.z],p);if(d<.02){walking.shift();continue;}const step=Math.min(d,budget),dx=p[0]-player.position.x,dz=p[1]-player.position.z;player.position.x+=dx/d*step;player.position.z+=dz/d*step;player.rotation.y=Math.atan2(dx,dz);budget-=step;}}
  if(walking&&!walking.length){walking=null;actor.action.arrived=true;}
  if(seated){player.position.set(seated.pos[0],0,seated.pos[1]);player.rotation.y=Math.atan2(seated.facing[0],seated.facing[1]);}
  if(visualSeated!==!!seated){visualSeated=!!seated;for(const m of seatMeshes)m.o.geometry=visualSeated?m.sitting:m.standing;}
  original(dt,seconds);
  if(captureView&&!api.interior){const center=captureView.bell&&bell?bell.position:player.position;const offset=captureView.offset||[5,4.1,6];stage.camera.position.set(center.x+offset[0],offset[1],center.z+offset[2]);stage.camera.lookAt(center.x,1.1,center.z);}
  if(bell)bell.userData.swing.rotation.z=Math.sin((seconds-bellSwing)*12)*Math.exp(-Math.max(0,seconds-bellSwing)*1.4)*.45;
  if(seconds>heldUntil)held.visible=false;
  const c=candidates()[0];panel.textContent=seconds<noticeUntil?notice:seated?'E · Stand up':c?`E · ${labels[c.tool]}`:'';panel.style.display=panel.textContent?'block':'none';
 };
 return props;
}
