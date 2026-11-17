// Negative tests: break a passing town on purpose; each break must be caught.
// Run: npm run test:checks
import assert from 'node:assert/strict';
import { hillLayout, occupiedHillBounds, hillClearanceFailures } from '../src/compiler/hills.js';
import { readFileSync } from 'node:fs';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { compileTown } from '../src/compiler/compile.js';
import { validate } from '../src/compiler/checks.js';
import { applyDefaults } from '../src/compiler/spec.js';
import { strutEnds, segPointDistance } from '../src/compiler/geometry.js';
const cat = resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url))));
const spec = applyDefaults(JSON.parse(readFileSync(new URL('../specs/hamlet.json', import.meta.url))));
let bad = 0;
const expect = (label, t, name) => { const r = fail(t); const ok = r.includes(name); if (!ok) bad++; console.log((ok ? 'ok  ' : 'MISS') + ' ' + label + ' -> ' + r); };
const fail = (t) => validate(t, cat, spec).checks.filter(c => !c.ok).map(c => c.name + (c.warn ? '(w)' : '') + ':' + c.failures.length).join(' ') || 'PASS';
// Seed 1234 has buildings, dressing, fences and gates under the explicit
// symmetric-slot ordering. Seed 7 legitimately has no fences after parity fix.
const original = compileTown(spec, cat, { seed: 1234 });
if (!original.ok) throw new Error('negative tests require a passing baseline town');
const gateCount = original.instances.filter(i => i.kind === 'gate').length;
if (!gateCount) throw new Error('seed 1234 must contain gates for the gate negatives');
console.log(`seed 1234: ${gateCount} gates`);
const base = () => structuredClone(original);

let t = base(); const H = t.instances.filter(i => i.kind === 'house'); H[1].pos = [H[0].pos[0] + 1, H[0].pos[1]]; expect('house on house', t, 'footprint-overlap');
t = base(); const tr = t.instances.find(i => i.kind === 'tree'); const p = t.instances.find(i => i.kind === 'path'); tr.pos = [...p.pos]; expect('tree on path', t, 'trees-off-paths');
t = base(); t.instances = t.instances.filter((i, k) => !(i.kind === 'path' && k === t.instances.findIndex(j => j.kind === 'path'))); expect('drop a path', t, 'door-reachable');
t = base(); t.instances.find(i => i.kind === 'tree').pos = [60, 0]; expect('tree outside area', t, 'within-area');
t = base(); const tr2 = t.instances.find(i => i.kind === 'tree'); tr2.pos = [...t.instances.find(i => i.kind === 'house').pos]; expect('tree in lot', t, 'trees-outside-lots');

// --- v2 breaks -------------------------------------------------------------
// Path dead-ends off the ring: shove a path's plaza end well past the ring.
t = base(); const pd = t.instances.find(i => i.kind === 'path'); pd.pos = [pd.pos[0] * 1.8, pd.pos[1] * 1.8]; expect('path dead-ends off ring', t, 'door-reachable');
// Fence across a door path: drop a fence segment onto a path centre.
t = base(); const fseg = t.instances.find(i => i.kind === 'fence'); const pp = t.instances.find(i => i.kind === 'path'); fseg.pos = [...pp.pos]; fseg.rotY = pp.rotY + Math.PI / 2; expect('fence across a door path', t, 'fences-not-on-paths');
// Landmark overlapping a house: move the landmark onto a house.
t = base(); const lm = t.instances.find(i => i.kind === 'landmark'); const hh = t.instances.find(i => i.kind === 'house'); lm.pos = [...hh.pos]; expect('landmark on a house', t, 'footprint-overlap');

// --- v3 breaks -------------------------------------------------------------
t = base(); t.instances.splice(t.instances.findIndex(i => i.kind === 'gate'), 1); expect('delete a gate', t, 'gate-at-door');
t = base(); const shiftedGate = t.instances.find(i => i.kind === 'gate');
const gateHouse = t.instances.find(i => (i.kind === 'house' || i.kind === 'landmark') && i.lot === shiftedGate.lot);
shiftedGate.pos[0] += 1.2 * Math.cos(gateHouse.rotY); shiftedGate.pos[1] -= 1.2 * Math.sin(gateHouse.rotY);
expect('shift gate along fence', t, 'gate-at-door');
t = base(); t.instances.push({ ...structuredClone(t.instances.find(i => i.kind === 'gate')), lot: 'orphan', pos: [0, 0] }); expect('orphan gate', t, 'gate-at-door');
t = base(); t.instances.find(i => i.kind === 'house').rotY += Math.PI / 2; expect('house side-on', t, 'house-facing');
t = base(); t.instances.find(i => i.kind === 'house').rotY += Math.PI; expect('house back to plaza', t, 'house-facing');

