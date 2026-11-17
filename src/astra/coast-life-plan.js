import {COAST_BLOCKS,COAST_REAR} from './coast-plan.js';
// A district-local 3D pedestrian network adds actual stairs to the shared town
// streets. All legs are explicit: diners cannot take a diagonal through a café.
export function createCoastRoutes(){
  const nodes=[],edges=[],destinations=[],lookup=new Map();
  const node=(x,y,z)=>{const key=[x,y,z].join(':');if(!lookup.has(key)){lookup.set(key,nodes.length);nodes.push([x,y,z]);edges.push([]);}return lookup.get(key);};
  const link=(a,b)=>{if(!edges[a].includes(b))edges[a].push(b);if(!edges[b].includes(a))edges[b].push(a);};
  const at=(x,z,y=.22)=>node(x,y,z);
  const cross=[-103,-87,-73,-59,-45,-31,-17,2];
  const stops=[...new Set([...cross,...COAST_BLOCKS.flatMap(b=>[b.z,b.z+5.9]),-82,-54,-12])].sort((a,b)=>a-b);
  for(const x of [80,101,110]){let previous;for(const z of stops){const id=at(x,z);if(previous!==undefined)link(previous,id);previous=id;}}
  for(const z of cross){link(at(80,z),at(101,z));link(at(101,z),at(110,z));}
  const destination=(id,kind,venue)=>destinations.push({node:id,kind,venue});
  for(const b of COAST_BLOCKS){
    const door=at(93,b.z);link(at(101,b.z),door);
    for(const side of [-1,1]){const patio=at(93,b.z+side*2.7);link(door,patio);destination(patio,'patio',b.id);}
    let prev=at(101,b.z+5.9);const base=at(98,b.z+5.9);link(prev,base);prev=base;
    for(let n=1;n<=24;n++){const stair=at(98-14*n/24,b.z+5.9,(.22+(b.height+.23)*n/24));link(prev,stair);prev=stair;}
    const landing=at(84,b.z+3.7,b.height+.45),roof=at(86,b.z+.8,b.height+.45);link(prev,landing);link(landing,roof);destination(roof,'roof',b.id);
  }
  for(const b of COAST_REAR){const door=at(78.3,b.z);link(at(80,b.z),door);destination(door,'bar',b.id);}
  for(const z of [-103,-73,-31,2]){
    const dune=at(126,z),water=at(132,z);link(at(110,z),dune);link(dune,water);destination(water,'beach','shore');
  }
  for(const z of [-82,-54,-12])destination(at(110,z),'watch','beach');
  const cache=new Map();
  function route(from,to){
    const key=from+':'+to;if(cache.has(key))return [...cache.get(key)];
    const dist=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),open=new Set(nodes.map((_,i)=>i));dist[from]=0;
    while(open.size){let a=-1;for(const i of open)if(a<0||dist[i]<dist[a])a=i;if(a===to||!Number.isFinite(dist[a]))break;open.delete(a);for(const b of edges[a]){const length=Math.hypot(...nodes[a].map((v,k)=>v-nodes[b][k]));if(dist[a]+length<dist[b]){dist[b]=dist[a]+length;previous[b]=a;}}}
    const path=[];for(let a=to;a!==-1;a=previous[a])path.unshift(a);if(path[0]!==from)throw Error('Disconnected coast destination');cache.set(key,path);return [...path];
  }
  return {nodes,edges,destinations,route};
}
export function createCoastWalkers(count=84){
  const graph=createCoastRoutes();
  const people=Array.from({length:count},(_,i)=>{const d=graph.destinations[(i*13)%graph.destinations.length];return {id:i,node:d.node,position:[...graph.nodes[d.node]],yaw:i,route:[],wait:(i%9)*.6,visits:0,arrivals:0,speed:.95+(i%7)*.07,kind:d.kind,venue:d.venue,walking:false,yielding:false};});
  function choose(p,hour){
    const evening=hour>=17||hour<6;
    const open=graph.destinations.filter(d=>evening?['roof','bar','patio'].includes(d.kind):d.kind!=='bar'||p.id%4===0);
    const next=open[(p.id*13+p.visits*17)%open.length];p.visits++;p.route=graph.route(p.node,next.node).slice(1);p.destination=next;
    if(!p.route.length)p.wait=3;
  }
  return {graph,people,update(dt,t,hour){
    for(const p of people){p.walking=false;p.yielding=false;if(p.wait>0){p.wait-=dt;continue;}if(!p.route.length){choose(p,hour);continue;}
      const target=graph.nodes[p.route[0]],delta=target.map((v,i)=>v-p.position[i]),length=Math.hypot(...delta);p.yaw=Math.atan2(delta[0],delta[2]);
      // Same-direction followers wait briefly; opposing traffic occupies the
      // other side of the walk through a small rendering-only lane offset.
      const blocked=people.some(q=>q.id!==p.id&&q.walking&&q.route[0]===p.route[0]&&Math.hypot(...q.position.map((v,k)=>v-p.position[k]))<.72&&Math.hypot(...q.position.map((v,k)=>v-target[k]))<length);
      if(blocked){p.yielding=true;continue;}
      const travel=Math.min(length,dt*p.speed);if(length>.0001){p.position=p.position.map((v,i)=>v+delta[i]/length*travel);p.walking=travel>0;}
      if(length<=travel+.001){p.node=p.route.shift();p.position=[...target];if(!p.route.length){p.kind=p.destination.kind;p.venue=p.destination.venue;p.wait=6+(p.id*3+p.visits)%17;p.arrivals++;}}
    }
  }};
}
