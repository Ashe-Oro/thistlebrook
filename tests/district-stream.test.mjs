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