const largeSpec = applyDefaults(JSON.parse(readFileSync(new URL('../specs/large.json', import.meta.url))));
const large = compileTown(largeSpec, cat, { seed: 1234 });
if (!large.ok) throw new Error('large negatives require a passing baseline');
const featureTrees = new Set(['nat-oak', 'nat-birch', 'nat-pine', 'nat-willow']);
if (large.instances.filter(i => featureTrees.has(i.id)).length > 8) throw new Error('heavy Nature feature trees must stay sparse');
const natureTris = large.instances.filter(i => i.id.startsWith('nat-')).reduce((n, i) => n + cat.get(i.id).tris, 0);
if (natureTris > 1000000) throw new Error('Nature geometry budget exceeded');
if (large.instances.filter(i => i.id === 'cv-market-stall').length < 4) throw new Error('large town needs a market cluster');
// New dressing must have a scoped placement rule; facade pieces carry their
// host lot and elevated catalog anchors rather than entering random scatter.
const attachments = new Set(['cv-window-box', 'cv-door-wreath', 'cv-shop-hanging-sign']);
for (const i of large.instances.filter(i => attachments.has(i.id))) {
  if (i.facadeLot == null || !(cat.get(i.id).yOffset > 0)) throw new Error('unanchored facade dressing');
}
if (large.instances.some(i => i.district === 'dressing')) throw new Error('unscoped scatter');
if (large.instances.filter(i => cat.get(i.id)?.tags.style.includes('smoke')).length > 2) throw new Error('too much smoke');
const streetFurniture = new Set(['cv-bench', 'nat-log-bench', 'cv-streetlamp', 'cv-notice-board', 'cv-directional-post', 'cv-village-entrance-sign']);
const streets = large.instances.filter(i => i.streetId);
for (const i of large.instances.filter(i => streetFurniture.has(i.id))) {
  if (!streets.some(p => segPointDistance(...strutEnds(p), i.pos) <= p.params.width / 2 + 4)) throw new Error(`${i.id} must stay beside a street`);
}
console.log('large dressing: facade anchors, scoped scatter, sparse smoke and Nature budget; furniture beside streets');
const largeExpect = (label, mutate, name) => {
  const t = structuredClone(large); mutate(t);
  const c = validate(t, cat, largeSpec).checks.find(c => c.name === name);
  const caught = c && !c.ok;
  if (!caught) bad++;
  console.log(`${caught ? 'ok  ' : 'MISS'} ${label} -> ${name}`);
};
largeExpect('prop blocks street', t => { t.instances.find(i => i.id === 'cv-bench').pos = [...t.instances.find(i => i.streetId === 'south-lane').pos]; }, 'props-off-paths');
largeExpect('livestock in plaza', t => { t.instances.find(i => i.id === 'farm-cow').pos = [0, 0]; }, 'animal-zones');
largeExpect('wildlife on farm', t => { t.instances.find(i => i.id === 'nat-deer').pos = [80, 0]; }, 'animal-zones');
largeExpect('detached wreath', t => { t.instances.find(i => i.id === 'cv-door-wreath').pos = [15, 15]; }, 'facade-placement');
largeExpect('street house faces away', t => { t.instances.find(i => i.kind === 'house' && i.street).rotY += Math.PI; }, 'street-facing');
largeExpect('street lot invents a street', t => { t.instances.find(i => i.street).street = 'missing'; }, 'street-facing');
largeExpect('sever farm track', t => { t.instances = t.instances.filter(i => i.streetId !== 'farm-track'); }, 'door-reachable');
largeExpect('remove market district street', t => { t.instances = t.instances.filter(i => i.streetId !== 'market-street'); }, 'district-streets');
largeExpect('move street through a lot', t => {
  const road = t.instances.find(i => i.streetId === 'upper-street');
  road.pos = [...t.instances.find(i => i.kind === 'house' && i.street === 'upper-street').pos];
}, 'paths-clear-lots');
largeExpect('drop civic building', t => { t.instances.splice(t.instances.findIndex(i => i.kind === 'landmark'), 1); }, 'landmark-count-in-range');
largeExpect('delete street lot gate', t => {
  const h = t.instances.find(i => i.street && t.instances.some(g => g.kind === 'gate' && g.lot === i.lot));
  t.instances = t.instances.filter(i => !(i.kind === 'gate' && i.lot === h.lot));
}, 'gate-at-door');
largeExpect('farm animal overlaps barn', t => {
  t.instances.find(i => i.id === 'farm-chicken').pos = [...t.instances.find(i => i.id === 'farm-big-red-barn').pos];
}, 'footprint-overlap');

