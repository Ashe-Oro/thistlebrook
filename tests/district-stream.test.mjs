import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelDetail } from '../src/astra/model-detail.js';
import {Group} from 'three';
import {createDistrictStream} from '../src/astra/district-stream.js';
import {districtPlaceholder} from '../src/astra/district-placeholder.js';

const bounds = x => ({minX:x,maxX:x+5,minZ:0,maxZ:5});

test('opening detail upgrades wait until background streaming starts', async () => {
  const home = {x:1,z:3,zoom:4.7};
  const detail = createModelDetail(home,{deferFull:true});
  const applied = [];
  let loads = 0;
  detail.track([[1,3]],'low',()=>{loads++;return 'full';},model=>applied.push(model));
  detail.preload(home);
  detail.update(home);
  await detail.settled();
  assert.equal(loads,0);
  assert.deepEqual(applied,['low']);

  detail.start();
  await detail.settled();
  assert.equal(loads,1);
  assert.deepEqual(applied,['low','full']);
  detail.update({...home,zoom:.3});
  assert.deepEqual(applied,['low','full','low']);
});

test('opening district loads first and a camera jump reprioritizes queued districts', async () => {
  const events = [];
  const stream = createDistrictStream({initial:{x:0,z:0},concurrency:1});
  let release;
  const nearest = new Promise(resolve => {release=resolve;});
  const add = (id,x,opening=false,wait) => stream.add(id,bounds(x),{
    opening,
    load(){events.push(id);return wait;},
    attach(){},
  });

  add('background',40);
  add('nearest',15,false,nearest);
  add('opening',0,true);
  add('destination',100);

  await stream.opening();
  assert.deepEqual(events,['opening']);
  const streamed = stream.start();
  await Promise.resolve();
  assert.deepEqual(events,['opening','nearest']);
  stream.prioritize({x:102,z:3},10);
  release();
  await streamed;

  assert.deepEqual(events,['opening','nearest','destination','background']);
});

test('a district that times out keeps its silhouette and releases the queue', async () => {
  const scene = new Group();
  const silhouette = districtPlaceholder({venues:[]},'missing',scene,bounds(0));
  const warnings = [];
  const stream = createDistrictStream({initial:{x:0,z:0},concurrency:1,timeout:15,onError:(...args)=>warnings.push(args)});
  let finish;
  let attached = false;
  stream.add('missing',bounds(0),{
    load:()=>new Promise(resolve=>{finish=resolve;}),
    attach(){silhouette.removeFromParent();},
  });
  stream.add('next',bounds(10),{load(){},attach(){attached=true;}});
  await stream.start();
  finish(new Group());
  await Promise.resolve();

  assert.equal(silhouette.parent,scene);
  assert.ok(silhouette.children.length);
  assert.deepEqual(stream.audit(),{missing:'failed',next:'loaded'});
  assert.equal(attached,true);
  assert.equal(warnings.length,1);
});

test('paced background streaming runs onPrepare before attach and yields turns', async () => {
  const events = [];
  let turns = 0;
  const stream = createDistrictStream({
    initial: { x: 0, z: 0 },
    concurrency: 1,
    pace: true,
    frameBudgetMs: 0,
    yieldMs: 1,
    async onPrepare(result, job) { events.push('prepare:' + job.id + ':' + result); },
    onAttach(result) { events.push('attach-cb:' + result); },
  });
  stream.add('open', bounds(0), { opening: true, load: () => 'o', attach: r => events.push('attach:open:' + r) });
  stream.add('bg1', bounds(10), { load: () => '1', attach: r => events.push('attach:bg1:' + r) });
  stream.add('bg2', bounds(20), { load: () => '2', attach: r => events.push('attach:bg2:' + r) });
  await stream.opening();
  const done = stream.start();
  const timer = setInterval(() => { turns++; }, 1);
  await done;
  clearInterval(timer);
  assert.ok(turns >= 1, 'timers ran between paced background attaches');
  assert.deepEqual(events, [
    'prepare:open:o', 'attach:open:o', 'attach-cb:o',
    'prepare:bg1:1', 'attach:bg1:1', 'attach-cb:1',
    'prepare:bg2:2', 'attach:bg2:2', 'attach-cb:2',
  ]);
});
