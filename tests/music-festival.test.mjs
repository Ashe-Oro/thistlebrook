import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileWorld} from '../src/compiler/world-plan.js';
import {fairSchedule} from '../src/compiler/astra-fair.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {createLife} from '../src/astra/life/runtime.js';
import {auditFestival, festivalAuditPlan} from '../src/astra/festival-audit.js';
import {FESTIVAL_ID, FESTIVAL_STALLS, LISTENER_YAW_TOLERANCE, facingStage, insideFestivalBox} from '../src/astra/festival-plan.js';
import {surfaceIndex, roadSurfaces} from '../src/roads/pedestrian.js';
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import {runAudit} from '../tools/audit-roads.mjs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const catalog = resolveAll(JSON.parse(source('src/catalog/bounds.json')));
const town = compileWorld(catalog, 831);
const plan = festivalAuditPlan(town, surfaceIndex(roadSurfaces(town)));

test('Merrymead keeps the weekday, weekend and park-closing boundaries', () => {
  for (const [day,start] of [[0,18],[1,18],[2,18],[3,18],[4,18],[5,16],[6,16]]) {
    for (const [hour,active] of [[15,false],[start-.001,false],[start,true],[19,true],[21.499,true],[21.5,false],[22,false]]) {
      assert.equal(fairSchedule(day,hour).concert, active, `day ${day}, hour ${hour}`);
    }
    assert.equal(fairSchedule(day,21.5).open,true);
    assert.equal(fairSchedule(day,22).open,false);
  }
});

test(`${TOWN_RULE.festival} seed 831 has distinct performers, ten guests and clear park approaches`, () => {
  const bandshell=town.registry.places.find(p=>p.id===FESTIVAL_ID);
  const band=plan.people.filter(p=>p.band);
  const audience=plan.people.filter(p=>p.watching);
  assert.deepEqual(new Set(band.map(p=>p.id)), new Set(['vocals','guitar','bass','drums','keys']));
  assert(audience.filter(s=>s.id.startsWith('guest-')).length>=8);
  assert(audience.every(p=>insideFestivalBox(p.position,town.venues.find(v=>v.id===FESTIVAL_ID).box)));
  assert(bandshell.interactionPoints.every(s=>Math.abs(s.facing-facingStage(s.position,plan.target))<1e-10));
  assert(FESTIVAL_STALLS.length>=2);
  for(const stall of FESTIVAL_STALLS)assert(town.modelPlacements.some(p=>p.asset==='fairground/'+stall.asset&&p.district==='fair'));
  assert.deepEqual(auditFestival(plan),[]);
});

const faults = [
  ['festival-stage', slot => {slot.position=[...plan.target];slot.yaw=0;}],
  ['festival-facing', slot => {slot.yaw+=Math.PI;}],
  ['festival-road', slot => {slot.position=[-217.5,-43];slot.yaw=facingStage(slot.position,plan.target);}],
];
test(`${TOWN_RULE.festival} board, facing and park-road faults each fail the rule and the road audit`, async () => {
  for (const [category, fault] of faults) {
    const slot={...plan.people.find(s=>s.watching)};
    fault(slot);
    assert.deepEqual(auditFestival({...plan,people:[slot]}).map(f=>f.category),[category]);
  }
  const result=await runAudit({mutateFestival({people}){
    const listeners=people.filter(p=>p.watching);
    faults.forEach(([,fault],i)=>fault(listeners[i]));
  }});
  const open=result.findings.filter(f=>f.status==='open');
  assert.deepEqual(new Set(open.map(f=>f.category)),new Set(faults.map(([category])=>category)));
  assert(open.every(f=>f.rule===TOWN_RULE.festival));
});

test('town residents exchange an evening outing, walk to their own lawn slots and leave after the set', () => {
  const life=createLife(town,{day:1,hour:16});
  const first=life.actors.find(a=>a.context.schedule.some(s=>s.target===FESTIVAL_ID));
  assert(first);
  const action={tool:'walkTo',args:{target:FESTIVAL_ID},reason:'Going to the concert'};
  life.setHour(15);
  assert.equal(life.execute(first,action).error,'The concert is off');
  for(let i=0;i<=270;i++)life.update(1,16+i/90);
  const listeners=life.actors.filter(a=>a.action?.tool==='visit'&&a.action.target===FESTIVAL_ID);
  assert(listeners.length>=2,'at least two residents took the scheduled outing by 19:00');
  for(const a of listeners){
    const {position,slot}=a.context.location;
    assert(slot.startsWith('resident-'));
    assert.equal(plan.roadDepth(position)>0,false);
    assert.equal(insideFestivalBox(position,plan.stage),false);
    assert(Math.abs(a.facing-facingStage(position,plan.target))<=LISTENER_YAW_TOLERANCE);
  }
  life.setHour(21.5);
  assert(!life.actors.some(a=>a.context.location.place===FESTIVAL_ID||a.action?.target===FESTIVAL_ID));
  assert(![...life.reservations.keys()].some(key=>key.startsWith(FESTIVAL_ID+'/')));
  for(let i=0;i<18;i++)life.update(1,21.5+i/90);
  const residentSlots=plan.people.filter(a=>a.id.startsWith('resident-'));
  for(const a of listeners)assert(!residentSlots.some(s=>Math.hypot(...s.position.map((v,i)=>v-a.context.location.position[i]))<.1));
});

test('concert dressing and animation add no HUD or audio paths', () => {
  for(const path of ['src/astra/festival-stage.js','src/astra/fair-life.js']){
    assert.doesNotMatch(source(path),/AudioContext|AudioListener|new Audio\b|<audio\b|\.(mp3|wav|ogg)\b/i);
    assert.doesNotMatch(source(path),/document\.(body|querySelector|append)|innerHTML|createElement\(['"](?!canvas)/);
  }
});
