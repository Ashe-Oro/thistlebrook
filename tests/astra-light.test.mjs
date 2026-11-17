import test from 'node:test';
import assert from 'node:assert/strict';
import { Color } from 'three';
import { LIGHT_KEYS, normalizeHour, sampleLightCycle, lightPeriod } from '../src/astra/light-cycle.js';

const state = hour => {
 const { from, to, blend } = sampleLightCycle(hour);
 return from.slice(1).flatMap((value,i) => {
  const next=to[i+1];
  return typeof value==='string' ? new Color(value).lerp(new Color(next),blend).toArray() : [value+(next-value)*blend];
 });
};

test('the entire day has finite light, bounded practicals and an above-ground key',()=>{
 for(let minute=0;minute<1440;minute++){
  const s=sampleLightCycle(minute/60);
  assert(state(minute/60).every(Number.isFinite));
  assert(s.blend>=0&&s.blend<=1);
  const night=s.from[9]+(s.to[9]-s.from[9])*s.blend;
  assert(night>=0&&night<=1);
  assert(s.from[11]>0&&s.to[11]>0);
 }
 assert.equal(sampleLightCycle(12).from[9],0);
 assert.equal(sampleLightCycle(0).from[9],1);
});

test('light and colour are continuous at every authored key and midnight',()=>{
 for(const [hour] of LIGHT_KEYS){
  const before=state(hour-1e-5), after=state(hour+1e-5);
  assert(before.every((value,i)=>Math.abs(value-after[i])<1e-5),`Discontinuity at ${hour}`);
 }
 assert.deepEqual(state(0),state(24));
 assert.deepEqual(state(-1),state(23));
 assert.deepEqual(state(49),state(1));
});

test('URL and control hours normalize safely, and each featured phase is distinct',()=>{
 assert.equal(normalizeHour(-1),23);
 assert.equal(normalizeHour(48),0);
 for(const value of [NaN,Infinity,undefined,'invalid'])assert.equal(normalizeHour(value),10.4);
 assert.equal(lightPeriod(6.3),'Dawn');
 assert.equal(lightPeriod(10.4),'Daylight');
 assert.equal(lightPeriod(17.4),'Golden hour');
 assert.equal(lightPeriod(19.3),'Dusk');
 assert.equal(lightPeriod(22),'Moonlight');
 assert.equal(new Set([6.3,10.4,17.4,19.3,22].map(hour=>JSON.stringify(state(hour)))).size,5);
});