// Edo is additive: original count bands still apply to the core village.
const edoSpec = { ...largeSpec, district: 'edo' };
const edo = compileTown(largeSpec, cat, { seed: 1234, district: 'edo' });
if (!edo.ok) throw new Error('Edo negatives require a passing baseline');
for (const kind of ['house', 'landmark']) {
  const core = edo.instances.filter(i => i.kind === kind && i.district !== 'edo').length;
  if (core !== large.instances.filter(i => i.kind === kind).length) throw new Error(`Edo changed core ${kind} count`);
}
const edoExpect = (label, mutate, name) => {
  const t = structuredClone(edo); mutate(t);
  const c = validate(t, cat, edoSpec).checks.find(c => c.name === name);
  const caught = c && !c.ok;
  if (!caught) bad++;
  console.log(`${caught ? 'ok  ' : 'MISS'} ${label} -> ${name}`);
};
edoExpect('drop one Edo villager', t => { t.instances.splice(t.instances.findIndex(i=>i.kind==='villager'),1); }, 'edo-villagers');
edoExpect('duplicate Edo identity', t => { const people=t.instances.filter(i=>i.kind==='villager'); people[0].id=people[1].id; }, 'edo-villagers');
edoExpect('villager claims wrong district', t => { t.instances.find(i=>i.kind==='villager').district='market'; }, 'edo-villagers');
edoExpect('villager inside building', t => { t.instances.find(i=>i.kind==='villager').pos=[...t.instances.find(i=>i.id==='edo-minka-farmhouse').pos]; }, 'edo-villagers');
largeExpect('villager without Edo', t => { t.instances.push(structuredClone(edo.instances.find(i=>i.kind==='villager'))); }, 'edo-villagers');

edoExpect('sever Edo connector', t => { t.instances = t.instances.filter(i => i.streetId !== 'edo-approach'); }, 'edo-connected-streets');
edoExpect('Edo doors disconnected from plaza', t => { t.instances = t.instances.filter(i => i.streetId !== 'edo-approach'); }, 'door-reachable');
edoExpect('remove shrine approach', t => { t.instances = t.instances.filter(i => i.streetId !== 'edo-shrine-approach'); }, 'edo-connected-streets');
edoExpect('remove shrine', t => { t.instances = t.instances.filter(i => i.id !== 'edo-shinto-shrine'); }, 'edo-required-features');
edoExpect('torii post obstructs walking', t => { t.instances.find(i => i.id === 'edo-great-torii').pos[0] += 1; }, 'props-off-paths');
edoExpect('torii misses approach', t => { t.instances.find(i => i.id === 'edo-great-torii').pos[0] += 8; }, 'edo-required-features');
edoExpect('tree blocks teahouse camera', t => { t.instances.find(i => i.id === 'edo-sakura-tree').pos = [-73, -80]; }, 'edo-camera-pocket');
edoExpect('Cozy lamp in Edo', t => { t.instances.find(i => i.id === 'cv-streetlamp').district = 'edo'; }, 'edo-required-features');
edoExpect('paving cannot replace road', t => { t.instances = t.instances.filter(i => i.streetId !== 'edo-lantern-lane'); }, 'edo-connected-streets');
edoExpect('paving must sit on road', t => { t.instances.find(i => i.kind === 'paving').pos = [-90, 20]; }, 'edo-street-paving');
edoExpect('extra Edo houses do not mask missing core', t => { t.instances.splice(t.instances.findIndex(i => i.kind === 'landmark' && i.district !== 'edo'), 1); }, 'landmark-count-in-range');



edoExpect('bridge sits on grass', t => { t.instances.find(i => i.id === 'edo-arched-bridge').pos = [-68.5,-89]; }, 'edo-bridge-over-water');
edoExpect('shop set back ten metres', t => { t.instances.find(i => i.id === 'edo-merchant-shop').pos[1] += 10; }, 'edo-shopfront-setback');

