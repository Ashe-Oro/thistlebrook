import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { filterSocialText } from '../src/life/social-occlusion.js';

function fixture() {
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,100);
 camera.position.set(0,2,8);
 const wall=new THREE.Mesh(new THREE.BoxGeometry(4,4,.3),new THREE.MeshBasicMaterial());
 wall.position.set(0,2,4);scene.add(wall);
 const label=new THREE.Sprite();label.position.set(0,2.05,0);label.userData.kind='name';
 return {stage:{scene,camera},wall,label};
}
test('life-playtest: scenery blocks labels before they occupy overlap space',()=>{
 const {stage,wall,label}=fixture();
 filterSocialText(stage,[label]);assert.equal(label.visible,false);
 wall.visible=false;label.visible=true;filterSocialText(stage,[label]);assert.equal(label.visible,true);
 wall.visible=true;wall.parent.visible=false;filterSocialText(stage,[label]);assert.equal(label.visible,true);
});
test('life-playtest: head hidden by a low wall also hides floating text',()=>{
 const {stage,wall,label}=fixture();wall.scale.y=.45;wall.position.y=.9;
 label.position.y=2.85;label.userData.kind='bubble';
 filterSocialText(stage,[label]);assert.equal(label.visible,false);
});
test('life-playtest: residents do not occlude their own text; nearby names win overlap order',()=>{
 const {stage,wall,label}=fixture();wall.userData.inst={kind:'villager'};
 const far=label.clone();far.position.z=-2;far.userData.kind='name';
 const bubble=label.clone();bubble.position.z=1;bubble.userData.kind='bubble';
 const text=[bubble,far,label];filterSocialText(stage,text);
 assert(label.visible);assert.deepEqual(text,[label,far,bubble]);
 assert.deepEqual(label.position.toArray(),[0,2.05,0]);
});

test('life-playtest: isometric occlusion follows parallel view rays',()=>{
 const {stage,wall,label}=fixture();
 stage.camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,100);
 stage.camera.position.set(0,2,8);
 label.position.x=3;
 wall.position.x=1.5;
 wall.scale.x=.15;
 // A perspective ray would hit this wall; the parallel isometric ray misses.
 filterSocialText(stage,[label]);assert(label.visible);
 wall.position.x=3;filterSocialText(stage,[label]);assert.equal(label.visible,false);
});
