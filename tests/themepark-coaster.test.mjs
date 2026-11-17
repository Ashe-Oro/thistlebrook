// Copperhead geometry: pieces join end to end, supports stand under the rail,
// and mirrored kit pieces get their own (mirrored) ink hull.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COPPERHEAD} from '../src/astra/themepark-plan.js';
import {coasterSupports,KIT_SCALE,TILE} from '../src/astra/themepark-coaster.js';
import {mirrorGeometry,hullFor} from '../src/astra/themepark-assets.js';

const {centre,segments,pieces}=COPPERHEAD;
const dir=(a,b)=>{const d=[b.x-a.x,b.y-a.y,b.z-a.z],n=Math.hypot(...d);return d.map(v=>v/n);};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('Copperhead pieces line up end to end and close the loop',()=>{
 assert.equal(segments.length,30);
 for(let i=0;i<segments.length;i++){
  const s=segments[i],next=segments[(i+1)%segments.length];
  const end=centre[s.to],start=next.from===0&&i===segments.length-1?centre[0]:centre[next.from];
  assert(dist(end,start)<1e-6,`piece ${s.index} ${s.op} ends where ${next.index} ${next.op} starts (${dist(end,start).toFixed(3)} m)`);
  // Heading is continuous across every joint (no kinks or misrotated pieces).
  const out=dir(centre[s.to-1],centre[s.to]),inn=i===segments.length-1?dir(centre[0],centre[1]):dir(centre[next.from],centre[next.from+1]);
  const angle=Math.acos(Math.min(1,out[0]*inn[0]+out[1]*inn[1]+out[2]*inn[2]))*180/Math.PI;
  assert(angle<12,`joint ${s.op}->${next.op} at piece ${next.index} turns ${angle.toFixed(1)}°`);
 }
 // Joints sit on the 6 m kit grid edges and samples never jump.
 for(let i=1;i<centre.length;i++)assert(dist(centre[i-1],centre[i])<1.2,'sample gap at '+i);
 assert(dist(centre[0],centre.at(-1))<1e-6,'loop closes');
 for(const p of pieces)assert.equal(Math.abs(p.scale[1]),KIT_SCALE);
});

test('Every Copperhead support stands on the lawn directly under the rail',()=>{
 const supports=coasterSupports(pieces);
 const raised=pieces.filter(p=>p.base>.01);
 assert(raised.length>15);
 for(const p of raised)assert(supports.some(s=>s.piece===p.index),`raised piece ${p.index} ${p.op} has a support`);
 for(const s of supports){
  const piece=pieces.find(p=>p.index===s.piece),seg=segments.find(g=>g.index===s.piece);
  // Nearest rail-centre point of this piece, measured on the ground plane.
  let best=Infinity,rail=null;
  for(let i=seg.from;i<seg.to;i++){const a=centre[i],b=centre[i+1],dx=b.x-a.x,dz=b.z-a.z,u=Math.max(0,Math.min(1,((s.x-a.x)*dx+(s.z-a.z)*dz)/(dx*dx+dz*dz||1))),x=a.x+dx*u,z=a.z+dz*u,d=Math.hypot(s.x-x,s.z-z);if(d<best){best=d;rail={y:a.y+(b.y-a.y)*u};}}
  assert(best<.1,`support of piece ${piece.index} ${piece.op} is ${best.toFixed(2)} m off the rail`);
  // The tower reaches from y 0 to the piece base; the rail sits just above it.
  assert(Math.abs(s.height-piece.base)<1e-9);
  assert(rail.y>s.height&&rail.y-s.height<3.2*KIT_SCALE,`rail ${rail.y.toFixed(2)} over tower top ${s.height}`);
  // Supports stay inside the coaster's footprint on the kit grid.
  assert(Math.abs(s.x-piece.position[0])<=TILE&&Math.abs(s.z-piece.position[1])<=TILE);
 }
});

test('A mirrored kit piece gets its own mirrored ink hull',()=>{
 // A ramp that rises toward +z, like coaster_track_slope_start.
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([-.4,0,-2, .4,0,-2, .4,2,2, -.4,2,2],3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute(new Array(12).fill(0).map((_,i)=>i%3===1?1:0),3));
 g.setIndex([0,1,2,0,2,3]);
 const sourceHull=hullFor(g);
 const m=mirrorGeometry(g,'z'),mirroredHull=hullFor(m);
 assert.notEqual(mirroredHull,sourceHull,'mirror must not reuse the source hull');
 assert.notEqual(m.userData,g.userData,'mirror must not share userData');
 mirroredHull.computeBoundingBox();
 // The mirrored ramp rises toward -z, and so must its outline.
 const top=[...Array(mirroredHull.attributes.position.count).keys()].filter(i=>mirroredHull.attributes.position.getY(i)>1);
 assert(top.length&&top.every(i=>mirroredHull.attributes.position.getZ(i)<0));
 assert.equal(hullFor(g),sourceHull,'hulls are cached per geometry');
});
