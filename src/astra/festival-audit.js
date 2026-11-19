import { segDistance } from '../roads/pedestrian.js';
import { BAND, FESTIVAL_GATE, FESTIVAL_ID, FESTIVAL_STALLS, STAGE_BOX, STAGE_TARGET, festivalFindings, insideFestivalBox } from './festival-plan.js';

export function festivalAuditPlan(town, carriageways) {
  const venue = town.venues.find(v => v.id === FESTIVAL_ID);
  if (!venue) return null;
  const offset = town.regions.find(r => r.id === 'fair').offset;
  const move = point => point.map((v, i) => v + offset[i]);
  const moveBox = ({min, max}) => ({min: move(min), max: move(max)});
  const parkRoads = town.roads.filter(r => r.kind === 'park' && r.external === 'fair');
  const roadDepth = p => Math.max(carriageways.depth(p), ...parkRoads.map(r => r.width / 2 - segDistance(p, r.a, r.b)));
  const stage = moveBox(STAGE_BOX), target = move(STAGE_TARGET);
  const {interactionPoints} = town.registry.places.find(p => p.id === FESTIVAL_ID);
  const people = [
    ...BAND.map(p => ({id:p.id, position:move(p.position), band:true})),
    ...interactionPoints.map(s => ({id:s.id, position:[...s.position], yaw:s.facing, watching:true})),
  ];
  const fixtures = FESTIVAL_STALLS.map(s => ({id:s.label, box:moveBox(s.box)}));
  const {position:[x,z],width} = FESTIVAL_GATE;
  for (const dx of [-width / 2, width / 2]) fixtures.push({
    id:'festival gate post', box:moveBox({min:[x+dx-.14,z-.14],max:[x+dx+.14,z+.14]}),
  });
  return {people, stage, target, roadDepth, fixtures, approaches:interactionPoints.map(s=>[venue.entry,...s.approach,s.position])};
}

export function auditFestival(plan) {
  const {people, stage, target, roadDepth, fixtures, approaches} = plan;
  const findings = festivalFindings(people, {stage, target, onRoad: p => roadDepth(p) > .02});
  for (const {id, box} of fixtures) {
    const nx=Math.ceil((box.max[0]-box.min[0])/.2), nz=Math.ceil((box.max[1]-box.min[1])/.2);
    const samples=Array.from({length:(nx+1)*(nz+1)}, (_,i)=>[
      box.min[0]+(i%(nx+1))/nx*(box.max[0]-box.min[0]),
      box.min[1]+Math.floor(i/(nx+1))/nz*(box.max[1]-box.min[1]),
    ]);
    const overlap=samples.find(p=>roadDepth(p)>-.25||insideFestivalBox(p,stage));
    if(overlap)findings.push({category:'festival-clearance',at:overlap,detail:`${id} blocks the stage or a park path`});
  }
  for (const points of approaches) for (let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.2));
    for(let j=0;j<=n;j++){
      const p=a.map((v,k)=>v+(b[k]-v)*j/n);
      if(insideFestivalBox(p,stage)||roadDepth(p)>.02||fixtures.some(({box})=>insideFestivalBox(p,box))){
        findings.push({category:'festival-clearance',at:p,detail:'Audience approach meets a stage, fixture or road'});
        break;
      }
    }
  }
  return findings;
}
