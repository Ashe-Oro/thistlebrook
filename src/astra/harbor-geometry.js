import {batchStaticLines,batchStaticMeshes} from './static-batches.js';
import * as THREE from 'three';
import { toonMaterial } from '../toon.js';

export function harborGeometry(root) {
  const cube = new THREE.BoxGeometry(1,1,1), ball = new THREE.IcosahedronGeometry(1,1);
  const mesh = (geo,color,x,y,z,parent=root) => {
    const m = new THREE.Mesh(geo,toonMaterial(color));m.position.set(x,y,z);
    m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  };
  const box = (x,y,z,w,h,d,c,parent) => { const m=mesh(cube,c,x,y,z,parent);m.scale.set(w,h,d);return m; };
  const orb = (x,y,z,r,c,parent) => { const m=mesh(ball,c,x,y,z,parent);m.scale.setScalar(r);return m; };
  const cylinder = (x,y,z,r,h,c,parent,top=r,sides=12) => mesh(new THREE.CylinderGeometry(top,r,h,sides),c,x,y,z,parent);
  const line = (points,color='#e8d7b3',parent=root) => {
    const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));parent.add(m);return m;
  };
  const polygon = (points,y,c,parent=root,depth=0) => {
    const shape = new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
    const geo = depth ? new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}) : new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI/2);
    const material=toonMaterial(c).clone();material.side=THREE.DoubleSide;
    const m=new THREE.Mesh(geo,material);m.position.y=y;m.receiveShadow=true;parent.add(m);return m;
  };
  const ring = (x,y,z,r,t,c,parent=root,vertical=false) => {
    const m=mesh(new THREE.TorusGeometry(r,t,7,24),c,x,y,z,parent);if(!vertical)m.rotation.x=-Math.PI/2;return m;
  };
  const label = (text,x,y,z,w,h=.7,color='#365f60',parent=root) => {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*h/w);
    const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fff1ce';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`600 ${canvas.height*.65}px Georgia`;
    ctx.fillText(text,512,canvas.height*.52,980);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));m.position.set(x,y,z);parent.add(m);return m;
  };
  return {mesh,box,orb,cylinder,line,polygon,ring,label};
}

export function batchHarbor(root,scene) {
  root.name='Harbor scenery';
  batchStaticMeshes(root,scene);
  batchStaticLines(root,scene);
}
