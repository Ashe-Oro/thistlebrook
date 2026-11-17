// Pure navigation shared by compiler, validation and browser. Every edge comes
// from a paved strip or the plaza ring; intersections split both centerlines.
import { strutEnds, obbFromRect, obbPointDistance } from '../compiler/geometry.js';
import { math as Math } from '../compiler/math.js';
import { connectRegistryToGraph } from '../world/registry.js';
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function project(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return [a[0]+dx*t,a[1]+dz*t];}
export function blockers(town,catalog,{fences=true}={}){return town.instances.filter(i=>['house','landmark','well',...(fences?['fence']:[])].includes(i.kind)).map(i=>obbFromRect(catalog.get(i.id).footprint,{x:i.pos[0],z:i.pos[1],rotY:i.rotY},i.scale||1));}
export const blocked=(point,boxes,r=.30)=>boxes.some(b=>obbPointDistance(b,point)<r);
export function buildWalkGraph(town,catalog){
 const segments=town.instances.filter(i=>i.kind==='path').map(i=>({ends:strutEnds(i),street:i.streetId||`door-${i.lot}`}));
 const ring=town.instances.find(i=>i.kind==='ring');
 if(ring){const r=(ring.params.inner+ring.params.outer)/2;for(let n=0;n<64;n++){const pt=k=>[Math.sin(k*Math.PI/32)*r,Math.cos(k*Math.PI/32)*r];segments.push({ends:[pt(n),pt(n+1)],street:'plaza-ring'});}}
 for(const s of segments)s.cuts=[...s.ends];
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const s=segments[i],t=segments[j],[a,b]=s.ends,[c,d]=t.ends,u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]],w=[c[0]-a[0],c[1]-a[1]],den=cross(u,v);
  if(Math.abs(den)>1e-8){const x=cross(w,v)/den,y=cross(w,u)/den;if(x>=0&&x<=1&&y>=0&&y<=1){const p=[a[0]+x*u[0],a[1]+x*u[1]];s.cuts.push(p);t.cuts.push(p);}}
  for(const [one,two] of [[s,t],[t,s]])for(const p of one.ends){const q=project(p,...two.ends);if(distance(p,q)<.22){one.cuts.push(q);two.cuts.push(q);}}
 }
 const nodes=[],edges=[],lookup=new Map(),boxes=blockers(town,catalog);
 const node=(p,street)=>{if(blocked(p,boxes))return -1;const key=p.map(v=>Math.round(v*1000)).join(',');if(lookup.has(key))return lookup.get(key);const i=nodes.length;lookup.set(key,i);nodes.push({pos:p.map(v=>+v.toFixed(5)),street});edges.push([]);return i;};
 const link=(a,b)=>{if(a>=0&&b>=0&&a!==b&&!edges[a].includes(b)){edges[a].push(b);edges[b].push(a);}};
 for(const s of segments){s.cuts.sort((a,b)=>distance(a,s.ends[0])-distance(b,s.ends[0]));for(let k=1;k<s.cuts.length;k++){const a=s.cuts[k-1],b=s.cuts[k],len=distance(a,b),steps=Math.max(1,Math.ceil(len/.65));let last=node(a,s.street);for(let n=1;n<=steps;n++){const p=[a[0]+(b[0]-a[0])*n/steps,a[1]+(b[1]-a[1])*n/steps];const next=node(p,s.street);link(last,next);last=next;}}}
 // Merge roundoff at junctions and tiny ring/strip joins, never large shortcuts.
 for(let a=0;a<nodes.length;a++)for(let b=a+1;b<nodes.length;b++)if(distance(nodes[a].pos,nodes[b].pos)<.23)link(a,b);
 const graph={nodes,edges};
 // Only the largest connected component is navigable; a blocked doorstep is
 // explicitly snapped to this component, never linked across a building.
 const seen=new Set();let largest=[];for(let n=0;n<nodes.length;n++){if(seen.has(n))continue;const component=[n];seen.add(n);for(let k=0;k<component.length;k++)for(const b of edges[component[k]])if(!seen.has(b)){seen.add(b);component.push(b);}if(component.length>largest.length)largest=component;}
 graph.connected=largest;
 if(town.registry)connectRegistryToGraph(town.registry,graph,town,catalog); // WORKTREE-HOOK registry
 return graph;
}
export function nearestNode(graph,p){let best=-1,d=Infinity;for(const n of graph.connected){const v=distance(graph.nodes[n].pos,p);if(v<d){d=v;best=n;}}return best;}
export function route(graph,start,end){if(start===end)return [start];const queue=[start],prev=new Map([[start,-1]]);for(let k=0;k<queue.length;k++){const a=queue[k];for(const b of graph.edges[a])if(!prev.has(b)){prev.set(b,a);if(b===end){const result=[b];while(prev.get(result[0])!==-1)result.unshift(prev.get(result[0]));return result;}queue.push(b);}}return [start];}
