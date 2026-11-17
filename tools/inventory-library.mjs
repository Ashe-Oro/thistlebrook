// Only metadata leaves the owned library. No geometry or textures are copied.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { relative, join, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { Matrix4, Vector3 } from 'three';
const root=process.env.ASTRA_ASSET_ROOT||'/workspace/threejs-assets';
const config=JSON.parse(readFileSync(new URL('../src/catalog/library/semantics.json',import.meta.url)));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]).sort();}
const outputURL=new URL('../src/catalog/library/assets.json',import.meta.url);
const previous=new Map((!process.argv.includes('--fresh')&&existsSync(outputURL)?JSON.parse(readFileSync(outputURL)).assets:[]).map(a=>[a.path,a]));
// Packs installed outside the shared library root (e.g. the Fairground pack in
// the project's private public/licensed mapping) keep a `<pack>/…` path.
const extraPacks=Object.fromEntries(Object.entries({fairground:process.env.ASTRA_FAIRGROUND_ROOT||new URL('../public/licensed/fairground',import.meta.url).pathname}).filter(([,dir])=>existsSync(dir)));
const relativePath=file=>{for(const [pack,dir]of Object.entries(extraPacks))if(file.startsWith(dir+'/'))return pack+'/'+relative(dir,file);return relative(root,file);};
const files=[...walk(root),...Object.values(extraPacks).flatMap(walk)],models=files.filter(f=>f.endsWith('.glb')),assets=[];
const round=n=>Math.round(n*100000)/100000;
function bounds(points){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}return {min:min.map(n=>Math.floor(n*1e5)/1e5),max:max.map(n=>Math.ceil(n*1e5)/1e5)};}
function hull(points){const p=[...new Map(points.map(v=>{const a=[round(v[0]),round(v[2])];return [a.join(','),a];})).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const half=arr=>{const h=[];for(const a of arr){while(h.length>=2&&cross(h.at(-2),h.at(-1),a)<=0)h.pop();h.push(a);}return h;};return [...half(p).slice(0,-1),...half([...p].reverse()).slice(0,-1)];}
for(const [index,file] of models.entries()){
 const path=relativePath(file),pack=path.split('/')[0],name=basename(file,'.glb'),key=`${pack}/${name.replace('.authoring','')}`;
 const kind=path.includes('/authoring/')?'authoring':path.includes('/prebuilds/')?'prebuilt':path.includes('/individual/')||path.includes('/models/')||pack==='free'||extraPacks[pack]?'individual':'pack-scene';
 const id=kind==='individual'?key:`${key}@${kind}`;
 const bytes=readFileSync(file),sha256=createHash('sha256').update(bytes).digest('hex'),cached=previous.get(path);
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
 const dependencies=[...(gltf.images||[]),...(gltf.buffers||[])].map(x=>x.uri).filter(uri=>uri&&!uri.startsWith('data:'));
 let source,ground,footprint,triangles,skinned,embedded;
 if(cached?.sha256===sha256){({bounds:source,ground,footprint,triangles}=cached.geometry);({skinned,embedded}=cached.animation);}
 else {
  const doc=await io.read(file),points=[];triangles=0;skinned=false;
  for(const node of doc.getRoot().listNodes()){
   const mesh=node.getMesh();if(!mesh)continue;skinned ||= !!node.getSkin();const matrix=new Matrix4().fromArray(node.getWorldMatrix());
   for(const prim of mesh.listPrimitives()){const pos=prim.getAttribute('POSITION');if(!pos)continue;triangles+=(prim.getIndices()?.getCount()??pos.getCount())/3;const v=[];for(let i=0;i<pos.getCount();i++){pos.getElement(i,v);points.push(new Vector3(...v).applyMatrix4(matrix).toArray());}}
  }
  if(!points.length)throw Error('No geometry: '+path);
  source=bounds(points);const height=source.max[1]-source.min[1];ground=bounds(points.filter(p=>p[1]<=source.min[1]+Math.max(.03,Math.min(.35,height*.12))));footprint=hull(points);embedded=doc.getRoot().listAnimations().map(a=>a.getName());
 }
 const height=source.max[1]-source.min[1];
 const rule=config.categories.find(r=>new RegExp(r.match).test(name)),override=config.overrides[key]||{};
 const category=override.category||rule.category,group=kind==='individual'?(override.group||rule.group):kind==='authoring'?'authoring-reference':'scene-reference';
 const scale=config.packScale[pack],origin=[(source.min[0]+source.max[0])/2,source.min[1],(source.min[2]+source.max[2])/2].map(round);
 const size=source.max.map((n,k)=>round((n-source.min[k])*scale));
 const activity=Object.hasOwn(override,'activity')?override.activity:rule.activity,interactions=[];
 const mount=['actor','animal'].includes(category)?'actor':['atmosphere'].includes(category)?'environment':['accessibility','costume-prop'].includes(category)?'actor-attachment':['water','bridge'].includes(category)?'shoreline':['terrain'].includes(category)?'tile':/wreath|window_box|hanging|noren|shimenawa|weathervane|windmill_fan|windmill_sail|bunting|garland|string_lights|birdhouse/.test(name)?'attachment':'ground';
 if(kind==='individual'&&activity&&!['actor','animal'].includes(category)){
  const seated=category==='seat',count=seated?(override.slots||(/bench|sofa/.test(name)?2:1)):1;
  for(let i=0;i<count;i++){
   const x=count===1?0:(i/(count-1)-.5)*Math.min(size[0]*.55,1.5),z=seated?(override.seatDepth||0)*scale:size[2]/2+(category==='fire'?1.5:.65);
   interactions.push({id:`${activity}-${i+1}`,activity,position:[round(x),seated?round((override.seatHeight??height*.48)*scale):0,round(z)],approach:[round(x),0,round(size[2]/2+(category==='fire'?1.5:1.05))],facing:seated?0:Math.PI,clearance:0.38,capacity:1,provenance:override.confidence||'bounds-inferred',enabled:!!override.confidence});
  }
 }
 assets.push({id,pack,name,path,kind,license:pack==='free'?'see-source-license':'owned-commercial',sha256,dependencies,category,groups:[group],tags:[pack,category,...name.replace(/_01$/,'').split(/[_-]/).filter(Boolean)],placement:{scale,origin,mount,units:'town-metres',surface:category==='interior'||category==='bed'||category==='kitchen'?'interior':['atmosphere'].includes(category)?'sky':'ground',clearance:config.clearance[category]??config.clearance.default,spawnable:kind==='individual'&&!['atmosphere','accessibility','costume-prop'].includes(category)},geometry:{method:'decoded-vertices-node-world-transform',pose:skinned?'bind-pose':'static',triangles:Math.round(triangles),bounds:source,ground,footprint,size},behavior:{dialogue:false,interactionMode:['actor','animal'].includes(category)?'prop-slots':'affordance'},animation:{embedded,skinned,procedural:activity?config.activityProfiles[activity].animation:null},interactions,...(kind==='authoring'?{canonical:key}:{})});
 if(index%40===0)console.log(`${index+1}/${models.length} ${id}`);
}
// OBJ/FBX versions are format aliases of the measured glTF exports, never extra spawn choices.
const aliases=files.filter(f=>['.obj','.fbx','.gltf'].includes(extname(f))).map(f=>{const path=relativePath(f),pack=path.split('/')[0],canonical=`${pack}/${basename(f,extname(f))}`;if(!assets.some(a=>a.id===canonical))throw Error('Unresolved format alias '+path);return {path,format:extname(f).slice(1),canonical,measurement:'canonical-glb-equivalent; alternate format not independently decoded'};});
const counts={glb:assets.length,alternateFormats:aliases.length,byPack:{},byKind:{},byGroup:{}};
for(const a of assets){counts.byPack[a.pack]=(counts.byPack[a.pack]||0)+1;counts.byKind[a.kind]=(counts.byKind[a.kind]||0)+1;for(const g of a.groups)counts.byGroup[g]=(counts.byGroup[g]||0)+1;}
const out={schemaVersion:1,measurement:{source:'owned library',axis:'Y-up',footprint:'convex XZ projection; full geometry including canopy',ground:'lowest 12% of height, clamped to 0.03–0.35 source units',normalization:'(source point - placement.origin) * placement.scale',precision:0.00001,interactionPolicy:'Inferred slots disabled until inspected. No dialogue. Exclusive prop activities.'},counts,assets,aliases};
writeFileSync(new URL('../src/catalog/library/assets.json',import.meta.url),JSON.stringify(out,null,1)+'\n');console.log(JSON.stringify(counts,null,2));