edoExpect('remove paved skin', t => { t.instances = t.instances.filter(i => i.kind !== 'paving'); }, 'edo-street-paving');
edoExpect('unsupported lantern orb', t => { t.instances.find(i => i.id === 'edo-andon-lantern-post' && i.pos[0] === 8.5).id = 'edo-paper-lantern'; }, 'edo-required-features');

edoExpect('bridge runs along water instead of spanning banks', t => { t.instances.find(i => i.id === 'edo-arched-bridge').rotY = 0; }, 'edo-bridge-over-water');
edoExpect('invalid bridge layering remains a solid collision', t => { t.instances.find(i => i.id === 'edo-arched-bridge').rotY = 0; }, 'footprint-overlap');

edoExpect('wide tea-court paving', t => { t.instances.find(i => i.street === 'edo-tea-court' && i.kind === 'paving').pavingWidth = 5; }, 'edo-street-paving');
edoExpect('four-way tile on straight run', t => { t.instances.find(i => i.id === 'edo-road-stone-straight').id = 'edo-road-stone-4way'; }, 'edo-street-paving');
edoExpect('noren on open lawn', t => { t.instances.find(i => i.id === 'edo-noren-curtain').pos = [-29,-75]; }, 'edo-noren-at-door');
edoExpect('noren claims wrong facade', t => { t.instances.find(i => i.id === 'edo-noren-curtain').facadeLot = -1; }, 'edo-noren-at-door');
const hillBounds = occupiedHillBounds(edo,cat), hillScale = (edo.area.radius+15)/70;
assert(hillClearanceFailures(hillLayout(hillScale),hillBounds).length > 0, 'negative: old hills must bury Edo footprints above y=0.05');
assert.equal(hillClearanceFailures(hillLayout(hillScale,hillBounds),hillBounds,10,0).length,0, 'relocated hills clear all footprints plus ten metres');
const emptyBounds = [{ c:[0,0],u:[1,0],v:[0,1],hu:1,hv:1 }];
assert.deepEqual(hillLayout(1,emptyBounds),hillLayout(1), 'nonintersecting hills keep original positions');
console.log('hills: old layout negative caught; new layout clears every occupied bound +10m; untouched hills stay identical');



edoExpect('hall leaves shrine axis', t => { t.instances.find(i => i.id === 'edo-worship-hall').pos[0] -= 10; }, 'edo-placement-pass2');
edoExpect('rope loses hall attachment', t => { t.instances.find(i => i.id === 'edo-shimenawa-rope').pos[1] += 2; }, 'edo-placement-pass2');
edoExpect('guardian pair sits on one side', t => { t.instances.find(i => i.id === 'edo-komainu-pair').pos[0] += 10; }, 'edo-placement-pass2');
edoExpect('duplicate authored dog pair', t => { t.instances.push({...t.instances.find(i => i.id === 'edo-komainu-pair'),pos:[22,-134.5]}); }, 'edo-placement-pass2');
edoExpect('south frontage removed', t => { t.instances = t.instances.filter(i => !(i.id === 'edo-nagaya-rowhouse' && i.pos[1] > -100)); }, 'edo-placement-pass2');

edoExpect('remove bridge loop crossing', t => { t.instances = t.instances.filter(i => i.streetId !== 'edo-bridge-loop'); }, 'edo-connected-streets');

