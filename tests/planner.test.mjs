import test from 'node:test';
import assert from 'node:assert/strict';
import {habitDue,dueHabits,aiHeaders} from '../public/planner-core.js';
test('recurrence uses latest actual check-in, clamps month end and resets after another check-in',()=>{
 const h={intervalCount:2,intervalUnit:'months',startedOn:'2026-10-21',days:['2026-01-31','2026-08-31','2026-02-01']};
 assert.equal(habitDue(h),'2026-10-31');assert.equal(dueHabits([h],'2026-10-30').length,0);assert.equal(dueHabits([h],'2026-10-31').length,1);
 h.days.push('2026-10-21');assert.equal(habitDue(h),'2026-12-21');assert.equal(dueHabits([h],'2026-10-31').length,0);
 assert.equal(habitDue({intervalCount:1,intervalUnit:'months',startedOn:'2026-01-31'}),'2026-02-28');
 assert.equal(habitDue({intervalCount:1,intervalUnit:'months',startedOn:'2028-01-31'}),'2028-02-29');
 assert.equal(habitDue({intervalCount:2,intervalUnit:'weeks',startedOn:'2026-10-21'}),'2026-11-04');
 assert.equal(habitDue({days:[]}), '');
});
test('API identifies the real app and keeps a stable separate session for each conversation',()=>{
 assert.deepEqual(aiHeaders('chat-a'),aiHeaders('chat-a'));assert.notEqual(aiHeaders('chat-a')['x-opencode-session'],aiHeaders('chat-b')['x-opencode-session']);assert.equal(aiHeaders('a\r\nb')['x-opencode-session'],'a__b');assert.match(aiHeaders('chat-a')['User-Agent'],/^NongPlanner\//);
});
