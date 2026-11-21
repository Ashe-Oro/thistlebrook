import * as THREE from 'three';
import {fairgroundModel} from './themepark-assets.js';
import {PARK_NODES,PARK_EDGES,PLAZAS,COURTS,RIDE_QUEUES,STALLS,PICNIC_TABLES,BENCHES,BIG_TOP,pathTiles,queueTileYaw,PATH_TILE} from './themepark-plan.js';

/**
 * Static dressing for Pinecrest: midway tiles, plazas, queue lanes, the
 * entrance, stalls and booths, festoon lighting and landscaping. Every model is
 * an individually registered pack placement; the district kit batches them.
 */
export async function buildMidway(kit,moving,{pine,detail}={}){
 const jobs=[],lamps=[],root=kit.root;
 const add=(asset,x,z,rot=0,scale=1,y=0,ordinal)=>{jobs.push(fairgroundModel(asset,{x,y,z,rot,scale,ordinal,detail}).then(o=>{root.add(o);return o;}));};
 // Lawn and darker ride pads under the paving.
 kit.box(0,.02,0,106,.1,108,'#9cbf6e');

 // ---- Paths: auto-tiled midway, plazas and queue lanes.
 for(const t of pathTiles())add(t.asset,t.x,t.z,t.rot);
 for(const p of PLAZAS)for(let x=p.from[0];x<=p.to[0];x+=PATH_TILE)for(let z=p.from[1];z<=p.to[1];z+=PATH_TILE)add(p.tile,x,z);
 for(const q of Object.values(RIDE_QUEUES))for(const [x,z]of q.tiles)add('road_queue_lane',x,z,queueTileYaw(q.dir));
 for(const c of COURTS)add('prebuilds/'+c.asset,c.x,c.z,c.rot);
 // Ride pads: packed dirt under the kiddie ride and around the tram stops.
 for(const [x,z]of [[-22,46],[-26,46],[-22,42]])add('packed_dirt_tile',x,z);
 // Meadow tiles: wildflower lawn in the quiet corners.
 for(const [x,z]of [[40,48],[44,48],[-44,24],[-44,28],[44,-4],[-44,-4]])add('fairground_grass_tile',x,z,0,1,-.12);

 // ---- Entrance: arch with turnstiles, ticket booths, queue lines and signs.
 add('entrance_arch',0,51,0,2);
 for(const side of [-1,1]){
  add('ticket_booth',side*9.5,51.2,0,1.15);
  for(let k=0;k<3;k++)add('queue_stanchion',side*9.5-.8+side*(k%2?0:.2),53.4+k*1.1,side>0?0:Math.PI,1.1,0,k);
  add('planter_urn',side*5.2,48.2,0,1.3);add('planter_urn',side*13.6,48.2,0,1.3);
  add('fountain_pool',side*8,47.4,0,.95);
  add('flower_planter_box',side*15.8,44,Math.PI/2,1.2);
 }
 add('park_map_board',-4.4,46.6,0,1.15);
 add('entrance_banner',0,38.2,0,1.5);
 add('neon_marquee_sign',6.8,29,-Math.PI/2,1.25);
 add('directional_signpost',-2.9,27.2,0,1.1);
 add('directional_signpost',2.9,47.6,Math.PI,1.1);
 add('ride_name_sign',-27.6,-2.6,0,1.3);
 add('ride_name_sign',39.6,21.6,0,1.15);
 add('ride_name_sign',-39.8,21.6,0,1.15);

 // ---- Fence: low pickets around the boundary, open at the entrance.
 const fenceStep=1.12*1.25;
 for(let x=-52;x<=52;x+=fenceStep){if(Math.abs(x)>13.2)add('low_picket_fence',x,52.6,0,1.25);add('low_picket_fence',x,-52.6,0,1.25);}
 for(let z=-52;z<=52;z+=fenceStep)for(const x of [-52.6,52.6])add('low_picket_fence',x,z,Math.PI/2,1.25);

 // ---- Midway stalls and game booths.
 for(const s of STALLS){add(s.asset,s.x,s.z,s.rot,1.15);}
 add('prize_shelf',-23.2,28,0,1.05,0,1);
 add(BIG_TOP.asset,BIG_TOP.x,BIG_TOP.z,BIG_TOP.rot,BIG_TOP.scale);

 // ---- Seating, bins and picnic tables.
 for(const [x,z]of PICNIC_TABLES)add('picnic_table',x,z,0,1.15);
 for(const [n,[x,z,rot]]of BENCHES.entries()){add('park_bench',x,z,rot,1.1);if(n%2===0)add('litter_bin',x+Math.cos(rot)*1.4,z-Math.sin(rot)*1.4,rot,1);}

 // ---- Lighting: globe lamps along every path, festoons over the streets.
 const lampAt=(x,z,rot=0)=>{add('globe_lamppost',x,z,rot,1.15);lamps.push([x,z]);};
 const lampSpots=new Set();
 for(const [a,b]of PARK_EDGES){
  const p=PARK_NODES[a],q=PARK_NODES[b],len=Math.hypot(q[0]-p[0],q[1]-p[1]);if(len<5)continue;
  const dir=[(q[0]-p[0])/len,(q[1]-p[1])/len],side=[-dir[1],dir[0]];
  for(let d=4,k=0;d<len-2;d+=8,k++){const s=k%2?1:-1,x=p[0]+dir[0]*d+side[0]*s*2.55,z=p[1]+dir[1]*d+side[1]*s*2.55,key=Math.round(x)+','+Math.round(z);if(lampSpots.has(key))continue;
   if(clash(x,z))continue;lampSpots.add(key);lampAt(x,z,Math.atan2(-side[0]*s,-side[1]*s));}
 }
 for(const [x,z]of [[-6,50.2],[6,50.2],[-14,50],[14,50]])lampAt(x,z);
 // Hanging baskets on the plaza lamps.
 for(const [k,[x,z]]of [[-6,50.2],[6,50.2]].entries())add('hanging_flower_basket',x,z,0,1.1,1.55,k);
 // Festoons: string lights across main street and the two midway streets.
 for(const z of [27.5,30.5,35,40.5])add('string_light_strand',0,z,0,1.42);
 for(const x of [-7.75,-12.25,-16.75,-21.2])add('string_light_strand',x,32,Math.PI/2,1.22);
 for(const x of [7.75,12.25,16.75,21.2])add('string_light_strand',x,32,Math.PI/2,1.22);
 for(const x of [-28,-14,14,28])add('bunting_strand',x,24,Math.PI/2,1.42);
 for(const x of [-16,16])add('bunting_strand',x,0,Math.PI/2,1.42);
 for(const x of [-6.5,0,6.5])add('string_light_strand',x,45.6,0,1.45);
 add('bunting_strand',0,49.4,0,1.6);

 // ---- Landscaping: flower beds, hedges, planters, topiary and rockeries.
 for(const z of [28,36,40])for(const side of [-1,1]){if(z===28&&side>0)continue;add('flower_bed_edge_tile',side*4,z,side>0?-Math.PI/2:Math.PI/2,1,-.05);}
 for(const [x,z]of [[-3.2,31],[3.2,31],[-3.2,25.4],[3.2,25.4],[-10.6,21.4],[10.6,21.4],[-26,21.4],[26,21.4]])add('topiary_tree_in_planter',x,z,0,1.2);
 for(const [x,z,r]of [[-2.6,36.4,Math.PI/2],[2.6,36.4,Math.PI/2],[-2.6,41,Math.PI/2],[2.6,41,Math.PI/2]])add('clipped_hedge',x,z,r,1.3);
 for(const [x,z]of [[-6,26.6],[6,26.6],[-30,26.6],[30,26.6],[-6,-2.6],[6,-2.6],[22,-2.6],[-34,-2.4]])add('potted_shrub',x,z,0,1.25);
 for(const [k,[x,z]]of [[-44,-6],[-10,-48],[30,-48],[44,-26],[-46,-30],[12,-34],[-20,-24],[38,-40]].entries())add(k%2?'landscaping_boulder':'rockery_cluster',x,z,k,1.6);
 add('reflecting_pool',28,8.8,0,1.4);
 for(const [x,z]of [[-44,46],[44,46],[-46,6],[46,24]])add('rockery_cluster',x,z,x,1.4);

 // Pines keep Pinecrest's forest character between the attractions.
 if(pine)for(const [x,z,s]of [[-47,18,.9],[-46,34,.85],[47,30,.9],[46,4,.8],[-47,-46,.95],[47,-48,.9],[0,-50,.85],[-18,-50,.8],[24,-50,.9],[-47,-14,.8],[-30,8,.75],[-8,8,.7],[8,8,.7],[30,4,.6],[26,48,.8],[-10,48.8,.6]]){const tree=pine.clone();tree.position.set(x,0,z);tree.scale.setScalar(s);root.add(tree);}

 // Clouds drift slowly over the park (atmosphere models, moving).
 const clouds=[];
 for(const [k,[x,y,z,s]]of [[-30,58,-92,5],[25,64,-100,6],[5,60,-84,5]].entries()){const c=await fairgroundModel('cumulus_cloud_set',{x,y,z,scale:s,rot:k*1.7,ordinal:k});moving.add(c);c.traverse(o=>{if(o.isMesh)o.castShadow=false;});clouds.push({c,x,z,k});}

 await Promise.all(jobs);
 // Night pools under every lamp and the brightest attractions.
 for(const [x,z]of lamps)kit.pool(x,z,6,'rgba(255,214,140,.95)',true);
 for(const [x,z,r]of [[0,51,9],[-36,12,13],[36,12,7],[20,12,8],[-36,40,8],[36,40,7],[-20,12,7],[0,12,8],[0,32,10],[-14,32,9],[14,32,9]])kit.pool(x,z,r,'rgba(255,190,130,.75)');
 return {lamps,update(t){for(const {c,x,z,k}of clouds){c.position.x=((x+t*.35+k*30+90)%180)-90;c.position.z=z+Math.sin(t*.01+k)*6;}}};
}

// Keep lamps off queue lanes, stalls, booths and plazas.
function clash(x,z){
 for(const q of Object.values(RIDE_QUEUES))for(const [tx,tz]of q.tiles)if(Math.abs(x-tx)<2.6&&Math.abs(z-tz)<2.6)return true;
 for(const s of STALLS)if(Math.abs(x-s.x)<2.2&&Math.abs(z-s.z)<1.9)return true;
 for(const c of COURTS)if(Math.abs(x-c.x)<6.4&&Math.abs(z-c.z)<6.4)return true;
 for(const [bx,bz]of BENCHES)if(Math.hypot(x-bx,z-bz)<1.6)return true;
 for(const [px,pz]of PICNIC_TABLES)if(Math.hypot(x-px,z-pz)<1.6)return true;
 if(Math.abs(x)<14&&z>41)return true;
 return false;
}
