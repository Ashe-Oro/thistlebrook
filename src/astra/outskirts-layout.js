// Southern expansion. Pure layout data; the original compiler stays untouched.
import {distanceToSegment, pointInTown, checkAstra} from '../compiler/astra.js';
import {makeRng} from '../compiler/rng.js';
import {inRiver} from '../compiler/water.js';
export const OUTSKIRTS_VIEWS={outskirts:{x:-8,z:72,zoom:1.65},lake:{x:-15,z:72,zoom:2.7},campground:{x:-12,z:101,zoom:4},farmland:{x:43,z:60,zoom:2.7},woods:{x:-56,z:72,zoom:3}};
export const LAKE={x:-10,z:73,rx:24,rz:20};
export function inLake([x,z],margin=0){return ((x-LAKE.x)/(LAKE.rx+margin))**2+((z-LAKE.z)/(LAKE.rz+margin))**2<1;}
export function extendOutskirts(town,catalog){
 if(town.outskirts)return town.outskirts;
 const rng=makeRng(town.seed+918),random=()=>rng.float();
 const o={roads:[],destinations:[],trees:[],props:[],fields:[{x:45,z:44,w:21,d:15,crop:'wheat'},{x:48,z:69,w:22,d:18,crop:'vegetables'},{x:13,z:114,w:20,d:11,crop:'orchard'}],clearings:[],lake:LAKE};
 // Preserve the northern silhouette, replace only the southern boundary.
 const south=town.bounds.maxZ,index=town.outline.findIndex(p=>p[0]===town.bounds.maxX&&p[1]===south);
 if(index<0)throw Error('Outskirts needs the original southeast outline corner');
 town.outline.splice(index+1,1,[65,69],[58,92],[38,116],[12,126],[-23,125],[-56,115],[-77,96],[-80,south]);town.bounds.maxZ=126;
 town.districts.push({id:'outskirts',name:'Stillwater & the Hinterlands',type:'countryside',center:[-8,72]});
 const road=(a,b,width=1.5,kind='trail')=>{if(o.roads.some(r=>JSON.stringify([r.a,r.b])===JSON.stringify([a,b])||JSON.stringify([r.a,r.b])===JSON.stringify([b,a])))return;const r={a,b,width,kind,owner:'outskirts'};o.roads.push(r);town.roads.push(r);};
 const chain=(points,width=1.5,kind='trail')=>points.slice(1).forEach((p,i)=>road(points[i],p,width,kind));
 chain([[22,30],[22,40],[12,40],[-10,40],[-22,40]],2.3);
 chain([[-22,20.5],[-22,40]],1.7);
 chain([[-22,40],[-42,43],[-54,54],[-54,64],[-54,76],[-50,84],[-44,95],[-24,108],[-13,108],[-2,108],[0,108],[24,97],[33,78],[33,56],[26,49],[22,40]],1.65);
 chain([[-54,54],[-65,62],[-68,80],[-57,96],[-44,95]],1.1);
 chain([[-10,40],[-10,49],[-10,55]],1.5,'boardwalk');
 chain([[33,56],[43,56],[53,56]],2.3);
 chain([[33,78],[42,84]],2.2);
 chain([[43,56],[48,58]],1.2);
 const destination=(id,name,pos,approach,activity,description,height=2)=>{chain([approach,pos],1.2);const d={id:'outskirts-'+id,type:'countryside',district:'outskirts',name,pos,entry:pos,activity,description,height};o.destinations.push(d);return d;};
 destination('trailhead','Stillwater Trailhead',[-24,43],[-22,40],'Checking the trail map','The lane becomes a trail here. Follow the ochre markers around Stillwater, or take the narrow path through the birches.');
 destination('dock','Stillwater Landing',[-10,55],[-10,49],'Fishing at the landing','A quiet fishing jetty on Stillwater Lake. The walking loop stays on dry land; only the timber boards carry visitors over the water.');
 destination('cabin-1','Pinecone Cabin',[-43,64],[-54,64],'Resting on the cabin porch','A log cabin tucked between the pines and the lake, with firewood stacked beside the porch.',4);
 destination('cabin-2','Heron Cabin',[-43,82],[-50,84],'Taking a break at the cabin','A second cabin faces the sheltered cove. A short path joins the lakeside circuit.',4);
 for(const [i,x]of [-24,-13,-2].entries())destination('tent-'+i,['Birch Pitch','Foxglove Pitch','Heron Pitch'][i],[x,104],[x,108],'Unpacking at the campsite','A small tent pitch with a picnic table, a food locker, and a shared fire ring nearby.');
 chain([[-7.6,108],[-7.6,98]],1.2);
 destination('fire','The Campfire',[-12,97],[-7.6,98],'Warming up by the campfire','Campers gather here after their walk. The lanterns and fire glow after sunset, under a canopy of trees.');
 destination('lookout','Birch Hollow',[-65,79],[-68,80],'Watching for wildlife','A mossy log and a quiet clearing on the woodland detour. The paths wind between the trees.');
 destination('ranger','Stillwater Ranger Hut',[20,49],[26,49],'Checking supplies at the ranger hut','The ranger tends the trails and campground, stopping at the landing on the way around.',4);
 destination('farm','Hinterland Farm',[46.7,83],[42,84],'Stacking produce at the barn','Vegetables, grain, and apples from the edge of town. Farm workers move between the field, packing bench, and orchard.',5);
 destination('field','The Kitchen Fields',[48,63],[48,58],'Tending the vegetable rows','Rows of vegetables and wheat follow the farm lane. Fences stop at the gates so workers can reach every plot.');
 destination('orchard','South Orchard',[12,110],[24,97],'Gathering apples','The last apple rows give way to wildflowers and open country. Crates wait beside the path for the next trip to the barn.');
 o.clearings=[{x:-43,z:60,rx:5.5,rz:5.5},{x:-43,z:78,rx:5.5,rz:5.5},{x:20,z:45,rx:5,rz:5},{x:51,z:83,rx:7,rz:7},{x:-13,z:101,rx:20,rz:10},{x:-65,z:79,rx:4,rz:4}];
 // Connect every new trail intersection, then reuse existing graph nodes at
 // both town gateways. Existing node numbers remain stable for other districts.
 const node=p=>{let n=town.nodes.findIndex(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.015);if(n<0){n=town.nodes.length;town.nodes.push([...p]);town.edges.push([]);}return n;};
 for(const r of o.roads){const points=[r.a,r.b];for(const s of o.roads)for(const p of [s.a,s.b])if(distanceToSegment(p,r.a,r.b)<.01)points.push(p);points.sort((a,b)=>Math.hypot(a[0]-r.a[0],a[1]-r.a[1])-Math.hypot(b[0]-r.a[0],b[1]-r.a[1]));const ids=[...new Set(points.map(node))];for(let i=1;i<ids.length;i++){const a=ids[i-1],b=ids[i];if(!town.edges[a].includes(b))town.edges[a].push(b);if(!town.edges[b].includes(a))town.edges[b].push(a);}}
 o.destinations.forEach(d=>d.node=node(d.entry));
 // New gateways reserve the existing orchard's canopy clearance as well.
 const clearRoad=(p,radius)=>o.roads.every(r=>distanceToSegment(p,r.a,r.b)>r.width/2+radius);
 town.trees=town.trees.filter(t=>clearRoad(t.pos,2.5*t.scale));
 for(let i=0;i<2200&&o.trees.length<230;i++){
  const x=-76+random()*137,z=37+random()*84,scale=.65+random()*.55;
  // Increasingly open pasture east of the lake; continuous woods west/south.
  // The Willow River and Stillwater Outflow cross these woods: sample around them
  // (the extra 600 draws refill the woods to their pre-river density).
  if(x>22&&z<94||x>0&&z>105||z<47&&x>-34||inLake([x,z],3.3)||inRiver([x,z],3.6))continue;
  const id=x< -59&&z>60&&z<90&&random()<.3?'nat-birch':random()<.65?'cv-tree-pine':random()<.7?'cv-tree-oak':'cv-tree-fruit',e=catalog.get(id),radius=Math.max(e.bounds.max[0]-e.bounds.min[0],e.bounds.max[2]-e.bounds.min[2])*.5*scale;
  if(!clearRoad([x,z],radius+.4)||o.clearings.some(c=>((x-c.x)/(c.rx+radius))**2+((z-c.z)/(c.rz+radius))**2<1))continue;
  if(![[x-radius,z-radius],[x+radius,z-radius],[x+radius,z+radius],[x-radius,z+radius]].every(p=>pointInTown(p,town)))continue;
  if(o.trees.some(t=>Math.hypot(t.pos[0]-x,t.pos[1]-z)<t.radius+radius-.4))continue;
  o.trees.push({id,pos:[x,z],scale,rot:random()*Math.PI*2,radius});
 }
 // OPUS-NATURE: a stand of Nature pines west of Birch Hollow and the cabins
 // replaces kit pines in place (height matched, narrower crown, so every
 // clearance above still holds). Selection uses its own stream, never `rng`.
 {const near=o.trees.filter(t=>t.id==='cv-tree-pine'&&t.pos[0]< -50&&t.pos[1]>48&&t.pos[1]<100).sort((a,b)=>a.pos[1]-b.pos[1]||a.pos[0]-b.pos[0]);
  const pine=catalog.get('nat-pine'),r=Math.max(pine.bounds.max[0]-pine.bounds.min[0],pine.bounds.max[2]-pine.bounds.min[2])*.5;
  for(const t of near.filter((_,i)=>i%2===0).slice(0,8)){t.id='nat-pine';t.scale=+(t.scale*catalog.get('cv-tree-pine').bounds.max[1]/pine.bounds.max[1]).toFixed(4);t.radius=r*t.scale;}}
 o.gatewayNodes=[[22,30],[-22,20.5]].map(node);town.outskirts=o;
 town.report=checkAstra(town);if(!town.report.ok)throw Error(town.report.errors.join('; '));
 o.report={destinations:o.destinations.length,trees:o.trees.length,connectedNodes:town.nodes.length};
 return o;
}
