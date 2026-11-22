// OWNER: opus-nature lane (village/nature-outdoors). Spec: docs/specs/OPUS-NATURE.md,
// model review: docs/specs/NATURE-PACK-REVIEW.md, rule TOWN-30 in docs/TOWN-RULES.md.
// Natural edges dressed with the owned Nature pack: Pinewood's species stands,
// boulders, glades, wildlife and waymarks; Stillwater's lake shore; the Willow
// River and Stillwater Outflow banks; and a hedgerow on Merrymead Park's west
// edge. Pure plan: every placement is a town.landscape.models record, so the
// landscape renderer instances it by asset and registerLandscape gives it a
// registry record (water's-edge river dressing is listed in town.water.dressing,
// instanced by the same renderer and registered as part of the river). Each record carries `nature` (its zone) and the surface it
// stands on (`surface`: ground, ridge, bank, sand, water), so tests can check it.
import {makeRng} from './rng.js';
import {distanceToSegment,pointInTown} from './astra.js';
import {insideLandscape,MAINLAND} from './landscape.js';
import {waterClearance,groundAt} from './water.js';
import {terrainY,ridgeHeight,GROUND_TOP,POND,GLADES,LOOKOUT,TRAIL,distanceToPolyline} from './woods.js';
import {LAKE,inLake} from '../astra/outskirts-layout.js';
import {OUTSKIRTS_LOGS} from '../astra/registry/seed-models.js';
import BOUNDS from '../catalog/bounds.json' with {type:'json'};

// Plan-space footprint radius of an asset at scale 1 (furthest bound from the pivot).
export const footprintRadius=(asset,scale=1)=>{const b=BOUNDS[asset];if(!b)throw Error('nature-edges: no bounds for '+asset);return Math.max(...b.min.filter((_,k)=>k!==1).map(Math.abs),...b.max.filter((_,k)=>k!==1).map(Math.abs))*scale;};
// Stand-in sizes for the kit trees the woods are built from (crown radius).
const KIT_RADIUS={'cv-tree-pine':1.9,'cv-tree-oak':2.8,'cv-tree-fruit':1.9,'cv-bush-round':1.3,'cv-rock-boulder':1.45};
export const isTree=asset=>/^cv-tree-|^farm-apple-tree$|^nat-(pine|oak|birch|willow|silver-snag)$/.test(asset);
const otherRadius=m=>KIT_RADIUS[m.asset]!=null?KIT_RADIUS[m.asset]*(m.scale||1):BOUNDS[m.asset]?footprintRadius(m.asset,m.scale||1):1;

// Surfaces (world y). Lake rings follow outskirts.js lakeShape(); the pond
// discs follow woods.js; river banks follow water.js (sand skirt ribbon).
export const LAKE_SURFACE={water:.043,mud:.028,sand:.005,mudPad:.55,sandPad:2.1};
export const POND_WATER=GROUND_TOP+.03;
const lakePad=([x,z])=>{const a=Math.atan2((z-LAKE.z)/LAKE.rz,(x-LAKE.x)/LAKE.rx),k=1+.022*Math.sin(a*5)+.015*Math.cos(a*7);return (Math.hypot((x-LAKE.x)/LAKE.rx,(z-LAKE.z)/LAKE.rz)/k-1)*Math.hypot(LAKE.rx*Math.cos(a),LAKE.rz*Math.sin(a));};
// Top of the lake-shore rings at p (null outside the 2.1 m sand ring).
export function lakeShoreY(p){const d=lakePad(p);if(d<0)return LAKE_SURFACE.water;if(d<LAKE_SURFACE.mudPad)return LAKE_SURFACE.mud;if(d<LAKE_SURFACE.sandPad)return LAKE_SURFACE.sand;return null;}
// River frame at point i of a reach: unit tangent and left normal.
export function riverFrame(pts,i){const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return {tx:dx/l,tz:dz/l,nx:-dz/l,nz:dx/l};}
// Height of water.js's sand skirt at `o` metres from the centreline (signed).
export function riverBankY(town,pts,i,o){
 const p=pts[i],f=riverFrame(pts,i),half=p[3],bank=p[4],u=Math.abs(o),s=Math.sign(o)||1;
 const inner=p[2]-.02,outer=groundAt(town,[p[0]+f.nx*s*(half+bank),p[1]+f.nz*s*(half+bank)])+.006;
 if(u<=half-.2)return inner;if(u>=half+bank)return groundAt(town,[p[0]+f.nx*o,p[1]+f.nz*o]);
 return inner+(outer-inner)*(u-(half-.2))/(bank+.2);
}
// Ground under p for land props: the Pinewood ridge where it rises, else the slab.
const landY=(town,p)=>ridgeHeight(...p)>0?terrainY(...p):groundAt(town,p);

