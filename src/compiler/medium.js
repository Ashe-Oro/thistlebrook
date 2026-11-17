// Opt-in expansion. Never modifies a legacy spec, catalog, or placement pool.
import { compileTown } from './compile.js';
import { spawnTownsfolk, lifeFailures } from '../life/schedules.js';
import { attachWorldRegistry } from '../life/registry-runtime.js';
import { validate } from './checks.js';
import { applyDefaults } from './spec.js';
import { obbFromRect, rectXZ, obbOverlap, segPointDistance, strutEnds } from './geometry.js';

export function compileMedium(rawSpec, catalog, options) {
  const spec = applyDefaults({ ...rawSpec, medium: false });
  const town = compileTown(spec, catalog, { ...options, life: false, registry: false });
  // A low stream skin along the sunny edge. Its stone bridge carries the
  // continuous footpath centerline; water never creates navigation edges.
  const strip = (a, b, streetId) => ({ id: spec.paths.id, kind: 'path',
    pos: [(a[0]+b[0])/2,(a[1]+b[1])/2], rotY: Math.atan2(b[0]-a[0],b[1]-a[1]), scale: 1,
    district: 'riverside', streetId, params: { length: Math.hypot(b[0]-a[0],b[1]-a[1]), width: 2.3 } });
  const river = [];
  for (let x = -47.6; x <= 91.6; x += 4.8) river.push({ id: 'cv-water-stream', kind: 'paving',
    pos: [+x.toFixed(4),48], rotY: Math.PI/2, scale: .75, district: 'riverside' });
  const bridge = { id: 'cv-road-stone-footbridge', kind: 'paving', pos: [58,48], rotY: Math.PI/2, scale: 1.4, district: 'riverside' };
  const paths = [strip([58,18],[58,65],'riverside-walk')];
  const reserved = [...river, bridge, ...paths].map(i => obbFromRect(i.kind === 'path'
    ? {min:[-i.params.width/2,-i.params.length/2],max:[i.params.width/2,i.params.length/2]}
    : rectXZ(catalog.get(i.id).bounds), {x:i.pos[0],z:i.pos[1],rotY:i.rotY},i.scale));
  // Reclaim only loose vegetation/dressing in the new river corridor.
  town.instances = town.instances.filter(i => !['tree','bush','prop'].includes(i.kind)
    || !reserved.some(r => obbOverlap(r,obbFromRect(rectXZ(catalog.get(i.id).bounds),{x:i.pos[0],z:i.pos[1],rotY:i.rotY},i.scale),['tree','bush'].includes(i.kind) ? 4 : .5)));
  town.instances.push(...river, bridge, ...paths);
  const facing = town.report.checks.find(c => c.name === 'facing-caps');
  town.report = validate(town,catalog,spec);
  if (facing) { town.report.checks.push(facing); town.report.ok &&= facing.ok; }
  const medium = mediumFailures(town,catalog);
  town.report.checks.push({name:'medium-features',ok:!medium.length,failures:medium,warn:false});
  town.report.ok &&= !medium.length;
  town.ok = town.report.ok;
  if (options.life) {
    spawnTownsfolk(town,catalog);
    const failures = lifeFailures(town,catalog);
    town.report.checks.push({name:'life-townsfolk',ok:!failures.length,failures,warn:false});
    town.ok = town.report.ok = town.ok && !failures.length;
  }
  if (options.life || options.registry) attachWorldRegistry(town,catalog);
  town.report.stats.instances = town.instances.length;
  return town;
}

// Water is a visual skin, so its intentional bridge layering is checked here
// on the medium path without relaxing the frozen solid-collision validator.
export function mediumFailures(town,catalog) {
  const failures = [];
  const river = town.instances.filter(i => i.id === 'cv-water-stream' && i.district === 'riverside');
  const bridge = town.instances.find(i => i.id === 'cv-road-stone-footbridge' && i.district === 'riverside');
  const walk = town.instances.find(i => i.streetId === 'riverside-walk');
  if (river.length < 20 || river.some((i,n) => Math.abs(i.rotY-Math.PI/2)>.01 || (n && Math.abs(i.pos[0]-river[n-1].pos[0]-4.8)>.001))) failures.push({msg:'Missing continuous riverside stream'});
  if (!bridge || !walk || Math.abs(bridge.pos[1]-48) > .1 || Math.abs(bridge.rotY-Math.PI/2) > .01
    || segPointDistance(...strutEnds(walk),bridge.pos) > .1
    || !river.some(i => Math.hypot(i.pos[0]-bridge.pos[0],i.pos[1]-bridge.pos[1]) < 2.5)) {
    failures.push({msg:'Bridge must span stream on the riverside walk'});
  }
  for (const water of river) {
    const box = obbFromRect(rectXZ(catalog.get(water.id).bounds),{x:water.pos[0],z:water.pos[1],rotY:water.rotY},water.scale);
    for (const building of town.instances.filter(i => ['house','landmark'].includes(i.kind))) {
      if (obbOverlap(box,obbFromRect(rectXZ(catalog.get(building.id).bounds),{x:building.pos[0],z:building.pos[1],rotY:building.rotY},building.scale))) failures.push({msg:'Stream intersects building',a:water.pos,b:building.pos});
    }
  }
  if (!town.instances.some(i => i.id === 'cv-chapel')) failures.push({msg:'Medium town requires chapel'});
  return failures;
}
