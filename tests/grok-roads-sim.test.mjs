import {TOWN_RULE} from '../src/compiler/town-rules.js';
// OWNER: grok-roads lane. Full simulated day (seed 831): cars, buses, parked
// cars, residents and downtown errand walkers. Every count must be zero.
import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateDay} from '../tools/sim-collisions.mjs';

test(`${TOWN_RULE.walking} a full day has no car-car, car-person or person-on-road events`, {timeout: 3600000}, async () => {
  const r = await simulateDay({hours: 24});
  assert(r.counts.samples > 5000 && r.vehicles > 20 && r.residents > 20, 'the day actually ran');
  const {samples, ...incidents} = r.counts;
  assert(Object.values(incidents).every((count) => count === 0), JSON.stringify(r.firsts));
});