export function planNatureEdges(town){
 town.water.dressing=[];
 const models=town.landscape.models,woods=town.woods,added=[],rng=makeRng(town.seed+7301),random=()=>rng.float();
 // Everything the new dressing keeps clear of: carriageways and every path
 // (full width plus the prop's own footprint), woods trails, bridges, lots,
 // buildings, venues, district regions, outskirts clearings, fields and props.
 const segs=[];for(const r of town.roads){const line=r.centerline||[r.a,r.b],half=r.centerline?6:(r.width||2)/2;for(let i=1;i<line.length;i++)segs.push({a:line[i-1],b:line[i],half});}
 const trails=(woods?.trails||[]).map(t=>t.points);
 const boxes=[...town.buildings.map(b=>b.box),...town.venues.filter(v=>v.box).map(v=>v.box),...(town.catalogScenes||[]).map(s=>s.box)].filter(Boolean);
 if(town.sunbeamReservation)boxes.push(town.sunbeamReservation);
 const o=town.outskirts||{clearings:[],fields:[],trees:[]};
 const shore=[...MAINLAND,MAINLAND[0]],shoreDist=p=>Math.min(...shore.slice(1).map((b,i)=>distanceToSegment(p,shore[i],b)));
 const others=()=>[...models.map(m=>({pos:m.pos,r:otherRadius(m),tree:isTree(m.asset)})),...o.trees.map(t=>({pos:t.pos,r:t.radius,tree:true})),...OUTSKIRTS_LOGS.map(pos=>({pos,r:1.3})),
  ...[...town.props,...town.trees,...(town.supplemental||[])].filter(p=>p.pos).map(p=>({pos:p.pos,r:.8}))];
 let crowd=others();
 const clear=(p,r,{water=false,gap=.3,tree=false}={})=>{
  if(!insideLandscape(p)||shoreDist(p)<6+r)return false;
  if(segs.some(s=>distanceToSegment(p,s.a,s.b)<s.half+r+gap))return false;
  if(trails.some(t=>distanceToPolyline(p,t)<TRAIL.width/2+r+gap))return false;
  if(town.water.bridges.some(b=>Math.hypot(b.pos[0]-p[0],b.pos[1]-p[1])<b.length/2+r+2))return false;
  if(boxes.some(b=>p[0]>b.min[0]-r-1&&p[0]<b.max[0]+r+1&&p[1]>b.min[1]-r-1&&p[1]<b.max[1]+r+1))return false;
  if(town.regions.some(({bounds:b})=>p[0]>b.minX-r-2&&p[0]<b.maxX+r+2&&p[1]>b.minZ-r-2&&p[1]<b.maxZ+r+2))return false;
  if(o.clearings.some(c=>((p[0]-c.x)/(c.rx+r))**2+((p[1]-c.z)/(c.rz+r))**2<1))return false;
  if(o.fields.some(f=>Math.abs(p[0]-f.x)<f.w/2+r+2&&Math.abs(p[1]-f.z)<f.d/2+r+2))return false;
  if(town.landscape.hills.some(h=>Math.hypot(h.pos[0]-p[0],h.pos[1]-p[1])<h.radius+r))return false;
  if(!water&&(waterClearance(p)<r+.15||inLake(p,r+.2)||((p[0]-POND.center[0])/(POND.rx+1.1+r))**2+((p[1]-POND.center[1])/(POND.rz+1.1+r))**2<1))return false;
  // Understory may stand under a canopy, so it only clears trunks (0.8 m);
  // trees clear each other's crowns.
  return !crowd.some(q=>{const qr=q.tree&&!tree?.8:q.r;return Math.abs(q.pos[0]-p[0])<qr+r+.2&&Math.hypot(q.pos[0]-p[0],q.pos[1]-p[1])<qr*.75+r*.75+.2;});
 };
 const add=(asset,p,{scale=1,rot=random()*6.283,y,surface,zone,role,feature=false})=>{
  const m={asset,pos:[+p[0].toFixed(3),+p[1].toFixed(3)],scale:+scale.toFixed(3),rot:+rot.toFixed(3),y:+y.toFixed(3),nature:zone,surface,role};
  if(zone==='woods'){m.woods=role;if(feature)m.feature=true;}
  // Water's-edge river dressing belongs to the river plan (GROK-RIVER keeps
  // landscape models 1 m off the water): it registers as part of the river.
  if(zone==='river'&&(surface==='bank'||surface==='water')){m.registryId='built:river';town.water.dressing.push(m);added.push(m);crowd.push({pos:m.pos,r:footprintRadius(asset,m.scale),tree:false});return m;}
  models.push(m);added.push(m);crowd.push({pos:m.pos,r:footprintRadius(asset,m.scale),tree:isTree(asset)});return m;
 };
 const tryLand=(asset,p,opts={})=>{const r=footprintRadius(asset,opts.scale||1);if(opts.zone==='woods'&&pointInTown(p,town))return null; // Pinewood stays outside the town outline (GROK-WOODS)
 if(!clear(p,r,{...opts,tree:isTree(asset)}))return null;const g=landY(town,p),ridge=ridgeHeight(...p)>0;return add(asset,p,{...opts,y:g-(opts.sink??.02),surface:ridge?'ridge':'ground'});};
 const swapped=[];
 const swap=(m,asset,scale,zone,role)=>{swapped.push({from:m.asset,to:asset,pos:m.pos});m.asset=asset;m.scale=+scale.toFixed(3);m.nature=zone;const ridge=ridgeHeight(...m.pos)>0;m.surface=ridge?'ridge':'ground';if(role)m.natureRole=role;
  // Ridge trees keep the woods' seating; on open ground the old y=0 sat 9 cm
  // above the mainland, so swapped models are re-seated on the real ground.
  if(!ridge)m.y=+(groundAt(town,m.pos)-(isTree(asset)?.04:.02)).toFixed(3);};

 // 1) Pinewood. Species stands replace kit trees in place (same position,
 // height matched), so trail sight lines and clearances are unchanged.
 if(woods){
  const W=models.filter(m=>m.woods==='tree'),near=(c,r)=>m=>Math.hypot(m.pos[0]-c[0],m.pos[1]-c[1])<r;
  const glade=id=>GLADES.find(g=>g.id===id);
  const stand=(list,cap,asset,k,role)=>{list.sort((a,b)=>a.d-b.d).slice(0,cap).forEach(({m})=>swap(m,asset,Math.min(1.75,m.scale*k),'woods',role));};
  const withD=(pred,c)=>W.filter(m=>m.asset.startsWith('cv-')&&pred(m)).map(m=>({m,d:Math.hypot(m.pos[0]-c[0],m.pos[1]-c[1])}));
  // Old-growth pines ring the summit lookout (kit pine 6.97 m -> Nature 8.69 m).
  stand(withD(m=>m.asset==='cv-tree-pine'&&near(LOOKOUT.pos,24)(m),LOOKOUT.pos),8,'nat-pine',6.97/8.69,'lookout-pines');
  // A birch stand on the pond's sunny side; broadleaf oaks around the meadows.
  const pond=glade('pond');stand(withD(m=>m.asset==='cv-tree-oak'&&near(pond.center,pond.r+12)(m),pond.center),4,'nat-birch',6.96/5.2*.95,'pond-birches');
  for(const id of ['meadow-north','meadow-south','picnic']){const g=glade(id);stand(withD(m=>m.asset==='cv-tree-oak'&&near(g.center,g.r+9)(m),g.center),3,'nat-oak',6.96/5.38*.9,'meadow-oaks');}
  // Silver snags: weathered dead pines on the exposed upper ridge.
  const high=W.filter(m=>m.asset==='cv-tree-pine'&&ridgeHeight(...m.pos)>7.5).map(m=>({m,d:random()}));stand(high,14,'nat-silver-snag',1.25/.95,'ridge-snags');
  for(const s of swapped.filter(s=>s.to==='nat-silver-snag')){const m=models.find(q=>q.pos===s.pos);m.scale=+(1.05+random()*.35).toFixed(3);}
  // Boulders within sight of a trail or glade become Nature granite: lichen
  // on the heights, moss cushions in the damp lowland.
  const trailDist=p=>Math.min(...trails.map(t=>distanceToPolyline(p,t)));
  for(const m of models.filter(m=>m.woods==='understory'&&m.asset==='cv-rock-boulder')){
   const H=ridgeHeight(...m.pos);if(trailDist(m.pos)>12&&!GLADES.some(g=>Math.hypot(g.center[0]-m.pos[0],g.center[1]-m.pos[1])<g.r+6))continue;
   swap(m,H>3.5||waterClearance(m.pos)>12?'nat-lichen-granite-boulder':'nat-moss-cushion-rock',Math.min(1.8,m.scale*1.45),'woods','granite');
  }
  crowd=others();
  // Glade dressing: Fern Hollow's ferns, a chopping stump by the picnic
  // benches, toadstool logs and moss by the pond, saplings at clearing edges.
  const ring=(c,r0,r1,count,asset,scale,role,tries=80)=>{let n=0;for(let t=0;t<tries&&n<count;t++){const a=random()*6.283,d=r0+random()*(r1-r0),p=[c[0]+Math.cos(a)*d,c[1]+Math.sin(a)*d];if(tryLand(asset,p,{scale:scale(),zone:'woods',role,feature:true}))n++;}return n;};
  const picnic=glade('picnic');ring(picnic.center,picnic.r-1.2,picnic.r+2.5,6,'nat-fern',()=>2+random()*.5,'fern-hollow',200);
  ring(picnic.center,2,picnic.r-1.5,1,'nat-axe-chopping-stump',()=>1.3,'fern-hollow');
  ring(pond.center,pond.r-2,pond.r+3,3,'nat-mushroom-cluster',()=>1.2+random()*.3,'pond-floor');
  ring(pond.center,pond.r-2.5,pond.r+3,3,'nat-moss-cushion-rock',()=>.9+random()*.4,'pond-floor');
  for(const id of ['lookout','meadow-north','trailhead'])ring(glade(id).center,glade(id).r-.5,glade(id).r+2,2,'nat-pine-sapling-staked',()=>1.3+random()*.3,'saplings');
  // The pond itself: lily pads and mallards afloat, a heron in the shallows.
  const pondIn=(u)=>{for(let t=0;t<60;t++){const a=random()*6.283,k=u[0]+random()*(u[1]-u[0]),p=[POND.center[0]+Math.cos(a)*POND.rx*k,POND.center[1]+Math.sin(a)*POND.rz*k];if(trails.some(t=>distanceToPolyline(p,t)<TRAIL.width/2+1.2))continue;if(!crowd.some(q=>Math.hypot(q.pos[0]-p[0],q.pos[1]-p[1])<q.r+.9))return p;}return null;};
  for(let i=0;i<3;i++){const p=pondIn([.35,.7]);if(p)add('nat-lily-pad-patch',p,{scale:1.2,y:POND_WATER-.02,surface:'water',zone:'woods',role:'pond-water',feature:true});}
  for(let i=0;i<3;i++){const p=pondIn([.2,.6]);if(p)add('nat-mallard-duck',p,{scale:1.6,y:POND_WATER-.03,surface:'water',zone:'woods',role:'pond-water',feature:true});}
  {const p=pondIn([.8,.88]);if(p)add('nat-grey-heron',p,{scale:1.5,y:POND_WATER-.08,surface:'water',zone:'woods',role:'pond-water',feature:true});}
  // Wildlife at the meadow edges, facing into the open.
  const meadow=(id,asset,count,scale)=>{const g=glade(id);let n=0;for(let t=0;t<120&&n<count;t++){const a=random()*6.283,d=g.r-2.5+random()*2,p=[g.center[0]+Math.cos(a)*d,g.center[1]+Math.sin(a)*d];if(tryLand(asset,p,{scale,rot:Math.atan2(g.center[0]-p[0],g.center[1]-p[1])+(random()-.5),zone:'woods',role:'wildlife',feature:true}))n++;}};
  meadow('meadow-north','nat-deer',2,1.25);meadow('meadow-north','nat-fox',1,1.4);meadow('meadow-south','nat-rabbit',3,1.6);meadow('picnic','nat-rabbit',1,1.6);
  // Waymarks: a numbered post beside every trail junction and trail end, an
  // information board at the Pinewood Trailhead clearing.
  const ends=[];for(const t of woods.trails)for(const p of [t.points[0],t.points.at(-1)])if(!ends.some(q=>Math.hypot(q[0]-p[0],q[1]-p[2])<4))ends.push([p[0],p[2]]);
  for(const e of ends){let done=false;for(let t=0;t<40&&!done;t++){const a=t*2.4,d=TRAIL.width/2+.7+t*.04,p=[e[0]+Math.cos(a)*d,e[1]+Math.sin(a)*d];done=!!tryLand('nat-trail-marker-post',p,{scale:1.35,rot:Math.atan2(e[0]-p[0],e[1]-p[1]),zone:'woods',role:'waymark',feature:true});}}
  {const g=glade('trailhead');for(let t=0;t<80;t++){const a=random()*6.283,d=2+random()*(g.r-1),p=[g.center[0]+Math.cos(a)*d,g.center[1]+Math.sin(a)*d];if(tryLand('nat-park-info-board',p,{scale:1.25,rot:Math.atan2(g.center[0]-p[0],g.center[1]-p[1]),zone:'woods',role:'waymark',feature:true}))break;}}
 }

 // 2) Riverbanks: the Willow River's meadow reach, the upper river and the
 // Stillwater Outflow. Cattail clumps at the water's edge (they replace
 // water.js's box reeds), stone bars on inner bends, rock shelves on outer
 // bends, weeping willows set back from the bank, herons and mallards.
 const bridgeNear=(p,pad)=>town.water.bridges.some(b=>Math.hypot(b.pos[0]-p[0],b.pos[1]-p[1])<b.length/2+pad);
 for(const reach of town.water.reaches.filter(r=>['upper','west','outflow'].includes(r.id))){
  const pts=reach.points,rr=makeRng(town.seed+7310+reach.id.length),rnd=()=>rr.float();
  const bend=i=>{const a=riverFrame(pts,Math.max(0,i-4)),b=riverFrame(pts,Math.min(pts.length-1,i+4));return a.tx*b.tz-a.tz*b.tx;}; // >0 turns left
  let lastWillow=-99,lastStone=-99,lastShelf=-99,herons=0,ducks=0;
  for(let i=3;i<pts.length-3;i++){
   const p=pts[i],f=riverFrame(pts,i),half=p[3],bank=p[4];
   if(groundAt(town,p)<-.2||bank>1||bridgeNear(p,3))continue;
   const at=(o)=>[p[0]+f.nx*o,p[1]+f.nz*o],turn=bend(i),inner=turn>0?1:-1;
   // Cattails: every ~3 m on alternating banks, rooted in the wet sand.
   if(i%3===0&&rnd()<.62){const side=rnd()<.5?-1:1,o=side*(half+.2+rnd()*.3),q=at(o),r=footprintRadius('nat-cattails',1.25);
    if(clear(q,r,{water:true,gap:.4})&&waterClearance(q)>-.15)add('nat-cattails',q,{scale:1.15+rnd()*.3,y:riverBankY(town,pts,i,o)-.02,surface:'bank',zone:'river',role:'cattails'});}
   if(Math.abs(turn)>.12&&i-lastStone>14){const o=inner*(half-.15),q=at(o);if(clear(q,footprintRadius('nat-river-stones',1.3),{water:true})){add('nat-river-stones',q,{scale:1.3,y:riverBankY(town,pts,i,o)-.03,surface:'bank',zone:'river',role:'stone-bar'});lastStone=i;}}
   if(Math.abs(turn)>.1&&i-lastShelf>22){const o=-inner*(half+.45),q=at(o);if(clear(q,footprintRadius('nat-shore-rock-shelf',1.1),{water:true,gap:.5})&&waterClearance(q)>-.6){add('nat-shore-rock-shelf',q,{scale:1.1,rot:Math.atan2(inner*f.nx,inner*f.nz),y:riverBankY(town,pts,i,o)-.04,surface:'bank',zone:'river',role:'rock-shelf'});lastShelf=i;}}
   if(i-lastWillow>18&&rnd()<.5){const side=rnd()<.5?-1:1;for(const extra of [2.6,3.4,4.2]){const o=side*(half+bank+extra),q=at(o),s=.95+rnd()*.25;if(tryLand('nat-willow',q,{scale:s,zone:'river',role:'willow',sink:.04})){lastWillow=i;break;}}}
   if(!herons&&i>pts.length*.35&&Math.abs(turn)<.08&&rnd()<.25){const o=(rnd()<.5?-1:1)*(half-.5),q=at(o);if(clear(q,.5,{water:true})&&!bridgeNear(q,8)){add('nat-grey-heron',q,{scale:1.5,rot:Math.atan2(f.tx,f.tz),y:p[2]-.08,surface:'water',zone:'river',role:'wildlife'});herons++;}}
   if(ducks<3&&i%17===5&&half>2&&!bridgeNear(p,8)){const q=at((rnd()-.5)*half*.6);add('nat-mallard-duck',q,{scale:1.6,rot:Math.atan2(-f.tx,-f.tz)+(rnd()-.5),y:p[2]-.03,surface:'water',zone:'river',role:'wildlife'});ducks++;}
  }
 }

 // 3) Stillwater Lake shore (replaces outskirts.js's box reeds and blob
 // rocks): cattails in the mud ring, stones and rock shelves on the sand,
 // lily pads and mallards on the open water, a heron by the reeds.
 // The river's mouths stay open water (GROK-RIVER keeps landscape models 1 m off the river).
 {const lr=makeRng(town.seed+7320),rnd=()=>lr.float(),dock=p=>p[0]>-15&&p[0]<-3&&p[1]<64||waterClearance(p)<1.6;
  for(let i=0;i<48;i++){
   const a=i/48*Math.PI*2+rnd()*.05,k=1+.022*Math.sin(a*5)+.015*Math.cos(a*7);
   const ring=pad=>[LAKE.x+(LAKE.rx+pad)*Math.cos(a)*k,LAKE.z+(LAKE.rz+pad)*Math.sin(a)*k];
   if(dock(ring(0)))continue;
   if(i%4===1){const q=ring(.25),asset=i%8===1?'nat-shore-rock-shelf':'nat-river-stones',s=asset==='nat-river-stones'?1.25:1;
    if(clear(q,footprintRadius(asset,s),{water:true,gap:.4}))add(asset,q,{scale:s,rot:Math.atan2(LAKE.x-q[0],LAKE.z-q[1]),y:lakeShoreY(q)-.03,surface:'sand',zone:'lake',role:'shore-rocks'});continue;}
   if(rnd()<.25)continue;
   const q=ring(.15+rnd()*.3);if(clear(q,footprintRadius('nat-cattails',1.3),{water:true,gap:.4}))add('nat-cattails',q,{scale:1.1+rnd()*.35,y:lakeShoreY(q)-.02,surface:'sand',zone:'lake',role:'cattails'});
  }
  const water=(k0,k1,minGap)=>{for(let t=0;t<80;t++){const a=rnd()*6.283,k=k0+rnd()*(k1-k0),p=[LAKE.x+Math.cos(a)*LAKE.rx*k,LAKE.z+Math.sin(a)*LAKE.rz*k];if(dock(p)||Math.hypot(p[0]+7.3,p[1]-55.4)<6)continue;if(!crowd.some(q=>Math.hypot(q.pos[0]-p[0],q.pos[1]-p[1])<q.r+minGap))return p;}return null;};
  for(let i=0;i<6;i++){const p=water(.72,.9,1.2);if(p)add('nat-lily-pad-patch',p,{scale:1.4,y:LAKE_SURFACE.water-.02,surface:'water',zone:'lake',role:'lily-pads'});}
  for(let i=0;i<4;i++){const p=water(.3,.75,2);if(p)add('nat-mallard-duck',p,{scale:1.6,y:LAKE_SURFACE.water-.03,surface:'water',zone:'lake',role:'wildlife'});}
  {const p=water(.88,.93,1);if(p)add('nat-grey-heron',p,{scale:1.5,rot:Math.atan2(LAKE.x-p[0],LAKE.z-p[1]),y:LAKE_SURFACE.water-.08,surface:'water',zone:'lake',role:'wildlife'});}
  // Birch Hollow: a fox and rabbits in the woodland clearing, ferns under the birches.
  for(const [asset,count,scale] of [['nat-fox',1,1.4],['nat-rabbit',2,1.6],['nat-fern',3,2.1]]){let n=0;for(let t=0;t<120&&n<count;t++){const p=[-66+rnd()*12,64+rnd()*26];if(tryLand(asset,p,{scale,zone:'lake',role:asset==='nat-fern'?'understory':'wildlife'}))n++;}}
 }

 // 4) Merrymead Park's west edge: a hedgerow between the park road and the
 // coast, oak and birch clumps with granite and wildflowers at their feet.
 const fair=town.regions.find(r=>r.id==='fair');
 if(fair){const hr=makeRng(town.seed+7330),rnd=()=>hr.float(),b=fair.bounds;
  // The meadow's kit oaks along this edge become Nature oaks in place
  // (height matched); kit pines stay as the evergreen backbone.
  const strip=models.filter(m=>!m.nature&&!m.woods&&/^cv-tree-(oak|pine)$/.test(m.asset)&&m.pos[0]>b.minX-28&&m.pos[0]<b.minX-2&&m.pos[1]>b.minZ-6&&m.pos[1]<b.maxZ+6).sort((p,q)=>p.pos[1]-q.pos[1]);
  strip.forEach(m=>{if(m.asset==='cv-tree-oak')swap(m,'nat-oak',Math.min(1.75,m.scale*6.96/5.38*.9),'park','hedgerow');});
  crowd=others();
  for(const m of strip.filter(m=>m.nature)){const r=footprintRadius(m.asset,m.scale)*.6;
   if(rnd()<.5)tryLand(rnd()<.5?'nat-lichen-granite-boulder':'nat-moss-cushion-rock',[m.pos[0]-r-.5,m.pos[1]+(rnd()-.5)*2],{scale:.8+rnd()*.4,zone:'park',role:'hedgerow'});
   if(rnd()<.45)tryLand('nat-wildflower',[m.pos[0]+r+.6,m.pos[1]+(rnd()-.5)*2],{scale:1.5+rnd()*.4,zone:'park',role:'hedgerow'});}
  for(let z=b.minZ+3,i=0;z<b.maxZ-3;z+=6.5+rnd()*2.5,i++){
   // One or two trees per clump (oaks, every third clump a birch pair),
   // granite at their feet and wildflowers on the sunny side.
   const tree=i%3===2?'nat-birch':'nat-oak',x=b.minX-8-rnd()*6;
   for(const [dx,dz] of [[0,0],[-3.5-rnd()*2,(rnd()-.5)*3]].slice(0,rnd()<.55?2:1)){
    const s=tree==='nat-oak'?1.2+rnd()*.35:1.25+rnd()*.25,q=[x+dx,z+dz];
    if(!tryLand(tree,q,{scale:s,zone:'park',role:'hedgerow',sink:.04}))continue;
    const r=footprintRadius(tree,s);
    if(rnd()<.6)tryLand(rnd()<.5?'nat-lichen-granite-boulder':'nat-moss-cushion-rock',[q[0]-r*.7,q[1]+(rnd()-.5)*3],{scale:.8+rnd()*.4,zone:'park',role:'hedgerow'});
    tryLand('nat-wildflower',[q[0]+r*.7+rnd()*1.5,q[1]+(rnd()-.5)*4],{scale:1.5+rnd()*.4,zone:'park',role:'hedgerow'});
   }
  }
  for(let t=0,n=0;t<60&&n<2;t++)if(tryLand('nat-rabbit',[b.minX-6-rnd()*14,b.minZ+10+rnd()*(b.maxZ-b.minZ-20)],{scale:1.6,zone:'park',role:'wildlife'}))n++;
 }
 // 5) The open meadow's kit boulders (the chunkiest placeholder left in the
 // landscape) become weathered Nature granite, same spot, similar bulk.
 for(const m of models.filter(m=>!m.woods&&!m.nature&&m.asset==='cv-rock-boulder'))swap(m,'nat-lichen-granite-boulder',Math.min(1.8,m.scale*1.45),'meadow','granite');
 const count=z=>added.filter(m=>m.nature===z).length+swapped.filter(s=>models.find(m=>m.pos===s.pos)?.nature===z).length;
 town.natureEdges={added:added.length,replaced:swapped.length,zones:Object.fromEntries(['woods','river','lake','park','meadow'].map(z=>[z,count(z)])),
  assets:[...new Set([...models.filter(m=>m.nature),...town.water.dressing].map(m=>m.asset))].sort()};
 return town.natureEdges;
}

