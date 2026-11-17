import * as THREE from 'three';
import { instantiate } from '../catalog/loader.js';
import { VILLAGERS } from '../catalog/villagers.js';
import { toonMaterial } from '../toon.js';

export function createVillagerAnimator(scene) {
  const people=[];
  scene.traverse(o=>{if(o.userData.inst?.id.startsWith('edo-villager-'))people.push(o);});
  return seconds=>{
    for(const o of people) {
      const m=o.userData.inst.motion;
      // A grounded, subtle weight shift; position is the compiler's position.
      o.rotation.z=Math.sin(seconds*1.25+m.phase)*.012;
      o.rotation.y=o.userData.inst.rotY+Math.sin(seconds*.44+m.phase)*.035;
    }
  };
}

function label(text) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff6de';ctx.fillRect(0,0,512,96);
  ctx.fillStyle='#292b39';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));
  sprite.scale.set(2.25,.42,1);sprite.renderOrder=1000;return sprite;
}
export async function buildVillagerLineup(town,scene) {
  scene.background=new THREE.Color('#d8e5e7');
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(48,18),toonMaterial('#b6b59a'));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  return Promise.all(VILLAGERS.map(async(v,n)=>{
    const obj=await instantiate(v.id);
    const x=(n-5.5)*2.6;
    obj.position.set(x,0,0);
    const original=town.instances.find(i=>i.id===v.id);
    obj.userData.inst=original?{...original,pos:[x,0],rotY:0}:{id:v.id,kind:'villager',pos:[x,0],rotY:0,motion:{mode:'idle',street:'lineup',t0:0,speed:0,phase:n}};
    scene.add(obj);
    const title=label(v.name);title.position.set(x,2.35,0);scene.add(title);
    return obj;
  }));
}
