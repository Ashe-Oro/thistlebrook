import {createRigidBatches} from '../rigid-batches.js';
import {tagObject} from '../registry/render-tags.js';
import * as THREE from 'three';
import { toonMaterial } from '../../toon.js';
import { baseballFrame, chessFrame, CHESS_LINE } from './activities.js';

/** Private pose copies keep the shared licensed models and their ink hulls intact. */
export function residentPoses(object){
 const meshes=[],v=new THREE.Vector3();let seated=false,prepared=false;
 object.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(object),height=(box.max.y-box.min.y)/object.scale.y,hip=height*.5,knee=height*.25;
 function prepare(){
  object.updateMatrixWorld(true);
  object.traverse(m=>{
   if(!m.isMesh||m.userData.lifeAccessory)return;
   const standing=m.geometry,sitting=standing.clone(),position=sitting.attributes.position;
   for(let i=0;i<position.count;i++){
    v.fromBufferAttribute(position,i);m.localToWorld(v);object.worldToLocal(v);
    const y=v.y;
    if(y>=hip)v.y=y-hip;
    else if(y>=knee){v.y=0;v.z+=(hip-y)*1.05;}
    else{v.y=y-knee;v.z+=(hip-knee)*1.05;}
    object.localToWorld(v);m.worldToLocal(v);position.setXYZ(i,v.x,v.y,v.z);
   }
   sitting.computeVertexNormals();sitting.computeBoundingBox();sitting.computeBoundingSphere();meshes.push({m,standing,sitting});
  });prepared=true;
 }
 return {height,setSeat(on){if(on&&!prepared)prepare();if(seated===on)return;seated=on;for(const {m,standing,sitting}of meshes)m.geometry=on?sitting:standing;}};
}

