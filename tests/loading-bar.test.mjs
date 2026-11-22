import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createLoadProgress} from '../src/astra/load-progress.js';

function withFiles(tracker,large=90) {
  const sizes = {'/small':10,'/large':large};
  const paths = Object.keys(sizes);
  tracker.setManifest({sizes,opening:{desktop:{downloads:paths,models:paths}}},'desktop',true);
}

test('manifest bytes weight transfers and decoding ahead of response lengths',()=>{
  const tracker = createLoadProgress({weights:{download:.3,decode:.5,frame:.2}});
  withFiles(tracker);
  const small = tracker.model('/small');
  const large = tracker.model('/large');
  small.transfer(10,1000);
  large.transfer(20,20);
  assert.equal(tracker.state().progress,.09);
  small.finish();
  assert.equal(tracker.state().progress,.14);
  large.finish();
  assert.equal(tracker.state().progress,.8);
});

test('an unknown transfer uses observed bytes once it completes',()=>{
  const tracker = createLoadProgress({weights:{download:.4,decode:.5,frame:.1}});
  const streamed = tracker.model('/chunked.glb');
  streamed.transfer(32,0);
  assert.equal(tracker.state().progress,0);
  streamed.transfer(64,0);
  tracker.resource('/chunked.glb',64);
  assert.equal(tracker.state().progress,.4);
  streamed.finish();
  assert.equal(tracker.state().progress,.9);
});

test('boot stays monotonic with new work and only reaches 100% at readiness',()=>{
  const updates = [];
  const tracker = createLoadProgress({weights:{download:.4,decode:.6},onChange:state=>updates.push(state)});
  const small = tracker.model('/small');
  small.transfer(5,10);
  const earlier = tracker.state().progress;
  const unknown = tracker.model('/large');
  unknown.transfer(1,200);
  assert.equal(tracker.state().progress,earlier);
  small.finish();
  unknown.finish();
  assert.ok(tracker.state().progress<.99);
  assert.equal(tracker.state().mode,'boot');
  tracker.ready();
  assert.equal(updates.at(-1).progress,1);
  assert.equal(updates.at(-1).mode,'boot');
  assert.ok(updates.every((state,i)=>!i||state.progress>=updates[i-1].progress));
});

test('ETA needs a stable measured rate and expires when work stalls',()=>{
  let time=0;
  const tracker = createLoadProgress({weights:{download:.9,frame:.1},now:()=>time});
  const model = tracker.model('/large');
  for (let n=1;n<=4;n++) {
    time += 240;
    model.transfer(n*10,100);
  }
  assert.equal(tracker.state().eta,2);
  time += 80;
  model.transfer(85,100);
  assert.equal(tracker.state().eta,null);
  for (let n=0;n<3;n++) {
    time += 240;
    model.transfer(86+n,100);
  }
  assert.equal(tracker.state().eta,null);
  time += 601;
  assert.equal(tracker.state().eta,null);
});

test('slim indicator tracks later work independently of the boot curve',()=>{
  const tracker = createLoadProgress();
  tracker.ready();
  const bootSamples = [...tracker.samples];
  assert.deepEqual(tracker.state(),{mode:'slim',phase:'ready',progress:1,eta:null,active:false});
  const attached = tracker.district();
  const model = tracker.model('/later');
  model.transfer(50,100);
  assert.equal(tracker.state().mode,'slim');
  assert.equal(tracker.state().active,true);
  model.finish();
  assert.ok(tracker.state().progress<1);
  attached();
  assert.equal(tracker.state().active,false);
  assert.deepEqual(tracker.samples,bootSamples);
});


test('the slim stream budgets for queued districts and later model bytes',()=>{
  const tracker = createLoadProgress();
  tracker.setManifest({
    sizes:{'/small.glb':10,'/large.glb':90},opening:{},streamed:['/small.glb','/large.glb'],
  },'desktop',true);
  tracker.ready();
  const finish = tracker.stream(4);
  const attach = tracker.district();
  tracker.model('/small.glb').finish();
  attach();
  assert.ok(Math.abs(tracker.state().progress-.1125)<1e-12);
  assert.equal(tracker.state().active,true);
  finish();
  assert.equal(tracker.state().active,false);
});
