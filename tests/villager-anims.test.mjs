import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveAll } from '../src/catalog/resolve-all.js';
import { compileWorld } from '../src/compiler/world-plan.js';
import { animationPlan, animationRuleErrors, CLIP, strideFoot, STANCE } from '../src/life/animation-plan.js';
import { villagerClips } from '../src/life/animation-clips.js';
import { auditVillagerAnimations } from '../tools/audit-villager-anims.mjs';
import { runAudit } from '../tools/audit-roads.mjs';

const seat = { id: 'bench/1', kind: 'seat', position: [3, 8], seatHeight: .53 };
const seated = { clip: CLIP.sit, slot: seat, position: [3, 8], hipsY: .64, hipsAboveSeat: .11 };

test('accepted actions select shared poses only at suitable places and reservations', () => {
  const plan = options => animationPlan({ variant: 1, ...options }).clip;
  assert.equal(plan({ tool: 'walkTo', moving: true }), CLIP.walk);
  assert.equal(plan({ tool: 'walkTo', moving: false }), CLIP.idle);
  assert.equal(plan({ moving: true, turn: -1.4 }), CLIP.right);
  assert.equal(plan({ tool: 'talkTo' }), CLIP.wave);
  assert.equal(plan({ tool: 'rest', slot: seat, position: [3, 8] }), CLIP.sit);
  assert.equal(plan({ tool: 'rest', slot: seat, position: [9, 8] }), CLIP.idle);
  assert.equal(plan({ tool: 'rest', place: { points: ['seat'] } }), CLIP.idle);
  assert.equal(plan({ tool: 'eat', slot: seat }), CLIP.seatedEat);
  assert.equal(plan({ tool: 'eat', place: { kind: 'tavern' } }), CLIP.eat);
  for (const tool of ['work', 'buy', 'sell', 'payBill']) {
    assert.equal(plan({ tool, place: { points: ['counter'] } }), CLIP.counter);
  }
  assert.equal(plan({ tool: 'visit', variant: 2 }), CLIP.read);
  assert.equal(plan({ tool: 'work', role: 'fisherman', place: { kind: 'pier' } }), CLIP.fish);
  assert.equal(plan({ tool: 'rest', role: 'fisherman', place: { kind: 'pier' } }), CLIP.idle);
  assert.equal(plan({ tool: 'walkTo', role: 'hiker', place: { kind: 'trail' }, moving: true }), CLIP.hike);
  const play = { kind: 'playground', interaction: { activity: 'play' } };
  assert.equal(plan({ tool: 'visit', role: 'child', place: play, slot: { kind: 'standing' } }), CLIP.play);
  assert.equal(plan({ tool: 'visit', role: 'child', place: play }), CLIP.idle);
});

test('all shared clip bindings are Mixamo quaternions and the stance foot moves exactly against navigation', () => {
  assert.equal(villagerClips.size, Object.keys(CLIP).length);
  for (const { clip } of villagerClips.values()) {
    assert(clip.duration > 0 && clip.tracks.every(t => /^mixamorig\w+\.quaternion$/.test(t.name)));
  }
  for (const stride of [.45, .83]) {
    const start = strideFoot(0, stride).z;
    for (let phase = 0; phase < STANCE; phase += .01) {
      const foot = strideFoot(phase, stride);
      assert(foot.planted && foot.lift === 0);
      assert(Math.abs(foot.z + phase * stride - start) < 1e-10);
    }
  }
});

const faults = [
  { ...seated, position: [55, 1] },
  { ...seated, hipsY: 1.1 },
  { clip: CLIP.idle, tPose: true },
  { clip: CLIP.walk, rootTravel: 0, soleError: 0, stanceSlip: .12 },
];

test('TOWN-09 rejects road sitting, floating hips, bind poses and skating', () => {
  assert.deepEqual(animationRuleErrors(seated), []);
  for (const sample of faults) assert.equal(animationRuleErrors(sample).length, 1);
});

test('the road audit runs TOWN-09 and reports each injected fault', async () => {
  const catalog = resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url))));
  const town = compileWorld(catalog, 831);
  const found = [];
  assert(auditVillagerAnimations(town, (...args) => found.push(args)).length > 10);
  assert.deepEqual(found, []);
  const result = await runAudit({
    mutateAnimations(samples) {
      samples.push(...faults.map((sample, i) => {
        if (i === 1) {
          const slot = { ...sample.slot, position: [70, 1] };
          return { ...sample, slot, position: slot.position };
        }
        return { ...sample, position: [55 + i * 15, 1] };
      }));
    },
  });
  const failures = result.findings.filter(finding => finding.rule === 'TOWN-09');
  assert.equal(failures.length, 4);
  assert(failures.every(failure => failure.status === 'open'));
});