// TOWN-30: Nature dressing keeps paths clear and sits on its own surface.
// Every placement with a `nature` zone is checked: its whole footprint (crown
// for trees) clear of every road, path, trail tread and bridge; land props on
// the ground or ridge and out of the water; bank and shore props on the
// sand; waterfowl, herons and lily pads on open water. Returns findings
// {category, at, detail}; the road audit reports them under TOWN-30.
export function natureEdgeFindings(town){
 const out=[],add=(category,at,detail)=>out.push({category,at,detail});
 const segs=[];for(const r of town.roads){const line=r.centerline||[r.a,r.b],half=r.centerline?6:(r.width||2)/2;for(let i=1;i<line.length;i++)segs.push({a:line[i-1],b:line[i],half,kind:r.kind||'road'});}
 const trails=(town.woods?.trails||[]).map(t=>t.points);
 const inPond=(p,m=0)=>((p[0]-POND.center[0])/(POND.rx+m))**2+((p[1]-POND.center[1])/(POND.rz+m))**2<1;
 const reaches=town.water.reaches.filter(r=>r.kind==='river');
 const nearestReach=p=>{let best=null;for(const r of reaches)for(let i=0;i<r.points.length;i++){const q=r.points[i],d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(!best||d<best.d)best={r,i,d};}return best;};
 for(const m of [...town.landscape.models.filter(m=>m.nature),...(town.water.dressing||[])]){
  const p=m.pos,r=footprintRadius(m.asset,m.scale),tag=`${m.asset} (${m.nature}) at ${p.map(v=>v.toFixed(1))}`;
  const road=segs.find(s=>distanceToSegment(p,s.a,s.b)<s.half+r);if(road)add('nature-on-path',p,`${tag} reaches onto a ${road.kind}`);
  if(trails.some(t=>distanceToPolyline(p,t)<TRAIL.width/2+r))add('nature-on-path',p,`${tag} reaches onto a woods trail`);
  if(town.water.bridges.some(b=>Math.hypot(b.pos[0]-p[0],b.pos[1]-p[1])<b.length/2+r))add('nature-on-path',p,`${tag} crowds a bridge`);
  const y=m.y??0;
  if(m.surface==='water'){
   let level=null;
   if(inPond(p,-.3))level=POND_WATER;else if(inLake(p,-.4))level=LAKE_SURFACE.water;else if(waterClearance(p)<-.2){const n=nearestReach(p);level=n?n.r.points[n.i][2]:null;}
   if(level==null)add('nature-off-surface',p,`${tag} should float or wade but is not on open water`);
   else if(y>level+.005||y<level-.15)add('nature-off-surface',p,`${tag} y ${y} vs water ${level.toFixed(3)}`);
  }else if(m.surface==='bank'){
   const n=nearestReach(p);if(!n){add('nature-off-surface',p,`${tag} has no river bank`);continue;}
   const f=riverFrame(n.r.points,n.i),q=n.r.points[n.i],o=(p[0]-q[0])*f.nx+(p[1]-q[1])*f.nz,g=riverBankY(town,n.r.points,n.i,o);
   if(Math.abs(o)>q[3]+q[4]+.5)add('nature-off-surface',p,`${tag} is off the bank`);
   else if(y>g+.02||y<g-.15)add('nature-off-surface',p,`${tag} y ${y} vs bank ${g.toFixed(3)}`);
  }else if(m.surface==='sand'){
   const g=lakeShoreY(p);if(g==null||g===LAKE_SURFACE.water)add('nature-off-surface',p,`${tag} is off the lake shore`);
   else if(y>g+.02||y<g-.15)add('nature-off-surface',p,`${tag} y ${y} vs shore ${g}`);
  }else{
   const ridge=ridgeHeight(...p)>0,g=ridge?terrainY(...p):groundAt(town,p);
   // Swapped woods trees keep the woods' own seating (0.12 m below the ridge mesh top).
   if(y>g+.02&&!(m.woods&&y<=terrainY(...p)-GROUND_TOP+.01))add('nature-off-surface',p,`${tag} floats: y ${y} vs ground ${g.toFixed(3)}`);
   const ownSeat=m.woods&&y>=terrainY(...p)-GROUND_TOP-.2;
   if(y<g-.15&&!ownSeat)add('nature-off-surface',p,`${tag} is buried: y ${y} vs ground ${g.toFixed(3)}`);
   if(waterClearance(p)<.1||inLake(p,.2)||inPond(p,.3))add('nature-off-surface',p,`${tag} stands in the water`);
  }
 }
 return out;
}
