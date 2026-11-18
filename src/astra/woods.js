// OWNER: grok-woods lane. Contract: docs/specs/GROK-WOODS.md.
// Renders Pinewood from town.woods: the ridge terrain, draped dirt trails,
// the pond, the summit lookout, trailhead signs and the hikers. Trees, rocks,
// benches and the cairn stones are owned-kit instances drawn by landscape.js.
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {place} from '../catalog/loader.js';
import {toonMaterial} from '../toon.js';
import {tagObject} from './registry/render-tags.js';
import {ridgeHeight,terrainY,GROUND_TOP,TRAIL,RIDGE_STEP,RIDGE_SINK} from '../compiler/woods.js';
import {hikerRoster,hikerPose,HIKERS_WEEKEND} from './woods-hikers.js';

const lifted=(color,factor=-2)=>{const m=toonMaterial(color).clone();m.polygonOffset=true;m.polygonOffsetFactor=factor;m.polygonOffsetUnits=factor;return m;};

// Ridge: a grid over the footprint, only the cells that rise above the
// mainland. Sits 2.5 cm low so its foot tucks under the slab without z-fighting.
function ridgeMesh(woods){
 const b=woods.ridge.bounds,step=RIDGE_STEP,nx=Math.ceil((b.maxX-b.minX)/step),nz=Math.ceil((b.maxZ-b.minZ)/step);
 const pos=[],idx=[],H=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=b.minX+i*step,z=b.minZ+j*step,h=ridgeHeight(x,z);H.push(h);pos.push(x,GROUND_TOP+h-RIDGE_SINK,z);}
 const at=(i,j)=>j*(nx+1)+i;
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=at(i,j),c=at(i+1,j),d=at(i,j+1),e=at(i+1,j+1);if(H[a]+H[c]+H[d]+H[e]<=0)continue;idx.push(a,d,c,c,d,e);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 // Colour by height and slope: meadow green at the foot, darker pine-floor
 // green on the flanks, dry grass and pale rock on the steep upper slopes.
 const foot=new THREE.Color('#a5b67d'),flank=new THREE.Color('#93a46f'),high=new THREE.Color('#b4b083'),rock=new THREE.Color('#bdb59c'),col=[],n=g.attributes.normal,tmp=new THREE.Color();
 H.forEach((h,i)=>{const steep=1-n.getY(i);tmp.copy(foot).lerp(flank,Math.min(1,h/3)).lerp(high,Math.max(0,Math.min(1,(h-6)/5))).lerp(rock,Math.max(0,Math.min(.8,(steep-.18)*3)));col.push(tmp.r,tmp.g,tmp.b);});
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 const mat=toonMaterial('#ffffff').clone();mat.vertexColors=true;
 const m=new THREE.Mesh(g,mat);m.receiveShadow=true;m.castShadow=true;return m;
}
// A ribbon draped on the terrain: every edge vertex takes the ground height
// at its own (x,z), so the trail hugs cross-slopes. Bridge decks are skipped.
function ribbon(trails,width,lift){
 const geos=[];
 for(const t of trails){
  const pts=t.points,pos=[],idx=[];let run=0;
  pts.forEach((p,i)=>{
   const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1,nx=-dz/l*width/2,nz=dx/l*width/2;
   const wob=1+.12*Math.sin(i*.9+t.length);
   for(const s of [1,-1]){const x=p[0]+nx*s*wob,z=p[2]+nz*s*wob;pos.push(x,terrainY(x,z)+lift,z);}
   if(i<pts.length-1&&!(p.onBridge||pts[i+1].onBridge)){const j=i*2;idx.push(j,j+2,j+1,j+1,j+2,j+3);}
   run++;
  });
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);geos.push(g);
 }
 const g=mergeGeometries(geos);g.computeVertexNormals();return g;
}
function sign(lines,width){
 const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');
 x.fillStyle='#6d5137';x.fillRect(0,0,512,256);x.fillStyle='#8a6a48';x.fillRect(10,10,492,236);x.fillStyle='#f6e8c6';x.textAlign='center';x.textBaseline='middle';
 x.font='bold 54px Georgia';x.fillText(lines[0],256,62);x.font='36px Georgia';lines.slice(1).forEach((l,i)=>x.fillText(l,256,132+i*52));
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 return new THREE.Mesh(new THREE.PlaneGeometry(width,width/2),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
}

export async function buildWoods(scene,town){
 const woods=town.woods,root=new THREE.Group();root.name='Pinewood';scene.add(root);
 if(!woods)return {update(){},audit:()=>({})};
 const ridge=ridgeMesh(woods);root.add(tagObject(ridge,'woods:ridge'));
 // Trails: a darker worn shoulder under a lighter tread.
 const shoulder=new THREE.Mesh(ribbon(woods.trails,TRAIL.width+.5,TRAIL.lift-.015),lifted('#b59d70',-2));shoulder.receiveShadow=true;
 const tread=new THREE.Mesh(ribbon(woods.trails,TRAIL.width,TRAIL.lift),lifted('#d2b98b',-4));tread.receiveShadow=true;
 root.add(tagObject(shoulder,'woods:trail-north'),tagObject(tread,'woods:trail-north'));
 // Pond: sandy rim, then water (flat lowland, never on the ridge).
 const P=woods.pond,disc=(r,color,y,f)=>{const m=new THREE.Mesh(new THREE.CircleGeometry(1,40),lifted(color,f));m.rotation.x=-Math.PI/2;m.position.set(P.center[0],y,P.center[1]);m.scale.set(P.rx+r,P.rz+r,1);m.receiveShadow=true;return tagObject(m,'woods:pond');};
 root.add(disc(1.1,'#cdbd8e',GROUND_TOP+.012,-2),disc(.35,'#8fb5a4',GROUND_TOP+.02,-3),disc(0,'#74b3b8',GROUND_TOP+.03,-4));
 // Lookout: a timber deck on posts, rail on the view side. Primitives are
 // merged per colour so the whole structure is three draws.
 const parts=new Map(),boxAt=(color,x,y,z,w,h,d,yaw=0)=>{const g=new THREE.BoxGeometry(w,h,d);g.rotateY(yaw);g.translate(x,y,z);if(!parts.has(color))parts.set(color,[]);parts.get(color).push(g);};
 const L=woods.lookout,f=L.facing,s=Math.sin(f),c=Math.cos(f),ly=terrainY(...L.pos);
 const local=(a,b)=>[L.pos[0]+s*a+c*b,L.pos[1]+c*a-s*b];
 {const [x,z]=local(.6,0);boxAt('#a88a63',x,ly+.32,z,3.6,.16,2.6,f);}
 for(const a of [-.6,1.8])for(const b of [-1.6,1.6]){const [x,z]=local(a,b);boxAt('#7f6648',x,ly+.05,z,.2,.75,.2,f);}
 for(const b of [-1.6,-.8,0,.8,1.6]){const [x,z]=local(1.85,b);boxAt('#7f6648',x,ly+.75,z,.12,.85,.12,f);}
 {const [x,z]=local(1.85,0);boxAt('#c2a57a',x,ly+1.15,z,.12,.1,3.5,f);boxAt('#c2a57a',x,ly+.8,z,.08,.08,3.5,f);}
 // Cairn: a short stack of stones on the South Knob.
 const C=woods.cairn.pos,cy=terrainY(...C);
 [[.9,.38],[.7,.32],[.5,.27],[.32,.2]].reduce((y,[w,h],i)=>{boxAt('#9b978a',C[0]+(i%2?.05:-.04),y+h/2,C[1],w,h,w*.9,i*.7);return y+h*.92;},cy);
 // Trailhead posts and boards.
 const boards=[];
 for(const h of woods.trailheads){const [x,z]=h.sign,y=terrainY(x,z);for(const o of [-.8,.8])boxAt('#6d5137',x+o,y+.7,z,.14,1.6,.14);boards.push({h,x,y,z});}
 for(const [color,geos] of parts){const m=new THREE.Mesh(mergeGeometries(geos),toonMaterial(color));m.castShadow=true;m.receiveShadow=true;root.add(tagObject(m,'woods:lookout'));}
 const lengths=Object.fromEntries(woods.trails.map(t=>[t.id,t.length]));
 for(const {h,x,y,z} of boards){
  const toLookout=h.id==='north'?lengths.north+lengths.switchbacks:lengths.river+lengths['meadow-link']+lengths.switchbacks;
  const m=sign([h.id==='north'?'PINEWOOD TRAILS':'WILLOW RIVER TRAIL',`Lookout ${(toLookout/1000).toFixed(2)} km`,h.id==='north'?'Ridge loop · South Knob':'Pinewood Pond · Lookout'],1.9);
  m.position.set(x,y+1.25,z);m.rotation.y=h.id==='north'?0:Math.PI/2*.6;root.add(tagObject(m,'woods:trailhead-'+h.id));
 }
 // Hikers: one owned townsfolk rig per weekend slot; weekday rosters use
 // the first slots. Hidden whenever they are off the trails.
 const rigs=[],looks=new Map();
 for(let w=0;w<7;w++)for(const h of hikerRoster(woods,w))if(!looks.has(h.n)||w===5)looks.set(h.n,h.look);
 await Promise.all(Array.from({length:HIKERS_WEEKEND},async(_,n)=>{const o=await place('townsfolk-'+(looks.get(n)||'farmhand'),{x:0,z:0,scale:1});o.visible=false;root.add(tagObject(o,'woods:hikers'));rigs[n]=o;}));
 let roster=null,rosterDay=-1,last=[],forced=null;
 // forceWeekday: capture tools pin a weekday (0 = Monday) for repeatable stills.
 return {root,forceWeekday(w){forced=Number.isInteger(w)?w:null;},update(t,hour,weekday=4){
  if(forced!==null)weekday=forced;
  if(weekday!==rosterDay){roster=hikerRoster(woods,weekday);rosterDay=weekday;}
  last=[];
  rigs.forEach((o,n)=>{const h=roster[n],p=h?hikerPose(h,woods,hour,t):null;o.visible=!!p;if(!p)return;o.position.set(p.x,p.y,p.z);o.rotation.y=p.heading;last.push({id:h.id,position:[p.x,p.y,p.z],walking:p.walking,activity:p.activity});});
 },audit:()=>({hikers:last,counts:woods.counts,trails:woods.trails.map(t=>({id:t.id,length:t.length}))})};
}
