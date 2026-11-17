import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.location={search:''};
const {parseHash,serializeHash,clamp,ISO_ELEVATION}=await import('../src/life/iso-camera.js');
test('life-iso share state round trips with normalized headings',()=>{
 for(const heading of [-270,0,90,180,270,450]){
 const state={x:-12.25,z:31.5,zoom:2.75,heading};
 assert.deepEqual(parseHash(serializeHash(state)),{...state,heading:((heading%360)+360)%360});
 }
 for(const s of ['','#NaN,1,2,h0','#1,2,0,h0','#1,2,3,h45','#1,2,Infinity,h90','#1,2,3,h0,extra'])assert.equal(parseHash(s),null);
});
test('life-iso clamp and true isometric elevation',()=>{
 assert.equal(clamp(-100,-4,8),-4);assert.equal(clamp(100,-4,8),8);assert.equal(clamp(2,-4,8),2);
 assert(Math.abs(ISO_ELEVATION*180/Math.PI-35.264389682754654)<1e-12);
});

const THREE=await import('three');
const {updateIsoShadows}=await import('../src/life/iso-shadows.js');
const {updateLightingFog}=await import('../src/life/fog.js');
test('iso lighting rejects distance fog even when another system supplies it',()=>{
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#888888',1,2);
 const stage={mode:'iso',scene,renderer:{setClearColor(){}}};
 updateLightingFog(stage,new THREE.Color('#dddccc'),{daylight:1,twilight:0});
 assert.equal(scene.fog,null);
});
test('shadow frustum covers visible ground after pan, zoom and rotation',()=>{
 const camera=new THREE.OrthographicCamera(-80,80,45,-45,.1,1600),sun=new THREE.DirectionalLight();
 const stage={camera,sun,controls:{target:new THREE.Vector3()}};
 for(const zoom of [1,3,8])for(const heading of [0,Math.PI/2]){
  const target=stage.controls.target.set(20*zoom,0,-10*zoom);
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(heading+.785)*250,176,Math.cos(heading+.785)*250));camera.lookAt(target);camera.zoom=zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  sun.target.position.set(0,0,0);sun.position.set(55,75,30);updateIsoShadows(stage);
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  for(const x of [-1,1])for(const y of [-1,1]){ray.setFromCamera(new THREE.Vector2(x,y),camera);const p=ray.ray.intersectPlane(plane,new THREE.Vector3()).project(sun.shadow.camera);assert(Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&Math.abs(p.z)<=1,JSON.stringify({zoom,heading,p}));}
 }
});
