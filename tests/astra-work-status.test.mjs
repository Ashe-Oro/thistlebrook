import test from 'node:test';
import assert from 'node:assert/strict';
import {workStatus} from '../src/astra/work-status.js';
test('live staffing copy distinguishes arrival, work, breaks and closed hours',()=>{
 assert.equal(workStatus({workers:0,commuting:6},10.4),'Day shift · neighbours are on their way');
 assert.equal(workStatus({workers:3,commuting:2},10.4),'3 working now · 2 on their way');
 assert.equal(workStatus({workers:0,commuting:0},10.4),'Day shift · breaks and errands');
 assert.equal(workStatus({workers:6},12),'Lunch hour · back at one');
 assert.equal(workStatus({},6),'Before the day shift · starts at seven');
 assert.equal(workStatus({},17),'The day shift has finished');
});
