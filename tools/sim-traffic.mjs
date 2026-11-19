import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {footprint, footprintsOverlap} from '../src/roads/collisions.js';
import {simulateDay} from './sim-collisions.mjs';

const scheduled = new Set(['At depot','Parked at the depot','At stop','Unloading','Boarding at the stop','Dropping off','Assisting at fire scene']);
const label = v => ({id:v.id,kind:v.kind,status:v.status,position:v.position.map(x=>+x.toFixed(3))});

export function trafficMonitor() {
  const overlaps = new Map(), stalls = new Map(), states = new Map(), counts = {};
  let releases = 0, samples = 0, endTime=0;
  function sample({systems,t,hour,releases:events=[],closedGates=new Set()}) {
    endTime=t;
    samples++;
    releases = Math.max(releases,events.reduce((n,list)=>n+list.length,0));
    const list = Object.entries(systems).flatMap(([system,vehicles])=>{
      counts[system]=Math.max(counts[system]??0,vehicles.length);
      return vehicles.map(v=>{
        const f=footprint(v);
        const x=Math.abs(f.d[0])*f.hl+Math.abs(f.d[1])*f.hw;
        const z=Math.abs(f.d[1])*f.hl+Math.abs(f.d[0])*f.hw;
        return {v,f,system,key:system+'/'+v.id,minX:f.c[0]-x,maxX:f.c[0]+x,minZ:f.c[1]-z,maxZ:f.c[1]+z};
      });
    }).sort((a,b)=>a.minX-b.minX);
    for(const [i,a] of list.entries()){
      for(let j=i+1;j<list.length&&list[j].minX<=a.maxX;j++){
        const b=list[j];
        if(a.system==='trains'&&b.system==='trains')continue;
        if(a.minZ>b.maxZ||b.minZ>a.maxZ||!footprintsOverlap(a.f,b.f))continue;
        const key=[a.key,b.key].sort().join('|');
        if(!overlaps.has(key))overlaps.set(key,{a:label(a.v),b:label(b.v),hour:+hour.toFixed(3),time:+t.toFixed(2)});
      }
    }
    const present=new Set();
    for(const {v,key,system} of list){
      if(v.parked||system==='trains')continue;
      present.add(key);
      const old=states.get(key);
      if(!old||Math.hypot(v.position[0]-old.position[0],v.position[1]-old.position[1])>=.05){
        states.set(key,{position:[...v.position],since:t});
        continue;
      }
      const chain=[],seen=new Set();
      let cause=v;
      while(cause.blockedBy&&!seen.has(cause)){seen.add(cause);chain.push(label(cause));cause=cause.blockedBy;}
      chain.push(label(cause));
      const duration=t-old.since;
      if(cause.status==='Waiting at level crossing'&&closedGates.has(cause.waitingGate)){
        old.gated=true;
        old.gateWait={...label(v),hour:+hour.toFixed(3),time:+t.toFixed(2),duration:+duration.toFixed(2),chain};
        continue;
      }
      if(old.gated){old.gated=false;old.reopened=t;delete old.gateWait;}
      const allowed=scheduled.has(cause.status)||cause.status==='Red light'||cause.status==='Yielding to pedestrian'&&cause.crossingYield;
      if(allowed&&!old.reopened){old.since=t;continue;}
      if((old.reopened?t-old.reopened>15:duration>30)&&!stalls.has(key))
        stalls.set(key,{...label(v),hour:+hour.toFixed(3),time:+t.toFixed(2),duration:+duration.toFixed(2),chain});
    }
    for(const key of states.keys())if(!present.has(key))states.delete(key);
  }
  return {sample,result(){
    const unfinished=[...states].filter(([key,s])=>s.gated&&endTime-s.since>30&&!stalls.has(key)).map(([,s])=>s.gateWait);
    return {overlap:overlaps.size,stall:stalls.size+unfinished.length,deadlocksReleased:releases,samples,vehicles:counts,
      overlaps:[...overlaps.values()],stalls:[...stalls.values(),...unfinished]};
  }};
}

export async function runTraffic({root,seed=831,hours=24,...options}={}) {
  const monitor=trafficMonitor();
  await simulateDay({root,seed,hours,startHour:7,trafficOnly:true,trafficSample:monitor.sample,...options});
  return {seed,hours,...monitor.result()};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);
  const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
  const root=option('--root',null);
  const seeds=option('--seeds','831,42,99').split(',').map(Number);
  const results=[];
  for(const seed of seeds){
    const result=await runTraffic({root:root?resolve(root):undefined,seed,hours:+option('--hours',24)});
    results.push(result);
    console.error(`Seed ${seed}: ${result.overlap} overlaps, ${result.stall} stalls, ${result.deadlocksReleased} releases`);
  }
  console.log(JSON.stringify(results,null,2));
  if(results.some(r=>r.overlap||r.stall||r.deadlocksReleased))process.exitCode=1;
}