// Life checks are scoped separately from the Edo identities.
const living = compileTown(largeSpec, cat, {seed:1234, life:true});
assert(living.ok, 'living town baseline must pass');
const lifeExpect=(label,mutate)=>{const t=structuredClone(living);mutate(t);const c=validate(t,cat,largeSpec).checks.find(c=>c.name==='life-townsfolk');assert(c&&!c.ok,label);console.log('ok   '+label+' -> life-townsfolk');};
lifeExpect('drop resident',t=>t.instances.splice(t.instances.findIndex(i=>i.id.startsWith('townsfolk-')),1));
lifeExpect('missing schedule',t=>delete t.instances.find(i=>i.id.startsWith('townsfolk-')).schedule);
lifeExpect('missing home',t=>delete t.instances.find(i=>i.id.startsWith('townsfolk-')).home);
lifeExpect('missing workplace',t=>delete t.instances.find(i=>i.id.startsWith('townsfolk-')).workplace);
lifeExpect('resident off graph',t=>t.instances.find(i=>i.id.startsWith('townsfolk-')).pos=[150,150]);
lifeExpect('resident inside wall',t=>t.instances.find(i=>i.id.startsWith('townsfolk-')).pos=[...t.instances.find(i=>i.kind==='house').pos]);
lifeExpect('unreachable workplace',t=>t.instances.find(i=>i.id.startsWith('townsfolk-')).workplace.node=-1);
lifeExpect('resident elevated onto roof',t=>t.instances.find(i=>i.id.startsWith('townsfolk-')).y=8);
lifeExpect('resident below ground',t=>t.instances.find(i=>i.id.startsWith('townsfolk-')).y=-2);
for(const kind of ['house','landmark'])lifeExpect(`connected workplace inside ${kind}`,t=>{
 const i=t.instances.find(i=>i.id.startsWith('townsfolk-')),n=i.workplace.node;
 t.life.graph.nodes[n].pos=[...t.instances.find(i=>i.kind===kind).pos];
});
lifeExpect('connected home inside footprint',t=>{const i=t.instances.find(i=>i.id.startsWith('townsfolk-'));t.life.graph.nodes[i.home.node].pos=[...t.instances.find(i=>i.id==='cv-windmill').pos];});
lifeExpect('connected idle inside footprint',t=>{const i=t.instances.find(i=>i.id.startsWith('townsfolk-'));t.life.graph.nodes[i.schedule[2].node].pos=[...t.instances.find(i=>i.kind==='house').pos];});
lifeExpect('townsfolk with life off',t=>delete t.life);
for(const type of ['greet','chat','shop','eat','play'])lifeExpect(`missing ${type} reservation`,t=>{t.life.reservations=t.life.reservations.filter(e=>e.type!==type);});
lifeExpect('missing play schedule slot',t=>{const p=t.instances.find(i=>i.id==='townsfolk-child');p.schedule=p.schedule.filter(s=>s.activity!=='play');});
lifeExpect('meal inside inn',t=>{const e=t.life.reservations.find(e=>e.type==='eat');t.life.graph.nodes[e.nodes[0]].pos=[...t.instances.find(i=>i.id==='cv-tavern').pos];});
lifeExpect('conflicting reservations',t=>{const a=t.life.reservations.find(e=>e.type==='chat'),b=t.life.reservations.find(e=>e.type==='eat');b.nodes[0]=a.nodes[0];});
lifeExpect('chat without a partner',t=>{t.life.reservations.find(e=>e.type==='chat').ids.pop();});
for(const seed of [1,7])assert(compileTown(largeSpec,cat,{seed,life:true}).ok,`M2 slots seed ${seed}`);
const joined=compileTown(largeSpec,cat,{seed:1234,life:true,district:'edo'});
assert(joined.ok,'combined life/Edo baseline');
assert.equal(joined.instances.filter(i=>i.id.startsWith('edo-villager-')).length,12);
assert.equal(joined.instances.filter(i=>i.id.startsWith('townsfolk-')).length,12);
assert.equal(validate(joined,cat,largeSpec).checks.find(c=>c.name==='life-townsfolk').ok,true);

if (bad) { console.error(bad + ' break(s) not caught'); process.exit(1); }
console.log('all breaks caught');

// life-interiors: runtime plans must preserve safe exterior door action points.
const lifeInteriors = await import('../src/life/doors.js');
const lifeInteriorsPlan = lifeInteriors.createInteriorPlan(living,cat);
assert.equal(lifeInteriorsPlan.length,4,'life-interiors: four enterable spaces');
assert(lifeInteriors.checkInteriorPlan(lifeInteriorsPlan,living,cat).ok,'life-interiors: safe triggers and fixtures');
assert(!lifeInteriors.checkInteriorPlan(lifeInteriorsPlan.filter(r=>r.id!=='bakery'),living,cat).ok,'life-interiors: missing bakery caught');
const lifeInteriorsWall = structuredClone(lifeInteriorsPlan);
lifeInteriorsWall[0].trigger=[...living.instances.find(i=>i.id==='cv-bakery').pos];
assert(!lifeInteriors.checkInteriorPlan(lifeInteriorsWall,living,cat).ok,'life-interiors: trigger inside wall caught');
assert.deepEqual(lifeInteriors.createInteriorPlan(large,cat),[],'life-interiors: life-off has no rooms');
for(const lifeInteriorsSeed of [1,7]){
 const town=compileTown(largeSpec,cat,{seed:lifeInteriorsSeed,life:true});
 assert(lifeInteriors.checkInteriorPlan(lifeInteriors.createInteriorPlan(town,cat),town,cat).ok,'life-interiors: safe triggers across seeds');
}
console.log('life-interiors: four rooms; missing bakery and wall trigger negatives caught; life-off untouched');