export function buildLifeVisuals(scene,life){
 const root=new THREE.Group();root.name='astra-life-furnishings';scene.add(root);
 const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.IcosahedronGeometry(1,1),materials=new Map();
 const mat=c=>{if(!materials.has(c))materials.set(c,toonMaterial(c));return materials.get(c);};
 const mesh=(geometry,color,pos,scale,parent=root)=>{const m=new THREE.Mesh(geometry,mat(color));m.position.set(...pos);m.scale.set(...scale);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 const box=(color,pos,scale,parent)=>mesh(cube,color,pos,scale,parent);
 const pieces=[],board=life.registry.places.find(p=>p.furnishing==='chess');
 const square=s=>[(s.charCodeAt(0)-97-3.5)*.115,(Number(s[1])-1-3.5)*.115];
 for(const p of life.registry.places.filter(p=>p.furnishing)){
  const [x,z]=p.pos,g=new THREE.Group();g.position.set(x,0,z);g.userData.lifePlaceId=p.id;root.add(g);
  if(p.furnishing==='picnic'){
   for(let i=-1;i<=1;i++)box('#b2946d',[0,.85,i*.28],[2.6,.13,.26],g);
   for(const side of [-1,1]){box('#c0a47b',[0,.49,side],[2.5,.13,.42],g);for(const dx of [-.85,.85]){box('#816b52',[dx,.26,side],[.12,.5,.32],g);const leg=box('#8f7658',[dx,.43,0],[.15,.85,1.7],g);leg.rotation.z=dx>0?.12:-.12;}}
   for(const dx of [-.65,.65]){mesh(new THREE.CylinderGeometry(.19,.19,.035,12),'#e8ddc2',[dx,.94,0],[1,1,1],g);mesh(sphere,'#c79452',[dx,.99,0],[.12,.07,.1],g);}
  }else{
   box('#9e8764',[0,.83,0],[1.3,.14,1.3],g);box('#7b7158',[0,.42,0],[.25,.8,.25],g);
   for(let row=0;row<8;row++)for(let col=0;col<8;col++)box((row+col)%2?'#617d6b':'#ead9af',[(col-3.5)*.115,.914,(row-3.5)*.115],[.115,.025,.115],g);
   for(const slot of p.interaction.slots){const local=[slot.position[0]-x,.49,slot.position[1]-z];box('#b69a71',local,[.6,.13,.58],g);box('#806d53',[local[0],.25,local[2]],[.13,.48,.13],g);box('#b69a71',[local[0],.88,local[2]+(slot.role==='white'?.27:-.27)],[.62,.7,.09],g);}
   for(const side of [0,1])for(let row=0;row<2;row++)for(let col=0;col<8;col++){
    const squareId=String.fromCharCode(97+col)+String(side?8-row:row+1),coords=square(squareId),piece=new THREE.Group();piece.position.set(coords[0],.93,coords[1]);g.add(piece);
    const color=side?'#3f554b':'#fff0cd',pawn=row===1;
    mesh(new THREE.CylinderGeometry(.025,.04,pawn?.07:.11,6),color,[0,pawn?.035:.055,0],[1,1,1],piece);
    mesh(sphere,color,[0,pawn?.085:.13,0],[.03,.035,.03],piece);pieces.push({object:piece,start:squareId});
   }
  }
 }
 for(const g of root.children)if(g.userData.lifePlaceId)tagObject(g,g.userData.lifePlaceId);
 const rigid=createRigidBatches(root);
 const baseballs=new Map();
 for(const p of life.registry.places.filter(p=>p.interaction?.activity==='baseball')){const ball=mesh(sphere,'#fff3d6',[0,0,0],[.14,.14,.14]);ball.visible=false;tagObject(ball,p.id);baseballs.set(p.id,ball);}
 return {root,update(){
  for(const [id,ball]of baseballs){const game=life.games.get(id),p=life.registry.places.find(p=>p.id===id);ball.visible=!!game&&game.members.split('|').length>=p.interaction.minParticipants;if(ball.visible)ball.position.set(...baseballFrame(p.interaction,game.elapsed).ball);}
  if(board){const game=life.games.get(board.id),frame=chessFrame(game?.elapsed||0);const positions=new Map(pieces.map(p=>[p.start,p.start]));
   for(let i=0;i<=frame.turn;i++){
    const [from,to]=CHESS_LINE[i],key=[...positions].find(([,s])=>s===from)?.[0];if(!key)continue;
    if(i<frame.turn)positions.set(key,to);
    if(from==='e1'&&to==='g1'&&i<frame.turn)positions.set('h1','f1');
   }
   for(const piece of pieces){let pos=positions.get(piece.start),coords=square(pos);const [from,to]=frame.move;
    if(pos===from){const end=square(to);coords=coords.map((v,k)=>v+(end[k]-v)*frame.progress);}
    if(frame.move[0]==='e1'&&piece.start==='h1'){const start=square('h1'),end=square('f1');coords=start.map((v,k)=>v+(end[k]-v)*frame.progress);}
    piece.object.position.set(coords[0],.93,coords[1]);
   }
  }
  rigid.update();
 }};
}

// Districts with moving rides (Pinecrest) supply live seat poses for residents.
let ridePoses=null;
export function registerRidePoses(provider){ridePoses=provider;}
export function activityPose(actor,place,t){
 const slot=place?.interaction?.slots.find(s=>s.id===actor.context.location.slot);
 const pose={indoors:!!actor.action?.sleeping,position:actor.context.location.position,facing:actor.facing,seated:slot?.kind==='seat'&&actor.action?.tool!=='walkTo',height:slot?.seatHeight,lean:0,bat:false,run:false};
 if(place?.interaction?.ride&&ridePoses&&slot&&actor.action&&actor.action.tool!=='walkTo'&&Number.isFinite(t)){
  const ride=ridePoses(place.interaction.ride,slot.seat??0,t,t-(actor.action.elapsed||0));
  if(ride){pose.position=ride.position;pose.height=ride.height;pose.facing=ride.facing;pose.seated=true;pose.riding=true;}
 }
 // Maple Hollow yards (opus-suburb): swings swing, hoops bounce, sprinklers get run through.
 const yard=place?.interaction?.yard;
 if(yard&&slot&&actor.action&&actor.action.tool!=='walkTo'&&Number.isFinite(t)){
  const k=actor.index*1.7,f=[Math.sin(slot.facing),Math.cos(slot.facing)],p=slot.position;
  if(slot.id.startsWith('swing')){const a=Math.sin(t*2.3+k);pose.position=[p[0]+f[0]*a*.42,p[1]+f[1]*a*.42];pose.seated=true;pose.height=.42+(1-Math.cos(a*.9))*.55;pose.lean=-a*.18;}
  else if(slot.id==='treehouse'){pose.lift=1.3;pose.facing=slot.facing+Math.sin(t*.4+k)*.8;}
  else if(slot.id.startsWith('hoop')){const u=(t*.9+k)%2;pose.lift=u<.35?Math.sin(u/.35*Math.PI)*.38:0;pose.run=u>1.2&&u<1.6;}
  else if(slot.id.startsWith('sprinkler')){const a=t*1.6+k;pose.position=[p[0]+Math.cos(a)*.9,p[1]+Math.sin(a)*.9];pose.facing=Math.atan2(-Math.sin(a),Math.cos(a));pose.run=true;}
  else if(slot.id==='pool'){pose.lift=-.18+Math.sin(t*2+k)*.04;}
 }
 if(place?.interaction?.activity==='baseball'&&actor.game?.ready){
  const f=baseballFrame(place.interaction,actor.game.elapsed);pose.position=f.positions[slot.role];pose.run=slot.role==='batter'&&f.running||slot.role==='fielder'&&(actor.game.elapsed%36>3&&actor.game.elapsed%36<6||actor.game.elapsed%36>8.4&&actor.game.elapsed%36<11);
  const aim=slot.role==='pitcher'?place.interaction.game.bases[0]:place.interaction.game.mound;
  pose.facing=Math.atan2(aim[0]-pose.position[0],aim[1]-pose.position[1]);
  if(pose.run){const next=baseballFrame(place.interaction,actor.game.elapsed+.03).positions[slot.role];pose.facing=Math.atan2(next[0]-pose.position[0],next[1]-pose.position[1]);}
  pose.bat=slot.role==='batter'&&!f.running;
  if(slot.role==='pitcher'&&f.pitching)pose.lean=-.22*Math.sin((actor.game.elapsed%36-1.3)/1.5*Math.PI);
  if(slot.role==='batter'&&f.batting)pose.facing+=Math.sin((actor.game.elapsed%36-2.8)*Math.PI*2)*1.1;
  if(slot.role==='fielder'&&f.fielding)pose.lean=.4;
 }
 if(pose.seated&&place?.interaction?.activity==='chess'&&actor.game?.ready){const f=chessFrame(actor.game.elapsed);if(f.side===slot.role)pose.lean=Math.sin(f.progress*Math.PI)*.12;}
 return pose;
}
