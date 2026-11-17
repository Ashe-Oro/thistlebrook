import { shortestPath } from '../compiler/astra.js';
import { harborPeriod } from './harbor-layout.js';

export const HARBOR_ROSTER = [
  {name:'Maren',role:'Fisher',model:'farmhand',start:'fishingWest'},
  {name:'Ivo',role:'Fisher',model:'watch',start:'fishingEast'},
  {name:'Sora',role:'Fishmonger',model:'merchant',start:'market'},
  {name:'Nella',role:'Boatwright',model:'carpenter',start:'loft'},
  {name:'Orin',role:'Lighthouse keeper',model:'miller',start:'light'},
  {name:'Clara',role:'Boardwalk walker',model:'herbalist',start:'gateway'},
  {name:'Rafe',role:'Boardwalk walker',model:'shopkeeper',start:'promenade'},
  {name:'Lena',role:'Swimmer',start:'changing'},
  {name:'Tomas',role:'Swimmer',start:'beach'},
  {name:'Juno',role:'Swimmer',start:'changing'},
];

// The swimming loop joins the public graph only at the beach access. Ordinary
// residents never see its nodes, and swimmers must physically enter/leave there.
export function harborSwimGraph(town) {
  const graph={nodes:town.nodes.map(p=>[...p]),edges:town.edges.map(e=>[...e])};
  const heights=graph.nodes.map(()=>.18),water=[];
  let previous=town.harbor.nodes.beach;
  for(const [x,z,y] of [[35,59,-.05],[34,62,-.65],[31,65,-.73],[28,65,-.73],[29,62,-.65]]){
    const id=graph.nodes.length;graph.nodes.push([x,z]);graph.edges.push([previous]);graph.edges[previous].push(id);heights.push(y);water.push(id);previous=id;
  }
  graph.edges[previous].push(water[0]);graph.edges[water[0]].push(previous);
  return {graph,heights,water};
}

export function createHarborRoutines(town) {
  const swim=harborSwimGraph(town),nodes=town.harbor.nodes;
  const people=HARBOR_ROSTER.map((spec,i)=>({
    ...spec,index:i,node:nodes[spec.start],x:town.nodes[nodes[spec.start]][0],z:town.nodes[nodes[spec.start]][1],y:.18,
    route:[],wait:0,cycle:0,phase:'',activity:'Watching the harbor',destination:null,
    speed:spec.role==='Swimmer'?1.02+(i%3)*.12:1.15+i*.035,arrivals:[],distanceTravelled:0,heading:0,carrying:false,
  }));
  function plan(p,hour) {
    const period=harborPeriod(hour),n=nodes;
    if(p.role==='Fisher'){
      const fishing=p.index===0?n.fishingWest:n.fishingEast;
      if(period==='dawn')return {key:period,stops:[fishing],wait:18,action:'Fishing at dawn'};
      if(period==='landing')return {key:period,stops:[n.market,fishing],wait:6,action:'Unloading the morning catch'};
      if(period==='afternoon')return {key:period,stops:[n.landing,n.loft,n.market],wait:12,action:'Sorting tackle and mending nets'};
      return {key:period,stops:[n.loft],wait:30,action:'Resting at the net loft'};
    }
    if(p.role==='Swimmer')return hour>=10&&hour<18
      ? {key:'swimming',stops:[n.beach,...swim.water,n.beach,n.changing],wait:1.5+(p.index%3)*1.7,action:'Swimming in Shell Cove'}
      : {key:'off-duty',stops:[n.changing],wait:30,action:'Drying off by the beach huts'};
    if(p.role==='Fishmonger')return hour>=7&&hour<16
      ? {key:'market',stops:[n.market,n.market,n.landing],wait:16,action:'Arranging the day’s catch'}
      : {key:'closed',stops:[n.loft],wait:30,action:'Market closed for the day'};
    if(p.role==='Boatwright')return {key:period,stops:period==='night'?[n.loft]:[n.loft,n.landing,n.pier],wait:14,action:'Checking boats and mooring lines'};
    if(p.role==='Lighthouse keeper')return {key:period,stops:period==='night'?[n.light,n.gateway,n.light]:[n.light,n.market],wait:20,action:period==='night'?'Making the lighthouse rounds':'Tending Saltwind Light'};
    return {key:period,stops:period==='night'?[n.gateway,n.light]:[n.promenade,n.beach,n.market,n.light],wait:8,action:period==='night'?'Taking an evening walk':'Enjoying the sea air'};
  }
  function update(dt,hour) {
    if(dt<=0)return;
    for(const p of people){
      const task=plan(p,hour),graph=p.role==='Swimmer'?swim.graph:town;
      if(task.key!==p.phase){p.phase=task.key;p.cycle=0;p.wait=0;}
      if(p.wait>0){p.wait=Math.max(0,p.wait-dt);continue;}
      if(!p.route.length){
        const target=task.stops[p.cycle%task.stops.length];p.cycle++;
        p.destination={node:target,name:p.role==='Swimmer'&&target>=town.nodes.length?'Shell Cove swimming lane':town.venues.find(v=>v.node===target)?.name||'Saltwind boardwalk'};
        p.carrying=p.role==='Fisher'&&p.phase==='landing'&&target===nodes.market;
        p.route=shortestPath(graph,p.node,target).slice(1);
        if(!p.route.length){p.wait=task.wait;p.activity=task.action;continue;}
        p.activity=p.carrying?'Carrying the catch to the fish market':`Walking to ${p.destination.name}`;
      }
      let budget=dt*p.speed;
      while(budget>0&&p.route.length){
        const id=p.route[0],[x,z]=graph.nodes[id],dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),step=Math.min(d,budget);
        if(d>.0001){p.x+=dx/d*step;p.z+=dz/d*step;p.heading=Math.atan2(dx,dz);p.y+=( (p.role==='Swimmer'?swim.heights[id]:.18)-p.y)*step/d;}
        p.distanceTravelled+=step;budget-=step;
        if(d<=step+.0001){
          p.node=p.route.shift();
          if(!p.route.length){p.wait=task.wait;p.activity=task.action;p.arrivals.push(p.node);if(p.arrivals.length>40)p.arrivals.shift();}
        }else break;
      }
      if(p.role==='Swimmer'&&p.y<-.4)p.activity='Swimming in Shell Cove';
    }
  }
  return {people,update,swim};
}
