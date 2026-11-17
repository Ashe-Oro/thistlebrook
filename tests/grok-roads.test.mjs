// OWNER: grok-roads lane. Road layout and walk-network checks for seed 831.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runAudit} from '../tools/audit-roads.mjs';

const open = (r, cats) => r.findings.filter((f) => f.status === 'open' && (!cats || cats.includes(f.category)));

test('seed 831 road audit is clean: no overlaps, duplicates, stubs or dead ends', async () => {
  const r = await runAudit();
  assert.deepEqual(open(r).map((f) => `${f.id} ${f.at} ${f.detail}`), []);
  assert(r.walkNodes > 1000 && r.crossings > 40, 'pedestrian network with crossings');
  for (const f of r.findings) assert(f.reason, `justified finding ${f.id} needs a reason`);
});

test('regional roads are one record per chain with one filleted centerline', async () => {
  const {town} = await runAudit();
  const links = town.roads.filter((x) => x.kind === 'world-link');
  assert(links.length >= 10);
  for (const l of links) {
    assert.equal(l.width, 5.6); assert(l.centerline.length >= 2);
    for (let i = 2; i < l.centerline.length; i++) { // no hairpins or reversals inside a chain
      const [a, b, c] = [l.centerline[i - 2], l.centerline[i - 1], l.centerline[i]];
      const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
      assert(u[0] * v[0] + u[1] * v[1] > 0, `reversal in chain ${l.regionalId} at ${b}`);
    }
  }
});

test('audit fails on a duplicate ribbon', async () => {
  const r = await runAudit({mutate: (town) => { const av = town.roads.find((x) => x.kind === 'avenue' && Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]) > 20); town.roads.push({...av, a: [av.a[0] + .4, av.a[1] + .4], b: [av.b[0] - .3, av.b[1] + .4]}); }});
  assert(open(r, ['overlap']).length > 0);
});

test('audit fails on a dead-end stub', async () => {
  const r = await runAudit({mutate: (town) => town.roads.push({a: [-144, -70], b: [-150, -70], width: 3, kind: 'avenue'})});
  assert(open(r, ['stub', 'dead-end']).length > 0);
});
