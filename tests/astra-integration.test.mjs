import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileAstra,checkAstra} from '../src/compiler/astra.js';
import {createLife} from '../src/astra/life/runtime.js';
import {SUNBEAM_RESIDENTS} from '../src/astra/sunbeam-layout.js';
import {WORK_ASSIGNMENTS} from '../src/compiler/astra-work.js';
import {motorRoads,createTrafficSimulation} from '../src/astra/traffic-simulation.js';
const catalog=resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json',import.meta.url))));
const town=compileAstra(catalog,831);
test('all nine districts have catalog slots in the one reservation registry',()=>{
 const life=createLife(town,{brain:()=>null,hour:10}),places=life.registry.places.filter(p=>p.id.startsWith('activity:'));
 assert.equal(life.actors.length,40);assert.equal(places.length,town.interactions.length);assert.equal(new Set(places.map(p=>p.district)).size,9);assert.deepEqual(life.registry.rejected,[]);
 for(const [i,p] of places.entries())assert(life.execute(life.actors[i],{tool:'walkTo',args:{target:p.id},reason:'Reach the real prop'}).ok);
 for(let i=0;i<1600;i++)life.update(.25,10);
 for(const [i,p] of places.entries()){
  const a=life.actors[i];assert.equal(a.context.location.place,p.id);assert.deepEqual(a.context.location.position,p.interaction.slots[0].position);
  assert(life.execute(a,{tool:'visit',args:{target:p.id},reason:'Use the reserved prop'}).ok);
  assert.equal(life.execute(life.actors[30],{tool:'walkTo',args:{target:p.id},reason:'Cannot double book'}).ok,false);
 }
 assert.equal(life.reservations.size,places.length);
});
test('terrace residents keep their homes; six workers have distinct assigned stations',()=>{
 const life=createLife(town,{hour:10});
 for(const p of SUNBEAM_RESIDENTS){const c=life.actors.find(a=>a.context.name===p.name).context;assert.equal(c.assets.home,`sunbeam-${p.home}`);}
 for(const [name,venue]of Object.entries(WORK_ASSIGNMENTS)){const c=life.actors.find(a=>a.context.name===name).context,spot=town.workstations.find(s=>s.name===name),place=life.registry.places.find(p=>p.id===c.job.workplace);assert.equal(spot.venue,venue);assert.equal(place.node,spot.node);assert.deepEqual(c.job.shift,[7,17]);}
});
test('catalog scene collisions fail checks; the terrace court remains pedestrian',()=>{
 const broken=structuredClone(town);broken.catalogScenes[0].box=structuredClone(town.buildings[0].box);assert(checkAstra(broken).errors.some(e=>e.includes('Catalog scene crosses parcel')));
 assert(!motorRoads(town).some(r=>r.a[1]===-52&&r.b[1]===-52&&Math.min(r.a[0],r.b[0])< -105));
 const traffic=createTrafficSimulation(town);assert.equal(traffic.vehicles.filter(v=>v.kind==='bus').length,2);assert.equal(traffic.stops.length,9);
});

test('both buses serve all stops while forty residents follow real routines',()=>{
 const life=createLife(town,{hour:10.4}),traffic=createTrafficSimulation(town);
 for(let n=0;n<9000;n++){
  const hour=n<2500?10.4:n<4500?16:n<5400?17.4:21;life.update(.1,hour);
  const pedestrians=life.actors.map(a=>{const [x,z]=a.context.location.position,target=a.route[0]?.pos,d=target?Math.hypot(target[0]-x,target[1]-z):0,pace=a.context.personality.pace;return {x,z,vx:d?(target[0]-x)/d*pace:0,vz:d?(target[1]-z)/d*pace:0};});
  traffic.update(.1,pedestrians);
 }
 for(const stop of traffic.stops)assert(traffic.events.busArrivals.some(e=>e.stop===stop.id),stop.name+' must be served with residents present');
 assert(traffic.vehicles.filter(v=>v.kind==='bus').every(v=>v.visits>=5));
});
