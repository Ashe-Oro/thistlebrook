import * as THREE from 'three';
import { inventory,sceneData,groupAssets } from './index.js';
import { loadLibraryAsset } from './loader.js';
import './gallery.css';
const params=new URLSearchParams(location.search),group=params.get('group')||'harvest-market',page=Math.max(0,Number(params.get('page'))||0),query=params.get('q')||'';
const data=sceneData.groups.find(g=>g.id===group)||sceneData.groups[0],assets=groupAssets(data.id).filter(a=>(a.id+' '+a.tags.join(' ')).includes(query.toLowerCase())),size=24,visible=assets.slice(page*size,(page+1)*size);
document.body.innerHTML=`<header><a href="/">thistlebrook /</a><h1>Owned asset atlas</h1><p>${inventory.counts.glb} measured GLBs · ${inventory.counts.alternateFormats} format aliases · ${sceneData.groups.length} groups</p><a href="/?view=harvest">Visit the harvest stall ↗</a></header><nav><label>Town scene <select id="group">${sceneData.groups.map(g=>`<option value="${g.id}" ${g.id===data.id?'selected':''}>${g.name} (${groupAssets(g.id).length})</option>`).join('')}</select></label><form><input type="hidden" name="group" value="${data.id}"><label>Find an asset <input name="q" id="search" placeholder="Name or tag"></label><button>Search</button></form><a id="prev">← Previous</a><span>${page+1} / ${Math.max(1,Math.ceil(assets.length/size))}</span><a id="next">Next →</a></nav><section class="description"><h2>${data.name}</h2><p>${data.purpose}</p><small>Companions: ${data.companions.join(' · ')||'reference only'} · Suggested radius ${data.radius} m · Click an asset for its metadata</small></section><main></main><dialog><button id="close">Close ×</button><h2 id="detail-title"></h2><pre></pre></dialog><footer>Full geometry bounds · Y up · metres in town scale · Inferred interaction slots require inspection before activation</footer>`;
document.querySelector('#search').value=query;
const url=p=>`?group=${data.id}&page=${p}&q=${encodeURIComponent(query)}`;
for(const [id,p,enabled] of [['prev',page-1,page>0],['next',page+1,(page+1)*size<assets.length]]){const a=document.getElementById(id);if(enabled)a.href=url(p);else a.setAttribute('aria-disabled','true');}
document.querySelector('#group').onchange=e=>location.href=`?group=${e.target.value}`;
document.querySelector('#close').onclick=()=>document.querySelector('dialog').close();
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.setScissorTest(true);renderer.domElement.className='atlas-canvas';document.body.append(renderer.domElement);
const scenes=[];
async function start(){
 for(const asset of visible){
  const card=document.createElement('button');card.className='asset';const [w,h,d]=asset.geometry.size;
  card.innerHTML=`<div class="preview"></div><strong>${asset.name.replaceAll('_',' ')}</strong><span>${asset.pack} · ${asset.category}</span><small>${w.toFixed(2)} × ${d.toFixed(2)} m footprint · ${h.toFixed(2)} m tall</small><em>${asset.kind==='individual'&&asset.category!=='atmosphere'?asset.interactions.length?asset.interactions.map(s=>s.activity).filter((v,i,a)=>a.indexOf(v)===i).join(' · '):'Scenery':asset.kind+' · measured envelope'}</em>`;
  card.onclick=()=>{document.querySelector('#detail-title').textContent=asset.id;document.querySelector('dialog pre').textContent=JSON.stringify(asset,null,2);document.querySelector('dialog').showModal();};document.querySelector('main').append(card);
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff7df','#87998a',2));const sun=new THREE.DirectionalLight('#ffffff',2);sun.position.set(-4,8,6);scene.add(sun);
  const reference=asset.kind!=='individual'||asset.category==='atmosphere';
  const object=reference?new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshNormalMaterial({wireframe:true})):await loadLibraryAsset(asset.id);if(reference)object.position.y=h/2;scene.add(object);
  const camera=new THREE.PerspectiveCamera(35,1,.001,100000),radius=Math.max(w,h,d,.2);camera.position.set(radius*1.3,h*.5+radius*.8,radius*1.6);camera.lookAt(0,h*.45,0);camera.near=radius/1000;camera.far=radius*100;camera.updateProjectionMatrix();
  scenes.push({scene,camera,element:card.querySelector('.preview')});
 }
 render();window.__atlas={count:visible.length,ids:visible.map(a=>a.id),group:data.id,page,pages:Math.ceil(assets.length/size),render};window.__ready=true;
}
function render(){renderer.setSize(innerWidth,innerHeight);renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);for(const {scene,camera,element} of scenes){const r=element.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)continue;renderer.setViewport(r.left,innerHeight-r.bottom,r.width,r.height);renderer.setScissor(r.left,innerHeight-r.bottom,r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.render(scene,camera);}}
window.addEventListener('resize',render);window.addEventListener('scroll',render);start().catch(e=>{window.__atlasError=String(e);console.error(e);});
